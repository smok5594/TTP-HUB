"use client";

import React, { useState } from "react";
import Sidebar from "@/components/Sidebar";
import { toast } from "sonner";

const integrations = [
  {
    id: "google",
    name: "Google Calendar & Meet",
    description: "Sincronización automática de clases, salas y recordatorios vía Google Workspace.",
    icon: "event",
    color: "bg-sky-50 text-sky-600",
    status: "conectado",
    apiKey: "AIza••••••••••••••••••••••••XyZ",
    lastSync: "Hoy, 08:14 AM",
    events: [
      { time: "08:14 AM", msg: "Clase EMP-A sincronizada con Google Calendar." },
      { time: "07:50 AM", msg: "Meet creado: meet.google.com/abc-defg-hij" },
      { time: "Ayer", msg: "3 recordatorios enviados automáticamente." },
    ],
  },
  {
    id: "stripe",
    name: "Stripe Payments",
    description: "Procesamiento de pagos, cargos automáticos, alertas de fallo y morosidad.",
    icon: "credit_card",
    color: "bg-indigo-50 text-indigo-600",
    status: "conectado",
    apiKey: "sk_live_••••••••••••••••••••••••AbCd",
    lastSync: "Hoy, 09:02 AM",
    events: [
      { time: "09:02 AM", msg: "Cobro exitoso $2,450 — Elena Rodríguez." },
      { time: "08:50 AM", msg: "Alerta de fallo: tarjeta de Diego Ramírez rechazada." },
      { time: "Ayer", msg: "Webhook recibido: payment_intent.succeeded." },
    ],
  },
  {
    id: "whatsapp",
    name: "Meta WhatsApp Business",
    description: "Envío de mensajes automatizados, recordatorios, alertas y feedback semanal.",
    icon: "chat",
    color: "bg-teal-50 text-teal-600",
    status: "pendiente",
    apiKey: "EAABwz••••••••••••••••••••••••",
    lastSync: "Configuración en revisión",
    events: [
      { time: "Hoy", msg: "Plantilla class_link_meet en revisión por Meta." },
      { time: "Hoy", msg: "Plantilla student_absence_alert aprobada." },
      { time: "Ayer", msg: "Número de teléfono verificado exitosamente." },
    ],
  },
  {
    id: "burlington",
    name: "Burlington English",
    description: "Plataforma de aprendizaje externo con acceso de licencias por alumno.",
    icon: "language",
    color: "bg-amber-50 text-amber-600",
    status: "pendiente",
    apiKey: "BRL-••••••••••••••••-KEY",
    lastSync: "Sin sincronizar",
    events: [
      { time: "23 May", msg: "Licencias asignadas: 8 alumnos activos." },
      { time: "20 May", msg: "Reporte de progreso recibido de la plataforma." },
    ],
  },
];

export default function IntegrationsDashboard() {
  const [selected, setSelected] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);
  const [statuses, setStatuses] = useState(() => Object.fromEntries(integrations.map(i => [i.id, i.status])));

  const showToast = (msg) => {
    if (msg.startsWith("✅")) toast.success(msg.replace("✅ ", ""));
    else if (msg.startsWith("⛔")) toast.warning(msg.replace("⛔ ", ""));
    else toast(msg);
  };

  const handleToggle = (intg) => {
    const current = statuses[intg.id];
    const next = current === "conectado" ? "desconectado" : "conectado";
    setStatuses(p => ({ ...p, [intg.id]: next }));
    showToast(next === "conectado" ? `✅ ${intg.name} reconectado.` : `⛔ ${intg.name} desconectado.`);
    if (selected?.id === intg.id) setSelected({ ...intg, status: next });
  };

  const statusColor = (s) => s === "conectado" ? "bg-teal-50 border-teal-200 text-teal-600" : s === "pendiente" ? "bg-amber-50 border-amber-200 text-amber-500" : "bg-rose-50 border-rose-200 text-rose-600";
  const statusLabel = (s) => s === "conectado" ? "● Conectado" : s === "pendiente" ? "◐ Pendiente" : "○ Desconectado";

  return (
    <div className="flex min-h-screen bg-slate-50 font-inter relative">
      <Sidebar activeName="Integraciones" />

      <main className="flex-1 md:ml-64 min-h-screen flex flex-col">
        <header className="flex justify-between items-center w-full px-6 md:px-10 h-16 sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200">
          <div>
            <h2 className="font-montserrat font-bold text-slate-800 text-lg">Integraciones</h2>
            <p className="text-xs text-slate-400 font-medium">Servicios externos conectados al sistema</p>
          </div>
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
            <span className="w-2 h-2 rounded-full bg-teal-400" />
            {integrations.filter(i => statuses[i.id] === "conectado").length} / {integrations.length} activas
          </div>
        </header>

        <div className="p-6 md:p-10 max-w-7xl mx-auto w-full">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {integrations.map((intg) => {
              const st = statuses[intg.id];
              return (
                <div
                  key={intg.id}
                  className="bg-white border border-slate-200/60 rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => setSelected(intg)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${intg.color}`}>
                        <span className="material-symbols-outlined text-2xl">{intg.icon}</span>
                      </div>
                      <div>
                        <h3 className="font-montserrat font-bold text-slate-800 text-sm">{intg.name}</h3>
                        <p className="text-[11px] text-slate-400 font-medium mt-0.5 leading-relaxed max-w-xs">{intg.description}</p>
                      </div>
                    </div>
                    <span className={`text-[9px] font-bold px-2.5 py-1 rounded-full border whitespace-nowrap flex-shrink-0 ${statusColor(st)}`}>{statusLabel(st)}</span>
                  </div>

                  <div className="mt-5 flex items-center justify-between pt-4 border-t border-slate-100">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">API Key</p>
                      <p className="text-xs font-mono text-slate-600 font-semibold mt-0.5">{intg.apiKey}</p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleToggle(intg); }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 ${st === "conectado" ? "border border-rose-200 text-rose-600 hover:bg-rose-50" : "border border-teal-200 text-teal-600 hover:bg-teal-50"}`}
                    >
                      {st === "conectado" ? "Desconectar" : "Conectar"}
                    </button>
                  </div>

                  <div className="mt-3">
                    <p className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">sync</span>
                      Última sincronización: {intg.lastSync}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>

      {/* ===== MODAL: Detalle de Integración ===== */}
      {selected && (
        <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(15,23,42,0.7)", backdropFilter: "blur(4px)" }} onClick={(e) => { if (e.target === e.currentTarget) setSelected(null); }}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100 modal-card">
            <div className="flex items-center justify-between px-7 py-5 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${selected.color}`}>
                  <span className="material-symbols-outlined text-xl">{selected.icon}</span>
                </div>
                <div>
                  <h2 className="font-montserrat font-bold text-slate-800">{selected.name}</h2>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${statusColor(statuses[selected.id])}`}>{statusLabel(statuses[selected.id])}</span>
                </div>
              </div>
              <button onClick={() => setSelected(null)} className="w-8 h-8 rounded-xl bg-slate-200 hover:bg-slate-300 flex items-center justify-center"><span className="material-symbols-outlined text-slate-600 text-lg">close</span></button>
            </div>

            <div className="p-7 space-y-5">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">API Key configurada</p>
                <p className="font-mono text-sm text-slate-700 font-semibold">{selected.apiKey}</p>
              </div>

              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Log de Eventos Recientes</p>
                <div className="space-y-2">
                  {selected.events.map((ev, i) => (
                    <div key={i} className="flex items-start gap-3 text-sm">
                      <span className="text-[10px] font-bold text-slate-400 whitespace-nowrap pt-0.5 w-16 flex-shrink-0">{ev.time}</span>
                      <p className="text-slate-600 font-medium text-xs leading-relaxed">{ev.msg}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setSelected(null)} className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl font-semibold text-sm hover:bg-slate-50">Cerrar</button>
                <button onClick={() => { handleToggle(selected); setSelected(null); }} className={`flex-1 py-2.5 rounded-xl font-bold text-sm active:scale-95 transition-all ${statuses[selected.id] === "conectado" ? "bg-rose-600 text-white hover:bg-rose-700" : "bg-teal-600 text-white hover:bg-teal-700"}`}>
                  {statuses[selected.id] === "conectado" ? "Desconectar" : "Conectar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
