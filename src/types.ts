export interface Presupuesto {
  id: string;
  cliente: string;
  email: string;
  fecha: string;
  documento: string;
  monto: number;
  estado: 'Pendiente' | 'Completado';
  fecha_creacion: string;
  fecha_seguimiento_enviado: string | null;
  email_enviado: number;
  estado_visual: 'Pendiente de enviar' | 'Enviado' | 'Completado';
  error_seguimiento: string | null;
}

export interface SMTPConfig {
  smtp_host: string;
  smtp_port: string;
  smtp_secure: string;
  smtp_user: string;
  smtp_pass: string;
  smtp_from: string;
  email_subject: string;
  email_body: string;
  delay_hours: string;
}

export interface SystemLog {
  id: number;
  timestamp: string;
  tipo: 'cron' | 'email_enviado' | 'email_error' | 'db_recibido' | 'config';
  mensaje: string;
}

export interface CorreoEnviado {
  id: number;
  fecha: string;
  destinatario: string;
  asunto: string;
  cuerpo: string;
}
