import React, { useState, useEffect } from 'react';
import { Presupuesto, SMTPConfig } from './types';
import DashboardView from './components/DashboardView';
import ConfigView from './components/ConfigView';
import SimulacionView from './components/SimulacionView';
import CompanyLogo from './components/CompanyLogo';

export default function App() {
  const [presupuestos, setPresupuestos] = useState<Presupuesto[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isConfigOpen, setIsConfigOpen] = useState<boolean>(false);
  const [isDebugMode, setIsDebugMode] = useState<boolean>(false);
  const [isEmailConnected, setIsEmailConnected] = useState<boolean>(true);
  
  // Track system SMTP config locally to check if configured
  const [config, setConfig] = useState<SMTPConfig | null>(null);

  // Check URL debug parameter on mount
  useEffect(() => {
    if (window.location.search.includes('debug=true')) {
      setIsDebugMode(true);
    }
  }, []);

  const fetchPresupuestos = async () => {
    try {
      const res = await fetch('/api/presupuestos');
      if (res.ok) {
        const data = await res.json();
        setPresupuestos(data);
      }
    } catch (err) {
      console.error('Error fetching budgets:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/config');
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
        // If smtp_user or smtp_pass is empty, it means the email is NOT connected yet
        if (!data.smtp_user || !data.smtp_pass) {
          setIsEmailConnected(false);
        } else {
          setIsEmailConnected(true);
        }
      }
    } catch (err) {
      console.error('Error fetching config:', err);
    }
  };

  // Poll database updates automatically every 10 seconds
  useEffect(() => {
    fetchPresupuestos();
    fetchConfig();
    const interval = setInterval(() => {
      fetchPresupuestos();
      fetchConfig();
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-[#1A1A1A] font-sans flex flex-col antialiased">
      
      {/* Top Header Bar */}
      <header className="bg-white border-b border-slate-200 px-6 md:px-10 py-4 flex justify-between items-center sticky top-0 z-45 shadow-xs">
        <div className="flex items-center gap-3">
          <CompanyLogo height={36} />
          <span className="h-6 w-[1px] bg-slate-200 hidden sm:inline-block"></span>
          <h1 className="font-extrabold text-[#1A1A1A] text-sm tracking-wider hidden sm:inline-block uppercase">
            Control de Presupuestos
          </h1>
        </div>
        
        {/* Prominent Onboarding / Config Button for Boss */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsConfigOpen(true)}
            className={`h-9 px-4 text-white font-bold rounded-xl text-xs active:scale-95 transition-all cursor-pointer flex items-center gap-2 shadow-xs ${
              !isEmailConnected 
                ? 'bg-amber-500 hover:bg-amber-600 animate-pulse border border-amber-600' 
                : 'bg-[#009FE3] hover:bg-[#0084c2]'
            }`}
          >
            <span className="material-symbols-outlined text-sm">settings</span>
            <span>{isEmailConnected ? 'CONFIGURACIÓN DE CORREO' : 'CONECTAR MI CORREO'}</span>
            {!isEmailConnected && (
              <span className="w-2 h-2 rounded-full bg-rose-600 inline-block border border-white"></span>
            )}
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full pt-6 pb-12 px-6 md:px-10 max-w-7xl mx-auto">
        
        {/* Onboarding Banner: Visible if email is not connected yet */}
        {!isEmailConnected && (
          <div className="bg-amber-50 border border-amber-250 rounded-2xl p-5 mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
            <div className="space-y-1">
              <h2 className="text-sm font-black text-amber-900 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-amber-700 text-lg">error</span>
                ¡Hola! Para empezar a enviar correos, conecta tu cuenta de correo
              </h2>
              <p className="text-xs font-semibold text-amber-800 leading-normal">
                Necesitamos que conectes tu correo de la oficina para que los presupuestos se envíen en tu nombre de forma automática.
              </p>
            </div>
            <button
              onClick={() => setIsConfigOpen(true)}
              className="h-9 px-5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs active:scale-95 transition-all cursor-pointer shrink-0 shadow-xs flex items-center justify-center gap-1.5"
            >
              <span className="material-symbols-outlined text-sm">key</span>
              Configurar Correo Ahora
            </button>
          </div>
        )}

        {loading && presupuestos.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[250px] space-y-3">
            <div className="w-8 h-8 border-3 border-[#009FE3] border-t-transparent rounded-full animate-spin"></div>
            <p className="text-slate-400 font-bold text-xs">Cargando la lista...</p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* List of budgets */}
            <DashboardView 
              presupuestos={presupuestos} 
              onRefresh={fetchPresupuestos} 
              onOpenConfig={() => setIsConfigOpen(true)} 
            />

            {/* Hidden Simulator Panel for testing */}
            {isDebugMode && (
              <div className="border border-slate-200 pt-6 mt-8 bg-white p-5 rounded-2xl">
                <div className="flex justify-between items-center mb-5 border-b border-slate-100 pb-3">
                  <h2 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[#009FE3]">construction</span>
                    Panel Técnico de Pruebas (Simulador)
                  </h2>
                  <button 
                    onClick={() => setIsDebugMode(false)}
                    className="text-[10px] text-rose-600 hover:underline font-bold"
                  >
                    Ocultar panel
                  </button>
                </div>
                <SimulacionView presupuestos={presupuestos} onRefresh={fetchPresupuestos} />
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer with hidden technical link */}
      <footer className="border-t border-slate-200 py-4 text-center text-[10px] text-slate-400 font-bold bg-white mt-auto px-6 flex flex-col sm:flex-row justify-between items-center gap-3">
        <p>© 2026 Alcebo Control de Plagas. Todos los derechos reservados.</p>
        
        <div className="flex gap-4">
          {/* Test tools toggle */}
          <button
            onClick={() => setIsDebugMode(!isDebugMode)}
            className="text-[10px] text-slate-400 hover:text-slate-600 hover:underline font-bold cursor-pointer"
          >
            🧪 Acceso Técnico (Simulador)
          </button>
        </div>
      </footer>

      {/* Configuration modal (SMTP & Templates) */}
      {isConfigOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-slate-50 rounded-2xl border border-slate-200 shadow-2xl w-full max-w-3xl overflow-hidden my-8 animate-zoom-in">
            {/* Modal Header */}
            <div className="bg-slate-900 px-5 py-4 text-white flex justify-between items-center border-b border-slate-800">
              <h3 className="font-bold text-xs uppercase tracking-wider flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[#009FE3]">key</span>
                Configurar Cuenta de Correo SMTP
              </h3>
              <button 
                onClick={() => {
                  setIsConfigOpen(false);
                  fetchConfig();
                }}
                className="text-slate-400 hover:text-white font-semibold text-xs cursor-pointer flex items-center gap-0.5 bg-slate-800 px-2.5 py-1.5 rounded-lg border border-slate-700"
              >
                <span className="material-symbols-outlined text-sm">close</span>
                Cerrar
              </button>
            </div>

            {/* Modal Content */}
            <div className="max-h-[calc(100vh-180px)] overflow-y-auto p-5 bg-slate-50">
              <ConfigView />
            </div>

            {/* Modal Footer */}
            <div className="bg-white px-5 py-3.5 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => {
                  setIsConfigOpen(false);
                  fetchConfig();
                }}
                className="h-9 px-5 bg-slate-900 hover:bg-slate-950 text-white font-bold rounded-xl text-xs cursor-pointer active:scale-95 transition-all shadow-sm"
              >
                Cerrar Configuración
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
