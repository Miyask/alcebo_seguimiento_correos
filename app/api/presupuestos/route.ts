import { NextResponse } from 'next/server';
import { crearPresupuesto, obtenerTodos } from '@/lib/db';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Responder preflights OPTIONS de CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders,
  });
}

// GET /api/presupuestos - Devuelve todos los presupuestos para el frontend
export async function GET() {
  try {
    const list = await obtenerTodos();
    return NextResponse.json(list, { headers: corsHeaders });
  } catch (error: any) {
    console.error('[GET /api/presupuestos ERROR]:', error);
    return NextResponse.json(
      { error: 'Error al consultar presupuestos', details: error.message },
      { status: 500, headers: corsHeaders }
    );
  }
}

// POST /api/presupuestos - Recibe JSON y lo registra en Postgres
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { id, cliente, email_cliente, enlace_documento } = body;

    if (!id || !cliente || !email_cliente || !enlace_documento) {
      return NextResponse.json(
        { error: 'Faltan campos obligatorios (id, cliente, email_cliente, enlace_documento)' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Guardar en base de datos (con estado 'pendiente', listo para que pasen las 48h)
    await crearPresupuesto({ id, cliente, email_cliente, enlace_documento });

    return NextResponse.json({ success: true, id }, { headers: corsHeaders });
  } catch (error: any) {
    console.error('[POST /api/presupuestos ERROR]:', error);
    return NextResponse.json(
      { error: 'Error al registrar presupuesto', details: error.message },
      { status: 500, headers: corsHeaders }
    );
  }
}
