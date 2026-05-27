"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const teacherNavGroups = [
  {
    label: "Enseñanza",
    items: [
      { name: "Mi Agenda y Clases", icon: "calendar_today", id: "agenda" },
      { name: "Mis Estudiantes", icon: "group", id: "alumnos" },
    ],
  },
  {
    label: "Seguimiento",
    items: [
      { name: "Ausencias y Bitácora", icon: "verified_user", id: "justificaciones" },
      { name: "Seguimiento Humano", icon: "volunteer_activism", id: "logros" },
    ],
  },
];

export default function TeacherPortal() {
  const router = useRouter();
  const [teacherSession, setTeacherSession] = useState(null);
  const [teacherProfile, setTeacherProfile] = useState(null);
  const [classes, setClasses] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [students, setStudents] = useState([]);
  const [activeTab, setActiveTab] = useState("agenda"); // agenda, alumnos, justificaciones, logros
  
  // Estados para nuevas interacciones del docente
  const [toastMessage, setToastMessage] = useState(null);
  const [feedbacks, setFeedbacks] = useState({}); // classId -> text
  const [savedFeedbacks, setSavedFeedbacks] = useState({}); // classId -> array of past feedbacks
  const [justifications, setJustifications] = useState({}); // studentId-classId -> text
  const [followupsChecked, setFollowupsChecked] = useState({}); // id -> bool

  useEffect(() => {
    if (typeof window === "undefined") return;

    // 1. Validar la sesión activa
    const session = localStorage.getItem("ttp_user_session");
    if (!session) {
      router.push("/login");
      return;
    }

    try {
      const parsedSession = JSON.parse(session);
      if (parsedSession.role !== "teacher") {
        router.push("/login");
        return;
      }
      setTeacherSession(parsedSession);

      // 2. Cargar perfil del maestro en vivo desde ttp_teachers_local
      const storedTeachers = localStorage.getItem("ttp_teachers_local");
      let teachersList = [];
      if (storedTeachers) {
        try {
          teachersList = JSON.parse(storedTeachers);
          // Autocuración: Si los docentes no tienen correos, se los asignamos dinámicamente
          teachersList = teachersList.map(t => {
            if (!t.email) {
              const lowerName = t.name.toLowerCase();
              if (lowerName.includes("elena")) t.email = "e.valdez@ttp.mx";
              else if (lowerName.includes("wilson") || lowerName.includes("james")) t.email = "m.johnson@ttp.mx";
              else if (lowerName.includes("parker") || lowerName.includes("carmen") || lowerName.includes("sarah")) t.email = "c.rios@ttp.mx";
              else if (lowerName.includes("brown") || lowerName.includes("robert") || lowerName.includes("salas")) t.email = "r.salas@ttp.mx";
              else t.email = `${t.name.toLowerCase().replace(/[^a-z]/g, "")}@ttp.mx`;
            }
            return t;
          });
          localStorage.setItem("ttp_teachers_local", JSON.stringify(teachersList));
        } catch (e) {}
      } else {
        teachersList = [];
        localStorage.setItem("ttp_teachers_local", JSON.stringify(teachersList));
      }

      const matched = teachersList.find(
        (t) => t.email && t.email.toLowerCase() === parsedSession.email.toLowerCase()
      );
      if (matched) {
        setTeacherProfile(matched);
      } else {
        const newProf = {
          id: `t-${Date.now()}`,
          name: parsedSession.name,
          email: parsedSession.email,
          specialty: "English Specialist",
          rate: 380,
          hoursCompleted: 0,
          status: "activo",
          since: "Mayo 2026"
        };
        teachersList.push(newProf);
        localStorage.setItem("ttp_teachers_local", JSON.stringify(teachersList));
        setTeacherProfile(newProf);
      }

      // 3. Cargar las clases agendadas de este docente
      const storedClasses = localStorage.getItem("ttp_schedules_local");
      let classesList = [];
      if (storedClasses) {
        classesList = JSON.parse(storedClasses);
      } else {
        classesList = [
          { id: "c1", title: "English A2 - Elementary", day: "LUN", time: "08:00 - 09:30", slot: "08:00", teacher: parsedSession.name, capacity: 12, type: "grupal", status: "scheduled", checkInTime: null, meetLink: "https://meet.google.com/abc-defg-hij" },
          { id: "c2", title: "Club de Conversación B2", day: "MIÉ", time: "10:00 - 11:30", slot: "10:00", teacher: parsedSession.name, capacity: 12, type: "club", status: "scheduled", checkInTime: null, meetLink: "https://meet.google.com/xyz-qprs-tuv" },
          { id: "c3", title: "Business Writing C1", day: "VIE", time: "12:00 - 13:30", slot: "12:00", teacher: parsedSession.name, capacity: 12, type: "privada", status: "scheduled", checkInTime: null, meetLink: "https://meet.google.com/lmn-opqr-stu" }
        ];
        localStorage.setItem("ttp_schedules_local", JSON.stringify(classesList));
      }

      const teacherNameLower = parsedSession.name.toLowerCase();
      const matchedClasses = classesList.filter(c => 
        c.teacher.toLowerCase().includes(teacherNameLower) || 
        teacherNameLower.includes(c.teacher.toLowerCase())
      );
      setClasses(matchedClasses);

      // 4. Cargar alumnos y asistencia
      const storedAtt = localStorage.getItem("ttp_attendance_local");
      let attMap = storedAtt ? JSON.parse(storedAtt) : {};
      
      // Asegurar semillas de asistencia si está vacía la clase
      matchedClasses.forEach(c => {
        if (!attMap[c.id]) {
          attMap[c.id] = [
            { id: "s1", name: "Elena Rodríguez", email: "elena.rod@email.com", status: "sin_asignar" },
            { id: "s2", name: "Carlos Méndez", email: "c.mendez@mail.es", status: "sin_asignar" },
            { id: "s4", name: "Lucía Ferreyra", email: "lucia.f@provider.com", status: "sin_asignar" }
          ];
        }
      });
      localStorage.setItem("ttp_attendance_local", JSON.stringify(attMap));
      setAttendance(attMap);

      // 5. Cargar alumnos del docente de forma consolidada
      const storedStudents = localStorage.getItem("ttp_students_local");
      let studentsList = [];
      if (storedStudents) {
        studentsList = JSON.parse(storedStudents);
      } else {
        studentsList = [
          { id: "s1", name: "Elena Rodríguez", email: "elena.rod@email.com", current_course: "English Mastery Program", teacher: parsedSession.name, schedule: "Lunes y Miércoles 08:00 - 09:30", status: "activo", payment_status: "al_corriente" },
          { id: "s2", name: "Carlos Méndez", email: "c.mendez@mail.es", current_course: "Business English Elite", teacher: parsedSession.name, schedule: "Martes y Jueves 12:00 - 13:30", status: "activo", payment_status: "moroso" },
          { id: "s4", name: "Lucía Ferreyra", email: "lucia.f@provider.com", current_course: "Business English", teacher: parsedSession.name, schedule: "Martes y Jueves 09:00 - 10:00", status: "activo", payment_status: "al_corriente" }
        ];
        localStorage.setItem("ttp_students_local", JSON.stringify(studentsList));
      }

      // Encontrar alumnos asignados a las clases de este profesor
      const studentIdsInClasses = new Set();
      matchedClasses.forEach(c => {
        (attMap[c.id] || []).forEach(s => studentIdsInClasses.add(s.id));
      });

      // Filtrar y adjuntar el payment_status en caliente para alertas (sin saldos financieros)
      const matchedStudents = studentsList.filter(s => studentIdsInClasses.has(s.id) || s.teacher.toLowerCase().includes(teacherNameLower));
      setStudents(matchedStudents);

      // 6. Cargar bitácoras de feedback, justificaciones y seguimientos
      const storedFeedbacks = localStorage.getItem("ttp_class_feedback_local");
      if (storedFeedbacks) setSavedFeedbacks(JSON.parse(storedFeedbacks));

      const storedJustifications = localStorage.getItem("ttp_justifications_local");
      if (storedJustifications) setJustifications(JSON.parse(storedJustifications));

      const storedFollowups = localStorage.getItem("ttp_followups_checked_local");
      if (storedFollowups) setFollowupsChecked(JSON.parse(storedFollowups));

    } catch (e) {
      router.push("/login");
    }
  }, [router]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleLogout = () => {
    localStorage.removeItem("ttp_user_session");
    router.push("/login");
  };

  // ----- OPERACIONES DE CHECK-IN / CHECK-OUT -----
  const handleCheckIn = (classId) => {
    const now = new Date();
    const timeString = now.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false });
    
    const storedClasses = localStorage.getItem("ttp_schedules_local");
    if (!storedClasses) return;

    try {
      const list = JSON.parse(storedClasses);
      const updated = list.map((c) => {
        if (c.id === classId) {
          return { ...c, status: "in_progress", checkInTime: timeString };
        }
        return c;
      });
      localStorage.setItem("ttp_schedules_local", JSON.stringify(updated));
      setClasses(updated.filter(c => c.teacher.toLowerCase().includes(teacherSession.name.toLowerCase())));
      showToast(`🔑 Check-In registrado exitosamente a las ${timeString}. ¡Buena clase!`);
    } catch (e) {}
  };

  const handleCheckOut = (cObj) => {
    const classId = cObj.id;
    const now = new Date();
    const checkOutString = now.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false });

    const baseDuration = getClassDuration(cObj.time);
    let deduction = 0;
    
    if (cObj.checkInTime && cObj.time) {
      try {
        const scheduledStartStr = cObj.time.split("-")[0].trim();
        const [schH, schM] = scheduledStartStr.split(":").map(Number);
        const [actH, actM] = cObj.checkInTime.split(":").map(Number);
        const delay = (actH * 60 + actM) - (schH * 60 + schM);
        if (delay > 10) {
          deduction = Number((delay / 60).toFixed(2));
        }
      } catch (err) {}
    }

    let finalHours = baseDuration - deduction;
    if (finalHours < 0) finalHours = 0;

    const storedClasses = localStorage.getItem("ttp_schedules_local");
    if (!storedClasses) return;

    try {
      const list = JSON.parse(storedClasses);
      const updated = list.map((c) => {
        if (c.id === classId) {
          return { ...c, status: "completed" };
        }
        return c;
      });
      localStorage.setItem("ttp_schedules_local", JSON.stringify(updated));
      setClasses(updated.filter(c => c.teacher.toLowerCase().includes(teacherSession.name.toLowerCase())));

      // Acreditar nómina
      updateTeacherHoursRecord(finalHours, deduction);
    } catch (e) {}
  };

  const updateTeacherHoursRecord = (hoursToAdd, deduction) => {
    const storedTeachers = localStorage.getItem("ttp_teachers_local");
    if (!storedTeachers) return;

    try {
      const list = JSON.parse(storedTeachers);
      const updated = list.map((t) => {
        if (t.email.toLowerCase() === teacherSession.email.toLowerCase()) {
          const currentHours = t.hoursCompleted || 0;
          const nextHours = Number((currentHours + hoursToAdd).toFixed(2));
          const updatedProf = { ...t, hoursCompleted: nextHours };
          setTeacherProfile(updatedProf);
          return updatedProf;
        }
        return t;
      });
      localStorage.setItem("ttp_teachers_local", JSON.stringify(updated));

      if (deduction > 0) {
        showToast(`⏹️ Check-Out. Se acreditaron ${hoursToAdd} hrs (-${deduction} hrs por retraso superior a 10 min).`);
      } else {
        showToast(`⏹️ Check-Out exitoso. Se acreditaron ${hoursToAdd} hrs de enseñanza.`);
      }
    } catch (e) {}
  };

  const getClassDuration = (timeStr) => {
    if (!timeStr) return 1.5;
    try {
      const match = timeStr.match(/(\d{1,2}):(\d{2})\s*[–\-]\s*(\d{1,2}):(\d{2})/);
      if (!match) return 1.5;
      const mins1 = parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
      const mins2 = parseInt(match[3], 10) * 60 + parseInt(match[4], 10);
      const diff = mins2 - mins1;
      return diff > 0 ? Number((diff / 60).toFixed(2)) : 1.5;
    } catch (e) { return 1.5; }
  };

  // ----- PASE DE ASISTENCIA INTERACTIVO -----
  const handleMarkAttendance = (classId, studentId, newStatus) => {
    const updatedAtt = { ...attendance };
    const classRoster = updatedAtt[classId] || [];
    
    updatedAtt[classId] = classRoster.map(s => {
      if (s.id === studentId) {
        return { ...s, status: newStatus };
      }
      return s;
    });

    setAttendance(updatedAtt);
    localStorage.setItem("ttp_attendance_local", JSON.stringify(updatedAtt));
    
    const sObj = classRoster.find(s => s.id === studentId);
    showToast(`✅ Asistencia de ${sObj?.name || "Alumno"} guardada como '${newStatus.toUpperCase()}'`);
  };

  // ----- BITÁCORA DE FEEDBACK DIARIO -----
  const handleSaveFeedback = (classId) => {
    const text = feedbacks[classId];
    if (!text || !text.trim()) return;

    const dateStr = new Date().toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" });
    const newFeedbackObj = {
      date: dateStr,
      content: text.trim()
    };

    const updatedFeedbacks = { ...savedFeedbacks };
    if (!updatedFeedbacks[classId]) updatedFeedbacks[classId] = [];
    updatedFeedbacks[classId] = [newFeedbackObj, ...updatedFeedbacks[classId]];

    setSavedFeedbacks(updatedFeedbacks);
    localStorage.setItem("ttp_class_feedback_local", JSON.stringify(updatedFeedbacks));

    // Limpiar input
    setFeedbacks(prev => ({ ...prev, [classId]: "" }));
    showToast("📝 Feedback de la clase guardado en la bitácora escolar.");
  };

  // ----- JUSTIFICACIONES DE AUSENCIAS -----
  const handleSaveJustification = (studentId, classId) => {
    const key = `${studentId}-${classId}`;
    const text = justifications[key];
    if (!text || !text.trim()) return;

    const updated = { ...justifications, [key]: text.trim() };
    setJustifications(updated);
    localStorage.setItem("ttp_justifications_local", JSON.stringify(updated));
    showToast("💾 Justificación de falta guardada y vinculada al expediente.");
  };

  // ----- CHECKLIST DE SEGUIMIENTO HUMANO -----
  const handleToggleFollowup = (id) => {
    const updated = { ...followupsChecked, [id]: !followupsChecked[id] };
    setFollowupsChecked(updated);
    localStorage.setItem("ttp_followups_checked_local", JSON.stringify(updated));
    if (updated[id]) {
      showToast("✨ Acción de seguimiento marcada como completada.");
    }
  };

  // ----- GENERADOR DE SEGUIMIENTO HUMANO DINÁMICO -----
  const generateFollowupActions = () => {
    const actions = [];
    
    // 1. Buscar faltas sin justificar
    classes.forEach(c => {
      const roster = attendance[c.id] || [];
      roster.forEach(s => {
        if (s.status === "falta") {
          const justKey = `${s.id}-${c.id}`;
          const hasJustification = justifications[justKey];
          actions.push({
            id: `f-${s.id}-${c.id}`,
            type: "falta",
            studentName: s.name,
            classTitle: c.title,
            text: `Enviar materiales de la clase y programar una sesión corta de regularización de 10 mins con ${s.name} debido a su falta en ${c.title}.`,
            note: hasJustification ? `Justificante registrado: "${hasJustification}"` : "Sin justificación registrada aún."
          });
        } else if (s.status === "retardo") {
          actions.push({
            id: `r-${s.id}-${c.id}`,
            type: "retardo",
            studentName: s.name,
            classTitle: c.title,
            text: `Repasar vocabulario clave de la lección anterior durante los primeros 5 minutos de la siguiente sesión con ${s.name}.`,
            note: "Demora en ingreso registrada."
          });
        }
      });
    });

    // 2. Buscar alertas de pago pendiente
    students.forEach(s => {
      if (s.payment_status === "moroso") {
        actions.push({
          id: `p-${s.id}`,
          type: "pago",
          studentName: s.name,
          classTitle: s.current_course,
          text: `Recordar de manera extremadamente cordial a ${s.name} (o a su tutor) al final de la sesión que pase a control escolar para aclarar su estatus administrativo.`,
          note: "⚠️ Alerta de Pago Pendiente activa"
        });
      }
    });

    // Si no hay sugerencias dinámicas, poner algunas por defecto
    if (actions.length === 0) {
      actions.push({
        id: "d1",
        type: "general",
        studentName: "Clase General",
        classTitle: "English mastery",
        text: "Enviar el boletín de lecturas recomendadas semanales a todos tus grupos para fomentar el autoaprendizaje.",
        note: "Recomendación semanal académica"
      });
      actions.push({
        id: "d2",
        type: "general",
        studentName: "Clase General",
        classTitle: "English Mastery",
        text: "Actualizar la planeación de la unidad 5 en la carpeta compartida de TTP Hub.",
        note: "Control interno docente"
      });
    }

    return actions;
  };

  if (!teacherSession || !teacherProfile) return null;

  const rate = teacherProfile.rate || 380;
  const hours = teacherProfile.hoursCompleted || 0;
  const estimatedPay = Number((hours * rate).toFixed(2));
  const uniqueStudentsCount = students.length;
  const privateClassesCount = classes.filter(c => c.type === "privada").length;

  return (
    <div className="flex min-h-screen bg-slate-50 font-inter relative">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-slate-700 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <span className="material-symbols-outlined text-teal-400">check_circle</span>
          <span className="text-sm font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Sidebar Exclusivo de Docente (Armónico con Admin) */}
      <aside className="fixed top-0 bottom-0 left-0 z-40 hidden flex-col w-64 border-r border-slate-200 bg-white p-5 md:flex transition-all duration-300 overflow-y-auto">
        {/* Brand Logo (Identical layout to Admin) */}
        <div className="mb-7 px-1">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-3xl font-bold text-ttp-primary">
              school
            </span>
            <h1 className="font-montserrat text-xl font-bold tracking-tight text-ttp-primary">
              TTP Docente
            </h1>
          </div>
          <p className="text-xs text-slate-400 font-semibold mt-1 ml-0.5">Portal de Enseñanza · TTP Hub</p>
        </div>

        {/* Nav Groups (Identical visual structure to Admin) */}
        <nav className="flex flex-col gap-5 flex-grow">
          {teacherNavGroups.map((group) => (
            <div key={group.label}>
              <p className="text-[9px] font-bold text-slate-300 uppercase tracking-widest mb-2 px-2">
                {group.label}
              </p>
              <div className="flex flex-col gap-0.5">
                {group.items.map((item) => {
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl font-semibold transition-all duration-150 active:scale-95 text-left w-full text-sm cursor-pointer ${
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
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom Profile and LogOut (Identical layout to Admin, with green online status dot!) */}
        <div className="mt-6 border-t border-slate-100 pt-4 space-y-1">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-100">
            <div className="w-8 h-8 rounded-full bg-ttp-primary/10 flex items-center justify-center flex-shrink-0 text-ttp-primary font-bold text-xs">
              {teacherProfile.name.charAt(0)}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-800 truncate">{teacherProfile.name}</p>
              <p className="text-[10px] text-slate-400 font-medium">Profesor · Docente</p>
            </div>
            <span className="ml-auto w-2 h-2 rounded-full bg-teal-400 flex-shrink-0 animate-pulse" title="En línea" />
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold text-rose-500 hover:bg-rose-50 transition-all duration-150 active:scale-95 text-left text-sm mt-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-xl text-rose-400">logout</span>
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      {/* Main Workspace Workspace */}
      <main className="flex-1 md:ml-64 min-h-screen flex flex-col">
        {/* Top Header */}
        <header className="flex justify-between items-center w-full px-6 md:px-10 h-16 sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200">
          <div>
            <h2 className="font-montserrat font-bold text-slate-800 text-lg">
              {activeTab === "agenda" ? "Agenda de Clases" :
               activeTab === "alumnos" ? "Base de Estudiantes" :
               activeTab === "justificaciones" ? "Bitácora de Ausencias" :
               "Seguimiento Humano e Historial"}
            </h2>
            <p className="text-xs text-slate-400 font-semibold">
              ¡Hola, {teacherProfile.name.split(" ")[1] || teacherProfile.name}! Que tengas una excelente lección.
            </p>
          </div>
          
          {/* Exclusión de Admin: Aquí el docente ve sus propios ingresos sin ver utilidades generales */}
          <div className="bg-emerald-50 border border-emerald-200/60 rounded-xl px-4 py-1.5 flex items-center gap-3 text-right">
            <div>
              <p className="text-[8px] font-bold text-emerald-400 uppercase tracking-wider">Mi Pago Acumulado</p>
              <p className="text-xs font-black text-emerald-600">${estimatedPay.toLocaleString()} MXN</p>
            </div>
            <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-base">monetization_on</span>
            </div>
          </div>
        </header>

        {/* Content Container */}
        <div className="p-6 md:p-10 max-w-7xl mx-auto w-full space-y-8">
          
          {/* Row of KPIs (Similar visual weight to admin) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center gap-4 shadow-sm">
              <div className="w-11 h-11 rounded-xl bg-ttp-primary/10 text-ttp-primary flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-xl">calendar_today</span>
              </div>
              <div>
                <p className="text-2xl font-extrabold text-slate-800">{classes.length}</p>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Clases Activas</p>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center gap-4 shadow-sm">
              <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-xl">school</span>
              </div>
              <div>
                <p className="text-2xl font-extrabold text-slate-800">{uniqueStudentsCount}</p>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Mis Alumnos</p>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center gap-4 shadow-sm">
              <div className="w-11 h-11 rounded-xl bg-pink-50 text-[#e74d8a] flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-xl">grade</span>
              </div>
              <div>
                <p className="text-2xl font-extrabold text-slate-800">{privateClassesCount}</p>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Clases Privadas</p>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center gap-4 shadow-sm">
              <div className="w-11 h-11 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-xl">schedule</span>
              </div>
              <div>
                <p className="text-2xl font-extrabold text-slate-800">{hours} <span className="text-xs text-slate-400 font-bold">h</span></p>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Horas Registradas</p>
              </div>
            </div>
          </div>

          {/* TAB 1: AGENDA Y CLASES ACTIVAS (Con Pase de Lista, Feedback, Meet, Check-In/Check-Out) */}
          {activeTab === "agenda" && (
            <div className="space-y-6">
              {classes.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center space-y-3">
                  <span className="material-symbols-outlined text-5xl text-slate-200">calendar_today</span>
                  <p className="text-base font-bold text-slate-600">No hay clases asignadas</p>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">Tu agenda académica está limpia de momento. Por favor contacta al administrador.</p>
                </div>
              ) : (
                classes.map((cls) => (
                  <div key={cls.id} className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                    
                    {/* Encabezado de la clase */}
                    <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${
                            cls.type === "privada" ? "bg-purple-50 border-purple-200 text-purple-600" :
                            cls.type === "club" ? "bg-pink-50 border-pink-200 text-[#e74d8a]" :
                            "bg-sky-50 border-sky-200 text-sky-600"
                          }`}>
                            {cls.type === "privada" ? "Privada 1-1" : cls.type === "club" ? "Club de Conversación" : "Grupal"}
                          </span>
                          <span className="text-[10px] font-bold text-slate-400 font-mono">ID: {cls.id}</span>
                        </div>
                        <h4 className="font-montserrat font-bold text-slate-800 text-base">{cls.title}</h4>
                        <p className="text-xs text-slate-400 font-bold">{cls.day} • {cls.time}</p>
                      </div>

                      {/* Botón de Check-In/Check-Out */}
                      <div className="w-full sm:w-auto">
                        {cls.status === "completed" ? (
                          <div className="bg-emerald-50 border border-emerald-100 px-3.5 py-1.5 rounded-xl flex items-center justify-between text-xs text-emerald-800 font-bold gap-3">
                            <span className="flex items-center gap-1">
                              <span className="material-symbols-outlined text-sm text-emerald-600">task_alt</span>
                              Sesión Completada
                            </span>
                            <span className="text-[8px] bg-emerald-100/70 text-emerald-600 px-1.5 py-0.5 rounded-full font-extrabold">ACREDITADO</span>
                          </div>
                        ) : cls.status === "in_progress" ? (
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-bold text-sky-600 bg-sky-50 border border-sky-100 px-2.5 py-1.5 rounded-xl animate-pulse">
                              EN VIVO
                            </span>
                            <button
                              onClick={() => handleCheckOut(cls)}
                              className="py-2 px-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold active:scale-95 transition-all flex items-center gap-1 shadow-md shadow-emerald-500/10 cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-sm">power_settings_new</span>
                              Check-Out
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleCheckIn(cls.id)}
                            className="py-2.5 px-4 bg-[#e74d8a] hover:opacity-90 text-white rounded-xl text-xs font-bold active:scale-95 transition-all flex items-center gap-1 shadow-md shadow-pink-500/10 cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-sm">login</span>
                            Iniciar Clase (Check-In)
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="p-6 space-y-6">
                      {/* Fila de Meet */}
                      {cls.meetLink && (
                        <div className="bg-slate-50 border border-slate-150 p-3.5 rounded-2xl flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-600 flex items-center gap-2">
                            <span className="material-symbols-outlined text-sky-500 text-base">video_camera_front</span>
                            Clase por Google Meet
                          </span>
                          <a
                            href={cls.meetLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-4 py-1.5 bg-sky-50 hover:bg-sky-100 border border-sky-150 text-sky-600 rounded-xl font-bold transition-all flex items-center gap-1"
                          >
                            <span>Conectarse a Clase</span>
                            <span className="material-symbols-outlined text-xs">open_in_new</span>
                          </a>
                        </div>
                      )}

                      {/* Sección de Pase de Lista Interactivo de Alumnos */}
                      <div className="space-y-3">
                        <span className="text-slate-400 block font-bold uppercase tracking-wider text-[9px]">Pase de Asistencia y Alertas de Pago</span>
                        <div className="divide-y divide-slate-100 border border-slate-200/50 rounded-2xl overflow-hidden bg-slate-50/20">
                          {(attendance[cls.id] || []).map((student) => {
                            // Buscar el estatus de pago moroso para alerta (sin números contables)
                            const studentDb = students.find(s => s.id === student.id);
                            const isMoroso = studentDb?.payment_status === "moroso";

                            return (
                              <div key={student.id} className="p-3.5 flex justify-between items-center text-xs hover:bg-slate-50/50 transition-colors">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <p className="font-bold text-slate-800">{student.name}</p>
                                    
                                    {/* ALERTA DE PAGO MOROSO (Exigida por el usuario: Solo Alerta, sin detalles contables) */}
                                    {isMoroso && (
                                      <span className="px-2 py-0.5 rounded-full text-[8px] font-black bg-amber-50 border border-amber-200 text-amber-600 flex items-center gap-1 shadow-sm uppercase tracking-wider">
                                        <span className="w-1 h-1 rounded-full bg-amber-500 animate-ping"></span>
                                        ⚠️ Alerta de Pago Pendiente
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[10px] text-slate-400 font-semibold">{student.email}</p>
                                </div>

                                {/* Controles de Asistencia Interactivos para el Profesor */}
                                <div className="flex gap-1">
                                  {/* Presente */}
                                  <button
                                    onClick={() => handleMarkAttendance(cls.id, student.id, "presente")}
                                    className={`px-2.5 py-1 rounded-lg text-[9px] font-bold border transition-all cursor-pointer ${
                                      student.status === "presente"
                                        ? "bg-teal-50 border-teal-200 text-teal-600 font-black shadow-sm"
                                        : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                                    }`}
                                  >
                                    Asistió
                                  </button>
                                  {/* Retardo */}
                                  <button
                                    onClick={() => handleMarkAttendance(cls.id, student.id, "retardo")}
                                    className={`px-2.5 py-1 rounded-lg text-[9px] font-bold border transition-all cursor-pointer ${
                                      student.status === "retardo"
                                        ? "bg-amber-50 border-amber-200 text-amber-600 font-black shadow-sm"
                                        : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                                    }`}
                                  >
                                    Retardo
                                  </button>
                                  {/* Falta */}
                                  <button
                                    onClick={() => handleMarkAttendance(cls.id, student.id, "falta")}
                                    className={`px-2.5 py-1 rounded-lg text-[9px] font-bold border transition-all cursor-pointer ${
                                      student.status === "falta"
                                        ? "bg-rose-50 border-rose-200 text-rose-600 font-black shadow-sm"
                                        : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                                    }`}
                                  >
                                    Falta
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Sección de Feedback Diario (Reporte de la clase impartida) */}
                      <div className="space-y-2 pt-2 border-t border-slate-100">
                        <span className="text-slate-400 block font-bold uppercase tracking-wider text-[9px]">Feedback Diario de la Clase</span>
                        <div className="flex gap-2">
                          <textarea
                            value={feedbacks[cls.id] || ""}
                            onChange={(e) => setFeedbacks(prev => ({ ...prev, [cls.id]: e.target.value }))}
                            placeholder="Escribe el resumen del día: temas vistos, tareas asignadas o notas del grupo..."
                            className="flex-1 min-h-[50px] p-3 text-xs border border-slate-200 rounded-xl outline-none focus:border-ttp-primary placeholder-slate-300 font-medium"
                          />
                          <button
                            onClick={() => handleSaveFeedback(cls.id)}
                            disabled={!feedbacks[cls.id] || !feedbacks[cls.id].trim()}
                            className="px-4 bg-ttp-primary text-white rounded-xl text-xs font-bold active:scale-95 transition-all flex items-center justify-center gap-1.5 shadow-md shadow-ttp-primary/10 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <span className="material-symbols-outlined text-sm">save</span>
                            Guardar
                          </button>
                        </div>
                      </div>

                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 2: MIS ESTUDIANTES (Vista Académica Consolidada) */}
          {activeTab === "alumnos" && (
            <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center">
                <h3 className="font-montserrat font-bold text-slate-800 text-sm">Mis Estudiantes Asignados</h3>
                <span className="text-[10px] font-bold text-slate-400">{students.length} Alumnos</span>
              </div>

              <div className="grid grid-cols-12 px-6 py-3 bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <span className="col-span-4">Estudiante</span>
                <span className="col-span-4">Curso Asignado</span>
                <span className="col-span-2 text-center">Horario</span>
                <span className="col-span-2 text-right">Estatus de Cobro</span>
              </div>

              <div className="divide-y divide-slate-50">
                {students.map(s => {
                  const isMoroso = s.payment_status === "moroso";
                  return (
                    <div key={s.id} className="grid grid-cols-12 gap-2 px-6 py-4 items-center hover:bg-slate-50/50 transition-colors text-xs">
                      {/* Nombre y Correo */}
                      <div className="col-span-4 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-ttp-primary/10 text-ttp-primary font-black flex items-center justify-center">
                          {s.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-slate-800">{s.name}</p>
                          <p className="text-[10px] text-slate-400 font-semibold">{s.email}</p>
                        </div>
                      </div>

                      {/* Curso */}
                      <span className="col-span-4 font-bold text-slate-700">{s.current_course}</span>

                      {/* Horario */}
                      <span className="col-span-2 text-center text-[10px] text-slate-400 font-bold">{s.schedule.split(" ")[0] || s.schedule}</span>

                      {/* Alerta de Pago Pendiente (Exclusivo: Sin revelar saldos deudores) */}
                      <div className="col-span-2 flex justify-end">
                        {isMoroso ? (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-amber-50 border border-amber-200 text-amber-600 flex items-center gap-1 shadow-sm uppercase tracking-wider">
                            ⚠️ Pago Pendiente
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-teal-50 border border-teal-200 text-teal-600">
                            Al Corriente
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: AUSENCIAS Y BITÁCORA DE JUSTIFICACIONES */}
          {activeTab === "justificaciones" && (
            <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50">
                <h3 className="font-montserrat font-bold text-slate-800 text-sm">Historial de Ausencias y Justificaciones</h3>
                <p className="text-xs text-slate-400 font-semibold">
                  Escribe y documenta los justificantes de inasistencia presentados por los alumnos.
                </p>
              </div>

              <div className="divide-y divide-slate-100">
                {classes.every(c => (attendance[c.id] || []).every(s => s.status !== "falta")) ? (
                  <div className="p-12 text-center space-y-2">
                    <span className="material-symbols-outlined text-4xl text-slate-200">check_circle</span>
                    <p className="text-sm font-bold text-slate-500">¡Excelente asistencia!</p>
                    <p className="text-xs text-slate-400">No hay alumnos con inasistencias reportadas en tu agenda escolar.</p>
                  </div>
                ) : (
                  classes.map(c => {
                    const absents = (attendance[c.id] || []).filter(s => s.status === "falta");
                    if (absents.length === 0) return null;

                    return absents.map(s => {
                      const justKey = `${s.id}-${c.id}`;
                      return (
                        <div key={justKey} className="p-6 space-y-3 hover:bg-slate-50/20 transition-colors">
                          <div className="flex justify-between items-start text-xs">
                            <div className="space-y-0.5">
                              <p className="font-bold text-slate-800 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                                {s.name}
                              </p>
                              <p className="text-[10px] text-slate-400 font-bold">{c.title} • {c.day} • {c.time}</p>
                            </div>
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-rose-50 border border-rose-200 text-rose-600">
                              Ausente (Falta)
                            </span>
                          </div>

                          {/* Campo interactivo para justificar la falta */}
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={justifications[justKey] || ""}
                              onChange={(e) => setJustifications(prev => ({ ...prev, [justKey]: e.target.value }))}
                              placeholder="Escribe el motivo del justificante (ej. Cita médica dental, Problemas de internet...)"
                              className="flex-1 px-4 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:border-ttp-primary placeholder-slate-300 font-semibold text-slate-700"
                            />
                            <button
                              onClick={() => handleSaveJustification(s.id, c.id)}
                              disabled={!justifications[justKey] || !justifications[justKey].trim()}
                              className="px-4 bg-slate-900 hover:bg-slate-850 text-white rounded-xl text-xs font-bold active:scale-95 transition-all flex items-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <span className="material-symbols-outlined text-sm">edit_note</span>
                              Justificar
                            </button>
                          </div>
                        </div>
                      );
                    });
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB 4: SEGUIMIENTO HUMANO Y BITÁCORA HISTÓRICA */}
          {activeTab === "logros" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              
              {/* Col Izq: Checklist de Acción (Seguimiento Humano) */}
              <div className="lg:col-span-8 space-y-6">
                <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
                  <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50">
                    <h3 className="font-montserrat font-bold text-slate-800 text-sm">Líneas de Acción Recomendadas</h3>
                    <p className="text-xs text-slate-400 font-semibold">
                      Acciones automáticas generadas para garantizar el acompañamiento y éxito de tus alumnos.
                    </p>
                  </div>

                  <div className="divide-y divide-slate-150/60 p-4 space-y-3">
                    {generateFollowupActions().map(act => {
                      const isChecked = followupsChecked[act.id] || false;
                      return (
                        <div
                          key={act.id}
                          className={`p-4 rounded-2xl border transition-all flex items-start gap-4 ${
                            isChecked 
                              ? "bg-slate-50/60 border-slate-200/50 opacity-60" 
                              : "bg-white border-slate-200 shadow-sm"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleFollowup(act.id)}
                            className="mt-1 w-4.5 h-4.5 rounded border-slate-300 text-ttp-primary focus:ring-ttp-primary cursor-pointer flex-shrink-0"
                          />
                          
                          <div className="space-y-1 text-xs">
                            <div className="flex items-center gap-2">
                              <span className={`text-[8px] font-black px-1.5 py-0.5 rounded border uppercase tracking-wider ${
                                act.type === "falta" ? "bg-rose-50 border-rose-200 text-rose-500" :
                                act.type === "retardo" ? "bg-amber-50 border-amber-200 text-amber-500" :
                                act.type === "pago" ? "bg-orange-50 border-orange-200 text-orange-500" :
                                "bg-slate-100 border-slate-200 text-slate-500"
                              }`}>
                                {act.type}
                              </span>
                              <strong className="text-slate-800 font-montserrat">{act.studentName}</strong>
                            </div>
                            <p className={`font-semibold leading-relaxed ${isChecked ? "line-through text-slate-400" : "text-slate-650"}`}>
                              {act.text}
                            </p>
                            <span className="text-[10px] text-slate-400 font-bold block">{act.note}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Col Der: Historial de Logros y Feedbacks */}
              <div className="lg:col-span-4 space-y-6">
                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
                  <h4 className="font-montserrat font-bold text-slate-800 text-sm border-b border-slate-100 pb-3 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[#e74d8a] text-base">receipt_long</span>
                    Historial de Feedbacks
                  </h4>

                  <div className="space-y-4 max-h-[450px] overflow-y-auto pr-1">
                    {Object.keys(savedFeedbacks).length === 0 ? (
                      <p className="text-xs text-slate-400 font-semibold text-center py-6">
                        No se han registrado reportes diarios de clase.
                      </p>
                    ) : (
                      Object.keys(savedFeedbacks).map(cId => {
                        const classObj = classes.find(c => c.id === cId);
                        const classTitle = classObj?.title || `Clase ${cId}`;
                        const feedbacksList = savedFeedbacks[cId] || [];

                        return feedbacksList.map((f, i) => (
                          <div key={`${cId}-${i}`} className="bg-slate-50 border border-slate-150 p-3.5 rounded-2xl space-y-1 text-xs">
                            <div className="flex justify-between items-center border-b border-slate-200/50 pb-1.5 mb-1.5 font-bold">
                              <span className="text-slate-700 truncate max-w-[150px]">{classTitle}</span>
                              <span className="text-[9px] text-slate-400">{f.date}</span>
                            </div>
                            <p className="text-slate-500 leading-relaxed font-semibold">
                              "{f.content}"
                            </p>
                          </div>
                        ));
                      })
                    )}
                  </div>
                </div>
              </div>

            </div>
          )}

        </div>
      </main>
    </div>
  );
}
