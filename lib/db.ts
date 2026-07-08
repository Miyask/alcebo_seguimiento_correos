import { db } from '@vercel/postgres';

export interface Presupuesto {
  id: string;
  cliente: string;
  email_cliente: string;
  fecha_creacion: string;
  estado: 'pendiente' | 'enviado' | 'recordatorio_enviado';
  enlace_documento: string;
}

let initialized = false;

// Inicializa las tablas automáticamente en la nube de Vercel si no existen
async function checkInit() {
  if (initialized) return;
  try {
    const client = await db.connect();
    await client.sql`
      CREATE TABLE IF NOT EXISTS presupuestos (
        id TEXT PRIMARY KEY,
        cliente TEXT NOT NULL,
        email_cliente TEXT NOT NULL,
        fecha_creacion TEXT NOT NULL,
        estado TEXT DEFAULT 'pendiente',
        enlace_documento TEXT NOT NULL
      );
    `;
    initialized = true;
  } catch (error) {
    console.error('Error al inicializar las tablas de Postgres:', error);
  }
}

// 1. Guardar o actualizar presupuesto
export async function crearPresupuesto(p: Omit<Presupuesto, 'fecha_creacion' | 'estado'>) {
  await checkInit();
  const client = await db.connect();
  const fecha = new Date().toISOString();
  await client.sql`
    INSERT INTO presupuestos (id, cliente, email_cliente, fecha_creacion, estado, enlace_documento)
    VALUES (${p.id}, ${p.cliente}, ${p.email_cliente}, ${fecha}, 'pendiente', ${p.enlace_documento})
    ON CONFLICT (id) DO UPDATE SET
      cliente = EXCLUDED.cliente,
      email_cliente = EXCLUDED.email_cliente,
      enlace_documento = EXCLUDED.enlace_documento;
  `;
}

// 2. Obtener lista completa para la interfaz
export async function obtenerTodos(): Promise<Presupuesto[]> {
  await checkInit();
  const client = await db.connect();
  const { rows } = await client.sql`
    SELECT * FROM presupuestos ORDER BY fecha_creacion DESC
  `;
  return rows as Presupuesto[];
}

// 3. Actualizar estado (ej: marcar como enviado)
export async function actualizarEstado(id: string, nuevoEstado: 'pendiente' | 'enviado' | 'recordatorio_enviado') {
  await checkInit();
  const client = await db.connect();
  await client.sql`
    UPDATE presupuestos SET estado = ${nuevoEstado} WHERE id = ${id}
  `;
}

// 4. Obtener presupuestos de hace 48 horas pendientes
export async function obtenerPendientes(): Promise<Presupuesto[]> {
  await checkInit();
  const client = await db.connect();
  const { rows } = await client.sql`
    SELECT * FROM presupuestos WHERE estado = 'pendiente'
  `;
  return rows as Presupuesto[];
}
