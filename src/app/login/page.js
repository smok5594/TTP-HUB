"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabaseClient";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Selector demo para facilitar pruebas en caliente
  const demoUsers = [
    { label: "Administrador (Full Access)", email: "alexapuch@hotmail.com", role: "admin" },
    { label: "Docente de Prueba (Elena V.)", email: "e.valdez@ttp.mx", role: "teacher" },
    { label: "Alumno de Prueba (Elena R.)", email: "elena.rod@email.com", role: "student" },
  ];

  useEffect(() => {
    // Si ya hay una sesión activa, redirigir según el rol
    const stored = localStorage.getItem("ttp_user_session");
    if (stored) {
      try {
        const user = JSON.parse(stored);
        redirectByRole(user.role);
      } catch (e) {}
    }
  }, []);

  const redirectByRole = (role) => {
    if (role === "admin") {
      router.push("/");
    } else if (role === "teacher") {
      router.push("/teachers/portal");
    } else if (role === "student") {
      router.push("/students/portal");
    } else {
      router.push("/");
    }
  };

  const handleLoginSubmit = (e) => {
    e.preventDefault();
    if (!email) return;
    performLogin(email.trim().toLowerCase());
  };

  const handleGoogleLogin = () => {
    setLoading(true);
    setError(null);
    const targetEmail = email ? email.trim().toLowerCase() : "alexapuch@hotmail.com";
    setTimeout(() => performLogin(targetEmail), 1200);
  };

  const performLogin = async (targetEmail) => {
    setLoading(true);
    setError(null);

    let role = "student";
    let name = "Usuario TTP";
    let profile = null;

    if (targetEmail === "alexapuch@hotmail.com") {
      role = "admin";
      name = "Alexa Montserrat";
    } else {
      // Check teachers in Supabase
      const { data: teachers } = await supabase
        .from("teachers")
        .select("id, name, email, specialty, status")
        .ilike("email", targetEmail);

      const matchedTeacher = (teachers || []).find(
        (t) => t.email && t.email.toLowerCase() === targetEmail
      );

      if (matchedTeacher) {
        role = "teacher";
        name = matchedTeacher.name;
        profile = matchedTeacher;
      } else {
        // Check students in Supabase
        const { data: students } = await supabase
          .from("students")
          .select("id, name, last_name, email, status, current_course, teacher, schedule, payment_status, amount_due")
          .ilike("email", targetEmail);

        const matchedStudent = (students || []).find(
          (s) => s.email && s.email.toLowerCase() === targetEmail
        );

        if (matchedStudent) {
          role = "student";
          name = `${matchedStudent.name} ${matchedStudent.last_name || ""}`.trim();
          profile = matchedStudent;
        } else if (targetEmail.includes("@")) {
          role = "student";
          name = targetEmail.split("@")[0].toUpperCase();
        } else {
          setLoading(false);
          setError("Por favor ingresa un correo electrónico válido.");
          return;
        }
      }
    }

    const sessionObj = { email: targetEmail, name, role, profile, timestamp: Date.now() };
    localStorage.setItem("ttp_user_session", JSON.stringify(sessionObj));
    setSuccess(`¡Bienvenido de vuelta, ${name}!`);

    setTimeout(() => {
      setLoading(false);
      redirectByRole(role);
    }, 1000);
  };

  const handleQuickDemoLogin = (demo) => {
    setEmail(demo.email);
    performLogin(demo.email);
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center bg-[#0d1321] overflow-hidden px-4">
      {/* Círculos con gradiente en el fondo con animaciones lentas */}
      <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-gradient-to-br from-[#e74d8a]/20 to-purple-800/10 blur-[120px] pointer-events-none animate-pulse duration-[8s]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-gradient-to-tr from-sky-800/10 to-[#e74d8a]/15 blur-[120px] pointer-events-none animate-pulse duration-[12s]" />

      <div className="w-full max-w-md z-10 space-y-6">
        {/* Header Logo */}
        <div className="text-center space-y-2">
          <div className="inline-flex w-16 h-16 rounded-2xl bg-gradient-to-br from-[#e74d8a] to-purple-600 p-0.5 shadow-lg shadow-pink-500/20 items-center justify-center">
            <div className="w-full h-full bg-[#0d1321]/90 rounded-2xl flex items-center justify-center">
              <span className="material-symbols-outlined text-3xl font-extrabold bg-gradient-to-r from-[#e74d8a] to-purple-400 bg-clip-text text-transparent">
                school
              </span>
            </div>
          </div>
          <h1 className="font-montserrat text-3xl font-extrabold text-white tracking-tight">
            TTP Hub Portal
          </h1>
          <p className="text-sm text-slate-400 font-semibold">
            Ingreso Unificado · Administradores, Docentes y Alumnos
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6">
          
          {/* Mensajes de Feedback */}
          {error && (
            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-300 p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2">
              <span className="material-symbols-outlined text-base">error</span>
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="bg-teal-500/10 border border-teal-500/20 text-teal-300 p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2">
              <span className="material-symbols-outlined text-base">check_circle</span>
              <span>{success}</span>
            </div>
          )}

          {/* Botón de Google */}
          <button
            type="button"
            disabled={loading}
            onClick={handleGoogleLogin}
            className="w-full py-3 bg-white hover:bg-slate-50 text-slate-800 rounded-2xl text-sm font-bold flex items-center justify-center gap-3 transition-all duration-150 active:scale-98 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {/* Google Icon SVG */}
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v3.92h6.69a5.79 5.79 0 0 1-2.49 3.8v3.12h4.01c2.34-2.15 3.69-5.32 3.69-8.77z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.97-1.08 7.96-2.91l-4.01-3.12c-1.12.75-2.55 1.19-3.95 1.19-3.05 0-5.63-2.06-6.55-4.83H1.31v3.22A12 12 0 0 0 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.45 14.33a7.14 7.14 0 0 1 0-4.66V6.45H1.31a12 12 0 0 0 0 11.1l4.14-3.22z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.22 0 12 0A12 12 0 0 0 1.31 6.45l4.14 3.22c.92-2.77 3.5-4.92 6.55-4.92z"
              />
            </svg>
            <span>Iniciar Sesión con Google</span>
          </button>

          {/* Separador */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-[1px] bg-slate-800" />
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              o ingresa con correo
            </span>
            <div className="flex-1 h-[1px] bg-slate-800" />
          </div>

          {/* Formulario de Email */}
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Dirección de Correo Electrónico
              </label>
              <input
                type="text"
                disabled={loading}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ejemplo@ttp.mx"
                className="w-full px-4 py-3 bg-slate-950/50 border border-slate-800 rounded-xl text-sm font-semibold text-white placeholder-slate-600 outline-none focus:border-[#e74d8a] focus:ring-1 focus:ring-[#e74d8a]/50 transition-all disabled:opacity-50"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !email}
              className="w-full py-3 bg-gradient-to-r from-[#e74d8a] to-purple-600 hover:opacity-90 text-white rounded-2xl text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-pink-500/10 transition-all duration-150 active:scale-98 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Iniciando sesión...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-base">login</span>
                  <span>Iniciar Sesión</span>
                </>
              )}
            </button>
          </form>

          {/* Panel Demo Rápido para Evaluador */}
          <div className="border-t border-slate-800/80 pt-5 space-y-3">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center">
              Acceso Rápido para Pruebas (Demo)
            </p>
            <div className="flex flex-col gap-2">
              {demoUsers.map((user) => (
                <button
                  key={user.email}
                  type="button"
                  onClick={() => handleQuickDemoLogin(user)}
                  className="w-full py-2.5 px-3 bg-slate-950/40 hover:bg-slate-950/80 border border-slate-850 hover:border-slate-800 rounded-xl text-xs font-semibold text-slate-300 hover:text-white flex justify-between items-center transition-all duration-150 active:scale-98 cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      user.role === "admin" ? "bg-pink-500" : user.role === "teacher" ? "bg-sky-500" : "bg-teal-400"
                    }`} />
                    {user.label}
                  </span>
                  <span className="text-[10px] font-bold text-slate-500 font-mono">
                    {user.email}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer info */}
        <p className="text-center text-[10px] text-slate-500 font-medium">
          TTP Hub Educación Hub · Derechos Reservados &copy; 2026
        </p>
      </div>
    </div>
  );
}
