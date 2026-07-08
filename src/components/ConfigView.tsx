import React, { useState, useEffect } from 'react';
import { SMTPConfig } from '../types';

export default function ConfigView() {
  const [provider, setProvider] = useState('corporate');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const [config, setConfig] = useState<SMTPConfig>({
    smtp_host: '',
    smtp_port: '587',
    smtp_secure: 'false',
    smtp_user: '',
    smtp_pass: '',
    smtp_from: '',
    email_subject: '',
    email_body: '',
    delay_hours: '48'
  });

  const [saving, setSaving] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [testing, setTesting] = useState(false);
  const [testStatus, setTestStatus] = useState<{ success?: boolean; error?: string } | null>(null);

  // Load config on mount
  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/config');
      if (res.ok) {
        const data = await res.json();
        setConfig({
          smtp_host: data.smtp_host || '',
          smtp_port: data.smtp_port || '587',
          smtp_secure: data.smtp_secure || 'false',
          smtp_user: data.smtp_user || '',
          smtp_pass: data.smtp_pass || '',
          smtp_from: data.smtp_from || 'presupuestos@alcebocontrol.com',
          email_subject: data.email_subject || '',
          email_body: data.email_body || '',
          delay_hours: data.delay_hours || '48'
        });

        if (data.smtp_host === 'smtp.gmail.com') {
          setProvider('gmail');
        } else if (data.smtp_host === 'smtp-mail.outlook.com') {
          setProvider('outlook');
        } else {
          setProvider('corporate');
        }
      }
    } catch (err) {
      console.error('Error fetching config:', err);
    }
  };

  const handleEmailChange = (val: string) => {
    setConfig(prev => {
      const updated = { ...prev, smtp_user: val };
      
      if (val.includes('@')) {
        const parts = val.split('@');
        const domain = parts[1]?.toLowerCase();
        
        if (domain === 'gmail.com') {
          setProvider('gmail');
          updated.smtp_host = 'smtp.gmail.com';
          updated.smtp_port = '587';
          updated.smtp_secure = 'false';
        } else if (domain === 'outlook.com' || domain === 'hotmail.com' || domain === 'live.com' || domain === 'hotmail.es') {
          setProvider('outlook');
          updated.smtp_host = 'smtp-mail.outlook.com';
          updated.smtp_port = '587';
          updated.smtp_secure = 'false';
        } else if (domain) {
          setProvider('corporate');
          updated.smtp_host = `mail.${domain}`;
          updated.smtp_port = '587';
          updated.smtp_secure = 'false';
        }
        updated.smtp_from = val;
      }
      return updated;
    });
  };

  const handleProviderChange = (newProvider: string) => {
    setProvider(newProvider);
    let host = config.smtp_host;
    let port = config.smtp_port;
    let secure = config.smtp_secure;

    if (newProvider === 'gmail') {
      host = 'smtp.gmail.com';
      port = '587';
      secure = 'false';
    } else if (newProvider === 'outlook') {
      host = 'smtp-mail.outlook.com';
      port = '587';
      secure = 'false';
    } else if (newProvider === 'corporate') {
      const emailDomain = config.smtp_user.includes('@') ? config.smtp_user.split('@')[1] : '';
      host = emailDomain ? `mail.${emailDomain}` : '';
      port = '587';
      secure = 'false';
    }

    setConfig(prev => ({
      ...prev,
      smtp_host: host,
      smtp_port: port,
      smtp_secure: secure
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    const finalConfig = {
      ...config,
      smtp_from: config.smtp_from || config.smtp_user
    };

    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalConfig)
      });
      if (res.ok) {
        alert('✅ ¡Correo conectado con éxito!');
        fetchConfig();
      } else {
        throw new Error('No se pudo guardar la configuración');
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleTestEmail = async () => {
    if (!testEmail) {
      alert('Introduce un correo para probar.');
      return;
    }
    setTesting(true);
    setTestStatus(null);
    try {
      const res = await fetch('/api/test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: testEmail })
      });
      const data = await res.json();
      if (res.ok) {
        setTestStatus({ success: true });
      } else {
        setTestStatus({ success: false, error: data.details || data.error });
      }
    } catch (err: any) {
      setTestStatus({ success: false, error: err.message });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl text-[#1A1A1A]">
      <div className="bg-white p-6 rounded-2xl border-2 border-slate-200 shadow-2xs">
        <h2 className="text-2xl font-black text-[#1A1A1A]">
          📧 Conectar tu Cuenta de Correo
        </h2>
        <p className="text-slate-500 mt-1 text-base font-semibold">
          Escribe tu dirección de correo electrónico y contraseña. La aplicación configurará el resto por ti de forma automática.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Onboarding instructions card */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-sky-50 border-2 border-sky-200 rounded-2xl p-5 text-sm font-bold leading-relaxed text-slate-700 space-y-3">
            <h3 className="font-extrabold text-[#006491] text-base flex items-center gap-1.5">
              <span>💡</span> Pasos a Seguir:
            </h3>
            <p>
              1. Escribe tu **Dirección de Correo** de la oficina.
            </p>
            <p>
              2. Introduce tu **Contraseña** de siempre.
            </p>
            <p>
              3. Pulsa el botón azul **"CONECTAR CORREO"** al final. ¡Y listo! El sistema ya podrá empezar a enviar los presupuestos de forma automática.
            </p>
          </div>

          <div className="bg-emerald-50 border-2 border-emerald-250 rounded-2xl p-5 text-sm font-bold text-emerald-800 space-y-2">
            <h4 className="font-extrabold flex items-center gap-1.5 text-base">
              <span>🔒</span> Conexión Segura
            </h4>
            <p>
              Tus credenciales se quedan guardadas estrictamente en este ordenador, no viajan por internet ni se comparten con nadie. Tu contraseña siempre estará protegida por puntos.
            </p>
          </div>

          {/* Test connection widget */}
          <div className="bg-white border-2 border-slate-200 rounded-2xl p-5 shadow-3xs space-y-4">
            <h3 className="font-extrabold text-base flex items-center gap-1.5">
              <span>✔️</span> Comprobar si Funciona
            </h3>
            <p className="text-xs text-slate-500 font-semibold leading-relaxed">
              Introduce tu propio correo para enviarte un email de prueba y verificar que todo está bien configurado.
            </p>
            <div className="flex flex-col gap-2">
              <input
                type="email"
                placeholder="Escribe tu correo de prueba aquí..."
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                className="p-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-sm font-bold outline-none focus:bg-white focus:border-[#009FE3]"
              />
              <button
                type="button"
                onClick={handleTestEmail}
                disabled={testing}
                className="w-full py-3 bg-slate-800 hover:bg-slate-900 text-white font-extrabold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 text-sm"
              >
                {testing ? 'Comprobando...' : 'Enviar Correo de Prueba'}
              </button>
            </div>

            {testStatus && (
              <div className={`p-4 rounded-xl border-2 text-xs font-bold leading-relaxed ${
                testStatus.success 
                  ? 'bg-emerald-50 border-emerald-250 text-emerald-800' 
                  : 'bg-rose-50 border-rose-250 text-rose-800'
              }`}>
                {testStatus.success ? (
                  <span>✔️ ¡Conexión perfecta! Revisa tu bandeja de entrada en unos instantes.</span>
                ) : (
                  <div className="space-y-1">
                    <span>❌ Hubo un problema al conectar:</span>
                    <p className="text-[10px] font-mono text-rose-700 bg-white/50 p-2 rounded border border-rose-100 break-all max-h-[85px] overflow-y-auto mt-1">
                      {testStatus.error}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Form */}
        <div className="lg:col-span-2">
          <form onSubmit={handleSave} className="bg-white border-2 border-slate-200 rounded-2xl shadow-3xs overflow-hidden">
            
            {/* Account Settings */}
            <div className="p-6 space-y-6">
              <h3 className="text-lg font-extrabold border-b-2 border-slate-100 pb-2 flex items-center gap-2 text-slate-800">
                📝 Tus Datos de Correo
              </h3>

              {/* Email Input */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-extrabold text-slate-550">Tu Dirección de Correo Electrónico</label>
                <input
                  type="email"
                  required
                  placeholder="Ej: jefa@alcebocontrol.com"
                  value={config.smtp_user}
                  onChange={(e) => handleEmailChange(e.target.value)}
                  className="p-4 bg-slate-50 border-2 border-slate-200 rounded-xl text-base font-black outline-none focus:bg-white focus:border-[#009FE3] text-[#1A1A1A]"
                />
              </div>

              {/* Password Input with show/hide toggle */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-extrabold text-slate-550">Tu Contraseña del Correo</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Contraseña de tu correo electrónico"
                    value={config.smtp_pass}
                    onChange={(e) => setConfig({ ...config, smtp_pass: e.target.value })}
                    className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-xl text-base font-black outline-none focus:bg-white focus:border-[#009FE3] text-[#1A1A1A]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-4 text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
                  >
                    {showPassword ? '🙈 OCULTAR' : '👁️ MOSTRAR'}
                  </button>
                </div>
              </div>

              {provider === 'gmail' && (
                <div className="bg-yellow-50 border-2 border-yellow-250 rounded-2xl p-4 text-xs text-yellow-800 font-bold leading-relaxed space-y-1">
                  <p>⚠️ <strong>Aviso para Gmail:</strong> Google requiere una contraseña especial para este programa.</p>
                  <p>En el campo de arriba, pega la contraseña de aplicación de 16 letras obtenida en tu cuenta de Google.</p>
                </div>
              )}

              {/* Advanced Settings Toggle */}
              <div className="pt-2">
                <label className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showAdvanced}
                    onChange={(e) => setShowAdvanced(e.target.checked)}
                    className="rounded border-slate-350 text-[#009FE3] focus:ring-0"
                  />
                  Mostrar ajustes avanzados (Servidor Host, Puertos, Tipo de proveedor)
                </label>
              </div>

              {/* Advanced parameters hidden by default for simplicity */}
              {showAdvanced && (
                <div className="space-y-4 pt-4 border-t-2 border-slate-100 animate-fade-in">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tipo de Cuenta</label>
                    <select
                      value={provider}
                      onChange={(e) => handleProviderChange(e.target.value)}
                      className="p-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-xs font-bold outline-none"
                    >
                      <option value="corporate">💼 Correo Corporativo (cPanel, Ionos, GoDaddy, etc.)</option>
                      <option value="gmail">✉️ Gmail</option>
                      <option value="outlook">📧 Outlook / Hotmail</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Servidor SMTP</label>
                      <input
                        type="text"
                        required
                        value={config.smtp_host}
                        onChange={(e) => setConfig({ ...config, smtp_host: e.target.value })}
                        className="p-2.5 bg-slate-50 border-2 border-slate-200 rounded-lg text-xs font-semibold outline-none"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Puerto</label>
                      <input
                        type="text"
                        required
                        value={config.smtp_port}
                        onChange={(e) => setConfig({ ...config, smtp_port: e.target.value })}
                        className="p-2.5 bg-slate-50 border-2 border-slate-200 rounded-lg text-xs font-semibold outline-none text-center"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Remitente (De:)</label>
                      <input
                        type="email"
                        required
                        value={config.smtp_from}
                        onChange={(e) => setConfig({ ...config, smtp_from: e.target.value })}
                        className="p-2.5 bg-slate-50 border-2 border-slate-200 rounded-lg text-xs font-semibold outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Email Templates Editing (Admin only) */}
            <div className="p-6 border-t-2 border-slate-100 bg-slate-50/50 space-y-4">
              <h3 className="text-base font-extrabold flex items-center gap-1.5 text-slate-750">
                📝 Configuración del Texto de Correo
              </h3>
              
              <div className="space-y-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Asunto del Correo (Recordatorio 48h)</label>
                  <input
                    type="text"
                    required
                    value={config.email_subject}
                    onChange={(e) => setConfig({ ...config, email_subject: e.target.value })}
                    className="p-3 bg-white border-2 border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-[#009FE3]"
                  />
                </div>
                
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Mensaje de Seguimiento</label>
                  <textarea
                    required
                    rows={6}
                    value={config.email_body}
                    onChange={(e) => setConfig({ ...config, email_body: e.target.value })}
                    className="p-3 bg-white border-2 border-slate-200 rounded-xl text-xs font-medium outline-none focus:border-[#009FE3] resize-y leading-relaxed text-slate-750"
                  />
                </div>

                <div className="flex flex-col gap-1.5 pt-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Plazo de espera del recordatorio (Horas)</label>
                  <input
                    type="number"
                    required
                    value={config.delay_hours}
                    onChange={(e) => setConfig({ ...config, delay_hours: e.target.value })}
                    className="p-3 bg-white border-2 border-slate-200 rounded-xl text-xs font-bold outline-none max-w-[120px]"
                  />
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div className="bg-slate-50 px-6 py-4.5 border-t-2 border-slate-150 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="h-[52px] px-8 bg-[#009FE3] hover:bg-[#0084c2] text-white font-black rounded-2xl text-[15px] active:scale-95 transition-all cursor-pointer shadow-md flex items-center justify-center gap-1.5"
              >
                {saving ? 'CONECTANDO...' : '🔑 CONECTAR CORREO'}
              </button>
            </div>

          </form>
        </div>

      </div>
    </div>
  );
}
