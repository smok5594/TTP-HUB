/**
 * TTP Hub - WhatsApp Cloud API Gateway & Message Simulator
 * Emulates Meta Cloud API requests for official WhatsApp templates,
 * formats message templates in Spanish, and logs secure communication records.
 */

// Official approved WhatsApp Meta templates
export const approvedTemplates = [
  {
    name: "class_link_meet",
    category: "Academic",
    description: "Envío de enlaces de Google Meet 15 min antes de iniciar la clase.",
    text: "Hola {{1}}, tu clase de {{2}} está por comenzar. Entra aquí: {{3}} (Google Meet). ¡Te esperamos!"
  },
  {
    name: "student_absence_alert",
    category: "Operational",
    description: "Alerta inmediata a padres/tutores por inasistencia al aula.",
    text: "Aviso Importante: El alumno {{1}} no se ha presentado a su clase de {{2}} el día de hoy. Por favor, justifica su inasistencia en la app."
  },
  {
    name: "stripe_payment_failed",
    category: "Financial",
    description: "Notificación de pago fallido de Stripe para reintentar cobro.",
    text: "Hola {{1}}, detectamos un inconveniente con el cargo de Stripe para tu colegiatura de {{2}} por ${{3}} MXN. Actualiza tus datos aquí: {{4}}"
  },
  {
    name: "overdue_payment_reminder",
    category: "Financial",
    description: "Recordatorio de saldo vencido y alerta de morosidad escolar.",
    text: "Aviso de Cobranza: {{1}}, tu saldo por ${{2}} MXN de tu colegiatura en TTP Hub se encuentra vencido. Evita recargos y reporta tu pago."
  },
  {
    name: "teacher_daily_summary",
    category: "Operational",
    description: "Resumen diario a las 7:00 AM para la agenda docente.",
    text: "Buenos días {{1}}, tu agenda de hoy en TTP Hub consta de {{2}} clases programadas. Estudiantes inscritos: {{3}}."
  },
  {
    name: "student_motivational_message",
    category: "Academic",
    description: "Mensaje motivacional de fin de semana para incentivar el estudio.",
    text: "Hola {{1}}, ¡felicidades por tu gran esfuerzo esta semana en tu curso de {{2}}! Recuerda: {{3}}. ¡Sigue así!"
  },
  {
    name: "student_weekly_feedback",
    category: "Academic",
    description: "Envío del feedback semanal de rendimiento redactado por el docente.",
    text: "Hola {{1}}, tu reporte de feedback semanal para {{2}} está listo: {{3}} Desempeño general: {{4}}. ¡Sigue progresando!"
  }
];

// Pre-seeded communication history log
const initialMessageLogs = [];

export function getInitialLogs() {
  return initialMessageLogs;
}

/**
 * Simulates calling Meta's REST API endpoint to send a WhatsApp template message
 */
export async function simulateSendWhatsApp(to, templateName, variables, studentName) {
  const template = approvedTemplates.find(t => t.name === templateName);
  if (!template) {
    throw new Error(`La plantilla '${templateName}' no existe.`);
  }

  // Format body by replacing placeholers {{1}}, {{2}}, etc.
  let formattedBody = template.text;
  variables.forEach((val, index) => {
    formattedBody = formattedBody.replace(`{{${index + 1}}}`, val);
  });

  const maskPhone = (phone) => {
    const clean = phone.replace(/\s+/g, "");
    if (clean.length < 8) return phone;
    return `${clean.substring(0, 3)} ${clean.substring(3, 5)} **** ${clean.substring(clean.length - 4)}`;
  };

  const messageId = `wamid.HBgN${Math.floor(100000000 + Math.random() * 900000000)}Y${Math.floor(10 + Math.random() * 90)}`;
  
  const mockLogEntry = {
    id: `w-${Date.now()}`,
    messageId: messageId,
    to: maskPhone(to || "+52 55 0000 0000"),
    studentName: studentName || "Contacto",
    template: templateName,
    body: formattedBody,
    status: "Entregado",
    timestamp: new Date().toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" }) + " - " + new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })
  };

  console.log(`[WhatsApp Gateway] Meta API Success - ID: ${messageId}`);
  return mockLogEntry;
}
