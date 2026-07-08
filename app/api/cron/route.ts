import { NextResponse } from 'next/server';
import { obtenerPendientes, actualizarEstado } from '@/lib/db';
import { sendFollowUpEmail } from '@/lib/email';

export async function GET(req: Request) {
  // Proteger el webhook de ejecuciones públicas externas comparando una clave secreta (opcional)
  const authHeader = req.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('No autorizado', { status: 401 });
  }

  try {
    console.log('[CRON] Iniciando comprobación de recordatorios de pago de 48 horas...');
    const pendientes = await obtenerPendientes();
    const ahora = Date.now();
    const limiteHoras = 48;
    const limiteMs = limiteHoras * 60 * 60 * 1000;

    let totalEnviados = 0;

    for (const p of pendientes) {
      const creacion = new Date(p.fecha_creacion).getTime();
      const diferencia = ahora - creacion;

      // Si han pasado 48 horas desde que se registró (que es cuando enviaron el presupuesto por su cuenta)
      if (diferencia >= limiteMs) {
        console.log(`[CRON] Enviando Recordatorio de Pago para Presupuesto ${p.id} a ${p.email_cliente}`);
        try {
          await sendFollowUpEmail(p.email_cliente, p.cliente, p.enlace_documento, p.id);
          await actualizarEstado(p.id, 'recordatorio_enviado');
          totalEnviados++;
        } catch (err: any) {
          console.error(`[CRON ERROR] Error con Presupuesto ${p.id}: ${err.message}`);
        }
      }
    }

    return NextResponse.json({ success: true, recordatorios_enviados: totalEnviados });
  } catch (error: any) {
    console.error('[CRON GENERAL ERROR]:', error);
    return NextResponse.json({ error: 'Error en la ejecución del cron', details: error.message }, { status: 500 });
  }
}
