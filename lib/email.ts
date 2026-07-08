import nodemailer from 'nodemailer';

export async function sendFollowUpEmail(email: string, cliente: string, enlaceDoc: string): Promise<boolean> {
  const host = process.env.EMAIL_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.EMAIL_PORT || '587', 10);
  const secure = process.env.EMAIL_SECURE === 'true';
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;

  if (!user || !pass) {
    console.error('[EMAIL ERROR] Las credenciales EMAIL_USER o EMAIL_PASS no están configuradas.');
    throw new Error('Configuración SMTP de email incompleta.');
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });

  const asunto = `Recordatorio de presupuesto pendiente - Alcebo Control de Plagas`;
  const textoPlano = `Hola ${cliente},\n\nHace dos días le enviamos nuestra propuesta de servicio técnico con el presupuesto a su dirección de correo. Puede revisarlo y descargarlo aquí:\n\n${enlaceDoc}\n\nQuedamos a su entera disposición para cualquier duda.\n\nUn cordial saludo,\nAlcebo Control de Plagas`;

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
          <p style="font-size:16px; line-height:1.6; margin:0 0 16px 0;">Estimado/a <strong>${cliente}</strong>,</p>
          <p style="font-size:15px; line-height:1.6; margin:0 0 24px 0;">Le escribimos para recordarle que tiene disponible la propuesta técnica y presupuesto que le enviamos hace dos días.</p>
          <div style="text-align:center; margin:32px 0;">
            <a href="${enlaceDoc}" style="background-color:#009FE3; color:#ffffff; padding:14px 28px; text-decoration:none; border-radius:8px; font-weight:bold; font-size:15px; display:inline-block; box-shadow:0 2px 4px rgba(0,0,0,0.1);">Ver mi Presupuesto</a>
          </div>
          <p style="font-size:15px; line-height:1.6; margin:0 0 8px 0;">Si tiene cualquier duda sobre el tratamiento o desea confirmar el inicio del servicio, puede responder directamente a este correo.</p>
          <p style="font-size:15px; line-height:1.6; margin:24px 0 0 0;">Un cordial saludo,<br><strong>Alcebo Control de Plagas</strong></p>
        </div>
        <div style="background-color:#f8fafc; padding:16px; border-top:1px solid #e2e8f0; text-align:center; font-size:11px; color:#a0aec0;">
          <p style="margin:0;">Este es un mensaje de seguimiento automático para el presupuesto enviado.</p>
        </div>
      </div>
    </body>
    </html>
  `.trim();

  try {
    await transporter.sendMail({
      from: `"Alcebo Control de Plagas" <${user}>`,
      to: email,
      subject: asunto,
      text: textoPlano,
      html: html,
    });
    console.log(`[EMAIL SUCCESS] Recordatorio enviado correctamente a ${email}`);
    return true;
  } catch (error: any) {
    console.error(`[EMAIL ERROR] Fallo al enviar correo a ${email}:`, error.message);
    throw error;
  }
}
