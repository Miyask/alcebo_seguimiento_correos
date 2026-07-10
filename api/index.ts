import express from 'express';
import { db as vercelDb } from '@vercel/postgres';
import nodemailer from 'nodemailer';

const app = express();

let dbInitialized = false;

async function initDb() {
  if (dbInitialized) return;

  if (!process.env.POSTGRES_URL) {
    throw new Error(
      'La base de datos Vercel Postgres no está conectada. Por favor, ve al panel de tu proyecto en Vercel, entra en la pestaña "Storage" (arriba), crea una base de datos de Postgres y haz clic en "Connect" para vincularla a este proyecto.'
    );
  }

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

    // Cargar configuraciones por defecto
    const hasConfig = await client.query('SELECT key FROM configuracion LIMIT 1');
    if (hasConfig.rowCount === 0) {
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
        await client.query(
          'INSERT INTO configuracion (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value',
          [item.key, item.value]
        );
      }
    }

    dbInitialized = true;
  } catch (err) {
    console.error('Error al conectar e inicializar base de datos Postgres:', err);
    throw err;
  }
}

// Helpers de Logging
async function logSystemEvent(tipo: string, mensaje: string) {
  const timestamp = new Date().toISOString();
  console.log(`[SYS-LOG] [${tipo.toUpperCase()}] ${mensaje}`);
  try {
    await vercelDb.query(
      'INSERT INTO logs (timestamp, tipo, mensaje) VALUES ($1, $2, $3)',
      [timestamp, tipo, mensaje]
    );
  } catch (err) {
    console.error('Error al guardar log:', err);
  }
}

async function logSentEmail(destinatario: string, asunto: string, cuerpo: string) {
  const fecha = new Date().toISOString();
  try {
    await vercelDb.query(
      'INSERT INTO correos_enviados (fecha, destinatario, asunto, cuerpo) VALUES ($1, $2, $3, $4)',
      [fecha, destinatario, asunto, cuerpo]
    );
  } catch (err) {
    console.error('Error al guardar log de correo enviado:', err);
  }
}

// Envío de correo
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
    bcc: user,
    subject,
    html,
  });

  await logSentEmail(budget.email, subject, html);
  return { sentReal: true, details: 'Enviado por SMTP real.' };
}

// Middlewares
app.use(express.json());

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Inicialización diferida de base de datos
app.use(async (req, res, next) => {
  try {
    await initDb();
    next();
  } catch (err: any) {
    res.status(200).json({ error: 'Base de datos no disponible', details: err.message });
  }
});

// Rutas API
app.get('/api/presupuestos', async (req, res) => {
  try {
    const search = req.query.search ? `%${req.query.search}%` : '%';
    const status = req.query.status || 'All';
    
    let query = 'SELECT * FROM presupuestos WHERE (id LIKE $1 OR cliente LIKE $2 OR documento LIKE $3)';
    const params: any[] = [search, search, search];

    if (status !== 'All') {
      query += ' AND estado = $4';
      params.push(status);
    }

    query += ' ORDER BY fecha_creacion DESC';
    
    const { rows } = await vercelDb.query(query, params);
    return res.json(rows);
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ error: 'Error al consultar presupuestos.', details: error.message });
  }
});

app.post('/api/presupuestos', async (req, res) => {
  try {
    const { id, cliente, email, fecha, documento, monto } = req.body;

    if (!id || !email) {
      return res.status(400).json({ error: 'Faltan campos obligatorios (id, email).' });
    }

    // Tolerancia para campos vacíos
    const cleanCliente = cliente && cliente.trim() !== '' ? cliente : 'Cliente sin nombre';
    const cleanDocumento = documento && documento.trim() !== '' ? documento : 'Servicio Técnico';
    const cleanFecha = fecha && fecha.trim() !== '' ? fecha : new Date().toISOString().split('T')[0];
    const cleanMonto = parseFloat(monto) || 0;
    const fechaCreacion = new Date().toISOString();
    
    await vercelDb.query(
      `INSERT INTO presupuestos 
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
         estado_visual = EXCLUDED.estado_visual,
         email_enviado = 0,
         fecha_seguimiento_enviado = NULL,
         error_seguimiento = NULL`,
      [id, cleanCliente, email, cleanFecha, cleanDocumento, cleanMonto, fechaCreacion]
    );

    await logSystemEvent('db_recibido', `Presupuesto recibido: ID ${id}, Cliente: ${cleanCliente}, Email: ${email}`);

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

    const { rows } = await vercelDb.query('SELECT * FROM presupuestos WHERE id = $1', [id]);
    const existing = rows[0];
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

    await vercelDb.query(
      `UPDATE presupuestos 
       SET cliente = $1, email = $2, monto = $3, estado = $4, estado_visual = $5, fecha_creacion = $6
       WHERE id = $7`,
      [newCliente, newEmail, newMonto, newEstado, newEstadoVisual, newFechaCreacion, id]
    );

    return res.json({ success: true });
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ error: 'Error al actualizar presupuesto.', details: error.message });
  }
});

app.delete('/api/presupuestos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await vercelDb.query('SELECT id FROM presupuestos WHERE id = $1', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Presupuesto no encontrado.' });
    }
    await vercelDb.query('DELETE FROM presupuestos WHERE id = $1', [id]);
    await logSystemEvent('db_eliminado', `Presupuesto eliminado: ID ${id}`);
    return res.json({ success: true });
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ error: 'Error al eliminar presupuesto.', details: error.message });
  }
});

app.post('/api/presupuestos/:id/reenviar', async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await vercelDb.query('SELECT * FROM presupuestos WHERE id = $1', [id]);
    const budget = rows[0];

    if (!budget) {
      return res.status(404).json({ error: 'Presupuesto no encontrado.' });
    }

    const { rows: configRows } = await vercelDb.query('SELECT key, value FROM configuracion');
    const config: Record<string, string> = {};
    configRows.forEach((row) => { config[row.key] = row.value || ''; });

    await logSystemEvent('email_enviado', `Iniciando reenvío manual para ID ${id}`);
    
    try {
      const { sentReal, details } = await sendFollowUpEmail(budget, config);
      const timestamp = new Date().toISOString();

      await vercelDb.query(
        `UPDATE presupuestos 
         SET email_enviado = 1, estado_visual = 'Enviado', fecha_seguimiento_enviado = $1, error_seguimiento = NULL 
         WHERE id = $2`,
        [timestamp, id]
      );

      await logSystemEvent('email_enviado', `Reenvío completado: ${details} (${budget.email})`);
      return res.json({ success: true, details });
    } catch (err: any) {
      console.error('Email error:', err);
      await vercelDb.query(
        `UPDATE presupuestos 
         SET error_seguimiento = $1 
         WHERE id = $2`,
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

app.post('/api/presupuestos/:id/preparar-correo', async (req, res) => {
  try {
    const { id } = req.params;
    
    // 1. Obtener presupuesto
    const { rows } = await vercelDb.query('SELECT * FROM presupuestos WHERE id = $1', [id]);
    const budget = rows[0];
    if (!budget) {
      return res.status(404).json({ error: 'Presupuesto no encontrado.' });
    }

    // 2. Obtener configuración de correo
    const { rows: configRows } = await vercelDb.query('SELECT key, value FROM configuracion');
    const config: Record<string, string> = {};
    configRows.forEach((row) => { config[row.key] = row.value || ''; });

    const subjectTemplate = config['email_subject'] || 'Seguimiento del presupuesto {id} - Alcebo';
    const plainBodyTemplate = config['email_body'] || '';

    const subject = subjectTemplate
      .replace(/{id}/g, budget.id)
      .replace(/{cliente}/g, budget.cliente)
      .replace(/{documento}/g, budget.documento || '');

    const body = plainBodyTemplate
      .replace(/{id}/g, budget.id)
      .replace(/{cliente}/g, budget.cliente)
      .replace(/{documento}/g, budget.documento || '');

    // 3. Marcar como enviado en la base de datos
    const timestamp = new Date().toISOString();
    await vercelDb.query(
      `UPDATE presupuestos 
       SET email_enviado = 1, estado_visual = 'Enviado', fecha_seguimiento_enviado = $1, error_seguimiento = NULL 
       WHERE id = $2`,
      [timestamp, id]
    );

    await logSystemEvent('email_enviado', `Preparado reenvío manual (Gmail) para ID ${id}. Marcado como enviado.`);

    return res.json({
      success: true,
      to: budget.email,
      subject,
      body
    });
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ error: 'Error al preparar el correo.', details: error.message });
  }
});

app.get('/api/correos-enviados', async (req, res) => {
  try {
    const { rows } = await vercelDb.query('SELECT * FROM correos_enviados ORDER BY id DESC LIMIT 50');
    return res.json(rows);
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ error: 'Error al consultar correos enviados.', details: error.message });
  }
});

app.delete('/api/correos-enviados/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await vercelDb.query('DELETE FROM correos_enviados WHERE id = $1', [id]);
    return res.json({ success: true });
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ error: 'Error al eliminar correo del historial.', details: error.message });
  }
});

app.get('/api/config', async (req, res) => {
  try {
    const { rows } = await vercelDb.query('SELECT key, value FROM configuracion');
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
      await vercelDb.query(
        'INSERT INTO configuracion (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value',
        [key, String(value)]
      );
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

    const { rows: configRows } = await vercelDb.query('SELECT key, value FROM configuracion');
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
    const { rows } = await vercelDb.query('SELECT * FROM logs ORDER BY id DESC LIMIT 50');
    return res.json(rows);
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ error: 'Error al consultar logs.', details: error.message });
  }
});

// Endpoint GET /api/cron
app.get('/api/cron', async (req, res) => {
  try {
    console.log('[CRON] Iniciando comprobación de recordatorios de pago de 48 horas...');
    const { rows: configRows } = await vercelDb.query('SELECT key, value FROM configuracion');
    const config: Record<string, string> = {};
    configRows.forEach((row) => { config[row.key] = row.value || ''; });

    const delayHours = parseInt(config['delay_hours'] || '48', 10);
    const delayMs = delayHours * 60 * 60 * 1000;
    
    const { rows: pendingBudgets } = await vercelDb.query(
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

          await vercelDb.query(
            `UPDATE presupuestos 
             SET email_enviado = 1, estado_visual = 'Enviado', fecha_seguimiento_enviado = $1, error_seguimiento = NULL 
             WHERE id = $2`,
            [timestamp, budget.id]
          );
          await logSystemEvent('email_enviado', `Email de recordatorio automático enviado con éxito: ${details} para ID ${budget.id}`);
          totalEnviados++;
        } catch (err: any) {
          console.error(`Cron automatic email failed for ${budget.id}:`, err.message);
          await vercelDb.query(
            `UPDATE presupuestos 
             SET error_seguimiento = $1 
             WHERE id = $2`,
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

export default app;
