import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import nodemailer from 'nodemailer';
import cron from 'node-cron';

// Global DB instance
let db: Database<sqlite3.Database, sqlite3.Statement>;

// Helper to log system events to DB
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
      console.error('Error writing to logs table:', err);
    }
  }
}

// Log a sent email to database for visual confirmation
async function logSentEmail(destinatario: string, asunto: string, cuerpo: string) {
  const fecha = new Date().toISOString();
  if (db) {
    try {
      await db.run(
        'INSERT INTO correos_enviados (fecha, destinatario, asunto, cuerpo) VALUES (?, ?, ?, ?)',
        [fecha, destinatario, asunto, cuerpo]
      );
    } catch (err) {
      console.error('Error logging sent email:', err);
    }
  }
}

// SMTP Connection Tester / Nodemailer helper (Only 1 email sent)
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

  // Replace template tags
  const subject = subjectTemplate
    .replace(/{id}/g, budget.id)
    .replace(/{cliente}/g, budget.cliente)
    .replace(/{documento}/g, budget.documento || '');

  const formattedText = plainBodyTemplate
    .replace(/{id}/g, budget.id)
    .replace(/{cliente}/g, budget.cliente)
    .replace(/{documento}/g, budget.documento || '');

  // Split plain text by double newlines into HTML paragraphs
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

  // Demo fallback
  if (!user || !pass || user.trim() === '' || pass.trim() === '') {
    await logSentEmail(budget.email, subject, html);
    return { 
      sentReal: false, 
      details: 'Modo Simulación (Sin SMTP). Guardado en Bandeja de Salida.' 
    };
  }

  // Real SMTP
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });

  await transporter.sendMail({
    from: `Alcebo Control de Plagas <${from}>`,
    to: budget.email,
    subject,
    html,
  });

  await logSentEmail(budget.email, subject, html);
  return { sentReal: true, details: 'Enviado por SMTP real.' };
}

async function startServer() {
  const app = express();
  const PORT = 3001;

  // Initialize SQLite Database
  const dbPath = path.join(process.cwd(), 'database.sqlite');
  db = await open({
    filename: dbPath,
    driver: sqlite3.Database,
  });

  // Create tables
  await db.exec(`
    CREATE TABLE IF NOT EXISTS presupuestos (
      id TEXT PRIMARY KEY,
      cliente TEXT NOT NULL,
      email TEXT NOT NULL,
      fecha TEXT NOT NULL,
      documento TEXT NOT NULL,
      monto REAL DEFAULT 0,
      estado TEXT DEFAULT 'Pendiente', -- 'Pendiente', 'Completado'
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

  console.log('[DB] Base de datos SQLite inicializada correctamente.');

  // Set default configurations if empty (Only 1 template!)
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

  app.use(express.json());

  // -------------------------------------------------------------
  // API Routes
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
        return res.status(400).json({ error: 'Faltan campos obligatorios.' });
      }

      const fechaCreacion = new Date().toISOString();
      
      await db.run(
        `INSERT OR REPLACE INTO presupuestos 
         (id, cliente, email, fecha, documento, monto, estado, fecha_creacion, fecha_seguimiento_enviado, email_enviado, estado_visual, error_seguimiento) 
         VALUES (?, ?, ?, ?, ?, ?, 'Pendiente', ?, NULL, 0, 'Pendiente de enviar', NULL)`,
        [id, cliente, email, fecha, documento, parseFloat(monto) || 0, fechaCreacion]
      );

      await logSystemEvent('db_recibido', `Presupuesto recibido desde App 1: ID ${id}, Cliente: ${cliente}, Email: ${email}`);

      return res.status(201).json({ success: true, id });
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
        await logSystemEvent('cron', `Presupuesto ID ${id} marcado como COMPLETADO (Trato Cerrado). Se detienen los recordatorios.`);
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

      await logSystemEvent('email_enviado', `Iniciando envío de correo de seguimiento para presupuesto ID ${id}`);
      
      try {
        const { sentReal, details } = await sendFollowUpEmail(budget, config);
        const timestamp = new Date().toISOString();

        await db.run(
          `UPDATE presupuestos 
           SET email_enviado = 1, estado_visual = 'Enviado', fecha_seguimiento_enviado = ?, error_seguimiento = NULL 
           WHERE id = ?`,
          [timestamp, id]
        );

        await logSystemEvent('email_enviado', `Email de seguimiento enviado con éxito (o simulado): ${details} (${budget.email})`);
        return res.json({ success: true, details });
      } catch (err: any) {
        console.error('Email error:', err);
        await db.run(
          `UPDATE presupuestos 
           SET error_seguimiento = ? 
           WHERE id = ?`,
          [err.message, id]
        );
        await logSystemEvent('email_error', `Fallo al enviar correo a ${budget.email} (ID ${id}): ${err.message}`);
        return res.status(500).json({ error: 'Fallo al procesar el envío.', details: err.message });
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

  // Background cron job
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
          await logSystemEvent('cron', `Cron detecta presupuesto ID ${budget.id} elegible para recordatorio de 48h`);
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
    } catch (error: any) {
      console.error('Error in background cron job:', error);
    }
  });

  if (process.env.NODE_ENV !== 'production') {
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
    console.log(`[ALCEBO MAIL SERVER] Escuchando en http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[ALCEBO SERVER] Error fatal al iniciar el servidor:', err);
});
