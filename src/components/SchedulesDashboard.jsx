"use client";

import React, { useState } from "react";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import { toast } from "sonner";

export default function SchedulesDashboard() {
  // Estado para la búsqueda
  const [searchQuery, setSearchQuery] = useState("");
  
  // Estado de notificaciones Toast (via Sonner)
  const [toastMessage, setToastMessage] = useState(null); // kept for schedule conflict warning
  
  // Desplazamiento de semanas (Offset de fecha en vivo)
  const [weekOffset, setWeekOffset] = useState(0);

  const getMondayOfOffsetWeek = () => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    // Domingo es 0. Si hoy es domingo, restamos 6 días para ir al lunes.
    const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const baseDate = new Date(today);
    baseDate.setDate(today.getDate() - daysToSubtract + weekOffset * 7);
    baseDate.setHours(0, 0, 0, 0);
    return baseDate;
  };

  const getMonDateStr = () => {
    const d = getMondayOfOffsetWeek();
    return d.toISOString().split("T")[0];
  };
  
  const getEndCourseDateStr = () => {
    const d = getMondayOfOffsetWeek();
    d.setDate(d.getDate() + 28); // 4 semanas después
    return d.toISOString().split("T")[0];
  };

  const getSlotFromTime = (timeStr) => {
    if (!timeStr) return "08:00";
    const hour = timeStr.split(":")[0];
    return `${hour.padStart(2, "0")}:00`;
  };

  const getActiveDaysOfClass = (c) => {
    if (c.daysSelected && Array.isArray(c.daysSelected)) {
      return c.daysSelected;
    }
    if (c.dayStart && c.dayEnd) {
      const startIdx = daysKeys.indexOf(c.dayStart);
      const endIdx = daysKeys.indexOf(c.dayEnd);
      if (startIdx !== -1 && endIdx !== -1) {
        return daysKeys.slice(startIdx, endIdx + 1);
      }
    }
    if (c.day) {
      return [c.day];
    }
    return ["LUN"];
  };

  // Estados de control para modals
  const [selectedClass, setSelectedClass] = useState(null);
  const [isAddClassModalOpen, setIsAddClassModalOpen] = useState(false);
  const [editingClassId, setEditingClassId] = useState(null);
  const [deleteConfirmModal, setDeleteConfirmModal] = useState(null); // { name: '', onConfirm: fn }

  // Formulario para crear una nueva clase
  const [newClass, setNewClass] = useState({
    title: "",
    daysSelected: ["LUN"],
    time: "08:00 - 09:30",
    slot: "08:00",
    startTime: "08:00",
    endTime: "09:30",
    startDate: "",
    endDate: "",
    teacher: "",
    capacity: "",
    type: "grupal", // "grupal", "privada", "club"
  });

  // Lista de clases cargadas (Estado dinámico con estatus y enlaces Google Meet)
  const [classes, setClasses] = useState([]);

  // Asistencia de estudiantes inscritos en cada clase activa
  const [attendance, setAttendance] = useState({});

  const [isMeetGenerating, setIsMeetGenerating] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // Lista de profesores dinámicos de la base de datos
  const [teachersList, setTeachersList] = useState([]);

  // Catálogo de cursos desde Configuración
  const [coursesCatalog, setCoursesCatalog] = useState([]);

  // Alumnos para calcular alertas de pago automáticamente
  const [students, setStudents] = useState([]);

  // Cargar de localStorage en el montaje
  React.useEffect(() => {
    if (typeof window !== "undefined") {
      // Inicializar fechas por defecto del formulario de forma segura en Next.js
      setNewClass(prev => ({
        ...prev,
        startDate: getMonDateStr(),
        endDate: getEndCourseDateStr()
      }));

      const storedClasses = localStorage.getItem("ttp_schedules_local");
      const storedAtt = localStorage.getItem("ttp_attendance_local");
      const storedTeachers = localStorage.getItem("ttp_teachers_local");
      const storedCourses = localStorage.getItem("ttp_courses_local");

      if (storedTeachers) {
        try {
          let parsed = JSON.parse(storedTeachers);
          // Purgar docentes mock predeterminados ("t-001", "t-002", "t-003" o nombres mock)
          const mockTeacherIds = ["t-001", "t-002", "t-003"];
          const mockNames = ["Lic. Elena Valdéz", "Mark W. Johnson", "Dra. Carmen Ríos"];
          parsed = parsed.filter(t => !mockTeacherIds.includes(t.id) && !mockNames.includes(t.name));
          setTeachersList(parsed);
          localStorage.setItem("ttp_teachers_local", JSON.stringify(parsed));
        } catch (e) {}
      }

      if (storedCourses) {
        try {
          const parsedCourses = JSON.parse(storedCourses);
          setCoursesCatalog(Array.isArray(parsedCourses) ? parsedCourses.filter(c => c.status === "activo") : []);
        } catch (e) {}
      }

      const storedStudents = localStorage.getItem("ttp_students_local");
      if (storedStudents) {
        try { setStudents(JSON.parse(storedStudents)); } catch (e) {}
      }

      if (storedClasses) {
        try {
          let parsed = JSON.parse(storedClasses);
          // Auto-limpieza de clases mock obsoletas (IDs c1 a c7)
          const mockIds = ["c1", "c2", "c3", "c4", "c5", "c6", "c7"];
          parsed = parsed.filter(c => !mockIds.includes(c.id));
          setClasses(parsed);
          localStorage.setItem("ttp_schedules_local", JSON.stringify(parsed));
        } catch (e) {}
      }
      if (storedAtt) {
        try {
          let parsedAtt = JSON.parse(storedAtt);
          const mockIds = ["c1", "c2", "c3", "c4", "c5", "c6", "c7"];
          mockIds.forEach(id => {
            delete parsedAtt[id];
          });
          setAttendance(parsedAtt);
          localStorage.setItem("ttp_attendance_local", JSON.stringify(parsedAtt));
        } catch (e) {}
      }
      setIsLoaded(true);
    }
  }, []);

  // Guardar en localStorage ante cambios
  React.useEffect(() => {
    if (isLoaded && typeof window !== "undefined") {
      localStorage.setItem("ttp_schedules_local", JSON.stringify(classes));
    }
  }, [classes, isLoaded]);

  React.useEffect(() => {
    if (isLoaded && typeof window !== "undefined") {
      localStorage.setItem("ttp_attendance_local", JSON.stringify(attendance));
    }
  }, [attendance, isLoaded]);

  // Alumnos morosos/pendientes por clase — calculado automáticamente
  const DEBT_STATUSES = ["moroso", "pendiente", "pago_fallido"];
  const debtorsByClass = React.useMemo(() => {
    const map = {};
    classes.forEach(cls => {
      map[cls.id] = students.filter(s => {
        const inClass =
          s.current_course === cls.title ||
          s.current_group  === cls.title ||
          (s.enrollments || []).some(e => e.course === cls.title || e.group === cls.title);
        return inClass && DEBT_STATUSES.includes(s.payment_status);
      });
    });
    return map;
  }, [classes, students]);

  const DEBT_LABEL = { moroso: "Moroso", pendiente: "Pago pendiente", pago_fallido: "Pago fallido" };

  // Horas de los renglones del calendario (Lista larga comercial completa)
  const timeSlots = [
    "07:00", "08:00", "09:00", "10:00", "11:00", "12:00",
    "13:00", "14:00", "15:00", "16:00", "17:00", "18:00",
    "19:00", "20:00", "21:00"
  ];

  // Días de la semana para mapeo
  const daysKeys = ["LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB"];

  // Mostrar Toast
  const showToast = (msg) => {
    if (msg.startsWith("✅")) toast.success(msg.replace("✅ ", ""));
    else if (msg.startsWith("✏️")) toast.success(msg.replace("✏️ ", ""));
    else if (msg.startsWith("🗑️")) toast.error(msg.replace("🗑️ ", ""));
    else if (msg.startsWith("⛔") || msg.includes("Error")) toast.error(msg);
    else if (msg.startsWith("⚠️") || msg.includes("Conflicto") || msg.includes("??")) toast.warning(msg);
    else toast(msg);
  };

  // Calcular fechas de la semana en vivo según el offset
  const getDaysOfWeek = () => {
    const baseDate = getMondayOfOffsetWeek();

    return daysKeys.map((day, index) => {
      const d = new Date(baseDate);
      d.setDate(baseDate.getDate() + index);
      return {
        key: day,
        num: d.getDate(),
        month: d.toLocaleDateString("es-ES", { month: "long" }),
        year: d.getFullYear(),
        dateStr: d.toLocaleDateString("es-ES", { day: "numeric", month: "short" })
      };
    });
  };

  const currentWeekDays = getDaysOfWeek();
  const weekStartStr = currentWeekDays[0].dateStr;
  const weekEndStr = currentWeekDays[5].dateStr;
  const currentYear = currentWeekDays[0].year;

  // Filtrar clases por término de búsqueda en la cabecera
  const filteredClasses = classes.filter(
    (c) =>
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.teacher.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const checkAvailabilityConflict = (teacherName, days, startTime, endTime) => {
    if (!teacherName) return null;
    const storedTeachers = localStorage.getItem("ttp_teachers_local");
    if (!storedTeachers) return null;
    let parsedTeachers = [];
    try {
      parsedTeachers = JSON.parse(storedTeachers);
    } catch (e) {
      return null;
    }
    const teacher = parsedTeachers.find(t => t.name === teacherName);
    if (!teacher) return null;

    const storedBlocks = localStorage.getItem("ttp_teachers_availability");
    if (!storedBlocks) return null;
    let blocks = [];
    try {
      blocks = JSON.parse(storedBlocks);
    } catch (e) {
      return null;
    }

    const teacherBlocks = blocks.filter(b => b.teacherId === teacher.id);
    if (teacherBlocks.length === 0) return null;

    const toMin = t => {
      if (!t) return 0;
      const [h, m] = t.split(":").map(Number);
      return h * 60 + (m || 0);
    };
    const start = toMin(startTime);
    const end = toMin(endTime);

    // Map newDays format LUN to Lunes, MAR to Martes...
    const DAY_MAP = {
      "LUN": "Lunes",
      "MAR": "Martes",
      "MIÉ": "Miércoles",
      "JUE": "Jueves",
      "VIE": "Viernes",
      "SÁB": "Sábado",
      "DOM": "Domingo"
    };

    for (const dKey of days) {
      const fullDayName = DAY_MAP[dKey] || dKey;
      
      // Encontrar bloques del profesor para este día
      const dayBlocks = teacherBlocks.filter(b => b.day === fullDayName);
      
      for (const b of dayBlocks) {
        if (b.type === "dia_descanso") {
          return { day: fullDayName, type: "Día de Descanso", startTime: "07:00", endTime: "22:00", description: b.description };
        }
        
        if (b.type === "no_disponible" || b.type === "clase_asignada") {
          const bStart = toMin(b.startTime);
          const bEnd = toMin(b.endTime);
          
          // Check overlap
          if (Math.max(start, bStart) < Math.min(end, bEnd)) {
            return {
              day: fullDayName,
              type: b.type === "no_disponible" ? "No Disponible" : "Clase Asignada",
              startTime: b.startTime,
              endTime: b.endTime,
              description: b.description
            };
          }
        }
      }
    }
    return null;
  };

  // Agregar o Editar clase
  const handleAddClass = (e) => {
    e.preventDefault();

    // Días activos de la nueva clase
    const newDays = newClass.daysSelected || ["LUN"];

    // Validar disponibilidad del profesor en su calendario de disponibilidad
    const availConflict = checkAvailabilityConflict(newClass.teacher, newDays, newClass.startTime, newClass.endTime);
    if (availConflict) {
      const reasonStr = availConflict.description ? ` (Motivo: "${availConflict.description}")` : "";
      const timeStr = availConflict.type === "Día de Descanso" ? "Todo el día" : `${availConflict.startTime} - ${availConflict.endTime}`;
      showToast(`⚠️ Conflicto de Disponibilidad: El profesor "${newClass.teacher}" tiene un bloque de "${availConflict.type}" el ${availConflict.day} (${timeStr})${reasonStr}.`);
      return;
    }

    // Validar si el profesor ya tiene clase asignada en el mismo día y bloque horario (slot)
    const isClash = classes.some((c) => {
      if (c.id === editingClassId || c.teacher !== newClass.teacher || c.slot !== newClass.slot) {
        return false;
      }
      
      // Días activos de la clase existente
      const existDays = getActiveDaysOfClass(c);

      // Comprobar si hay intersección de días de la semana
      const hasDayOverlap = newDays.some(d => existDays.includes(d));
      if (!hasDayOverlap) return false;

      // Comprobar si hay intersección de rango de fechas
      const hasDateOverlap = (() => {
        const hasNewDates = newClass.startDate && newClass.endDate;
        const hasExistDates = c.startDate && c.endDate;
        
        if (!hasNewDates || !hasExistDates) {
          // Si alguna de las clases es permanente, siempre hay intersección de fechas
          return true;
        }

        const newStart = new Date(newClass.startDate + "T00:00:00");
        const newEnd = new Date(newClass.endDate + "T23:59:59");
        const existStart = new Date(c.startDate + "T00:00:00");
        const existEnd = new Date(c.endDate + "T23:59:59");

        return Math.max(newStart.getTime(), existStart.getTime()) <= Math.min(newEnd.getTime(), existEnd.getTime());
      })();

      return hasDateOverlap;
    });

    if (isClash) {
      showToast(`⚠️ Conflicto de Horario: El profesor "${newClass.teacher}" ya tiene una clase asignada en el horario ${newClass.slot} para los días/fechas seleccionados.`);
      return;
    }

    if (editingClassId) {
      setClasses((prev) =>
        prev.map((c) =>
          c.id === editingClassId
            ? { ...c, ...newClass, capacity: Number(newClass.capacity) }
            : c
        )
      );
      setIsAddClassModalOpen(false);
      showToast(`¡Clase "${newClass.title}" actualizada con éxito!`);
      setEditingClassId(null);
    } else {
      const newId = `c-${Date.now()}`;
      const classObj = {
        id: newId,
        ...newClass,
        capacity: Number(newClass.capacity)
      };

      setClasses((prev) => [...prev, classObj]);
      setIsAddClassModalOpen(false);
      showToast(`¡Clase "${newClass.title}" agendada con éxito!`);
    }
    
    // Limpiar campos
    setNewClass({
      title: "",
      daysSelected: ["LUN"],
      time: "08:00 - 09:30",
      slot: "08:00",
      startTime: "08:00",
      endTime: "09:30",
      startDate: "",
      endDate: "",
      teacher: "",
      capacity: "",
      type: "grupal",
      paymentAlert: false
    });
  };

  // Abrir modal de agendar de forma general
  const handleOpenAddClassModal = () => {
    if (typeof window !== "undefined") {
      const storedTeachers = localStorage.getItem("ttp_teachers_local");
      if (storedTeachers) {
        try {
          const parsed = JSON.parse(storedTeachers);
          setTeachersList(Array.isArray(parsed) ? parsed : []);
        } catch (e) {}
      }
      const storedCourses = localStorage.getItem("ttp_courses_local");
      if (storedCourses) {
        try {
          const parsed = JSON.parse(storedCourses);
          setCoursesCatalog(Array.isArray(parsed) ? parsed.filter(c => c.status === "activo") : []);
        } catch (e) {}
      }
    }
    setNewClass({
      title: "",
      daysSelected: ["LUN"],
      time: "08:00 - 09:30",
      slot: "08:00",
      startTime: "08:00",
      endTime: "09:30",
      startDate: "",
      endDate: "",
      teacher: "",
      capacity: "",
      type: "grupal",
      paymentAlert: false
    });
    setIsAddClassModalOpen(true);
  };

  // Cerrar modal y resetear modo de edición
  const handleCloseAddModal = () => {
    setIsAddClassModalOpen(false);
    setEditingClassId(null);
    setNewClass({
      title: "",
      daysSelected: ["LUN"],
      time: "08:00 - 09:30",
      slot: "08:00",
      startTime: "08:00",
      endTime: "09:30",
      startDate: "",
      endDate: "",
      teacher: "",
      capacity: "",
      type: "grupal",
      paymentAlert: false
    });
  };

  // Abrir modal de agendar desde una celda del calendario con día y hora pre-llenados
  const handleOpenCellModal = (day, slot) => {
    if (typeof window !== "undefined") {
      const storedTeachers = localStorage.getItem("ttp_teachers_local");
      if (storedTeachers) {
        try {
          const parsed = JSON.parse(storedTeachers);
          setTeachersList(Array.isArray(parsed) ? parsed : []);
        } catch (e) {}
      }
      const storedCourses = localStorage.getItem("ttp_courses_local");
      if (storedCourses) {
        try {
          const parsed = JSON.parse(storedCourses);
          setCoursesCatalog(Array.isArray(parsed) ? parsed.filter(c => c.status === "activo") : []);
        } catch (e) {}
      }
    }
    const defaultEnd = slot === "08:00" ? "09:30" : slot === "10:00" ? "11:30" : "13:30";
    setNewClass(prev => ({
      ...prev,
      title: "",
      daysSelected: [day],
      slot: slot,
      startTime: slot,
      endTime: defaultEnd,
      time: `${slot} - ${defaultEnd}`,
      startDate: "",
      endDate: "",
      teacher: "",
      capacity: "",
      type: "grupal",
      paymentAlert: false
    }));
    setIsAddClassModalOpen(true);
  };

  // Cargar datos en el formulario y abrir modal para editar/reagendar clase
  const handleRescheduleClass = (c) => {
    setNewClass({
      title: c.title,
      daysSelected: getActiveDaysOfClass(c),
      time: c.time,
      slot: c.slot,
      startTime: c.startTime || c.slot || "08:00",
      endTime: c.endTime || (c.time ? c.time.split(" - ")[1] : "09:30"),
      startDate: c.startDate || "",
      endDate: c.endDate || "",
      teacher: c.teacher,
      capacity: c.capacity,
      type: c.type,
      paymentAlert: c.paymentAlert
    });
    setEditingClassId(c.id);
    setIsAddClassModalOpen(true);
    setSelectedClass(null);
  };

  // Eliminar clase
  const handleDeleteClass = (id, title) => {
    setDeleteConfirmModal({
      name: title,
      onConfirm: () => {
        setClasses((prev) => prev.filter((c) => c.id !== id));
        showToast(`Clase "${title}" cancelada.`);
        setSelectedClass(null);
      }
    });
  };

  // Generar de forma programática un enlace Google Meet (Simulación de Google Calendar API)
  const handleGenerateGoogleMeetLink = (classId) => {
    setIsMeetGenerating(true);
    showToast("🗓️ Conectando con Google Calendar API... Creando evento...");
    
    setTimeout(() => {
      const meetId = Math.random().toString(36).substring(2, 5) + "-" + Math.random().toString(36).substring(2, 6) + "-" + Math.random().toString(36).substring(2, 5);
      const newMeetLink = `https://meet.google.com/${meetId}`;
      
      setClasses((prev) =>
        prev.map((c) => (c.id === classId ? { ...c, meetLink: newMeetLink } : c))
      );
      
      // Actualizar también la clase seleccionada en el modal
      setSelectedClass((prev) => (prev && prev.id === classId ? { ...prev, meetLink: newMeetLink } : prev));
      
      setIsMeetGenerating(false);
      showToast("🎥 Enlace Google Meet creado exitosamente y guardado en Google Calendar.");
    }, 1500);
  };

  // Registrar asistencia del alumno y enviar alertas automáticas de WhatsApp si falta (Control Administrativo)
  const handleMarkStudentAttendance = (classId, studentId, newStatus) => {
    setAttendance((prev) => {
      const classAttendance = prev[classId] || students.map(s => ({
        id: s.id,
        name: `${s.name} ${s.last_name || ""}`.trim(),
        email: s.email || "",
        status: "sin_asignar"
      }));
      const updatedAttendance = classAttendance.map((student) => {
        if (student.id === studentId) {
          if (newStatus === "falta") {
            // Simular el disparo automático del webhook de alertas por WhatsApp a padres / admin
            showToast(`✉️ Alerta de inasistencia enviada a administración y WhatsApp de tutor para ${student.name}.`);
          } else {
            showToast(`✅ Asistencia de ${student.name} actualizada a '${newStatus.toUpperCase()}'.`);
          }
          return { ...student, status: newStatus };
        }
        return student;
      });
      return { ...prev, [classId]: updatedAttendance };
    });
  };

  const getClassDuration = (timeStr) => {
    if (!timeStr) return 1.5;
    try {
      const match = timeStr.match(/(\d{1,2}):(\d{2})\s*[–\-]\s*(\d{1,2}):(\d{2})/);
      if (!match) return 1.5;
      const h1 = parseInt(match[1], 10);
      const m1 = parseInt(match[2], 10);
      const h2 = parseInt(match[3], 10);
      const m2 = parseInt(match[4], 10);
      const mins1 = h1 * 60 + m1;
      const mins2 = h2 * 60 + m2;
      const diff = mins2 - mins1;
      return diff > 0 ? Number((diff / 60).toFixed(2)) : 1.5;
    } catch (autoErr) {
      return 1.5;
    }
  };

  const getCardStyle = (item, index, totalCount) => {
    const cardHeight = 52;
    const gap = 6;
    const topStyle = `calc(8px + ${index} * (${cardHeight}px + ${gap}px))`;
    
    return {
      position: 'absolute',
      top: topStyle,
      left: '8px',
      right: '8px',
      height: `${cardHeight}px`,
      zIndex: 10 + index
    };
  };

  const updateTeacherHours = (teacherName, hours) => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("ttp_teachers_local");
    if (!stored) return;
    try {
      const list = JSON.parse(stored);
      const match = list.find(t => 
        t.name.toLowerCase().includes(teacherName.toLowerCase()) || 
        teacherName.toLowerCase().includes(t.name.toLowerCase()) ||
        t.name.toLowerCase().replace(/\s/g, "").includes(teacherName.toLowerCase().split(" ")[0])
      );
      if (match) {
        match.completed_hours = (match.completed_hours || 0) + hours;
        localStorage.setItem("ttp_teachers_local", JSON.stringify(list));
      } else {
        const newT = {
          id: `t-${Date.now()}`,
          name: teacherName,
          specialty: "English Instructor",
          status: "active",
          class_types: ["grupal"],
          max_students: 15,
          completed_hours: hours
        };
        list.push(newT);
        localStorage.setItem("ttp_teachers_local", JSON.stringify(list));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleTeacherCheckIn = (classId) => {
    const timeStr = new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
    setClasses(prev => prev.map(c => 
      c.id === classId 
        ? { ...c, status: "in_progress", checkInTime: timeStr } 
        : c
    ));
    setSelectedClass(prev => prev && prev.id === classId ? { ...prev, status: "in_progress", checkInTime: timeStr } : prev);
    showToast("⏰ Check-In registrado: Clase iniciada en tiempo real.");
  };

  const getLateCheckInPenalty = (scheduledSlot, checkInTimeStr) => {
    if (!scheduledSlot || !checkInTimeStr) return 0;
    try {
      const [sh, sm] = scheduledSlot.split(":").map(Number);
      const cleanCheckIn = checkInTimeStr.replace(/(AM|PM)/i, "").trim();
      const [ch, cm] = cleanCheckIn.split(":").map(Number);
      const schedMins = sh * 60 + sm;
      const checkMins = ch * 60 + cm;
      const delay = checkMins - schedMins;
      if (delay > 10) {
        return Number((delay / 60).toFixed(2));
      }
      return 0;
    } catch (e) {
      return 0;
    }
  };

  const handleTeacherCheckOut = (cObj) => {
    const scheduledDuration = getClassDuration(cObj.time);
    const penalty = getLateCheckInPenalty(cObj.slot, cObj.checkInTime);
    const finalDuration = Math.max(0, Number((scheduledDuration - penalty).toFixed(2)));

    setClasses(prev => prev.map(c => 
      c.id === cObj.id 
        ? { ...c, status: "completed" } 
        : c
    ));
    setSelectedClass(prev => prev && prev.id === cObj.id ? { ...prev, status: "completed" } : prev);
    updateTeacherHours(cObj.teacher, finalDuration);
    
    if (penalty > 0) {
      showToast(`⚠️ Clase finalizada. Se aplicó una deducción de -${penalty} hrs por check-in tardío. Horas acumuladas: ${finalDuration} hrs.`);
    } else {
      showToast(`✅ Clase finalizada. Se acumularon ${finalDuration} hrs para el pago de ${cObj.teacher}.`);
    }
  };


  return (
    <div className="flex min-h-screen bg-slate-50 font-inter relative">
      {/* SideNavBar */}
      <Sidebar activeName="Horarios" />

      {/* Main Canvas */}

      <main className="flex-1 md:ml-64 min-h-screen flex flex-col pb-20 md:pb-10">
        {/* TopNavBar */}
        <header className="flex justify-between items-center w-full px-6 md:px-10 h-16 sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200 transition-all">
          <div className="flex items-center gap-8">
            <span className="font-montserrat text-2xl font-bold text-ttp-primary tracking-tight">
              TTP Hub
            </span>
            {/* Search classes/teachers */}
            <div className="relative hidden lg:block">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">
                search
              </span>
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-full text-xs font-semibold w-72 focus:outline-none focus:ring-2 focus:ring-ttp-primary/10 focus:border-ttp-primary transition-all"
                placeholder="Buscar clase o profesor..."
                type="text"
              />
            </div>
          </div>

          <div className="flex items-center gap-6">
            <nav className="hidden lg:flex items-center gap-6">
              <Link
                className="text-slate-600 hover:text-ttp-primary font-medium text-sm transition-colors duration-200"
                href="/"
              >
                Inicio
              </Link>
              <a
                className="text-slate-600 hover:text-ttp-primary font-medium text-sm transition-colors duration-200"
                href="#"
              >
                Reportes
              </a>
              <a
                className="text-slate-600 hover:text-ttp-primary font-medium text-sm transition-colors duration-200"
                href="#"
              >
                Actividad
              </a>
            </nav>

            <div className="flex gap-4 items-center">
              <button
                className="relative p-1.5 text-slate-600 hover:text-ttp-primary hover:bg-slate-50 rounded-full transition-colors"
                title="Notificaciones"
              >
                <span className="material-symbols-outlined text-2xl">notifications</span>
                <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-ttp-primary rounded-full ring-2 ring-white"></span>
              </button>
              <button
                className="p-1.5 text-slate-600 hover:text-ttp-primary hover:bg-slate-50 rounded-full transition-colors"
                title="Centro de Ayuda"
              >
                <span className="material-symbols-outlined text-2xl">help</span>
              </button>

              <div className="relative group cursor-pointer">
                <img
                  alt="Ajustes de perfil del administrador"
                  className="w-9 h-9 rounded-full border-2 border-ttp-primary/30 group-hover:border-ttp-primary transition-all duration-200"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuCOggLERrNgDtNfhJ3G4ire2ddBavtGCFCUcAPI8WNe-qUtANUQsM_mZPm8r9W_WpWi7I_GTlY4ls2e8vB-VlcaLVNK_r4K35LvMAvIgw1U7sH6l0iy3UJvuezbvoS14HpoExpS81O0PP_UNNM4oNQK2K3B_mKHk_yDOrpL_4seytxQM7E1b--BRi1TasI9iKYmIzEL2ed9WSSZcUubr6TFkXoKkzeyw57RmKFdZjBSctQd4jzXzxSF6bPA8DgfRIiJKUm5VDh1iueC"
                />
              </div>
            </div>
          </div>
        </header>

        {/* Content Body */}
        <div className="p-6 md:p-10 max-w-7xl mx-auto w-full space-y-6 flex-grow">
          {/* Header Section */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-5">
            <div>
              <h2 className="font-montserrat text-2xl font-bold text-slate-800 tracking-tight">
                Horarios Visuales
              </h2>
              <p className="text-slate-500 font-semibold text-sm mt-1">
                Semana del {weekStartStr} al {weekEndStr} de {currentWeekDays[0].month}, {currentYear}
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Date Switcher */}
              <div className="flex items-center gap-1 bg-white p-1 rounded-xl shadow-sm border border-slate-200">
                <button
                  onClick={() => setWeekOffset((o) => o - 1)}
                  className="p-2 hover:bg-slate-50 rounded-lg text-slate-600 transition-colors material-symbols-outlined text-base font-bold active:scale-95"
                >
                  chevron_left
                </button>
                <button
                  onClick={() => setWeekOffset(0)}
                  className="font-bold text-[10px] tracking-wider uppercase px-3 text-slate-500 hover:text-ttp-primary active:scale-95 transition-all"
                >
                  Esta Semana
                </button>
                <button
                  onClick={() => setWeekOffset((o) => o + 1)}
                  className="p-2 hover:bg-slate-50 rounded-lg text-slate-600 transition-colors material-symbols-outlined text-base font-bold active:scale-95"
                >
                  chevron_right
                </button>
              </div>

              {/* Add Class Button */}
              <button
                onClick={handleOpenAddClassModal}
                className="bg-ttp-primary text-white px-5 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-all active:scale-95 shadow-md shadow-pink-500/10 text-xs"
              >
                <span className="material-symbols-outlined text-sm font-bold">add</span>
                Agendar Clase
              </button>
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-5 text-[11px] font-bold text-slate-500">
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border border-slate-200 shadow-sm">
              <span className="w-3.5 h-3.5 rounded-full bg-ttp-primary"></span>
              <span>Clases Grupales</span>
            </div>
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border border-slate-200 shadow-sm">
              <span className="w-3.5 h-3.5 rounded-full bg-ttp-private"></span>
              <span>Clases Privadas</span>
            </div>
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border border-slate-200 shadow-sm">
              <span className="w-3.5 h-3.5 rounded-full bg-ttp-club"></span>
              <span>Conversation Club</span>
            </div>
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border border-slate-200 shadow-sm animate-pulse">
              <span className="w-3.5 h-3.5 rounded-full bg-ttp-alert"></span>
              <span className="text-amber-600">Alerta de Pago</span>
            </div>
          </div>

          {/* Calendar Grid Container */}
          <div className="bg-white rounded-3xl border border-slate-200/60 shadow-xl overflow-hidden mb-10">
            <div className="overflow-x-auto">
              <div className="grid grid-cols-[80px_repeat(6,1fr)] min-w-[1000px]">
                {/* Header Row */}
                <div className="p-4 border-b border-r border-slate-200/80 bg-slate-50/50 flex items-center justify-center">
                  <span className="material-symbols-outlined text-ttp-primary text-xl font-bold">schedule</span>
                </div>
                {currentWeekDays.map((day) => {
                  const isToday =
                    new Date().toLocaleDateString() ===
                    new Date(2023, 9, day.num + weekOffset * 7).toLocaleDateString() && weekOffset === 0;

                  return (
                    <div
                      key={day.key}
                      className={`p-4 border-b border-r border-slate-200/80 bg-slate-50/50 text-center ${
                        isToday ? "ring-2 ring-ttp-primary ring-inset bg-pink-50/10" : ""
                      }`}
                    >
                      <p className={`text-[10px] font-bold tracking-wider ${isToday ? "text-ttp-primary" : "text-slate-400"}`}>
                        {day.key}
                      </p>
                      <p className={`font-montserrat text-xl font-extrabold mt-0.5 ${isToday ? "text-ttp-primary" : "text-slate-700"}`}>
                        {day.num}
                      </p>
                    </div>
                  );
                })}

                {/* Calendar Body Slots */}
                {timeSlots.map((slot) => (
                  <React.Fragment key={slot}>
                    {/* Time cell */}
                    <div className="p-4 border-r border-b border-slate-200/80 text-center flex items-center justify-center text-xs font-bold text-slate-400 h-[120px]">
                      {slot}
                    </div>

                    {/* Days cells */}
                    {daysKeys.map((day) => {
                      // Filtrar clases de este día y franja horaria considerando los días seleccionados y las fechas de vigencia
                      const dayClasses = filteredClasses.filter((c) => {
                        // 1. Validar slot
                        if (c.slot !== slot) return false;

                        // 2. Validar si el día actual está en los días activos de la clase
                        const activeDays = getActiveDaysOfClass(c);
                        if (!activeDays.includes(day)) return false;

                        // 3. Validar rango de fechas (solo si existen)
                        if (c.startDate && c.endDate) {
                          const currentIndex = daysKeys.indexOf(day);
                          const dayObj = currentWeekDays.find(d => d.key === day);
                          if (dayObj) {
                            const baseDate = getMondayOfOffsetWeek();
                            baseDate.setDate(baseDate.getDate() + currentIndex);
                            
                            const classStart = new Date(c.startDate + "T00:00:00");
                            const classEnd = new Date(c.endDate + "T23:59:59");
                            
                            if (baseDate < classStart || baseDate > classEnd) return false;
                          }
                        }
                        
                        return true;
                      });

                      return (
                        <div
                          key={day}
                          onClick={() => { if (dayClasses.length === 0) handleOpenCellModal(day, slot); }}
                          className={`p-2.5 border-r border-b border-slate-200/80 h-[120px] relative bg-slate-50/10 flex flex-col gap-2 group/cell ${dayClasses.length === 0 ? "cursor-pointer hover:bg-pink-50/30 transition-colors" : ""}`}
                        >
                          {/* Botón + que aparece al hover en celdas vacías */}
                          {dayClasses.length === 0 && (
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/cell:opacity-100 transition-opacity">
                              <div className="w-8 h-8 rounded-full bg-ttp-primary/10 flex items-center justify-center">
                                <span className="material-symbols-outlined text-ttp-primary text-lg">add</span>
                              </div>
                            </div>
                          )}
                          {dayClasses.map((item, idx) => {
                            const borderCol =
                              item.type === "grupal"
                                ? "border-l-ttp-primary border-[#ffccd5]"
                                : item.type === "privada"
                                ? "border-l-ttp-private border-[#d9d0ff]"
                                : "border-l-ttp-club border-[#bfead6]";

                            const bgCol =
                              item.type === "grupal"
                                ? "bg-[#fff2f5] hover:bg-[#ffe5ea]"
                                : item.type === "privada"
                                ? "bg-[#f5f3ff] hover:bg-[#ebe5ff]"
                                : "bg-[#effcf6] hover:bg-[#dbf7ea]";

                            const textCol =
                              item.type === "grupal"
                                ? "text-ttp-primary"
                                : item.type === "privada"
                                ? "text-ttp-private"
                                : "text-ttp-club";

                            const cardStyle = getCardStyle(item, idx, dayClasses.length);

                            return (
                              <div
                                key={item.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedClass(item);
                                }}
                                className={`rounded-xl border border-l-4 ${borderCol} ${bgCol} p-2 flex flex-col justify-between cursor-pointer card-shadow hover:-translate-y-0.5 active:scale-95 transition-all duration-200 group/card ${
                                  (debtorsByClass[item.id]?.length > 0) ? "ring-2 ring-ttp-alert/40 border-ttp-alert" : ""
                                }`}
                                style={cardStyle}
                              >
                                <div className="flex justify-between items-center min-w-0 leading-none">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <span className={`text-[9px] font-bold ${textCol} flex-shrink-0`}>{item.time}</span>
                                    <span className="text-[11px] font-extrabold text-slate-800 truncate" title={item.title}>
                                      {item.title}
                                    </span>
                                  </div>
                                  <span className="flex items-center gap-0.5 text-[9px] font-extrabold text-slate-500 bg-white/70 px-1.5 py-0.5 rounded-full flex-shrink-0 border border-slate-100">
                                    <span className="material-symbols-outlined text-[10px] font-bold">
                                      {item.type === "privada" ? "person" : "group"}
                                    </span>
                                    {item.capacity}
                                  </span>
                                </div>
                                <div className="flex justify-between items-center min-w-0 leading-none mt-1">
                                  <span className="text-[10px] text-slate-500 font-semibold truncate flex-1 min-w-0 pr-1" title={item.teacher}>
                                    Prof: {item.teacher}
                                  </span>
                                  {debtorsByClass[item.id]?.length > 0 && (
                                    <span
                                      className="material-symbols-outlined text-ttp-alert text-[11px] font-bold animate-bounce flex-shrink-0"
                                      title={`${debtorsByClass[item.id].length} alumno(s) con pago pendiente`}
                                    >
                                      warning
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}

                          {/* Botón + para agregar más clases/grupos en celdas con clases ya registradas */}
                          {dayClasses.length > 0 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenCellModal(day, slot);
                              }}
                              style={{
                                position: 'absolute',
                                top: `calc(8px + ${dayClasses.length} * (52px + 6px))`,
                                left: '8px',
                                right: '8px',
                                height: '30px',
                                zIndex: 10
                              }}
                              className="border border-dashed border-slate-200 hover:border-ttp-primary/40 rounded-xl text-[10px] font-bold text-slate-400 hover:text-ttp-primary hover:bg-pink-50/20 transition-all flex items-center justify-center gap-1 opacity-0 group-hover/cell:opacity-100 cursor-pointer"
                              title="Agendar otro grupo en este horario"
                            >
                              <span className="material-symbols-outlined text-[12px] font-bold">add</span>
                              Añadir grupo
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Floating Action Button (FAB) for quick creation */}
      <button
        onClick={handleOpenAddClassModal}
        className="fixed bottom-8 right-8 w-14 h-14 bg-[#e74d8a] hover:bg-[#d63d79] text-white rounded-full shadow-xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-50 shadow-pink-500/20"
      >
        <span className="material-symbols-outlined text-2xl font-bold">add</span>
      </button>

      {/* Class Details Modal */}
      {selectedClass && (
        <div className="modal-backdrop fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) setSelectedClass(null); }}>
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden border border-slate-100 modal-card">
            <div className="p-6 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-montserrat text-lg font-bold text-slate-800 flex items-center gap-2">
                <span className="material-symbols-outlined text-ttp-primary">calendar_month</span>
                Detalles de la Clase
              </h3>
              <button
                onClick={() => setSelectedClass(null)}
                className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-200/50 rounded-full transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="space-y-1">
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                  selectedClass.type === "grupal"
                    ? "bg-pink-50 text-ttp-primary border border-pink-100"
                    : selectedClass.type === "privada"
                    ? "bg-purple-50 text-ttp-private border border-purple-100"
                    : "bg-sky-50 text-ttp-club border border-sky-100"
                }`}>
                  {selectedClass.type}
                </span>
                <h4 className="font-montserrat text-xl font-bold text-slate-800 pt-1.5">{selectedClass.title}</h4>
              </div>

              {(() => {
                const debtors = debtorsByClass[selectedClass.id] || [];
                if (debtors.length === 0) return null;
                return (
                  <div className="p-4 bg-amber-50 border border-ttp-alert/30 rounded-2xl flex items-start gap-3">
                    <span className="material-symbols-outlined text-ttp-alert text-xl flex-shrink-0">warning</span>
                    <div className="flex-1 min-w-0">
                      <h5 className="text-xs font-bold text-amber-800">
                        Alerta de Facturación · {debtors.length} alumno{debtors.length !== 1 ? "s" : ""} con pago pendiente
                      </h5>
                      <ul className="mt-2 space-y-1.5">
                        {debtors.map(s => (
                          <li key={s.id} className="flex items-center gap-2 bg-amber-100/60 rounded-xl px-3 py-1.5">
                            <span className="material-symbols-outlined text-amber-600 text-sm">person</span>
                            <span className="text-[11px] font-bold text-amber-900 flex-1 truncate">
                              {s.name} {s.last_name || ""}
                            </span>
                            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-200 text-amber-800 whitespace-nowrap">
                              {DEBT_LABEL[s.payment_status] || s.payment_status}
                            </span>
                          </li>
                        ))}
                      </ul>
                      <p className="text-[10px] text-amber-600 font-medium mt-2">
                        Comunícate con {debtors.length === 1 ? "este alumno" : "estos alumnos"} para regularizar el pago.
                      </p>
                    </div>
                  </div>
                );
              })()}

              {/* Google Meet & Aula Virtual */}
              <div className="border-t border-slate-100 pt-4 space-y-3">
                <span className="text-slate-400 block font-bold uppercase tracking-wider text-[9px]">Aula Virtual (Google Meet)</span>
                {selectedClass.meetLink ? (
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/50 flex justify-between items-center text-xs">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 block uppercase">Enlace Generado</span>
                      <a href={selectedClass.meetLink} target="_blank" rel="noreferrer" className="text-ttp-primary font-bold hover:underline flex items-center gap-1 mt-1 font-mono">
                        <span className="material-symbols-outlined text-sm font-bold">video_camera_front</span>
                        {selectedClass.meetLink}
                      </a>
                    </div>
                    <a href={selectedClass.meetLink} target="_blank" rel="noreferrer" className="bg-ttp-primary text-white p-2 rounded-xl hover:opacity-90 active:scale-95 transition-all shadow-sm flex items-center justify-center">
                      <span className="material-symbols-outlined text-sm font-bold block">open_in_new</span>
                    </a>
                  </div>
                ) : (
                  <button
                    onClick={() => handleGenerateGoogleMeetLink(selectedClass.id)}
                    disabled={isMeetGenerating}
                    className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 rounded-2xl text-xs font-bold transition-all active:scale-95 flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {isMeetGenerating ? (
                      <>
                        <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
                        <span>Generando enlace Meet en Google...</span>
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-sm">video_call</span>
                        <span>Crear Sala de Google Meet (Calendar)</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Pase de Lista de Alumnos (Control del Administrador) */}
              <div className="border-t border-slate-100 pt-4 space-y-3">
                <span className="text-slate-400 block font-bold uppercase tracking-wider text-[9px]">Estado de Asistencia de Alumnos</span>
                <div className="divide-y divide-slate-100 border border-slate-200/50 rounded-2xl overflow-hidden bg-slate-50/20">
                  {students.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400 font-semibold">
                      No hay estudiantes registrados
                    </div>
                  ) : (
                    (attendance[selectedClass.id] || students.map(s => ({
                      id: s.id,
                      name: `${s.name} ${s.last_name || ""}`.trim(),
                      email: s.email || "",
                      status: "sin_asignar"
                    }))).map((student) => (
                    <div key={student.id} className="p-3.5 flex justify-between items-center text-xs hover:bg-slate-50/50 transition-colors">
                      <div>
                        <p className="font-bold text-slate-800">{student.name}</p>
                        <p className="text-[10px] text-slate-400 font-semibold">{student.email}</p>
                      </div>
                      <div className="flex items-center">
                        {student.status === "presente" ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold border bg-teal-50 border-teal-200 text-teal-600 flex items-center gap-1 shadow-sm">
                            <span className="w-1.5 h-1.5 rounded-full bg-teal-500"></span>
                            Presente
                          </span>
                        ) : student.status === "retardo" ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold border bg-amber-50 border-amber-200 text-amber-600 flex items-center gap-1 shadow-sm">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                            Retardo
                          </span>
                        ) : student.status === "falta" ? (
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
                  )))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs font-medium border-t border-b border-slate-100 py-4">
                <div className="space-y-0.5">
                  <span className="text-slate-400 block font-bold uppercase tracking-wider text-[9px]">Días de Clase</span>
                  <span className="text-slate-800 font-bold">
                    {selectedClass.daysSelected 
                      ? selectedClass.daysSelected.join(", ") 
                      : selectedClass.dayStart && selectedClass.dayEnd && selectedClass.dayStart !== selectedClass.dayEnd 
                      ? `${selectedClass.dayStart} a ${selectedClass.dayEnd}` 
                      : selectedClass.dayStart || selectedClass.day || "LUN"}
                  </span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-slate-400 block font-bold uppercase tracking-wider text-[9px]">Horario (Inicio - Fin)</span>
                  <span className="text-slate-800 font-bold">{selectedClass.time}</span>
                </div>
                <div className="space-y-0.5 pt-2">
                  <span className="text-slate-400 block font-bold uppercase tracking-wider text-[9px]">Vigencia (Fechas)</span>
                  <span className="text-slate-800 font-bold">
                    {selectedClass.startDate && selectedClass.endDate 
                      ? `${new Date(selectedClass.startDate + "T00:00:00").toLocaleDateString("es-ES", {day: "numeric", month: "short"})} al ${new Date(selectedClass.endDate + "T00:00:00").toLocaleDateString("es-ES", {day: "numeric", month: "short", year: "numeric"})}`
                      : "Indefinida (Plantilla Fija)"}
                  </span>
                </div>
                <div className="space-y-0.5 pt-2">
                  <span className="text-slate-400 block font-bold uppercase tracking-wider text-[9px]">Docente Asignado</span>
                  <span className="text-slate-800 font-bold">{selectedClass.teacher}</span>
                </div>
                <div className="space-y-0.5 pt-2">
                  <span className="text-slate-400 block font-bold uppercase tracking-wider text-[9px]">Tipo de Aula</span>
                  <span className="text-slate-800 font-bold capitalize">{selectedClass.type}</span>
                </div>
                <div className="space-y-0.5 pt-2">
                  <span className="text-slate-400 block font-bold uppercase tracking-wider text-[9px]">Cupo / Alumnos</span>
                  <span className="text-slate-800 font-bold">{selectedClass.capacity} inscritos</span>
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button
                  onClick={() => handleDeleteClass(selectedClass.id, selectedClass.title)}
                  className="px-4 py-2 border border-red-200 text-red-600 hover:bg-red-50 rounded-xl font-semibold text-xs active:scale-95 transition-all flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-sm">delete</span>
                  Cancelar Clase
                </button>
                <button
                  onClick={() => handleRescheduleClass(selectedClass)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200/80 text-slate-700 rounded-xl font-semibold text-xs active:scale-95 transition-all flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-sm">edit</span>
                  Editar Horario
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Class Modal */}
      {isAddClassModalOpen && (
        <div className="modal-backdrop fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden border border-slate-100 modal-card">
            <div className="p-6 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-montserrat text-lg font-bold text-slate-800 flex items-center gap-2">
                <span className="material-symbols-outlined text-ttp-primary">{editingClassId ? "edit_square" : "add_box"}</span>
                {editingClassId ? "Editar Horario de Clase" : "Agendar Nueva Clase"}
              </h3>
              <button
                onClick={handleCloseAddModal}
                className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-200/50 rounded-full transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <form onSubmit={handleAddClass} className="p-6 space-y-4">
              {/* Curso del catálogo */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Curso</label>
                {coursesCatalog.length === 0 ? (
                  <div className="w-full px-4 py-2.5 border border-amber-200 bg-amber-50 rounded-xl text-xs font-semibold text-amber-700">
                    ⚠️ No hay cursos en el catálogo. Crea cursos en Configuración → Cursos primero.
                  </div>
                ) : (
                  <select
                    required
                    value={newClass.title}
                    onChange={(e) => {
                      const selected = coursesCatalog.find(c => c.name === e.target.value);
                      // Autocompletar fechas si el curso tiene fechas específicas
                      const autoStart = selected?.durationType === "dates" && selected?.courseStartDate ? selected.courseStartDate : "";
                      const autoEnd   = selected?.durationType === "dates" && selected?.courseEndDate   ? selected.courseEndDate   : "";
                      setNewClass(prev => ({
                        ...prev,
                        title: e.target.value,
                        teacher: "",
                        startDate: autoStart,
                        endDate: autoEnd,
                      }));
                    }}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-ttp-primary/10 focus:border-ttp-primary text-sm font-medium text-slate-700 bg-white"
                  >
                    <option value="">— Seleccionar curso —</option>
                    {coursesCatalog.map((c) => (
                      <option key={c.id} value={c.name}>{c.name}{c.level && c.level !== "none" ? ` (${c.level})` : ""}</option>
                    ))}
                  </select>
                )}
                {/* Info de vigencia del curso seleccionado */}
                {newClass.title && (() => {
                  const sel = coursesCatalog.find(c => c.name === newClass.title);
                  if (!sel) return null;
                  if (sel.durationType === "dates" && sel.courseStartDate && sel.courseEndDate) {
                    return (
                      <p className="text-[10px] text-sky-600 font-semibold mt-1 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[12px]">date_range</span>
                        Vigencia del curso: {new Date(sel.courseStartDate + "T00:00:00").toLocaleDateString("es-ES", {day:"numeric",month:"short",year:"numeric"})} — {new Date(sel.courseEndDate + "T00:00:00").toLocaleDateString("es-ES", {day:"numeric",month:"short",year:"numeric"})}
                      </p>
                    );
                  }
                  if (sel.duration) {
                    return (
                      <p className="text-[10px] text-slate-400 font-semibold mt-1 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[12px]">calendar_month</span>
                        Duración: {sel.duration}
                      </p>
                    );
                  }
                  return null;
                })()}
              </div>

              {/* Días de Impartición (Tags Interactivos Premium) */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Días de Impartición
                </label>
                <div className="flex flex-wrap gap-2">
                  {daysKeys.map((d) => {
                    const isSelected = (newClass.daysSelected || []).includes(d);
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => {
                          const currentSelected = newClass.daysSelected || [];
                          const updated = currentSelected.includes(d)
                            ? currentSelected.filter(day => day !== d)
                            : [...currentSelected, d];
                          setNewClass(prev => ({
                            ...prev,
                            // Asegurar que al menos un día quede seleccionado
                            daysSelected: updated.length > 0 ? updated : [d]
                          }));
                        }}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer active:scale-95 ${
                          isSelected
                            ? "bg-ttp-primary text-white shadow-md shadow-pink-500/10 hover:opacity-90"
                            : "bg-slate-100 text-slate-500 hover:bg-slate-200/60"
                        }`}
                      >
                        {d === "LUN" ? "Lunes" : d === "MAR" ? "Martes" : d === "MIÉ" ? "Miércoles" : d === "JUE" ? "Jueves" : d === "VIE" ? "Viernes" : "Sábado"}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Rango de Fechas (Vigencia Opcional) */}
              <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100 space-y-3">
                <div className="flex justify-between items-center">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Vigencia de Ciclo <span className="text-[10px] text-slate-400 font-semibold normal-case">(Opcional)</span>
                  </label>
                  <span className="text-[9px] bg-slate-200/50 text-slate-600 font-extrabold px-2 py-0.5 rounded-full uppercase">
                    {!newClass.startDate && !newClass.endDate ? "Permanente" : "Vigente"}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 font-semibold leading-relaxed">
                  Deja estos campos en blanco si deseas crear una plantilla de horario permanente que se repita todas las semanas.
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Fecha de Inicio</label>
                    <input
                      type="date"
                      value={newClass.startDate || ""}
                      onChange={(e) => setNewClass({ ...newClass, startDate: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-ttp-primary/10 focus:border-ttp-primary text-xs font-medium text-slate-600 bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Fecha de Fin</label>
                    <input
                      type="date"
                      value={newClass.endDate || ""}
                      onChange={(e) => setNewClass({ ...newClass, endDate: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-ttp-primary/10 focus:border-ttp-primary text-xs font-medium text-slate-600 bg-white"
                    />
                  </div>
                </div>
                {(newClass.startDate || newClass.endDate) && (
                  <button
                    type="button"
                    onClick={() => setNewClass(prev => ({ ...prev, startDate: "", endDate: "" }))}
                    className="text-[10px] font-bold text-ttp-primary hover:underline flex items-center gap-0.5 pt-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[12px]">clear_all</span>
                    Limpiar fechas y hacer Permanente
                  </button>
                )}
              </div>

              {/* Horas */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Hora de Inicio</label>
                  <input
                    required
                    type="time"
                    value={newClass.startTime}
                    onChange={(e) => {
                      const selTime = e.target.value;
                      const [h, m] = selTime.split(":").map(Number);
                      const nextH = (h + 1) % 24;
                      const autoEndTime = `${String(nextH).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
                      setNewClass(prev => ({
                        ...prev,
                        startTime: selTime,
                        endTime: autoEndTime,
                        slot: getSlotFromTime(selTime),
                        time: `${selTime} - ${autoEndTime}`
                      }));
                    }}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-ttp-primary/10 focus:border-ttp-primary text-sm font-medium text-slate-700 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Hora de Fin</label>
                  <input
                    required
                    type="time"
                    value={newClass.endTime}
                    onChange={(e) => {
                      const selTime = e.target.value;
                      setNewClass(prev => ({
                        ...prev,
                        endTime: selTime,
                        time: `${prev.startTime} - ${selTime}`
                      }));
                    }}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-ttp-primary/10 focus:border-ttp-primary text-sm font-medium text-slate-700 bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Tipo de Clase */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Tipo de Clase</label>
                  <select
                    value={newClass.type}
                    onChange={(e) => setNewClass({ ...newClass, type: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-ttp-primary/10 focus:border-ttp-primary text-sm font-medium text-slate-700 bg-white"
                  >
                    <option value="grupal">Grupal</option>
                    <option value="privada">Privada</option>
                    <option value="club">Conversation Club</option>
                  </select>
                </div>

                {/* Cupo / Alumnos */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Cupo Inicial</label>
                  <input
                    required
                    type="number"
                    min="1"
                    placeholder="Escribe el cupo..."
                    value={newClass.capacity}
                    onChange={(e) => setNewClass({ ...newClass, capacity: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-ttp-primary/10 focus:border-ttp-primary text-sm font-medium"
                  />
                </div>
              </div>

              {/* Docente */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Docente Asignado</label>
                {(() => {
                  // Filtrar maestros habilitados para el curso seleccionado
                  const selectedCourse = coursesCatalog.find(c => c.name === newClass.title);
                  const allowedIds = selectedCourse?.allowedTeachers || [];
                  // Si el curso tiene maestros asignados, filtrar; si no, mostrar todos
                  const filteredTeachers = allowedIds.length > 0
                    ? teachersList.filter(t => allowedIds.includes(t.id))
                    : teachersList;
                  const getTeacherName = (t) => `${t.firstName || t.name || ""} ${t.lastName || ""}`.trim() || t.email || t.id;
                  return (
                    <>
                      <select
                        required
                        value={newClass.teacher}
                        onChange={(e) => setNewClass({ ...newClass, teacher: e.target.value })}
                        className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-ttp-primary/10 focus:border-ttp-primary text-sm font-medium text-slate-700 bg-white"
                      >
                        <option value="">Seleccionar docente...</option>
                        {filteredTeachers.map((t) => (
                          <option key={t.id} value={getTeacherName(t)}>{getTeacherName(t)}</option>
                        ))}
                      </select>
                      {filteredTeachers.length === 0 && newClass.title && (
                        <p className="text-[10px] text-amber-600 font-semibold mt-1">
                          ⚠️ Este curso no tiene maestros habilitados. Edita el curso en Configuración → Cursos para asignarlos.
                        </p>
                      )}
                      {teachersList.length === 0 && (
                        <p className="text-[10px] text-rose-500 font-semibold mt-1">
                          ⚠️ No hay docentes registrados. Crea docentes en el módulo de Maestros primero.
                        </p>
                      )}
                    </>
                  );
                })()}
              </div>

              {/* Acciones */}
              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleCloseAddModal}
                  className="px-5 py-2 rounded-xl text-slate-500 hover:bg-slate-50 font-semibold text-sm active:scale-95 transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-ttp-primary hover:opacity-90 text-white font-semibold text-sm shadow-md active:scale-95 transition-all"
                >
                  {editingClassId ? "Guardar Cambios" : "Guardar Clase"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* ===== GORGEOUS DELETE/CONFIRM MODAL ===== */}
      {deleteConfirmModal && (
        <div 
          className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setDeleteConfirmModal(null); }}
        >
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-7 border border-slate-100 modal-card space-y-5 text-center">
            <div className="w-14 h-14 rounded-2xl bg-rose-50 mx-auto flex items-center justify-center">
              <span className="material-symbols-outlined text-2xl text-rose-655 font-bold">delete_forever</span>
            </div>
            <div>
              <h3 className="font-montserrat font-bold text-slate-800 text-lg">¿Cancelar Clase?</h3>
              <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                ¿Estás seguro de que deseas cancelar permanentemente la clase <strong className="text-slate-700 font-semibold">"{deleteConfirmModal.name}"</strong>?
              </p>
              <p className="text-[11px] text-rose-655 bg-rose-50 border border-rose-100/50 rounded-xl px-3 py-2 mt-3 font-semibold leading-relaxed">
                ⚠️ Esta acción es irreversible y eliminará el horario programado.
              </p>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => setDeleteConfirmModal(null)} 
                className="flex-1 py-2.5 border border-slate-200 text-slate-500 rounded-xl font-semibold text-xs hover:bg-slate-50 active:scale-95 transition-all"
              >
                Cancelar
              </button>
              <button 
                onClick={() => {
                  deleteConfirmModal.onConfirm();
                  setDeleteConfirmModal(null);
                }} 
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs active:scale-95 transition-all shadow-md shadow-rose-600/10"
              >
                Sí, Cancelar Clase
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
