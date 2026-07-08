import React, { useState, useEffect } from 'react';
import { Presupuesto, SystemLog } from '../types';

interface SimulacionViewProps {
  presupuestos: Presupuesto[];
  onRefresh: () => void;
}

export default function SimulacionView({ presupuestos, onRefresh }: SimulacionViewProps) {
  // Mock Generator Fields
  const [mockId, setMockId] = useState('');
  const [mockCliente, setMockCliente] = useState('');
  const [mockEmail, setMockEmail] = useState('');
  const [mockFecha, setMockFecha] = useState('');
  const [mockDocumento, setMockDocumento] = useState('Tratamiento de Control de Aves y Palomas');
  const [mockMonto, setMockMonto] = useState('525.00');

  // Time Warp Selected ID
  const [selectedWarpId, setSelectedWarpId] = useState('');

  // Logs state
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [autoRefreshLogs, setAutoRefreshLogs] = useState(true);

  // Generate random mock ID and data on mount
  useEffect(() => {
    resetMockForm();
    fetchLogs();
  }, []);

  // Poll logs if auto-refresh is active
  useEffect(() => {
    let interval: any;
    if (autoRefreshLogs) {
      interval = setInterval(() => {
        fetchLogs();
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [autoRefreshLogs]);

  const resetMockForm = () => {
    const randomId = 'P-' + Math.floor(10000 + Math.random() * 90000);
    setMockId(randomId);
    setMockCliente('Comunidad de Vecinos Av. Constitución ' + Math.floor(1 + Math.random() * 100));
    setMockFecha(new Date().toISOString().split('T')[0]);
    // Leave mock email empty or keep the user's focus
    setMockEmail('');
  };

  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/system-logs');
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
      }
    } catch (err) {
      console.error('Error fetching logs:', err);
    }
  };

  // Action: Post mock budget (App 1 Simulation)
  const handleInjectBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mockEmail) {
      alert('Debes ingresar un email de destino para poder realizar el seguimiento.');
      return;
    }
    try {
      const res = await fetch('/api/presupuestos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: mockId,
          cliente: mockCliente,
          email: mockEmail,
          fecha: mockFecha,
          documento: mockDocumento,
          monto: parseFloat(mockMonto) || 0
        })
      });
      if (res.ok) {
        alert(`¡Presupuesto ${mockId} inyectado con éxito en SQLite!`);
        onRefresh();
        fetchLogs();
        resetMockForm();
      } else {
        const err = await res.json();
        throw new Error(err.error || 'Error al inyectar');
      }
    } catch (err: any) {
      alert(`Error de simulación: ${err.message}`);
    }
  };

  // Action: Warp time (subtract 48.5 hours from creation timestamp)
  const handleWarpTime = async () => {
    if (!selectedWarpId) {
      alert('Selecciona un presupuesto pendiente.');
      return;
    }
    try {
      // 48 hours and 30 minutes in milliseconds
      const timeOffset = 48.5 * 60 * 60 * 1000;
      const warpedTime = new Date(Date.now() - timeOffset).toISOString();

      const res = await fetch(`/api/presupuestos/${selectedWarpId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fecha_creacion: warpedTime
        })
      });

      if (res.ok) {
        alert('¡Fecha modificada con éxito! El presupuesto ahora figura como si se hubiese creado hace 48 horas. El scheduler (cron) lo evaluará en el próximo minuto.');
        onRefresh();
        fetchLogs();
      } else {
        throw new Error('Error al adelantar el tiempo');
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  // Filter budgets that are pending follow-up
  const pendingBudgets = presupuestos.filter(p => p.estado === 'Pendiente' && p.email_enviado === 0);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Welcome Banner */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs">
        <h1 className="text-3xl font-extrabold text-[#1A1A1A] tracking-tight">
          Panel de Pruebas y Simulación
        </h1>
        <p className="text-slate-500 mt-1.5 text-base font-medium">
          Simula el comportamiento de la App 1 enviando presupuestos, adelanta el tiempo 48 horas y revisa los logs de envío en tiempo real.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Left: App 1 Simulation Form */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-slate-100 bg-slate-50">
            <h3 className="font-extrabold text-[#1A1A1A] text-lg flex items-center gap-2">
              <span className="material-symbols-outlined text-[#009FE3]">input</span>
              1. Simular Envío desde App 1
            </h3>
            <p className="text-xs text-slate-450 mt-1 font-medium leading-relaxed">
              Introduce datos ficticios. Al hacer clic en enviar, se simulará que la App 1 ha registrado el presupuesto y este se guardará en la base de datos compartida SQLite.
            </p>
          </div>
          
          <form onSubmit={handleInjectBudget} className="p-6 space-y-4 flex-1">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">ID Presupuesto</label>
                <input
                  type="text"
                  required
                  value={mockId}
                  onChange={(e) => setMockId(e.target.value)}
                  className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:bg-white focus:border-[#009FE3]"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Fecha del Presupuesto</label>
                <input
                  type="date"
                  required
                  value={mockFecha}
                  onChange={(e) => setMockFecha(e.target.value)}
                  className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:bg-white focus:border-[#009FE3]"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nombre del Cliente</label>
              <input
                type="text"
                required
                placeholder="Comunidad Propietarios Calle Mayor 2"
                value={mockCliente}
                onChange={(e) => setMockCliente(e.target.value)}
                className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:bg-white focus:border-[#009FE3]"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Correo Electrónico (Email Cliente)</label>
              <input
                type="email"
                required
                placeholder="correo-cliente@ejemplo.com"
                value={mockEmail}
                onChange={(e) => setMockEmail(e.target.value)}
                className="p-3 bg-slate-50 border border-slate-250 rounded-xl text-sm font-bold outline-none focus:bg-white focus:border-[#009FE3] placeholder-slate-400"
              />
              <p className="text-[10px] text-slate-400 font-medium">Recomendación: Pon un correo tuyo para poder verificar que te llega correctamente.</p>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="flex flex-col gap-1.5 col-span-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nombre del Documento</label>
                <input
                  type="text"
                  required
                  value={mockDocumento}
                  onChange={(e) => setMockDocumento(e.target.value)}
                  className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:bg-white focus:border-[#009FE3]"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Importe (€)</label>
                <input
                  type="text"
                  required
                  value={mockMonto}
                  onChange={(e) => setMockMonto(e.target.value)}
                  className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:bg-white focus:border-[#009FE3] text-center"
                />
              </div>
            </div>

            <div className="pt-4 flex gap-3">
              <button
                type="button"
                onClick={resetMockForm}
                className="px-4 py-3 bg-slate-100 hover:bg-slate-250 text-slate-650 font-bold rounded-xl active:scale-95 transition-colors cursor-pointer"
              >
                Limpiar datos
              </button>
              <button
                type="submit"
                className="flex-1 py-3 bg-[#009FE3] hover:bg-[#0084c2] text-white font-extrabold rounded-xl active:scale-95 transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">add_task</span>
                Registrar Presupuesto Falso
              </button>
            </div>
          </form>
        </div>

        {/* Right: Time Warp & Cron Testing */}
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-4">
            <h3 className="font-extrabold text-[#1A1A1A] text-lg flex items-center gap-2">
              <span className="material-symbols-outlined text-[#009FE3]">schedule</span>
              2. Simular paso de 48 horas (Warp)
            </h3>
            <p className="text-xs text-slate-450 leading-relaxed font-medium">
              Al hacer clic en este botón, restaremos 48.5 horas a la fecha en la que se registró el presupuesto seleccionado. 
              Esto simula el transcurso de los 2 días. El planificador en segundo plano (`node-cron`), que se ejecuta cada minuto, lo detectará y enviará el email inmediatamente.
            </p>

            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Selecciona Presupuesto Pendiente</label>
                <select
                  value={selectedWarpId}
                  onChange={(e) => setSelectedWarpId(e.target.value)}
                  className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:bg-white focus:border-[#009FE3] text-[#1A1A1A]"
                >
                  <option value="">-- Elige un presupuesto en cola --</option>
                  {pendingBudgets.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.id} - {p.cliente} ({new Date(p.fecha_creacion).toLocaleDateString()})
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={handleWarpTime}
                disabled={!selectedWarpId}
                className="py-3.5 bg-yellow-500 hover:bg-yellow-600 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-extrabold rounded-xl active:scale-95 transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">forward_10</span>
                Restar 48 Horas a la Creación
              </button>
              
              {pendingBudgets.length === 0 && (
                <p className="text-[10px] text-amber-600 bg-amber-50 p-2.5 rounded border border-amber-200 font-bold">
                  ⚠️ No hay presupuestos con seguimiento de correo pendiente. Simula uno en la columna izquierda primero.
                </p>
              )}
            </div>
          </div>

          {/* Logs Panel */}
          <div className="bg-slate-900 text-slate-100 rounded-2xl p-6 shadow-md border border-slate-800 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="font-mono text-sm font-bold text-sky-400 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Consola de Eventos (Servidor)
              </h3>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer select-none font-bold">
                  <input
                    type="checkbox"
                    checked={autoRefreshLogs}
                    onChange={(e) => setAutoRefreshLogs(e.target.checked)}
                    className="rounded border-slate-800 text-sky-500 focus:ring-0 focus:ring-offset-0 bg-slate-850"
                  />
                  Auto-actualizar
                </label>
                <button
                  onClick={fetchLogs}
                  title="Recargar Logs"
                  className="text-slate-400 hover:text-white material-symbols-outlined text-lg leading-none cursor-pointer"
                >
                  refresh
                </button>
              </div>
            </div>

            <div className="font-mono text-[11px] h-48 overflow-y-auto space-y-1.5 pr-2 custom-scrollbar">
              {logs.length === 0 ? (
                <div className="text-slate-500 italic py-8 text-center">No hay registros de eventos disponibles aún.</div>
              ) : (
                logs.map((log) => {
                  let badgeColor = 'text-slate-400';
                  if (log.tipo === 'email_enviado') badgeColor = 'text-emerald-400 font-bold';
                  if (log.tipo === 'email_error') badgeColor = 'text-rose-400 font-bold';
                  if (log.tipo === 'db_recibido') badgeColor = 'text-sky-400 font-bold';
                  if (log.tipo === 'cron') badgeColor = 'text-yellow-400';
                  
                  return (
                    <div key={log.id} className="leading-relaxed border-b border-slate-850 pb-1 flex gap-2">
                      <span className="text-slate-600 shrink-0 select-none">
                        [{new Date(log.timestamp).toLocaleTimeString()}]
                      </span>
                      <span className={`${badgeColor} shrink-0 select-none`}>
                        {log.tipo.toUpperCase()}:
                      </span>
                      <span className="text-slate-300">{log.mensaje}</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
