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
      <header className="bg-white border-b-4 border-slate-200 px-6 md:px-10 py-5 flex justify-between items-center sticky top-0 z-45 shadow-sm">
        <div className="flex items-center gap-4">
          <CompanyLogo height={44} />
          <span className="h-8 w-[2px] bg-slate-200 hidden sm:inline-block"></span>
          <h1 className="font-black text-[#1A1A1A] text-xl tracking-wide hidden sm:inline-block uppercase">
            Control de Presupuestos
          </h1>
        </div>
        
        {/* Prominent Onboarding / Config Button for Boss */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsConfigOpen(true)}
            className={`h-[52px] px-6 text-white font-black rounded-2xl text-base active:scale-95 transition-all cursor-pointer flex items-center gap-2.5 shadow-md ${
              !isEmailConnected 
                ? 'bg-amber-500 hover:bg-amber-600 animate-pulse border-2 border-amber-600' 
                : 'bg-[#009FE3] hover:bg-[#0084c2]'
            }`}
          >
            <span className="material-symbols-outlined text-xl">settings</span>
            <span>{isEmailConnected ? '⚙️ CONFIGURACIÓN DE CORREO' : '🔑 CONECTAR MI CORREO'}</span>
            {!isEmailConnected && (
              <span className="w-3 h-3 rounded-full bg-red-650 inline-block border border-white"></span>
            )}
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full pt-8 pb-16 px-6 md:px-10 max-w-7xl mx-auto">
        
        {/* Onboarding Banner: Visible if email is not connected yet */}
        {!isEmailConnected && (
          <div className="bg-amber-50 border-4 border-amber-300 rounded-3xl p-6 mb-8 flex flex-col md:flex-row md:items-center justify-between gap-5 shadow-sm">
            <div className="space-y-1">
              <h2 className="text-xl font-black text-amber-900 flex items-center gap-2">
                <span>👋</span> ¡Hola! Para empezar a enviar correos, conecta tu cuenta
              </h2>
              <p className="text-sm font-bold text-amber-800 leading-relaxed">
                Necesitamos que conectes tu correo de la oficina para que los presupuestos se envíen en tu nombre. Es muy fácil, solo te llevará un minuto.
              </p>
            </div>
            <button
              onClick={() => setIsConfigOpen(true)}
              className="h-[50px] px-8 bg-amber-550 hover:bg-amber-600 text-white font-black rounded-xl text-base active:scale-95 transition-all cursor-pointer shrink-0 shadow-md flex items-center justify-center gap-2"
            >
              <span>🔑</span> HACER CLIC AQUÍ AHORA
            </button>
          </div>
        )}

        {loading && presupuestos.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[300px] space-y-4">
            <div className="w-12 h-12 border-4 border-[#009FE3] border-t-transparent rounded-full animate-spin"></div>
            <p className="text-slate-500 font-black text-lg">Cargando la lista...</p>
          </div>
        ) : (
          <div className="space-y-10">
            {/* List of budgets */}
            <DashboardView 
              presupuestos={presupuestos} 
              onRefresh={fetchPresupuestos} 
              onOpenConfig={() => setIsConfigOpen(true)} 
            />

            {/* Hidden Simulator Panel for testing */}
            {isDebugMode && (
              <div className="border-t-4 border-dashed border-slate-350 pt-8 mt-12 bg-white p-6 rounded-3xl border-3 border-slate-200">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-black text-slate-800">🛠️ Panel Técnico de Pruebas (Simulador)</h2>
                  <button 
                    onClick={() => setIsDebugMode(false)}
                    className="text-xs text-rose-600 hover:underline font-bold"
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
      <footer className="border-t-4 border-slate-200 py-6 text-center text-xs text-slate-400 font-bold bg-white mt-auto px-6 flex flex-col sm:flex-row justify-between items-center gap-4">
        <p>© 2026 Alcebo Control de Plagas. Todos los derechos reservados.</p>
        
        <div className="flex gap-4">
          {/* Test tools toggle */}
          <button
            onClick={() => setIsDebugMode(!isDebugMode)}
            className="text-[11px] text-slate-400 hover:text-slate-600 hover:underline font-bold cursor-pointer"
          >
            🧪 Acceso Técnico (Simulador)
          </button>
        </div>
      </footer>

      {/* Configuration modal (SMTP & Templates) */}
      {isConfigOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-slate-50 rounded-3xl border-4 border-[#009FE3] shadow-2xl w-full max-w-4xl overflow-hidden my-8 animate-zoom-in">
            {/* Modal Header */}
            <div className="bg-[#009FE3] px-6 py-5 text-white flex justify-between items-center">
              <h3 className="font-extrabold text-lg flex items-center gap-2">
                🔑 Conectar tu Cuenta de Correo
              </h3>
              <button 
                onClick={() => {
                  setIsConfigOpen(false);
                  fetchConfig();
                }}
                className="text-white hover:text-sky-100 font-black text-base bg-white/10 px-4 py-2 rounded-xl cursor-pointer"
              >
                CERRAR
              </button>
            </div>

            {/* Modal Content */}
            <div className="max-h-[calc(100vh-180px)] overflow-y-auto p-6 bg-slate-50">
              <ConfigView />
            </div>

            {/* Modal Footer */}
            <div className="bg-white px-6 py-4.5 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => {
                  setIsConfigOpen(false);
                  fetchConfig();
                }}
                className="h-[50px] px-8 bg-slate-800 hover:bg-slate-900 text-white font-extrabold rounded-2xl text-base cursor-pointer active:scale-95 transition-all shadow-sm"
              >
                CERRAR
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
