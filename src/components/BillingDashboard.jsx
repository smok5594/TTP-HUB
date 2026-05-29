"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import { supabase } from "@/utils/supabaseClient";
import { handleMockWebhookEvent, simulateStripeCharge } from "@/utils/stripeSimulator";
import { toast } from "sonner";
import { useData } from "@/context/DataContext";

export default function BillingDashboard() {
  const { teachers: contextTeachers } = useData();

  // Estado de búsqueda y filtros
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [currentTab, setCurrentTab] = useState("transacciones"); // "transacciones", "nomina" o "burlington"

  // Estados de carga e interactividad
  const [isLoading, setIsLoading] = useState(false);
  const [isAddInvoiceOpen, setIsAddInvoiceOpen] = useState(false);
  
  // Estado para notificaciones Toast (via Sonner)

  // Lista de transacciones (con Supabase y fallback local interactivo)
  const [transactions, setTransactions] = useState([]);

  // Formulario para Crear Nueva Factura
  const [newInvoice, setNewInvoice] = useState({
    description: "",
    amount: "",
    status: "pending",
    category: "Burlington English"
  });

  // Lista predefinida de categorías financieras
  const categoriesList = ["Burlington English", "Colegiatura Mensual", "Inscripción", "Tutoría Privada", "Examen TOEFL"];

  // ==========================================
  // ESTADOS DE NÓMINA DE PROFESORES
  // ==========================================
  const [teachersPayroll, setTeachersPayroll] = useState([]);
  const [payrollHistory, setPayrollHistory] = useState([]);

  // Estados de control para modales de nómina
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [selectedTeacherForPay, setSelectedTeacherForPay] = useState(null);
  const [payProcessing, setPayProcessing] = useState(false);
  const [payConcept, setPayConcept] = useState("Pago de Honorarios - Quincena Actual");

  const [isEditTeacherModalOpen, setIsEditTeacherModalOpen] = useState(false);
  const [selectedTeacherForEdit, setSelectedTeacherForEdit] = useState(null);

  const [isAddTeacherModalOpen, setIsAddTeacherModalOpen] = useState(false);
  const [newTeacherForm, setNewTeacherForm] = useState({
    name: "",
    specialty: "English Mastery B2",
    hours: "",
    rate: "250",
    bank: "BBVA Bancomer",
    clabe: ""
  });

  // Estados del Simulador de Stripe y Automatización
  const [studentsList, setStudentsList] = useState([]);
  const [selectedStudentForSim, setSelectedStudentForSim] = useState("");
  const [webhookEventType, setWebhookEventType] = useState("invoice.payment_succeeded");
  const [isStripeSimulating, setIsStripeSimulating] = useState(false);

  // Mostrar mensaje Toast
  const showToast = (msg) => {
    if (msg.startsWith("✅")) toast.success(msg.replace("✅ ", ""));
    else if (msg.startsWith("✏️")) toast.success(msg.replace("✏️ ", ""));
    else if (msg.startsWith("🗑️")) toast.error(msg.replace("🗑️ ", ""));
    else if (msg.startsWith("⛔") || msg.includes("Error") || msg.includes("error") || msg.includes("Fall") || msg.includes("fall")) toast.error(msg);
    else if (msg.startsWith("⚠️") || msg.includes("Conflicto")) toast.warning(msg);
    else toast(msg);
  };

  // Carga de transacciones financieras desde Supabase
  const fetchTransactions = async () => {
    setIsLoading(true);
    const { data } = await supabase
      .from("billing_transactions")
      .select("*")
      .order("created_at", { ascending: false });
    setTransactions(data || []);
    setIsLoading(false);
  };

  // Sincronizar nómina con los profesores reales del contexto global (incluye campos de Supabase)
  useEffect(() => {
    if (!contextTeachers || contextTeachers.length === 0) return;
    setTeachersPayroll(
      contextTeachers.map(t => ({
        id: t.id,
        name: t.name,
        specialty: t.specialty || "Profesor de Inglés",
        hours: t.hours || 0,
        rate: t.rate || 250,
        amountPaid: t.amount_paid || 0,
        status: t.payroll_status || "pending",
        bank: t.bank || "",
        clabe: t.clabe || "",
      }))
    );
  }, [contextTeachers]);

  // Cargar historial de pagos de nómina desde Supabase
  const fetchPayrollHistory = async () => {
    const { data } = await supabase
      .from("payroll_records")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) {
      setPayrollHistory(data.map(r => ({
        id: r.id,
        speiId: r.spei_id,
        date: new Date(r.created_at).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" }),
        time: new Date(r.created_at).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }),
        teacherName: r.teacher_name,
        concept: r.concept,
        amount: r.amount,
        reference: r.reference,
        status: r.status,
        bank: r.bank,
        clabe: r.clabe_masked,
      })));
    }
  };

  // Cargar estudiantes desde Supabase para la simulación de Stripe
  const fetchStudentsForSim = async () => {
    const { data } = await supabase
      .from("students")
      .select("id, name, last_name, email, status, amount_due, payment_status, burlington_user, enrolled_date");
    const mapped = (data || []).map(s => ({
      ...s,
      name: `${s.name} ${s.last_name || ""}`.trim(),
    }));
    setStudentsList(mapped);
    setSelectedStudentForSim(mapped[0]?.id || "");
  };

  // Disparar Webhook de Stripe
  const handleTriggerStripeWebhook = async () => {
    const student = studentsList.find(s => s.id === selectedStudentForSim);
    if (!student) {
      showToast("❌ Selecciona un estudiante válido.");
      return;
    }

    setIsStripeSimulating(true);
    showToast(`🔌 Enviando evento '${webhookEventType}' al listener del webhook de TTP Hub...`);

    const payload = {
      studentId: student.id,
      studentName: student.name,
      studentEmail: student.email,
      amount: student.status === "moroso" && student.amount_due > 0 ? student.amount_due : 2450.00
    };

    setTimeout(async () => {
      await handleMockWebhookEvent(
        webhookEventType,
        payload,
        showToast,
        () => {
          fetchTransactions();
          fetchStudentsForSim(); // Recargar datos de alumnos
        }
      );
      setIsStripeSimulating(false);
    }, 1200); // 1.2s processing delay
  };

  // Ejecutar auditoría asíncrona de morosidad
  const handleAuditOverdueStudents = () => {
    showToast("🔍 Iniciando barrido y auditoría de morosidad en cartera escolar...");
    setIsStripeSimulating(true);

    setTimeout(() => {
      const morosos = studentsList.filter(s => s.status === "moroso" || s.amount_due > 0);
      if (morosos.length > 0) {
        showToast(`⚠️ Alerta de Morosidad: Detectados ${morosos.length} alumnos con pagos pendientes. Avisos de WhatsApp enviados.`);
      } else {
        showToast("✅ Auditoría: Cartera al corriente. No se detectaron cuentas vencidas.");
      }
      setIsStripeSimulating(false);
    }, 1500);
  };

  useEffect(() => {
    fetchTransactions();
    fetchStudentsForSim();
    fetchPayrollHistory();
  }, []);

  // ==========================================
  // MANEJADORES DE NÓMINA DE PROFESORES
  // ==========================================

  // Abrir modal de pago SPEI
  const handleOpenPayModal = (teacher) => {
    setSelectedTeacherForPay(teacher);
    setPayConcept(`Pago de Nómina - ${teacher.name} - Quincena Actual`);
    setIsPayModalOpen(true);
  };

  // Confirmar transferencia bancaria SPEI
  const handleConfirmSpeiPayment = async () => {
    if (!selectedTeacherForPay) return;
    setPayProcessing(true);

    const totalAccrued = selectedTeacherForPay.hours * selectedTeacherForPay.rate;
    const pendingAmount = totalAccrued - selectedTeacherForPay.amountPaid;
    const amountPaidNew = selectedTeacherForPay.amountPaid + pendingAmount;
    const trackingId = `SPEI-${Math.floor(10000 + Math.random() * 90000)}-TTP`;
    const refNum = String(Math.floor(1000000 + Math.random() * 9000000));
    const clabeMasked = selectedTeacherForPay.clabe.replace(/\s/g, "").replace(/.(?=.{4})/g, "*");

    // Persistir en Supabase: actualizar teacher + insertar en payroll_records
    await Promise.all([
      supabase.from("teachers").update({
        amount_paid: amountPaidNew,
        payroll_status: "paid",
      }).eq("id", selectedTeacherForPay.id),
      supabase.from("payroll_records").insert({
        teacher_id: selectedTeacherForPay.id,
        teacher_name: selectedTeacherForPay.name,
        concept: payConcept,
        amount: pendingAmount,
        spei_id: trackingId,
        reference: refNum,
        bank: selectedTeacherForPay.bank,
        clabe_masked: clabeMasked,
        status: "Exitoso",
      }),
    ]);

    // Actualizar estado local
    setTeachersPayroll(prev =>
      prev.map(t => t.id === selectedTeacherForPay.id
        ? { ...t, amountPaid: amountPaidNew, status: "paid" }
        : t
      )
    );
    await fetchPayrollHistory();

    showToast(`💸 Transferencia SPEI de $${pendingAmount.toLocaleString()} MXN a ${selectedTeacherForPay.name} procesada con éxito.`);
    setPayProcessing(false);
    setIsPayModalOpen(false);
    setSelectedTeacherForPay(null);
  };

  // Abrir modal de ajuste
  const handleOpenEditModal = (teacher) => {
    setSelectedTeacherForEdit({ ...teacher });
    setIsEditTeacherModalOpen(true);
  };

  // Guardar cambios del profesor (Horas / Tarifa / Banco / CLABE) → persiste en Supabase
  const handleSaveTeacherEdit = async (e) => {
    e.preventDefault();
    if (!selectedTeacherForEdit) return;

    const hrs = Number(selectedTeacherForEdit.hours);
    const rt = Number(selectedTeacherForEdit.rate);
    const paid = Number(selectedTeacherForEdit.amountPaid);

    if (isNaN(hrs) || hrs < 0 || isNaN(rt) || rt <= 0 || isNaN(paid) || paid < 0) {
      showToast("❌ Introduce valores numéricos válidos.");
      return;
    }

    const totalAccrued = hrs * rt;
    let newStatus = "pending";
    if (paid >= totalAccrued && totalAccrued > 0) newStatus = "paid";
    else if (paid > 0) newStatus = "partial";

    await supabase.from("teachers").update({
      completed_hours: hrs,
      rate: rt,
      amount_paid: paid,
      payroll_status: newStatus,
      bank: selectedTeacherForEdit.bank,
      clabe: selectedTeacherForEdit.clabe,
    }).eq("id", selectedTeacherForEdit.id);

    setTeachersPayroll(prev =>
      prev.map(t => t.id === selectedTeacherForEdit.id
        ? { ...t, hours: hrs, rate: rt, amountPaid: paid, status: newStatus, bank: selectedTeacherForEdit.bank, clabe: selectedTeacherForEdit.clabe }
        : t
      )
    );

    showToast(`📝 Datos de nómina de ${selectedTeacherForEdit.name} actualizados.`);
    setIsEditTeacherModalOpen(false);
    setSelectedTeacherForEdit(null);
  };

  // Agregar nuevo docente al ledger de nómina
  const handleAddTeacherSubmit = (e) => {
    e.preventDefault();
    const hrs = Number(newTeacherForm.hours);
    const rt = Number(newTeacherForm.rate);
    
    if (!newTeacherForm.name.trim()) {
      showToast("❌ El nombre del profesor es requerido.");
      return;
    }
    if (isNaN(hrs) || hrs < 0 || isNaN(rt) || rt <= 0) {
      showToast("❌ Introduce horas y tarifa válidas.");
      return;
    }

    const newTeacher = {
      id: `tp-${Date.now()}`,
      name: newTeacherForm.name,
      specialty: newTeacherForm.specialty,
      hours: hrs,
      rate: rt,
      amountPaid: 0,
      status: "pending",
      bank: newTeacherForm.bank,
      clabe: newTeacherForm.clabe || "0121 800" + Math.floor(10000000000 + Math.random() * 90000000000)
    };

    setTeachersPayroll((prev) => [...prev, newTeacher]);
    showToast(`👤 ${newTeacherForm.name} agregado exitosamente al ciclo de nómina.`);
    setIsAddTeacherModalOpen(false);
    
    // Reset form
    setNewTeacherForm({
      name: "",
      specialty: "English Mastery B2",
      hours: "",
      rate: "250",
      bank: "BBVA Bancomer",
      clabe: ""
    });
  };

  // Descargar comprobante digital SPEI (.txt estructurado)
  const handleDownloadVoucher = (item) => {
    showToast(`💾 Descargando comprobante de transferencia SPEI...`);

    const element = document.createElement("a");
    const file = new Blob([
      `==================================================\n` +
      `       TTP HUB - COMPROBANTE DIGITAL DE NÓMINA     \n` +
      `                 TRANSFERENCIA SPEI                \n` +
      `==================================================\n\n` +
      `ID de Transferencia: ${item.speiId}\n` +
      `Clave de Rastreo: ${item.speiId}\n` +
      `Fecha de Operación: ${item.date} a las ${item.time} hrs\n` +
      `Estatus de Pago: ${item.status.toUpperCase()}\n\n` +
      `--------------------------------------------------\n` +
      `                 DATOS DEL EMISOR                 \n` +
      `--------------------------------------------------\n` +
      `Institución Emisora: BANCO INDUSTRIAL TTP\n` +
      `Cliente Emisor: TTP HUB S.A. DE C.V.\n\n` +
      `--------------------------------------------------\n` +
      `               DATOS DEL BENEFICIARIO             \n` +
      `--------------------------------------------------\n` +
      `Nombre Beneficiario: ${item.teacherName}\n` +
      `Institución Receptora: ${item.bank}\n` +
      `Cuenta CLABE: ${item.clabe}\n\n` +
      `--------------------------------------------------\n` +
      `              DETALLES DE LA OPERACIÓN            \n` +
      `--------------------------------------------------\n` +
      `Concepto de Pago: ${item.concept}\n` +
      `Referencia Numérica: ${item.reference}\n` +
      `Monto Transferido: $${item.amount.toLocaleString()} MXN\n` +
      `IVA: $0.00 MXN\n\n` +
      `==================================================\n` +
      `      Comprobante emitido de forma digital para   \n` +
      `      fines de control interno escolar de TTP.    \n` +
      `==================================================`
    ], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `Comprobante_SPEI_${item.speiId}_${item.teacherName.replace(/\s+/g, "_")}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  // Crear Factura / Transacción Financiera
  const handleAddInvoiceSubmit = async (e) => {
    e.preventDefault();
    const amountVal = Number(newInvoice.amount);
    if (isNaN(amountVal) || amountVal <= 0) {
      showToast("❌ Introduce un monto válido.");
      return;
    }

    try {
      const { error } = await supabase
        .from("billing_transactions")
        .insert([
          {
            description: newInvoice.description,
            amount: amountVal,
            status: newInvoice.status,
            category: newInvoice.category
          }
        ]);

      if (error) throw error;
      showToast(`¡Factura "${newInvoice.description}" creada exitosamente en Supabase!`);
      setIsAddInvoiceOpen(false);
      
      // Recargar
      fetchTransactions();
    } catch (err) {
      console.warn("No se pudo escribir en Supabase. Añadiendo de forma simulada local.");
      
      const simulatedTrans = {
        id: `t-${Date.now()}`,
        description: newInvoice.description,
        amount: amountVal,
        status: newInvoice.status,
        category: newInvoice.category,
        date: new Date().toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })
      };

      setTransactions((prev) => [simulatedTrans, ...prev]);
      setIsAddInvoiceOpen(false);
      showToast(`¡Factura "${newInvoice.description}" creada localmente (Simulado)!`);
    }

    // Limpiar formulario
    setNewInvoice({
      description: "",
      amount: "",
      status: "pending",
      category: "Burlington English"
    });
  };

  // Autocompletar transacciones de prueba
  const handleSeedTransactions = async () => {
    setIsLoading(true);
    if (studentsList.length === 0) {
      showToast("⚠️ Registra un estudiante primero para sembrar sus facturas.");
      setIsLoading(false);
      return;
    }
    try {
      const seedData = studentsList.map(s => ({
        description: `Colegiatura Mensual - ${s.name}`,
        amount: Number(s.amount_due || 2450),
        status: (s.status === "moroso" || s.payment_status === "moroso") ? "overdue" : s.payment_status === "al_corriente" ? "processed" : "pending",
        category: "Colegiatura Mensual"
      }));
      const { error } = await supabase.from("billing_transactions").insert(seedData);
      if (error) throw error;
      showToast("✅ Transacciones de tus estudiantes sembradas en Supabase.");
      fetchTransactions();
    } catch (err) {
      showToast("⛔ Error al sembrar transacciones.");
    } finally {
      setIsLoading(false);
    }
  };

  // Registrar cobro / Marcar como pagada
  const handleMarkAsPaid = async (id, description) => {
    try {
      const { error } = await supabase
        .from("billing_transactions")
        .update({ status: "processed" })
        .eq("id", id);

      if (error) throw error;
      showToast(`¡Pago de "${description}" cobrado con éxito!`);
      fetchTransactions();
    } catch (err) {
      setTransactions((prev) =>
        prev.map((t) => (t.id === id ? { ...t, status: "processed" } : t))
      );
      showToast(`¡Pago de "${description}" cobrado localmente (Simulado)!`);
    }
  };

  // Enviar recordatorio de pago
  const handleSendReminder = (studentDesc) => {
    const studentName = studentDesc.split("-")[1]?.trim() || studentDesc;
    showToast(`✉️ Recordatorio de pago enviado con éxito a ${studentName} por correo y WhatsApp.`);
  };

  // Descargar reporte financiero
  const handleDownloadReport = () => {
    showToast("📊 Generando balance de cuenta de TTP Hub... Iniciando descarga...");
    
    const processedSum = transactions.filter(t => t.status === "processed").reduce((acc, curr) => acc + curr.amount, 0);
    const pendingSum = transactions.filter(t => t.status !== "processed").reduce((acc, curr) => acc + curr.amount, 0);

    const element = document.createElement("a");
    const file = new Blob([
      `==================================================\n` +
      `              TTP HUB - REPORTE DE FACTURACIÓN     \n` +
      `==================================================\n\n` +
      `Fecha de Reporte: ${new Date().toLocaleString()}\n` +
      `Transacciones evaluadas: ${transactions.length}\n` +
      `Ingresos Registrados (Cobrados): $${processedSum.toLocaleString()} MXN\n` +
      `Monto por Cobrar (Pendiente): $${pendingSum.toLocaleString()} MXN\n` +
      `Tasa de Cobro Efectivo: ${transactions.length > 0 ? Math.round((processedSum / (processedSum + pendingSum)) * 100) : 0}%\n\n` +
      `==================================================\n` +
      `               DETALLE DE TRANSACCIONES           \n` +
      `==================================================\n` +
      transactions.map(t => `• [${t.date}] ${t.category} - ${t.description}: $${t.amount.toLocaleString()} MXN (${t.status.toUpperCase()})`).join("\n") +
      `\n==================================================`
    ], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `Reporte_Facturacion_TTPHub_${Date.now()}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  // Aplicar filtros locales de búsqueda y estados
  let filteredTransactions = [...transactions];
  if (search.trim()) {
    filteredTransactions = filteredTransactions.filter(
      (t) =>
        t.description.toLowerCase().includes(search.toLowerCase()) ||
        t.category.toLowerCase().includes(search.toLowerCase())
    );
  }
  if (statusFilter) {
    filteredTransactions = filteredTransactions.filter((t) => t.status === statusFilter);
  }
  if (categoryFilter) {
    filteredTransactions = filteredTransactions.filter((t) => t.category === categoryFilter);
  }

  // Calcular KPIs en tiempo real desde la lista visible
  const totalBilled = transactions.reduce((acc, curr) => acc + curr.amount, 0);
  const incomeCollected = transactions.filter((t) => t.status === "processed").reduce((acc, curr) => acc + curr.amount, 0);
  const incomePending = transactions.filter((t) => t.status !== "processed").reduce((acc, curr) => acc + curr.amount, 0);
  
  const collectionRate = totalBilled > 0 ? Math.round((incomeCollected / totalBilled) * 100) : 0;
  const overdueCount = transactions.filter((t) => t.status === "overdue").length;

  // Burlington licenses statistics dynamically derived from students list
  const burlingtonLicenses = studentsList
    .filter(s => s.burlington_user)
    .map((s) => ({
      id: `b-${s.id}`,
      student: s.name,
      licenseKey: s.burlington_user,
      activeFrom: s.enrolled_date || "2023-09-15",
      status: s.status === "active" ? "activo" : s.status === "moroso" ? "activo" : s.status === "suspended" ? "suspendido" : "inactivo",
      cost: 680
    }));

  // Ítems de navegación lateral
  const menuItems = [
    { name: "Panel de Control", icon: "dashboard", route: "/" },
    { name: "Horarios", icon: "calendar_today", route: "/schedules" },
    { name: "Estudiantes", icon: "school", route: "/students" },
    { name: "Profesores", icon: "person_4", route: "#" },
    { name: "Facturación", icon: "payments", route: "/billing" }
  ];

  return (
    <div className="flex min-h-screen bg-slate-50 font-inter relative">
      {/* SideNavBar */}
      <Sidebar activeName="Facturación" />

      {/* Main Canvas */}
      <main className="flex-1 md:ml-64 min-h-screen flex flex-col pb-20 md:pb-10">
        {/* TopNavBar */}
        <header className="flex justify-between items-center w-full px-6 md:px-10 h-16 sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200 transition-all">
          <div className="flex items-center gap-4">
            <span className="font-montserrat text-2xl font-bold text-ttp-primary tracking-tight">
              TTP Hub
            </span>
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
        <div className="p-6 md:p-10 max-w-7xl mx-auto w-full space-y-8">
          
          {/* Header Section */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-200/60 pb-5">
            <div>
              <h2 className="font-montserrat text-2xl font-bold text-slate-800 tracking-tight">Facturación</h2>
              <p className="text-slate-500 font-medium text-sm mt-1">
                {currentTab === "transacciones" && "Supervisa los cobros, colegiaturas y balances generales de los estudiantes de TTP."}
                {currentTab === "nomina" && "Supervisa y gestiona el pago de honorarios y nómina de profesores, dispersa fondos mediante SPEI bancario."}
                {currentTab === "burlington" && "Monitorea las licencias e ingresos por claves de Burlington English asignadas."}
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              {currentTab === "transacciones" && (
                <>
                  <button 
                    onClick={handleDownloadReport}
                    className="bg-white border border-slate-200 text-slate-700 px-5 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 hover:bg-slate-50 transition-all shadow-sm"
                  >
                    <span className="material-symbols-outlined text-sm">download</span>
                    Descargar Balance
                  </button>
                  <button 
                    onClick={() => setIsAddInvoiceOpen(true)}
                    className="bg-ttp-primary text-white px-5 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:opacity-90 transition-all active:scale-95 shadow-md shadow-ttp-primary/10"
                  >
                    <span className="material-symbols-outlined text-sm font-bold">add</span>
                    Nueva Factura Alumno
                  </button>
                </>
              )}
              {currentTab === "nomina" && (
                <button 
                  onClick={() => setIsAddTeacherModalOpen(true)}
                  className="bg-ttp-primary text-white px-5 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:opacity-90 transition-all active:scale-95 shadow-md shadow-ttp-primary/10"
                >
                  <span className="material-symbols-outlined text-sm font-bold">person_add</span>
                  Agregar Profesor a Nómina
                </button>
              )}
            </div>
          </div>

          {/* Tab Selection */}
          <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200/50 w-fit">
            <button
              onClick={() => setCurrentTab("transacciones")}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                currentTab === "transacciones"
                  ? "bg-white text-ttp-primary shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span className="material-symbols-outlined text-sm font-bold">school</span>
              Cobros a Estudiantes
            </button>
            <button
              onClick={() => setCurrentTab("nomina")}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                currentTab === "nomina"
                  ? "bg-white text-ttp-primary shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span className="material-symbols-outlined text-sm font-bold">badge</span>
              Nómina de Profesores
            </button>
            <button
              onClick={() => setCurrentTab("burlington")}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                currentTab === "burlington"
                  ? "bg-white text-ttp-primary shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span className="material-symbols-outlined text-sm font-bold">language</span>
              Licencias de Burlington English
            </button>
          </div>

          {currentTab === "transacciones" ? (
            <>
              {/* Financial KPI Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Collected */}
                <div className="bg-white border border-slate-200/60 p-6 rounded-2xl card-shadow relative overflow-hidden group">
                  <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-teal-500"></div>
                  <p className="text-xs font-bold tracking-wider text-slate-400 uppercase mb-2">Ingresos Cobrados (Mes)</p>
                  <h3 className="font-montserrat text-3xl font-extrabold text-slate-800">${incomeCollected.toLocaleString()} MXN</h3>
                  <p className="text-xs text-teal-600 font-bold flex items-center gap-1 mt-3">
                    <span className="material-symbols-outlined text-sm font-bold">trending_up</span>
                    Flujo de caja saludable
                  </p>
                </div>
                
                {/* Pending */}
                <div className="bg-white border border-slate-200/60 p-6 rounded-2xl card-shadow relative overflow-hidden group">
                  <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-ttp-alert"></div>
                  <p className="text-xs font-bold tracking-wider text-slate-400 uppercase mb-2">Monto Pendiente</p>
                  <h3 className="font-montserrat text-3xl font-extrabold text-slate-800">${incomePending.toLocaleString()} MXN</h3>
                  <p className={`text-xs font-bold flex items-center gap-1 mt-3 ${overdueCount > 0 ? "text-amber-600" : "text-teal-600"}`}>
                    <span className="material-symbols-outlined text-sm" data-icon={overdueCount > 0 ? "warning" : "check_circle"}>
                      {overdueCount > 0 ? "warning" : "check_circle"}
                    </span>
                    {overdueCount > 0 ? `${overdueCount} facturas vencidas` : "Sin cuentas vencidas"}
                  </p>
                </div>

                {/* Collection Rate */}
                <div className="bg-white border border-slate-200/60 p-6 rounded-2xl card-shadow relative overflow-hidden flex items-center justify-between group">
                  <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#ae1d5f]"></div>
                  <div>
                    <p className="text-xs font-bold tracking-wider text-slate-400 uppercase mb-2">Tasa de Cobro</p>
                    <h3 className="font-montserrat text-3xl font-extrabold text-[#ae1d5f]">{collectionRate}%</h3>
                    <p className="text-xs text-slate-500 font-semibold mt-3">Meta mensual: 95%</p>
                  </div>
                  <div className="relative h-16 w-16 flex-shrink-0">
                    <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
                      <path className="stroke-slate-100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" strokeWidth="4"></path>
                      <path className="stroke-ttp-primary" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" strokeDasharray={`${collectionRate}, 100`} strokeLinecap="round" strokeWidth="4"></path>
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-[10px] font-extrabold text-ttp-primary">{collectionRate}%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Filters Box */}
              <div className="bg-white border border-slate-200/60 rounded-2xl p-5 card-shadow">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Search Description */}
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
                    <input 
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-ttp-primary/10 focus:border-ttp-primary transition-all text-sm font-medium" 
                      placeholder="Buscar por concepto o alumno..." 
                      type="text"
                    />
                  </div>
                  
                  {/* Status Filter */}
                  <div className="relative">
                    <select 
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="w-full pl-4 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-xl appearance-none focus:outline-none focus:ring-2 focus:ring-ttp-primary/10 focus:border-ttp-primary transition-all text-sm font-medium text-slate-700 bg-white"
                    >
                      <option value="">Todos los Estados</option>
                      <option value="processed">Cobrado / Procesado</option>
                      <option value="pending">Pendiente de Pago</option>
                      <option value="overdue">Vencido</option>
                    </select>
                    <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-lg">expand_more</span>
                  </div>
                  
                  {/* Category Filter */}
                  <div className="relative">
                    <select 
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                      className="w-full pl-4 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-xl appearance-none focus:outline-none focus:ring-2 focus:ring-ttp-primary/10 focus:border-ttp-primary transition-all text-sm font-medium text-slate-700 bg-white"
                    >
                      <option value="">Todas las Categorías</option>
                      {categoriesList.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                    <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-lg">expand_more</span>
                  </div>
                </div>
              </div>

              {/* Transactions Table Card */}
              <div className="bg-white border border-slate-200/60 rounded-3xl card-shadow overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50 text-slate-400 text-xs font-bold uppercase tracking-wider">
                        <th className="px-6 py-4">Concepto</th>
                        <th className="px-6 py-4">Alumno</th>
                        <th className="px-6 py-4">Categoría</th>
                        <th className="px-6 py-4">Fecha</th>
                        <th className="px-6 py-4">Monto</th>
                        <th className="px-6 py-4">Estado</th>
                        <th className="px-6 py-4 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm font-medium">
                      {isLoading ? (
                        <tr>
                          <td colSpan="7" className="px-6 py-12 text-center text-slate-400 font-semibold">
                            Cargando balance financiero...
                          </td>
                        </tr>
                      ) : filteredTransactions.length === 0 ? (
                        <tr>
                          <td colSpan="7" className="px-6 py-12 text-center text-slate-400">
                            <div className="flex flex-col items-center justify-center gap-3 py-6">
                              <span className="material-symbols-outlined text-5xl text-slate-300">account_balance_wallet</span>
                              <div>
                                <p className="text-slate-600 font-bold">Tu balance financiero está vacío</p>
                                <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed mt-1">
                                  No hay transacciones registradas. Puedes crear facturas manualmente o autocompletar con el set de prueba.
                                </p>
                              </div>
                              <div className="flex gap-2.5 mt-2">
                                <button 
                                  onClick={handleSeedTransactions}
                                  className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-xl text-xs font-bold hover:bg-slate-50 transition-all shadow-sm active:scale-95 flex items-center gap-1"
                                >
                                  <span className="material-symbols-outlined text-sm text-pink-500">auto_awesome</span>
                                  Sembrar Cuentas de Prueba
                                </button>
                                <button 
                                  onClick={() => setIsAddInvoiceOpen(true)}
                                  className="bg-ttp-primary text-white px-4 py-2 rounded-xl text-xs font-bold hover:opacity-90 transition-all shadow-sm active:scale-95 flex items-center gap-1"
                                >
                                  <span className="material-symbols-outlined text-sm">add</span>
                                  Nueva Factura
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        filteredTransactions.map((t) => {
                          const lastDash = t.description.lastIndexOf(" - ");
                          const concept = lastDash !== -1 ? t.description.substring(0, lastDash) : t.description;
                          const studentName = lastDash !== -1 ? t.description.substring(lastDash + 3) : "—";
                          return (
                          <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-6 py-4 font-bold text-slate-800">{concept}</td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-ttp-primary/10 text-ttp-primary text-[10px] font-extrabold flex items-center justify-center flex-shrink-0">
                                  {studentName !== "—" ? studentName.charAt(0) : "—"}
                                </div>
                                <span className="text-xs font-semibold text-slate-700">{studentName}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-xs font-semibold text-slate-500">{t.category}</td>
                            <td className="px-6 py-4 text-xs text-slate-400 font-medium">{t.date}</td>
                            <td className="px-6 py-4 font-extrabold text-slate-800">${t.amount.toLocaleString()} MXN</td>
                            <td className="px-6 py-4">
                              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                                t.status === "processed"
                                  ? "bg-teal-50 border-teal-200 text-teal-600"
                                  : t.status === "pending"
                                  ? "bg-amber-50 border-amber-200 text-amber-600 animate-pulse"
                                  : "bg-rose-50 border-rose-200 text-rose-600"
                              }`}>
                                {t.status === "processed" ? "Cobrado" : t.status === "pending" ? "Pendiente" : "Vencido"}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex gap-2 justify-end">
                                {t.status !== "processed" && (
                                  <>
                                    <button 
                                      onClick={() => handleMarkAsPaid(t.id, t.description)}
                                      className="p-1.5 bg-teal-50 text-teal-600 hover:bg-teal-100 rounded-lg border border-teal-200 transition-all"
                                      title="Registrar Cobro"
                                    >
                                      <span className="material-symbols-outlined text-base font-bold">check</span>
                                    </button>
                                    <button 
                                      onClick={() => handleSendReminder(t.description)}
                                      className="p-1.5 bg-amber-50 text-amber-600 hover:bg-amber-100 rounded-lg border border-amber-200 transition-all animate-pulse"
                                      title="Enviar Recordatorio de Pago"
                                    >
                                      <span className="material-symbols-outlined text-base">notifications</span>
                                    </button>
                                  </>
                                )}
                                {t.status === "processed" && (
                                  <span className="text-[10px] font-bold text-teal-600 flex items-center gap-0.5">
                                    <span className="material-symbols-outlined text-xs font-bold">done_all</span>
                                    Completado
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Consola de Automatizaciones Stripe & SPEI */}
              <div className="bg-white border border-slate-200/60 rounded-3xl p-6 card-shadow space-y-6 mt-8 relative overflow-hidden">
                <div className="absolute right-0 top-0 w-24 h-24 bg-ttp-primary/5 rounded-full -mr-8 -mt-8 pointer-events-none"></div>
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-2xl text-ttp-primary font-bold">bolt</span>
                  <div>
                    <h3 className="font-montserrat text-base font-bold text-slate-800">Consola de Automatizaciones Stripe & SPEI</h3>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">Prueba y audita los flujos de cobros automáticos, alertas de pagos fallidos y barrido de morosidad escolar.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2 border-t border-slate-100">
                  {/* Columna Izquierda - Webhook Simulator */}
                  <div className="space-y-4 bg-slate-50/50 p-5 rounded-2xl border border-slate-200/40">
                    <h4 className="font-montserrat text-xs font-bold text-slate-700 flex items-center gap-1.5 uppercase tracking-wider">
                      <span className="material-symbols-outlined text-sm font-bold text-[#ae1d5f]">webhook</span>
                      Simulador de Webhooks de Pasarela (Stripe API)
                    </h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Seleccionar Alumno */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Seleccionar Estudiante</label>
                        <select
                          value={selectedStudentForSim}
                          onChange={(e) => setSelectedStudentForSim(e.target.value)}
                          disabled={isStripeSimulating}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-ttp-primary/10 text-xs font-medium text-slate-700"
                        >
                          {studentsList.map(student => (
                            <option key={student.id} value={student.id}>
                              {student.name} ({student.status === "moroso" ? `Debe $${student.amount_due}` : "Al corriente"})
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Seleccionar Evento */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Evento Webhook de Stripe</label>
                        <select
                          value={webhookEventType}
                          onChange={(e) => setWebhookEventType(e.target.value)}
                          disabled={isStripeSimulating}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-ttp-primary/10 text-xs font-medium text-slate-700"
                        >
                          <option value="invoice.payment_succeeded">invoice.payment_succeeded (Pago Exitoso)</option>
                          <option value="invoice.payment_failed">invoice.payment_failed (Pago Fallido)</option>
                        </select>
                      </div>
                    </div>

                    <button
                      onClick={handleTriggerStripeWebhook}
                      disabled={isStripeSimulating}
                      className="w-full px-4 py-2.5 bg-ttp-primary hover:opacity-90 text-white rounded-xl text-xs font-bold shadow-md active:scale-95 transition-all flex items-center justify-center gap-1.5 disabled:opacity-70"
                    >
                      {isStripeSimulating ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          <span>Procesando Evento de Stripe...</span>
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-sm font-bold">bolt</span>
                          <span>Disparar Webhook Stripe</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Columna Derecha - Estatus y Auditoría */}
                  <div className="space-y-4 bg-slate-50/50 p-5 rounded-2xl border border-slate-200/40 flex flex-col justify-between">
                    <div>
                      <h4 className="font-montserrat text-xs font-bold text-slate-700 flex items-center gap-1.5 uppercase tracking-wider mb-3">
                        <span className="material-symbols-outlined text-sm font-bold text-teal-600">dns</span>
                        Servicios y Auditorías en Segundo Plano
                      </h4>
                      
                      <div className="grid grid-cols-2 gap-2 text-xs font-semibold text-slate-600 mb-4">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 bg-teal-500 rounded-full animate-pulse"></span>
                          <span>Stripe Gateway: <strong className="text-teal-600">Sandbox</strong></span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 bg-teal-500 rounded-full animate-pulse"></span>
                          <span>Webhook API: <strong className="text-teal-600">Activo</strong></span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 bg-teal-500 rounded-full animate-pulse"></span>
                          <span>Alertas WhatsApp: <strong className="text-teal-600">Online</strong></span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 bg-teal-500 rounded-full animate-pulse"></span>
                          <span>Cron Daemon: <strong className="text-teal-600">Escuchando</strong></span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <button
                        onClick={handleAuditOverdueStudents}
                        disabled={isStripeSimulating}
                        className="w-full px-4 py-2.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-bold shadow-sm active:scale-95 transition-all flex items-center justify-center gap-1.5 disabled:opacity-75"
                      >
                        <span className="material-symbols-outlined text-sm">troubleshoot</span>
                        <span>Auditar Cuentas y Vencimientos (Cron)</span>
                      </button>
                      <p className="text-[10px] text-slate-400 text-center font-medium mt-2">
                        Analiza fechas de cobro pendientes, marca alumnos morosos y dispara recordatorios preventivos de WhatsApp.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : currentTab === "nomina" ? (
            <>
              {/* KPIs de Nómina */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Total Devengado */}
                <div className="bg-white border border-slate-200/60 p-6 rounded-2xl card-shadow relative overflow-hidden group">
                  <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-ttp-primary"></div>
                  <p className="text-xs font-bold tracking-wider text-slate-400 uppercase mb-2">Nómina Devengada (Ciclo)</p>
                  <h3 className="font-montserrat text-3xl font-extrabold text-slate-800">
                    ${teachersPayroll.reduce((acc, t) => acc + (t.hours * t.rate), 0).toLocaleString()} MXN
                  </h3>
                  <p className="text-xs text-slate-500 font-semibold mt-3">
                    Total acumulado por horas trabajadas
                  </p>
                </div>
                
                {/* Pendiente de Pago */}
                <div className="bg-white border border-slate-200/60 p-6 rounded-2xl card-shadow relative overflow-hidden group">
                  <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-rose-500"></div>
                  <p className="text-xs font-bold tracking-wider text-slate-400 uppercase mb-2">Sueldo Pendiente (Por Pagar)</p>
                  <h3 className="font-montserrat text-3xl font-extrabold text-rose-600">
                    ${teachersPayroll.reduce((acc, t) => acc + ((t.hours * t.rate) - t.amountPaid), 0).toLocaleString()} MXN
                  </h3>
                  <p className={`text-xs font-bold flex items-center gap-1 mt-3 ${teachersPayroll.some(t => ((t.hours * t.rate) - t.amountPaid) > 0) ? "text-amber-600 animate-pulse" : "text-teal-600"}`}>
                    <span className="material-symbols-outlined text-sm">
                      {teachersPayroll.some(t => ((t.hours * t.rate) - t.amountPaid) > 0) ? "warning" : "check_circle"}
                    </span>
                    {teachersPayroll.some(t => ((t.hours * t.rate) - t.amountPaid) > 0) ? "Requiere dispersión de fondos" : "Nómina totalmente liquidada"}
                  </p>
                </div>

                {/* Ratio de Dispersión / Profesores Liquidados */}
                <div className="bg-white border border-slate-200/60 p-6 rounded-2xl card-shadow relative overflow-hidden flex items-center justify-between group">
                  <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-teal-500"></div>
                  <div>
                    <p className="text-xs font-bold tracking-wider text-slate-400 uppercase mb-2">Ratio de Dispersión</p>
                    <h3 className="font-montserrat text-3xl font-extrabold text-teal-600">
                      {teachersPayroll.filter(t => t.hours > 0).length > 0 ? Math.round((teachersPayroll.filter(t => t.status === "paid").length / teachersPayroll.filter(t => t.hours > 0).length) * 100) : 0}%
                    </h3>
                    <p className="text-xs text-slate-500 font-semibold mt-3">
                      {teachersPayroll.filter(t => t.status === "paid").length} de {teachersPayroll.filter(t => t.hours > 0).length} liquidados
                    </p>
                  </div>
                  <div className="relative h-16 w-16 flex-shrink-0">
                    <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
                      <path className="stroke-slate-100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" strokeWidth="4"></path>
                      <path className="stroke-teal-500" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" strokeDasharray={`${teachersPayroll.filter(t => t.hours > 0).length > 0 ? Math.round((teachersPayroll.filter(t => t.status === "paid").length / teachersPayroll.filter(t => t.hours > 0).length) * 100) : 0}, 100`} strokeLinecap="round" strokeWidth="4"></path>
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-[10px] font-extrabold text-teal-600">
                        {teachersPayroll.filter(t => t.status === "paid").length}/{teachersPayroll.filter(t => t.hours > 0).length}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Filtros de Profesores */}
              <div className="bg-white border border-slate-200/60 rounded-2xl p-5 card-shadow">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Buscador */}
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
                    <input 
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-ttp-primary/10 focus:border-ttp-primary transition-all text-sm font-medium" 
                      placeholder="Buscar profesor por nombre o especialidad..." 
                      type="text"
                    />
                  </div>
                  
                  {/* Info Box */}
                  <div className="flex items-center gap-2 text-xs text-slate-500 font-semibold px-4 py-2 bg-slate-50 rounded-xl border border-slate-200/50">
                    <span className="material-symbols-outlined text-amber-500 text-sm">info</span>
                    <span>Puedes simular transferencias interbancarias SPEI con liquidación inmediata hacia las cuentas enmascaradas de los docentes.</span>
                  </div>
                </div>
              </div>

              {/* Ledger de Profesores */}
              <div className="bg-white border border-slate-200/60 rounded-3xl card-shadow overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                  <h3 className="font-montserrat text-sm font-bold text-slate-700">Estado de Nómina Activa</h3>
                  <span className="text-xs font-bold text-ttp-primary px-3 py-1 bg-ttp-primary/10 rounded-full">
                    Ciclo Quincenal Vigente
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/50 text-slate-400 text-xs font-bold uppercase tracking-wider">
                        <th className="px-6 py-4">Profesor</th>
                        <th className="px-6 py-4">Horas Laboradas</th>
                        <th className="px-6 py-4">Tarifa / Hr</th>
                        <th className="px-6 py-4">Total Devengado</th>
                        <th className="px-6 py-4">Monto Pagado</th>
                        <th className="px-6 py-4">Pendiente</th>
                        <th className="px-6 py-4">Estado</th>
                        <th className="px-6 py-4 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm font-medium">
                      {teachersPayroll.filter(t => 
                        !search.trim() || 
                        t.name.toLowerCase().includes(search.toLowerCase()) || 
                        t.specialty.toLowerCase().includes(search.toLowerCase())
                      ).length === 0 ? (
                        <tr>
                          <td colSpan="8" className="px-6 py-12 text-center text-slate-400">
                            No se encontraron profesores que coincidan con la búsqueda.
                          </td>
                        </tr>
                      ) : (
                        teachersPayroll.filter(t => 
                          !search.trim() || 
                          t.name.toLowerCase().includes(search.toLowerCase()) || 
                          t.specialty.toLowerCase().includes(search.toLowerCase())
                        ).map((t) => {
                          const pendingVal = (t.hours * t.rate) - t.amountPaid;
                          return (
                            <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-9 h-9 rounded-full bg-ttp-primary/10 text-ttp-primary flex items-center justify-center font-bold text-xs">
                                    {t.name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase()}
                                  </div>
                                  <div>
                                    <p className="font-bold text-slate-800">{t.name}</p>
                                    <p className="text-[10px] text-slate-400 font-semibold">{t.specialty}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 font-bold text-slate-700">{t.hours} hrs</td>
                              <td className="px-6 py-4 font-semibold text-slate-500">${t.rate} MXN</td>
                              <td className="px-6 py-4 font-extrabold text-slate-800">${(t.hours * t.rate).toLocaleString()} MXN</td>
                              <td className="px-6 py-4 font-bold text-teal-600">${t.amountPaid.toLocaleString()} MXN</td>
                              <td className="px-6 py-4 font-bold text-rose-500">${pendingVal.toLocaleString()} MXN</td>
                              <td className="px-6 py-4">
                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap ${
                                  t.status === "paid"
                                    ? "bg-teal-50 border-teal-200 text-teal-600"
                                    : t.status === "partial"
                                    ? "bg-amber-50 border-amber-200 text-amber-600"
                                    : "bg-rose-50 border-rose-200 text-rose-600 animate-pulse"
                                }`}>
                                  {t.status === "paid" ? "Liquidado" : t.status === "partial" ? "Pago Parcial" : "Pendiente"}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-right">
                                <div className="flex gap-2 justify-end items-center">
                                  {t.hours === 0 ? (
                                    <span className="text-[10px] font-bold text-slate-400 flex items-center gap-0.5 py-1 px-3">
                                      <span className="material-symbols-outlined text-xs font-bold">schedule</span>
                                      Sin horas
                                    </span>
                                  ) : t.status === "paid" ? (
                                    <span className="text-[10px] font-bold text-teal-600 flex items-center gap-0.5 py-1 px-3">
                                      <span className="material-symbols-outlined text-xs font-bold">check_circle</span>
                                      Liquidado
                                    </span>
                                  ) : (
                                    <button
                                      onClick={() => handleOpenPayModal(t)}
                                      className="px-3 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 rounded-lg text-xs font-bold flex items-center gap-1 transition-all active:scale-95 shadow-sm"
                                      title="Pagar Nómina por SPEI"
                                    >
                                      <span className="material-symbols-outlined text-sm font-bold">payments</span>
                                      Pagar SPEI
                                    </button>
                                  )}
                                  
                                  <button
                                    onClick={() => handleOpenEditModal(t)}
                                    className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-slate-200 rounded-lg transition-all"
                                    title="Ajustar Horas/Tarifa"
                                  >
                                    <span className="material-symbols-outlined text-sm font-bold">edit</span>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Historial de Pagos de Profesores */}
              <div className="bg-white border border-slate-200/60 rounded-3xl card-shadow overflow-hidden space-y-4 p-6">
                <div>
                  <h3 className="font-montserrat text-base font-bold text-slate-800">Historial de Dispersión de Nómina</h3>
                  <p className="text-xs text-slate-500 font-medium mt-1">
                    Auditoría de transferencias electrónicas de fondos bancarios procesadas para el personal académico.
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="border-b border-slate-100 bg-slate-50 text-slate-400 text-xs font-bold uppercase tracking-wider">
                      <tr>
                        <th className="px-6 py-4">Clave SPEI</th>
                        <th className="px-6 py-4">Fecha y Hora</th>
                        <th className="px-6 py-4">Profesor</th>
                        <th className="px-6 py-4">Concepto</th>
                        <th className="px-6 py-4">Banco de Destino</th>
                        <th className="px-6 py-4">Monto Dispersado</th>
                        <th className="px-6 py-4">Estatus</th>
                        <th className="px-6 py-4 text-right">Comprobante</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm font-medium">
                      {payrollHistory.length === 0 ? (
                        <tr>
                          <td colSpan="8" className="px-6 py-8 text-center text-slate-400">
                            Aún no se registran dispersiones en este periodo.
                          </td>
                        </tr>
                      ) : (
                        payrollHistory.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-6 py-4 text-xs font-mono font-bold text-[#ae1d5f]">
                              {item.speiId}
                            </td>
                            <td className="px-6 py-4">
                              <p className="text-xs font-bold text-slate-700">{item.date}</p>
                              <p className="text-[10px] text-slate-400 font-semibold">{item.time} hrs</p>
                            </td>
                            <td className="px-6 py-4 font-bold text-slate-800">{item.teacherName}</td>
                            <td className="px-6 py-4 text-xs font-semibold text-slate-500">{item.concept}</td>
                            <td className="px-6 py-4">
                              <p className="text-xs font-bold text-slate-700">{item.bank}</p>
                              <p className="text-[10px] font-mono text-slate-400 font-semibold">{item.clabe}</p>
                            </td>
                            <td className="px-6 py-4 font-extrabold text-slate-800">${item.amount.toLocaleString()} MXN</td>
                            <td className="px-6 py-4">
                              <span className="px-2 py-0.5 bg-teal-50 border border-teal-200 text-teal-600 rounded-full text-[9px] font-bold">
                                {item.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <button
                                onClick={() => handleDownloadVoucher(item)}
                                className="px-2.5 py-1.5 text-ttp-primary bg-ttp-primary/10 hover:bg-ttp-primary/20 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-all active:scale-95 shadow-sm inline-flex ml-auto"
                                title="Descargar Comprobante Bancario"
                              >
                                <span className="material-symbols-outlined text-xs">download</span>
                                SPEI Comprobante
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            /* Burlington Tab View */
            <div className="bg-white border border-slate-200/60 rounded-3xl p-6 card-shadow space-y-6">
              <div>
                <h3 className="font-montserrat text-lg font-bold text-slate-800">Licencias de Burlington English</h3>
                <p className="text-xs text-slate-500 font-medium mt-1">Monitorea las claves de acceso de listening y reading asignadas al portal.</p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="border-b border-slate-100 bg-slate-50 text-slate-400 text-xs font-bold uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-4">Alumno</th>
                      <th className="px-6 py-4">Licencia de Acceso</th>
                      <th className="px-6 py-4">Activo Desde</th>
                      <th className="px-6 py-4">Costo Licencia</th>
                      <th className="px-6 py-4">Estatus</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm font-medium">
                    {burlingtonLicenses.map((lic) => (
                      <tr key={lic.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 font-bold text-slate-800">{lic.student}</td>
                        <td className="px-6 py-4 text-xs font-mono font-bold text-[#ae1d5f]">{lic.licenseKey}</td>
                        <td className="px-6 py-4 text-xs text-slate-400 font-medium">{lic.activeFrom}</td>
                        <td className="px-6 py-4 font-extrabold text-slate-700">${lic.cost} MXN</td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            lic.status === "activo"
                              ? "bg-teal-50 text-teal-600 border border-teal-100"
                              : "bg-slate-50 text-slate-500 border border-slate-100"
                          }`}>
                            {lic.status === "activo" ? "Activo" : "Suspendido"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Add Invoice Modal */}
      {isAddInvoiceOpen && (
        <div className="modal-backdrop fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden border border-slate-100 modal-card">
            <div className="p-6 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-montserrat text-lg font-bold text-slate-800 flex items-center gap-2">
                <span className="material-symbols-outlined text-ttp-primary">receipt</span>
                Emitir Nueva Factura / Cargo
              </h3>
              <button 
                onClick={() => setIsAddInvoiceOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-200/50 rounded-full transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <form onSubmit={handleAddInvoiceSubmit} className="p-6 space-y-4">
              {/* Concepto */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Concepto / Descripción</label>
                <input 
                  required
                  type="text" 
                  value={newInvoice.description}
                  onChange={(e) => setNewInvoice({...newInvoice, description: e.target.value})}
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-ttp-primary/10 focus:border-ttp-primary text-sm font-medium"
                  placeholder="Ej. Colegiatura - Elena Rodríguez"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Monto */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Monto ($ MXN)</label>
                  <input 
                    required
                    type="number" 
                    value={newInvoice.amount}
                    onChange={(e) => setNewInvoice({...newInvoice, amount: e.target.value})}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-ttp-primary/10 focus:border-ttp-primary text-sm font-medium"
                    placeholder="2450"
                  />
                </div>

                {/* Estado */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Estado Inicial</label>
                  <select 
                    value={newInvoice.status}
                    onChange={(e) => setNewInvoice({...newInvoice, status: e.target.value})}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-ttp-primary/10 focus:border-ttp-primary text-sm font-medium text-slate-700 bg-white"
                  >
                    <option value="pending">Pendiente</option>
                    <option value="processed">Cobrado / Procesado</option>
                    <option value="overdue">Vencido</option>
                  </select>
                </div>
              </div>

              {/* Categoría */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Categoría Financiera</label>
                <select 
                  value={newInvoice.category}
                  onChange={(e) => setNewInvoice({...newInvoice, category: e.target.value})}
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-ttp-primary/10 focus:border-ttp-primary text-sm font-medium text-slate-700 bg-white"
                >
                  {categoriesList.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* Acciones */}
              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                <button 
                  type="button"
                  onClick={() => setIsAddInvoiceOpen(false)}
                  className="px-5 py-2 rounded-xl text-slate-500 hover:bg-slate-50 font-semibold text-sm active:scale-95 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-ttp-primary hover:opacity-90 text-white font-semibold text-sm shadow-md active:scale-95 transition-all"
                >
                  Emitir Factura
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* MODALES DE NÓMINA DE PROFESORES */}
      {/* ========================================== */}

      {/* 1. Modal de Pago SPEI */}
      {isPayModalOpen && selectedTeacherForPay && (
        <div className="modal-backdrop fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden border border-slate-100 modal-card">
            <div className="p-6 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-montserrat text-lg font-bold text-slate-800 flex items-center gap-2">
                <span className="material-symbols-outlined text-teal-600 font-bold">payments</span>
                Transferencia SPEI
              </h3>
              <button 
                onClick={() => !payProcessing && setIsPayModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-200/50 rounded-full transition-colors"
                disabled={payProcessing}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              {/* Resumen del Destinatario */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/50 space-y-2">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Beneficiario</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-ttp-primary/10 text-ttp-primary flex items-center justify-center font-bold text-sm">
                    {selectedTeacherForPay.name.split(" ").map(n => n[0]).join("").toUpperCase()}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm">{selectedTeacherForPay.name}</h4>
                    <p className="text-[10px] text-slate-400 font-semibold">{selectedTeacherForPay.specialty}</p>
                  </div>
                </div>
              </div>

              {/* Detalle de Fondos */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Banco Destino</p>
                  <p className="text-xs font-extrabold text-slate-700 mt-1">{selectedTeacherForPay.bank}</p>
                </div>
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">CLABE Destinatario</p>
                  <p className="text-xs font-mono font-bold text-[#ae1d5f] mt-1">{selectedTeacherForPay.clabe}</p>
                </div>
              </div>

              <div className="bg-teal-50 border border-teal-100 p-4 rounded-2xl flex justify-between items-center">
                <div>
                  <p className="text-xs font-bold text-teal-600">Saldo Quincenal Pendiente</p>
                  <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                    {selectedTeacherForPay.hours} hrs × ${selectedTeacherForPay.rate}/hr
                  </p>
                </div>
                <div className="text-right">
                  <span className="font-montserrat text-xl font-black text-teal-700">
                    ${((selectedTeacherForPay.hours * selectedTeacherForPay.rate) - selectedTeacherForPay.amountPaid).toLocaleString()} MXN
                  </span>
                </div>
              </div>

              {/* Concepto de Pago */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Concepto de Transferencia (SPEI)</label>
                <input 
                  required
                  type="text" 
                  value={payConcept}
                  onChange={(e) => setPayConcept(e.target.value)}
                  disabled={payProcessing}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-ttp-primary/10 focus:border-ttp-primary text-sm font-medium"
                  placeholder="Ej. Pago Quincenal"
                />
              </div>

              {/* Advertencia Bancaria */}
              <div className="flex gap-2 text-[10px] text-slate-500 font-medium">
                <span className="material-symbols-outlined text-teal-600 text-sm">lock</span>
                <span>Dispersión segura operada por el Sistema de Pagos Electrónicos Interbancarios (SPEI).</span>
              </div>

              {/* Botones de Acción */}
              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                <button 
                  type="button"
                  onClick={() => setIsPayModalOpen(false)}
                  disabled={payProcessing}
                  className="px-5 py-2 rounded-xl text-slate-500 hover:bg-slate-50 font-semibold text-sm active:scale-95 transition-all disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleConfirmSpeiPayment}
                  disabled={payProcessing}
                  className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm shadow-md active:scale-95 transition-all flex items-center gap-1.5 disabled:opacity-75"
                >
                  {payProcessing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Procesando SPEI...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-sm font-bold">check_circle</span>
                      <span>Autorizar Transferencia</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Modal de Ajustar Horas/Tarifa */}
      {isEditTeacherModalOpen && selectedTeacherForEdit && (
        <div className="modal-backdrop fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden border border-slate-100 modal-card">
            <div className="p-6 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-montserrat text-lg font-bold text-slate-800 flex items-center gap-2">
                <span className="material-symbols-outlined text-ttp-primary">edit</span>
                Ajustar Parámetros de Nómina
              </h3>
              <button 
                onClick={() => setIsEditTeacherModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-200/50 rounded-full transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <form onSubmit={handleSaveTeacherEdit} className="p-6 space-y-4">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase mb-1">Docente</p>
                <p className="text-sm font-extrabold text-slate-800">{selectedTeacherForEdit.name}</p>
                <p className="text-[10px] text-slate-400 font-semibold">{selectedTeacherForEdit.specialty}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Horas */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Horas Acumuladas</label>
                  <input 
                    required
                    type="number" 
                    value={selectedTeacherForEdit.hours}
                    onChange={(e) => setSelectedTeacherForEdit({...selectedTeacherForEdit, hours: e.target.value})}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-ttp-primary/10 focus:border-ttp-primary text-sm font-medium"
                    placeholder="35"
                  />
                </div>

                {/* Tarifa */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Tarifa por Hora ($)</label>
                  <input 
                    required
                    type="number" 
                    value={selectedTeacherForEdit.rate}
                    onChange={(e) => setSelectedTeacherForEdit({...selectedTeacherForEdit, rate: e.target.value})}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-ttp-primary/10 focus:border-ttp-primary text-sm font-medium"
                    placeholder="280"
                  />
                </div>
              </div>

              {/* Monto Pagado */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Monto Pagado en el Periodo ($ MXN)</label>
                <input 
                  required
                  type="number" 
                  value={selectedTeacherForEdit.amountPaid}
                  onChange={(e) => setSelectedTeacherForEdit({...selectedTeacherForEdit, amountPaid: e.target.value})}
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-ttp-primary/10 focus:border-ttp-primary text-sm font-medium"
                  placeholder="0"
                />
              </div>

              {/* Banco & CLABE */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Banco</label>
                  <input 
                    required
                    type="text" 
                    value={selectedTeacherForEdit.bank}
                    onChange={(e) => setSelectedTeacherForEdit({...selectedTeacherForEdit, bank: e.target.value})}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-ttp-primary/10 focus:border-ttp-primary text-sm font-medium"
                    placeholder="BBVA"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Cuenta CLABE</label>
                  <input 
                    required
                    type="text" 
                    value={selectedTeacherForEdit.clabe}
                    onChange={(e) => setSelectedTeacherForEdit({...selectedTeacherForEdit, clabe: e.target.value})}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-ttp-primary/10 focus:border-ttp-primary text-sm font-medium font-mono"
                    placeholder="18 dígitos"
                  />
                </div>
              </div>

              {/* Resumen de Ajustes */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/50 flex justify-between items-center text-xs">
                <span className="font-bold text-slate-500">Nuevo Sueldo Total:</span>
                <span className="font-extrabold text-slate-800 text-sm">
                  ${(Number(selectedTeacherForEdit.hours || 0) * Number(selectedTeacherForEdit.rate || 0)).toLocaleString()} MXN
                </span>
              </div>

              {/* Acciones */}
              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                <button 
                  type="button"
                  onClick={() => setIsEditTeacherModalOpen(false)}
                  className="px-5 py-2 rounded-xl text-slate-500 hover:bg-slate-50 font-semibold text-sm active:scale-95 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-ttp-primary hover:opacity-90 text-white font-semibold text-sm shadow-md active:scale-95 transition-all"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Modal de Registrar Profesor en Nómina */}
      {isAddTeacherModalOpen && (
        <div className="modal-backdrop fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden border border-slate-100 modal-card">
            <div className="p-6 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-montserrat text-lg font-bold text-slate-800 flex items-center gap-2">
                <span className="material-symbols-outlined text-ttp-primary">person_add</span>
                Registrar Docente en Nómina
              </h3>
              <button 
                onClick={() => setIsAddTeacherModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-200/50 rounded-full transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <form onSubmit={handleAddTeacherSubmit} className="p-6 space-y-4">
              {/* Nombre */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Nombre Completo del Profesor</label>
                <input 
                  required
                  type="text" 
                  value={newTeacherForm.name}
                  onChange={(e) => setNewTeacherForm({...newTeacherForm, name: e.target.value})}
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-ttp-primary/10 focus:border-ttp-primary text-sm font-medium"
                  placeholder="Ej. Prof. Robert Brown"
                />
              </div>

              {/* Especialidad */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Especialidad / Asignatura</label>
                <input 
                  required
                  type="text" 
                  value={newTeacherForm.specialty}
                  onChange={(e) => setNewTeacherForm({...newTeacherForm, specialty: e.target.value})}
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-ttp-primary/10 focus:border-ttp-primary text-sm font-medium"
                  placeholder="Ej. TOEFL Preparation"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Horas */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Horas Iniciales</label>
                  <input 
                    required
                    type="number" 
                    value={newTeacherForm.hours}
                    onChange={(e) => setNewTeacherForm({...newTeacherForm, hours: e.target.value})}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-ttp-primary/10 focus:border-ttp-primary text-sm font-medium"
                    placeholder="25"
                  />
                </div>

                {/* Tarifa */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Tarifa por Hora ($)</label>
                  <input 
                    required
                    type="number" 
                    value={newTeacherForm.rate}
                    onChange={(e) => setNewTeacherForm({...newTeacherForm, rate: e.target.value})}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-ttp-primary/10 focus:border-ttp-primary text-sm font-medium"
                    placeholder="250"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Banco */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Banco</label>
                  <select 
                    value={newTeacherForm.bank}
                    onChange={(e) => setNewTeacherForm({...newTeacherForm, bank: e.target.value})}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-ttp-primary/10 focus:border-ttp-primary text-sm font-medium text-slate-700 bg-white"
                  >
                    <option value="BBVA Bancomer">BBVA Bancomer</option>
                    <option value="Santander">Santander</option>
                    <option value="Citibanamex">Citibanamex</option>
                    <option value="Banorte">Banorte</option>
                    <option value="HSBC">HSBC</option>
                  </select>
                </div>

                {/* CLABE */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">CLABE de Destino</label>
                  <input 
                    type="text" 
                    value={newTeacherForm.clabe}
                    onChange={(e) => setNewTeacherForm({...newTeacherForm, clabe: e.target.value})}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-ttp-primary/10 focus:border-ttp-primary text-sm font-medium font-mono"
                    placeholder="Opcional (18 dígitos)"
                  />
                </div>
              </div>

              {/* Acciones */}
              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                <button 
                  type="button"
                  onClick={() => setIsAddTeacherModalOpen(false)}
                  className="px-5 py-2 rounded-xl text-slate-500 hover:bg-slate-50 font-semibold text-sm active:scale-95 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-ttp-primary hover:opacity-90 text-white font-semibold text-sm shadow-md active:scale-95 transition-all"
                >
                  Registrar Docente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
