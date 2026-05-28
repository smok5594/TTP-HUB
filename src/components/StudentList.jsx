"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import { supabase } from "@/utils/supabaseClient";
import AcademicManagement from "@/components/AcademicManagement";
import ConfirmDialog from "@/components/ConfirmDialog";
import { toast } from "sonner";

export default function StudentList() {
  // Estados para búsqueda y filtrado
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [courseFilter, setCourseFilter] = useState("");
  const [teacherFilter, setTeacherFilter] = useState("");
  const [startDateFilter, setStartDateFilter] = useState("");
  const [paymentDateFilter, setPaymentDateFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // Estados de carga e interactividad
  const [isLoading, setIsLoading] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  
  // Estado para pop-up de confirmación de eliminación
  const [deleteConfirmModal, setDeleteConfirmModal] = useState(null); // { name: '', onConfirm: fn }

  // Lista de alumnos de la base de datos
  const [students, setStudents] = useState([]);
  
  // Estados de conteo y KPI
  const [kpi, setKpi] = useState({
    totalStudents: 0,
    attendance: "94.2%",
    pendingPayments: 0
  });


  // Datos para el formulario de Nuevo Alumno
  const [newStudent, setNewStudent] = useState({
    name: "",
    last_name: "",
    email: "",
    phone: "",
    status: "active",
    payment_status: "pendiente",
    current_course: "",
    current_group: "",
    class_type: "grupal",
    schedule: "",
    teacher: "",
    teacher_id: null,
    group_id: null,
    course_id: null,
    next_payment: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    enrolled_date: new Date().toISOString().split("T")[0],
    burlington_user: "",
    admin_notes: "",
    academic_notes: "",
    amount_due: "2450",
  });

  const [formGroups,   setFormGroups]   = useState([]);
  const [formTeachers, setFormTeachers] = useState([]);

  useEffect(() => {
    const loadFormData = async () => {
      const [{ data: tData }, { data: gData }] = await Promise.all([
        supabase.from("teachers").select("id, name, specialty, status"),
        supabase.from("groups").select("id, code, course, schedule, capacity, status, teacher_id")
      ]);
      if (tData) setFormTeachers(tData.map(t => ({ ...t, status: t.status === "active" ? "activo" : "suspendido" })));
      if (gData) setFormGroups(gData.map(g => ({ ...g, title: g.code })));
    };
    loadFormData();
  }, []);

  const handleTeacherSelect = (teacherName) => {
    const t = formTeachers.find(x => x.name === teacherName);
    setNewStudent(p => ({ 
      ...p, 
      teacher: teacherName, 
      teacher_id: t ? t.id : null,
      current_group: "", 
      current_course: "", 
      group_id: null,
      course_id: null,
      schedule: "", 
      class_type: "grupal" 
    }));
  };

  const handleGroupSelect = async (groupTitle) => {
    const g = formGroups.find(gr => gr.title === groupTitle);
    if (!g) return;

    let resolvedCourseId = null;
    if (g.course) {
      const { data: cData } = await supabase.from("courses").select("id").ilike("name", g.course).limit(1);
      if (cData && cData.length > 0) {
        resolvedCourseId = cData[0].id;
      }
    }

    let resolvedTeacherId = g.teacher_id || null;
    let resolvedTeacherName = "";
    if (resolvedTeacherId) {
      const t = formTeachers.find(x => x.id === resolvedTeacherId);
      resolvedTeacherName = t ? t.name : "";
    }

    setNewStudent(p => ({ 
      ...p, 
      current_group: g.title, 
      current_course: g.course || g.title, 
      group_id: g.id || null,
      course_id: resolvedCourseId,
      teacher_id: resolvedTeacherId || p.teacher_id,
      teacher: resolvedTeacherName || p.teacher,
      schedule: g.schedule, 
      class_type: g.class_type || "grupal" 
    }));
  };

  const CT_LABEL_FORM = { grupal: "Grupal", privada: "Privada", conversation_club: "Conversation Club" };

  // Control de vistas (Alumnos vs Gestión Académica)
  const [currentView, setCurrentView] = useState("students");
  const [studentSubTab, setStudentSubTab] = useState("active_list");

  // Mostrar notificaciones via Sonner
  const showToast = (msg) => {
    if (msg.startsWith("✅") || msg === "Estudiante eliminado." || msg.includes("guardado") || msg.includes("actualizado")) toast.success(msg.replace("✅ ", ""));
    else if (msg.includes("eliminado") || msg.includes("Eliminado")) toast.error(msg);
    else toast(msg);
  };


  const fetchStudents = async () => {
    setIsLoading(true);
    try {
      let query = supabase.from("students").select("*").order("created_at", { ascending: false });
      if (search.trim()) query = query.or(`name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`);
      if (statusFilter) query = query.eq("status", statusFilter);
      if (courseFilter) query = query.ilike("current_course", `%${courseFilter}%`);
      if (teacherFilter) query = query.ilike("teacher", `%${teacherFilter}%`);
      if (startDateFilter) query = query.ilike("enrolled_date", `%${startDateFilter}%`);
      if (paymentDateFilter) query = query.ilike("next_payment", `%${paymentDateFilter}%`);

      const { data, error } = await query;
      if (error) throw error;

      const all = data || [];
      let filtered = [...all];
      if (studentSubTab === "active_list") {
        filtered = filtered.filter(s => s.status !== "graduated" && s.status !== "inactive");
      } else {
        filtered = filtered.filter(s => s.status === "graduated" || s.status === "inactive");
      }

      setStudents(filtered);
      setKpi({
        totalStudents: all.length,
        attendance: all.length > 0 ? "94.2%" : "0%",
        pendingPayments: all.filter(s => s.status === "moroso").length,
      });
    } catch (err) {
      console.error("Error cargando estudiantes:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, [search, statusFilter, courseFilter, teacherFilter, startDateFilter, paymentDateFilter, currentView, studentSubTab]);

  const handleAddStudent = async (e) => {
    e.preventDefault();
    try {
      const { data, error } = await supabase.from("students").insert([{
        name: newStudent.name, last_name: newStudent.last_name, email: newStudent.email,
        phone: newStudent.phone, status: newStudent.status, payment_status: newStudent.payment_status,
        current_course: newStudent.current_course, current_group: newStudent.current_group,
        class_type: newStudent.class_type, schedule: newStudent.schedule, teacher: newStudent.teacher,
        teacher_id: newStudent.teacher_id || null,
        group_id: newStudent.group_id || null,
        course_id: newStudent.course_id || null,
        next_payment: newStudent.next_payment, burlington_user: newStudent.burlington_user,
        admin_notes: newStudent.admin_notes, academic_notes: newStudent.academic_notes,
        enrolled_date: newStudent.enrolled_date || new Date().toISOString().split("T")[0],
        amount_due: parseFloat(newStudent.amount_due) || 0,
        course_history: [], certificates_issued: 0,
      }]).select();
      if (error) throw error;
      setStudents(prev => [data[0], ...prev]);
      setKpi(prev => ({
        totalStudents: prev.totalStudents + 1,
        attendance: "94.2%",
        pendingPayments: newStudent.status === "moroso" ? prev.pendingPayments + 1 : prev.pendingPayments,
      }));
      showToast(`✅ Estudiante ${newStudent.name} registrado exitosamente.`);
      setIsAddModalOpen(false);
      setNewStudent({
        name: "", last_name: "", email: "", phone: "", status: "active", payment_status: "pendiente",
        current_course: "", current_group: "", class_type: "grupal", schedule: "", teacher: "",
        teacher_id: null, group_id: null, course_id: null,
        next_payment: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        enrolled_date: new Date().toISOString().split("T")[0],
        burlington_user: "", admin_notes: "", academic_notes: "", amount_due: "2450",
      });
    } catch (err) {
      showToast(`Error: ${err.message}`);
    }
  };



  const handleDeleteStudent = (id, name) => {
    setDeleteConfirmModal({
      name,
      onConfirm: async () => {
        try {
          const { error } = await supabase.from("students").delete().eq("id", id);
          if (error) throw error;
          setStudents(prev => prev.filter(s => s.id !== id));
          setKpi(prev => ({ ...prev, totalStudents: Math.max(0, prev.totalStudents - 1) }));
          showToast("Estudiante eliminado.");
        } catch (err) {
          showToast(`Error al eliminar: ${err.message}`);
        }
      }
    });
  };

  return (
    <div className="flex min-h-screen bg-slate-50 font-inter relative">
      {/* SideNavBar */}
      <Sidebar activeName="Estudiantes" />

      {/* Main Content Area */}
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

        {/* Content Body */}
        <div className="p-6 md:p-10 max-w-7xl mx-auto w-full space-y-8">
          
          {/* Page Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-200/60 pb-5">
            <div>
              <h2 className="font-montserrat text-2xl font-bold text-slate-800 tracking-tight">
                {currentView === "students" ? "Alumnos" : "Gestión Académica"}
              </h2>
              <p className="text-slate-500 font-medium text-sm mt-1">
                {currentView === "students" 
                  ? "Gestiona la base de datos de estudiantes y su estado de pago." 
                  : "Supervisa los grupos de estudio, cupos asignados y docentes."}
              </p>
            </div>
            
            <div className="flex items-center gap-4">
              {/* View Selector Tabs */}
              <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200/50">
                <button
                  onClick={() => setCurrentView("students")}
                  className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 whitespace-nowrap ${
                    currentView === "students"
                      ? "bg-white text-ttp-primary shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <span className="material-symbols-outlined text-sm font-bold">group</span>
                  Lista de Alumnos
                </button>
                <button
                  onClick={() => setCurrentView("academic")}
                  className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 whitespace-nowrap ${
                    currentView === "academic"
                      ? "bg-white text-ttp-primary shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <span className="material-symbols-outlined text-sm font-bold">school</span>
                  Cursos y Grupos
                </button>
              </div>

              {currentView === "students" && (
                <button 
                  onClick={() => setIsAddModalOpen(true)}
                  className="bg-ttp-primary text-white px-6 py-2.5 rounded-xl font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-all active:scale-95 shadow-md shadow-ttp-primary/10 text-sm whitespace-nowrap"
                >
                  <span className="material-symbols-outlined text-lg font-bold" data-icon="add">add</span>
                  Nuevo Alumno
                </button>
              )}
            </div>
          </div>

          {currentView === "students" ? (
            <>

            {/* Sub-tabs for separating active vs graduated/withdrawn students */}
            <div className="flex border-b border-slate-200 gap-6 mb-5">
              <button
                onClick={() => setStudentSubTab("active_list")}
                className={`pb-3 text-xs font-bold transition-all relative whitespace-nowrap ${
                  studentSubTab === "active_list"
                    ? "text-ttp-primary font-extrabold"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Alumnos Activos y en Curso
                {studentSubTab === "active_list" && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-ttp-primary rounded-full"></div>
                )}
              </button>
              <button
                onClick={() => setStudentSubTab("inactive_list")}
                className={`pb-3 text-xs font-bold transition-all relative whitespace-nowrap ${
                  studentSubTab === "inactive_list"
                    ? "text-ttp-primary font-extrabold"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Historial / Egresados y Bajas
                {studentSubTab === "inactive_list" && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-ttp-primary rounded-full"></div>
                )}
              </button>
            </div>

          {/* Filters & Search */}
          <div className="bg-white border border-slate-200/60 rounded-2xl p-5 card-shadow space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Search Bar */}
              <div className="md:col-span-2 relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg" data-icon="search">search</span>
                <input 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-ttp-primary/10 focus:border-ttp-primary transition-all text-sm font-medium" 
                  placeholder="Buscar por nombre o email..." 
                  type="text"
                />
              </div>
              
              {/* Status Filter */}
              <div className="relative">
                <select 
                  value={statusFilter}
                  onChange={(e) => {
                    const val = e.target.value;
                    setStatusFilter(val);
                    if (val === "graduated" || val === "inactive") {
                      setStudentSubTab("inactive_list");
                    } else if (val === "active" || val === "suspended" || val === "moroso") {
                      setStudentSubTab("active_list");
                    }
                  }}
                  className="w-full pl-4 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-xl appearance-none focus:outline-none focus:ring-2 focus:ring-ttp-primary/10 focus:border-ttp-primary transition-all text-sm font-medium text-slate-700 cursor-pointer"
                >
                  <option value="">Todos los Estados</option>
                  <option value="active">Activo</option>
                  <option value="inactive">Dado de baja</option>
                  <option value="suspended">Suspendido</option>
                  <option value="graduated">Graduado</option>
                  <option value="moroso">Falta de pago</option>
                </select>
                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-lg" data-icon="expand_more">expand_more</span>
              </div>
              
              {/* Course Filter */}
              <div className="relative">
                <select 
                  value={courseFilter}
                  onChange={(e) => setCourseFilter(e.target.value)}
                  className="w-full pl-4 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-xl appearance-none focus:outline-none focus:ring-2 focus:ring-ttp-primary/10 focus:border-ttp-primary transition-all text-sm font-medium text-slate-700 cursor-pointer"
                >
                  <option value="">Todos los Cursos</option>
                  {[...new Set(formGroups.map(g => g.title).filter(Boolean))].map(course => (
                    <option key={course} value={course}>{course}</option>
                  ))}
                  {[...new Set(formGroups.map(g => g.title).filter(Boolean))].length === 0 && (
                    <>
                      <option value="English A1">English A1</option>
                      <option value="English B2">English B2</option>
                      <option value="Conversation">Conversation Club</option>
                      <option value="Business">Business English</option>
                    </>
                  )}
                </select>
                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-lg" data-icon="expand_more">expand_more</span>
              </div>
            </div>

            {/* Segunda fila de filtros avanzados */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 border-t border-slate-100 pt-4 items-end">
              {/* Teacher Filter */}
              <div className="relative">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Alumnos por Maestro</label>
                <div className="relative">
                  <select 
                    value={teacherFilter}
                    onChange={(e) => setTeacherFilter(e.target.value)}
                    className="w-full pl-4 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-xl appearance-none focus:outline-none focus:ring-2 focus:ring-ttp-primary/10 focus:border-ttp-primary transition-all text-sm font-medium text-slate-700 cursor-pointer"
                  >
                    <option value="">Todos los Maestros</option>
                    {[...new Set(formTeachers.map(t => t.name).filter(Boolean))].map(tName => (
                      <option key={tName} value={tName}>{tName}</option>
                    ))}
                    {[...new Set(formTeachers.map(t => t.name).filter(Boolean))].length === 0 && (
                      <>
                        <option value="Elena Valdéz">Lic. Elena Valdéz</option>
                        <option value="James Wilson">James Wilson</option>
                        <option value="Sarah Parker">Sarah Parker</option>
                        <option value="Robert Brown">Robert Brown</option>
                      </>
                    )}
                  </select>
                  <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-lg">expand_more</span>
                </div>
              </div>

              {/* Start Date Filter */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Fecha de Inicio (Registro)</label>
                <div className="relative flex items-center">
                  <input 
                    type="month"
                    value={startDateFilter}
                    onChange={(e) => setStartDateFilter(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-ttp-primary/10 focus:border-ttp-primary transition-all text-sm font-medium text-slate-700 cursor-pointer text-center"
                  />
                  {startDateFilter && (
                    <button 
                      onClick={() => setStartDateFilter("")}
                      className="absolute right-2 text-slate-400 hover:text-slate-650 p-0.5 rounded-full flex items-center justify-center bg-slate-100 hover:bg-slate-200"
                    >
                      <span className="material-symbols-outlined text-xs">close</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Next Payment Date Filter */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Fecha de Próximo Pago</label>
                <div className="relative flex items-center">
                  <input 
                    type="month"
                    value={paymentDateFilter}
                    onChange={(e) => setPaymentDateFilter(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-ttp-primary/10 focus:border-ttp-primary transition-all text-sm font-medium text-slate-700 cursor-pointer text-center"
                  />
                  {paymentDateFilter && (
                    <button 
                      onClick={() => setPaymentDateFilter("")}
                      className="absolute right-2 text-slate-400 hover:text-slate-650 p-0.5 rounded-full flex items-center justify-center bg-slate-100 hover:bg-slate-200"
                    >
                      <span className="material-symbols-outlined text-xs">close</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Reset Filters Button */}
              <div>
                {(search || statusFilter || courseFilter || teacherFilter || startDateFilter || paymentDateFilter) ? (
                  <button 
                    onClick={() => {
                      setSearch("");
                      setStatusFilter("");
                      setCourseFilter("");
                      setTeacherFilter("");
                      setStartDateFilter("");
                      setPaymentDateFilter("");
                    }}
                    className="w-full py-2 bg-ttp-primary/10 hover:bg-ttp-primary/15 text-ttp-primary font-bold rounded-xl text-xs active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer h-[38px] border border-ttp-primary/20"
                  >
                    <span className="material-symbols-outlined text-sm">filter_alt_off</span>
                    Limpiar Filtros
                  </button>
                ) : (
                  <div className="w-full bg-slate-50 border border-slate-100 text-slate-400 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 h-[38px] cursor-not-allowed select-none">
                    <span className="material-symbols-outlined text-sm">filter_alt</span>
                    Sin filtros activos
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Students Table Card */}
          <div className="bg-white border border-slate-200/60 rounded-2xl card-shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-slate-400 text-xs font-bold">
                    <th className="px-6 py-4 font-bold tracking-wider uppercase">Nombre</th>
                    <th className="px-6 py-4 font-bold tracking-wider uppercase">Email</th>
                    <th className="px-6 py-4 font-bold tracking-wider uppercase">Curso Actual</th>
                    <th className="px-6 py-4 font-bold tracking-wider uppercase">Profesor</th>
                    <th className="px-6 py-4 font-bold tracking-wider uppercase">Fecha de Inicio</th>
                    <th className="px-6 py-4 font-bold tracking-wider uppercase">Próximo Pago</th>
                    <th className="px-6 py-4 font-bold tracking-wider uppercase">Estado</th>
                    <th className="px-6 py-4 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {isLoading ? (
                    <tr>
                      <td colSpan="8" className="px-6 py-10 text-center text-slate-400 font-medium">
                        Cargando base de datos de estudiantes...
                      </td>
                    </tr>
                  ) : students.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="px-6 py-12 text-center text-slate-400 font-medium">
                        {search || statusFilter || courseFilter ? (
                          "No se encontraron alumnos con los filtros seleccionados"
                        ) : (
                          <div className="flex flex-col items-center justify-center gap-4 py-6">
                            <span className="material-symbols-outlined text-5xl text-slate-300">school</span>
                            <div className="space-y-1">
                              <p className="text-slate-700 font-bold text-base">Tu base de datos está vacía</p>
                              <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                                La base de datos de estudiantes se encuentra limpia. ¡Registra a tu primer alumno de forma manual para comenzar!
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-3 mt-2 justify-center">
                              <button
                                onClick={() => setIsAddModalOpen(true)}
                                className="bg-ttp-primary text-white px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 hover:opacity-90 active:scale-95 transition-all shadow-sm"
                              >
                                <span className="material-symbols-outlined text-sm font-bold">add</span>
                                Registrar Alumno Manualmente
                              </button>
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  ) : (
                    students.map((student) => {
                      // Formatear fecha próximo pago
                      let formattedDate = student.next_payment;
                      if (student.next_payment && !isNaN(Date.parse(student.next_payment))) {
                        formattedDate = new Date(student.next_payment).toLocaleDateString('es-ES', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        });
                      }

                      // Formatear fecha de inicio
                      let formattedEnrolledDate = student.enrolled_date || "—";
                      if (student.enrolled_date && !isNaN(Date.parse(student.enrolled_date))) {
                        formattedEnrolledDate = new Date(student.enrolled_date).toLocaleDateString('es-ES', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        });
                      }

                      return (
                        <tr 
                          key={student.id} 
                          className="hover:bg-slate-50/50 transition-all duration-150 group"
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-ttp-primary/10 text-ttp-primary font-bold flex items-center justify-center flex-shrink-0 text-sm">
                                {student.name.charAt(0)}
                              </div>
                              <Link 
                                href={`/students/${student.id}`} 
                                className="font-semibold text-slate-800 hover:text-ttp-primary hover:underline transition-colors"
                              >
                                {student.name}
                              </Link>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-slate-500 font-medium">{student.email}</td>
                          <td className="px-6 py-4 text-slate-700 font-semibold text-xs">{student.current_course}</td>
                          <td className="px-6 py-4 text-slate-500 font-medium">{student.teacher}</td>
                          <td className="px-6 py-4 text-slate-500 font-medium">{formattedEnrolledDate}</td>
                          <td className="px-6 py-4 text-slate-700 font-medium">{formattedDate}</td>
                           <td className="px-6 py-4">
                            <span className={`px-3 py-1 rounded-full text-[11px] font-bold border whitespace-nowrap ${
                              student.status === "active" 
                                ? "bg-teal-50 text-teal-600 border-teal-150" 
                                : student.status === "moroso"
                                ? "bg-amber-50 text-amber-600 border-amber-150"
                                : (student.status === "suspended" || student.status === "suspendido")
                                ? "bg-rose-50 text-rose-600 border-rose-150"
                                : student.status === "graduated"
                                ? "bg-purple-50 text-purple-600 border-purple-150"
                                : (student.status === "recovered" || student.status === "recuperado" || student.status === "recs")
                                ? "bg-sky-50 text-sky-650 border-sky-150"
                                : "bg-slate-50 text-slate-500 border border-slate-200"
                            }`}>
                              {student.status === "active" ? "Activo" 
                               : student.status === "moroso" ? "Falta de pago" 
                               : (student.status === "suspended" || student.status === "suspendido") ? "Suspendido" 
                               : student.status === "graduated" ? "Graduado"
                               : (student.status === "recovered" || student.status === "recuperado" || student.status === "recs") ? "Recuperado (Recs)"
                               : "Dado de baja"}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button 
                              onClick={() => handleDeleteStudent(student.id, student.name)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                              title="Eliminar Alumno"
                            >
                              <span className="material-symbols-outlined text-lg" data-icon="delete">delete</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
              <span className="text-xs font-semibold text-slate-400">
                Mostrando {students.length} de {kpi.totalStudents} alumnos
              </span>
              <div className="flex items-center gap-2">
                <button 
                  disabled
                  className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-400 hover:bg-slate-50 transition-colors disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-sm font-bold" data-icon="chevron_left">chevron_left</span>
                </button>
                <div className="flex items-center gap-1">
                  <button className="w-8 h-8 flex items-center justify-center rounded-lg bg-ttp-primary text-white text-xs font-bold shadow-sm">1</button>
                  <button className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 text-xs font-bold hover:bg-slate-50 transition-all">2</button>
                </div>
                <button 
                  className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  <span className="material-symbols-outlined text-sm font-bold" data-icon="chevron_right">chevron_right</span>
                </button>
              </div>
            </div>
          </div>

          {/* KPI Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* KPI 1 */}
            <div className="bg-white border border-slate-200/60 p-6 rounded-2xl card-shadow relative overflow-hidden group">
              <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-ttp-primary"></div>
              <p className="text-xs font-bold tracking-wider text-slate-400 uppercase mb-2">Total Alumnos</p>
              <h3 className="font-montserrat text-3xl font-extrabold text-slate-800">{kpi.totalStudents}</h3>
              <p className="text-xs text-ttp-primary font-bold flex items-center gap-1 mt-3">
                <span className="material-symbols-outlined text-sm font-bold" data-icon="trending_up">trending_up</span>
                +12% este mes
              </p>
            </div>
            
            {/* KPI 2 */}
            <div className="bg-white border border-slate-200/60 p-6 rounded-2xl card-shadow relative overflow-hidden group">
              <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-ttp-club"></div>
              <p className="text-xs font-bold tracking-wider text-slate-400 uppercase mb-2">Asistencia Media</p>
              <h3 className="font-montserrat text-3xl font-extrabold text-slate-800">{kpi.attendance}</h3>
              <p className="text-xs text-slate-500 font-semibold mt-3">Excelente participación</p>
            </div>
            
            {/* KPI 3 */}
            <div className="bg-white border border-slate-200/60 p-6 rounded-2xl card-shadow relative overflow-hidden group">
              <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-ttp-alert"></div>
              <p className="text-xs font-bold tracking-wider text-slate-400 uppercase mb-2">Pagos Pendientes</p>
              <h3 className="font-montserrat text-3xl font-extrabold text-slate-800">{kpi.pendingPayments}</h3>
              <p className={`text-xs font-bold flex items-center gap-1 mt-3 ${kpi.pendingPayments > 0 ? "text-amber-600" : "text-teal-600"}`}>
                <span className="material-symbols-outlined text-sm" data-icon={kpi.pendingPayments > 0 ? "warning" : "check"}>
                  {kpi.pendingPayments > 0 ? "warning" : "check"}
                </span>
                {kpi.pendingPayments > 0 ? "Requiere atención" : "Cuentas al día"}
              </p>
            </div>
          </div>
        </>
      ) : (
          <AcademicManagement showToast={showToast} />
      )}
        </div>
      </main>

      {/* Mobile Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 flex justify-around py-2.5 z-40 shadow-xl shadow-slate-900/5">
        {[
          { name: "Inicio", icon: "dashboard", route: "/" },
          { name: "Horarios", icon: "calendar_today", route: "/schedules" },
          { name: "Alumnos", icon: "school", route: "/students" },
          { name: "Facturación", icon: "payments", route: "/billing" },
          { name: "Más", icon: "grid_view", route: "/settings" },
        ].map((item) => (
          <Link key={item.name} href={item.route} className="flex flex-col items-center gap-0.5 text-center text-slate-500 hover:text-slate-800 transition-all">
            <span className="material-symbols-outlined text-2xl">{item.icon}</span>
            <span className="text-[10px] font-semibold">{item.name}</span>
          </Link>
        ))}
      </nav>


      {/* Flotante Add Student Modal ("Nuevo Alumno") */}
      {isAddModalOpen && (
        <div className="modal-backdrop fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden border border-slate-100 modal-card">
            <div className="p-6 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-montserrat text-lg font-bold text-slate-800 flex items-center gap-2">
                <span className="material-symbols-outlined text-ttp-primary">school</span>
                Registrar Nuevo Alumno
              </h3>
              <button 
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-200/50 rounded-full transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <form 
              onSubmit={handleAddStudent} 
              onKeyDown={(e) => {
                if (e.key === "Enter" && e.target.tagName === "INPUT") {
                  e.preventDefault();
                }
              }}
              className="p-6 space-y-4 max-h-[70vh] overflow-y-auto"
            >
              {/* Nombre y Apellido */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Nombre</label>
                  <input
                    autoFocus
                    required
                    type="text"
                    value={newStudent.name}
                    onChange={(e) => setNewStudent({...newStudent, name: e.target.value})}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-ttp-primary/10 focus:border-ttp-primary text-sm font-medium"
                    placeholder="Ej. Elena"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Apellido</label>
                  <input
                    type="text"
                    value={newStudent.last_name}
                    onChange={(e) => setNewStudent({...newStudent, last_name: e.target.value})}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-ttp-primary/10 focus:border-ttp-primary text-sm font-medium"
                    placeholder="Ej. Rodríguez"
                  />
                </div>
              </div>

              {/* Email y WhatsApp */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Correo Electrónico</label>
                  <input
                    required
                    type="text"
                    value={newStudent.email}
                    onChange={(e) => setNewStudent({...newStudent, email: e.target.value})}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-ttp-primary/10 focus:border-ttp-primary text-sm font-medium"
                    placeholder="Ej. elena@correo.com"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">WhatsApp</label>
                  <input
                    type="tel"
                    value={newStudent.phone}
                    onChange={(e) => setNewStudent({...newStudent, phone: e.target.value})}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-ttp-primary/10 focus:border-ttp-primary text-sm font-medium"
                    placeholder="+52 55 1234 5678"
                  />
                </div>
              </div>

              {/* Estado académico y de pago */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Estado</label>
                  <select
                    value={newStudent.status}
                    onChange={(e) => setNewStudent({...newStudent, status: e.target.value})}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-ttp-primary/10 focus:border-ttp-primary text-sm font-medium text-slate-700 bg-white"
                  >
                    <option value="active">Activo</option>
                    <option value="prospect">Prospecto</option>
                    <option value="recovered">Recuperado (Recs)</option>
                    <option value="inactive">Dado de baja</option>
                    <option value="suspended">Suspendido</option>
                    <option value="graduated">Graduado</option>
                    <option value="moroso">Falta de pago</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Estatus de Pago</label>
                  <select
                    value={newStudent.payment_status}
                    onChange={(e) => setNewStudent({...newStudent, payment_status: e.target.value})}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-ttp-primary/10 focus:border-ttp-primary text-sm font-medium text-slate-700 bg-white"
                  >
                    <option value="pendiente">Pendiente (Por pagar)</option>
                    <option value="al_corriente">Pago realizado</option>
                    <option value="moroso">Moroso</option>
                    <option value="pago_fallido">Pago fallido</option>
                  </select>
                </div>
              </div>

              {/* Maestro → filtra grupos disponibles */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Maestro Asignado</label>
                <select
                  value={newStudent.teacher}
                  onChange={(e) => handleTeacherSelect(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-ttp-primary/10 focus:border-ttp-primary text-sm font-medium text-slate-700 bg-white"
                >
                  <option value="">— Selecciona un maestro —</option>
                  {formTeachers.filter(t => t.status === "active" || t.status === "activo").map(t => (
                    <option key={t.id} value={t.name}>{t.name} · {t.specialty}</option>
                  ))}
                </select>
              </div>

              {/* Grupo/Horario — solo muestra grupos del maestro seleccionado */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Grupo / Horario
                  {newStudent.teacher && formGroups.filter(g => g.teacher === newStudent.teacher).length === 0 && (
                    <span className="ml-2 text-amber-500 normal-case font-medium">— Este maestro no tiene grupos asignados aún</span>
                  )}
                </label>
                <select
                  value={newStudent.current_group}
                  onChange={(e) => handleGroupSelect(e.target.value)}
                  disabled={!newStudent.teacher}
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-ttp-primary/10 focus:border-ttp-primary text-sm font-medium text-slate-700 bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">— Selecciona un grupo —</option>
                  {formGroups
                    .filter(g => !newStudent.teacher || g.teacher === newStudent.teacher)
                    .map(g => (
                      <option key={g.id} value={g.title}>
                        {g.title} · {g.schedule}
                      </option>
                    ))
                  }
                </select>
              </div>

              {/* Info card auto-rellena cuando hay grupo seleccionado */}
              {newStudent.current_group && newStudent.schedule && (
                <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                  <span className="material-symbols-outlined text-ttp-primary text-xl flex-shrink-0">schedule</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-700">{newStudent.schedule}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {CT_LABEL_FORM[newStudent.class_type] || newStudent.class_type}
                      {newStudent.teacher ? ` · ${newStudent.teacher}` : ""}
                    </p>
                  </div>
                  <span className="text-[10px] font-bold text-teal-600 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-full whitespace-nowrap">Auto-asignado</span>
                </div>
              )}

              {/* Próximo Pago */}
              {/* Fecha de Inicio y Próxima Fecha de Pago */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Fecha de Inicio (Registro)</label>
                  <input
                    required
                    type="date"
                    value={newStudent.enrolled_date}
                    onChange={(e) => setNewStudent({...newStudent, enrolled_date: e.target.value})}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-ttp-primary/10 focus:border-ttp-primary text-sm font-medium text-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Próxima Fecha de Pago</label>
                  <input
                    required
                    type="date"
                    value={newStudent.next_payment}
                    onChange={(e) => setNewStudent({...newStudent, next_payment: e.target.value})}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-ttp-primary/10 focus:border-ttp-primary text-sm font-medium text-slate-700"
                  />
                </div>
              </div>

              {/* Monto Mensual y Burlington */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Monto Mensual (Colegiatura)</label>
                  <input
                    required
                    type="number"
                    value={newStudent.amount_due}
                    onChange={(e) => setNewStudent({...newStudent, amount_due: e.target.value})}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-ttp-primary/10 focus:border-ttp-primary text-sm font-medium text-slate-700 bg-white"
                    placeholder="Ej. 2450"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Usuario Burlington English</label>
                  <input
                    type="text"
                    value={newStudent.burlington_user}
                    onChange={(e) => setNewStudent({...newStudent, burlington_user: e.target.value})}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-ttp-primary/10 focus:border-ttp-primary text-sm font-medium"
                    placeholder="Ej. elena@ttp"
                  />
                </div>
              </div>

              {/* Acciones */}
              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                <button 
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-5 py-2 rounded-xl text-slate-500 hover:bg-slate-50 font-semibold text-sm active:scale-95 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-ttp-primary hover:opacity-90 text-white font-semibold text-sm shadow-md active:scale-95 transition-all"
                >
                  Guardar Alumno
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      <ConfirmDialog
        open={!!deleteConfirmModal}
        title="¿Eliminar Alumno?"
        description={deleteConfirmModal ? `¿Estás seguro de que deseas eliminar permanentemente a "${deleteConfirmModal.name}" del sistema? Esta acción no se puede deshacer.` : ""}
        confirmLabel="Sí, Eliminar"
        variant="danger"
        onConfirm={() => { deleteConfirmModal?.onConfirm(); setDeleteConfirmModal(null); }}
        onCancel={() => setDeleteConfirmModal(null)}
      />
    </div>
  );
}
