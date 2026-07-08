import Database from 'better-sqlite3';
import { db as vercelDb } from '@vercel/postgres';
import path from 'path';

export interface Presupuesto {
  id: string;
  cliente: string;
  email_cliente: string;
  fecha_creacion: string;
  estado: 'pendiente' | 'enviado' | 'recordatorio_enviado';
  enlace_documento: string;
}

// Detección automática: Si existe la variable POSTGRES_URL, usamos la nube. Si no, usamos SQLite local.
const usePostgres = !!process.env.POSTGRES_URL;

let sqliteDb: any = null;

if (!usePostgres) {
  // Inicialización de SQLite local
  const dbPath = path.join(process.cwd(), 'database.sqlite');
  sqliteDb = new Database(dbPath);
  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS presupuestos (
      id TEXT PRIMARY KEY,
      cliente TEXT NOT NULL,
      email_cliente TEXT NOT NULL,
      fecha_creacion TEXT NOT NULL,
      estado TEXT DEFAULT 'pendiente',
      enlace_documento TEXT NOT NULL
    );
  `);
}

let pgInitialized = false;
async function checkPgInit() {
  if (pgInitialized) return;
  try {
    const client = await vercelDb.connect();
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
    pgInitialized = true;
  } catch (error) {
    console.error('Error al inicializar Postgres en la nube:', error);
  }
}

// 1. Guardar o actualizar presupuesto
export async function crearPresupuesto(p: Omit<Presupuesto, 'fecha_creacion' | 'estado'>) {
  const fecha = new Date().toISOString();
  
  if (usePostgres) {
    await checkPgInit();
    const client = await vercelDb.connect();
    await client.sql`
      INSERT INTO presupuestos (id, cliente, email_cliente, fecha_creacion, estado, enlace_documento)
      VALUES (${p.id}, ${p.cliente}, ${p.email_cliente}, ${fecha}, 'pendiente', ${p.enlace_documento})
      ON CONFLICT (id) DO UPDATE SET
        cliente = EXCLUDED.cliente,
        email_cliente = EXCLUDED.email_cliente,
        enlace_documento = EXCLUDED.enlace_documento;
    `;
  } else {
    const stmt = sqliteDb.prepare(`
      INSERT OR REPLACE INTO presupuestos (id, cliente, email_cliente, fecha_creacion, estado, enlace_documento)
      VALUES (?, ?, ?, ?, 'pendiente', ?)
    `);
    stmt.run(p.id, p.cliente, p.email_cliente, fecha, p.enlace_documento);
  }
}

// 2. Obtener todos los presupuestos
export async function obtenerTodos(): Promise<Presupuesto[]> {
  if (usePostgres) {
    await checkPgInit();
    const client = await vercelDb.connect();
    const { rows } = await client.sql`
      SELECT * FROM presupuestos ORDER BY fecha_creacion DESC
    `;
    return rows as Presupuesto[];
  } else {
    const stmt = sqliteDb.prepare('SELECT * FROM presupuestos ORDER BY fecha_creacion DESC');
    return stmt.all() as Presupuesto[];
  }
}

// 3. Obtener presupuesto por ID
export async function obtenerPorId(id: string): Promise<Presupuesto | null> {
  if (usePostgres) {
    await checkPgInit();
    const client = await vercelDb.connect();
    const { rows } = await client.sql`
      SELECT * FROM presupuestos WHERE id = ${id}
    `;
    return (rows[0] as Presupuesto) || null;
  } else {
    const stmt = sqliteDb.prepare('SELECT * FROM presupuestos WHERE id = ?');
    return (stmt.get(id) as Presupuesto) || null;
  }
}

// 4. Actualizar estado
export async function actualizarEstado(id: string, nuevoEstado: 'pendiente' | 'enviado' | 'recordatorio_enviado') {
  if (usePostgres) {
    await checkPgInit();
    const client = await vercelDb.connect();
    await client.sql`
      UPDATE presupuestos SET estado = ${nuevoEstado} WHERE id = ${id}
    `;
  } else {
    const stmt = sqliteDb.prepare('UPDATE presupuestos SET estado = ? WHERE id = ?');
    stmt.run(nuevoEstado, id);
  }
}

// 5. Obtener pendientes
export async function obtenerPendientes(): Promise<Presupuesto[]> {
  if (usePostgres) {
    await checkPgInit();
    const client = await vercelDb.connect();
    const { rows } = await client.sql`
      SELECT * FROM presupuestos WHERE estado = 'pendiente'
    `;
    return rows as Presupuesto[];
  } else {
    const stmt = sqliteDb.prepare("SELECT * FROM presupuestos WHERE estado = 'pendiente'");
    return stmt.all() as Presupuesto[];
  }
}
