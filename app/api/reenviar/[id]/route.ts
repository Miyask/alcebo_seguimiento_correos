import { NextResponse } from 'next/server';
import { db } from '@vercel/postgres';
import { actualizarEstado } from '@/lib/db';
import { sendFollowUpEmail } from '@/lib/email';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const id = params.id;
    const client = await db.connect();
    
    // Obtener detalles del presupuesto desde Postgres
    const { rows } = await client.sql`SELECT * FROM presupuestos WHERE id = ${id}`;
    const budget = rows[0] as any;

    if (!budget) {
      return NextResponse.json({ error: 'Presupuesto no encontrado.' }, { status: 404 });
    }

    // Forzar el envío manual inmediato
    await sendFollowUpEmail(budget.email_cliente, budget.cliente, budget.enlace_documento);

    // Actualizar estado a 'recordatorio_enviado'
    await actualizarEstado(id, 'recordatorio_enviado');

    return NextResponse.json({ success: true, message: 'Correo de recordatorio enviado correctamente.' });
  } catch (error: any) {
    console.error(`[POST /api/reenviar/${params.id} ERROR]:`, error);
    return NextResponse.json(
      { error: 'Error al procesar el envío de correo', details: error.message },
      { status: 500 }
    );
  }
}
