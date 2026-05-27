"use client";

import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "@/utils/supabaseClient";

// ── Storage keys ────────────────────────────────────────────────────────────────
const S_KEY  = "ttp_students_local";
const T_KEY  = "ttp_teachers_local";
const MV_KEY = "ttp_movements_local";
const GR_KEY = "ttp_groups_local";
const UN_KEY = "ttp_unavailable_schedules";

// ── Default seed data ───────────────────────────────────────────────────────────
const DEFAULT_TEACHERS = [];
const DEFAULT_GROUPS = [];

// ── UI constants ────────────────────────────────────────────────────────────────
const CT_LABEL = { grupal: "Grupal", privada: "Privada", conversation_club: "Conv. Club" };
const CT_COLOR = {
  grupal:            "bg-sky-50 border-sky-200 text-sky-700",
  privada:           "bg-violet-50 border-violet-200 text-violet-700",
  conversation_club: "bg-teal-50 border-teal-200 text-teal-700",
};
const ST_COLOR = {
  active:    "bg-teal-50 border-teal-200 text-teal-600",
  moroso:    "bg-amber-50 border-amber-200 text-amber-600",
  inactive:  "bg-slate-100 border-slate-200 text-slate-500",
  suspended: "bg-rose-50 border-rose-200 text-rose-600",
  graduated: "bg-purple-50 border-purple-200 text-purple-600",
  prospect:  "bg-blue-50 border-blue-200 text-blue-600",
};
const ST_LABEL = { active: "Activo", moroso: "Moroso", inactive: "Inactivo", suspended: "Suspendido", graduated: "Egresado", prospect: "Prospecto" };

const TRANSFER_META = {
  course:     { label: "Curso",         field: "current_course", icon: "book_2",    color: "bg-sky-50 border-sky-200 text-sky-700"     },
  group:      { label: "Grupo",         field: "class_type",     icon: "groups",    color: "bg-violet-50 border-violet-200 text-violet-700" },
  teacher:    { label: "Maestro",       field: "teacher",        icon: "person_4",  color: "bg-pink-50 border-pink-200 text-pink-700"   },
  schedule:   { label: "Horario",       field: "schedule",       icon: "schedule",  color: "bg-amber-50 border-amber-200 text-amber-700"},
};

// ── localStorage helpers ─────────────────────────────────────────────────────────
const getLS  = (key, fb) => { try { const v = typeof window !== "undefined" && localStorage.getItem(key); return v ? JSON.parse(v) : fb; } catch { return fb; } };
const saveLS = (key, d)  => { if (typeof window !== "undefined") localStorage.setItem(key, JSON.stringify(d)); };

// ── Schedule conflict detection ──────────────────────────────────────────────────
function parseSchedule(str) {
  if (!str) return null;
  const DAYS = { lunes: 0, martes: 1, "miércoles": 2, miercoles: 2, jueves: 3, viernes: 4, "sábado": 5, sabado: 5, domingo: 6 };
  const lower = str.toLowerCase();
  const days  = Object.entries(DAYS).filter(([d]) => lower.includes(d)).map(([, i]) => i);
  const m     = str.match(/(\d{1,2}:\d{2})\s*[–\-]\s*(\d{1,2}:\d{2})/);
  if (!m || !days.length) return null;
  const toMin = t => { const [h, min] = t.split(":").map(Number); return h * 60 + min; };
  return { days, start: toMin(m[1]), end: toMin(m[2]) };
}
function hasConflict(a, b) {
  const pa = parseSchedule(a), pb = parseSchedule(b);
  if (!pa || !pb) return false;
  if (!pa.days.some(d => pb.days.includes(d))) return false;
  return !(pb.end <= pa.start || pb.start >= pa.end);
}

// ── Component ────────────────────────────────────────────────────────────────────
export default function AcademicManagement({ showToast }) {
  const [activeTab, setActiveTab]   = useState("resumen");
  const [students,  setStudents]    = useState([]);
  const [teachers,  setTeachers]    = useState([]);
  const [movements, setMovements]   = useState([]);
  const [groups,    setGroups]      = useState([]);
  const [unavail,   setUnavail]     = useState([]);
  const [settleConfirmModal, setSettleConfirmModal] = useState(null); // { teacherId: '', teacherName: '', onConfirm: fn }

  // Cursos tab
  const [courseTypeFilter, setCourseTypeFilter] = useState("all");
  const [expanded,         setExpanded]         = useState(null); // "teacher:t-1" | "group:g-1"

  // Horarios tab
  const [scheduleView, setScheduleView] = useState("en_uso");

  // Transfer modal  { open, step(1=student,2=value), type, student, newValue, selectedTeacher, search }
  const [tfr, setTfr] = useState({ open: false, step: 1, type: "course", student: null, newValue: "", selectedTeacher: "", search: "" });

  // Assign-to-group modal  { open, group, search, pendingStudent, conflictInfo }
  const [asgn, setAsgn] = useState({ open: false, group: null, search: "", pendingStudent: null, conflictInfo: null });

  // New-group modal
  const [ngModal, setNgModal] = useState({ open: false, title: "", level: "Intermediate", class_type: "grupal", teacher: "", schedule: "", capacity: 15 });

  useEffect(() => { 
    loadAll();
    
    // Sincronizar profesores desde Supabase en caliente
    const syncTeachersFromDB = async () => {
      try {
        const { data, error } = await supabase.from("teachers").select("*");
        if (error) throw error;
        if (data && data.length > 0) {
          const mapped = data.map(t => ({
            id: t.id,
            name: t.name,
            email: t.email || `${t.name.toLowerCase().replace(/\s/g, "")}@ttp.mx`,
            phone: t.phone || "+52 55 0000 0000",
            specialty: t.specialty || "Profesor de Inglés",
            rate: t.rate || 250,
            since: t.since || "Enero 2024",
            birthdate: t.birthdate || "",
            burlington_user: t.burlington_user || "",
            burlington_pass: t.burlington_pass || "",
            ttp_user: t.ttp_user || "",
            ttp_pass: t.ttp_pass || "",
            classes: t.classes || 0,
            students: t.students || 0,
            status: t.status === "active" ? "activo" : "suspendido"
          }));
          setTeachers(mapped);
          saveLS(T_KEY, mapped);
        }
      } catch (err) {
        console.log("Error sincronizando profesores en Gestión Académica:", err);
      }
    };
    syncTeachersFromDB();
  }, []);

  function loadAll() {
    setStudents(getLS(S_KEY, []));
    const t = getLS(T_KEY, null); if (!t) saveLS(T_KEY, DEFAULT_TEACHERS); setTeachers(t || DEFAULT_TEACHERS);
    setMovements(getLS(MV_KEY, []));
    const g = getLS(GR_KEY, null); if (!g) saveLS(GR_KEY, DEFAULT_GROUPS); setGroups(g || DEFAULT_GROUPS);
    setUnavail(getLS(UN_KEY, []));
  }

  // ── Derived ──────────────────────────────────────────────────────────────────
  const byTeacher = useMemo(() => {
    const m = {};
    students.forEach(s => {
      if (s.teacher) (m[s.teacher] = m[s.teacher] || []).push(s);
      (s.enrollments || []).forEach(e => {
        if (e.teacher && e.teacher !== s.teacher) (m[e.teacher] = m[e.teacher] || []).push(s);
      });
    });
    return m;
  }, [students]);
  const byCourse  = useMemo(() => {
    const m = {};
    students.forEach(s => {
      const key = s.current_course || s.current_group;
      if (key) (m[key] = m[key] || []).push(s);
      (s.enrollments || []).forEach(e => {
        const ek = e.course || e.group;
        if (ek && ek !== key) (m[ek] = m[ek] || []).push(s);
      });
    });
    return m;
  }, [students]);
  const allScheds = useMemo(() => [...new Set(students.map(s => s.schedule).filter(Boolean))], [students]);

  const getOptions = (type) => {
    switch (type) {
      case "course":     return groups.map(g => g.title);
      case "group":      return ["grupal", "privada", "conversation_club"];
      case "teacher":    return teachers.filter(t => t.status === "active" || t.status === "activo").map(t => t.name);
      case "schedule":   return [...new Set([...allScheds, ...groups.map(g => g.schedule).filter(Boolean)])];
      default: return [];
    }
  };

  // ── Sync academic changes to all modules ─────────────────────────────────────
  const syncAcademicChanges = async (student, changeType, toVal) => {
    if (typeof window === "undefined") return;

    // 1. Base de datos del alumno: Update Supabase
    try {
      const meta = TRANSFER_META[changeType];
      const updateData = {};
      if (meta && meta.field) {
        updateData[meta.field] = toVal;
      }
      if (student.current_course) updateData.current_course = student.current_course;
      if (student.current_group) updateData.current_group = student.current_group;
      if (student.schedule) updateData.schedule = student.schedule;
      if (student.teacher) updateData.teacher = student.teacher;
      if (student.class_type) updateData.class_type = student.class_type;
      if (student.amount_due !== undefined) {
        updateData.amount_due = student.amount_due;
        updateData.payment_status = student.payment_status || "pendiente";
      }
      if (student.enrollments) {
        updateData.enrollments = student.enrollments;
      }

      await supabase.from("students").update(updateData).eq("id", student.id);
    } catch (err) {
      console.log("Supabase update bypassed / offline.");
    }

    // 2. Horario, Asistencia, and Google Meet/Calendar Sync
    try {
      const storedAtt = localStorage.getItem("ttp_attendance_local");
      let att = storedAtt ? JSON.parse(storedAtt) : {};
      
      // Clean student from all existing classes in attendance dictionary to prevent duplicates/ghost students
      Object.keys(att).forEach(cId => {
        att[cId] = (att[cId] || []).filter(s => s.id !== student.id);
      });

      const storedClasses = localStorage.getItem("ttp_schedules_local");
      let classesList = storedClasses ? JSON.parse(storedClasses) : [];

      // Collect specs of all classes the student should be in
      const activeSpecs = [];
      if (student.teacher && student.schedule) {
        activeSpecs.push({
          teacher: student.teacher,
          schedule: student.schedule,
          title: student.current_group || student.current_course || "Clase de Inglés",
          modality: student.class_type || "grupal"
        });
      }

      // Add extra enrollments
      const enrolls = student.enrollments || [];
      enrolls.forEach(e => {
        if (e.teacher && e.schedule) {
          activeSpecs.push({
            teacher: e.teacher,
            schedule: e.schedule,
            title: e.group || e.course || "Clase de Inglés",
            modality: e.class_type || "grupal"
          });
        }
      });

      const getVisualDaysAndSlot = (schedStr) => {
        const DAYS_MAP = {
          lunes: "LUN",
          martes: "MAR",
          miercoles: "MIÉ",
          "miércoles": "MIÉ",
          jueves: "JUE",
          viernes: "VIE",
          sabado: "SÁB",
          "sábado": "SÁB"
        };
        const visualDays = [];
        const lower = (schedStr || "").toLowerCase();
        Object.entries(DAYS_MAP).forEach(([k, v]) => {
          if (lower.includes(k)) {
            if (!visualDays.includes(v)) visualDays.push(v);
          }
        });
        if (visualDays.length === 0) visualDays.push("LUN");

        let slot = "12:00";
        const timeMatch = lower.match(/(\d{1,2}):(\d{2})/);
        if (timeMatch) {
          const hour = parseInt(timeMatch[1], 10);
          if (hour < 10) slot = "08:00";
          else if (hour < 12) slot = "10:00";
          else slot = "12:00";
        }

        let timeStr = "12:00 - 13:30";
        const fullTimeMatch = schedStr ? schedStr.match(/(\d{1,2}:\d{2})\s*[–\-]\s*(\d{1,2}:\d{2})/) : null;
        if (fullTimeMatch) {
          timeStr = `${fullTimeMatch[1]} - ${fullTimeMatch[2]}`;
        }

        return { visualDays, slot, timeStr };
      };

      activeSpecs.forEach(spec => {
        const { visualDays, slot, timeStr } = getVisualDaysAndSlot(spec.schedule);
        
        visualDays.forEach(day => {
          const matchedClass = classesList.find(c => 
            c.teacher.toLowerCase().replace(/\s/g, "") === spec.teacher.toLowerCase().replace(/\s/g, "") && 
            c.day === day && 
            c.slot === slot
          );

          let classId;
          if (matchedClass) {
            classId = matchedClass.id;
          } else {
            classId = `c-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;
            const newClassObj = {
              id: classId,
              title: spec.title,
              day: day,
              time: timeStr,
              slot: slot,
              teacher: spec.teacher,
              capacity: 12,
              type: spec.modality === "privada" ? "privada" : spec.modality === "conversation_club" ? "club" : "grupal",
              paymentAlert: student.status === "moroso",
              meetLink: `https://meet.google.com/${Math.random().toString(36).substring(2, 5)}-${Math.random().toString(36).substring(2, 6)}-${Math.random().toString(36).substring(2, 5)}`,
              status: "scheduled",
              checkInTime: null
            };
            classesList.push(newClassObj);
          }

          att[classId] = att[classId] || [];
          if (!att[classId].some(s => s.id === student.id)) {
            att[classId].push({
              id: student.id,
              name: `${student.name} ${student.last_name || ""}`.trim(),
              email: student.email || `${student.name.toLowerCase()}@ttp.com`,
              status: "sin_asignar"
            });
          }
        });
      });

      localStorage.setItem("ttp_schedules_local", JSON.stringify(classesList));
      localStorage.setItem("ttp_attendance_local", JSON.stringify(att));
    } catch (err) {
      console.error("Error syncing schedules:", err);
    }
  };

  // ── Apply transfer ───────────────────────────────────────────────────────────
  const applyTransfer = () => {
    const { student, type, newValue, selectedTeacher } = tfr;
    if (!student || !newValue) return;
    const meta  = TRANSFER_META[type];
    const from  = student[meta.field] || "—";
    const all   = getLS(S_KEY, []);
    
    // Keep current_course and current_group always in sync
    let extra = {};
    if (type === "course") {
      extra = { current_group: newValue };
    } else if (type === "group") {
      extra = { teacher: selectedTeacher || student.teacher };
      // Find a matching group for this teacher and modality
      const match = groups.find(g => g.teacher === (selectedTeacher || student.teacher) && g.class_type === newValue);
      if (match) {
        extra.current_course = match.title;
        extra.current_group = match.title;
        extra.schedule = match.schedule;
      }

      // Calculate financial fee change
      let fee = 2450.00;
      if (newValue === "privada") fee = 3200.00;
      else if (newValue === "conversation_club") fee = 1500.00;
      
      extra.amount_due = fee;
      extra.payment_status = student.status === "moroso" ? "moroso" : "pendiente";
      
      // Sync transaction to ledger
      const storedTrans = localStorage.getItem("ttp_transactions_local");
      let transactions = storedTrans ? JSON.parse(storedTrans) : [];
      let category = newValue === "privada" ? "Tutoría Privada" : newValue === "conversation_club" ? "Inscripción" : "Colegiatura Mensual";
      
      const newTx = {
        id: `tx-${Date.now()}`,
        description: `Ajuste de Arancel (${newValue.toUpperCase()}) - ${student.name} ${student.last_name || ""}`.trim(),
        amount: fee,
        status: student.status === "moroso" ? "overdue" : "pending",
        category: category,
        date: new Date().toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })
      };
      transactions.unshift(newTx);
      localStorage.setItem("ttp_transactions_local", JSON.stringify(transactions));
    }
    
    const updatedStudent = { ...student, [meta.field]: newValue, ...extra };
    const upd   = all.map(s => s.id === student.id ? updatedStudent : s);
    saveLS(S_KEY, upd); setStudents(upd);

    const mv = {
      id: `mv-${Date.now()}`,
      date: new Date().toISOString().split("T")[0],
      time: new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }),
      studentId: student.id,
      studentName: `${student.name} ${student.last_name || ""}`.trim(),
      changeType: type,
      from, to: newValue,
      affectsFinancials: type === "group",
      syncStatus: { "Base de datos": true, "Horario": true, "Maestro": true, "Perfil alumno": true, "Finanzas": type === "group", "Calendario": true },
    };
    const allMvs = [mv, ...getLS(MV_KEY, [])];
    saveLS(MV_KEY, allMvs); setMovements(allMvs);
    setTfr({ open: false, step: 1, type: "course", student: null, newValue: "", selectedTeacher: "", search: "" });
    const displayVal = type === "group" ? CT_LABEL[newValue] : newValue;
    showToast?.(`✅ ${student.name}: ${meta.label} → "${displayVal}"`);
    
    // Call synchronizer
    syncAcademicChanges(updatedStudent, type, newValue);
  };

  // ── All enrollments for a student (primary + extras) ────────────────────────
  const allEnrollmentsOf = (s) => [
    ...(s.current_course || s.current_group
      ? [{ course: s.current_course || s.current_group, group: s.current_group || s.current_course, teacher: s.teacher, schedule: s.schedule, class_type: s.class_type }]
      : []),
    ...(s.enrollments || []),
  ];

  // Returns the first conflicting enrollment, or null
  const getConflict = (student, newSchedule) =>
    allEnrollmentsOf(student).find(e => hasConflict(e.schedule, newSchedule)) || null;

  // ── Apply assignment ─────────────────────────────────────────────────────────
  const applyAssignment = (student, force = false) => {
    const { group } = asgn;
    if (!student || !group) return;

    // Already in this group?
    const already = allEnrollmentsOf(student).some(e => e.course === group.title || e.group === group.title);
    if (already) { showToast?.("ℹ El alumno ya está inscrito en este grupo"); return; }

    // Conflict check (unless forced)
    if (!force) {
      const conflict = getConflict(student, group.schedule);
      if (conflict) {
        setAsgn(p => ({ ...p, pendingStudent: student, conflictInfo: conflict }));
        return;
      }
    }

    const newEnroll = { course: group.title, group: group.title, teacher: group.teacher, schedule: group.schedule, class_type: group.class_type };
    const all = getLS(S_KEY, []);
    const updatedStudent = { ...student, enrollments: [...(student.enrollments || []), newEnroll] };
    const upd = all.map(s => s.id === student.id ? updatedStudent : s);
    saveLS(S_KEY, upd); setStudents(upd);

    const mv = { id: `mv-${Date.now()}`, date: new Date().toISOString().split("T")[0], time: new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }), studentId: student.id, studentName: `${student.name} ${student.last_name || ""}`.trim(), changeType: "group", from: student.current_course || "—", to: group.title, affectsFinancials: false, syncStatus: { "Base de datos": true, "Horario": true, "Maestro": true, "Perfil alumno": true, "Finanzas": false, "Calendario": true } };
    const allMvs = [mv, ...getLS(MV_KEY, [])];
    saveLS(MV_KEY, allMvs); setMovements(allMvs);
    setAsgn({ open: false, group: null, search: "", pendingStudent: null, conflictInfo: null });
    showToast?.(`✅ ${student.name} inscrito en "${group.title}"`);
    
    // Call synchronizer
    syncAcademicChanges(updatedStudent, "group", group.title);
  };

  // ── Create group ─────────────────────────────────────────────────────────────
  const createGroup = () => {
    if (!ngModal.title.trim() || !ngModal.teacher.trim()) { showToast?.("❌ Completa nombre y maestro"); return; }
    const ng = { id: `g-${Date.now()}`, title: ngModal.title.trim(), level: ngModal.level, class_type: ngModal.class_type, teacher: ngModal.teacher.trim(), schedule: ngModal.schedule.trim(), capacity: Number(ngModal.capacity) || 15 };
    const upd = [...groups, ng]; saveLS(GR_KEY, upd); setGroups(upd);
    setNgModal({ open: false, title: "", level: "Intermediate", class_type: "grupal", teacher: "", schedule: "", capacity: 15 });
    showToast?.(`✅ Grupo "${ng.title}" creado`);
  };

  const handleSettleTeacherHours = (teacherId) => {
    const t = teachers.find(x => x.id === teacherId);
    const name = t ? t.name : "docente";
    setSettleConfirmModal({
      teacherId: teacherId,
      teacherName: name,
      onConfirm: () => {
        const upd = teachers.map(t => t.id === teacherId ? { ...t, completed_hours: 0 } : t);
        setTeachers(upd);
        saveLS(T_KEY, upd);
        showToast?.("💰 Pago liquidado de forma exitosa. Horas acumuladas restablecidas a 0.");
      }
    });
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // TAB CONTENT RENDERS
  // ─────────────────────────────────────────────────────────────────────────────

  // ── Tab: Resumen ─────────────────────────────────────────────────────────────
  const TabResumen = () => {
    const activeTch    = teachers.filter(t => t.status === "active" || t.status === "activo").length;
    const onLeaveTch   = teachers.filter(t => t.status === "on_leave" || t.status === "suspendido").length;
    const thisMonth    = new Date().toISOString().slice(0, 7);
    const mvThisMonth  = movements.filter(m => m.date?.startsWith(thisMonth)).length;
    const loads        = teachers.filter(t => t.status === "active" || t.status === "activo").map(t => (byTeacher[t.name]?.length || 0) / (t.max_students || 20) * 100);
    const avgLoad      = loads.length ? Math.round(loads.reduce((a, b) => a + b, 0) / loads.length) : 0;
    const byType       = { grupal: 0, privada: 0, conversation_club: 0 };
    students.forEach(s => { if (s.class_type && byType[s.class_type] !== undefined) byType[s.class_type]++; });

    return (
      <div className="space-y-6">
        {/* KPI row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Maestros Activos",  value: activeTch,         sub: `${onLeaveTch} en permiso`,            bar: "bg-ttp-primary", icon: "person_4"   },
            { label: "Grupos / Cursos",   value: groups.length,     sub: `${groups.filter(g => g.class_type === "grupal").length} grupales · ${groups.filter(g => g.class_type === "privada").length} privados`, bar: "bg-sky-500", icon: "school" },
            { label: "Carga Promedio",    value: `${avgLoad}%`,     sub: "de capacidad por maestro",            bar: "bg-violet-500",  icon: "analytics"  },
            { label: "Movimientos",       value: mvThisMonth,       sub: "registrados este mes",                bar: "bg-amber-400",   icon: "swap_horiz" },
          ].map(k => (
            <div key={k.label} className="bg-white border border-slate-200/60 rounded-2xl p-5 relative overflow-hidden">
              <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${k.bar}`} />
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{k.label}</p>
                  <p className="font-montserrat text-2xl font-extrabold text-slate-800">{k.value}</p>
                  <p className="text-[10px] text-slate-400 font-medium mt-1">{k.sub}</p>
                </div>
                <span className="material-symbols-outlined text-2xl text-slate-200">{k.icon}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Carga por maestro */}
          <div className="bg-white border border-slate-200/60 rounded-2xl p-5">
            <h4 className="font-montserrat font-bold text-slate-800 text-sm mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-ttp-primary text-base">analytics</span>
              Carga por Maestro
            </h4>
            <div className="space-y-3">
              {teachers.map(t => {
                const cnt = byTeacher[t.name]?.length || 0;
                const pct = Math.min(Math.round(cnt / (t.max_students || 20) * 100), 100);
                return (
                  <div key={t.id}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-semibold text-slate-700">{t.name}</span>
                      <span className="text-[10px] font-bold text-slate-400">{cnt} / {t.max_students} · {t.status === "on_leave" ? <span className="text-amber-500">En permiso</span> : `${pct}%`}</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${t.status === "on_leave" ? "bg-slate-300" : pct > 90 ? "bg-rose-400" : pct > 70 ? "bg-amber-400" : "bg-teal-400"}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Distribución por tipo */}
          <div className="bg-white border border-slate-200/60 rounded-2xl p-5">
            <h4 className="font-montserrat font-bold text-slate-800 text-sm mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-ttp-primary text-base">pie_chart</span>
              Alumnos por Tipo de Clase
            </h4>
            <div className="space-y-3">
              {Object.entries(byType).map(([type, cnt]) => {
                const pct = students.length ? Math.round(cnt / students.length * 100) : 0;
                return (
                  <div key={type} className={`flex items-center justify-between p-3 rounded-xl border ${CT_COLOR[type]}`}>
                    <span className="text-xs font-bold">{CT_LABEL[type]}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-montserrat text-lg font-extrabold">{cnt}</span>
                      <span className="text-[10px] font-semibold opacity-70">{pct}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Cupo por grupo — resumen */}
            <div className="mt-4 pt-4 border-t border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Cupo por grupo (top 4)</p>
              <div className="space-y-1.5">
                {groups.slice(0, 4).map(g => {
                  const cnt = byCourse[g.title]?.length || 0;
                  const pct = Math.min(Math.round(cnt / g.capacity * 100), 100);
                  return (
                    <div key={g.id} className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-600 font-medium w-32 truncate">{g.title}</span>
                      <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${pct >= 100 ? "bg-rose-400" : pct > 75 ? "bg-amber-400" : "bg-teal-400"}`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[10px] font-bold text-slate-400">{cnt}/{g.capacity}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Movimientos recientes */}
        <div className="bg-white border border-slate-200/60 rounded-2xl p-5">
          <h4 className="font-montserrat font-bold text-slate-800 text-sm mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-ttp-primary text-base">history</span>
            Movimientos Recientes
          </h4>
          {movements.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-6">Sin movimientos registrados aún</p>
          ) : (
            <div className="space-y-2">
              {movements.slice(0, 5).map(m => (
                <div key={m.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50">
                  <div className="w-7 h-7 rounded-lg bg-ttp-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined text-sm text-ttp-primary">swap_horiz</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-700 truncate">{m.studentName}</p>
                    <p className="text-[10px] text-slate-400 truncate">
                      {TRANSFER_META[m.changeType]?.label} · <span className="line-through">{m.from}</span> → <span className="font-semibold">{m.changeType === "group" ? CT_LABEL[m.to] : m.to}</span>
                    </p>
                  </div>
                  <span className="text-[9px] text-slate-300 flex-shrink-0">{m.date}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  // ── Tab: Maestros ─────────────────────────────────────────────────────────────
  const TabMaestros = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {teachers.map(t => {
          const assigned = byTeacher[t.name] || [];
          const cnt = assigned.length;
          const pct = Math.min(Math.round(cnt / (t.max_students || 20) * 100), 100);
          const key  = `teacher:${t.id}`;
          const open = expanded === key;

          return (
            <div key={t.id} className={`bg-white border rounded-2xl overflow-hidden transition-all ${t.status === "on_leave" ? "border-amber-200 opacity-75" : "border-slate-200/60"}`}>
              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-ttp-primary/10 text-ttp-primary font-extrabold flex items-center justify-center text-sm flex-shrink-0">
                      {t.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-bold text-slate-800 text-sm">{t.name}</p>
                      <p className="text-[11px] text-slate-400 font-medium">{t.specialty}</p>
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${(t.status === "active" || t.status === "activo") ? "bg-teal-50 border-teal-200 text-teal-600" : "bg-amber-50 border-amber-200 text-amber-600"}`}>
                    {(t.status === "active" || t.status === "activo") ? "Activo" : "En Permiso"}
                  </span>
                </div>

                {/* Class types */}
                <div className="flex flex-wrap gap-1 mb-3">
                  {(t.class_types || []).map(ct => (
                    <span key={ct} className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${CT_COLOR[ct]}`}>{CT_LABEL[ct]}</span>
                  ))}
                </div>

                {/* Load bar */}
                <div className="mb-3">
                  <div className="flex justify-between text-[10px] font-bold text-slate-400 mb-1">
                    <span>Carga de alumnos</span>
                    <span>{cnt} / {t.max_students} alumnos ({pct}%)</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${pct >= 100 ? "bg-rose-400" : pct > 75 ? "bg-amber-400" : "bg-teal-400"}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>

                {/* Completed Hours & Payments (Administrative Control) */}
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 mb-3 flex items-center justify-between text-xs">
                  <div className="space-y-0.5">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Horas Realizadas</span>
                    <span className="font-montserrat font-extrabold text-slate-800 text-xs flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm text-ttp-primary">schedule</span>
                      {Number(t.completed_hours || 0).toFixed(1)} hrs
                    </span>
                  </div>
                  <div className="text-right space-y-0.5">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Pago Estimado ($380/hr)</span>
                    <span className="font-montserrat font-bold text-teal-600 text-xs block">
                      ${Number((t.completed_hours || 0) * 380).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN
                    </span>
                  </div>
                  {(t.completed_hours || 0) > 0 && (
                    <button
                      onClick={() => handleSettleTeacherHours(t.id)}
                      className="ml-3 px-2.5 py-1 bg-teal-500 hover:bg-teal-650 text-white rounded-lg text-[9px] font-extrabold transition-all active:scale-95 flex items-center gap-0.5 cursor-pointer shadow-sm shadow-teal-500/10"
                    >
                      <span className="material-symbols-outlined text-[11px] font-bold">payments</span>
                      Pagar
                    </button>
                  )}
                </div>

                <button
                  onClick={() => setExpanded(open ? null : key)}
                  className="w-full text-[11px] font-bold text-ttp-primary flex items-center justify-center gap-1 py-1.5 hover:bg-pink-50/40 rounded-xl transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">{open ? "expand_less" : "expand_more"}</span>
                  {open ? "Ocultar alumnos" : `Ver ${cnt} alumno${cnt !== 1 ? "s" : ""} asignados`}
                </button>
              </div>

              {open && (
                <div className="border-t border-slate-100 divide-y divide-slate-50">
                  {assigned.length === 0
                    ? <p className="text-xs text-slate-400 text-center py-5">Sin alumnos asignados</p>
                    : assigned.map(s => (
                        <div key={s.id} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50/50">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-7 h-7 rounded-full bg-ttp-primary/10 text-ttp-primary font-bold flex items-center justify-center text-xs flex-shrink-0">{s.name.charAt(0)}</div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-800 truncate">{s.name} {s.last_name || ""}</p>
                              <p className="text-[10px] text-slate-400 truncate">{s.schedule || "Sin horario"} · {s.current_course || "—"}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border whitespace-nowrap ${ST_COLOR[s.status] || ST_COLOR.inactive}`}>
                              {ST_LABEL[s.status] || s.status}
                            </span>
                            <button
                              onClick={() => setTfr({ open: true, step: 2, type: "teacher", student: s, newValue: "", search: "" })}
                              title="Cambiar maestro"
                              className="p-1 text-slate-300 hover:text-ttp-primary rounded-lg hover:bg-pink-50 transition-colors"
                            >
                              <span className="material-symbols-outlined text-base">swap_horiz</span>
                            </button>
                          </div>
                        </div>
                      ))
                  }
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  // ── Tab: Cursos & Grupos ──────────────────────────────────────────────────────
  const TabCursos = () => {
    const filtered = courseTypeFilter === "all" ? groups : groups.filter(g => g.class_type === courseTypeFilter);

    return (
      <div className="space-y-4">
        {/* Filters row */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex gap-1.5 bg-slate-100 p-1 rounded-xl">
            {[
              { id: "all",             label: "Todos"            },
              { id: "grupal",          label: "Grupales"         },
              { id: "privada",         label: "Privados"         },
              { id: "conversation_club", label: "Conv. Club"     },
            ].map(f => (
              <button key={f.id} onClick={() => setCourseTypeFilter(f.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${courseTypeFilter === f.id ? "bg-white text-ttp-primary shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>
                {f.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setNgModal(p => ({ ...p, open: true }))}
            className="flex items-center gap-1.5 bg-ttp-primary text-white px-4 py-2 rounded-xl text-xs font-bold hover:opacity-90 active:scale-95 transition-all shadow-md shadow-pink-500/10"
          >
            <span className="material-symbols-outlined text-sm">add</span>
            Nuevo Grupo
          </button>
        </div>

        {/* Group cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map(group => {
            const groupStudents = byCourse[group.title] || [];
            const key   = `group:${group.id}`;
            const open  = expanded === key;
            const isFull = groupStudents.length >= group.capacity;
            const pct   = Math.min(Math.round(groupStudents.length / group.capacity * 100), 100);

            return (
              <div key={group.id} className="bg-white border border-slate-200/60 rounded-2xl overflow-hidden">
                <div className="p-5">
                  <div className="flex items-start justify-between mb-2 gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h4 className="font-montserrat font-bold text-slate-800 text-sm">{group.title}</h4>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${CT_COLOR[group.class_type]}`}>{CT_LABEL[group.class_type]}</span>
                        {group.level && <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">{group.level}</span>}
                      </div>
                      <p className="text-[11px] text-slate-400 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[11px]">person_4</span>{group.teacher || "—"}
                      </p>
                      {group.schedule && (
                        <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <span className="material-symbols-outlined text-[11px]">schedule</span>{group.schedule}
                        </p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={`font-montserrat font-extrabold text-sm ${isFull ? "text-rose-500" : "text-teal-600"}`}>{groupStudents.length}/{group.capacity}</p>
                      <p className="text-[9px] text-slate-400">alumnos</p>
                    </div>
                  </div>

                  {/* Capacity bar */}
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mb-3">
                    <div className={`h-full rounded-full transition-all ${isFull ? "bg-rose-400" : pct > 75 ? "bg-amber-400" : "bg-teal-400"}`} style={{ width: `${pct}%` }} />
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setExpanded(open ? null : key)}
                      className="flex-1 text-[11px] font-bold text-ttp-primary flex items-center justify-center gap-1 py-1.5 hover:bg-pink-50/40 rounded-xl transition-colors"
                    >
                      <span className="material-symbols-outlined text-sm">{open ? "expand_less" : "expand_more"}</span>
                      {open ? "Ocultar" : `${groupStudents.length} alumno${groupStudents.length !== 1 ? "s" : ""}`}
                    </button>
                    {!isFull && (
                      <button
                        onClick={() => setAsgn({ open: true, group, search: "" })}
                        className="flex items-center gap-1 px-3 py-1.5 bg-ttp-primary text-white rounded-xl text-[11px] font-bold hover:opacity-90 active:scale-95 transition-all"
                      >
                        <span className="material-symbols-outlined text-sm">person_add</span>
                        Asignar
                      </button>
                    )}
                  </div>
                </div>

                {open && (
                  <div className="border-t border-slate-100 divide-y divide-slate-50">
                    {groupStudents.length === 0
                      ? <p className="text-xs text-slate-400 text-center py-5">Sin alumnos en este grupo</p>
                      : groupStudents.map(s => (
                          <div key={s.id} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50/50">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-7 h-7 rounded-full bg-ttp-primary/10 text-ttp-primary font-bold flex items-center justify-center text-xs flex-shrink-0">{s.name.charAt(0)}</div>
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-slate-800 truncate">{s.name} {s.last_name || ""}</p>
                                <p className="text-[10px] text-slate-400 truncate">{s.teacher || "—"}</p>
                              </div>
                            </div>
                            {/* Quick-move buttons */}
                            <div className="flex items-center gap-0.5 flex-shrink-0 ml-2">
                              {[
                                { type: "course",     icon: "book_2",    title: "Cambiar curso"    },
                                { type: "group",      icon: "groups",    title: "Cambiar grupo"    },
                                { type: "teacher",    icon: "person_4",  title: "Cambiar maestro"  },
                                { type: "schedule",   icon: "schedule",  title: "Cambiar horario"  },
                              ].map(a => (
                                <button key={a.type}
                                  onClick={() => setTfr({ open: true, step: 2, type: a.type, student: s, newValue: "", search: "" })}
                                  title={a.title}
                                  className="p-1 text-slate-300 hover:text-ttp-primary rounded-lg hover:bg-pink-50 transition-colors"
                                >
                                  <span className="material-symbols-outlined text-[15px]">{a.icon}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        ))
                    }
                  </div>
                )}
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div className="col-span-2 text-center py-14 text-slate-400">
              <span className="material-symbols-outlined text-5xl">school</span>
              <p className="text-sm font-semibold mt-2">No hay grupos de este tipo</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ── Tab: Horarios ─────────────────────────────────────────────────────────────
  const TabHorarios = () => {
    const toggleUnavail = (sched) => {
      const upd = unavail.includes(sched) ? unavail.filter(s => s !== sched) : [...unavail, sched];
      setUnavail(upd); saveLS(UN_KEY, upd);
    };

    // Combine schedules from students + groups for a complete view
    const allGroupScheds = groups.map(g => g.schedule).filter(Boolean);
    const combined = [...new Set([...allScheds, ...allGroupScheds])];

    const schedInfo = (sched) => {
      const studentsIn = students.filter(s => s.schedule === sched);
      const groupsIn   = groups.filter(g => g.schedule === sched);
      const teacher    = studentsIn[0]?.teacher || groupsIn[0]?.teacher || "—";
      const classType  = studentsIn[0]?.class_type || groupsIn[0]?.class_type || "grupal";
      return { studentsIn, groupsIn, teacher, classType };
    };

    return (
      <div className="space-y-4">
        <div className="flex gap-2 bg-slate-100 p-1 rounded-xl w-fit">
          {[{ id: "en_uso", label: "En Uso" }, { id: "no_disponibles", label: "Deshabilitados" }].map(v => (
            <button key={v.id} onClick={() => setScheduleView(v.id)}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${scheduleView === v.id ? "bg-white text-ttp-primary shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>
              {v.label}
            </button>
          ))}
        </div>

        {scheduleView === "en_uso" ? (
          <div className="space-y-3">
            {combined.length === 0
              ? <p className="text-center text-slate-400 py-12 text-sm">No hay horarios registrados</p>
              : combined.map(sched => {
                  const { studentsIn, groupsIn, teacher, classType } = schedInfo(sched);
                  const isOff = unavail.includes(sched);
                  return (
                    <div key={sched} className={`bg-white border rounded-2xl p-5 transition-all ${isOff ? "opacity-50 border-rose-200 bg-rose-50/30" : "border-slate-200/60"}`}>
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 border ${isOff ? "bg-rose-50 border-rose-200" : "bg-sky-50 border-sky-200"}`}>
                            <span className={`material-symbols-outlined text-lg ${isOff ? "text-rose-400" : "text-sky-600"}`}>{isOff ? "event_busy" : "schedule"}</span>
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-800 text-sm">{sched}</p>
                            <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                              <span className="material-symbols-outlined text-[11px]">person_4</span>{teacher}
                            </p>
                            {groupsIn.length > 0 && (
                              <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                                <span className="material-symbols-outlined text-[11px]">school</span>
                                {groupsIn.map(g => g.title).join(", ")}
                              </p>
                            )}
                            {studentsIn.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {studentsIn.map(s => (
                                  <span key={s.id} className="text-[9px] font-semibold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-md">
                                    {s.name} {s.last_name || ""}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${CT_COLOR[classType]}`}>{CT_LABEL[classType]}</span>
                          <span className="text-[10px] font-bold text-slate-400">{studentsIn.length} alumno{studentsIn.length !== 1 ? "s" : ""}</span>
                          <button
                            onClick={() => toggleUnavail(sched)}
                            className={`text-[10px] font-bold px-3 py-1.5 rounded-xl border transition-colors whitespace-nowrap ${isOff ? "bg-teal-50 border-teal-200 text-teal-600 hover:bg-teal-100" : "bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100"}`}
                          >
                            {isOff ? "Habilitar" : "Deshabilitar"}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
            }
          </div>
        ) : (
          <div className="space-y-3">
            {unavail.length === 0
              ? <p className="text-center text-slate-400 py-12 text-sm">No hay horarios deshabilitados</p>
              : unavail.map(sched => (
                  <div key={sched} className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-rose-400 text-xl">event_busy</span>
                      <p className="font-semibold text-slate-700 text-sm">{sched}</p>
                    </div>
                    <button
                      onClick={() => { const upd = unavail.filter(s => s !== sched); setUnavail(upd); saveLS(UN_KEY, upd); }}
                      className="text-[11px] font-bold text-teal-600 border border-teal-200 bg-teal-50 hover:bg-teal-100 px-3 py-1.5 rounded-xl transition-colors whitespace-nowrap"
                    >
                      Volver a habilitar
                    </button>
                  </div>
                ))
            }
          </div>
        )}
      </div>
    );
  };

  // ── Tab: Movimientos ──────────────────────────────────────────────────────────
  const TabMovimientos = () => (
    <div className="space-y-6">
      {/* Action panel */}
      <div className="bg-white border border-slate-200/60 rounded-2xl p-5">
        <p className="font-montserrat font-bold text-slate-800 text-sm mb-1">Iniciar un Movimiento</p>
        <p className="text-xs text-slate-400 font-medium mb-4">Selecciona el tipo de cambio para mover a un alumno</p>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {Object.entries(TRANSFER_META).map(([type, meta]) => (
            <button key={type}
              onClick={() => setTfr({ open: true, step: 1, type, student: null, newValue: "", search: "" })}
              className={`flex flex-col items-center gap-2 p-4 rounded-2xl border font-bold text-xs transition-all hover:shadow-sm active:scale-95 ${meta.color}`}
            >
              <span className="material-symbols-outlined text-xl">{meta.icon}</span>
              {meta.label}
            </button>
          ))}
        </div>
      </div>

      {/* History */}
      <div className="bg-white border border-slate-200/60 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h4 className="font-montserrat font-bold text-slate-800 text-sm">Historial de Movimientos</h4>
          <span className="text-[10px] font-bold text-slate-400">{movements.length} registros</span>
        </div>
        {movements.length === 0 ? (
          <div className="text-center py-14">
            <span className="material-symbols-outlined text-5xl text-slate-200">swap_horiz</span>
            <p className="text-sm font-semibold text-slate-400 mt-2">Sin movimientos registrados</p>
            <p className="text-xs text-slate-400 mt-1">Los cambios académicos quedan registrados aquí automáticamente</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {movements.map(m => (
              <div key={m.id} className="px-6 py-4 flex items-start gap-4">
                <div className="w-8 h-8 rounded-xl bg-ttp-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="material-symbols-outlined text-sm text-ttp-primary">{TRANSFER_META[m.changeType]?.icon || "swap_horiz"}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <p className="font-bold text-slate-800 text-sm">{m.studentName}</p>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200 uppercase">
                      {TRANSFER_META[m.changeType]?.label || m.changeType}
                    </span>
                    {m.affectsFinancials && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200">Afecta facturación</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">
                    <span className="line-through text-slate-300">{m.from}</span>
                    <span className="mx-1.5 text-slate-300">→</span>
                    <span className="font-semibold text-slate-700">{m.changeType === "group" ? CT_LABEL[m.to] || m.to : m.to}</span>
                  </p>
                  {/* Sync status dots */}
                  {m.syncStatus && (
                    <div className="flex gap-2 mt-1.5 flex-wrap">
                      {Object.entries(m.syncStatus).map(([area, done]) => (
                        <span key={area} className={`text-[8px] font-bold flex items-center gap-0.5 ${done ? "text-teal-500" : "text-slate-300"}`}>
                          <span className="material-symbols-outlined text-[10px]">{done ? "check_circle" : "radio_button_unchecked"}</span>
                          {area}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-[10px] text-slate-400">{m.date}</p>
                  {m.time && <p className="text-[9px] text-slate-300">{m.time}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // MODALS
  // ─────────────────────────────────────────────────────────────────────────────

  const TransferModal = () => {
    if (!tfr.open) return null;
    const meta    = TRANSFER_META[tfr.type];
    const options = getOptions(tfr.type);
    const filteredStudents = students.filter(s => {
      const q = tfr.search.toLowerCase();
      return !q || s.name.toLowerCase().includes(q) || (s.last_name || "").toLowerCase().includes(q) || s.email.toLowerCase().includes(q);
    });

    return (
      <div className="modal-backdrop fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-slate-100 modal-card flex flex-col max-h-[88vh]">
          {/* Header */}
          <div className="p-5 bg-slate-50 border-b border-slate-100 flex justify-between items-center flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${meta.color}`}>
                <span className="material-symbols-outlined text-base">{meta.icon}</span>
              </div>
              <div>
                <p className="font-montserrat font-bold text-slate-800 text-sm">Cambiar {meta.label}</p>
                <p className="text-[11px] text-slate-400">{tfr.step === 1 ? "Paso 1: Selecciona el alumno" : `Paso 2: Selecciona el nuevo ${meta.label.toLowerCase()}`}</p>
              </div>
            </div>
            <button onClick={() => setTfr({ open: false, step: 1, type: "course", student: null, newValue: "", search: "" })}
              className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-200/50 rounded-full transition-colors">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          <div className="overflow-y-auto flex-1 p-5 space-y-3">
            {tfr.step === 1 ? (
              <>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
                  <input type="text" value={tfr.search} onChange={e => setTfr(p => ({ ...p, search: e.target.value }))}
                    placeholder="Buscar alumno..." autoFocus
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ttp-primary/10 focus:border-ttp-primary" />
                </div>
                {filteredStudents.length === 0
                  ? <p className="text-center text-slate-400 text-sm py-8">Sin resultados</p>
                  : filteredStudents.map(s => (
                      <button key={s.id} onClick={() => setTfr(p => ({ ...p, step: 2, student: s, search: "" }))}
                        className="w-full flex items-center gap-3 p-3 rounded-2xl border border-slate-200 hover:border-ttp-primary/30 hover:bg-pink-50/20 text-left transition-all">
                        <div className="w-8 h-8 rounded-full bg-ttp-primary/10 text-ttp-primary font-bold flex items-center justify-center text-xs flex-shrink-0">{s.name.charAt(0)}</div>
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-slate-800 text-sm truncate">{s.name} {s.last_name || ""}</p>
                          <p className="text-[11px] text-slate-400 truncate">
                            {meta.label} actual: <span className="font-semibold">{s[meta.field] ? (tfr.type === "class_type" ? CT_LABEL[s[meta.field]] : s[meta.field]) : "—"}</span>
                          </p>
                        </div>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border whitespace-nowrap flex-shrink-0 ${ST_COLOR[s.status] || ST_COLOR.inactive}`}>
                          {ST_LABEL[s.status] || s.status}
                        </span>
                      </button>
                    ))
                }
              </>
            ) : (
              <>
                {/* Selected student recap */}
                <div className={`flex items-center gap-3 p-3 rounded-2xl border ${meta.color}`}>
                  <div className="w-8 h-8 rounded-full bg-white/70 font-bold flex items-center justify-center text-xs flex-shrink-0">{tfr.student?.name?.charAt(0)}</div>
                  <div className="min-w-0">
                    <p className="font-bold text-sm">{tfr.student?.name} {tfr.student?.last_name || ""}</p>
                    <p className="text-[11px] opacity-70">Actual: {tfr.student?.[meta.field] ? (tfr.type === "group" ? CT_LABEL[tfr.student[meta.field]] : tfr.student[meta.field]) : "—"}</p>
                  </div>
                  <button onClick={() => setTfr(p => ({ ...p, step: 1, student: null, newValue: "", selectedTeacher: "" }))}
                    className="ml-auto text-xs font-bold opacity-60 hover:opacity-100 whitespace-nowrap">Cambiar</button>
                </div>

                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Selecciona el nuevo {meta.label.toLowerCase()}:</p>

                {options.map(opt => {
                  const label = tfr.type === "group" ? CT_LABEL[opt] || opt : opt;
                  const isCurrent = tfr.student?.[meta.field] === opt;
                  const isSelected = tfr.newValue === opt;
                  
                  // For group modality selection:
                  const showTeachers = tfr.type === "group" && isSelected;
                  const modalityTeachers = showTeachers 
                    ? teachers.filter(t => (t.status === "active" || t.status === "activo") && t.class_types.includes(opt))
                    : [];

                  return (
                    <div key={opt} className="space-y-2">
                      <button type="button" onClick={() => setTfr(p => ({ ...p, newValue: opt, selectedTeacher: "" }))}
                        className={`w-full text-left p-3 rounded-2xl border text-sm font-semibold transition-all ${
                          isCurrent ? "border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed" :
                          isSelected ? `${meta.color} shadow-sm border-ttp-primary` :
                          "border-slate-200 hover:border-ttp-primary/30 hover:bg-pink-50/20"
                        }`}
                        disabled={isCurrent}
                      >
                        <div className="flex items-center justify-between">
                          <span>{label}</span>
                          {isCurrent && <span className="text-[10px] text-slate-400">Actual</span>}
                          {isSelected && <span className="material-symbols-outlined text-sm">check_circle</span>}
                        </div>
                      </button>

                      {/* Deployed list of teachers */}
                      {showTeachers && (
                        <div className="pl-4 pr-1 py-1 space-y-1.5 border-l-2 border-ttp-primary/30 ml-4 animate-in slide-in-from-top-2 duration-150">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Selecciona el maestro para esta modalidad:</p>
                          {modalityTeachers.map(teacher => {
                            const assignedCount = (byTeacher[teacher.name] || []).length;
                            const capacity = teacher.max_students || 20;
                            const isTeacherSelected = tfr.selectedTeacher === teacher.name;
                            return (
                              <button
                                key={teacher.id}
                                type="button"
                                onClick={() => setTfr(p => ({ ...p, selectedTeacher: teacher.name }))}
                                className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-xs font-medium transition-all ${
                                  isTeacherSelected
                                    ? "bg-ttp-primary/10 border-ttp-primary/40 text-ttp-primary font-bold shadow-sm"
                                    : "bg-slate-50 hover:bg-slate-100/70 border-slate-200 text-slate-650"
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <div className="w-5 h-5 rounded-full bg-white font-bold flex items-center justify-center text-[10px] text-ttp-primary border border-ttp-primary/20">
                                    {teacher.name.charAt(0)}
                                  </div>
                                  <span>{teacher.name}</span>
                                </div>
                                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                                  assignedCount >= capacity ? "bg-rose-50 text-rose-500" : "bg-slate-200/50 text-slate-500"
                                }`}>
                                  {assignedCount} / {capacity} alumnos
                                </span>
                              </button>
                            );
                          })}
                          {modalityTeachers.length === 0 && (
                            <p className="text-xs text-slate-400 italic py-2">No hay maestros activos para esta modalidad</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {options.length === 0 && <p className="text-center text-slate-400 text-sm py-6">No hay opciones disponibles</p>}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="p-5 border-t border-slate-100 flex justify-end gap-3 flex-shrink-0">
            <button onClick={() => setTfr({ open: false, step: 1, type: "course", student: null, newValue: "", selectedTeacher: "", search: "" })}
              className="px-5 py-2 rounded-xl text-slate-500 hover:bg-slate-50 font-semibold text-sm transition-all">
              Cancelar
            </button>
            {tfr.step === 2 && tfr.newValue && (tfr.type !== "group" || tfr.selectedTeacher) && (
              <button onClick={applyTransfer}
                className="px-5 py-2 rounded-xl bg-ttp-primary text-white font-bold text-sm hover:opacity-90 active:scale-95 transition-all shadow-md">
                Confirmar Cambio
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  const AssignModal = () => {
    if (!asgn.open || !asgn.group) return null;
    const closeModal = () => setAsgn({ open: false, group: null, search: "", pendingStudent: null, conflictInfo: null });
    const allStudentsLS = getLS(S_KEY, []);
    const filtered = allStudentsLS.filter(s => {
      const q = asgn.search.toLowerCase();
      return !q || s.name.toLowerCase().includes(q) || (s.last_name || "").toLowerCase().includes(q) || s.email.toLowerCase().includes(q);
    });

    return (
      <div className="modal-backdrop fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-slate-100 modal-card flex flex-col max-h-[88vh]">

          {/* Header */}
          <div className="p-5 bg-slate-50 border-b border-slate-100 flex justify-between items-center flex-shrink-0">
            <div>
              <p className="font-montserrat font-bold text-slate-800 text-sm">Inscribir Alumno al Grupo</p>
              <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${CT_COLOR[asgn.group.class_type]}`}>{CT_LABEL[asgn.group.class_type]}</span>
                {asgn.group.title} · <span className="material-symbols-outlined text-[11px]">schedule</span>{asgn.group.schedule}
              </p>
            </div>
            <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-200/50 rounded-full transition-colors">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          {/* Conflict confirmation banner */}
          {asgn.pendingStudent && asgn.conflictInfo && (
            <div className="mx-5 mt-4 p-4 rounded-2xl bg-amber-50 border border-amber-200 flex-shrink-0">
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-amber-500 text-xl flex-shrink-0">warning</span>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-amber-800 text-sm">Conflicto de horario detectado</p>
                  <p className="text-[11px] text-amber-700 font-medium mt-0.5">
                    <span className="font-bold">{asgn.pendingStudent.name}</span> ya tiene clase en ese horario:
                  </p>
                  <div className="mt-2 bg-amber-100/60 rounded-xl p-2.5 space-y-0.5">
                    <p className="text-[11px] font-bold text-amber-800 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[11px]">book_2</span>
                      {asgn.conflictInfo.course || asgn.conflictInfo.group || "—"}
                    </p>
                    <p className="text-[10px] text-amber-700 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[10px]">person_4</span>
                      {asgn.conflictInfo.teacher || "—"}
                    </p>
                    <p className="text-[10px] text-amber-700 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[10px]">schedule</span>
                      {asgn.conflictInfo.schedule || "—"}
                    </p>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => setAsgn(p => ({ ...p, pendingStudent: null, conflictInfo: null }))}
                      className="px-3 py-1.5 rounded-xl text-amber-700 border border-amber-300 bg-white font-semibold text-xs hover:bg-amber-50 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => applyAssignment(asgn.pendingStudent, true)}
                      className="px-3 py-1.5 rounded-xl bg-amber-500 text-white font-bold text-xs hover:bg-amber-600 active:scale-95 transition-all flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-sm">warning</span>
                      Inscribir de todas formas
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Search */}
          <div className="px-5 pt-4 pb-1 flex-shrink-0">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
              <input type="text" value={asgn.search} onChange={e => setAsgn(p => ({ ...p, search: e.target.value }))}
                placeholder="Buscar alumno por nombre o email..." autoFocus
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ttp-primary/10 focus:border-ttp-primary" />
            </div>
          </div>

          {/* Student list */}
          <div className="overflow-y-auto flex-1 p-5 pt-2 space-y-2">
            {filtered.length === 0
              ? <p className="text-center text-slate-400 text-sm py-10">Sin resultados</p>
              : filtered.map(s => {
                  const enrollments = allEnrollmentsOf(s);
                  const already     = enrollments.some(e => e.course === asgn.group.title || e.group === asgn.group.title);
                  const conflict    = !already ? getConflict(s, asgn.group.schedule) : null;
                  const isPending   = asgn.pendingStudent?.id === s.id;

                  return (
                    <div key={s.id} className={`rounded-2xl border transition-colors ${
                      already    ? "bg-teal-50/50 border-teal-200/60"
                      : conflict ? "bg-amber-50/40 border-amber-200/70"
                      : "bg-slate-50/50 border-slate-200/60 hover:border-ttp-primary/20 hover:bg-pink-50/20"
                    }`}>
                      <div className="flex items-center justify-between p-3 gap-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-8 h-8 rounded-full font-bold flex items-center justify-center text-xs flex-shrink-0 ${conflict ? "bg-amber-100 text-amber-700" : "bg-ttp-primary/10 text-ttp-primary"}`}>
                            {s.name.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="font-bold text-slate-800 text-sm">{s.name} {s.last_name || ""}</p>
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border whitespace-nowrap ${ST_COLOR[s.status] || ST_COLOR.inactive}`}>
                                {ST_LABEL[s.status] || s.status}
                              </span>
                            </div>
                            {/* Current enrollments */}
                            <div className="flex flex-wrap gap-1 mt-0.5">
                              {enrollments.map((e, i) => (
                                <span key={i} className="text-[9px] font-semibold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                                  <span className="material-symbols-outlined text-[9px]">circle</span>
                                  {e.course || e.group}
                                </span>
                              ))}
                              {enrollments.length === 0 && <span className="text-[10px] text-slate-400">Sin clases asignadas</span>}
                            </div>
                          </div>
                        </div>
                        <div className="flex-shrink-0 ml-1">
                          {already ? (
                            <span className="text-[10px] font-bold text-teal-600 flex items-center gap-0.5 whitespace-nowrap">
                              <span className="material-symbols-outlined text-sm">check_circle</span>Ya inscrito
                            </span>
                          ) : conflict ? (
                            <button
                              onClick={() => applyAssignment(s)}
                              className={`text-[11px] font-bold px-3 py-1.5 rounded-xl border border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100 active:scale-95 transition-all whitespace-nowrap flex items-center gap-1 ${isPending ? "ring-2 ring-amber-400" : ""}`}
                            >
                              <span className="material-symbols-outlined text-sm">warning</span>
                              Inscribir
                            </button>
                          ) : (
                            <button
                              onClick={() => applyAssignment(s)}
                              className="text-[11px] font-bold bg-ttp-primary text-white px-3 py-1.5 rounded-xl hover:opacity-90 active:scale-95 transition-all whitespace-nowrap"
                            >
                              Inscribir
                            </button>
                          )}
                        </div>
                      </div>
                      {/* Inline conflict detail */}
                      {conflict && !already && (
                        <div className="px-3 pb-3">
                          <div className="bg-amber-100/60 border border-amber-200/60 rounded-xl p-2 text-[10px] text-amber-700 font-medium flex items-start gap-1.5">
                            <span className="material-symbols-outlined text-[12px] flex-shrink-0 mt-0.5">warning</span>
                            <span>
                              Choca con <span className="font-bold">{conflict.course || conflict.group}</span>
                              {conflict.teacher ? <> · <span className="font-bold">{conflict.teacher}</span></> : ""}
                              {conflict.schedule ? <> · {conflict.schedule}</> : ""}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
            }
          </div>
        </div>
      </div>
    );
  };

  const NewGroupModal = () => {
    if (!ngModal.open) return null;
    return (
      <div className="modal-backdrop fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-slate-100 modal-card">
          <div className="p-5 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
            <p className="font-montserrat font-bold text-slate-800 text-sm flex items-center gap-2">
              <span className="material-symbols-outlined text-ttp-primary">add_circle</span>
              Crear Nuevo Grupo
            </p>
            <button onClick={() => setNgModal(p => ({ ...p, open: false }))}
              className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-200/50 rounded-full transition-colors">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
          <div className="p-5 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Nombre del Grupo *</label>
                <input value={ngModal.title} onChange={e => setNgModal(p => ({ ...p, title: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ttp-primary/10 focus:border-ttp-primary"
                  placeholder="Ej. English B2 Avanzado" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Tipo de Clase</label>
                <select value={ngModal.class_type} onChange={e => setNgModal(p => ({ ...p, class_type: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-medium bg-white focus:outline-none focus:ring-2 focus:ring-ttp-primary/10 focus:border-ttp-primary">
                  <option value="grupal">Grupal</option>
                  <option value="privada">Privada</option>
                  <option value="conversation_club">Conversation Club</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Nivel</label>
                <input value={ngModal.level} onChange={e => setNgModal(p => ({ ...p, level: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ttp-primary/10 focus:border-ttp-primary"
                  placeholder="Ej. Intermediate" />
              </div>
              <div className="col-span-2">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Maestro Asignado *</label>
                <select value={ngModal.teacher} onChange={e => setNgModal(p => ({ ...p, teacher: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-medium bg-white focus:outline-none focus:ring-2 focus:ring-ttp-primary/10 focus:border-ttp-primary">
                  <option value="">— Seleccionar maestro —</option>
                  {teachers.filter(t => t.status === "active" || t.status === "activo").map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Horario</label>
                <input value={ngModal.schedule} onChange={e => setNgModal(p => ({ ...p, schedule: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ttp-primary/10 focus:border-ttp-primary"
                  placeholder="Ej. Lunes y Miércoles 18:00–19:30" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Capacidad</label>
                <input type="number" min="1" max="50" value={ngModal.capacity} onChange={e => setNgModal(p => ({ ...p, capacity: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ttp-primary/10 focus:border-ttp-primary" />
              </div>
            </div>
            <div className="pt-2 flex justify-end gap-3 border-t border-slate-100">
              <button onClick={() => setNgModal(p => ({ ...p, open: false }))}
                className="px-5 py-2 rounded-xl text-slate-500 hover:bg-slate-50 font-semibold text-sm transition-all">Cancelar</button>
              <button onClick={createGroup}
                className="px-5 py-2 rounded-xl bg-ttp-primary text-white font-bold text-sm hover:opacity-90 active:scale-95 transition-all shadow-md">Crear Grupo</button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // MAIN RENDER
  // ─────────────────────────────────────────────────────────────────────────────
  const tabs = [
    { id: "resumen",     label: "Resumen",        icon: "dashboard"   },
    { id: "maestros",    label: "Maestros",        icon: "person_4"    },
    { id: "cursos",      label: "Cursos & Grupos", icon: "school"      },
    { id: "horarios",    label: "Horarios",        icon: "schedule"    },
    { id: "movimientos", label: "Movimientos",     icon: "swap_horiz"  },
  ];

  return (
    <div className="space-y-6">
      {/* Sub-tab navigation */}
      <div className="bg-white border border-slate-200/60 rounded-2xl p-1.5 flex gap-1 overflow-x-auto">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex-shrink-0 ${
              activeTab === tab.id ? "bg-ttp-primary text-white shadow-md shadow-pink-500/20" : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
            }`}>
            <span className="material-symbols-outlined text-sm">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "resumen"     && <TabResumen />}
      {activeTab === "maestros"    && <TabMaestros />}
      {activeTab === "cursos"      && <TabCursos />}
      {activeTab === "horarios"    && <TabHorarios />}
      {activeTab === "movimientos" && <TabMovimientos />}

      {/* Modals */}
      <TransferModal />
      <AssignModal />
      <NewGroupModal />
      
      {/* ===== GORGEOUS SETTLE CONFIRM MODAL ===== */}
      {settleConfirmModal && (
        <div 
          className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setSettleConfirmModal(null); }}
        >
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-7 border border-slate-100 modal-card space-y-5 text-center">
            <div className="w-14 h-14 rounded-2xl bg-teal-50 mx-auto flex items-center justify-center">
              <span className="material-symbols-outlined text-2xl text-teal-600 font-bold">payments</span>
            </div>
            <div>
              <h3 className="font-montserrat font-bold text-slate-800 text-lg">¿Liquidar Horas?</h3>
              <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                ¿Deseas liquidar las horas acumuladas de <strong className="text-slate-700 font-semibold">{settleConfirmModal.teacherName}</strong> y registrar su pago? Su contador de horas volverá a 0.
              </p>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => setSettleConfirmModal(null)} 
                className="flex-1 py-2.5 border border-slate-200 text-slate-500 rounded-xl font-semibold text-xs hover:bg-slate-50 active:scale-95 transition-all"
              >
                Cancelar
              </button>
              <button 
                onClick={() => {
                  settleConfirmModal.onConfirm();
                  setSettleConfirmModal(null);
                }} 
                className="flex-1 py-2.5 bg-teal-650 hover:bg-teal-700 text-white rounded-xl font-bold text-xs active:scale-95 transition-all shadow-md shadow-teal-650/10"
              >
                Sí, Liquidar Pago
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
