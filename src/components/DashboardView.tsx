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
          triggerToast('Registro de correo eliminado.');
        }
      } catch (err) {
        console.error('Error deleting sent email:', err);
      }
    }
  };

  // Action: Delete budget
  const handleDeleteBudget = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('¿Estás seguro de que deseas eliminar este presupuesto del seguidor de correos? Se cancelarán todos sus recordatorios de seguimiento.')) {
      try {
        const res = await fetch(`/api/presupuestos/${id}`, { method: 'DELETE' });
        if (res.ok) {
          triggerToast('Presupuesto eliminado del seguidor.');
          onRefresh();
        } else {
          throw new Error('No se pudo eliminar el presupuesto.');
        }
      } catch (err: any) {
        alert(`Error al eliminar: ${err.message}`);
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
      triggerToast('Trato Cerrado. Recordatorios automáticos detenidos.');
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

      triggerToast('Redirigiendo a Gmail y marcado como enviado.');
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
    <div className="space-y-6">
      
      {/* Toast Notification Box */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 bg-slate-900 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 z-50 text-xs font-semibold animate-fade-in border border-slate-800">
          <span className="material-symbols-outlined text-emerald-400 text-base">check_circle</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Filter Tabs - 3 Main states */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { id: 'Pendiente', label: 'En Espera (Pendiente)', count: presupuestos.filter(p => p.estado === 'Pendiente' && p.email_enviado === 0).length, color: 'text-amber-600 bg-amber-50 border-amber-250', icon: 'hourglass_empty' },
          { id: 'Enviado', label: 'Enviados (Seguimiento)', count: presupuestos.filter(p => p.estado === 'Pendiente' && p.email_enviado === 1).length, color: 'text-sky-600 bg-sky-50 border-sky-200', icon: 'mail' },
          { id: 'Completado', label: 'Tratos Cerrados', count: presupuestos.filter(p => p.estado === 'Completado').length, color: 'text-emerald-700 bg-emerald-50 border-emerald-200', icon: 'check_circle' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setStatusFilter(statusFilter === tab.id ? 'All' : tab.id)}
            className={`py-3 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer border flex items-center justify-between shadow-xs ${
              statusFilter === tab.id
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-650 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className={`material-symbols-outlined text-base ${statusFilter === tab.id ? 'text-white' : 'text-slate-400'}`}>{tab.icon}</span>
              <span>{tab.label}</span>
            </div>
            <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${statusFilter === tab.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Search Bar */}
      <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3">
        <span className="material-symbols-outlined text-slate-400">search</span>
        <input
          type="text"
          placeholder="Buscar presupuesto por nombre del cliente..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-transparent text-xs font-semibold outline-none text-slate-800 placeholder-slate-400"
        />
      </div>

      {/* List of Budgets - Large Cards */}
      <div className="space-y-3.5">
        {filtered.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center text-slate-400 font-bold text-xs">
            No se encontraron presupuestos en esta lista.
          </div>
        ) : (
          filtered.map(p => {
            return (
              <div 
                key={p.id} 
                className={`bg-white border rounded-2xl p-5 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-5 transition-all ${
                  p.estado === 'Completado' 
                    ? 'border-slate-200 opacity-75' 
                    : p.email_enviado === 0
                    ? 'border-amber-200 bg-amber-50/5'
                    : 'border-emerald-200 bg-emerald-50/5'
                }`}
              >
                {/* Info (Left) */}
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-base font-extrabold text-slate-850 truncate max-w-md">
                      {p.cliente}
                    </span>
                    <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200">
                      ID: {p.id}
                    </span>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-semibold text-slate-500">
                    <span className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-slate-400 text-sm">mail</span>
                      {p.email}
                    </span>
                    <span className="text-slate-200">|</span>
                    <span className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-slate-400 text-sm">calendar_today</span>
                      Registrado: {new Date(p.fecha_creacion).toLocaleDateString()}
                    </span>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1">
                    <span className="text-[11px] font-semibold text-slate-700 bg-slate-100 px-2 py-1 rounded-lg border border-slate-200 flex items-center gap-1">
                      <span className="material-symbols-outlined text-slate-400 text-sm">description</span>
                      {p.documento}
                    </span>
                    <span className="text-xs font-black text-[#006491] font-mono bg-sky-50/50 px-2.5 py-1 rounded-lg border border-[#009FE3]/15 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[#009FE3] text-sm">payments</span>
                      {p.monto.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                    </span>
                  </div>
                </div>

                {/* Status Badge (Center) */}
                <div className="shrink-0 flex items-center">
                  {p.estado === 'Completado' ? (
                    <span className="text-[10px] font-extrabold text-slate-600 bg-slate-100 border border-slate-250 px-3 py-1.5 rounded-lg flex items-center gap-1 uppercase tracking-wider">
                      <span className="material-symbols-outlined text-xs text-slate-500">check_circle</span>
                      Trato Cerrado
                    </span>
                  ) : p.email_enviado === 0 ? (
                    <div className="flex flex-col items-start lg:items-center">
                      <span className="text-[10px] font-extrabold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg flex items-center gap-1 uppercase tracking-wider">
                        <span className="material-symbols-outlined text-xs text-amber-600">hourglass_empty</span>
                        En cola (Espera 48h)
                      </span>
                      <span className="text-[9px] text-slate-455 font-bold mt-1 text-left lg:text-center block max-w-[160px] leading-tight">
                        Enviar: {getFollowUpScheduleDate(p.fecha_creacion)}
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-start lg:items-center">
                      <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-250 px-3 py-1.5 rounded-lg flex items-center gap-1 uppercase tracking-wider">
                        <span className="material-symbols-outlined text-xs text-emerald-600">mail</span>
                        Seguimiento Enviado
                      </span>
                      {p.fecha_seguimiento_enviado && (
                        <span className="text-[9px] text-slate-455 font-bold mt-1 text-left lg:text-center block max-w-[160px] leading-tight">
                          Enviado: {formatFriendlyDate(p.fecha_seguimiento_enviado)}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Buttons (Right) */}
                <div className="flex flex-wrap gap-2 items-center shrink-0">
                  <button
                    onClick={() => setSelectedBudget(p)}
                    className="h-9 px-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs active:scale-95 transition-all cursor-pointer flex items-center gap-1 border border-slate-200"
                  >
                    <span className="material-symbols-outlined text-sm">visibility</span>
                    Ver Ficha
                  </button>

                  {p.estado !== 'Completado' && (
                    <>
                      <button
                        onClick={() => handleSendEmailNow(p.id)}
                        disabled={loadingId === p.id}
                        className={`h-9 px-3.5 text-white font-bold rounded-xl text-xs active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1 shadow-sm ${
                          p.email_enviado === 0 ? 'bg-[#009FE3] hover:bg-[#0084c2]' : 'bg-sky-600 hover:bg-sky-700'
                        } ${loadingId === p.id ? 'opacity-60 cursor-wait' : ''}`}
                      >
                        {loadingId === p.id ? (
                          <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                        ) : (
                          <>
                            <span className="material-symbols-outlined text-sm">send</span>
                            {p.email_enviado === 0 ? 'Enviar Ahora' : 'Reenviar'}
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => handleMarkAsDone(p.id)}
                        className="h-9 px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1 shadow-sm"
                      >
                        <span className="material-symbols-outlined text-sm">check</span>
                        Hecho
                      </button>
                    </>
                  )}

                  <button
                    onClick={(e) => handleDeleteBudget(e, p.id)}
                    className="h-9 w-9 bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 rounded-xl active:scale-95 transition-all cursor-pointer flex items-center justify-center shadow-xs"
                    title="Eliminar este presupuesto"
                  >
                    <span className="material-symbols-outlined text-sm">delete</span>
                  </button>
                </div>

              </div>
            );
          })
        )}
      </div>

      {/* Sent Emails Mailbox History Section (Shows sent emails lists) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
        <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-3">
          <span className="material-symbols-outlined text-[#009FE3]">mail_lock</span>
          Historial de Correos Enviados
        </h3>
        <p className="text-slate-500 text-[11px] font-semibold leading-normal">
          Listado de correos de recordatorio de presupuestos enviados por la aplicación. Puedes consultar su contenido o eliminar el registro del historial.
        </p>

        {sentEmails.length === 0 ? (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center text-slate-400 font-bold text-xs">
            Aún no se ha enviado ningún correo de recordatorio.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 max-h-[300px] overflow-y-auto pr-1">
            {sentEmails.map(mail => (
              <div 
                key={mail.id} 
                onClick={() => setSelectedEmail(mail)}
                className="bg-slate-50 border border-slate-200 hover:border-[#009FE3] p-4 rounded-xl cursor-pointer transition-all space-y-2 shadow-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[9px] text-slate-400 font-mono font-bold">
                    {new Date(mail.fecha).toLocaleDateString()} {new Date(mail.fecha).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <button
                    onClick={(e) => handleDeleteEmail(e, mail.id)}
                    className="w-6 h-6 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-md cursor-pointer transition-colors flex items-center justify-center select-none"
                    title="Eliminar este correo de la bandeja"
                  >
                    <span className="material-symbols-outlined text-base">delete</span>
                  </button>
                </div>
                <div className="font-extrabold text-xs text-slate-800 truncate">
                  Para: {mail.destinatario}
                </div>
                <div className="font-semibold text-[10px] text-[#006491] truncate">
                  Asunto: {mail.asunto}
                </div>
                <span className="text-[9px] text-[#009FE3] font-bold uppercase tracking-wider block">
                  Ver Cuerpo del Mensaje
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Budget Details Modal */}
      {selectedBudget && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden animate-zoom-in">
            <div className="bg-slate-900 px-5 py-4 text-white flex justify-between items-center border-b border-slate-800">
              <h3 className="font-bold text-sm uppercase tracking-wider flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[#009FE3]">assignment</span>
                Ficha del Presupuesto
              </h3>
              <button 
                onClick={() => setSelectedBudget(null)}
                className="text-slate-400 hover:text-white font-semibold text-xs cursor-pointer flex items-center gap-0.5 bg-slate-800 px-2.5 py-1.5 rounded-lg border border-slate-700"
              >
                <span className="material-symbols-outlined text-sm">close</span>
                Cerrar
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[10px] font-bold text-slate-450 uppercase tracking-wider block mb-0.5">ID del Presupuesto:</span>
                  <span className="font-mono font-bold text-slate-750">{selectedBudget.id}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-450 uppercase tracking-wider block mb-0.5">Fecha Recibido:</span>
                  <span className="font-semibold text-slate-650">
                    {new Date(selectedBudget.fecha_creacion).toLocaleDateString()}
                  </span>
                </div>
              </div>
              
              <div>
                <span className="text-[10px] font-bold text-slate-450 uppercase tracking-wider block mb-0.5">Cliente:</span>
                <span className="font-extrabold text-slate-800 text-sm">{selectedBudget.cliente}</span>
              </div>
              
              <div>
                <span className="text-[10px] font-bold text-slate-455 uppercase tracking-wider block mb-0.5">Email de Destinatario:</span>
                <span className="font-semibold text-slate-700">{selectedBudget.email}</span>
              </div>
              
              <div>
                <span className="text-[10px] font-bold text-slate-455 uppercase tracking-wider block mb-0.5">Servicio y Obra:</span>
                <span className="font-bold text-slate-800">{selectedBudget.documento}</span>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[10px] font-bold text-slate-455 uppercase tracking-wider block mb-0.5">Importe de Opción 3:</span>
                  <span className="font-mono font-black text-slate-800">
                    {selectedBudget.monto.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-455 uppercase tracking-wider block mb-0.5">Estado:</span>
                  <span className={`font-semibold capitalize ${selectedBudget.estado === 'Completado' ? 'text-emerald-700' : 'text-amber-700'}`}>
                    {selectedBudget.estado}
                  </span>
                </div>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-[11px] leading-relaxed">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Seguimiento Automático:</span>
                {selectedBudget.estado === 'Completado' ? (
                  <span className="text-slate-550 font-semibold block">Trato cerrado. No se enviará ningún correo adicional.</span>
                ) : selectedBudget.email_enviado === 1 ? (
                  <span className="text-emerald-700 font-semibold block flex items-center gap-1">
                    <span className="material-symbols-outlined text-base">check</span> Correo enviado con éxito.
                  </span>
                ) : (
                  <span className="text-amber-700 font-semibold block flex items-center gap-1">
                    <span className="material-symbols-outlined text-base animate-pulse">hourglass_empty</span> Correo en espera (se enviará el {getFollowUpScheduleDate(selectedBudget.fecha_creacion)}).
                  </span>
                )}
                {selectedBudget.error_seguimiento && (
                  <p className="text-[10px] text-rose-600 font-mono mt-2 bg-rose-50 p-2 rounded border border-rose-100">
                    Error SMTP: {selectedBudget.error_seguimiento}
                  </p>
                )}
              </div>
            </div>

            <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setSelectedBudget(null)}
                className="h-9 px-5 bg-slate-900 hover:bg-slate-950 text-white font-bold rounded-xl text-xs cursor-pointer active:scale-95 transition-all shadow-sm"
              >
                Cerrar Ficha
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Expanded Email Body Preview Modal */}
      {selectedEmail && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-xl overflow-hidden animate-zoom-in">
            <div className="bg-slate-900 px-5 py-4 text-white flex justify-between items-center border-b border-slate-800">
              <h3 className="font-bold text-sm uppercase tracking-wider flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sky-400">mail</span>
                Previsualización de Correo Enviado
              </h3>
              <button 
                onClick={() => setSelectedEmail(null)}
                className="text-slate-400 hover:text-white font-semibold text-xs cursor-pointer flex items-center gap-0.5 bg-slate-800 px-2.5 py-1.5 rounded-lg border border-slate-700"
              >
                <span className="material-symbols-outlined text-sm">close</span>
                Cerrar
              </button>
            </div>

            <div className="p-4 bg-slate-50 max-h-[calc(100vh-200px)] overflow-y-auto space-y-3">
              <div className="bg-white border border-slate-200 p-3 rounded-xl text-[11px] font-semibold space-y-1 shadow-xs">
                <div>Destinatario: <strong className="text-slate-800">{selectedEmail.destinatario}</strong></div>
                <div>Asunto: <strong className="text-slate-800">{selectedEmail.asunto}</strong></div>
                <div>Fecha de envío: <strong className="text-slate-800">{new Date(selectedEmail.fecha).toLocaleString()}</strong></div>
              </div>
              <div 
                className="bg-white rounded-xl shadow-xs border border-slate-200 p-4 overflow-x-hidden text-xs"
                dangerouslySetInnerHTML={{ __html: selectedEmail.cuerpo }}
              />
            </div>

            <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setSelectedEmail(null)}
                className="h-9 px-5 bg-slate-900 hover:bg-slate-950 text-white font-bold rounded-xl text-xs cursor-pointer active:scale-95 transition-all shadow-sm"
              >
                Cerrar Previsualización
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
