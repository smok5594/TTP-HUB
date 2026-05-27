"use client";

import React, { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";

const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const currentMonth = months[new Date().getMonth()];

function exportCSV(data, filename) {
  if (!data.length) return;
  const headers = Object.keys(data[0]).join(",");
  const rows = data.map(row => Object.values(row).join(",")).join("\n");
  const blob = new Blob([headers + "\n" + rows], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
}

function EmptyState({ icon, message }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
      <span className="material-symbols-outlined text-4xl opacity-30">{icon}</span>
      <p className="text-sm font-semibold">{message}</p>
    </div>
  );
}

export default function ReportsDashboard() {
  const [activeReport, setActiveReport] = useState("asistencia");
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);

  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [schedules, setSchedules] = useState([]);

  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem("ttp_students_local") || "[]");
      const t = JSON.parse(localStorage.getItem("ttp_teachers_local") || "[]");
      const sc = JSON.parse(localStorage.getItem("ttp_schedules_local") || "[]");
      setStudents(Array.isArray(s) ? s : []);
      setTeachers(Array.isArray(t) ? t : []);
      setSchedules(Array.isArray(sc) ? sc : []);
    } catch {
      setStudents([]);
      setTeachers([]);
      setSchedules([]);
    }
  }, []);

  // Build attendance rows from students + schedules
  const attendanceData = students.map((stu) => {
    const studentName = `${stu.firstName || stu.name || ""} ${stu.lastName || ""}`.trim();
    // Try to find a course assigned to this student
    const assigned = schedules.find(
      (sc) => sc.studentIds && sc.studentIds.includes(stu.id)
    );
    const course = assigned ? (assigned.subject || assigned.className || assigned.name || "—") : "—";
    return {
      student: studentName || stu.email || "Sin nombre",
      course,
      present: stu.present ?? 0,
      absent: stu.absent ?? 0,
      justified: stu.justified ?? 0,
      total: (stu.present ?? 0) + (stu.absent ?? 0) + (stu.justified ?? 0),
      pct: stu.attendancePct ?? 0,
    };
  });

  const avgAttendance = attendanceData.length
    ? Math.round(attendanceData.reduce((s, r) => s + r.pct, 0) / attendanceData.length)
    : 0;

  // Build teacher performance rows from teachers + schedules
  const teacherPerf = teachers.map((t) => {
    const name = `${t.firstName || t.name || ""} ${t.lastName || ""}`.trim() || t.email || "Sin nombre";
    const teacherClasses = schedules.filter(
      (sc) => sc.teacherId === t.id || sc.teacher === name
    );
    return {
      name,
      classes: teacherClasses.length,
      studentsAvg: t.studentsAvg ?? 0,
      rating: t.rating ?? "—",
      cancelations: t.cancelations ?? 0,
    };
  });

  // Financial data: empty by default (no mock data)
  const financialData = [];

  const reportTabs = [
    { id: "asistencia", label: "Asistencia", icon: "fact_check" },
    { id: "financiero", label: "Financiero", icon: "account_balance_wallet" },
    { id: "maestros", label: "Desempeño Maestros", icon: "person_4" },
  ];

  const summaryKpis = [
    {
      label: "Asistencia Prom.",
      value: attendanceData.length ? `${avgAttendance}%` : "—",
      icon: "fact_check",
      color: "text-teal-600 bg-teal-50",
    },
    {
      label: "Alumnos Registrados",
      value: students.length,
      icon: "school",
      color: "text-ttp-primary bg-ttp-primary/10",
    },
    {
      label: "Maestros Activos",
      value: teachers.length,
      icon: "person_4",
      color: "text-sky-600 bg-sky-50",
    },
    {
      label: "Clases Programadas",
      value: schedules.length,
      icon: "calendar_month",
      color: "text-amber-600 bg-amber-50",
    },
  ];

  return (
    <div className="flex min-h-screen bg-slate-50 font-inter">
      <Sidebar activeName="Reportes" />

      <main className="flex-1 md:ml-64 min-h-screen flex flex-col">
        <header className="flex justify-between items-center w-full px-6 md:px-10 h-16 sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200">
          <div>
            <h2 className="font-montserrat font-bold text-slate-800 text-lg">Reportes</h2>
            <p className="text-xs text-slate-400 font-medium">Análisis académico y operativo</p>
          </div>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-ttp-primary/20 bg-white"
          >
            {months.map(m => <option key={m}>{m} {new Date().getFullYear()}</option>)}
          </select>
        </header>

        <div className="p-6 md:p-10 max-w-7xl mx-auto w-full space-y-8">
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {summaryKpis.map((k) => (
              <div key={k.label} className="bg-white border border-slate-200/60 rounded-2xl p-5 flex items-center gap-4 shadow-sm">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${k.color}`}>
                  <span className="material-symbols-outlined text-xl">{k.icon}</span>
                </div>
                <div>
                  <p className="text-xl font-extrabold text-slate-800">{k.value}</p>
                  <p className="text-[11px] text-slate-400 font-semibold">{k.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div className="bg-white border border-slate-200/60 rounded-3xl shadow-sm overflow-hidden">
            <div className="flex border-b border-slate-100 bg-slate-50/50">
              {reportTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveReport(tab.id)}
                  className={`flex items-center gap-2 px-6 py-4 font-semibold text-sm transition-all relative ${activeReport === tab.id ? "text-ttp-primary font-bold" : "text-slate-500 hover:text-slate-800"}`}
                >
                  <span className="material-symbols-outlined text-lg">{tab.icon}</span>
                  {tab.label}
                  {activeReport === tab.id && <div className="absolute bottom-0 left-4 right-4 h-0.5 bg-ttp-primary rounded-full" />}
                </button>
              ))}
            </div>

            <div className="p-6">
              {/* Asistencia */}
              {activeReport === "asistencia" && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="font-montserrat font-bold text-slate-800">Reporte de Asistencia — {selectedMonth}</h3>
                    <button
                      onClick={() => exportCSV(attendanceData, `asistencia_${selectedMonth}.csv`)}
                      disabled={!attendanceData.length}
                      className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <span className="material-symbols-outlined text-base">download</span>
                      Exportar CSV
                    </button>
                  </div>

                  {attendanceData.length === 0 ? (
                    <EmptyState icon="fact_check" message="No hay alumnos registrados aún. Agrega alumnos en el módulo de Alumnos." />
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-100">
                            <th className="text-left py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Alumno</th>
                            <th className="text-left py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Curso</th>
                            <th className="text-center py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Presentes</th>
                            <th className="text-center py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Faltas</th>
                            <th className="text-center py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Justif.</th>
                            <th className="text-left py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider w-40">Asistencia</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {attendanceData.map((r) => (
                            <tr key={r.student} className="hover:bg-slate-50/50 transition-colors">
                              <td className="py-4 font-semibold text-slate-800">{r.student}</td>
                              <td className="py-4 text-xs text-slate-500 font-medium">{r.course}</td>
                              <td className="py-4 text-center font-bold text-teal-600">{r.present}</td>
                              <td className="py-4 text-center font-bold text-rose-500">{r.absent}</td>
                              <td className="py-4 text-center font-bold text-sky-500">{r.justified}</td>
                              <td className="py-4">
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                                    <div className={`h-full rounded-full transition-all ${r.pct >= 85 ? "bg-teal-500" : r.pct >= 60 ? "bg-amber-400" : "bg-rose-500"}`} style={{ width: `${r.pct}%` }} />
                                  </div>
                                  <span className={`text-xs font-extrabold w-9 text-right ${r.pct >= 85 ? "text-teal-600" : r.pct >= 60 ? "text-amber-600" : "text-rose-600"}`}>{r.pct}%</span>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Financiero */}
              {activeReport === "financiero" && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="font-montserrat font-bold text-slate-800">Reporte Financiero Mensual</h3>
                    <button
                      onClick={() => exportCSV(financialData, "reporte_financiero.csv")}
                      disabled={!financialData.length}
                      className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <span className="material-symbols-outlined text-base">download</span>
                      Exportar CSV
                    </button>
                  </div>
                  <EmptyState icon="account_balance_wallet" message="Los datos financieros se generarán conforme se registren pagos y cobros." />
                </div>
              )}

              {/* Maestros */}
              {activeReport === "maestros" && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="font-montserrat font-bold text-slate-800">Desempeño de Maestros — {selectedMonth}</h3>
                    <button
                      onClick={() => exportCSV(teacherPerf, `maestros_${selectedMonth}.csv`)}
                      disabled={!teacherPerf.length}
                      className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <span className="material-symbols-outlined text-base">download</span>
                      Exportar CSV
                    </button>
                  </div>
                  {teacherPerf.length === 0 ? (
                    <EmptyState icon="person_4" message="No hay maestros registrados aún. Agrega maestros en el módulo de Maestros." />
                  ) : (
                    <div className="space-y-4">
                      {teacherPerf.map((t) => (
                        <div key={t.name} className="bg-slate-50 rounded-2xl p-5 border border-slate-100 flex flex-col md:flex-row md:items-center gap-4">
                          <div className="flex items-center gap-3 flex-1">
                            <div className="w-10 h-10 rounded-xl bg-ttp-primary/10 text-ttp-primary font-extrabold font-montserrat flex items-center justify-center flex-shrink-0">
                              {t.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-bold text-slate-800 text-sm">{t.name}</p>
                              <p className="text-[10px] text-slate-400 font-medium">{t.classes} clases programadas</p>
                            </div>
                          </div>
                          <div className="flex gap-6 text-center">
                            <div>
                              <p className="text-lg font-extrabold text-slate-800">{t.studentsAvg}</p>
                              <p className="text-[10px] text-slate-400 font-semibold">Alumnos Prom.</p>
                            </div>
                            <div>
                              <p className="text-lg font-extrabold text-teal-600">{t.rating !== "—" ? `${t.rating} ⭐` : "—"}</p>
                              <p className="text-[10px] text-slate-400 font-semibold">Calificación</p>
                            </div>
                            <div>
                              <p className={`text-lg font-extrabold ${t.cancelations > 0 ? "text-amber-500" : "text-teal-600"}`}>{t.cancelations}</p>
                              <p className="text-[10px] text-slate-400 font-semibold">Cancelaciones</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
