import { NextResponse } from 'next/server';
import { crearPresupuesto, obtenerTodos } from '@/lib/db';

// GET /api/presupuestos - Devuelve todos los presupuestos para el frontend
export async function GET() {
  try {
    const list = obtenerTodos();
    return NextResponse.json(list);
  } catch (error: any) {
    console.error('[GET /api/presupuestos ERROR]:', error);
    return NextResponse.json(
      { error: 'Error al consultar presupuestos', details: error.message },
      { status: 500 }
    );
  }
}

// POST /api/presupuestos - Recibe JSON desde la App 1 y lo registra en SQLite
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { id, cliente, email_cliente, enlace_documento } = body;

    if (!id || !cliente || !email_cliente || !enlace_documento) {
      return NextResponse.json(
        { error: 'Faltan campos obligatorios (id, cliente, email_cliente, enlace_documento)' },
        { status: 400 }
      );
    }

    crearPresupuesto({ id, cliente, email_cliente, enlace_documento });
    return NextResponse.json({ success: true, id });
  } catch (error: any) {
    console.error('[POST /api/presupuestos ERROR]:', error);
    return NextResponse.json(
      { error: 'Error al registrar presupuesto', details: error.message },
      { status: 500 }
    );
  }
}
