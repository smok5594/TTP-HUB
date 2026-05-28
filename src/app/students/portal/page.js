"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabaseClient";

export default function StudentPortal() {
  const router = useRouter();
  const [studentSession, setStudentSession] = useState(null);
  const [studentProfile, setStudentProfile] = useState(null);
  const [classes, setClasses] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [toastMessage, setToastMessage] = useState(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // 1. Obtener la sesión activa
    const session = localStorage.getItem("ttp_user_session");
    if (!session) {
      router.push("/login");
      return;
    }

    let parsedSession;
    try {
      parsedSession = JSON.parse(session);
      if (parsedSession.role !== "student") { router.push("/login"); return; }
    } catch (e) { router.push("/login"); return; }

    setStudentSession(parsedSession);

    const loadData = async () => {
      try {
        const { data: studentsData } = await supabase
          .from("students")
          .select("id, name, last_name, email, current_course, current_group, teacher, schedule, status, payment_status, amount_due")
          .ilike("email", parsedSession.email);

        const matched = (studentsData || [])[0];
        if (!matched) { router.push("/login"); return; }
        setStudentProfile(matched);

        const { data: schedulesData } = await supabase
          .from("schedules")
          .select("*")
          .or(`teacher.ilike.%${matched.teacher || ""}%,title.ilike.%${matched.current_course || ""}%`);

        const enrolledClasses = schedulesData || [];
        const records = enrolledClasses.map(c => ({
          classId: c.id,
          title: c.title,
          teacher: c.teacher,
          day: c.day,
          time: c.time,
          status: "sin_asignar",
        }));

        setClasses(enrolledClasses);
        setAttendanceRecords(records);
      } catch (e) {
        console.error("Error cargando portal del alumno:", e);
      }
    };

    loadData();
  }, [router]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleLogout = () => {
    localStorage.removeItem("ttp_user_session");
    router.push("/login");
  };

  if (!studentSession || !studentProfile) return null;

  // Calcular porcentaje de asistencia
  const completedRecords = attendanceRecords.filter(r => r.status !== "sin_asignar");
  const presentCount = attendanceRecords.filter(r => r.status === "presente").length;
  const attendanceRate = completedRecords.length > 0 
    ? Math.round((presentCount / completedRecords.length) * 100) 
    : 100;

  // Si está al corriente o si su saldo es 0 -> Pago Realizado
  const isPaid = studentProfile.payment_status === "al_corriente" || studentProfile.amount_due === 0;

  return (
    <div className="min-h-screen bg-slate-50 font-inter flex flex-col pb-12">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-slate-700 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <span className="material-symbols-outlined text-teal-400">check_circle</span>
          <span className="text-sm font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <header className="bg-gradient-to-r from-slate-900 to-slate-950 text-white px-6 md:px-12 py-4 flex justify-between items-center shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#e74d8a] to-purple-600 flex items-center justify-center">
            <span className="material-symbols-outlined text-white text-xl">school</span>
          </div>
          <div>
            <h1 className="font-montserrat font-bold text-base tracking-tight">TTP Hub Alumnos</h1>
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Portal del Estudiante</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden md:flex flex-col text-right">
            <span className="text-xs font-bold text-slate-200">{studentProfile.name}</span>
            <span className="text-[9px] font-bold text-teal-400 uppercase tracking-widest">Estudiante Activo</span>
          </div>
          <div className="w-[1px] h-6 bg-slate-800 hidden md:block" />
          <button
            onClick={handleLogout}
            className="px-3.5 py-1.5 bg-slate-800 hover:bg-rose-950/30 border border-slate-700 hover:border-rose-500/20 text-slate-300 hover:text-rose-400 rounded-xl text-xs font-bold transition-all duration-150 flex items-center gap-1.5 cursor-pointer active:scale-95"
          >
            <span className="material-symbols-outlined text-sm">logout</span>
            <span>Salir</span>
          </button>
        </div>
      </header>

      {/* Hero Stats */}
      <div className="max-w-7xl mx-auto w-full px-6 md:px-12 pt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Estatus Académico */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Mi Programa Escolar</p>
            <h2 className="text-lg font-extrabold text-slate-800 leading-tight">{studentProfile.current_course}</h2>
            <p className="text-[10px] text-[#e74d8a] font-bold uppercase tracking-widest mt-1">Nivel Activo</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-pink-50 text-[#e74d8a] flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined text-2xl">menu_book</span>
          </div>
        </div>

        {/* Estatus Financiero */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Estado Financiero</p>
            {isPaid ? (
              <div className="space-y-1">
                <span className="inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold bg-teal-50 border border-teal-200 text-teal-600 flex items-center gap-1 shadow-sm mt-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse"></span>
                  Pago Realizado
                </span>
                <p className="text-[10px] text-slate-400 font-semibold mt-1">Expediente al corriente</p>
              </div>
            ) : (
              <div className="space-y-1">
                <h3 className="text-2xl font-extrabold text-rose-500">${studentProfile.amount_due} <span className="text-xs text-slate-400 font-bold">MXN</span></h3>
                <span className="inline-flex px-2.5 py-0.5 rounded-full text-[9px] font-bold bg-rose-50 border border-rose-200 text-rose-600">
                  Pendiente de Pago
                </span>
              </div>
            )}
          </div>
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${
            isPaid ? "bg-teal-50 text-teal-600" : "bg-rose-50 text-rose-500"
          }`}>
            <span className="material-symbols-outlined text-2xl">credit_card</span>
          </div>
        </div>

        {/* Asistencia general */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Asistencia Promedio</p>
            <h2 className="text-3xl font-extrabold text-sky-600">{attendanceRate}%</h2>
            <p className="text-[10px] text-slate-400 font-medium">De clases evaluadas</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined text-2xl">done_all</span>
          </div>
        </div>

      </div>

      {/* Main Grid */}
      <div className="max-w-7xl mx-auto w-full px-6 md:px-12 pt-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Col Izq: Mis Clases y Enlaces de Meet */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <div>
                <h3 className="font-montserrat font-bold text-slate-800 text-sm">Mis Horarios y Aulas Virtuales</h3>
                <p className="text-xs text-slate-400 font-medium">Accede de forma directa a tus sesiones virtuales con tu docente.</p>
              </div>
              <span className="text-[10px] font-bold text-slate-400 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-full">
                {classes.length} Clases
              </span>
            </div>

            <div className="divide-y divide-slate-100">
              {classes.map((cls) => (
                <div key={cls.id} className="p-6 space-y-4 hover:bg-slate-50/30 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                          cls.type === "privada" ? "bg-purple-50 border-purple-200 text-purple-600" :
                          cls.type === "club" ? "bg-pink-50 border-pink-200 text-[#e74d8a]" :
                          "bg-sky-50 border-sky-200 text-sky-600"
                        }`}>
                          {cls.type === "privada" ? "Privada" : cls.type === "club" ? "Club Conversación" : "Grupal"}
                        </span>
                      </div>
                      <h4 className="font-montserrat font-bold text-slate-800 text-base">{cls.title}</h4>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-xs text-slate-400 font-semibold mt-1">
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-sm">calendar_today</span>
                          {cls.day} • {cls.time}
                        </span>
                        <span className="hidden sm:inline w-1 h-1 rounded-full bg-slate-300" />
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-sm">person</span>
                          Profesor: {cls.teacher}
                        </span>
                      </div>
                    </div>

                    {cls.meetLink && (
                      <a
                        href={cls.meetLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full sm:w-auto py-2.5 px-4 bg-gradient-to-r from-sky-500 to-sky-600 text-white rounded-xl text-xs font-bold hover:opacity-90 active:scale-95 transition-all text-center flex items-center justify-center gap-1.5 shadow-md shadow-sky-500/10 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-base">video_call</span>
                        <span>Ingresar a Meet</span>
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Registro Histórico de Asistencias */}
          <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50">
              <h3 className="font-montserrat font-bold text-slate-800 text-sm">Bitácora de Asistencias</h3>
              <p className="text-xs text-slate-400 font-medium">Seguimiento e historial de puntualidad y asistencia escolar.</p>
            </div>
            
            <div className="divide-y divide-slate-100">
              {attendanceRecords.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400 font-medium">
                  Aún no se registran asistencias evaluadas.
                </div>
              ) : (
                attendanceRecords.map((r, index) => (
                  <div key={index} className="p-4 flex justify-between items-center text-xs hover:bg-slate-50/20">
                    <div className="space-y-0.5">
                      <p className="font-bold text-slate-700">{r.title}</p>
                      <p className="text-[10px] text-slate-400 font-semibold">{r.day} • {r.time} • Prof. {r.teacher}</p>
                    </div>
                    <div>
                      {r.status === "presente" ? (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold border bg-teal-50 border-teal-200 text-teal-600 flex items-center gap-1 shadow-sm">
                          <span className="w-1.5 h-1.5 rounded-full bg-teal-500"></span>
                          Asistió
                        </span>
                      ) : r.status === "retardo" ? (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold border bg-amber-50 border-amber-200 text-amber-600 flex items-center gap-1 shadow-sm">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                          Retardo
                        </span>
                      ) : r.status === "falta" ? (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold border bg-rose-50 border-rose-200 text-rose-600 flex items-center gap-1 shadow-sm">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                          Falta
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold border bg-slate-100 border-slate-200 text-slate-500 flex items-center gap-1 shadow-sm">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                          Sin asignar
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

        {/* Col Der: Información Académica Detallada */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
            <h3 className="font-montserrat font-bold text-slate-800 text-sm border-b border-slate-100 pb-3">Detalle Académico</h3>
            
            <div className="space-y-4 text-xs font-medium">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Profesor Titular</span>
                <span className="text-slate-800 font-bold block">{studentProfile.teacher}</span>
              </div>
              
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Horario Agendado</span>
                <span className="text-slate-800 font-bold block">{studentProfile.schedule}</span>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Correo Escolar</span>
                <span className="text-slate-800 font-semibold block">{studentProfile.email}</span>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">ID Expediente</span>
                <span className="text-slate-500 font-mono block">{studentProfile.id}</span>
              </div>
            </div>
          </div>

          {/* Ayuda y Soporte */}
          <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-md space-y-3 border border-slate-800 text-xs">
            <h4 className="font-montserrat font-bold text-sm tracking-wide flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[#e74d8a]">support_agent</span>
              Centro de Atención
            </h4>
            <p className="text-slate-400 leading-relaxed font-semibold">¿Tienes alguna duda sobre tus horarios, facturas o necesitas reagendar una clase privada?</p>
            <div className="pt-2">
              <a
                href="https://wa.me/525500000000"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95"
              >
                <span className="material-symbols-outlined text-base">chat</span>
                Soporte por WhatsApp
              </a>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
