import Database from 'better-sqlite3';
import path from 'path';

// En Vercel, la raíz es de solo lectura. Usamos /tmp/ para poder escribir en SQLite de forma temporal.
const dbPath = process.env.NODE_ENV === 'production' && process.env.VERCEL
  ? '/tmp/database.sqlite'
  : path.join(process.cwd(), 'database.sqlite');

const db = new Database(dbPath);

// Inicializar la tabla de presupuestos si no existe
db.exec(`
  CREATE TABLE IF NOT EXISTS presupuestos (
    id TEXT PRIMARY KEY,
    cliente TEXT NOT NULL,
    email_cliente TEXT NOT NULL,
    fecha_creacion TEXT NOT NULL,
    estado TEXT DEFAULT 'pendiente', -- 'pendiente' | 'enviado' | 'recordatorio_enviado'
    enlace_documento TEXT NOT NULL
  );
`);

export interface Presupuesto {
  id: string;
  cliente: string;
  email_cliente: string;
  fecha_creacion: string;
  estado: 'pendiente' | 'enviado' | 'recordatorio_enviado';
  enlace_documento: string;
}

// 1. Guardar nuevo presupuesto
export function crearPresupuesto(p: Omit<Presupuesto, 'fecha_creacion' | 'estado'>) {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO presupuestos (id, cliente, email_cliente, fecha_creacion, estado, enlace_documento)
    VALUES (?, ?, ?, ?, 'pendiente', ?)
  `);
  const fecha = new Date().toISOString();
  stmt.run(p.id, p.cliente, p.email_cliente, fecha, p.enlace_documento);
}

// 2. Obtener lista completa (ordenada por fecha de llegada)
export function obtenerTodos(): Presupuesto[] {
  const stmt = db.prepare('SELECT * FROM presupuestos ORDER BY fecha_creacion DESC');
  return stmt.all() as Presupuesto[];
}

// 3. Actualizar estado
export function actualizarEstado(id: string, nuevoEstado: 'pendiente' | 'enviado' | 'recordatorio_enviado') {
  const stmt = db.prepare('UPDATE presupuestos SET estado = ? WHERE id = ?');
  stmt.run(nuevoEstado, id);
}

// 4. Obtener pendientes de envío
export function obtenerPendientes(): Presupuesto[] {
  const stmt = db.prepare("SELECT * FROM presupuestos WHERE estado = 'pendiente'");
  return stmt.all() as Presupuesto[];
}

export default db;
