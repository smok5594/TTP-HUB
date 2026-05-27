"use client";

import React, { useState } from "react";
import Sidebar from "@/components/Sidebar";
import { simulateSendWhatsApp, getInitialLogs, approvedTemplates } from "@/utils/whatsappSimulator";
import { toast } from "sonner";

const automationRules = [
  { id: "r-001", name: "Recordatorio de Clase (15 min antes)", description: "Envía el link de Google Meet por WhatsApp 15 minutos antes de cada clase.", icon: "alarm", trigger: "Programado · 15 min antes", enabled: true },
  { id: "r-002", name: "Alerta de Alumno Ausente", description: "Notifica al administrador si un alumno no se conecta a la clase.", icon: "person_off", trigger: "Automático · Al marcar falta", enabled: true },
  { id: "r-003", name: "Recordatorio de Pago", description: "Envía WhatsApp a alumnos con pago próximo a vencer (3 días antes).", icon: "payments", trigger: "Programado · 3 días antes", enabled: true },
  { id: "r-004", name: "Alerta de Pago Fallido", description: "Notifica al admin cuando Stripe rechaza un cargo.", icon: "credit_card_off", trigger: "Webhook Stripe", enabled: true },
  { id: "r-005", name: "Feedback Semanal Automático", description: "Recuerda al maestro enviar el feedback de sus alumnos cada viernes.", icon: "rate_review", trigger: "Cron · Viernes 18:00", enabled: false },
  { id: "r-006", name: "Mensaje Motivacional Mensual", description: "Envía una frase motivacional a todos los alumnos activos el primer día del mes.", icon: "celebration", trigger: "Cron · Día 1 del mes", enabled: false },
  { id: "r-007", name: "Resumen Diario para Maestros", description: "Envía resumen de clases del día a cada maestro a las 7:00 AM.", icon: "summarize", trigger: "Cron · 07:00 AM diario", enabled: true },
  { id: "r-008", name: "Alerta de Morosidad", description: "Escala la alerta si el alumno lleva más de 7 días sin pagar.", icon: "warning", trigger: "Automático · 7 días vencidos", enabled: true },
];

export default function AutomationsDashboard() {
  const [rules, setRules] = useState(automationRules);
  const [whatsappLogs, setWhatsAppLogs] = useState(getInitialLogs());
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [whatsappForm, setWhatsappForm] = useState({
    studentName: "",
    phone: "",
    template: "class_link_meet",
    val1: "",
    val2: "English B2 - Advanced",
    val3: "https://meet.google.com/abc-defg-hij",
    val4: "",
  });

  const showToast = (msg) => {
    if (msg.startsWith("✅")) toast.success(msg.replace("✅ ", ""));
    else if (msg.startsWith("⛔") || msg.startsWith("❌")) toast.error(msg.replace(/^[⛔❌] /, ""));
    else if (msg.startsWith("🔌")) toast.loading(msg.replace("🔌 ", ""));
    else toast(msg);
  };

  const handleToggleRule = (id) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r));
    const rule = rules.find(r => r.id === id);
    showToast(rule.enabled ? `⛔ Automatización "${rule.name}" desactivada.` : `✅ Automatización "${rule.name}" activada.`);
  };

  const handleSendManualWhatsApp = async (e) => {
    e.preventDefault();
    if (!whatsappForm.phone || !whatsappForm.template) { showToast("❌ Completa el número y la plantilla."); return; }
    setIsSendingMessage(true);
    showToast("🔌 Conectando con Meta Cloud API...");
    const result = await simulateSendWhatsApp({
      to: whatsappForm.phone,
      template: whatsappForm.template,
      variables: [whatsappForm.val1, whatsappForm.val2, whatsappForm.val3, whatsappForm.val4].filter(Boolean),
      studentName: whatsappForm.studentName,
    });
    setWhatsAppLogs(prev => [result, ...prev]);
    setIsSendingMessage(false);
    showToast(result.status === "delivered" ? `✅ Mensaje enviado a ${whatsappForm.studentName}` : `❌ Fallo en el envío.`);
  };

  const enabledCount = rules.filter(r => r.enabled).length;

  return (
    <div className="flex min-h-screen bg-slate-50 font-inter relative">
      <Sidebar activeName="Automatizaciones" />

      <main className="flex-1 md:ml-64 min-h-screen flex flex-col">
        <header className="flex justify-between items-center w-full px-6 md:px-10 h-16 sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200">
          <div>
            <h2 className="font-montserrat font-bold text-slate-800 text-lg">Automatizaciones</h2>
            <p className="text-xs text-slate-400 font-medium">{enabledCount} de {rules.length} reglas activas</p>
          </div>
          <div className="flex items-center gap-2 text-xs font-bold px-3 py-1.5 bg-teal-50 border border-teal-200 text-teal-700 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
            Motor de Automatizaciones ONLINE
          </div>
        </header>

        <div className="p-6 md:p-10 max-w-7xl mx-auto w-full space-y-8">
          {/* ── REGLAS ── */}
          <div className="bg-white border border-slate-200/60 rounded-3xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-montserrat font-bold text-slate-800 text-sm">Reglas de Automatización</h3>
              <span className="text-[10px] font-bold text-slate-400">{enabledCount} activas · {rules.length - enabledCount} pausadas</span>
            </div>
            <div className="divide-y divide-slate-50">
              {rules.map((rule) => (
                <div key={rule.id} className={`flex items-center justify-between px-6 py-4 gap-4 transition-colors ${rule.enabled ? "hover:bg-slate-50/40" : "opacity-50 hover:bg-slate-50/40"}`}>
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${rule.enabled ? "bg-ttp-primary/10 text-ttp-primary" : "bg-slate-100 text-slate-400"}`}>
                      <span className="material-symbols-outlined text-lg">{rule.icon}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-slate-800 text-sm">{rule.name}</p>
                      <p className="text-[11px] text-slate-400 font-medium truncate">{rule.description}</p>
                      <p className="text-[10px] text-slate-300 font-semibold mt-0.5">
                        <span className="material-symbols-outlined text-[10px] align-middle mr-0.5">bolt</span>
                        {rule.trigger}
                      </p>
                    </div>
                  </div>
                  {/* Toggle Switch */}
                  <button
                    onClick={() => handleToggleRule(rule.id)}
                    className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none ${rule.enabled ? "bg-ttp-primary" : "bg-slate-200"}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${rule.enabled ? "translate-x-5" : "translate-x-0"}`} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* ── CONSOLA WHATSAPP ── */}
          <div className="bg-slate-900 rounded-3xl overflow-hidden border border-slate-700/50 shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/50">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
                <span className="font-montserrat font-bold text-white text-sm">WhatsApp Gateway — Despacho Manual</span>
              </div>
              <span className="text-[10px] font-bold text-slate-500 font-mono">{whatsappLogs.length} mensajes en bitácora</span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 divide-y lg:divide-y-0 lg:divide-x divide-slate-700/50">
              {/* Formulario */}
              <div className="p-6 space-y-4">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Nuevo Mensaje</p>
                <form onSubmit={handleSendManualWhatsApp} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Alumno</label>
                      <input value={whatsappForm.studentName} onChange={e => setWhatsappForm(p => ({ ...p, studentName: e.target.value }))} disabled={isSendingMessage} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs font-medium text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-ttp-primary/30" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Teléfono</label>
                      <input value={whatsappForm.phone} onChange={e => setWhatsappForm(p => ({ ...p, phone: e.target.value }))} disabled={isSendingMessage} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs font-medium text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-ttp-primary/30" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Plantilla</label>
                    <select value={whatsappForm.template} onChange={e => setWhatsappForm(p => ({ ...p, template: e.target.value }))} disabled={isSendingMessage} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs font-semibold text-white focus:outline-none focus:ring-2 focus:ring-ttp-primary/30 cursor-pointer">
                      {approvedTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {["val1", "val2", "val3", "val4"].map((k, i) => (
                      <div key={k}>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">{"{{" + (i + 1) + "}}"}</label>
                        <input value={whatsappForm[k] || ""} onChange={e => setWhatsappForm(p => ({ ...p, [k]: e.target.value }))} disabled={isSendingMessage} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs font-medium text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-ttp-primary/30" />
                      </div>
                    ))}
                  </div>
                  <button type="submit" disabled={isSendingMessage} className="w-full py-2.5 bg-ttp-primary hover:opacity-90 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-60">
                    {isSendingMessage ? (<><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /><span>Enviando...</span></>) : (<><span className="material-symbols-outlined text-sm">send</span><span>Enviar Mensaje</span></>)}
                  </button>
                </form>
              </div>

              {/* Bitácora */}
              <div className="p-6 space-y-3 max-h-[420px] overflow-y-auto">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider sticky top-0 bg-slate-900 pb-2">Bitácora de Mensajes</p>
                {whatsappLogs.slice(0, 20).map((log, i) => (
                  <div key={i} className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-300">{log.studentName || log.to}</span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${log.status === "delivered" ? "bg-teal-500/10 border-teal-500/20 text-teal-400" : "bg-rose-500/10 border-rose-500/20 text-rose-400"}`}>
                        {log.status === "delivered" ? "✓ Entregado" : "✗ Fallido"}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-mono">{log.template}</p>
                    <p className="text-[10px] text-slate-500">{log.sentAt}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
