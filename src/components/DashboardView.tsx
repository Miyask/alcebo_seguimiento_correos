import React, { useState, useEffect } from 'react';
import { Presupuesto, CorreoEnviado } from '../types';

interface DashboardViewProps {
  presupuestos: Presupuesto[];
  onRefresh: () => void;
  onOpenConfig: () => void;
}

export default function DashboardView({ presupuestos, onRefresh, onOpenConfig }: DashboardViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [selectedBudget, setSelectedBudget] = useState<Presupuesto | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  
  // Sent Emails Mailbox Log State
  const [sentEmails, setSentEmails] = useState<CorreoEnviado[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<CorreoEnviado | null>(null);

  // Load sent emails log on mount and poll
  const fetchSentEmails = async () => {
    try {
      const res = await fetch('/api/correos-enviados');
      if (res.ok) {
        const data = await res.json();
        setSentEmails(data);
      }
    } catch (err) {
      console.error('Error fetching sent emails:', err);
    }
  };

  useEffect(() => {
    fetchSentEmails();
    const interval = setInterval(fetchSentEmails, 8000);
    return () => clearInterval(interval);
  }, []);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
    fetchSentEmails(); // Refresh sent mails list immediately
  };

  const handleDeleteEmail = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (confirm('¿Deseas eliminar este registro de correo enviado?')) {
      try {
        const res = await fetch(`/api/correos-enviados/${id}`, { method: 'DELETE' });
        if (res.ok) {
          triggerToast('🗑️ Registro de correo eliminado.');
        }
      } catch (err) {
        console.error('Error deleting sent email:', err);
      }
    }
  };

  // Action: Mark as completed (Hecho)
  const handleMarkAsDone = async (id: string) => {
    try {
      const res = await fetch(`/api/presupuestos/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: 'Completado' })
      });
      if (!res.ok) throw new Error('No se pudo guardar');
      triggerToast('✅ Trato Cerrado. Se han detenido los recordatorios automáticos.');
      onRefresh();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  // Action: Send email now manually (Opens Gmail compose)
  const handleSendEmailNow = async (id: string) => {
    setLoadingId(id);
    try {
      const res = await fetch(`/api/presupuestos/${id}/preparar-correo`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.details || data.error || 'Error al preparar el correo');
      }
      
      // Abrir Gmail Web
      const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(data.to)}&su=${encodeURIComponent(data.subject)}&body=${encodeURIComponent(data.body)}`;
      window.open(gmailUrl, '_blank');

      triggerToast('📬 Redirigiendo a Gmail y marcado como enviado.');
      onRefresh();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
      onRefresh();
    } finally {
      setLoadingId(null);
    }
  };

  // Filter budgets
  const filtered = presupuestos.filter(p => {
    const matchesSearch = p.cliente.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (statusFilter === 'All') return matchesSearch;
    if (statusFilter === 'Pendiente') return matchesSearch && p.estado === 'Pendiente' && p.email_enviado === 0;
    if (statusFilter === 'Enviado') return matchesSearch && p.estado === 'Pendiente' && p.email_enviado === 1;
    if (statusFilter === 'Completado') return matchesSearch && p.estado === 'Completado';
    
    return matchesSearch;
  });

  const formatFriendlyDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' a las ' + d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  };

  const getFollowUpScheduleDate = (creationStr: string) => {
    const d = new Date(creationStr);
    d.setHours(d.getHours() + 48);
    return formatFriendlyDate(d.toISOString());
  };

  return (
    <div className="space-y-8">
      
      {/* Huge Alert Toast */}
      {toastMessage && (
        <div className="bg-emerald-600 border-4 border-emerald-700 text-white p-5 rounded-2xl text-center text-xl font-extrabold shadow-lg animate-bounce">
          {toastMessage}
        </div>
      )}

      {/* Filter Tabs - 3 Main states */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { id: 'Pendiente', label: '⏳ En Espera (Recordatorio pendiente)', count: presupuestos.filter(p => p.estado === 'Pendiente' && p.email_enviado === 0).length, color: 'border-amber-300' },
          { id: 'Enviado', label: '✉️ Enviados (Recordatorio enviado)', count: presupuestos.filter(p => p.estado === 'Pendiente' && p.email_enviado === 1).length, color: 'border-emerald-300' },
          { id: 'Completado', label: '✅ Tratos Cerrados / Hechos', count: presupuestos.filter(p => p.estado === 'Completado').length, color: 'border-slate-300' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setStatusFilter(statusFilter === tab.id ? 'All' : tab.id)}
            className={`py-4 px-6 rounded-2xl text-lg font-black transition-all cursor-pointer border-3 ${
              statusFilter === tab.id
                ? 'bg-[#009FE3] text-white border-[#009FE3] shadow-md scale-102'
                : `bg-white text-slate-700 border-slate-200 hover:bg-slate-50`
            }`}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* Search Bar */}
      <div className="bg-white p-5 rounded-3xl border-3 border-slate-200 shadow-3xs space-y-2">
        <label className="text-lg font-black text-[#1A1A1A] block">
          🔍 Escribe el nombre del cliente que buscas:
        </label>
        <input
          type="text"
          placeholder="Escribe aquí el nombre del cliente..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full p-4 bg-slate-50 border-3 border-slate-250 rounded-2xl text-lg font-black outline-none focus:bg-white focus:border-[#009FE3] text-[#1A1A1A] transition-all"
        />
      </div>

      {/* List of Budgets - Large Cards */}
      <div className="space-y-4">
        {filtered.length === 0 ? (
          <div className="bg-white border-3 border-slate-200 rounded-3xl p-12 text-center text-slate-450 font-black text-xl">
            No se encontraron presupuestos en esta lista.
          </div>
        ) : (
          filtered.map(p => {
            return (
              <div 
                key={p.id} 
                className={`bg-white border-3 rounded-3xl p-6 shadow-3xs flex flex-col xl:flex-row xl:items-center justify-between gap-6 transition-all ${
                  p.estado === 'Completado' 
                    ? 'border-slate-200 opacity-80' 
                    : p.email_enviado === 0
                    ? 'border-amber-300 bg-amber-50/10'
                    : 'border-emerald-350 bg-emerald-50/5'
                }`}
              >
                {/* Info (Left) */}
                <div className="space-y-2">
                  <div className="text-2xl font-black text-[#1A1A1A] tracking-tight">
                    👤 {p.cliente}
                  </div>
                  <div className="text-base font-bold text-slate-500 flex flex-wrap gap-4">
                    <span>📧 Correo: <strong>{p.email}</strong></span>
                    <span className="hidden sm:inline">|</span>
                    <span>📅 Recibido: <strong>{new Date(p.fecha_creacion).toLocaleDateString()}</strong></span>
                  </div>
                  <div className="text-lg font-extrabold text-slate-700">
                    🛠️ Servicio: <strong>{p.documento}</strong>
                  </div>
                  <div className="text-lg font-black text-[#006491] font-mono">
                    💰 Importe: {p.monto.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                  </div>
                </div>

                {/* Status Badge (Center) */}
                <div className="shrink-0 flex items-center">
                  {p.estado === 'Completado' ? (
                    <span className="text-lg font-black text-slate-650 bg-slate-100 border-3 border-slate-350 px-5 py-3 rounded-2xl flex items-center gap-2 uppercase tracking-wide">
                      ✅ Trato Cerrado
                    </span>
                  ) : p.email_enviado === 0 ? (
                    <div className="flex flex-col">
                      <span className="text-lg font-black text-amber-800 bg-amber-50 border-3 border-amber-350 px-5 py-3 rounded-2xl flex items-center justify-center gap-2 uppercase tracking-wide">
                        ⏳ En cola (Espera 48h)
                      </span>
                      <span className="text-[11px] text-slate-500 font-bold mt-2 text-center">
                        Se enviará solo el {getFollowUpScheduleDate(p.fecha_creacion)}
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col">
                      <span className="text-lg font-black text-emerald-800 bg-emerald-50 border-3 border-emerald-350 px-5 py-3 rounded-2xl flex items-center justify-center gap-2 uppercase tracking-wide">
                        🟢 Correo Enviado
                      </span>
                      {p.fecha_seguimiento_enviado && (
                        <span className="text-[11px] text-slate-500 font-bold mt-2 text-center">
                          Enviado el {formatFriendlyDate(p.fecha_seguimiento_enviado)}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Buttons (Right) */}
                <div className="flex flex-wrap gap-3 items-center shrink-0">
                  <button
                    onClick={() => setSelectedBudget(p)}
                    className="h-[52px] min-w-[140px] px-6 bg-slate-800 hover:bg-slate-900 text-white font-extrabold rounded-2xl text-[15px] active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    👀 VER DETALLES
                  </button>

                  {p.estado !== 'Completado' && (
                    <>
                      <button
                        onClick={() => handleSendEmailNow(p.id)}
                        disabled={loadingId === p.id}
                        className={`h-[52px] min-w-[150px] px-6 text-white font-black rounded-2xl text-[15px] active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm ${
                          p.email_enviado === 0 ? 'bg-[#009FE3] hover:bg-[#0084c2]' : 'bg-sky-600 hover:bg-sky-700'
                        } ${loadingId === p.id ? 'opacity-55 cursor-wait' : ''}`}
                      >
                        {loadingId === p.id ? (
                          <span className="w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin"></span>
                        ) : p.email_enviado === 0 ? (
                          '✉️ ENVIAR AHORA'
                        ) : (
                          '✉️ REENVIAR EMAIL'
                        )}
                      </button>

                      <button
                        onClick={() => handleMarkAsDone(p.id)}
                        className="h-[52px] min-w-[160px] px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl text-[15px] active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                      >
                        👍 MARCAR COMO HECHO
                      </button>
                    </>
                  )}
                </div>

              </div>
            );
          })
        )}
      </div>

      {/* 📬 Sent Emails Mailbox History Section (Shows sent emails lists) */}
      <div className="bg-white border-3 border-slate-200 rounded-3xl p-6 shadow-3xs space-y-4">
        <h3 className="text-xl font-black text-[#1A1A1A] flex items-center gap-2 border-b-2 border-slate-100 pb-3">
          <span>📬</span> Historial de Correos Enviados por la Aplicación
        </h3>
        <p className="text-slate-500 text-xs font-semibold leading-relaxed">
          Aquí puedes ver la lista de correos de recordatorio que el sistema ha enviado automáticamente o que has enviado tú manualmente.
        </p>

        {sentEmails.length === 0 ? (
          <div className="bg-slate-50 border-2 border-slate-200 rounded-2xl p-8 text-center text-slate-400 font-bold text-sm">
            Aún no se ha enviado ningún correo de recordatorio.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-h-[400px] overflow-y-auto pr-1">
            {sentEmails.map(mail => (
              <div 
                key={mail.id} 
                onClick={() => setSelectedEmail(mail)}
                className="bg-slate-50 border-2 border-slate-200 hover:border-[#009FE3] p-4 rounded-2xl cursor-pointer transition-all space-y-2 shadow-4xs"
              >
                <div className="text-[10px] text-slate-400 font-mono font-bold">
                  📅 {new Date(mail.fecha).toLocaleString()}
                </div>
                <div className="font-extrabold text-sm text-[#1A1A1A] truncate">
                  Para: {mail.destinatario}
                </div>
                <div className="font-black text-xs text-[#006491] truncate">
                  Asunto: {mail.asunto}
                </div>
                <div className="flex justify-between items-center pt-1">
                  <span className="text-[10px] bg-sky-50 text-[#009FE3] font-bold px-2 py-0.5 rounded border border-sky-100 uppercase tracking-wider block w-max">
                    Ver Mensaje
                  </span>
                  <button
                    onClick={(e) => handleDeleteEmail(e, mail.id)}
                    className="text-xs hover:bg-rose-550/10 text-rose-600 hover:text-rose-800 px-2 py-1 rounded-lg border border-transparent hover:border-rose-200 cursor-pointer active:scale-90 transition-all font-bold flex items-center gap-1 select-none"
                    title="Eliminar este correo de la bandeja"
                  >
                    🗑️ Borrar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Budget Details Modal */}
      {selectedBudget && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl border-4 border-[#009FE3] shadow-2xl w-full max-w-2xl overflow-hidden animate-zoom-in">
            <div className="bg-[#009FE3] px-6 py-5 text-white flex justify-between items-center">
              <h3 className="font-extrabold text-xl">📋 Ficha del Presupuesto</h3>
              <button 
                onClick={() => setSelectedBudget(null)}
                className="text-white hover:text-sky-100 font-black text-2xl cursor-pointer"
              >
                CERRAR
              </button>
            </div>

            <div className="p-6 space-y-4 text-lg">
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">ID Presupuesto:</span>
                <span className="text-xl font-bold font-mono text-[#006491]">{selectedBudget.id}</span>
              </div>
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Cliente:</span>
                <span className="text-2xl font-black text-[#1A1A1A]">{selectedBudget.cliente}</span>
              </div>
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Email:</span>
                <span className="text-lg font-bold text-slate-700">{selectedBudget.email}</span>
              </div>
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Servicio / Obra:</span>
                <span className="text-lg font-extrabold text-slate-800">{selectedBudget.documento}</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Importe:</span>
                  <span className="text-xl font-black text-slate-800 font-mono">
                    {selectedBudget.monto.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                  </span>
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Recibido:</span>
                  <span className="text-base font-bold text-slate-600">
                    {new Date(selectedBudget.fecha_creacion).toLocaleDateString()}
                  </span>
                </div>
              </div>

              <div className="bg-slate-50 p-4.5 rounded-2xl border-2 border-slate-200 text-base">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Seguimiento Automático:</span>
                {selectedBudget.estado === 'Completado' ? (
                  <span className="text-slate-600 font-bold block mt-1">Trato cerrado. No se enviará ningún correo.</span>
                ) : selectedBudget.email_enviado === 1 ? (
                  <span className="text-emerald-700 font-bold block mt-1">🟢 Correo enviado con éxito.</span>
                ) : (
                  <span className="text-amber-700 font-bold block mt-1">⏳ Correo en espera. Se enviará a las 48h ({getFollowUpScheduleDate(selectedBudget.fecha_creacion)}).</span>
                )}
                {selectedBudget.error_seguimiento && (
                  <p className="text-xs text-rose-600 font-bold mt-2 bg-rose-50 p-2.5 rounded border border-rose-100">
                    Error de conexión: {selectedBudget.error_seguimiento}
                  </p>
                )}
              </div>
            </div>

            <div className="bg-slate-50 px-6 py-4.5 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setSelectedBudget(null)}
                className="h-[50px] px-8 bg-slate-800 hover:bg-slate-900 text-white font-extrabold rounded-2xl text-base cursor-pointer"
              >
                ENTENDIDO
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Expanded Email Body Preview Modal */}
      {selectedEmail && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl border-4 border-sky-400 shadow-2xl w-full max-w-2xl overflow-hidden animate-zoom-in">
            {/* Modal Header */}
            <div className="bg-sky-400 px-6 py-4 text-white flex justify-between items-center">
              <h3 className="font-extrabold text-base flex items-center gap-1.5">
                <span>✉️</span> Previsualización del Correo Enviado
              </h3>
              <button 
                onClick={() => setSelectedEmail(null)}
                className="text-white hover:text-sky-100 font-black text-xl cursor-pointer"
              >
                Cerrar
              </button>
            </div>

            {/* Email HTML Preview (safely rendered inside div container) */}
            <div className="p-6 bg-slate-100 max-h-[calc(100vh-220px)] overflow-y-auto">
              <div className="bg-white border border-slate-200 p-4 rounded-xl mb-4 text-sm font-semibold space-y-1">
                <div>📧 Destinatario: <strong>{selectedEmail.destinatario}</strong></div>
                <div>🏷️ Asunto: <strong>{selectedEmail.asunto}</strong></div>
                <div>📅 Fecha de envío: <strong>{new Date(selectedEmail.fecha).toLocaleString()}</strong></div>
              </div>
              <div 
                className="bg-white rounded-xl shadow-xs border border-slate-200 p-1 overflow-x-hidden"
                dangerouslySetInnerHTML={{ __html: selectedEmail.cuerpo }}
              />
            </div>

            {/* Footer */}
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setSelectedEmail(null)}
                className="h-[48px] px-8 bg-slate-800 hover:bg-slate-900 text-white font-extrabold rounded-2xl text-sm cursor-pointer"
              >
                CERRAR PREVISUALIZACIÓN
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
