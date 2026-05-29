"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const navGroups = [
  {
    label: "Principal",
    items: [
      { name: "Panel de Control", icon: "dashboard", route: "/" },
      { name: "Horarios", icon: "calendar_today", route: "/schedules" },
    ],
  },
  {
    label: "Personas",
    items: [
      { name: "Estudiantes", icon: "school", route: "/students" },
      { name: "Maestros", icon: "person_4", route: "/teachers" },
    ],
  },
  {
    label: "Finanzas",
    items: [
      { name: "Facturación", icon: "payments", route: "/billing" },
      { name: "Reportes", icon: "bar_chart", route: "/reports" },
    ],
  },
  {
    label: "Sistema",
    items: [
      { name: "Automatizaciones", icon: "bolt", route: "/automations" },
      { name: "Integraciones", icon: "integration_instructions", route: "/integrations" },
      { name: "Configuración", icon: "settings", route: "/settings" },
    ],
  },
];

export default function Sidebar({ activeName }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sessionUser, setSessionUser] = useState(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("ttp_user_session");
      if (stored) {
        try {
          setSessionUser(JSON.parse(stored));
        } catch (e) {}
      }
    }
  }, []);

  const handleLogout = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("ttp_user_session");
      router.push("/login");
    }
  };

  const displayName = sessionUser?.name || "Administrador";
  const displayRoleLabel = sessionUser?.role === "admin" ? "Acceso Total" : sessionUser?.role === "teacher" ? "Docente" : "Estudiante";
  const displayRoleTitle = sessionUser?.role === "admin" ? "Administrador" : sessionUser?.role === "teacher" ? "Profesor" : "Alumno";

  return (
    <aside className="fixed top-0 bottom-0 left-0 z-40 hidden flex-col w-64 border-r border-slate-200 bg-white p-5 md:flex transition-all duration-300 overflow-y-auto">
      {/* Brand */}
      <div className="mb-7 px-1">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-3xl font-bold text-ttp-primary">
            admin_panel_settings
          </span>
          <h1 className="font-montserrat text-xl font-bold tracking-tight text-ttp-primary">
            Portal Admin
          </h1>
        </div>
        <p className="text-xs text-slate-400 font-semibold mt-1 ml-0.5">Gestión Educativa · TTP Hub</p>
      </div>

      {/* Nav Groups */}
      <nav className="flex flex-col gap-5 flex-grow">
        {navGroups.map((group) => (
          <div key={group.label}>
            <p className="text-[9px] font-bold text-slate-300 uppercase tracking-widest mb-2 px-2">
              {group.label}
            </p>
            <div className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const isActive =
                  activeName
                    ? activeName === item.name
                    : pathname === item.route ||
                      (item.route !== "/" && pathname?.startsWith(item.route));
                return (
                  <Link
                    key={item.name}
                    href={item.route}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl font-semibold transition-all duration-150 active:scale-95 text-left w-full text-sm ${
                      isActive
                        ? "bg-ttp-primary/10 text-ttp-primary shadow-sm"
                        : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                  >
                    <span
                      className={`material-symbols-outlined text-xl ${
                        isActive ? "text-ttp-primary" : "text-slate-400"
                      }`}
                    >
                      {item.icon}
                    </span>
                    <span>{item.name}</span>
                    {isActive && (
                      <span className="ml-auto w-1.5 h-1.5 rounded-full bg-ttp-primary" />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom Profile and LogOut */}
      <div className="mt-6 border-t border-slate-100 pt-4 space-y-1">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-100">
          <div className="w-8 h-8 rounded-full bg-ttp-primary/10 flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined text-ttp-primary text-base">person</span>
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-slate-800 truncate">{displayName}</p>
            <p className="text-[10px] text-slate-400 font-medium">{displayRoleTitle} · {displayRoleLabel}</p>
          </div>
          <span className="ml-auto w-2 h-2 rounded-full bg-teal-400 flex-shrink-0" title="En línea" />
        </div>

        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold text-rose-500 hover:bg-rose-50 transition-all duration-150 active:scale-95 text-left text-sm mt-1.5 cursor-pointer"
        >
          <span className="material-symbols-outlined text-xl text-rose-400">logout</span>
          <span>Cerrar Sesión</span>
        </button>

        <p className="text-center text-[9px] text-slate-300 font-medium pt-1 tracking-wide">
          v1.6 · Real Mail Sync · 28 May 2026
        </p>
      </div>
    </aside>
  );
}
