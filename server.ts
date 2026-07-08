import express from 'express';
import path from 'path';
import fs from 'fs';
import nodemailer from 'nodemailer';
import cron from 'node-cron';
import { db as vercelDb } from '@vercel/postgres';

const app = express();
const PORT = 3001;

// En Vercel siempre forzamos el uso de Postgres (SQLite no es compatible con funciones serverless)
const usePostgres = !!process.env.POSTGRES_URL || !!process.env.VERCEL;

// Interface unificada para interactuar con la base de datos
let db: {
  all: (sql: string, params?: any[]) => Promise<any[]>;
  run: (sql: string, params?: any[]) => Promise<any>;
  get: (sql: string, params?: any[]) => Promise<any>;
  exec: (sql: string) => Promise<any>;
};

let dbInitialized = false;

async function initDb() {
  if (dbInitialized) return;

  if (usePostgres) {
    // Si estamos en Vercel pero el usuario no ha conectado la base de datos Postgres todavía
    if (!process.env.POSTGRES_URL) {
      throw new Error(
        'La base de datos Vercel Postgres no está conectada. Por favor, ve al panel de tu proyecto en Vercel, entra en la pestaña "Storage" (arriba), crea una base de datos de Postgres y haz clic en "Connect" para vincularla a este proyecto.'
      );
    }

    console.log('[DB] Conectando a Vercel Postgres...');
    try {
      const client = await vercelDb.connect();
      
      // Crear tablas si no existen en Postgres
      await client.sql`
        CREATE TABLE IF NOT EXISTS presupuestos (
          id VARCHAR(255) PRIMARY KEY,
          cliente VARCHAR(255) NOT NULL,
          email VARCHAR(255) NOT NULL,
          fecha VARCHAR(255) NOT NULL,
          documento VARCHAR(255) NOT NULL,
          monto REAL DEFAULT 0,
          estado VARCHAR(50) DEFAULT 'Pendiente',
          fecha_creacion VARCHAR(255) NOT NULL,
          fecha_seguimiento_enviado VARCHAR(255),
          email_enviado INTEGER DEFAULT 0,
          estado_visual VARCHAR(100) DEFAULT 'Pendiente de enviar',
          error_seguimiento TEXT
        );
      `;
      await client.sql`
        CREATE TABLE IF NOT EXISTS configuracion (
          key VARCHAR(255) PRIMARY KEY,
          value TEXT
        );
      `;
      await client.sql`
        CREATE TABLE IF NOT EXISTS logs (
          id SERIAL PRIMARY KEY,
          timestamp VARCHAR(255) NOT NULL,
          tipo VARCHAR(100) NOT NULL,
          mensaje TEXT NOT NULL
        );
      `;
      await client.sql`
        CREATE TABLE IF NOT EXISTS correos_enviados (
          id SERIAL PRIMARY KEY,
          fecha VARCHAR(255) NOT NULL,
          destinatario VARCHAR(255) NOT NULL,
          asunto VARCHAR(255) NOT NULL,
          cuerpo TEXT NOT NULL
        );
      `;

      const convertSql = (sql: string) => {
        let index = 1;
        let pgSql = sql.replace(/\?/g, () => `$${index++}`);
        
        if (pgSql.toUpperCase().includes('INSERT OR REPLACE INTO PRESUPUESTOS')) {
          pgSql = `
            INSERT INTO presupuestos 
            (id, cliente, email, fecha, documento, monto, estado, fecha_creacion, fecha_seguimiento_enviado, email_enviado, estado_visual, error_seguimiento) 
            VALUES ($1, $2, $3, $4, $5, $6, 'Pendiente', $7, NULL, 0, 'Pendiente de enviar', NULL)
            ON CONFLICT (id) DO UPDATE SET
              cliente = EXCLUDED.cliente,
              email = EXCLUDED.email,
              fecha = EXCLUDED.fecha,
              documento = EXCLUDED.documento,
              monto = EXCLUDED.monto,
              estado = EXCLUDED.estado,
              fecha_creacion = EXCLUDED.fecha_creacion,
              estado_visual = EXCLUDED.estado_visual;
          `;
        } else if (pgSql.toUpperCase().includes('INSERT OR REPLACE INTO CONFIGURACION')) {
          pgSql = `
            INSERT INTO configuracion (key, value) VALUES ($1, $2)
            ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
          `;
        }
        return pgSql;
      };

      db = {
        all: async (sql, params = []) => {
          const pgSql = convertSql(sql);
          const { rows } = await vercelDb.query(pgSql, params);
          return rows;
        },
        run: async (sql, params = []) => {
          const pgSql = convertSql(sql);
          return vercelDb.query(pgSql, params);
        },
        get: async (sql, params = []) => {
          const pgSql = convertSql(sql);
          const { rows } = await vercelDb.query(pgSql, params);
          return rows[0] || null;
        },
        exec: async (sql) => {
          return vercelDb.query(sql);
        }
      };

      dbInitialized = true;
      console.log('[DB] Vercel Postgres inicializada con éxito.');
    } catch (err) {
      console.error('[DB ERROR] Error al conectar con Postgres:', err);
      throw err;
    }
  } else {
    console.log('[DB] Conectando a SQLite local de forma dinámica...');
    try {
      // Uso de eval('require') para evitar que bundlers como Webpack o Esbuild intenten empaquetar sqlite3
      const sqlite3Module = eval('require')('sqlite3');
      const sqliteModule = eval('require')('sqlite');
      
      const dbPath = path.join(process.cwd(), 'database.sqlite');
      
      const sqliteInstance = await sqliteModule.open({
        filename: dbPath,
        driver: sqlite3Module.Database,
      });

      await sqliteInstance.exec(`
        CREATE TABLE IF NOT EXISTS presupuestos (
          id TEXT PRIMARY KEY,
          cliente TEXT NOT NULL,
          email TEXT NOT NULL,
          fecha TEXT NOT NULL,
          documento TEXT NOT NULL,
          monto REAL DEFAULT 0,
          estado TEXT DEFAULT 'Pendiente',
          fecha_creacion TEXT NOT NULL,
          fecha_seguimiento_enviado TEXT,
          email_enviado INTEGER DEFAULT 0,
          estado_visual TEXT DEFAULT 'Pendiente de enviar',
          error_seguimiento TEXT
        );

        CREATE TABLE IF NOT EXISTS configuracion (
          key TEXT PRIMARY KEY,
          value TEXT
        );

        CREATE TABLE IF NOT EXISTS logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          timestamp TEXT NOT NULL,
          tipo TEXT NOT NULL,
          mensaje TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS correos_enviados (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          fecha TEXT NOT NULL,
          destinatario TEXT NOT NULL,
          asunto TEXT NOT NULL,
          cuerpo TEXT NOT NULL
        );
      `);

      db = {
        all: (sql, params = []) => sqliteInstance.all(sql, params),
        run: (sql, params = []) => sqliteInstance.run(sql, params),
        get: (sql, params = []) => sqliteInstance.get(sql, params),
        exec: (sql) => sqliteInstance.exec(sql)
      };

      dbInitialized = true;
      console.log('[DB] SQLite local inicializada con éxito.');
    } catch (err) {
      console.error('[DB ERROR] Error al inicializar SQLite:', err);
      throw err;
    }
  }

  // Plantillas por defecto
  if (dbInitialized) {
    try {
      const hasConfig = await db.get('SELECT key FROM configuracion LIMIT 1');
      if (!hasConfig) {
        const defaultTemplate = [
          'Hola {cliente},',
          '',
          'Hace dos días le enviamos nuestra propuesta de servicio técnico con el presupuesto número {id} para el servicio de {documento}.',
          '',
          'Le escribimos para saber si ha tenido tiempo de revisarlo o si tiene alguna consulta técnica respecto al tratamiento propuesto.',
          '',
          'Si lo desea, puede responder directamente a este correo o ponerse en contacto con nosotros en nuestro teléfono de atención al cliente.',
          '',
          'Un cordial saludo,',
          'Alcebo Control de Plagas'
        ].join('\n');

        const defaults = [
          { key: 'smtp_host', value: 'smtp.gmail.com' },
          { key: 'smtp_port', value: '587' },
          { key: 'smtp_secure', value: 'false' },
          { key: 'smtp_user', value: '' },
          { key: 'smtp_pass', value: '' },
          { key: 'smtp_from', value: 'presupuestos@alcebocontrol.com' },
          { key: 'email_subject', value: 'Seguimiento del presupuesto {id} - Alcebo Control de Plagas' },
          { key: 'email_body', value: defaultTemplate },
          { key: 'delay_hours', value: '48' },
        ];

        for (const item of defaults) {
          await db.run('INSERT OR REPLACE INTO configuracion (key, value) VALUES (?, ?)', [item.key, item.value]);
        }
      }
    } catch (err) {
      console.error('Error al insertar configuraciones por defecto:', err);
    }
  }
}

// Helper para guardar logs de eventos
async function logSystemEvent(tipo: string, mensaje: string) {
  const timestamp = new Date().toISOString();
  console.log(`[SYS-LOG] [${tipo.toUpperCase()}] ${mensaje}`);
  if (db) {
    try {
      await db.run(
        'INSERT INTO logs (timestamp, tipo, mensaje) VALUES (?, ?, ?)',
        [timestamp, tipo, mensaje]
      );
    } catch (err) {
      console.error('Error al guardar log:', err);
    }
  }
}

// Helper para guardar historial de correos
async function logSentEmail(destinatario: string, asunto: string, cuerpo: string) {
  const fecha = new Date().toISOString();
  if (db) {
    try {
      await db.run(
        'INSERT INTO correos_enviados (fecha, destinatario, asunto, cuerpo) VALUES (?, ?, ?, ?)',
        [fecha, destinatario, asunto, cuerpo]
      );
    } catch (err) {
      console.error('Error al guardar log de correo enviado:', err);
    }
  }
}

// Nodemailer para enviar el recordatorio
async function sendFollowUpEmail(budget: any, config: Record<string, string>): Promise<{ sentReal: boolean; details: string }> {
  const host = config['smtp_host'] || 'smtp.gmail.com';
  const port = parseInt(config['smtp_port'] || '587', 10);
  const secure = config['smtp_secure'] === 'true';
  const user = config['smtp_user'] || '';
  const pass = config['smtp_pass'] || '';
  const from = config['smtp_from'] || 'no-reply@alcebocontrol.com';
  const subjectTemplate = config['email_subject'] || 'Seguimiento de su presupuesto {id} - Alcebo';
  const plainBodyTemplate = config['email_body'] || '';

  if (!subjectTemplate || !plainBodyTemplate) {
    throw new Error('La plantilla de asunto o mensaje está vacía.');
  }

  const subject = subjectTemplate
    .replace(/{id}/g, budget.id)
    .replace(/{cliente}/g, budget.cliente)
    .replace(/{documento}/g, budget.documento || '');

  const formattedText = plainBodyTemplate
    .replace(/{id}/g, budget.id)
    .replace(/{cliente}/g, budget.cliente)
    .replace(/{documento}/g, budget.documento || '');

  const paragraphsHtml = formattedText
    .split('\n\n')
    .map((para: string) => {
      const cleanPara = para.trim().replace(/\n/g, '<br>');
      if (!cleanPara) return '';
      return `<p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #1A1A1A;">${cleanPara}</p>`;
    })
    .filter(Boolean)
    .join('');

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
</head>
<body style="margin: 0; padding: 0; background-color: #F8FAFC; font-family: Arial, sans-serif;">
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 20px auto; color: #1A1A1A; border: 1px solid #E2E8F0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); background-color: #FFFFFF;">
    <div style="background-color: #009FE3; padding: 24px; text-align: center;">
      <h2 style="color: #FFFFFF; margin: 0; font-size: 22px; font-weight: bold; letter-spacing: 0.5px;">ALCEBO CONTROL DE PLAGAS</h2>
    </div>
    <div style="padding: 32px 24px;">
      ${paragraphsHtml}
      <div style="margin: 32px 0; text-align: center;">
        <a href="mailto:${from}?subject=Re: Presupuesto ${budget.id}" style="background-color: #009FE3; color: #FFFFFF; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px; display: inline-block;">Responder a este correo</a>
      </div>
    </div>
    <div style="background-color: #F8FAFC; padding: 16px; border-top: 1px solid #E2E8F0; text-align: center; font-size: 11px; color: #A0AEC0;">
      <p style="margin: 0;">© 2026 Alcebo Control de Plagas. Todos los derechos reservados.</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  // Modo Demo / Simulado si no hay SMTP
  if (!user || !pass || user.trim() === '' || pass.trim() === '') {
    await logSentEmail(budget.email, subject, html);
    return { 
      sentReal: false, 
      details: 'Modo Simulación (Sin SMTP). Guardado en Bandeja de Salida.' 
    };
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });

  await transporter.sendMail({
    from: `Alcebo Control de Plagas <${from}>`,
    to: budget.email,
    bcc: user, // Copia oculta automática a la oficina
    subject,
    html,
  });

  await logSentEmail(budget.email, subject, html);
  return { sentReal: true, details: 'Enviado por SMTP real.' };
}

// -------------------------------------------------------------
// Middlewares generales
// -------------------------------------------------------------
app.use(express.json());

// CORS habilitado
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Inicialización diferida de base de datos para funciones Serverless
app.use(async (req, res, next) => {
  try {
    await initDb();
    next();
  } catch (err: any) {
    res.status(200).json({ error: 'Base de datos no disponible', details: err.message });
  }
});

// -------------------------------------------------------------
// Rutas de la API de seguimiento
// -------------------------------------------------------------

app.get('/api/presupuestos', async (req, res) => {
  try {
    const search = req.query.search ? `%${req.query.search}%` : '%';
    const status = req.query.status || 'All';
    
    let query = 'SELECT * FROM presupuestos WHERE (id LIKE ? OR cliente LIKE ? OR documento LIKE ?)';
    const params: any[] = [search, search, search];

    if (status !== 'All') {
      query += ' AND estado = ?';
      params.push(status);
    }

    query += ' ORDER BY fecha_creacion DESC';
    
    const list = await db.all(query, params);
    return res.json(list);
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ error: 'Error al consultar presupuestos.', details: error.message });
  }
});

app.post('/api/presupuestos', async (req, res) => {
  try {
    const { id, cliente, email, fecha, documento, monto } = req.body;

    if (!id || !cliente || !email || !fecha || !documento) {
      return res.status(400).json({ error: 'Faltan campos obligatorios (id, cliente, email, fecha, documento).' });
    }

    const fechaCreacion = new Date().toISOString();
    
    await db.run(
      `INSERT OR REPLACE INTO presupuestos 
       (id, cliente, email, fecha, documento, monto, estado, fecha_creacion, fecha_seguimiento_enviado, email_enviado, estado_visual, error_seguimiento) 
       VALUES (?, ?, ?, ?, ?, ?, 'Pendiente', ?, NULL, 0, 'Pendiente de enviar', NULL)`,
      [id, cliente, email, fecha, documento, parseFloat(monto) || 0, fechaCreacion]
    );

    await logSystemEvent('db_recibido', `Presupuesto recibido: ID ${id}, Cliente: ${cliente}, Email: ${email}`);

    return res.status(200).json({ success: true, id });
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ error: 'Error al registrar presupuesto.', details: error.message });
  }
});

app.patch('/api/presupuestos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { cliente, email, monto, estado, estado_visual, fecha_creacion } = req.body;

    const existing = await db.get('SELECT * FROM presupuestos WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Presupuesto no encontrado.' });
    }

    const newCliente = cliente !== undefined ? cliente : existing.cliente;
    const newEmail = email !== undefined ? email : existing.email;
    const newMonto = monto !== undefined ? parseFloat(monto) : existing.monto;
    const newEstado = estado !== undefined ? estado : existing.estado;
    let newEstadoVisual = estado_visual !== undefined ? estado_visual : existing.estado_visual;
    const newFechaCreacion = fecha_creacion !== undefined ? fecha_creacion : existing.fecha_creacion;

    if (estado === 'Completado') {
      newEstadoVisual = 'Completado';
      await logSystemEvent('cron', `Presupuesto ID ${id} marcado como COMPLETADO. Se cancelan recordatorios.`);
    } else if (estado === 'Pendiente' && existing.estado === 'Completado') {
      newEstadoVisual = existing.email_enviado === 1 ? 'Enviado' : 'Pendiente de enviar';
    }

    await db.run(
      `UPDATE presupuestos 
       SET cliente = ?, email = ?, monto = ?, estado = ?, estado_visual = ?, fecha_creacion = ?
       WHERE id = ?`,
      [newCliente, newEmail, newMonto, newEstado, newEstadoVisual, newFechaCreacion, id]
    );

    return res.json({ success: true });
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ error: 'Error al actualizar presupuesto.', details: error.message });
  }
});

app.post('/api/presupuestos/:id/reenviar', async (req, res) => {
  try {
    const { id } = req.params;
    const budget = await db.get('SELECT * FROM presupuestos WHERE id = ?', [id]);

    if (!budget) {
      return res.status(404).json({ error: 'Presupuesto no encontrado.' });
    }

    const configRows = await db.all('SELECT key, value FROM configuracion');
    const config: Record<string, string> = {};
    configRows.forEach((row) => { config[row.key] = row.value || ''; });

    await logSystemEvent('email_enviado', `Iniciando reenvío manual para ID ${id}`);
    
    try {
      const { sentReal, details } = await sendFollowUpEmail(budget, config);
      const timestamp = new Date().toISOString();

      await db.run(
        `UPDATE presupuestos 
         SET email_enviado = 1, estado_visual = 'Enviado', fecha_seguimiento_enviado = ?, error_seguimiento = NULL 
         WHERE id = ?`,
        [timestamp, id]
      );

      await logSystemEvent('email_enviado', `Reenvío completado: ${details} (${budget.email})`);
      return res.json({ success: true, details });
    } catch (err: any) {
      console.error('Email error:', err);
      await db.run(
        `UPDATE presupuestos 
         SET error_seguimiento = ? 
         WHERE id = ?`,
        [err.message, id]
      );
      await logSystemEvent('email_error', `Fallo en reenvío a ${budget.email}: ${err.message}`);
      return res.status(550).json({ error: 'Fallo al procesar el envío.', details: err.message });
    }
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ error: 'Error interno.', details: error.message });
  }
});

app.get('/api/correos-enviados', async (req, res) => {
  try {
    const list = await db.all('SELECT * FROM correos_enviados ORDER BY id DESC LIMIT 50');
    return res.json(list);
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ error: 'Error al consultar correos enviados.', details: error.message });
  }
});

app.get('/api/config', async (req, res) => {
  try {
    const rows = await db.all('SELECT key, value FROM configuracion');
    const config: Record<string, string> = {};
    rows.forEach((row) => {
      if (row.key === 'smtp_pass' && row.value) {
        config[row.key] = '••••••••••••••••';
      } else {
        config[row.key] = row.value || '';
      }
    });
    return res.json(config);
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ error: 'Error al consultar configuración.', details: error.message });
  }
});

app.post('/api/config', async (req, res) => {
  try {
    const configData = req.body;
    for (const [key, value] of Object.entries(configData)) {
      if (key === 'smtp_pass' && value === '••••••••••••••••') {
        continue;
      }
      await db.run('INSERT OR REPLACE INTO configuracion (key, value) VALUES (?, ?)', [key, String(value)]);
    }
    await logSystemEvent('config', 'Configuración de correo y SMTP actualizada.');
    return res.json({ success: true });
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ error: 'Error al guardar configuración.', details: error.message });
  }
});

app.post('/api/test-email', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Debe especificarse el email de destino.' });
    }

    const configRows = await db.all('SELECT key, value FROM configuracion');
    const config: Record<string, string> = {};
    configRows.forEach((row) => { config[row.key] = row.value || ''; });

    const host = config['smtp_host'] || 'smtp.gmail.com';
    const port = parseInt(config['smtp_port'] || '587', 10);
    const secure = config['smtp_secure'] === 'true';
    const user = config['smtp_user'] || '';
    const pass = config['smtp_pass'] || '';
    const from = config['smtp_from'] || 'no-reply@alcebocontrol.com';

    if (!user || !pass) {
      return res.status(400).json({ error: 'SMTP no configurado.' });
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
    });

    await transporter.sendMail({
      from: `Alcebo Test <${from}>`,
      to: email,
      subject: 'Prueba de conexión SMTP - Alcebo',
      html: `<div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #009FE3; border-radius: 8px;">
        <h2 style="color: #009FE3;">Conexión SMTP Establecida</h2>
        <p>Este correo confirma que tu configuración SMTP en Alcebo funciona correctamente.</p>
        <p style="font-size: 12px; color: #666;">Enviado el ${new Date().toLocaleString()}</p>
      </div>`,
    });

    await logSystemEvent('config', `Correo de prueba SMTP enviado con éxito a ${email}`);
    return res.json({ success: true });
  } catch (error: any) {
    console.error(error);
    await logSystemEvent('email_error', `Error en test SMTP: ${error.message}`);
    return res.status(500).json({ error: 'Conexión SMTP fallida.', details: error.message });
  }
});

app.get('/api/system-logs', async (req, res) => {
  try {
    const list = await db.all('SELECT * FROM logs ORDER BY id DESC LIMIT 50');
    return res.json(list);
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ error: 'Error al consultar logs.', details: error.message });
  }
});

// GET /api/cron
app.get('/api/cron', async (req, res) => {
  try {
    console.log('[CRON] Iniciando comprobación de recordatorios de pago de 48 horas...');
    const configRows = await db.all('SELECT key, value FROM configuracion');
    const config: Record<string, string> = {};
    configRows.forEach((row) => { config[row.key] = row.value || ''; });

    const delayHours = parseInt(config['delay_hours'] || '48', 10);
    const delayMs = delayHours * 60 * 60 * 1000;
    
    const pendingBudgets = await db.all(
      "SELECT * FROM presupuestos WHERE estado = 'Pendiente' AND email_enviado = 0"
    );

    const now = Date.now();
    let totalEnviados = 0;

    for (const budget of pendingBudgets) {
      const creationTime = new Date(budget.fecha_creacion).getTime();
      const diff = now - creationTime;

      if (diff >= delayMs) {
        try {
          const { sentReal, details } = await sendFollowUpEmail(budget, config);
          const timestamp = new Date().toISOString();

          await db.run(
            `UPDATE presupuestos 
             SET email_enviado = 1, estado_visual = 'Enviado', fecha_seguimiento_enviado = ?, error_seguimiento = NULL 
             WHERE id = ?`,
            [timestamp, budget.id]
          );
          await logSystemEvent('email_enviado', `Email de recordatorio automático enviado con éxito: ${details} para ID ${budget.id}`);
          totalEnviados++;
        } catch (err: any) {
          console.error(`Cron automatic email failed for ${budget.id}:`, err.message);
          await db.run(
            `UPDATE presupuestos 
             SET error_seguimiento = ? 
             WHERE id = ?`,
            [err.message, budget.id]
          );
          await logSystemEvent('email_error', `Fallo al enviar recordatorio automático a ${budget.email} (ID ${budget.id}): ${err.message}`);
        }
      }
    }
    return res.json({ success: true, recordatorios_enviados: totalEnviados });
  } catch (error: any) {
    console.error('[CRON ERROR]:', error);
    return res.status(500).json({ error: 'Error en la ejecución del cron', details: error.message });
  }
});

// Planificador local (solo en desarrollo)
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  cron.schedule('* * * * *', async () => {
    try {
      const configRows = await db.all('SELECT key, value FROM configuracion');
      const config: Record<string, string> = {};
      configRows.forEach((row) => { config[row.key] = row.value || ''; });

      const delayHours = parseInt(config['delay_hours'] || '48', 10);
      const delayMs = delayHours * 60 * 60 * 1000;
      
      const pendingBudgets = await db.all(
        "SELECT * FROM presupuestos WHERE estado = 'Pendiente' AND email_enviado = 0"
      );

      const now = Date.now();

      for (const budget of pendingBudgets) {
        const creationTime = new Date(budget.fecha_creacion).getTime();
        const diff = now - creationTime;

        if (diff >= delayMs) {
          await logSystemEvent('cron', `Cron local detecta presupuesto ID ${budget.id} elegible para recordatorio.`);
          try {
            const { sentReal, details } = await sendFollowUpEmail(budget, config);
            const timestamp = new Date().toISOString();

            await db.run(
              `UPDATE presupuestos 
               SET email_enviado = 1, estado_visual = 'Enviado', fecha_seguimiento_enviado = ?, error_seguimiento = NULL 
               WHERE id = ?`,
              [timestamp, budget.id]
            );
            await logSystemEvent('email_enviado', `Email de recordatorio automático enviado con éxito: ${details} para ID ${budget.id}`);
          } catch (err: any) {
            console.error(`Cron local email failed for ${budget.id}:`, err.message);
            await db.run(
              `UPDATE presupuestos 
               SET error_seguimiento = ? 
               WHERE id = ?`,
              [err.message, budget.id]
            );
            await logSystemEvent('email_error', `Fallo al enviar recordatorio automático local a ${budget.email} (ID ${budget.id}): ${err.message}`);
          }
        }
      }
    } catch (error: any) {
      console.error('Error in local background cron:', error);
    }
  });
}

// Carga del frontend (Vite)
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[ALCEBO MAIL SERVER] Escuchando localmente en http://0.0.0.0:${PORT}`);
  });
}

// Iniciar servidor local si no estamos en Vercel
if (!process.env.VERCEL) {
  startServer().catch((err) => {
    console.error('[ALCEBO SERVER] Error fatal al iniciar el servidor local:', err);
  });
}

export default app;
