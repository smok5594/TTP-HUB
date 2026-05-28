"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/utils/supabaseClient";
import Sidebar from "@/components/Sidebar";
import { toast } from "sonner";

const NATIONALITIES = [
  "Mexicana",
  "Española",
  "Estadounidense",
  "Canadiense",
  "Argentina",
  "Colombiana",
  "Chilena",
  "Peruana",
  "Venezolana",
  "Francesa",
  "Alemana",
  "Italiana",
  "Brasileña",
  "Uruguaya",
  "Costarricense",
  "Panameña",
  "Ecuatoriana",
  "Boliviana",
  "Paraguaya",
  "Británica"
];

export default function StudentProfile({ id }) {
  // Estado de la pestaña activa ("Información Personal", "Académico", "Financiero", "Burlington English")
  const [activeTab, setActiveTab] = useState("Información Personal");
  const [isLoading, setIsLoading] = useState(false);
  const [student, setStudent] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [studentCrudModal, setStudentCrudModal] = useState(null); // "suspend" | "delete" | null
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  // Estados para la funcionalidad premium de edición de alumno
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [formTeachers, setFormTeachers] = useState([]);
  const [formGroups, setFormGroups] = useState([]);
  const [isNationalityDropdownOpen, setIsNationalityDropdownOpen] = useState(false);

  // Cargar maestros y grupos desde Supabase para los selectores del formulario de edición
  useEffect(() => {
    const loadFormData = async () => {
      const [{ data: teachersData }, { data: groupsData }] = await Promise.all([
        supabase.from("teachers").select("id, name, email, specialty, status"),
        supabase.from("groups").select("id, title, class_type, teacher_id, schedule, capacity"),
      ]);
      if (teachersData) setFormTeachers(teachersData);
      if (groupsData) setFormGroups(groupsData);
    };
    loadFormData();
  }, []);



  // Historial de pagos dinámico del estudiante
  const [studentPayments, setStudentPayments] = useState([]);

  const fetchStudentPayments = async (studentObj) => {
    if (!studentObj) return;
    const fullName = `${studentObj.name} ${studentObj.last_name || ""}`.trim();
    let matches = [];
    
    // 1. Intentar cargar de Supabase
    try {
      const { data, error } = await supabase
        .from("billing_transactions")
        .select("*")
        .ilike("description", `%${studentObj.name}%`);
      if (error) throw error;
      if (data && data.length > 0) {
        matches = data.map(t => ({
          id: t.id,
          date: new Date(t.created_at || Date.now()).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" }),
          concept: t.description,
          amount: Number(t.amount),
          status: t.status === "processed" ? "pagado" : (t.status === "overdue" ? "vencido" : "pendiente"),
          method: t.status === "processed" ? "Stripe Gateway" : "Por cobrar",
          reference: t.id
        }));
      }
    } catch (e) {
      console.warn("Error cargando transacciones desde Supabase:", e);
    }

    // 2. Fallback dinámico si no hay ninguna transacción registrada aún
    if (matches.length === 0) {
      const isMoroso = studentObj.status === "moroso" || studentObj.payment_status === "moroso" || studentObj.payment_status === "pago_fallido";
      const isPaid = studentObj.payment_status === "al_corriente";
      const amt = studentObj.amount_due !== undefined ? Number(studentObj.amount_due) : 2450.00;
      
      matches = [{
        id: `t-profile-auto-${studentObj.id}`,
        date: new Date(studentObj.enrolled_date || Date.now()).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" }),
        concept: `Colegiatura Mensual - ${fullName}`,
        amount: amt,
        status: isMoroso ? "vencido" : (isPaid ? "pagado" : "pendiente"),
        method: isPaid ? "Stripe Gateway" : "Por cobrar",
        reference: studentObj.payment_reference || "AUTO-GEN-REF"
      }];
    }
    
    setStudentPayments(matches);
  };

  // Estados de Asistencia y Justificaciones
  const [attendanceHistory, setAttendanceHistory] = useState([
    { id: "a1", date: "15 de May, 2026", course: "English Mastery Program", status: "presente", reason: null },
    { id: "a2", date: "18 de May, 2026", course: "English Mastery Program", status: "justificada", reason: "Cita médica IMSS por síntomas de gripe." },
    { id: "a3", date: "22 de May, 2026", course: "English Mastery Program", status: "falta", reason: null }
  ]);

  const [selectedAbsenceForJustify, setSelectedAbsenceForJustify] = useState("");
  const [justificationReason, setJustificationReason] = useState("");
  const [justificationFile, setJustificationFile] = useState("");
  const [isUploadingJustify, setIsUploadingJustify] = useState(false);

  // Estados para Conexión Humana (Feedback Semanal y Mensajes Motivacionales)
  const [weeklyFeedbackLogs, setWeeklyFeedbackLogs] = useState([
    { id: "f1", date: "10 de May, 2026", rating: "Excelente", text: "Excelente participación en el debate de negociaciones internacionales. Muy buen uso de conectores." },
    { id: "f2", date: "17 de May, 2026", rating: "Sobresaliente", text: "Comprensión auditiva impecable durante el simulacro de listening. Sigue practicando vocabulario técnico." }
  ]);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackRating, setFeedbackRating] = useState("Excelente");
  const [isSendingFeedback, setIsSendingFeedback] = useState(false);

  const [selectedMotivationalQuote, setSelectedMotivationalQuote] = useState(
    "El aprendizaje constante de un idioma no es solo memorizar palabras, es abrir una nueva puerta al mundo de los negocios."
  );
  const [isSendingMotivation, setIsSendingMotivation] = useState(false);

  const handleSendWeeklyFeedback = (e) => {
    e.preventDefault();
    if (!feedbackText.trim()) {
      showToast("❌ Por favor escribe una reseña de feedback.");
      return;
    }

    setIsSendingFeedback(true);
    showToast("🔌 Conectando con Meta Cloud API... Enviando WhatsApp de Feedback...");

    setTimeout(() => {
      const newFeedback = {
        id: `f-${Date.now()}`,
        date: new Date().toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" }),
        rating: feedbackRating,
        text: feedbackText
      };

      setWeeklyFeedbackLogs((prev) => [newFeedback, ...prev]);
      setIsSendingFeedback(false);
      setFeedbackText("");
      showToast(`💬 Feedback Semanal enviado exitosamente por WhatsApp a ${student?.name || "Alejandro"}!`);
    }, 1500);
  };

  const handleSendMotivationalMessage = () => {
    setIsSendingMotivation(true);
    showToast("🔌 Conectando con Meta Cloud API... Enviando WhatsApp Motivacional...");

    setTimeout(() => {
      setIsSendingMotivation(false);
      showToast(`✨ ¡Mensaje Motivacional enviado exitosamente por WhatsApp a ${student?.name || "Alejandro"}!`);
    }, 1500);
  };

  // Procesar carga de justificante médico simulando Supabase Storage
  const handleSubmittingJustification = (e) => {
    e.preventDefault();
    if (!selectedAbsenceForJustify) {
      showToast("❌ Selecciona una inasistencia para justificar.");
      return;
    }
    if (!justificationReason.trim()) {
      showToast("❌ Por favor escribe el motivo de la inasistencia.");
      return;
    }

    setIsUploadingJustify(true);
    showToast("💾 Subiendo justificante médico/laboral a Supabase Storage...");

    setTimeout(() => {
      // Actualizar el historial local de asistencias
      setAttendanceHistory((prev) =>
        prev.map((item) =>
          item.id === selectedAbsenceForJustify
            ? { ...item, status: "justificada", reason: justificationReason }
            : item
        )
      );
      
      setIsUploadingJustify(false);
      showToast("✅ Justificante procesado. Estatus de inasistencia actualizado a 'Justificada'.");
      
      // Limpiar formulario
      setSelectedAbsenceForJustify("");
      setJustificationReason("");
      setJustificationFile("");
    }, 1500);
  };

  // Mostrar Toast temporales
  const showToast = (msg) => {
    if (msg.startsWith("✅")) toast.success(msg.replace("✅ ", ""));
    else if (msg.startsWith("✏️")) toast.success(msg.replace("✏️ ", ""));
    else if (msg.startsWith("🗑️")) toast.error(msg.replace("🗑️ ", ""));
    else if (msg.startsWith("⛔") || msg.includes("Error") || msg.includes("error")) toast.error(msg);
    else toast(msg);
  };

  // Carga de datos del estudiante desde Supabase (con fallback local de Elena Rodríguez)
  useEffect(() => {
    const fetchStudentData = async () => {
      setIsLoading(true);
      try {
        if (!id) return;
        const { data, error } = await supabase
          .from("students")
          .select("*")
          .eq("id", id)
          .single();

        if (error) throw error;
        if (data) {
          setStudent(data);
          fetchStudentPayments(data);
        }
      } catch (err) {
        console.log("No se pudo cargar el alumno de Supabase:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStudentData();
  }, [id]);

  const handleOpenEditModal = () => {
    if (!student) return;
    setEditForm({
      name: student.name || "",
      last_name: student.last_name || "",
      email: student.email || "",
      phone: student.phone || "",
      birthdate: student.birthdate || "",
      enrolled_date: student.enrolled_date || "",
      nationality: student.nationality || "",
      occupation: student.occupation || "",
      address: student.address || "",
      status: student.status || "active",
      status_mode: student.status_mode || "auto",
      last_connection_date: student.last_connection_date || "",
      payment_status: student.payment_status || "pendiente",
      current_course: student.current_course || "",
      current_group: student.current_group || "",
      class_type: student.class_type || "grupal",
      teacher: student.teacher || "",
      schedule: student.schedule || "",
      amount_due: student.amount_due ?? 0,
      payment_reference: student.payment_reference || "",
      last_payment_date: student.last_payment_date || "",
      next_payment: student.next_payment || "",
      burlington_user: student.burlington_user || "",
      admin_notes: student.admin_notes || "",
      academic_notes: student.academic_notes || ""
    });
    setIsEditModalOpen(true);
  };

  const handleSaveStudentEdit = async (e) => {
    e.preventDefault();
    if (!editForm.name || !editForm.email) {
      showToast("❌ El nombre y correo son obligatorios.");
      return;
    }

    // Preventivo: verificar si este correo pertenece a un docente cargado
    const teacherEmails = formTeachers.map(t => t.email?.toLowerCase()).filter(Boolean);
    if (teacherEmails.length > 0 && teacherEmails.includes(editForm.email.toLowerCase())) {
      showToast("❌ Error: Este correo pertenece a un docente y no puede registrarse como alumno.");
      return;
    }

    let finalStatus = editForm.status;
    if (editForm.status_mode === "auto") {
      const hasDebt = editForm.payment_status === "moroso" || editForm.payment_status === "pago_fallido" || (parseFloat(editForm.amount_due) > 0);
      let isInactive = false;
      if (editForm.last_connection_date) {
        const lastConn = new Date(editForm.last_connection_date);
        const diffTime = Math.abs(new Date() - lastConn);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays > 14) {
          isInactive = true;
        }
      }
      if (isInactive) finalStatus = "inactive";
      else if (hasDebt) finalStatus = "moroso";
      else finalStatus = "active";
    }

    const updated = {
      ...student,
      ...editForm,
      status: finalStatus,
      amount_due: parseFloat(editForm.amount_due) || 0
    };

    // Si el estado cambia a inactive o graduated, agregamos notas correspondientes
    if (updated.status === "inactive" && student.status !== "inactive") {
      updated.suspension_date = new Date().toISOString().split("T")[0];
      updated.suspension_reason = "Dado de baja por inactividad o administración";
    }

    await supabase.from("students").update({
      name: updated.name,
      last_name: updated.last_name,
      email: updated.email,
      phone: updated.phone,
      birthdate: updated.birthdate,
      enrolled_date: updated.enrolled_date,
      nationality: updated.nationality,
      occupation: updated.occupation,
      address: updated.address,
      status: updated.status,
      status_mode: updated.status_mode,
      last_connection_date: updated.last_connection_date,
      payment_status: updated.payment_status,
      current_course: updated.current_course,
      current_group: updated.current_group,
      class_type: updated.class_type,
      teacher: updated.teacher,
      schedule: updated.schedule,
      amount_due: updated.amount_due,
      payment_reference: updated.payment_reference,
      last_payment_date: updated.last_payment_date,
      next_payment: updated.next_payment,
      burlington_user: updated.burlington_user,
      admin_notes: updated.admin_notes,
      academic_notes: updated.academic_notes
    }).eq("id", updated.id);
    setStudent(updated);
    setIsEditModalOpen(false);
    showToast("✅ Datos del estudiante actualizados exitosamente.");
  };

  // Simulación de emisión de constancia
  const handleGenerateCertificate = () => {
    if (!student) return;
    showToast(`📄 ¡Constancia emitida con éxito para ${student.name}! Iniciando descarga...`);
    
    // Crear simulación de descarga de archivo de texto
    const element = document.createElement("a");
    const file = new Blob([
      `==================================================\n` +
      `              TTP HUB - CONSTANCIA ESTUDIANTIL    \n` +
      `==================================================\n\n` +
      `Por medio de la presente, TTP Hub hace constar que:\n\n` +
      `ALUMNO: ${student.name}\n` +
      `ID REGISTRO: ${student.id}\n` +
      `CURSO: ${student.current_course}\n` +
      `PROFESOR ASIGNADO: ${student.teacher}\n` +
      `ESTADO ACADÉMICO: Activo\n\n` +
      `Dado en la Ciudad de México, a la fecha del día de hoy.\n` +
      `==================================================`
    ], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `Constancia_${student.name.replace(/\s+/g, "_")}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const menuItems = [
    { name: "Panel de Control", icon: "dashboard", route: "/" },
    { name: "Horarios", icon: "calendar_today", route: "/schedules" },
    { name: "Estudiantes", icon: "school", route: "/students" },
    { name: "Profesores", icon: "person_4", route: "#" },
    { name: "Facturación", icon: "payments", route: "/billing" },
  ];

  if (isLoading || !student) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="text-center space-y-3">
          <span className="material-symbols-outlined text-4xl animate-spin text-ttp-primary">progress_activity</span>
          <p className="text-sm font-semibold text-slate-500">Cargando perfil del estudiante...</p>
        </div>
      </div>
    );
  }

  // Verificar si la fecha de pago está vencida o próxima
  const isOverdue = student.status === "moroso";

  return (
    <div className="flex min-h-screen bg-slate-50 font-inter relative">
      <Sidebar activeName="Estudiantes" />

      {/* ===== MODAL: Historial de Pagos ===== */}
      {showPaymentModal && (
        <div
          className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(15,23,42,0.75)", backdropFilter: "blur(4px)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowPaymentModal(false); }}
        >
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200/60 modal-card">

            {/* Modal Header */}
            <div className="flex items-center justify-between px-7 py-5 border-b border-slate-100 bg-slate-50/60 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-ttp-primary/10 flex items-center justify-center">
                  <span className="material-symbols-outlined text-ttp-primary text-xl">receipt_long</span>
                </div>
                <div>
                  <h2 className="font-montserrat font-bold text-slate-800 text-base">Historial de Pagos</h2>
                  <p className="text-xs text-slate-400 font-medium">{student?.name} · {studentPayments.length} transacciones registradas</p>
                </div>
              </div>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors active:scale-95"
              >
                <span className="material-symbols-outlined text-slate-500 text-lg">close</span>
              </button>
            </div>

            {/* Resumen rápido */}
            <div className="grid grid-cols-3 gap-px bg-slate-100 flex-shrink-0">
              <div className="bg-white px-6 py-4 text-center">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Total Pagado</p>
                <p className="font-extrabold text-lg text-teal-600">${studentPayments.filter(p => p.status === "pagado").reduce((s, p) => s + p.amount, 0).toLocaleString()} MXN</p>
              </div>
              <div className="bg-white px-6 py-4 text-center">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Pendiente</p>
                <p className="font-extrabold text-lg text-amber-500">${studentPayments.filter(p => p.status === "pendiente" || p.status === "vencido").reduce((s, p) => s + p.amount, 0).toLocaleString()} MXN</p>
              </div>
              <div className="bg-white px-6 py-4 text-center">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Pagos Exitosos</p>
                <p className="font-extrabold text-lg text-slate-800">{studentPayments.filter(p => p.status === "pagado").length} / {studentPayments.length}</p>
              </div>
            </div>

            {/* Tabla de transacciones */}
            <div className="overflow-y-auto flex-1">
              {/* Encabezado columnas */}
              <div className="grid grid-cols-12 gap-2 px-7 py-3 bg-slate-50 border-b border-slate-100 sticky top-0">
                <span className="col-span-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">#</span>
                <span className="col-span-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Concepto</span>
                <span className="col-span-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Fecha</span>
                <span className="col-span-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Método</span>
                <span className="col-span-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">Monto</span>
                <span className="col-span-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">Estado</span>
              </div>

              {/* Filas */}
              <div className="divide-y divide-slate-50">
                {studentPayments.map((pay, idx) => (
                  <div key={pay.id} className="grid grid-cols-12 gap-2 px-7 py-4 items-center hover:bg-slate-50/70 transition-colors group">
                    <span className="col-span-1 text-xs font-bold text-slate-300 group-hover:text-slate-400">{idx + 1}</span>
                    <div className="col-span-4">
                      <p className="text-sm font-semibold text-slate-800 leading-tight">{pay.concept}</p>
                      <p className="text-[10px] font-mono text-slate-300 mt-0.5 truncate">{pay.reference}</p>
                    </div>
                    <span className="col-span-2 text-xs font-medium text-slate-500">{pay.date}</span>
                    <div className="col-span-2 flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm text-slate-300">
                        {pay.method.includes("Tarjeta") || pay.method.includes("Stripe") ? "credit_card" : pay.method.includes("SPEI") ? "account_balance" : "payments"}
                      </span>
                      <span className="text-[10px] font-medium text-slate-500 truncate">{pay.method}</span>
                    </div>
                    <span className="col-span-2 text-sm font-extrabold text-slate-800 text-right">${pay.amount.toLocaleString()}</span>
                    <div className="col-span-1 flex justify-center">
                      <span className={`text-[9px] font-bold px-2 py-1 rounded-full border ${
                        pay.status === "pagado"
                          ? "bg-teal-50 border-teal-200 text-teal-600"
                          : pay.status === "pendiente"
                          ? "bg-amber-50 border-amber-200 text-amber-600 animate-pulse"
                          : "bg-rose-50 border-rose-200 text-rose-600"
                      }`}>
                        {pay.status === "pagado" ? "✓" : pay.status === "pendiente" ? "⏳" : "✗"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-7 py-4 border-t border-slate-100 bg-slate-50/60 flex justify-between items-center flex-shrink-0">
              <p className="text-xs text-slate-400 font-medium">Los pagos son procesados vía Stripe · TTP Hub</p>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="px-5 py-2 bg-ttp-primary text-white rounded-xl text-sm font-bold hover:opacity-90 active:scale-95 transition-all shadow-md shadow-ttp-primary/20"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SideNavBar */}
      <Sidebar activeName="Estudiantes" />

      {/* Main Content Area */}
      <main className="flex-1 md:ml-64 min-h-screen flex flex-col pb-20 md:pb-10">
        {/* TopNavBar */}
        <header className="flex justify-between items-center w-full px-6 md:px-10 h-16 sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200 transition-all">
          <div className="flex items-center gap-4">
            <Link href="/students" className="flex items-center gap-1.5 text-slate-500 hover:text-ttp-primary font-semibold text-sm transition-colors">
              <span className="material-symbols-outlined text-lg">arrow_back</span>
              <span>Volver a Alumnos</span>
            </Link>
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
              <button className="relative p-1.5 text-slate-600 hover:text-ttp-primary hover:bg-slate-50 rounded-full transition-colors">
                <span className="material-symbols-outlined text-2xl">notifications</span>
                <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-ttp-primary rounded-full ring-2 ring-white"></span>
              </button>
              <button className="p-1.5 text-slate-600 hover:text-ttp-primary hover:bg-slate-50 rounded-full transition-colors">
                <span className="material-symbols-outlined text-2xl">help</span>
              </button>
              <div className="relative group cursor-pointer">
                <img
                  alt="Ajustes del perfil del administrador"
                  className="w-9 h-9 rounded-full border-2 border-ttp-primary/30 group-hover:border-ttp-primary transition-all duration-200"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuCOggLERrNgDtNfhJ3G4ire2ddBavtGCFCUcAPI8WNe-qUtANUQsM_mZPm8r9W_WpWi7I_GTlY4ls2e8vB-VlcaLVNK_r4K35LvMAvIgw1U7sH6l0iy3UJvuezbvoS14HpoExpS81O0PP_UNNM4oNQK2K3B_mKHk_yDOrpL_4seytxQM7E1b--BRi1TasI9iKYmIzEL2ed9WSSZcUubr6TFkXoKkzeyw57RmKFdZjBSctQd4jzXzxSF6bPA8DgfRIiJKUm5VDh1iueC"
                />
              </div>
            </div>
          </div>
        </header>

        {/* Content Body */}
        <div className="p-6 md:p-10 max-w-7xl mx-auto w-full space-y-6 flex-grow">
          
          {/* Student Header Card */}
          <div className="bg-white border border-slate-200/60 rounded-3xl p-6 flex flex-col md:flex-row items-center md:items-start justify-between gap-6 card-shadow">
            <div className="flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
              <div className="relative flex-shrink-0">
                <div className="w-20 h-20 rounded-2xl bg-ttp-primary/10 text-ttp-primary font-montserrat text-3xl font-extrabold flex items-center justify-center border border-ttp-primary/20">
                  {student.name.charAt(0)}
                </div>
                <span className="absolute -bottom-2 -right-2 bg-ttp-primary text-white text-[10px] font-bold px-2 py-0.5 rounded-lg uppercase border-2 border-white shadow-sm">
                  LEVEL B2
                </span>
              </div>
              <div className="space-y-1">
                <h2 className="font-montserrat text-xl font-bold text-slate-800 tracking-tight">{student.name}{student.last_name ? ` ${student.last_name}` : ""}</h2>
                <p className="text-slate-500 text-xs font-semibold">
                  ID: {student.id.substring(0, 13)} • <span className="text-ttp-primary font-bold">{student.current_course}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button 
                onClick={handleGenerateCertificate}
                className="bg-ttp-primary hover:opacity-95 text-white px-5 py-2.5 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all active:scale-95 shadow-md shadow-ttp-primary/5 text-sm whitespace-nowrap"
              >
                <span className="material-symbols-outlined text-lg">workspace_premium</span>
                Emitir Constancia
              </button>
              {/* Admin CRUD Actions */}
              <button
                onClick={handleOpenEditModal}
                title="Editar Alumno"
                className="p-2.5 border border-slate-200 rounded-xl text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-all active:scale-95"
              >
                <span className="material-symbols-outlined text-lg">edit</span>
              </button>
              <button
                onClick={() => setStudentCrudModal("suspend")}
                title={(student?.status === "suspended" || student?.status === "suspendido") ? "Reactivar Alumno" : "Suspender Alumno"}
                className={`p-2.5 border rounded-xl transition-all active:scale-95 ${
                  (student?.status === "suspended" || student?.status === "suspendido")
                    ? "border-teal-200 text-teal-600 hover:bg-teal-50"
                    : "border-amber-200 text-amber-600 hover:bg-amber-50"
                }`}
              >
                <span className="material-symbols-outlined text-lg">{(student?.status === "suspended" || student?.status === "suspendido") ? "check_circle" : "block"}</span>
              </button>
              <button
                onClick={() => setStudentCrudModal("delete")}
                title="Eliminar Alumno"
                className="p-2.5 border border-rose-200 rounded-xl text-rose-600 hover:bg-rose-50 transition-all active:scale-95"
              >
                <span className="material-symbols-outlined text-lg">delete</span>
              </button>
            </div>
          </div>

          {/* Bento Two-Column Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            
            {/* Left Column (Details and Sub-widgets) - span 2 */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Personal Details & Tabs Container */}
              <div className="bg-white border border-slate-200/60 rounded-3xl card-shadow overflow-hidden">
                {/* Horizontal Navigation Tabs */}
                <div className="flex border-b border-slate-100 bg-slate-50/50">
                  {["Información Personal", "Académico", "Horarios", "Financiero", "Burlington English"].map((tab) => {
                    const isActive = activeTab === tab;
                    return (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-6 py-4 font-semibold text-xs transition-all relative ${
                          isActive 
                            ? "text-ttp-primary font-bold" 
                            : "text-slate-500 hover:text-slate-800"
                        }`}
                      >
                        {tab}
                        {isActive && (
                          <div className="absolute bottom-0 left-6 right-6 h-0.5 bg-ttp-primary rounded-full"></div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Tab Content Display */}
                <div className="p-6">
                  {activeTab === "Información Personal" && (
                    <div className="space-y-5 text-sm">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
                        <div className="space-y-1">
                          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Nombre</label>
                          <p className="font-semibold text-slate-800">{student.name}</p>
                        </div>
                        <div className="space-y-1">
                          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Apellido</label>
                          <p className="font-semibold text-slate-800">{student.last_name || "—"}</p>
                        </div>
                        <div className="space-y-1">
                          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Correo Electrónico</label>
                          <p className="font-semibold text-slate-800">{student.email}</p>
                        </div>
                        <div className="space-y-1">
                          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">WhatsApp</label>
                          <p className="font-semibold text-slate-800">{student.phone || "—"}</p>
                        </div>
                        <div className="space-y-1">
                          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Fecha de Nacimiento</label>
                          <p className="font-semibold text-slate-800">{student.birthdate || "—"}</p>
                        </div>
                        <div className="space-y-1">
                          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Fecha de Inicio</label>
                          <p className="font-semibold text-slate-800">{student.enrolled_date ? new Date(student.enrolled_date).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" }) : "—"}</p>
                        </div>
                        <div className="space-y-1">
                          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Nacionalidad</label>
                          <p className="font-semibold text-slate-800">{student.nationality || "—"}</p>
                        </div>
                        <div className="space-y-1">
                          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Ocupación</label>
                          <p className="font-semibold text-slate-800">{student.occupation || "—"}</p>
                        </div>
                        <div className="space-y-1 md:col-span-2">
                          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Dirección</label>
                          <p className="font-semibold text-slate-800">{student.address || "—"}</p>
                        </div>
                        <div className="space-y-1">
                          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Estado</label>
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap ${
                            student.status === "active" ? "bg-teal-50 border-teal-200 text-teal-600" :
                            student.status === "suspended" ? "bg-amber-50 border-amber-200 text-amber-600" :
                            student.status === "graduated" ? "bg-sky-50 border-sky-200 text-sky-600" :
                            student.status === "prospect" ? "bg-violet-50 border-violet-200 text-violet-600" :
                            "bg-rose-50 border-rose-200 text-rose-600"
                          }`}>
                            {student.status === "active" ? "Activo" : student.status === "inactive" ? "Inactivo" : student.status === "suspended" ? "Suspendido" : student.status === "graduated" ? "Egresado" : student.status === "prospect" ? "Prospecto" : "Moroso"}
                          </span>
                        </div>
                      </div>

                      {(student.status === "suspended" || student.suspension_date) && (
                        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 space-y-2">
                          <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Información de Suspensión</p>
                          <div className="grid grid-cols-2 gap-4 text-xs">
                            <div>
                              <span className="text-slate-400 block mb-0.5 font-semibold">Fecha de Suspensión</span>
                              <span className="font-bold text-slate-800">{student.suspension_date ? new Date(student.suspension_date).toLocaleDateString("es-ES") : "—"}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block mb-0.5 font-semibold">Motivo</span>
                              <span className="font-bold text-slate-800">{student.suspension_reason || "—"}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === "Académico" && (
                    <div className="space-y-6 text-sm">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-slate-50 rounded-2xl">
                          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Curso Actual</label>
                          <p className="font-bold text-slate-800">{student.current_course}</p>
                        </div>
                        <div className="p-4 bg-slate-50 rounded-2xl">
                          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Grupo Actual</label>
                          <p className="font-bold text-slate-800">{student.current_group || "—"}</p>
                        </div>
                        <div className="p-4 bg-slate-50 rounded-2xl">
                          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Tipo de Clase</label>
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap ${
                            student.class_type === "grupal" ? "bg-sky-50 border-sky-200 text-sky-600" :
                            student.class_type === "privada" ? "bg-violet-50 border-violet-200 text-violet-600" :
                            "bg-teal-50 border-teal-200 text-teal-600"
                          }`}>
                            {student.class_type === "grupal" ? "Grupal" : student.class_type === "privada" ? "Privada" : "Conversation Club"}
                          </span>
                        </div>
                        <div className="p-4 bg-slate-50 rounded-2xl">
                          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Profesor Asignado</label>
                          <p className="font-bold text-slate-800">{student.teacher}</p>
                        </div>
                        <div className="p-4 bg-slate-50 rounded-2xl md:col-span-2">
                          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Horario</label>
                          <p className="font-bold text-slate-800 flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-sm text-ttp-primary">schedule</span>
                            {student.schedule || "—"}
                          </p>
                        </div>
                      </div>
                      
                      <div className="p-4 border border-slate-100 rounded-2xl space-y-2 bg-white">
                        <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider text-slate-400">Progreso Académico General</h4>
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div className="bg-ttp-primary h-full rounded-full" style={{ width: "78%" }}></div>
                        </div>
                        <p className="text-xs text-slate-500 font-semibold">Desempeño sobresaliente en el nivel actual con 78% de avance.</p>
                      </div>

                      {/* Notas Académicas */}
                      {student.academic_notes && (
                        <div className="p-4 bg-sky-50/60 border border-sky-100 rounded-2xl space-y-1.5">
                          <p className="text-[10px] font-bold text-sky-600 uppercase tracking-wider flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm">school</span>
                            Notas Académicas
                          </p>
                          <p className="text-xs text-slate-700 font-medium leading-relaxed">{student.academic_notes}</p>
                        </div>
                      )}

                      {/* Historial de Cursos */}
                      {Array.isArray(student.course_history) && student.course_history.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="font-montserrat text-xs font-bold text-slate-700 uppercase tracking-wider">Historial de Cursos</h4>
                          <div className="divide-y divide-slate-100 border border-slate-200/50 rounded-2xl overflow-hidden">
                            {student.course_history.map((item, i) => (
                              <div key={i} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50/50 transition-colors">
                                <div>
                                  <p className="font-bold text-slate-800 text-xs">{item.course}</p>
                                  <p className="text-[10px] text-slate-400 font-semibold mt-0.5">{item.period}</p>
                                </div>
                                <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold border whitespace-nowrap ${
                                  item.status === "completado" ? "bg-teal-50 border-teal-200 text-teal-600" :
                                  item.status === "en_curso" ? "bg-sky-50 border-sky-200 text-sky-600" :
                                  "bg-rose-50 border-rose-200 text-rose-600"
                                }`}>
                                  {item.status === "completado" ? "✓ Completado" : item.status === "en_curso" ? "En curso" : "Abandono"}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Historial de Asistencia en el Expediente */}
                      <div className="space-y-3 pt-2">
                        <h4 className="font-montserrat text-xs font-bold text-slate-700 uppercase tracking-wider">Bitácora de Asistencias del Ciclo</h4>
                        <div className="divide-y divide-slate-100 border border-slate-200/50 rounded-2xl overflow-hidden bg-slate-50/10">
                          {attendanceHistory.map((item) => (
                            <div key={item.id} className="p-3.5 flex justify-between items-center text-xs hover:bg-slate-50/50 transition-colors">
                              <div>
                                <p className="font-bold text-slate-800">{item.date}</p>
                                <p className="text-[10px] text-slate-400 font-semibold">{item.course}</p>
                                {item.reason && (
                                  <p className="text-[10px] text-teal-600 font-medium italic mt-0.5">Motivo: "{item.reason}"</p>
                                )}
                              </div>
                              <div>
                                <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold border ${
                                  item.status === "presente"
                                    ? "bg-teal-50 border-teal-200 text-teal-600"
                                    : item.status === "justificada"
                                    ? "bg-sky-50 border-sky-200 text-sky-600"
                                    : "bg-rose-50 border-rose-200 text-rose-600 animate-pulse"
                                }`}>
                                  {item.status === "presente" ? "Asistió" : item.status === "justificada" ? "Justificada" : "Falta"}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Formulario de Justificación Médica / Laboral */}
                      {attendanceHistory.some(a => a.status === "falta") && (
                        <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200/40 space-y-4 pt-4">
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-ttp-primary text-xl font-bold">medical_services</span>
                            <h4 className="font-montserrat text-xs font-bold text-slate-700 uppercase tracking-wider">Portal de Justificantes Médicos / Laborales</h4>
                          </div>
                          
                          <form onSubmit={handleSubmittingJustification} className="space-y-3">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {/* Inasistencia a Justificar */}
                              <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Seleccionar Inasistencia</label>
                                <select
                                  value={selectedAbsenceForJustify}
                                  onChange={(e) => setSelectedAbsenceForJustify(e.target.value)}
                                  disabled={isUploadingJustify}
                                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-ttp-primary/10 text-xs font-semibold text-slate-700"
                                >
                                  <option value="">-- Elige una fecha --</option>
                                  {attendanceHistory.filter(a => a.status === "falta").map(a => (
                                    <option key={a.id} value={a.id}>Falta del {a.date}</option>
                                  ))}
                                </select>
                              </div>

                              {/* Documento Adjunto */}
                              <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Adjuntar Justificante (PDF / JPG)</label>
                                <input
                                  type="file"
                                  disabled={isUploadingJustify}
                                  onChange={(e) => setJustificationFile(e.target.value)}
                                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-ttp-primary/10 text-xs font-medium text-slate-500 file:mr-2 file:py-1 file:px-2 file:rounded-lg file:border-0 file:text-[10px] file:font-bold file:bg-ttp-primary/10 file:text-ttp-primary hover:file:bg-ttp-primary/20 cursor-pointer"
                                />
                              </div>
                            </div>

                            {/* Motivo */}
                            <div>
                              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Motivo / Explicación del Ausentismo</label>
                              <textarea
                                required
                                value={justificationReason}
                                onChange={(e) => setJustificationReason(e.target.value)}
                                disabled={isUploadingJustify}
                                rows="2"
                                className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-ttp-primary/10 text-xs font-medium text-slate-700"
                                placeholder="Escribe el motivo detallado de tu inasistencia..."
                              ></textarea>
                            </div>

                            <button
                              type="submit"
                              disabled={isUploadingJustify}
                              className="w-full px-4 py-2 bg-ttp-primary hover:opacity-90 text-white rounded-xl text-xs font-bold shadow-md active:scale-95 transition-all flex items-center justify-center gap-1.5 disabled:opacity-75"
                            >
                              {isUploadingJustify ? (
                                <>
                                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                  <span>Subiendo justificante a Supabase Storage...</span>
                                </>
                              ) : (
                                <>
                                  <span className="material-symbols-outlined text-sm">cloud_upload</span>
                                  <span>Enviar Justificante para Aprobación Automática</span>
                                </>
                              )}
                            </button>
                          </form>
                        </div>
                      )}

                      {/* Módulo de Conexión Humana (Feedback & Motivación) */}
                      <div className="border-t border-slate-100 pt-6 space-y-4">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-ttp-primary text-xl font-bold">diversity_1</span>
                          <h4 className="font-montserrat text-xs font-bold text-slate-700 uppercase tracking-wider">Módulo de Conexión Humana (Automatizaciones)</h4>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {/* Feedback Semanal */}
                          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200/40 space-y-4 flex flex-col justify-between">
                            <div className="space-y-3">
                              <span className="text-slate-400 block font-bold uppercase tracking-wider text-[9px]">Feedback Semanal (Rendimiento)</span>
                              
                              <form onSubmit={handleSendWeeklyFeedback} className="space-y-3">
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Calificación de Desempeño</label>
                                  <select
                                    value={feedbackRating}
                                    onChange={(e) => setFeedbackRating(e.target.value)}
                                    disabled={isSendingFeedback}
                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-ttp-primary/10 text-xs font-semibold text-slate-700 cursor-pointer"
                                  >
                                    <option value="Sobresaliente">Sobresaliente</option>
                                    <option value="Excelente">Excelente</option>
                                    <option value="Bueno">Bueno</option>
                                    <option value="Requiere Apoyo">Requiere Apoyo</option>
                                  </select>
                                </div>

                                <div>
                                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Feedback de la Semana</label>
                                  <textarea
                                    required
                                    value={feedbackText}
                                    onChange={(e) => setFeedbackText(e.target.value)}
                                    disabled={isSendingFeedback}
                                    rows="2"
                                    className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-ttp-primary/10 text-xs font-medium text-slate-700"
                                    placeholder="Escribe el feedback de desempeño de esta semana..."
                                  ></textarea>
                                </div>

                                <button
                                  type="submit"
                                  disabled={isSendingFeedback}
                                  className="w-full px-4 py-2 bg-ttp-primary hover:opacity-90 text-white rounded-xl text-xs font-bold shadow-sm active:scale-95 transition-all flex items-center justify-center gap-1.5 disabled:opacity-75 cursor-pointer"
                                >
                                  {isSendingFeedback ? (
                                    <>
                                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                      <span>Enviando por WhatsApp...</span>
                                    </>
                                  ) : (
                                    <>
                                      <span className="material-symbols-outlined text-sm font-bold">send</span>
                                      <span>Enviar Reporte por WhatsApp</span>
                                    </>
                                  )}
                                </button>
                              </form>
                            </div>

                            {/* Historial de Feedbacks */}
                            <div className="space-y-2 pt-2 border-t border-slate-200/50">
                              <span className="text-slate-400 block font-bold uppercase tracking-wider text-[9px]">Historial de Reportes</span>
                              <div className="space-y-2 max-h-[140px] overflow-y-auto pr-1">
                                {weeklyFeedbackLogs.map((log) => (
                                  <div key={log.id} className="bg-white p-3 rounded-xl border border-slate-100 space-y-1 shadow-sm">
                                    <div className="flex justify-between items-center text-[10px]">
                                      <span className="font-bold text-slate-400">{log.date}</span>
                                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                                        log.rating === "Sobresaliente" || log.rating === "Excelente"
                                          ? "bg-teal-50 border-teal-100 text-teal-600"
                                          : log.rating === "Bueno"
                                          ? "bg-amber-50 border-amber-100 text-amber-600"
                                          : "bg-rose-50 border-rose-100 text-rose-600"
                                      }`}>{log.rating}</span>
                                    </div>
                                    <p className="text-[11px] text-slate-650 font-semibold leading-relaxed">"{log.text}"</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* Mensajes Motivacionales */}
                          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200/40 space-y-4 flex flex-col justify-between">
                            <div className="space-y-3">
                              <span className="text-slate-400 block font-bold uppercase tracking-wider text-[9px]">Mensajes Motivacionales (WhatsApp)</span>
                              
                              <div className="space-y-3">
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Seleccionar Frase Motivacional</label>
                                  <select
                                    value={selectedMotivationalQuote}
                                    onChange={(e) => setSelectedMotivationalQuote(e.target.value)}
                                    disabled={isSendingMotivation}
                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-ttp-primary/10 text-xs font-semibold text-slate-700 cursor-pointer"
                                  >
                                    <option value="El aprendizaje constante de un idioma no es solo memorizar palabras, es abrir una nueva puerta al mundo de los negocios.">
                                      El aprendizaje abre una nueva puerta al mundo...
                                    </option>
                                    <option value="La constancia supera al talento. Diez minutos de práctica al día rinden más frutos que tres horas una vez a la semana.">
                                      La constancia supera al talento (10 min/día)...
                                    </option>
                                    <option value="Hablar un segundo idioma te permite duplicar tus oportunidades y conectar de manera humana con personas de todo el planeta.">
                                      Duplicar tus oportunidades y conectar con el mundo...
                                    </option>
                                    <option value="Cada error en tu pronunciación es una prueba de que estás intentando y progresando. ¡No te rindas!">
                                      Cada error es una prueba de progreso...
                                    </option>
                                    <option value="El dominio de un nuevo idioma es la herramienta más poderosa para expandir tu carrera y tu visión del mundo.">
                                      Herramienta más poderosa para expandir tu carrera...
                                    </option>
                                  </select>
                                </div>

                                <div className="bg-white p-4 rounded-xl border border-slate-200/50 text-xs font-semibold text-slate-650 leading-relaxed italic shadow-sm">
                                  "{selectedMotivationalQuote}"
                                </div>

                                <button
                                  onClick={handleSendMotivationalMessage}
                                  disabled={isSendingMotivation}
                                  className="w-full px-4 py-2 bg-ttp-primary hover:opacity-90 text-white rounded-xl text-xs font-bold shadow-sm active:scale-95 transition-all flex items-center justify-center gap-1.5 disabled:opacity-75 cursor-pointer"
                                >
                                  {isSendingMotivation ? (
                                    <>
                                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                      <span>Enviando por WhatsApp...</span>
                                    </>
                                  ) : (
                                    <>
                                      <span className="material-symbols-outlined text-sm font-bold">celebrate</span>
                                      <span>Enviar Frase Motivadora</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>

                            {/* Meta Business Info Badge */}
                            <div className="bg-white p-4 rounded-xl border border-slate-100 flex items-center justify-between text-[10px] font-bold text-slate-400 shadow-sm">
                              <span className="flex items-center gap-1">
                                <span className="material-symbols-outlined text-sm text-ttp-primary">verified</span>
                                WhatsApp Connection
                              </span>
                              <span className="text-teal-600 bg-teal-50 border border-teal-100 px-2 py-0.5 rounded-full text-[9px]">ONLINE</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === "Horarios" && (
                    <div className="space-y-5 text-sm">
                      {/* Resumen de asistencia */}
                      <div className="grid grid-cols-3 gap-3">
                        <div className="bg-teal-50 border border-teal-100 rounded-2xl p-4 text-center">
                          <p className="text-[10px] font-bold text-teal-500 uppercase tracking-wider mb-1">Presentes</p>
                          <p className="font-montserrat text-2xl font-extrabold text-teal-600">
                            {attendanceHistory.filter(a => a.status === "presente").length}
                          </p>
                        </div>
                        <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4 text-center">
                          <p className="text-[10px] font-bold text-rose-500 uppercase tracking-wider mb-1">Faltas</p>
                          <p className="font-montserrat text-2xl font-extrabold text-rose-600">
                            {attendanceHistory.filter(a => a.status === "falta").length}
                          </p>
                        </div>
                        <div className="bg-sky-50 border border-sky-100 rounded-2xl p-4 text-center">
                          <p className="text-[10px] font-bold text-sky-500 uppercase tracking-wider mb-1">Justificadas</p>
                          <p className="font-montserrat text-2xl font-extrabold text-sky-600">
                            {attendanceHistory.filter(a => a.status === "justificada").length}
                          </p>
                        </div>
                      </div>

                      {/* Barra de asistencia */}
                      {attendanceHistory.length > 0 && (() => {
                        const pct = Math.round((attendanceHistory.filter(a => a.status === "presente").length / attendanceHistory.length) * 100);
                        return (
                          <div className="bg-white border border-slate-100 rounded-2xl p-4 space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tasa de Asistencia</span>
                              <span className={`text-sm font-extrabold ${pct >= 80 ? "text-teal-600" : pct >= 60 ? "text-amber-600" : "text-rose-600"}`}>{pct}%</span>
                            </div>
                            <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full transition-all ${pct >= 80 ? "bg-teal-400" : pct >= 60 ? "bg-amber-400" : "bg-rose-400"}`} style={{ width: `${pct}%` }}></div>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Bitácora de clases */}
                      <div className="space-y-2">
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Registro de Clases — {student?.current_course}</h4>
                        <div className="divide-y divide-slate-100 border border-slate-200/50 rounded-2xl overflow-hidden">
                          {attendanceHistory.length === 0 ? (
                            <div className="p-8 text-center text-slate-400 text-xs font-medium">Sin clases registradas aún.</div>
                          ) : (
                            attendanceHistory.map((item) => (
                              <div key={item.id} className="flex items-center justify-between p-4 hover:bg-slate-50/50 transition-colors">
                                <div className="flex items-center gap-3">
                                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                                    item.status === "presente" ? "bg-teal-50 text-teal-600" :
                                    item.status === "justificada" ? "bg-sky-50 text-sky-600" :
                                    "bg-rose-50 text-rose-600"
                                  }`}>
                                    <span className="material-symbols-outlined text-lg">
                                      {item.status === "presente" ? "check_circle" : item.status === "justificada" ? "verified" : "cancel"}
                                    </span>
                                  </div>
                                  <div>
                                    <p className="font-bold text-slate-800 text-xs">{item.date}</p>
                                    <p className="text-[10px] text-slate-400 font-medium">{item.course}</p>
                                    {item.reason && (
                                      <p className="text-[10px] text-sky-600 font-medium mt-0.5 italic">"{item.reason}"</p>
                                    )}
                                  </div>
                                </div>
                                <span className={`px-2.5 py-1 rounded-full text-[9px] font-bold border ${
                                  item.status === "presente" ? "bg-teal-50 border-teal-200 text-teal-600" :
                                  item.status === "justificada" ? "bg-sky-50 border-sky-200 text-sky-600" :
                                  "bg-rose-50 border-rose-200 text-rose-600"
                                }`}>
                                  {item.status === "presente" ? "Asistió" : item.status === "justificada" ? "Justificada" : "Falta"}
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      {/* Justificar falta */}
                      {attendanceHistory.some(a => a.status === "falta") && (
                        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 space-y-3">
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-amber-500 text-lg">edit_note</span>
                            <h4 className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Justificar Falta</h4>
                          </div>
                          <form onSubmit={handleSubmittingJustification} className="space-y-3">
                            <select
                              value={selectedAbsenceForJustify}
                              onChange={(e) => setSelectedAbsenceForJustify(e.target.value)}
                              className="w-full px-3 py-2 bg-white border border-amber-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-200"
                            >
                              <option value="">— Selecciona una falta —</option>
                              {attendanceHistory.filter(a => a.status === "falta").map(a => (
                                <option key={a.id} value={a.id}>Falta del {a.date}</option>
                              ))}
                            </select>
                            <textarea
                              required
                              value={justificationReason}
                              onChange={(e) => setJustificationReason(e.target.value)}
                              rows="2"
                              className="w-full px-3 py-2 bg-white border border-amber-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-200"
                              placeholder="Motivo de la inasistencia..."
                            />
                            <button
                              type="submit"
                              disabled={isUploadingJustify}
                              className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold active:scale-95 transition-all flex items-center justify-center gap-1.5 disabled:opacity-75"
                            >
                              {isUploadingJustify ? (
                                <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div><span>Procesando...</span></>
                              ) : (
                                <><span className="material-symbols-outlined text-sm">check</span><span>Enviar Justificante</span></>
                              )}
                            </button>
                          </form>
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === "Financiero" && (
                    <div className="space-y-4 text-sm">
                      {/* Estatus de pago */}
                      <div className="p-4 bg-slate-50 rounded-2xl flex justify-between items-center">
                        <div>
                          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Monto Vencido/Pendiente</label>
                          <p className="font-extrabold text-lg text-ttp-primary">${(student.amount_due ?? 0).toLocaleString()} MXN</p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap ${
                          student.payment_status === "al_corriente" ? "bg-teal-100 text-teal-600" :
                          student.payment_status === "pendiente" ? "bg-amber-100 text-amber-600" :
                          student.payment_status === "pago_fallido" ? "bg-rose-100 text-rose-600" :
                          "bg-orange-100 text-orange-600"
                        }`}>
                          {student.payment_status === "al_corriente" ? "Pago Realizado" :
                           student.payment_status === "pendiente" ? "Pendiente" :
                           student.payment_status === "pago_fallido" ? "Pago Fallido" :
                           "Moroso"}
                        </span>
                      </div>

                      {/* Fechas y referencia */}
                      <div className="grid grid-cols-2 gap-3 text-xs font-medium">
                        <div className="p-3 border border-slate-100 rounded-xl">
                          <span className="text-slate-400 block mb-0.5">Referencia de Pago</span>
                          <span className="font-bold text-slate-800">{student.payment_reference || "—"}</span>
                        </div>
                        <div className="p-3 border border-slate-100 rounded-xl">
                          <span className="text-slate-400 block mb-0.5">Último Pago Registrado</span>
                          <span className="font-bold text-slate-800">{student.last_payment_date ? new Date(student.last_payment_date).toLocaleDateString("es-ES") : "—"}</span>
                        </div>
                        <div className="p-3 border border-slate-100 rounded-xl">
                          <span className="text-slate-400 block mb-0.5">Próxima Fecha Estimada de Pago</span>
                          <span className="font-bold text-slate-800">{student.next_payment ? new Date(student.next_payment).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" }) : "—"}</span>
                        </div>
                        <div className="p-3 border border-slate-100 rounded-xl">
                          <span className="text-slate-400 block mb-0.5">Constancias Emitidas</span>
                          <span className="font-bold text-slate-800">{student.certificates_issued ?? 0}</span>
                        </div>
                      </div>

                      {/* Notas Administrativas */}
                      {student.admin_notes && (
                        <div className="p-4 bg-amber-50/60 border border-amber-100 rounded-2xl space-y-1.5">
                          <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm">admin_panel_settings</span>
                            Notas Administrativas
                          </p>
                          <p className="text-xs text-slate-700 font-medium leading-relaxed">{student.admin_notes}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === "Burlington English" && (
                    <div className="space-y-5 text-sm">
                      <div className="text-center py-4 space-y-2">
                        <span className="material-symbols-outlined text-4xl text-ttp-club">language</span>
                        <h4 className="font-montserrat font-bold text-slate-800">Burlington English</h4>
                        <p className="text-xs text-slate-500 max-w-sm mx-auto font-medium">Plataforma externa de Burlington para desarrollo de competencias de listening y lectura.</p>
                      </div>

                      <div className={`p-4 rounded-2xl border flex items-center justify-between gap-3 ${student.burlington_user ? "bg-teal-50 border-teal-100" : "bg-slate-50 border-slate-100"}`}>
                        <div className="flex items-center gap-3">
                          <span className={`material-symbols-outlined text-xl ${student.burlington_user ? "text-teal-600" : "text-slate-400"}`}>
                            {student.burlington_user ? "verified_user" : "person_off"}
                          </span>
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Usuario / Link Burlington</p>
                            <p className={`font-bold text-sm mt-0.5 ${student.burlington_user ? "text-slate-800" : "text-slate-400 italic"}`}>
                              {student.burlington_user || "Sin cuenta asignada"}
                            </p>
                          </div>
                        </div>
                        <span className={`text-[9px] font-bold px-2 py-1 rounded-full border whitespace-nowrap ${student.burlington_user ? "bg-teal-50 border-teal-200 text-teal-600" : "bg-slate-100 border-slate-200 text-slate-400"}`}>
                          {student.burlington_user ? "Activo" : "Sin licencia"}
                        </span>
                      </div>

                      <button
                        onClick={() => showToast("🔗 Abriendo reporte de progreso Burlington English...")}
                        disabled={!student.burlington_user}
                        className="w-full border border-ttp-club text-ttp-club hover:bg-ttp-club/5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        <span className="material-symbols-outlined text-sm">open_in_new</span>
                        Acceder a Reporte de Progreso Burlington
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Progress widgets row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Conversation Club Widget */}
                <div className="bg-white border border-slate-200/60 p-6 rounded-3xl card-shadow space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="font-montserrat font-bold text-sm text-slate-800">Conversation Club</h4>
                    <span className="bg-teal-50 text-teal-600 text-[10px] font-bold px-2 py-0.5 rounded-full border border-teal-100">
                      ACTIVO
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-medium">Participación destacada en debates técnicos y presentaciones de negocio.</p>
                  
                  <div className="space-y-1.5 pt-2">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-slate-400 uppercase tracking-wider">Horas Acumuladas</span>
                      <span className="text-ttp-club">24h / 40h</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                      <div className="bg-ttp-club h-full rounded-full" style={{ width: "60%" }}></div>
                    </div>
                  </div>
                </div>

                {/* Exam Readiness Widget */}
                <div className="bg-white border border-slate-200/60 p-6 rounded-3xl card-shadow space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="font-montserrat font-bold text-sm text-slate-800">Exam Readiness</h4>
                    <span className="bg-pink-50 text-ttp-primary text-[10px] font-bold px-2 py-0.5 rounded-full border border-pink-100">
                      PREPARANDO
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-medium">Próximo objetivo: Certificación TOEFL iBT programada para Diciembre.</p>
                  
                  <div className="space-y-1.5 pt-2">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-slate-400 uppercase tracking-wider">Progreso de Simulacros</span>
                      <span className="text-ttp-primary">85%</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                      <div className="bg-ttp-primary h-full rounded-full" style={{ width: "85%" }}></div>
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* Right Column (Billing Status & Advisor) */}
            <div className="space-y-6">
              
              {/* Account Status Card */}
              <div className="bg-white border border-slate-200/60 p-6 rounded-3xl card-shadow space-y-6">
                <div className="flex justify-between items-center border-b border-slate-50 pb-3">
                  <h4 className="font-montserrat font-bold text-sm text-slate-800">Estado de Cuenta</h4>
                  <span className="material-symbols-outlined text-slate-400 text-lg">credit_card</span>
                </div>

                {/* Warning Notification Alert Box */}
                <div className={`p-5 rounded-2xl border text-center space-y-2 ${
                  isOverdue 
                    ? "bg-amber-50/50 border-ttp-alert/40 text-amber-800" 
                    : "bg-teal-50/50 border-teal-200/40 text-teal-800"
                }`}>
                  <span className="material-symbols-outlined text-2xl font-bold block">
                    {isOverdue ? "warning" : "check_circle"}
                  </span>
                  <h5 className="font-bold text-sm">
                    {isOverdue ? "Pendiente" : "Pago Realizado"}
                  </h5>
                  <p className="text-xs font-medium opacity-80">
                    {isOverdue ? "Vence en: 2 días" : "Sin adeudos registrados"}
                  </p>
                </div>

                {/* Billing fields */}
                <div className="space-y-3.5 text-sm font-medium">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Monto a Pagar</span>
                    <span className="font-bold text-slate-800">${(student.amount_due ?? 0).toLocaleString()} MXN</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Referencia</span>
                    <span className="font-bold text-slate-700 text-xs">{student.payment_reference || "REF-MOR-2024"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Último Pago</span>
                    <span className="font-bold text-slate-700">
                      {student.last_payment_date ? new Date(student.last_payment_date).toLocaleDateString('es-ES', {day: 'numeric', month:'short', year:'numeric'}) : "2 Oct, 2023"}
                    </span>
                  </div>
                </div>

                {/* Billing CTA Buttons */}
                <div className="pt-2 space-y-3">
                  <button 
                    onClick={() => setShowPaymentModal(true)}
                    className="w-full border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-800 font-semibold py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 transition-all active:scale-95"
                  >
                    <span className="material-symbols-outlined text-lg">receipt_long</span>
                    Ver Historial de Pagos
                    <span className="material-symbols-outlined text-base ml-auto text-slate-400">open_in_new</span>
                  </button>

                </div>
              </div>

              {/* Advisor Card */}
              <div className="bg-[#fff0f2] border border-[#fae2e7] p-5 rounded-3xl flex items-center justify-between gap-4 card-shadow">
                <div className="flex items-center gap-3">
                  <img
                    alt="Asesor Académico"
                    className="w-11 h-11 rounded-full border-2 border-white shadow-sm flex-shrink-0"
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuCOggLERrNgDtNfhJ3G4ire2ddBavtGCFCUcAPI8WNe-qUtANUQsM_mZPm8r9W_WpWi7I_GTlY4ls2e8vB-VlcaLVNK_r4K35LvMAvIgw1U7sH6l0iy3UJvuezbvoS14HpoExpS81O0PP_UNNM4oNQK2K3B_mKHk_yDOrpL_4seytxQM7E1b--BRi1TasI9iKYmIzEL2ed9WSSZcUubr6TFkXoKkzeyw57RmKFdZjBSctQd4jzXzxSF6bPA8DgfRIiJKUm5VDh1iueC"
                  />
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 block tracking-wider uppercase">ASESOR ACADÉMICO</span>
                    <span className="font-bold text-slate-800 text-sm">{student.teacher || "Lic. Elena Valdéz"}</span>
                  </div>
                </div>
                <button 
                  onClick={() => showToast(`💬 Iniciando chat interno con ${student.teacher || "Lic. Elena Valdéz"}...`)}
                  className="p-2 bg-white text-ttp-primary rounded-full hover:bg-pink-50 transition-colors shadow-sm"
                  title="Contactar Asesor"
                >
                  <span className="material-symbols-outlined text-lg">chat</span>
                </button>
              </div>

            </div>

          </div>

        </div>
      </main>


      {/* ===== MODAL: Suspender / Reactivar Alumno ===== */}
      {studentCrudModal === "suspend" && (
        <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(15,23,42,0.7)", backdropFilter: "blur(4px)" }} onClick={(e) => { if (e.target === e.currentTarget) setStudentCrudModal(null); }}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-7 border border-slate-100 modal-card text-center space-y-4">
            <div className={`w-14 h-14 rounded-2xl mx-auto flex items-center justify-center ${(student?.status === "suspended" || student?.status === "suspendido") ? "bg-teal-50" : "bg-amber-50"}`}>
              <span className={`material-symbols-outlined text-2xl ${(student?.status === "suspended" || student?.status === "suspendido") ? "text-teal-600" : "text-amber-500"}`}>
                {(student?.status === "suspended" || student?.status === "suspendido") ? "check_circle" : "block"}
              </span>
            </div>
            <div>
              <h3 className="font-montserrat font-bold text-slate-800 text-lg">{(student?.status === "suspended" || student?.status === "suspendido") ? "¿Reactivar Alumno?" : "¿Suspender Alumno?"}</h3>
              <p className="text-sm text-slate-500 mt-1">{student?.name}</p>
              <p className="text-xs text-slate-400 mt-2 font-medium">{(student?.status === "suspended" || student?.status === "suspendido") ? "El alumno recuperará acceso a clases y plataformas." : "El alumno perderá acceso a clases y plataformas."}</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStudentCrudModal(null)} className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl font-semibold text-sm hover:bg-slate-50 transition-all">Cancelar</button>
              <button onClick={() => {
                const nextStatus = student.status === "suspended" || student.status === "suspendido" ? "active" : "suspended";
                const updated = {
                  ...student,
                  status: nextStatus,
                  suspension_date: nextStatus === "suspended" ? new Date().toISOString().split("T")[0] : null,
                  suspension_reason: nextStatus === "suspended" ? "Suspensión administrativa" : null
                };
                setStudent(updated);
                saveLocalStudent(updated);
                showToast(nextStatus === "active" ? `✅ ${student.name} reactivado.` : `⛔ ${student.name} suspendido.`);
                setStudentCrudModal(null);
              }} className={`flex-1 py-2.5 text-white rounded-xl font-bold text-sm active:scale-95 transition-all ${student?.status === "suspended" || student?.status === "suspendido" ? "bg-teal-500 hover:bg-teal-600" : "bg-amber-500 hover:bg-amber-600"}`}>
                {(student?.status === "suspended" || student?.status === "suspendido") ? "Sí, Reactivar" : "Sí, Suspender"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== MODAL: Eliminar Alumno ===== */}
      {studentCrudModal === "delete" && (
        <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(15,23,42,0.7)", backdropFilter: "blur(4px)" }} onClick={(e) => { if (e.target === e.currentTarget) { setStudentCrudModal(null); setDeleteConfirmText(""); } }}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-7 border border-slate-100 modal-card space-y-5">
            <div className="text-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-rose-50 mx-auto flex items-center justify-center">
                <span className="material-symbols-outlined text-2xl text-rose-600">delete_forever</span>
              </div>
              <h3 className="font-montserrat font-bold text-slate-800 text-lg">Eliminar Alumno</h3>
              <p className="text-sm text-slate-500">Esta acción es <strong className="text-rose-600">permanente e irreversible</strong>.</p>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Escribe el nombre del alumno para confirmar</label>
              <input value={deleteConfirmText} onChange={(e) => setDeleteConfirmText(e.target.value)} placeholder={student?.name} className="w-full px-4 py-2.5 border border-rose-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-200" />
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setStudentCrudModal(null); setDeleteConfirmText(""); }} className="flex-1 py-2.5 border border-slate-200 text-slate-500 rounded-xl font-semibold text-sm hover:bg-slate-50 transition-all">Cancelar</button>
              <button disabled={deleteConfirmText !== student?.name} onClick={async () => {
                await supabase.from("students").delete().eq("id", student.id);
                showToast(`🗑️ Alumno ${student?.name} eliminado del sistema.`);
                setStudentCrudModal(null);
                setTimeout(() => { window.location.href = "/students"; }, 1500);
              }} className="flex-1 py-2.5 bg-rose-600 text-white rounded-xl font-bold text-sm hover:bg-rose-700 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed">Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== MODAL: Editar Alumno Premium ===== */}
      {isEditModalOpen && editForm && (
        <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(15,23,42,0.7)", backdropFilter: "blur(4px)" }}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-100 modal-card">
            {/* Modal Header */}
            <div className="p-6 bg-slate-50 border-b border-slate-150 flex justify-between items-center flex-shrink-0">
              <h3 className="font-montserrat text-lg font-bold text-slate-800 flex items-center gap-2">
                <span className="material-symbols-outlined text-ttp-primary">edit_note</span>
                Editar Expediente del Alumno
              </h3>
              <button 
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-650 p-1.5 hover:bg-slate-200/50 rounded-xl transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Modal Form Content */}
            <form 
              onSubmit={handleSaveStudentEdit} 
              onKeyDown={(e) => {
                if (e.key === "Enter" && e.target.tagName === "INPUT") {
                  e.preventDefault();
                }
              }}
              className="p-6 space-y-6 overflow-y-auto flex-1 text-sm font-medium"
            >
              {/* Section 1: Información Personal */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-ttp-primary uppercase tracking-wider border-b border-slate-100 pb-1.5">1. Información Personal</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Nombre</label>
                    <input
                      autoFocus
                      required
                      type="text"
                      value={editForm.name}
                      onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                      className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-ttp-primary/10 text-xs font-semibold text-slate-700"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Apellido</label>
                    <input
                      type="text"
                      value={editForm.last_name}
                      onChange={(e) => setEditForm({...editForm, last_name: e.target.value})}
                      className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-ttp-primary/10 text-xs font-semibold text-slate-700"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Correo Electrónico</label>
                    <input
                      required
                      type="text"
                      value={editForm.email}
                      onChange={(e) => setEditForm({...editForm, email: e.target.value})}
                      className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-ttp-primary/10 text-xs font-semibold text-slate-700"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">WhatsApp / Teléfono</label>
                    <input
                      type="tel"
                      value={editForm.phone}
                      onChange={(e) => setEditForm({...editForm, phone: e.target.value})}
                      className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-ttp-primary/10 text-xs font-semibold text-slate-700"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Fecha de Nacimiento</label>
                    <input
                      type="text"
                      value={editForm.birthdate}
                      placeholder="Ej. 14 de Mayo, 1995"
                      onChange={(e) => setEditForm({...editForm, birthdate: e.target.value})}
                      className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-ttp-primary/10 text-xs font-semibold text-slate-700"
                    />
                  </div>
                  <div className="relative">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Nacionalidad</label>
                    <div className="relative">
                      <input
                        required
                        type="text"
                        value={editForm.nationality}
                        onChange={(e) => {
                          setEditForm({...editForm, nationality: e.target.value});
                          setIsNationalityDropdownOpen(true);
                        }}
                        onFocus={() => setIsNationalityDropdownOpen(true)}
                        placeholder="Buscar nacionalidad..."
                        className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-ttp-primary/10 text-xs font-semibold text-slate-700 pr-10"
                      />
                      <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-base">search</span>
                      
                      {isNationalityDropdownOpen && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setIsNationalityDropdownOpen(false)}></div>
                          <div className="absolute left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-xl z-50 divide-y divide-slate-50 animate-in fade-in slide-in-from-top-1 duration-150">
                            {NATIONALITIES
                              .filter(n => n.toLowerCase().includes((editForm.nationality || "").toLowerCase()))
                              .map((n) => (
                                <button
                                  key={n}
                                  type="button"
                                  onClick={() => {
                                    setEditForm({...editForm, nationality: n});
                                    setIsNationalityDropdownOpen(false);
                                  }}
                                  className="w-full text-left px-4 py-2 hover:bg-slate-50 text-xs font-semibold text-slate-750 transition-colors"
                                >
                                  {n}
                                </button>
                              ))
                            }
                            {NATIONALITIES.filter(n => n.toLowerCase().includes((editForm.nationality || "").toLowerCase())).length === 0 && (
                              <div className="px-4 py-3 text-xs text-slate-400 italic text-center">No se encontraron resultados. Escribe para ingresar.</div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Ocupación</label>
                    <input
                      type="text"
                      value={editForm.occupation}
                      onChange={(e) => setEditForm({...editForm, occupation: e.target.value})}
                      className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-ttp-primary/10 text-xs font-semibold text-slate-700"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Dirección Completa</label>
                    <input
                      type="text"
                      value={editForm.address}
                      onChange={(e) => setEditForm({...editForm, address: e.target.value})}
                      className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-ttp-primary/10 text-xs font-semibold text-slate-700"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Información Académica y Horarios */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-ttp-primary uppercase tracking-wider border-b border-slate-100 pb-1.5">2. Información Académica y Horarios</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Modo de Estatus</label>
                    <select
                      value={editForm.status_mode || "auto"}
                      onChange={(e) => {
                        const newMode = e.target.value;
                        let resolvedStat = editForm.status;
                        if (newMode === "auto") {
                          const hasDebt = editForm.payment_status === "moroso" || editForm.payment_status === "pago_fallido" || (parseFloat(editForm.amount_due) > 0);
                          let isInactive = false;
                          if (editForm.last_connection_date) {
                            const lastConn = new Date(editForm.last_connection_date);
                            const diffTime = Math.abs(new Date() - lastConn);
                            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                            if (diffDays > 14) isInactive = true;
                          }
                          resolvedStat = isInactive ? "inactive" : hasDebt ? "moroso" : "active";
                        }
                        setEditForm({...editForm, status_mode: newMode, status: resolvedStat});
                      }}
                      className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-ttp-primary/10 text-xs font-semibold text-slate-700 cursor-pointer"
                    >
                      <option value="auto">🔌 Automático (Por Conexión y Stripe)</option>
                      <option value="manual">✏️ Manual (Forzar Estado)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-450 uppercase tracking-wider mb-1">
                      Estado Académico
                      {editForm.status_mode === "auto" && <span className="ml-1 text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded text-[8px] font-bold">Auto-calculado</span>}
                    </label>
                    {editForm.status_mode === "auto" ? (
                      (() => {
                        const hasDebt = editForm.payment_status === "moroso" || editForm.payment_status === "pago_fallido" || (parseFloat(editForm.amount_due) > 0);
                        let isInactive = false;
                        if (editForm.last_connection_date) {
                          const lastConn = new Date(editForm.last_connection_date);
                          const diffTime = Math.abs(new Date() - lastConn);
                          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                          if (diffDays > 14) isInactive = true;
                        }
                        const resolvedVal = isInactive ? "inactive" : hasDebt ? "moroso" : "active";
                        const labelMap = { active: "Activo (Conectado y Pagado)", inactive: "Inactivo (Dado de baja por inactividad)", moroso: "Falta de pago (Moroso)" };
                        return (
                          <input
                            disabled
                            type="text"
                            value={labelMap[resolvedVal] || "Activo"}
                            className="w-full px-4 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-500 cursor-not-allowed"
                          />
                        );
                      })()
                    ) : (
                      <select
                        value={editForm.status}
                        onChange={(e) => setEditForm({...editForm, status: e.target.value})}
                        className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-ttp-primary/10 text-xs font-semibold text-slate-700 cursor-pointer"
                      >
                        <option value="active">Activo (En Curso)</option>
                        <option value="inactive">Dado de baja</option>
                        <option value="suspended">Suspendido</option>
                        <option value="graduated">Graduado</option>
                        <option value="moroso">Falta de pago</option>
                        <option value="prospect">Prospecto</option>
                        <option value="recovered">Recuperado (Recs)</option>
                      </select>
                    )}
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Fecha de Última Conexión (Para Estatus Automático)</label>
                    <input
                      type="date"
                      value={editForm.last_connection_date}
                      onChange={(e) => {
                        const newDate = e.target.value;
                        let resolvedStat = editForm.status;
                        if (editForm.status_mode === "auto") {
                          const hasDebt = editForm.payment_status === "moroso" || editForm.payment_status === "pago_fallido" || (parseFloat(editForm.amount_due) > 0);
                          let isInactive = false;
                          if (newDate) {
                            const lastConn = new Date(newDate);
                            const diffTime = Math.abs(new Date() - lastConn);
                            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                            if (diffDays > 14) isInactive = true;
                          }
                          resolvedStat = isInactive ? "inactive" : hasDebt ? "moroso" : "active";
                        }
                        setEditForm({...editForm, last_connection_date: newDate, status: resolvedStat});
                      }}
                      className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-ttp-primary/10 text-xs font-semibold text-slate-700 cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Grupo de Estudio (Rige Curso, Horario y Docente)</label>
                    <select
                      value={editForm.current_group}
                      onChange={(e) => {
                        const gr = formGroups.find(g => g.title === e.target.value);
                        setEditForm({
                          ...editForm,
                          current_group: e.target.value,
                          current_course: gr ? gr.title : "",
                          schedule: gr ? gr.schedule : "",
                          teacher: gr ? gr.teacher : "",
                          class_type: gr ? gr.class_type : "grupal"
                        });
                      }}
                      className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-ttp-primary/10 text-xs font-semibold text-slate-700 cursor-pointer"
                    >
                      <option value="">-- Seleccionar grupo existente --</option>
                      {formGroups.map(g => (
                        <option key={g.id} value={g.title}>{g.title} • {g.schedule}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-350 uppercase tracking-wider mb-1">Curso Asignado (Automático)</label>
                    <input
                      disabled
                      type="text"
                      value={editForm.current_course || "Sin curso (Elige un grupo)"}
                      className="w-full px-4 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-500 cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-355 uppercase tracking-wider mb-1">Tipo de Clase (Automático)</label>
                    <input
                      disabled
                      type="text"
                      value={
                        editForm.class_type === "grupal" ? "Grupal" : 
                        editForm.class_type === "privada" ? "Clase Privada" : 
                        editForm.class_type === "conversation_club" ? "Conversation Club" : "Grupal"
                      }
                      className="w-full px-4 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-500 cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-355 uppercase tracking-wider mb-1">Maestro Asignado (Automático)</label>
                    <input
                      disabled
                      type="text"
                      value={editForm.teacher || "Sin maestro (Elige un grupo)"}
                      className="w-full px-4 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-500 cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-355 uppercase tracking-wider mb-1">Horario Asignado (Automático)</label>
                    <input
                      disabled
                      type="text"
                      value={editForm.schedule || "Sin horario (Elige un grupo)"}
                      className="w-full px-4 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-500 cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Fecha de Registro (Inicio)</label>
                    <input
                      type="date"
                      value={editForm.enrolled_date}
                      onChange={(e) => setEditForm({...editForm, enrolled_date: e.target.value})}
                      className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-ttp-primary/10 text-xs font-semibold text-slate-700"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Usuario Burlington English</label>
                    <input
                      type="text"
                      value={editForm.burlington_user}
                      onChange={(e) => setEditForm({...editForm, burlington_user: e.target.value})}
                      className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-ttp-primary/10 text-xs font-semibold text-slate-700"
                      placeholder="Usuario burlington"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Notas Académicas y Observaciones de Progreso</label>
                  <textarea
                    value={editForm.academic_notes}
                    onChange={(e) => setEditForm({...editForm, academic_notes: e.target.value})}
                    rows="2"
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-ttp-primary/10 text-xs font-medium text-slate-700"
                    placeholder="Comportamiento, nivel y progreso académico..."
                  />
                </div>
              </div>

              {/* Section 3: Administración y Cobranza */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-ttp-primary uppercase tracking-wider border-b border-slate-100 pb-1.5">3. Control Financiero y Cobranza</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-355 uppercase tracking-wider mb-1">Estatus de Cobro (Automático por Stripe)</label>
                    <input
                      disabled
                      type="text"
                      value={
                        editForm.payment_status === "al_corriente" ? "Pago realizado (Al corriente)" :
                        editForm.payment_status === "pendiente" ? "Pendiente" :
                        editForm.payment_status === "moroso" ? "Moroso" :
                        "Pago fallido"
                      }
                      className="w-full px-4 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-500 cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Monto de Adeudo / Colegiatura ($ MXN)</label>
                    <input
                      type="number"
                      value={editForm.amount_due}
                      onChange={(e) => setEditForm({...editForm, amount_due: e.target.value})}
                      className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-ttp-primary/10 text-xs font-semibold text-slate-700 bg-white"
                      placeholder="Ej. 2450"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Referencia Bancaria / Stripe</label>
                    <input
                      type="text"
                      value={editForm.payment_reference}
                      onChange={(e) => setEditForm({...editForm, payment_reference: e.target.value})}
                      className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-ttp-primary/10 text-xs font-semibold text-slate-700"
                      placeholder="REF-..."
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Próxima Fecha de Pago</label>
                    <input
                      type="date"
                      value={editForm.next_payment}
                      onChange={(e) => setEditForm({...editForm, next_payment: e.target.value})}
                      className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-ttp-primary/10 text-xs font-semibold text-slate-700"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Notas Administrativas y de Cobranza (Privadas)</label>
                  <textarea
                    value={editForm.admin_notes}
                    onChange={(e) => setEditForm({...editForm, admin_notes: e.target.value})}
                    rows="2"
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-ttp-primary/10 text-xs font-medium text-slate-700"
                    placeholder="Acuerdos de pagos, promesas, llamadas hechas..."
                  />
                </div>
              </div>

              {/* Form Actions */}
              <div className="pt-4 flex justify-end gap-3 border-t border-slate-150 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl text-slate-500 hover:bg-slate-50 font-semibold text-xs active:scale-95 transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-ttp-primary hover:opacity-90 text-white font-bold text-xs shadow-md active:scale-95 transition-all"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
