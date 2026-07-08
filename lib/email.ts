import nodemailer from 'nodemailer';
import { obtenerConfiguracion } from './db';

// Registro de correos para vista de simulación local
import db from './db';
async function registrarCorreoSimulado(destinatario: string, asunto: string, html: string) {
  try {
    if (db) {
      db.prepare(`
        CREATE TABLE IF NOT EXISTS correos_enviados (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          fecha TEXT NOT NULL,
          destinatario TEXT NOT NULL,
          asunto TEXT NOT NULL,
          cuerpo TEXT NOT NULL
        )
      `).run();

      db.prepare('INSERT INTO correos_enviados (fecha, destinatario, asunto, cuerpo) VALUES (?, ?, ?, ?)')
        .run(new Date().toISOString(), destinatario, asunto, html);
    }
  } catch (e) {
    console.error('Error al registrar correo simulado:', e);
  }
}

export async function sendFollowUpEmail(
  email: string, 
  cliente: string, 
  enlaceDoc: string, 
  budgetId: string
): Promise<boolean> {
  
  const config = await obtenerConfiguracion();
  
  const host = config['smtp_host'] || 'smtp.gmail.com';
  const port = parseInt(config['smtp_port'] || '587', 10);
  const secure = config['smtp_secure'] === 'true';
  const user = config['smtp_user'] || '';
  const pass = config['smtp_pass'] || '';
  const from = config['smtp_from'] || user || 'no-reply@alcebocontrol.com';

  const subjectTemplate = config['email_subject'] || 'Recordatorio de pago - Presupuesto {id} - Alcebo';
  const bodyTemplate = config['email_body'] || '';

  // Reemplazar placeholders en plantilla
  const asunto = subjectTemplate
    .replace(/{id}/g, budgetId)
    .replace(/{cliente}/g, cliente);

  const formattedText = bodyTemplate
    .replace(/{id}/g, budgetId)
    .replace(/{cliente}/g, cliente)
    .replace(/{enlace_documento}/g, enlaceDoc)
    .replace(/{documento}/g, 'servicio técnico');

  // Convertir texto a párrafos HTML
  const paragraphsHtml = formattedText
    .split('\n\n')
    .map((para: string) => {
      const clean = para.trim().replace(/\n/g, '<br>');
      if (!clean) return '';
      return `<p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #1a1a1a;">${clean}</p>`;
    })
    .filter(Boolean)
    .join('');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
    </head>
    <body style="margin:0; padding:0; background-color:#f8fafc; font-family:Arial, sans-serif;">
      <div style="max-width: 600px; margin: 30px auto; background-color:#ffffff; border:1px solid #e2e8f0; border-radius:12px; overflow:hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
        <div style="background-color:#009FE3; padding:24px; text-align:center;">
          <h2 style="color:#ffffff; margin:0; font-size:22px; font-weight:bold; letter-spacing:0.5px;">ALCEBO CONTROL DE PLAGAS</h2>
        </div>
        <div style="padding:32px 24px; color:#1a1a1a;">
          ${paragraphsHtml}
          <div style="text-align:center; margin:32px 0;">
            <a href="${enlaceDoc}" style="background-color:#009FE3; color:#ffffff; padding:14px 28px; text-decoration:none; border-radius:8px; font-weight:bold; font-size:15px; display:inline-block; box-shadow:0 2px 4px rgba(0,0,0,0.1);">Ver Presupuesto</a>
          </div>
        </div>
        <div style="background-color:#f8fafc; padding:16px; border-top:1px solid #e2e8f0; text-align:center; font-size:11px; color:#a0aec0;">
          <p style="margin:0;">Mensaje de recordatorio automático enviado por Alcebo Control de Plagas.</p>
        </div>
      </div>
    </body>
    </html>
  `.trim();

  // MODO DEMO
  if (!user || !pass) {
    console.log(`[SIMULACIÓN] Correo de recordatorio guardado para ${email}.`);
    await registrarCorreoSimulado(email, asunto, html);
    return true;
  }

  // Envío real con copia oculta (BCC) a la propia cuenta de correo corporativo
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });

  try {
    await transporter.sendMail({
      from: `Alcebo Control de Plagas <${from}>`,
      to: email,
      bcc: user, // ✉️ COPIA OCULTA A LA OFICINA
      subject: asunto,
      text: formattedText,
      html: html,
    });
    console.log(`[EMAIL SUCCESS] Recordatorio enviado correctamente a ${email}`);
    await registrarCorreoSimulado(email, asunto, html);
    return true;
  } catch (error: any) {
    console.error(`[EMAIL ERROR] Fallo en correo de recordatorio a ${email}:`, error.message);
    throw error;
  }
}
