import Database from 'better-sqlite3';
import { db as vercelDb } from '@vercel/postgres';
import path from 'path';

export interface Presupuesto {
  id: string;
  cliente: string;
  email_cliente: string;
  fecha_creacion: string;
  estado: 'pendiente' | 'recordatorio_enviado' | 'completado';
  enlace_documento: string;
}

const usePostgres = !!process.env.POSTGRES_URL;

let sqliteDb: any = null;

if (!usePostgres) {
  const dbPath = path.join(process.cwd(), 'database.sqlite');
  sqliteDb = new Database(dbPath);
  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS presupuestos (
      id TEXT PRIMARY KEY,
      cliente TEXT NOT NULL,
      email_cliente TEXT NOT NULL,
      fecha_creacion TEXT NOT NULL,
      estado TEXT DEFAULT 'pendiente', -- 'pendiente' | 'recordatorio_enviado' | 'completado'
      enlace_documento TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS configuracion (
      key TEXT PRIMARY KEY,
      value TEXT
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
    await client.sql`
      CREATE TABLE IF NOT EXISTS configuracion (
        key TEXT PRIMARY KEY,
        value TEXT
      );
    `;
    pgInitialized = true;
  } catch (error) {
    console.error('Error al inicializar Postgres:', error);
  }
}

// Inicializar configuración por defecto (Solo el correo de recordatorio de pago)
async function checkDefaultTemplates() {
  const config = await obtenerConfiguracion();
  if (Object.keys(config).length === 0) {
    const defaultTemplate = [
      'Hola {cliente},',
      '',
      'Le escribimos para recordarle el pago del presupuesto solicitado con el número {id} enviado hace dos días.',
      '',
      'Si ya ha realizado la transferencia, por favor ignore este mensaje. En caso contrario, puede descargar el presupuesto y consultar los datos bancarios haciendo clic en el siguiente enlace:',
      '',
      '{enlace_documento}',
      '',
      'Quedamos a su entera disposición.',
      '',
      'Un cordial saludo,',
      'Alcebo Control de Plagas'
    ].join('\n');

    const defaults = [
      { key: 'smtp_host', value: 'smtp.gmail.com' },
      { key: 'smtp_port', value: '587' },
      { key: 'smtp_secure', value: 'false' },
      { key: 'smtp_user', value: '' },
      { key: 'smtp_pass', value: '' },
      { key: 'smtp_from', value: '' },
      { key: 'email_subject', value: 'Recordatorio de pago - Presupuesto {id} - Alcebo' },
      { key: 'email_body', value: defaultTemplate },
      { key: 'delay_hours', value: '48' }
    ];

    if (usePostgres) {
      const client = await vercelDb.connect();
      for (const item of defaults) {
        await client.sql`INSERT INTO configuracion (key, value) VALUES (${item.key}, ${item.value}) ON CONFLICT (key) DO NOTHING;`;
      }
    } else {
      const insert = sqliteDb.prepare('INSERT OR IGNORE INTO configuracion (key, value) VALUES (?, ?)');
      for (const item of defaults) {
        insert.run(item.key, item.value);
      }
    }
  }
}

// 1. Guardar presupuesto
export async function crearPresupuesto(p: Omit<Presupuesto, 'fecha_creacion' | 'estado'>) {
  const fecha = new Date().toISOString();
  if (usePostgres) {
    await checkPgInit();
    await checkDefaultTemplates();
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
    await checkDefaultTemplates();
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
export async function actualizarEstado(id: string, nuevoEstado: 'pendiente' | 'recordatorio_enviado' | 'completado') {
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

// 5. Obtener pendientes de recordatorio (estado = 'pendiente')
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

// Configuración
export async function obtenerConfiguracion(): Promise<Record<string, string>> {
  if (usePostgres) {
    await checkPgInit();
    const client = await vercelDb.connect();
    const { rows } = await client.sql`SELECT key, value FROM configuracion`;
    const config: Record<string, string> = {};
    rows.forEach(r => { config[r.key] = r.value || ''; });
    return config;
  } else {
    const rows = sqliteDb.prepare('SELECT key, value FROM configuracion').all() as { key: string; value: string }[];
    const config: Record<string, string> = {};
    rows.forEach(r => { config[r.key] = r.value || ''; });
    return config;
  }
}

export async function guardarConfiguracion(key: string, value: string) {
  if (usePostgres) {
    await checkPgInit();
    const client = await vercelDb.connect();
    await client.sql`
      INSERT INTO configuracion (key, value) VALUES (${key}, ${value})
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
    `;
  } else {
    sqliteDb.prepare('INSERT OR REPLACE INTO configuracion (key, value) VALUES (?, ?)').run(key, value);
  }
}

export default sqliteDb;
