import cron from 'node-cron';
import { obtenerPendientes, actualizarEstado } from './db';
import { sendFollowUpEmail } from './email';

export function iniciarCronLocal() {
  console.log('[LOCAL CRON] Planificador de tareas iniciado (ejecución cada hora).');
  
  // Se ejecuta al inicio de cada hora (* 0 * * * *)
  cron.schedule('0 * * * *', async () => {
    console.log('[LOCAL CRON] Comprobando presupuestos pendientes de 48 horas...');
    try {
      const pendientes = await obtenerPendientes();
      const ahora = Date.now();
      const limiteMs = 48 * 60 * 60 * 1000;

      for (const p of pendientes) {
        const creacion = new Date(p.fecha_creacion).getTime();
        if (ahora - creacion >= limiteMs) {
          try {
            await sendFollowUpEmail(p.email_cliente, p.cliente, p.enlace_documento, p.id);
            await actualizarEstado(p.id, 'recordatorio_enviado');
          } catch (err: any) {
            console.error(`[LOCAL CRON ERROR] Error en presupuesto ${p.id}:`, err.message);
          }
        }
      }
    } catch (error: any) {
      console.error('[LOCAL CRON ERROR GENERAL]:', error.message);
    }
  });
}
