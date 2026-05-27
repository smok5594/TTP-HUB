"use client";

/**
 * ConfirmDialog — Modal de confirmación premium reutilizable
 * Animación: usa .modal-backdrop + .modal-card de globals.css
 * (solo transform + opacity → compositor-only, cero costo de layout/paint)
 */

import React, { useEffect, useRef } from "react";

const VARIANTS = {
  danger: {
    iconBg: "bg-rose-50",
    iconColor: "text-rose-500",
    icon: "delete_forever",
    confirmBg: "bg-rose-600 hover:bg-rose-700 shadow-rose-600/20",
    badge: "bg-rose-50 border-rose-100 text-rose-600",
    badgeText: "⚠️ Esta acción es permanente e irreversible.",
    accent: "bg-gradient-to-r from-rose-500 to-rose-400",
  },
  warning: {
    iconBg: "bg-amber-50",
    iconColor: "text-amber-500",
    icon: "warning",
    confirmBg: "bg-amber-500 hover:bg-amber-600 shadow-amber-500/20",
    badge: "bg-amber-50 border-amber-100 text-amber-600",
    badgeText: "⚠️ Esta acción puede afectar datos vinculados.",
    accent: "bg-gradient-to-r from-amber-400 to-amber-300",
  },
  info: {
    iconBg: "bg-sky-50",
    iconColor: "text-sky-500",
    icon: "info",
    confirmBg: "bg-sky-500 hover:bg-sky-600 shadow-sky-500/20",
    badge: "",
    badgeText: "",
    accent: "bg-gradient-to-r from-sky-500 to-sky-400",
  },
};

export default function ConfirmDialog({
  open,
  title = "¿Confirmar acción?",
  description = "",
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  variant = "danger",
  onConfirm,
  onCancel,
}) {
  const v = VARIANTS[variant] || VARIANTS.danger;

  // Accesibilidad: Escape para cerrar
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === "Escape") onCancel?.(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="modal-backdrop fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(15,23,42,0.55)", backdropFilter: "blur(5px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel?.(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      {/* Card con animación suave */}
      <div className="modal-card relative bg-white rounded-3xl shadow-2xl w-full max-w-sm border border-slate-100 overflow-hidden">
        {/* Barra de acento superior */}
        <div className={`h-1 w-full ${v.accent}`} />

        <div className="p-7 space-y-5 text-center">
          {/* Ícono */}
          <div className={`w-16 h-16 rounded-2xl ${v.iconBg} mx-auto flex items-center justify-center ring-4 ring-white shadow-sm`}>
            <span
              className={`material-symbols-outlined text-3xl ${v.iconColor}`}
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              {v.icon}
            </span>
          </div>

          {/* Texto */}
          <div className="space-y-2">
            <h3 id="confirm-dialog-title" className="font-montserrat font-bold text-slate-800 text-xl">
              {title}
            </h3>
            {description && (
              <p className="text-sm text-slate-500 leading-relaxed">
                {description}
              </p>
            )}
            {v.badgeText && (
              <p className={`text-[11px] font-semibold leading-relaxed border rounded-xl px-3 py-2 mt-3 ${v.badge}`}>
                {v.badgeText}
              </p>
            )}
          </div>

          {/* Acciones */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-3 border border-slate-200 text-slate-500 rounded-2xl font-semibold text-sm hover:bg-slate-50 active:scale-95 transition-all duration-150"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className={`flex-1 py-3 text-white rounded-2xl font-bold text-sm active:scale-95 transition-all duration-150 shadow-lg ${v.confirmBg}`}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
