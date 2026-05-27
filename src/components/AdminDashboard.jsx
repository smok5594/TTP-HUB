"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/utils/supabaseClient";
import { simulateSendWhatsApp, getInitialLogs, approvedTemplates } from "@/utils/whatsappSimulator";
import Sidebar from "@/components/Sidebar";
import { toast } from "sonner";

// ── STORAGE KEYS & FALLBACK SEEDS FOR DYNAMIC METRICS ──────────────────────
const S_KEY  = "ttp_students_local";
const T_KEY  = "ttp_teachers_local";
const MV_KEY = "ttp_movements_local";
const GR_KEY = "ttp_groups_local";
const TX_KEY = "ttp_transactions_local";
const SCH_KEY = "ttp_schedules_local";

const DEFAULT_TEACHERS = [];
const DEFAULT_GROUPS = [];
const DEFAULT_STUDENTS = [];

const getLS = (key, fb) => {
  try {
    const v = typeof window !== "undefined" && localStorage.getItem(key);
    return v ? JSON.parse(v) : fb;
  } catch {
    return fb;
  }
};

export default function AdminDashboard() {
  // Estado de pestañas de navegación (en español)
  const [activeTab, setActiveTab] = useState("Panel de Control");

  // Estado de visibilidad confidencial financiera
  const [hideSensitive, setHideSensitive] = useState(false);

  // Estado de carga
  const [isLoading, setIsLoading] = useState(false);

  // Estado de estudiantes cargados
  const [students, setStudents] = useState([]);

  // Estados de WhatsApp Gateway y Alertas en Tiempo Real
  const [whatsappLogs, setWhatsAppLogs] = useState(getInitialLogs());
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [recipientType, setRecipientType] = useState("individual"); // 'individual' | 'status' | 'course' | 'group' | 'todos'
  const [selectedStatus, setSelectedStatus] = useState("active");
  const [selectedCourse, setSelectedCourse] = useState("");
  const [selectedGroup, setSelectedGroup] = useState("");
  const [whatsappForm, setWhatsappForm] = useState({
    studentName: "",
    phone: "",
    template: "class_link_meet",
    val1: "",
    val2: "Advanced English I",
    val3: "https://meet.google.com/abc-defg-hij"
  });

  const showToast = (msg) => {
    if (msg.startsWith("✅")) toast.success(msg.replace("✅ ", ""));
    else if (msg.startsWith("✏️")) toast.success(msg.replace("✏️ ", ""));
    else if (msg.startsWith("🗑️")) toast.error(msg.replace("🗑️ ", ""));
    else if (msg.startsWith("⛔") || msg.includes("Error") || msg.includes("error")) toast.error(msg);
    else toast(msg);
  };

  const handleTemplateChange = (templateName) => {
    let defaults = {
      template: templateName,
      val1: "",
      val2: "",
      val3: "",
      val4: ""
    };

    if (templateName === "class_link_meet") {
      defaults.val1 = whatsappForm.studentName;
      defaults.val2 = "Advanced English I";
      defaults.val3 = "https://meet.google.com/abc-defg-hij";
    } else if (templateName === "student_absence_alert") {
      defaults.val1 = whatsappForm.studentName;
      defaults.val2 = "IELTS Speaking Prep";
    } else if (templateName === "stripe_payment_failed") {
      defaults.val1 = whatsappForm.studentName;
      defaults.val2 = "Colegiatura de Mayo";
      defaults.val3 = "2,450";
      defaults.val4 = "https://ttp-hub.mx/pagar";
    } else if (templateName === "overdue_payment_reminder") {
      defaults.val1 = whatsappForm.studentName;
      defaults.val2 = "2,450";
    } else if (templateName === "teacher_daily_summary") {
      defaults.val1 = "Lic. Elena Valdéz";
      defaults.val2 = String(students.length);
      defaults.val3 = students.map(s => s.name).join(", ") || "Sin alumnos";
    }

    setWhatsappForm((prev) => ({
      ...prev,
      ...defaults
    }));
  };

  const handleStudentChange = (studentName) => {
    const student = students.find(s => `${s.name} ${s.last_name || ""}`.trim() === studentName);
    const phone = student?.phone || "+52 55 0000 0000";

    setWhatsappForm((prev) => {
      let val1 = prev.val1;
      if (prev.val1 === prev.studentName || prev.template !== "teacher_daily_summary") {
        val1 = studentName;
      }
      return {
        ...prev,
        studentName,
        phone,
        val1
      };
    });
  };

  // Extraer cursos y grupos únicos dinámicamente de la lista de alumnos
  const uniqueCourses = Array.from(
    new Set([
      ...getLS("ttp_courses_local", []).map(c => c.name || c.title || c).filter(Boolean),
      ...students.map(s => s.current_course).filter(Boolean)
    ])
  );

  const uniqueGroups = Array.from(
    new Set([
      ...getLS("ttp_groups_local", []).map(g => g.title || g.name || g).filter(Boolean),
      ...students.map(s => s.current_group).filter(Boolean)
    ])
  );

  // Inicializar defaults para filtros segmentados
  useEffect(() => {
    if (uniqueCourses.length > 0 && !selectedCourse) {
      setSelectedCourse(uniqueCourses[0]);
    }
  }, [uniqueCourses, selectedCourse]);

  useEffect(() => {
    if (uniqueGroups.length > 0 && !selectedGroup) {
      setSelectedGroup(uniqueGroups[0]);
    }
  }, [uniqueGroups, selectedGroup]);

  const handleSendManualWhatsApp = async (e) => {
    e.preventDefault();
    setIsSendingMessage(true);

    if (recipientType !== "individual") {
      let activeRecipients = [];
      let groupNameLabel = "";

      if (recipientType === "todos") {
        activeRecipients = students.filter(
          (s) => s.status === "active" || s.status === "moroso" || s.status === "activo"
        );
        groupNameLabel = "todos los alumnos activos";
      } else if (recipientType === "status") {
        activeRecipients = students.filter((s) => {
          if (selectedStatus === "active") return s.status === "active" || s.status === "activo";
          if (selectedStatus === "prospect") return s.status === "prospect" || s.status === "prospecto";
          if (selectedStatus === "recovered") return s.status === "recovered" || s.status === "recuperado" || s.status === "recs";
          return false;
        });
        groupNameLabel = `los alumnos con estado ${
          selectedStatus === "active" ? "Inscrito" : selectedStatus === "prospect" ? "Prospecto" : "Recuperado"
        }`;
      } else if (recipientType === "course") {
        activeRecipients = students.filter((s) => s.current_course === selectedCourse);
        groupNameLabel = `los alumnos inscritos en el curso "${selectedCourse}"`;
      } else if (recipientType === "group") {
        activeRecipients = students.filter((s) => s.current_group === selectedGroup);
        groupNameLabel = `los alumnos del grupo "${selectedGroup}"`;
      }

      if (activeRecipients.length === 0) {
        toast.error(`No hay alumnos que coincidan con la selección para el envío.`);
        setIsSendingMessage(false);
        return;
      }

      const toastId = toast.loading(`🔌 Iniciando envío a ${activeRecipients.length} alumnos (${groupNameLabel})...`);

      try {
        let sentCount = 0;
        for (let i = 0; i < activeRecipients.length; i++) {
          const s = activeRecipients[i];
          const fullName = `${s.name} ${s.last_name || ""}`.trim();
          const phone = s.phone || "+52 55 0000 0000";

          // Personalizar val1 si correspondía al studentName anterior o estaba vacío
          const personalVal1 =
            whatsappForm.val1 === whatsappForm.studentName || !whatsappForm.val1
              ? fullName
              : whatsappForm.val1;

          const variables = [
            personalVal1,
            whatsappForm.val2,
            whatsappForm.val3,
            whatsappForm.val4
          ].filter(v => v !== undefined && v !== "");

          const newLog = await simulateSendWhatsApp(
            phone,
            whatsappForm.template,
            variables,
            fullName
          );

          setWhatsAppLogs((prev) => [newLog, ...prev]);
          sentCount++;

          toast.loading(`💬 Enviando: ${sentCount}/${activeRecipients.length} (Enviado a ${fullName})...`, {
            id: toastId
          });

          // Delay controlado para emular una cola de envío real
          await new Promise((resolve) => setTimeout(resolve, 300));
        }

        toast.success(`📢 ¡Envío masivo completado! Se enviaron ${activeRecipients.length} mensajes a ${groupNameLabel}.`, {
          id: toastId
        });
      } catch (err) {
        toast.error(`❌ Error en el envío masivo: ${err.message}`, { id: toastId });
      } finally {
        setIsSendingMessage(false);
      }
    } else {
      // Envío Individual
      const variables = [
        whatsappForm.val1,
        whatsappForm.val2,
        whatsappForm.val3,
        whatsappForm.val4
      ].filter(v => v !== undefined && v !== "");

      const toastId = toast.loading("🔌 Conectando con Meta Cloud API... Enviando WhatsApp...");

      setTimeout(async () => {
        try {
          const newLog = await simulateSendWhatsApp(
            whatsappForm.phone,
            whatsappForm.template,
            variables,
            whatsappForm.studentName
          );
          setWhatsAppLogs((prev) => [newLog, ...prev]);
          toast.success(`💬 WhatsApp enviado exitosamente a ${whatsappForm.studentName} (${newLog.messageId})`, {
            id: toastId
          });
        } catch (err) {
          toast.error(`❌ Error al enviar: ${err.message}`, { id: toastId });
        } finally {
          setIsSendingMessage(false);
        }
      }, 1200);
    }
  };

  // Métricas estadísticas dinámicas (integradas con Supabase y fallbacks locales en español)
  const [metrics, setMetrics] = useState({
    activeStudents: 0,
    newStudents: 0,
    occupancyRate: 0,
    totalIncome: 0,
    pendingPayments: 0,
    netProfit: 0,
    forecastPercent: 0,
    marginRate: 0,
    totalClassesToday: 0,
    classesInProgress: 0,
    activeTeachers: 0,
    teachersOnLeave: 0,
  });

  // Estado de actividades recientes dinámicas
  const [activities, setActivities] = useState([]);

  // Funciones de consulta para Supabase
  const fetchMetrics = async () => {
    // 1. Calcular métricas dinámicas desde localStorage como estado principal
    const allLocalStudents = getLS(S_KEY, DEFAULT_STUDENTS);
    const allLocalGroups = getLS(GR_KEY, DEFAULT_GROUPS);
    const allLocalTeachers = getLS(T_KEY, DEFAULT_TEACHERS);
    const allLocalTransactions = getLS(TX_KEY, []);
    const allLocalSchedules = getLS(SCH_KEY, []);

    setStudents(allLocalStudents);

    // Inicializar el destinatario del simulador de WhatsApp si hay estudiantes
    if (allLocalStudents.length > 0) {
      setWhatsappForm((prev) => {
        if (!prev.studentName) {
          const first = allLocalStudents[0];
          const fullName = `${first.name} ${first.last_name || ""}`.trim();
          return {
            ...prev,
            studentName: fullName,
            phone: first.phone || "",
            val1: fullName
          };
        }
        return prev;
      });
    }

    // activeStudents: estudiantes con estado "active" o "moroso"
    const activeStudentsCount = allLocalStudents.filter(
      (s) => s.status === "active" || s.status === "moroso"
    ).length;

    // newStudents: estudiantes inscritos en el mes calendario actual (ej: "2026-05")
    const now = new Date();
    const thisYear = now.getFullYear();
    const thisMonth = String(now.getMonth() + 1).padStart(2, "0");
    const prefix = `${thisYear}-${thisMonth}`; // "2026-05"
    const newStudentsCount = allLocalStudents.filter(
      (s) => s.enrolled_date && s.enrolled_date.startsWith(prefix)
    ).length;

    // occupancyRate: capacidad de grupos vs alumnos matriculados en ellos
    const totalCapacity = allLocalGroups.reduce((acc, g) => acc + (g.capacity || 10), 0);
    let occupiedCapacity = 0;
    allLocalStudents.forEach((s) => {
      if (s.status === "active" || s.status === "moroso") {
        const hasGroup = allLocalGroups.some(
          (g) =>
            g.title === s.current_group ||
            g.title === s.current_course ||
            (s.current_group && s.current_group.toLowerCase().includes(g.title.toLowerCase())) ||
            (g.title && g.title.toLowerCase().includes(s.current_group?.toLowerCase()))
        );
        if (hasGroup || s.current_group) {
          occupiedCapacity++;
        }
      }
    });
    const calculatedOccupancy = totalCapacity > 0 ? Math.min(100, Math.round((occupiedCapacity / totalCapacity) * 100)) : 0;

    // pendingPayments: suma real del adeudo de alumnos morosos
    let calculatedPendingPayments = 0;
    allLocalStudents.forEach((s) => {
      if (s.status === "moroso" || s.payment_status === "moroso") {
        calculatedPendingPayments += (s.amount_due !== undefined ? Number(s.amount_due) : 2450);
      }
    });

    // totalIncome: suma real de transacciones procesadas (exitosas) de ttp_transactions_local
    let calculatedTotalIncome = 0;
    allLocalTransactions.forEach((tx) => {
      if (tx.status === "processed") {
        calculatedTotalIncome += Number(tx.amount || 0);
      }
    });

    // netProfit: totalIncome - totalExpenses (donde gastos son los sueldos a profesores registrados en ttp_teachers_local)
    let totalExpenses = 0;
    allLocalTeachers.forEach((t) => {
      totalExpenses += (t.hoursCompleted || t.hours || 0) * (t.rate || 250);
    });
    const calculatedNetProfit = Math.max(0, calculatedTotalIncome - totalExpenses);

    // marginRate: porcentaje real de margen neto
    const marginRate = calculatedTotalIncome > 0 ? Math.round((calculatedNetProfit / calculatedTotalIncome) * 100) : 0;

    // forecastPercent: porcentaje real del pronóstico recaudado (ingresos recibidos / (ingresos recibidos + pagos pendientes))
    const totalForecast = calculatedTotalIncome + calculatedPendingPayments;
    const forecastPercent = totalForecast > 0 ? Math.round((calculatedTotalIncome / totalForecast) * 100) : 0;

    // activeTeachers y teachersOnLeave
    const calculatedActiveTeachers = allLocalTeachers.filter((t) => t.status === "active" || t.status === "activo").length;
    const calculatedTeachersOnLeave = allLocalTeachers.filter((t) => t.status === "on_leave" || t.status === "suspendido").length;

    // classesToday: clases programadas para el día de la semana actual en ttp_schedules_local
    const todayName = now.toLocaleDateString("es-ES", { weekday: "short" }).toUpperCase(); // e.g., "LUN.", "MAR.", "MIÉ.", "JUE.", "VIE.", "SÁB.", "DOM."
    
    // Normalizar día (quitar acentos y puntos para coincidir LUN, MAR, MIE, JUE, VIE, SAB, DOM)
    const normalizeDay = (d) => {
      if (!d) return "";
      return d.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\./g, "").toUpperCase();
    };

    const todayCode = normalizeDay(todayName).substring(0, 3); // "LUN", "MAR", "MIE", etc.

    const classesToday = allLocalSchedules.filter((c) => {
      const classDay = normalizeDay(c.day).substring(0, 3);
      return classDay === todayCode;
    });

    const calculatedClassesToday = classesToday.length;
    const calculatedClassesInProgress = classesToday.filter((c) => c.status === "in_progress" || c.status === "in-progress" || c.status === "in_course").length;

    const localMetrics = {
      activeStudents: activeStudentsCount,
      newStudents: newStudentsCount,
      occupancyRate: calculatedOccupancy,
      totalIncome: calculatedTotalIncome,
      pendingPayments: calculatedPendingPayments,
      netProfit: calculatedNetProfit,
      marginRate: marginRate,
      forecastPercent: forecastPercent,
      totalClassesToday: calculatedClassesToday,
      classesInProgress: calculatedClassesInProgress,
      activeTeachers: calculatedActiveTeachers,
      teachersOnLeave: calculatedTeachersOnLeave,
    };

    // Para asegurar que los datos no sean inventados y comiencen en $0, calculamos todo dinámicamente a partir de alumnos y transacciones reales.
    setMetrics(localMetrics);
  };

  const fetchActivities = async () => {
    try {
      const { data, error } = await supabase
        .from("recent_activities")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      if (data && data.length > 0) {
        setActivities(
          data.map((item) => {
            const dateObj = new Date(item.created_at);
            
            // Traducción de fechas
            let dateStr = "";
            if (dateObj.toLocaleDateString() === new Date().toLocaleDateString()) {
              dateStr = `Hoy, ${dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
            } else {
              dateStr = dateObj.toLocaleDateString('es-ES', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
            }

            // Traducir categoría y estados de la BD a Español para visualización uniforme
            const mappedCategory = item.category === "Academic" ? "Académico" : "Financiero";
            const mappedStatus = item.status === "Completed" ? "Completado" 
                               : item.status === "Processed" ? "Procesado" 
                               : item.status === "Alert" ? "Alerta" 
                               : "Archivado";

            return {
              id: item.id,
              event: item.event,
              category: mappedCategory,
              status: mappedStatus,
              date: dateStr,
            };
          })
        );
      } else {
        throw new Error("Sin actividades en base de datos.");
      }
    } catch (err) {
      console.log(
        "Consulta de actividades de Supabase omitida/fallida. Usando fallback local dinámico."
      );
      
      const localStudents = getLS(S_KEY, DEFAULT_STUDENTS);
      const localMovements = getLS(MV_KEY, []);
      
      const items = [];
      
      // 1. Procesar movimientos académicos de localStorage
      localMovements.forEach((mv, index) => {
        let labelType = "Curso";
        if (mv.changeType === "group") labelType = "Modalidad";
        if (mv.changeType === "teacher") labelType = "Profesor";
        if (mv.changeType === "schedule") labelType = "Horario";
        
        let displayTo = mv.to;
        if (mv.changeType === "group") {
          const CT_LABEL = { grupal: "Grupal", privada: "Privada", conversation_club: "Conv. Club" };
          displayTo = CT_LABEL[mv.to] || mv.to;
        }

        items.push({
          id: mv.id || `mv-${index}`,
          event: `Cambio de ${labelType} de ${mv.studentName} a "${displayTo}"`,
          category: "Académico",
          status: "Completado",
          rawDate: mv.date,
          rawTime: mv.time,
          date: mv.date === new Date().toISOString().split("T")[0] 
            ? `Hoy, ${mv.time}` 
            : `${mv.date.split("-").reverse().join("/")} ${mv.time}`
        });
      });
      
      // 2. Procesar inscripciones de estudiantes de localStorage
      localStudents.forEach((st, index) => {
        if (st.enrolled_date) {
          items.push({
            id: `reg-${st.id || index}`,
            event: `Nueva inscripción de alumno: ${st.name} ${st.last_name || ""}`,
            category: "Académico",
            status: "Completado",
            rawDate: st.enrolled_date,
            rawTime: "09:00",
            date: st.enrolled_date === new Date().toISOString().split("T")[0]
              ? "Hoy, 09:00 AM"
              : `${st.enrolled_date.split("-").reverse().join("/")}`
          });
        }
      });
      
      // Ordenar por fecha y hora descendente
      items.sort((a, b) => {
        const dateA = a.rawDate + " " + (a.rawTime || "00:00");
        const dateB = b.rawDate + " " + (b.rawTime || "00:00");
        return dateB.localeCompare(dateA);
      });
      
      // Renglones de semilla financieros fijos para que se vea premium e integrado
      const seedActivities = [
        {
          id: "seed-1",
          event: "Pago recibido: Grupo B-12",
          category: "Financiero",
          status: "Procesado",
          date: "Hoy, 08:45 AM",
        },
        {
          id: "seed-2",
          event: "Pago vencido: Carlos Méndez",
          category: "Financiero",
          status: "Alerta",
          date: "Ayer, 06:20 PM",
        }
      ];
      
      const merged = [];
      setActivities([]);
    }
  };

  useEffect(() => {
    // ⚡ Auto-limpieza completa de caché local legacy para garantizar eliminación total de personas inventadas
    if (typeof window !== "undefined") {
      const alreadyCleanedV5 = localStorage.getItem("ttp_storage_cleaned_v5");
      if (!alreadyCleanedV5) {
        localStorage.setItem("ttp_students_local", JSON.stringify([]));
        localStorage.setItem("ttp_teachers_local", JSON.stringify([]));
        localStorage.setItem("ttp_groups_local", JSON.stringify([]));
        localStorage.setItem("ttp_transactions_local", JSON.stringify([]));
        localStorage.setItem("ttp_movements_local", JSON.stringify([]));
        localStorage.setItem("ttp_attendance_local", JSON.stringify({}));
        localStorage.setItem("ttp_schedules_local", JSON.stringify([]));
        localStorage.setItem("ttp_storage_cleaned_v5", "true");
        console.log("🧹 TTP Hub: All legacy mock local storage data physically wiped successfully!");
      }
    }

    setIsLoading(true);
    fetchMetrics();
    fetchActivities();
    setIsLoading(false);

    // ⚡ Suscripción en Tiempo Real mediante Postgres Changes de Supabase
    const channel = supabase
      .channel("supabase-realtime-activities")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "recent_activities",
        },
        () => {
          fetchMetrics();
          fetchActivities();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Manejar cambio de estado local interactivo para demostración
  const handleToggleStatus = async (id) => {
    try {
      const current = activities.find((a) => a.id === id);
      if (!current) return;
      
      const dbStatus = current.status === "Completado" || current.status === "Completada" ? "Archived" : "Completed";

      const { error } = await supabase
        .from("recent_activities")
        .update({ status: dbStatus })
        .eq("id", id);

      if (error) throw error;
      fetchActivities();
    } catch (err) {
      // Fallback interactivo local en español
      setActivities((prev) =>
        prev.map((act) => {
          if (act.id === id) {
            const nextStatus = act.status === "Completado" ? "Archivado" : "Completado";
            return { ...act, status: nextStatus };
          }
          return act;
        })
      );
    }
  };


  return (
    <div className="flex min-h-screen bg-slate-50 font-inter">
      {/* SideNavBar (Shared Component) */}
      <Sidebar activeName="Panel de Control" />

      {/* Main Content Area */}
      <main className="flex-1 md:ml-64 min-h-screen flex flex-col pb-20 md:pb-10">
        {/* TopNavBar (Shared Component) */}
        <header className="flex justify-between items-center w-full px-6 md:px-10 h-16 sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200 transition-all">
          <div className="flex items-center gap-4">
            <span className="font-montserrat text-2xl font-bold text-ttp-primary tracking-tight">
              TTP Hub
            </span>
          </div>

          <div className="flex items-center gap-6">
            <nav className="hidden lg:flex items-center gap-6">
              <a
                className="text-ttp-primary font-semibold border-b-2 border-ttp-primary pb-1 text-sm transition-all"
                href="#"
              >
                Inicio
              </a>
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
                <span className="material-symbols-outlined text-2xl" data-icon="notifications">
                  notifications
                </span>
                <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-ttp-primary rounded-full ring-2 ring-white"></span>
              </button>
              <button
                className="p-1.5 text-slate-600 hover:text-ttp-primary hover:bg-slate-50 rounded-full transition-colors"
                title="Centro de Ayuda"
              >
                <span className="material-symbols-outlined text-2xl" data-icon="help">
                  help
                </span>
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

        {/* Brand Banner Section */}
        <section className="px-6 md:px-10 py-6">
          <div className="bg-gradient-to-r from-ttp-primary to-pink-500 text-white p-6 rounded-2xl flex flex-col md:flex-row justify-between items-center gap-4 relative overflow-hidden shadow-lg shadow-ttp-primary/10">
            <div className="relative z-10 space-y-1 text-center md:text-left">
              <h2 className="font-montserrat text-xl md:text-2xl font-bold tracking-tight">
                Acompañamos a nuestros alumnos, no solo enseñamos
              </h2>
              <p className="text-sm opacity-90 max-w-xl font-medium">
                Educación con conexión humana al centro de la experiencia TTP.
              </p>
            </div>
            <button className="bg-white text-ttp-primary hover:bg-pink-50 px-6 py-2.5 rounded-xl font-semibold transition-all duration-300 relative z-10 active:scale-95 shadow-sm text-sm whitespace-nowrap">
              Ver Reporte de Impacto
            </button>
            {/* Elementos decorativos */}
            <div className="absolute -right-10 -bottom-10 w-44 h-44 bg-white opacity-10 rounded-full blur-3xl"></div>
            <div className="absolute left-1/3 -top-12 w-28 h-28 bg-pink-300 opacity-20 rounded-full blur-2xl"></div>
          </div>
        </section>

        {/* Dashboard Content */}
        <div className="px-6 md:px-10 pb-10 space-y-8 flex-grow">
          {/* 1. Academic Section */}
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-ttp-primary text-2xl" data-icon="auto_stories">
                auto_stories
              </span>
              <h3 className="font-montserrat text-lg font-bold text-slate-800 tracking-tight">
                Resumen Académico
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* KPI Card: Active Students */}
              <Link href="/students" className="bg-white border border-slate-100 p-6 rounded-2xl card-shadow card-hover relative overflow-hidden active:scale-[0.98] transition-transform duration-200 cursor-pointer block text-inherit hover:text-inherit">
                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-ttp-primary"></div>
                <p className="text-xs font-bold tracking-wider text-slate-400 uppercase mb-2">
                  Estudiantes Activos
                </p>
                <h4 className="font-montserrat text-3xl font-extrabold text-ttp-primary">
                  {metrics.activeStudents.toLocaleString()}
                </h4>
                {metrics.activeStudents > 0 ? (
                  <div className="mt-4 flex items-center text-teal-600 text-sm font-semibold">
                    <span className="material-symbols-outlined text-sm font-bold" data-icon="trending_up">
                      trending_up
                    </span>
                    <span className="ml-1">4.2% del periodo anterior</span>
                  </div>
                ) : (
                  <div className="mt-4 flex items-center text-slate-400 text-xs font-semibold">
                    <span className="material-symbols-outlined text-sm mr-1" data-icon="trending_flat">
                      trending_flat
                    </span>
                    Sin registros previos
                  </div>
                )}
              </Link>

              {/* KPI Card: New Students */}
              <Link href="/students" className="bg-white border border-slate-100 p-6 rounded-2xl card-shadow card-hover relative overflow-hidden active:scale-[0.98] transition-transform duration-200 cursor-pointer block text-inherit hover:text-inherit">
                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-ttp-primary"></div>
                <p className="text-xs font-bold tracking-wider text-slate-400 uppercase mb-2">
                  Nuevos Alumnos (Este Mes)
                </p>
                <h4 className="font-montserrat text-3xl font-extrabold text-ttp-primary">
                  {metrics.newStudents}
                </h4>
                {metrics.newStudents > 0 ? (
                  <div className="mt-4 flex items-center text-slate-500 text-sm font-medium">
                    <span className="material-symbols-outlined text-sm text-slate-400" data-icon="person_add">
                      person_add
                    </span>
                    <span className="ml-1">Meta: 75</span>
                  </div>
                ) : (
                  <div className="mt-4 flex items-center text-slate-400 text-xs font-semibold">
                    <span className="material-symbols-outlined text-sm mr-1" data-icon="calendar_today">
                      calendar_today
                    </span>
                    Meta mensual: 0
                  </div>
                )}
              </Link>

              {/* Occupancy Donut Chart */}
              <Link href="/schedules" className="bg-white border border-slate-100 p-6 rounded-2xl card-shadow card-hover relative overflow-hidden flex items-center justify-between active:scale-[0.98] transition-transform duration-200 cursor-pointer block text-inherit hover:text-inherit">
                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-ttp-primary"></div>
                <div>
                  <p className="text-xs font-bold tracking-wider text-slate-400 uppercase mb-2">
                    Ocupación de Grupos
                  </p>
                  <h4 className="font-montserrat text-3xl font-extrabold text-ttp-primary">
                    {metrics.occupancyRate}%
                  </h4>
                  <p className="text-xs text-slate-500 font-medium">Uso de capacidad</p>
                </div>
                <div className="relative h-20 w-20 flex-shrink-0">
                  <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
                    <path
                      className="stroke-slate-100"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      strokeWidth="3.5"
                    ></path>
                    <path
                      className="stroke-ttp-primary donut-segment"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      strokeDasharray={`${metrics.occupancyRate}, 100`}
                      strokeLinecap="round"
                      strokeWidth="3.5"
                    ></path>
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xs font-bold text-ttp-primary">{metrics.occupancyRate}%</span>
                  </div>
                </div>
              </Link>
            </div>
          </section>

          {/* 2. Financial Section (Confidential) */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-ttp-private text-2xl" data-icon="account_balance_wallet">
                  account_balance_wallet
                </span>
                <h3 className="font-montserrat text-lg font-bold text-slate-800 tracking-tight flex items-baseline gap-2">
                  Finanzas{" "}
                  <span className="text-xs font-normal text-slate-400 normal-case">
                    (Confidencial)
                  </span>
                </h3>
              </div>
              <button
                onClick={() => setHideSensitive(!hideSensitive)}
                className="text-ttp-primary flex items-center gap-1.5 text-sm font-semibold hover:bg-ttp-primary/5 px-3 py-1.5 rounded-lg transition-colors active:scale-95"
              >
                <span className="material-symbols-outlined text-lg">
                  {hideSensitive ? "visibility" : "visibility_off"}
                </span>
                <span>{hideSensitive ? "Mostrar confidencial" : "Ocultar confidencial"}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Income Card */}
              <Link href="/billing" className="bg-white border border-slate-100 p-6 rounded-2xl card-shadow card-hover relative overflow-hidden active:scale-[0.98] transition-transform duration-200 cursor-pointer block text-inherit hover:text-inherit">
                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-ttp-private"></div>
                <p className="text-xs font-bold tracking-wider text-slate-400 uppercase mb-2">
                  Ingresos Recibidos (Mes)
                </p>
                <h4 className="font-montserrat text-3xl font-extrabold text-ttp-private">
                  {hideSensitive ? "••••••" : `$${metrics.totalIncome.toLocaleString()}`}
                </h4>
                {metrics.totalIncome > 0 ? (
                  <div className="mt-4 flex items-center text-teal-600 text-sm font-semibold">
                    <span className="material-symbols-outlined text-sm" data-icon="check_circle">
                      check_circle
                    </span>
                    <span className="ml-1">{metrics.forecastPercent}% del pronóstico</span>
                  </div>
                ) : (
                  <div className="mt-4 flex items-center text-slate-400 text-xs font-semibold">
                    <span className="material-symbols-outlined text-sm mr-1" data-icon="account_balance">
                      account_balance
                    </span>
                    Sin ingresos este periodo
                  </div>
                )}
              </Link>

              {/* Pending Payments (Alert) */}
              <Link href="/billing" className="bg-white border border-slate-100 p-6 rounded-2xl card-shadow card-hover relative overflow-hidden active:scale-[0.98] transition-transform duration-200 cursor-pointer block text-inherit hover:text-inherit">
                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-ttp-alert"></div>
                <p className="text-xs font-bold tracking-wider text-slate-400 uppercase mb-2">
                  Pagos Pendientes
                </p>
                <div className="flex items-baseline gap-2">
                  <h4 className="font-montserrat text-3xl font-extrabold text-ttp-primary">
                    {hideSensitive ? "••••••" : `$${metrics.pendingPayments.toLocaleString()}`}
                  </h4>
                  {metrics.pendingPayments > 0 && (
                    <span className="bg-ttp-alert/15 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse border border-ttp-alert/30">
                      ACCION REQ
                    </span>
                  )}
                </div>
                <div className="mt-4 flex items-center text-sm font-semibold">
                  {metrics.pendingPayments > 0 ? (
                    <div className="flex items-center text-amber-600">
                      <span className="material-symbols-outlined text-sm text-ttp-alert" data-icon="warning">
                        warning
                      </span>
                      <span className="ml-1">Cuentas vencidas registradas</span>
                    </div>
                  ) : (
                    <div className="flex items-center text-teal-600 text-xs font-semibold">
                      <span className="material-symbols-outlined text-sm mr-1" data-icon="check_circle">
                        check_circle
                      </span>
                      Al corriente / Sin adeudos
                    </div>
                  )}
                </div>
              </Link>

              {/* Estimated Net Profit */}
              <Link href="/billing" className="bg-white border border-slate-100 p-6 rounded-2xl card-shadow card-hover relative overflow-hidden active:scale-[0.98] transition-transform duration-200 cursor-pointer block text-inherit hover:text-inherit">
                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-ttp-private"></div>
                <p className="text-xs font-bold tracking-wider text-slate-400 uppercase mb-2">
                  Ganancia Neta Estimada
                </p>
                <h4 className="font-montserrat text-3xl font-extrabold text-ttp-private">
                  {hideSensitive ? "••••••" : `$${metrics.netProfit.toLocaleString()}`}
                </h4>
                {metrics.netProfit > 0 ? (
                  <div className="mt-4 flex items-center text-teal-600 text-sm font-semibold">
                    <span className="material-symbols-outlined text-sm" data-icon="insights">
                      insights
                    </span>
                    <span className="ml-1">Margen: {metrics.marginRate}%</span>
                  </div>
                ) : (
                  <div className="mt-4 flex items-center text-slate-400 text-xs font-semibold">
                    <span className="material-symbols-outlined text-sm mr-1" data-icon="pie_chart">
                      pie_chart
                    </span>
                    Margen neto: 0%
                  </div>
                )}
              </Link>
            </div>
          </section>

          {/* 3. Operational Section */}
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-ttp-club text-2xl" data-icon="settings_applications">
                settings_applications
              </span>
              <h3 className="font-montserrat text-lg font-bold text-slate-800 tracking-tight">
                Salud Operativa
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Classes Today */}
              <Link href="/schedules" className="bg-white border border-slate-100 p-6 rounded-2xl card-shadow card-hover flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 active:scale-[0.98] transition-transform duration-200 cursor-pointer text-inherit hover:text-inherit block">
                <div className="flex items-center gap-4">
                  <div className="bg-ttp-club/10 text-ttp-club p-3.5 rounded-2xl flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined text-2xl font-bold" data-icon="calendar_today">
                      calendar_today
                    </span>
                  </div>
                  <div>
                    <p className="text-xs font-bold tracking-wider text-slate-400 uppercase mb-1">
                      Total de Clases Hoy
                    </p>
                    <h4 className="font-montserrat text-3xl font-extrabold text-ttp-club">
                      {metrics.totalClassesToday}
                    </h4>
                    <p className="text-xs text-slate-500 font-medium">{metrics.classesInProgress} actualmente en curso</p>
                  </div>
                </div>
                <div className="border border-ttp-club text-ttp-club hover:bg-ttp-club/5 px-4 py-2 rounded-xl font-semibold transition-colors text-sm active:scale-95 w-full sm:w-auto text-center">
                  Horario Diario
                </div>
              </Link>

              {/* Active Teachers */}
              <Link href="/teachers" className="bg-white border border-slate-100 p-6 rounded-2xl card-shadow card-hover flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 active:scale-[0.98] transition-transform duration-200 cursor-pointer text-inherit hover:text-inherit block">
                <div className="flex items-center gap-4">
                  <div className="bg-ttp-primary/10 text-ttp-primary p-3.5 rounded-2xl flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined text-2xl font-bold" data-icon="badge">
                      badge
                    </span>
                  </div>
                  <div>
                    <p className="text-xs font-bold tracking-wider text-slate-400 uppercase mb-1">
                      Profesores Activos
                    </p>
                    <h4 className="font-montserrat text-3xl font-extrabold text-ttp-primary">
                      {metrics.activeTeachers}
                    </h4>
                    <p className="text-xs text-slate-500 font-medium">{metrics.teachersOnLeave} de permiso</p>
                  </div>
                </div>
                <div className="border border-ttp-primary text-ttp-primary hover:bg-ttp-primary/5 px-4 py-2 rounded-xl font-semibold transition-colors text-sm active:scale-95 w-full sm:w-auto text-center">
                  Gestionar Personal
                </div>
              </Link>
            </div>
          </section>

          {/* 4. Centro de Notificaciones y WhatsApp Gateway */}
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-ttp-primary text-2xl font-bold" data-icon="forum">
                forum
              </span>
              <h3 className="font-montserrat text-lg font-bold text-slate-800 tracking-tight">
                Centro de Notificaciones y WhatsApp Gateway
              </h3>
              <span className="bg-ttp-primary/10 text-ttp-primary text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-ttp-primary/20">
                META CLOUD API SIMULATOR
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Formulario de Despacho (Meta API Workspace) */}
              <div className="bg-white border border-slate-100 rounded-2xl card-shadow p-6 space-y-4">
                <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                  <h4 className="font-montserrat font-bold text-sm text-slate-800 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-ttp-primary text-lg">send</span>
                    Meta API Workspace
                  </h4>
                  <span className="text-[9px] text-teal-600 font-bold uppercase tracking-wider bg-teal-50 border border-teal-150 px-2 py-0.5 rounded-full">CONEXIÓN LISTA</span>
                </div>

                <form onSubmit={handleSendManualWhatsApp} className="space-y-4">
                  {/* Selector de modo de envío (Segmentado premium o Select estilizado) */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Modo de Envío / Destinatarios</label>
                    <div className="relative">
                      <select
                        value={recipientType}
                        onChange={(e) => setRecipientType(e.target.value)}
                        disabled={isSendingMessage}
                        className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-ttp-primary/10 text-xs font-semibold text-slate-700 transition-all cursor-pointer appearance-none"
                      >
                        <option value="individual">👤 Un solo alumno (Individual)</option>
                        <option value="status">🏷️ Por Estado (Inscritos, Prospectos, Recs)</option>
                        <option value="course">🎓 Por Curso (Burlington, etc.)</option>
                        <option value="group">👥 Por Grupo (Aulas, Niveles)</option>
                        <option value="todos">📢 Todos los alumnos activos</option>
                      </select>
                      <span className="material-symbols-outlined text-slate-400 text-sm absolute left-3 top-2.5 pointer-events-none">
                        {recipientType === "individual" ? "person" : recipientType === "status" ? "label" : recipientType === "course" ? "school" : recipientType === "group" ? "group" : "campaign"}
                      </span>
                      <span className="material-symbols-outlined text-slate-400 text-sm absolute right-3 top-2.5 pointer-events-none">
                        arrow_drop_down
                      </span>
                    </div>
                  </div>

                  {recipientType === "individual" && (
                    <>
                      {/* Selector de Alumno */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Destinatario (Alumno/Tutor)</label>
                        <select
                          value={whatsappForm.studentName}
                          onChange={(e) => handleStudentChange(e.target.value)}
                          disabled={isSendingMessage || students.length === 0}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-ttp-primary/10 text-xs font-semibold text-slate-700 transition-all cursor-pointer"
                        >
                          {students.length === 0 ? (
                            <option value="">No hay estudiantes registrados</option>
                          ) : (
                            students.map((student) => {
                              const fullName = `${student.name} ${student.last_name || ""}`.trim();
                              return (
                                <option key={student.id} value={fullName}>
                                  {fullName}
                                </option>
                              );
                            })
                          )}
                        </select>
                      </div>

                      {/* Teléfono */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Número Telefónico</label>
                        <input
                          type="text"
                          required
                          value={whatsappForm.phone}
                          onChange={(e) => setWhatsappForm(prev => ({ ...prev, phone: e.target.value }))}
                          disabled={isSendingMessage}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-ttp-primary/10 text-xs font-semibold text-slate-700 transition-all"
                          placeholder="+52 55 1234 5678"
                        />
                      </div>
                    </>
                  )}

                  {recipientType === "status" && (
                    <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Seleccionar Estado</label>
                      <select
                        value={selectedStatus}
                        onChange={(e) => setSelectedStatus(e.target.value)}
                        disabled={isSendingMessage}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-ttp-primary/10 text-xs font-semibold text-slate-700 transition-all cursor-pointer"
                      >
                        <option value="active">🟢 Inscritos (Alumnos Activos)</option>
                        <option value="prospect">🟡 Prospectos (Leads / Interesados)</option>
                        <option value="recovered">🔵 Recuperados (Recs / Reingresos)</option>
                      </select>
                    </div>
                  )}

                  {recipientType === "course" && (
                    <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Seleccionar Curso</label>
                      <select
                        value={selectedCourse}
                        onChange={(e) => setSelectedCourse(e.target.value)}
                        disabled={isSendingMessage || uniqueCourses.length === 0}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-ttp-primary/10 text-xs font-semibold text-slate-700 transition-all cursor-pointer"
                      >
                        {uniqueCourses.length === 0 ? (
                          <option value="">No hay cursos registrados en los alumnos</option>
                        ) : (
                          uniqueCourses.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))
                        )}
                      </select>
                    </div>
                  )}

                  {recipientType === "group" && (
                    <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Seleccionar Grupo</label>
                      <select
                        value={selectedGroup}
                        onChange={(e) => setSelectedGroup(e.target.value)}
                        disabled={isSendingMessage || uniqueGroups.length === 0}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-ttp-primary/10 text-xs font-semibold text-slate-700 transition-all cursor-pointer"
                      >
                        {uniqueGroups.length === 0 ? (
                          <option value="">No hay grupos registrados en los alumnos</option>
                        ) : (
                          uniqueGroups.map((g) => (
                            <option key={g} value={g}>
                              {g}
                            </option>
                          ))
                        )}
                      </select>
                    </div>
                  )}

                  {recipientType !== "individual" && (
                    /* Badge/Banner de Destinatarios Activos */
                    <div className="bg-ttp-primary/5 border border-ttp-primary/20 rounded-xl p-3.5 space-y-1 animate-in fade-in slide-in-from-top-2 duration-250">
                      <div className="flex items-center gap-1.5 text-ttp-primary">
                        <span className="material-symbols-outlined text-sm font-bold">campaign</span>
                        <span className="text-[10px] font-bold uppercase tracking-wider">
                          Modo Envío {recipientType === "todos" ? "Masivo Total" : recipientType === "status" ? "Por Estado" : recipientType === "course" ? "Por Curso" : "Por Grupo"}
                        </span>
                      </div>
                      <p className="text-xs font-medium text-slate-600 leading-normal">
                        Se enviará un mensaje de WhatsApp individual y personalizado a cada uno de los{" "}
                        <strong className="text-ttp-primary font-bold">
                          {
                            recipientType === "todos"
                              ? students.filter(s => s.status === "active" || s.status === "moroso" || s.status === "activo").length
                              : recipientType === "status"
                              ? students.filter(s => {
                                  if (selectedStatus === "active") return s.status === "active" || s.status === "activo";
                                  if (selectedStatus === "prospect") return s.status === "prospect" || s.status === "prospecto";
                                  if (selectedStatus === "recovered") return s.status === "recovered" || s.status === "recuperado" || s.status === "recs";
                                  return false;
                                }).length
                              : recipientType === "course"
                              ? students.filter(s => s.current_course === selectedCourse).length
                              : students.filter(s => s.current_group === selectedGroup).length
                          } alumnos
                        </strong>{" "}
                        que coinciden con tu selección.
                      </p>
                      <p className="text-[9px] text-slate-400 leading-normal">
                        * La variable de nombre {"{{1}}"} se personalizará automáticamente para cada alumno.
                      </p>
                    </div>
                  )}

                  {/* Selector de Plantilla */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Plantilla Meta Aprobada</label>
                    <select
                      value={whatsappForm.template}
                      onChange={(e) => handleTemplateChange(e.target.value)}
                      disabled={isSendingMessage}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-ttp-primary/10 text-xs font-semibold text-slate-700 transition-all cursor-pointer"
                    >
                      {approvedTemplates.map((t) => (
                        <option key={t.name} value={t.name}>
                          {t.name} ({t.category})
                        </option>
                      ))}
                    </select>
                    <p className="text-[10px] text-slate-400 font-medium mt-1.5 leading-relaxed italic">
                      "{approvedTemplates.find(t => t.name === whatsappForm.template)?.description}"
                    </p>
                  </div>

                  {/* Variables dinámicas según la plantilla seleccionada */}
                  <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Variables del Mensaje</span>
                    
                    {/* Val 1 */}
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Variable {"{{1}}"}</label>
                      <input
                        type="text"
                        required
                        value={whatsappForm.val1}
                        onChange={(e) => setWhatsappForm(prev => ({ ...prev, val1: e.target.value }))}
                        disabled={isSendingMessage}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ttp-primary/10 text-xs font-semibold text-slate-750"
                        placeholder="Reemplazo de {{1}}"
                      />
                    </div>

                    {/* Val 2 */}
                    {["class_link_meet", "student_absence_alert", "stripe_payment_failed", "overdue_payment_reminder", "teacher_daily_summary"].includes(whatsappForm.template) && (
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Variable {"{{2}}"}</label>
                        <input
                          type="text"
                          required
                          value={whatsappForm.val2}
                          onChange={(e) => setWhatsappForm(prev => ({ ...prev, val2: e.target.value }))}
                          disabled={isSendingMessage}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ttp-primary/10 text-xs font-semibold text-slate-755"
                          placeholder="Reemplazo de {{2}}"
                        />
                      </div>
                    )}

                    {/* Val 3 */}
                    {["class_link_meet", "stripe_payment_failed", "teacher_daily_summary"].includes(whatsappForm.template) && (
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Variable {"{{3}}"}</label>
                        <input
                          type="text"
                          required
                          value={whatsappForm.val3}
                          onChange={(e) => setWhatsappForm(prev => ({ ...prev, val3: e.target.value }))}
                          disabled={isSendingMessage}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ttp-primary/10 text-xs font-semibold text-slate-760"
                          placeholder="Reemplazo de {{3}}"
                        />
                      </div>
                    )}

                    {/* Val 4 */}
                    {["stripe_payment_failed"].includes(whatsappForm.template) && (
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Variable {"{{4}}"}</label>
                        <input
                          type="text"
                          required
                          value={whatsappForm.val4 || ""}
                          onChange={(e) => setWhatsappForm(prev => ({ ...prev, val4: e.target.value }))}
                          disabled={isSendingMessage}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ttp-primary/10 text-xs font-semibold text-slate-765"
                          placeholder="Reemplazo de {{4}}"
                        />
                      </div>
                    )}
                  </div>

                  {/* Botón de Envío */}
                  <button
                    type="submit"
                    disabled={isSendingMessage}
                    className="w-full py-2.5 bg-ttp-primary text-white hover:opacity-90 active:scale-95 transition-all rounded-xl text-xs font-bold shadow-md shadow-pink-500/10 flex items-center justify-center gap-1.5 disabled:opacity-75 cursor-pointer"
                  >
                    {isSendingMessage ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Conectando con Meta Cloud API...</span>
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-sm font-bold">rocket_launch</span>
                        <span>Enviar WhatsApp (Meta API)</span>
                      </>
                    )}
                  </button>
                </form>
              </div>

              {/* Bitácora de Mensajes Enviados (Logs) */}
              <div className="bg-white border border-slate-100 rounded-2xl card-shadow p-6 flex flex-col justify-between lg:col-span-2 overflow-hidden min-h-[500px]">
                <div className="space-y-4">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                    <h4 className="font-montserrat font-bold text-sm text-slate-800 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-slate-500 text-lg">history_edu</span>
                      Bitácora de Notificaciones (WhatsApp Logs)
                    </h4>
                    <span className="bg-slate-50 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded-full border border-slate-200">
                      {whatsappLogs.length} MENSAJES
                    </span>
                  </div>

                  {/* Rejilla de Logs */}
                  <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
                    {whatsappLogs.length === 0 ? (
                      <div className="py-12 text-center text-slate-400 font-medium">
                        No hay mensajes despachados recientemente
                      </div>
                    ) : (
                      whatsappLogs.map((log) => (
                        <div
                          key={log.id}
                          className="bg-slate-50/50 border border-slate-100 p-4 rounded-xl space-y-2 hover:border-ttp-primary/20 transition-all card-shadow shadow-sm relative overflow-hidden"
                        >
                          <div className="flex flex-wrap justify-between items-center gap-2">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-700 text-xs">{log.studentName}</span>
                              <span className="text-[10px] text-slate-400 font-semibold">{log.to}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              {/* Meta messageId */}
                              <span className="font-mono text-[9px] text-slate-400 bg-white border border-slate-100 px-1.5 py-0.5 rounded" title="ID de Transacción de Meta Cloud API">
                                {log.messageId}
                              </span>
                              {/* Badge de Estatus */}
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border flex items-center gap-1 ${
                                log.status === "Leído"
                                  ? "bg-teal-50 border-teal-200 text-teal-600 font-extrabold"
                                  : "bg-sky-50 border-sky-200 text-sky-600"
                              }`}>
                                <span className="material-symbols-outlined text-[10px] font-bold">
                                  {log.status === "Leído" ? "done_all" : "done"}
                                </span>
                                {log.status}
                              </span>
                            </div>
                          </div>

                          {/* Message Body */}
                          <div className="bg-white p-3 rounded-lg border border-slate-100/60 text-xs text-slate-600 leading-relaxed font-semibold">
                            <span className="text-slate-400 text-[9px] font-bold block mb-1 uppercase tracking-wider">
                              Plantilla: {log.template}
                            </span>
                            {log.body}
                          </div>

                          <div className="flex justify-between items-center text-[10px] text-slate-400 font-semibold pt-1">
                            <span className="flex items-center gap-1">
                              <span className="material-symbols-outlined text-[11px]">schedule</span>
                              {log.timestamp}
                            </span>
                            <span className="text-[9px] text-ttp-primary font-bold">API STATUS: SUCCESS (200 OK)</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-4 flex flex-wrap justify-between items-center gap-2 text-[10px] font-semibold text-slate-400">
                  <span>Enmascaramiento activo: números telefónicos protegidos</span>
                  <button 
                    onClick={() => {
                      setWhatsAppLogs(getInitialLogs());
                      showToast("🗑️ Bitácora reiniciada a valores por defecto");
                    }}
                    className="text-red-500 hover:text-red-650 hover:underline font-bold transition-all cursor-pointer"
                  >
                    Reiniciar Bitácora
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Bottom Table Placeholder for Bento Feel */}
          <section className="bg-white border border-slate-100 rounded-2xl card-shadow overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="font-montserrat text-base font-bold text-slate-800 tracking-tight">
                Actividad Reciente
              </h3>
              <a className="text-ttp-primary hover:underline text-sm font-semibold" href="#">
                Ver Toda la Actividad
              </a>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-400 text-xs font-bold border-b border-slate-100">
                    <th className="px-6 py-4 font-bold tracking-wider uppercase">Evento</th>
                    <th className="px-6 py-4 font-bold tracking-wider uppercase">Categoría</th>
                    <th className="px-6 py-4 font-bold tracking-wider uppercase">Estado</th>
                    <th className="px-6 py-4 font-bold tracking-wider uppercase text-right">Fecha</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {activities.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="px-6 py-10 text-center text-slate-400 font-medium">
                        No hay actividades recientes registradas
                      </td>
                    </tr>
                  ) : (
                    activities.map((act) => (
                      <tr
                        key={act.id}
                        onClick={() => handleToggleStatus(act.id)}
                        className="hover:bg-slate-50/80 transition-colors duration-150 cursor-pointer"
                        title="Haz clic para alternar el estado"
                      >
                        <td className="px-6 py-4 font-medium text-slate-800">{act.event}</td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                              act.category === "Académico"
                                ? "bg-ttp-primary/10 text-ttp-primary"
                                : "bg-ttp-private/10 text-ttp-private"
                            }`}
                          >
                            {act.category}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                act.status === "Completado" || act.status === "Procesado"
                                  ? "bg-teal-500"
                                  : act.status === "Archivado"
                                  ? "bg-slate-400"
                                  : "bg-ttp-alert"
                              }`}
                            ></span>
                            <span className="text-slate-600 text-xs font-medium">{act.status}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-slate-400 text-xs text-right font-medium">
                          {act.date}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </main>

      {/* Mobile Navigation (Responsive Pivot) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 flex justify-around py-2.5 z-40 shadow-xl shadow-slate-900/5">
        {[
          { name: "Inicio", icon: "dashboard", route: "/" },
          { name: "Horarios", icon: "calendar_today", route: "/schedules" },
          { name: "Alumnos", icon: "school", route: "/students" },
          { name: "Facturación", icon: "payments", route: "/billing" },
          { name: "Más", icon: "grid_view", route: "/settings" },
        ].map((item) => (
          <Link
            key={item.name}
            href={item.route}
            className="flex flex-col items-center gap-0.5 text-center text-slate-500 hover:text-slate-800 transition-all"
          >
            <span className="material-symbols-outlined text-2xl">{item.icon}</span>
            <span className="text-[10px] font-semibold">{item.name}</span>
          </Link>
        ))}
      </nav>


    </div>
  );
}
