import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import logging
from app.core.config import settings
import asyncio

logger = logging.getLogger(__name__)

def _send_email_sync(to_email: str, subject: str, html_content: str):
    if not settings.EMAIL_HOST or not settings.EMAIL_USER or not settings.EMAIL_PASS:
        logger.warning("Configuración de SMTP incompleta. Correo no enviado.")
        return

    msg = MIMEMultipart()
    msg['From'] = settings.EMAIL_FROM or settings.EMAIL_USER
    msg['To'] = to_email
    msg['Subject'] = subject

    msg.attach(MIMEText(html_content, 'html'))

    try:
        server = smtplib.SMTP(settings.EMAIL_HOST, settings.EMAIL_PORT)
        server.starttls()
        server.login(settings.EMAIL_USER, settings.EMAIL_PASS)
        server.send_message(msg)
        server.quit()
        logger.info(f"Correo enviado exitosamente a {to_email}")
    except Exception as e:
        logger.error(f"Error al enviar correo SMTP: {e}")

async def send_2fa_code_async(to_email: str, code: str):
    """Envía el código de 6 dígitos para la verificación 2FA."""
    subject = "Código de Seguridad 2FA - NEXUS Observatory"
    html_content = f"""
    <html>
      <body style="font-family: sans-serif; color: #333; padding: 20px;">
        <div style="max-width: 500px; margin: 0 auto; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 30px; text-align: center;">
            <h2 style="color: #0f172a; margin-top: 0;">Tu Código de Verificación</h2>
            <p>Usa el siguiente código de 6 dígitos para iniciar sesión:</p>
            <div style="margin: 20px 0; background: #f1f5f9; padding: 15px; border-radius: 8px;">
                <span style="font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #3b82f6;">{code}</span>
            </div>
            <p style="font-size: 14px; color: #64748b;">Este código expirará en 10 minutos. Si no solicitaste este código, puedes ignorar este mensaje.</p>
        </div>
      </body>
    </html>
    """
    await asyncio.to_thread(_send_email_sync, to_email, subject, html_content)

async def send_recovery_token_async(to_email: str, token: str):
    """Envía el token de recuperación de contraseña."""
    subject = "Recuperación de Contraseña - NEXUS Observatory"
    html_content = f"""
    <html>
      <body style="font-family: sans-serif; color: #333; padding: 20px;">
        <div style="max-width: 500px; margin: 0 auto; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 30px; text-align: center;">
            <h2 style="color: #0f172a; margin-top: 0;">Restablecer Contraseña</h2>
            <p>Has solicitado restablecer tu contraseña. Usa el siguiente PIN para crear una nueva:</p>
            <div style="margin: 20px 0; background: #f1f5f9; padding: 15px; border-radius: 8px;">
                <span style="font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #3b82f6;">{token}</span>
            </div>
            <p style="font-size: 14px; color: #64748b;">Este PIN expirará en 15 minutos. Si no solicitaste restablecer tu contraseña, ignora este correo.</p>
        </div>
      </body>
    </html>
    """
    await asyncio.to_thread(_send_email_sync, to_email, subject, html_content)

async def send_budget_alert_async(project_name: str, budget_cop: float, to_email: str = "foamwashlg47@gmail.com"):
    """
    Envía una alerta de presupuesto agotado de forma asíncrona.
    El correo destinatario por defecto es el mismo del config para propósitos de prueba/administración.
    """
    subject = f"⚠️ Alerta de Seguridad: Presupuesto agotado para el Agente '{project_name}'"
    html_content = f"""
    <html>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; background-color: #f8fafc; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
            <div style="background-color: #ef4444; color: white; padding: 30px; text-align: center;">
                <h1 style="margin: 0; font-size: 24px;">Límite de Presupuesto Alcanzado</h1>
            </div>
            <div style="padding: 40px 30px;">
                <p style="font-size: 16px; line-height: 1.6;">Hola Administrador,</p>
                <p style="font-size: 16px; line-height: 1.6;">Te informamos que el Agente de Inteligencia Artificial <strong>{project_name}</strong> ha consumido el 100% de su límite mensual permitido.</p>
                
                <div style="background-color: #f1f5f9; padding: 20px; border-radius: 12px; margin: 30px 0; border-left: 4px solid #3b82f6;">
                    <p style="margin: 0 0 10px 0; font-size: 14px; color: #64748b; font-weight: bold; text-transform: uppercase;">Límite Configurado</p>
                    <p style="margin: 0; font-size: 28px; font-weight: bold; color: #0f172a;">${budget_cop:,.0f} COP</p>
                </div>
                
                <p style="font-size: 16px; line-height: 1.6;"><strong>El Kill Switch de NEXUS se ha activado.</strong> A partir de este momento, todas las peticiones a los modelos de lenguaje (LLMs) para este agente están siendo bloqueadas automáticamente para proteger tus finanzas.</p>
                <p style="font-size: 16px; line-height: 1.6;">Si deseas reactivar el servicio, por favor ingresa al módulo de FinOps en tu panel de control y actualiza el presupuesto.</p>
            </div>
            <div style="background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
                <p style="margin: 0; font-size: 14px; color: #94a3b8;">Notificación automática de <strong>NEXUS Observatory</strong></p>
            </div>
        </div>
      </body>
    </html>
    """
    
    # Enviar en un thread separado para no bloquear el event loop de FastAPI
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, _send_email_sync, to_email, subject, html_content)
