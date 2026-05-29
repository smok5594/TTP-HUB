"use client";

import React, { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import Link from "next/link";
import { supabase } from "@/utils/supabaseClient";
import ConfirmDialog from "@/components/ConfirmDialog";
import { toast } from "sonner";

const initialTeachers = [];

const emptyForm = { 
  name: "", 
  email: "", 
  phone: "", 
  specialty: "", 
  rate: "", 
  since: "",
  birthdate: "",
  burlington_user: "",
  burlington_pass: "",
  ttp_user: "",
  ttp_pass: ""
};

const getAutoUsername = (nameStr) => {
  if (!nameStr) return "";
  const clean = nameStr.trim().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Quitar acentos
    .replace(/^(lic\.|prof\.|dr\.|ing\.)\s+/i, "") // Quitar títulos comunes
    .replace(/[^a-z0-9\s]/g, ""); // Conservar solo letras, números y espacios
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]}.${parts[parts.length - 1]}`;
  } else if (parts.length === 1) {
    return parts[0];
  }
  return "";
};


export default function TeachersDashboard() {
  const [teachers, setTeachers] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  
  // Real Email Sending States
  const [emailModalTeacher, setEmailModalTeacher] = useState(null);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [emailSending, setEmailSending] = useState(false);

  const openSendEmail = (t) => {
    setEmailModalTeacher(t);
    setEmailSubject("");
    setEmailBody("");
  };

  const handleSendEmail = async (e) => {
    e.preventDefault();
    if (!emailSubject.trim() || !emailBody.trim()) {
      showToast("❌ Por favor completa el asunto y el mensaje.");
      return;
    }
    setEmailSending(true);
    showToast("✉️ Enviando correo electrónico...");
    try {
      const response = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: emailModalTeacher.email,
          subject: emailSubject.trim(),
          text: emailBody.trim(),
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Fallo en el envío.");
      showToast(`✅ Correo enviado con éxito a ${emailModalTeacher.name}`);
      setEmailModalTeacher(null);
      setEmailSubject("");
      setEmailBody("");
    } catch (err) {
      showToast(`❌ Error: ${err.message}`);
    } finally {
      setEmailSending(false);
    }
  };

  const fetchTeachers = async () => {
    setLoading(true);
    try {
      const { data: teachersData, error } = await supabase.from("teachers").select("*");
      if (error) throw error;
      if (!teachersData || teachersData.length === 0) {
        setTeachers([]);
        return;
      }
      const { data: classesData } = await supabase.from("classes").select("teacher_id");
      const { data: studentsData } = await supabase.from("students").select("teacher");
      const mapped = teachersData.map(t => ({
        id: t.id,
        name: t.name,
        email: t.email || `${t.name.toLowerCase().replace(/\s/g, "")}@ttp.mx`,
        phone: t.phone || "+52 55 0000 0000",
        specialty: t.specialty || "Profesor de Inglés",
        rate: t.rate || 250,
        since: t.since || "",
        birthdate: t.birthdate || "",
        burlington_user: t.burlington_user || "",
        burlington_pass: t.burlington_pass || "",
        ttp_user: t.ttp_user || "",
        ttp_pass: t.ttp_pass || "",
        classes: classesData?.filter(c => c.teacher_id === t.id).length || 0,
        students: studentsData?.filter(s => s.teacher === t.name).length || 0,
        status: t.status === "active" ? "activo" : "suspendido"
      }));
      setTeachers(mapped);
    } catch (err) {
      console.error("Error cargando profesores:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailability = async () => {
    try {
      const { data, error } = await supabase.from("teacher_availability").select("*");
      if (error) throw error;
      if (!data || data.length === 0) {
        setAvailabilityBlocks([]);
        return;
      }
      setAvailabilityBlocks(data.map(b => ({
        id: b.id,
        teacherId: b.teacher_id,
        day: b.day,
        type: b.type,
        startTime: b.start_time,
        endTime: b.end_time,
        description: b.description || ""
      })));
    } catch (err) {
      console.error("Error cargando disponibilidad:", err);
    }
  };

  useEffect(() => {
    fetchTeachers();
    fetchAvailability();
  }, []);


  // Sub-tabs y disponibilidad
  const [activeSubTab, setActiveSubTab] = useState("lista");
  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [availabilityBlocks, setAvailabilityBlocks] = useState([]);
  const [classesList, setClassesList] = useState([]);

  useEffect(() => {
    const loadClasses = async () => {
      const { data } = await supabase.from("classes").select("id, title, teacher_id");
      if (data) setClassesList(data);
    };
    loadClasses();
  }, [activeSubTab]);

  // Modales
  const [addModal, setAddModal] = useState(false);
  const [editModal, setEditModal] = useState(null); // teacher obj
  const [deleteModal, setDeleteModal] = useState(null); // teacher obj
  const [suspendModal, setSuspendModal] = useState(null); // teacher obj
  const [formData, setFormData] = useState(emptyForm);
  const [deleteConfirm, setDeleteConfirm] = useState("");


  useEffect(() => {
    if (teachers.length > 0 && !selectedTeacherId) {
      setSelectedTeacherId(teachers[0].id);
    }
  }, [teachers, selectedTeacherId]);

  // Modal de bloques de disponibilidad
  const [blockModal, setBlockModal] = useState({ open: false, mode: "add", block: null });
  const [blockForm, setBlockForm] = useState({ day: "Lunes", type: "disponible", startTime: "08:00", endTime: "09:00", description: "" });

  const hasOverlap = (teacherId, day, startTime, endTime, ignoreBlockId = null) => {
    const toMin = t => {
      if (!t) return 0;
      const [h, m] = t.split(":").map(Number);
      return h * 60 + (m || 0);
    };
    const start = toMin(startTime);
    const end = toMin(endTime);

    // Si el nuevo bloque es día de descanso, bloquea todo
    const teacherBlocks = availabilityBlocks.filter(
      b => b.teacherId === teacherId && b.day === day && b.id !== ignoreBlockId
    );

    return teacherBlocks.some(b => {
      // Si ya hay un día completo de descanso, choca con todo
      if (b.type === "dia_descanso") return true;
      
      const bStart = toMin(b.startTime);
      const bEnd = toMin(b.endTime);
      return Math.max(start, bStart) < Math.min(end, bEnd);
    });
  };

  const openAddBlockModal = (day = "Lunes", startTime = "08:00", endTime = "09:00") => {
    setBlockForm({
      day,
      type: "disponible",
      startTime,
      endTime,
      description: ""
    });
    setBlockModal({ open: true, mode: "add", block: null });
  };

  const openEditBlockModal = (block) => {
    setBlockForm({
      day: block.day,
      type: block.type,
      startTime: block.startTime,
      endTime: block.endTime,
      description: block.description || ""
    });
    setBlockModal({ open: true, mode: "edit", block });
  };

  const handleSaveBlock = async (e) => {
    e.preventDefault();
    if (!selectedTeacherId) return;

    const toMin = t => {
      const [h, m] = t.split(":").map(Number);
      return h * 60 + m;
    };

    if (blockForm.type !== "dia_descanso" && toMin(blockForm.startTime) >= toMin(blockForm.endTime)) {
      showToast("⛔ La hora de inicio debe ser menor a la hora de fin.");
      return;
    }

    const start = blockForm.type === "dia_descanso" ? "07:00" : blockForm.startTime;
    const end = blockForm.type === "dia_descanso" ? "22:00" : blockForm.endTime;

    const ignoreId = blockModal.mode === "edit" ? blockModal.block.id : null;
    if (hasOverlap(selectedTeacherId, blockForm.day, start, end, ignoreId)) {
      showToast("⚠️ Conflicto: Ya existe un bloque de horario asignado que se empalma en este día y hora.");
      return;
    }

    try {
      if (blockModal.mode === "add") {
        const { data, error } = await supabase.from("teacher_availability").insert([{
          teacher_id: selectedTeacherId,
          day: blockForm.day,
          type: blockForm.type,
          start_time: start,
          end_time: end,
          description: blockForm.description
        }]).select();
        if (error) throw error;
        setAvailabilityBlocks(prev => [...prev, {
          id: data[0].id,
          teacherId: selectedTeacherId,
          day: blockForm.day,
          type: blockForm.type,
          startTime: start,
          endTime: end,
          description: blockForm.description
        }]);
        showToast("✅ Bloque de disponibilidad registrado.");
      } else {
        const { error } = await supabase.from("teacher_availability").update({
          day: blockForm.day,
          type: blockForm.type,
          start_time: start,
          end_time: end,
          description: blockForm.description
        }).eq("id", blockModal.block.id);
        if (error) throw error;
        setAvailabilityBlocks(prev => prev.map(b => b.id === blockModal.block.id ? {
          ...b, day: blockForm.day, type: blockForm.type, startTime: start, endTime: end, description: blockForm.description
        } : b));
        showToast("✏️ Bloque de disponibilidad actualizado.");
      }
    } catch (err) {
      showToast("⛔ Error al guardar bloque.");
    }
    setBlockModal({ open: false, mode: "add", block: null });
  };

  const handleDeleteBlock = async (blockId) => {
    await supabase.from("teacher_availability").delete().eq("id", blockId);
    setAvailabilityBlocks(prev => prev.filter(b => b.id !== blockId));
    showToast("🗑️ Bloque de disponibilidad eliminado.");
    setBlockModal({ open: false, mode: "add", block: null });
  };

  const handleBulkAvailability = async (action) => {
    if (!selectedTeacherId) return;
    const days = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
    try {
      if (action === "habilitar_todo") {
        await supabase.from("teacher_availability").delete().eq("teacher_id", selectedTeacherId);
        setAvailabilityBlocks(prev => prev.filter(b => b.teacherId !== selectedTeacherId));
        showToast("✅ Se borraron todos los bloqueos. Disponibilidad completa.");
        return;
      }
      const configs = {
        bloquear_todo:    { type: "dia_descanso",  start_time: "07:00", end_time: "22:00", description: "Día completo de descanso" },
        bloquear_mananas: { type: "no_disponible", start_time: "07:00", end_time: "12:00", description: "Bloqueo matutino general" },
        bloquear_tardes:  { type: "no_disponible", start_time: "13:00", end_time: "21:00", description: "Bloqueo vespertino general" }
      };
      const cfg = configs[action];
      if (action === "bloquear_todo") {
        await supabase.from("teacher_availability").delete().eq("teacher_id", selectedTeacherId);
      }
      const payloads = days.map(day => ({ teacher_id: selectedTeacherId, day, ...cfg }));
      const { data, error } = await supabase.from("teacher_availability").insert(payloads).select();
      if (error) throw error;
      const newBlocks = data.map(b => ({ id: b.id, teacherId: b.teacher_id, day: b.day, type: b.type, startTime: b.start_time, endTime: b.end_time, description: b.description || "" }));
      setAvailabilityBlocks(prev => [
        ...prev.filter(b => b.teacherId !== selectedTeacherId || (action !== "bloquear_todo" && b.type === "dia_descanso")),
        ...newBlocks
      ]);
      if (action === "bloquear_todo") showToast("⛔ Se bloquearon todos los días de la semana.");
      else if (action === "bloquear_mananas") showToast("🌅 Se bloquearon las mañanas (07:00 a 12:00).");
      else showToast("🌇 Se bloquearon las tardes (13:00 a 21:00).");
    } catch (err) {
      showToast("⛔ Error al aplicar cambio masivo.");
    }
  };

  const showToast = (msg) => {
    if (msg.startsWith("✅")) toast.success(msg.replace("✅ ", ""));
    else if (msg.startsWith("✏️")) toast.success(msg.replace("✏️ ", ""));
    else if (msg.startsWith("🗑️")) toast.error(msg.replace("🗑️ ", ""));
    else if (msg.startsWith("⛔")) toast.warning(msg.replace("⛔ ", ""));
    else toast(msg);
  };

  const formatSinceDate = (sinceStr) => {
    if (!sinceStr) return "—";
    if (isNaN(Date.parse(sinceStr))) return sinceStr;
    try {
      const parts = sinceStr.split("-");
      if (parts.length === 3) {
        const date = new Date(parts[0], parts[1] - 1, parts[2]);
        return date.toLocaleDateString("es-ES", {
          day: "numeric",
          month: "short",
          year: "numeric"
        });
      }
      return new Date(sinceStr).toLocaleDateString("es-ES", {
        day: "numeric",
        month: "short",
        year: "numeric"
      });
    } catch (e) {
      return sinceStr;
    }
  };

  const filtered = teachers.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.specialty.toLowerCase().includes(search.toLowerCase())
  );

  const kpis = [
    { label: "Total Maestros", value: loading ? "..." : teachers.length, icon: "person_4", color: "text-ttp-primary bg-ttp-primary/10" },
    { label: "Activos", value: loading ? "..." : teachers.filter(t => t.status === "activo").length, icon: "check_circle", color: "text-teal-600 bg-teal-50" },
    { label: "Clases esta Semana", value: loading ? "..." : teachers.reduce((s, t) => s + (t.status === "activo" ? t.classes : 0), 0), icon: "calendar_today", color: "text-sky-600 bg-sky-50" },
    { label: "Alumnos Atendidos", value: loading ? "..." : teachers.reduce((s, t) => s + (t.status === "activo" ? t.students : 0), 0), icon: "school", color: "text-purple-600 bg-purple-50" },
  ];

  const handleGenerateRandomPassword = () => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let pass = "ttp_";
    for (let i = 0; i < 6; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData(p => ({ ...p, ttp_pass: pass }));
    showToast("✅ Contraseña aleatoria generada.");
  };

  const handleCopyCredentials = (teacherNameValue) => {
    const userVal = formData.ttp_user;
    const passVal = formData.ttp_pass;
    if (!userVal || !passVal) {
      showToast("⛔ Usuario y contraseña son necesarios para copiar.");
      return;
    }
    const text = `Hola ${teacherNameValue || formData.name || "Profesor"},\n\nAquí están tus credenciales de acceso para TTP Hub Portal:\n🔗 Plataforma: https://ttp-hub.vercel.app/login\n👤 Usuario: ${userVal}\n🔑 Contraseña: ${passVal}\n\nPor favor, guarda estos accesos de forma segura.`;
    
    navigator.clipboard.writeText(text)
      .then(() => showToast("📋 ¡Credenciales copiadas al portapapeles!"))
      .catch(() => showToast("⛔ Error al copiar al portapapeles."));
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    try {
      const { data, error } = await supabase.from("teachers").insert([{
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        specialty: formData.specialty,
        rate: Number(formData.rate) || null,
        since: formData.since || null,
        birthdate: formData.birthdate || null,
        burlington_user: formData.burlington_user,
        burlington_pass: formData.burlington_pass,
        ttp_user: formData.ttp_user,
        ttp_pass: formData.ttp_pass,
        status: "active"
      }]).select();
      if (error) throw error;
      const t = data[0];
      setTeachers(prev => [{
        id: t.id,
        name: t.name,
        email: t.email || `${t.name.toLowerCase().replace(/\s/g, "")}@ttp.mx`,
        phone: t.phone || "+52 55 0000 0000",
        specialty: t.specialty || "Profesor de Inglés",
        rate: t.rate || 250,
        since: t.since || "",
        birthdate: t.birthdate || "",
        burlington_user: t.burlington_user || "",
        burlington_pass: t.burlington_pass || "",
        ttp_user: t.ttp_user || "",
        ttp_pass: t.ttp_pass || "",
        classes: 0,
        students: 0,
        status: "activo"
      }, ...prev]);
      setAddModal(false);
      setFormData(emptyForm);
      showToast(`✅ Maestro ${t.name} agregado exitosamente.`);
    } catch (err) {
      showToast(`⛔ Error al agregar maestro: ${err.message}`);
    }
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from("teachers").update({
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        specialty: formData.specialty,
        rate: Number(formData.rate) || null,
        since: formData.since || null,
        birthdate: formData.birthdate || null,
        burlington_user: formData.burlington_user,
        burlington_pass: formData.burlington_pass,
        ttp_user: formData.ttp_user,
        ttp_pass: formData.ttp_pass
      }).eq("id", editModal.id);
      if (error) throw error;
      setTeachers(prev => prev.map(t => t.id === editModal.id ? { ...t, ...formData, rate: Number(formData.rate) } : t));
      showToast(`✏️ Perfil de ${formData.name} actualizado.`);
      setEditModal(null);
    } catch (err) {
      showToast(`⛔ Error al actualizar: ${err.message}`);
    }
  };

  const handleDelete = async () => {
    if (deleteConfirm.trim() !== deleteModal.name.trim()) return;
    try {
      const { error } = await supabase.from("teachers").delete().eq("id", deleteModal.id);
      if (error) throw error;
      setTeachers(prev => prev.filter(t => t.id !== deleteModal.id));
      showToast(`🗑️ Maestro ${deleteModal.name} eliminado del sistema.`);
      setDeleteModal(null);
      setDeleteConfirm("");
    } catch (err) {
      showToast(`⛔ Error al eliminar: ${err.message}`);
    }
  };

  const handleToggleSuspend = async () => {
    const next = suspendModal.status === "activo" ? "suspendido" : "activo";
    try {
      const { error } = await supabase.from("teachers").update({
        status: next === "activo" ? "active" : "on_leave"
      }).eq("id", suspendModal.id);
      if (error) throw error;
      setTeachers(prev => prev.map(t => t.id === suspendModal.id ? { ...t, status: next } : t));
      showToast(next === "suspendido" ? `⛔ ${suspendModal.name} suspendido.` : `✅ ${suspendModal.name} reactivado.`);
      setSuspendModal(null);
    } catch (err) {
      showToast(`⛔ Error: ${err.message}`);
    }
  };

  const openEdit = (t) => {
    const parsedSince = (t.since && !isNaN(Date.parse(t.since))) 
      ? new Date(t.since).toISOString().split("T")[0] 
      : new Date().toISOString().split("T")[0];
    setFormData({ 
      name: t.name, 
      email: t.email, 
      phone: t.phone, 
      specialty: t.specialty, 
      rate: t.rate, 
      since: parsedSince,
      birthdate: t.birthdate || "",
      burlington_user: t.burlington_user || "",
      burlington_pass: t.burlington_pass || "",
      ttp_user: t.ttp_user || "",
      ttp_pass: t.ttp_pass || ""
    });
    setEditModal(t);
  };

  return (
    <div className="flex min-h-screen bg-slate-50 font-inter relative">
      <Sidebar activeName="Maestros" />

      <main className="flex-1 md:ml-64 min-h-screen flex flex-col">
        {/* Header */}
        <header className="flex justify-between items-center w-full px-6 md:px-10 h-16 sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200">
          <div>
            <h2 className="font-montserrat font-bold text-slate-800 text-lg">Área de Maestros</h2>
            <p className="text-xs text-slate-400 font-medium">Gestión completa del equipo docente</p>
          </div>
          <button
            onClick={() => { 
              setFormData({ 
                ...emptyForm, 
                since: new Date().toISOString().split("T")[0] 
              }); 
              setAddModal(true); 
            }}
            className="bg-ttp-primary text-white px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-md shadow-ttp-primary/20"
          >
            <span className="material-symbols-outlined text-lg">person_add</span>
            Agregar Maestro
          </button>
        </header>

        <div className="p-6 md:p-10 max-w-7xl mx-auto w-full space-y-8">
          {/* Sub-tabs Navigation */}
          <div className="flex gap-2 bg-slate-100 p-1 rounded-xl w-fit">
            <button
              onClick={() => setActiveSubTab("lista")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeSubTab === "lista"
                  ? "bg-white text-ttp-primary shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <span className="material-symbols-outlined text-sm">group</span>
              Lista de Maestros
            </button>
            <button
              onClick={() => setActiveSubTab("disponibilidad")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeSubTab === "disponibilidad"
                  ? "bg-white text-ttp-primary shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <span className="material-symbols-outlined text-sm">calendar_month</span>
              Calendario de Disponibilidad
            </button>
          </div>

          {activeSubTab === "lista" ? (
            <>
              {/* KPIs */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {kpis.map((k) => (
                  <div key={k.label} className="bg-white border border-slate-200/60 rounded-2xl p-5 flex items-center gap-4 shadow-sm">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${k.color}`}>
                      <span className="material-symbols-outlined text-xl">{k.icon}</span>
                    </div>
                    <div>
                      <p className="text-2xl font-extrabold text-slate-800">{k.value}</p>
                      <p className="text-[11px] text-slate-400 font-semibold">{k.label}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Search */}
              <div className="bg-white border border-slate-200/60 rounded-2xl p-4 flex items-center gap-3 shadow-sm">
                <span className="material-symbols-outlined text-slate-400">search</span>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por nombre o especialidad..."
                  className="flex-1 text-sm font-medium text-slate-700 outline-none placeholder-slate-300"
                />
              </div>

              {/* Table */}
              <div className="bg-white border border-slate-200/60 rounded-3xl shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="font-montserrat font-bold text-slate-800 text-sm">Equipo Docente</h3>
                  <span className="text-[10px] font-bold text-slate-400">{filtered.length} maestros</span>
                </div>

                <div className="overflow-x-auto w-full">
                  <table className="w-full min-w-[850px] border-collapse text-left">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        <th className="px-6 py-3 font-bold w-[25%]">Maestro</th>
                        <th className="px-6 py-3 font-bold w-[25%]">Especialidad</th>
                        <th className="px-6 py-3 font-bold text-center w-[8%]">Clases</th>
                        <th className="px-6 py-3 font-bold text-center w-[8%]">Alumnos</th>
                        <th className="px-6 py-3 font-bold text-right w-[10%]">Tarifa/h</th>
                        <th className="px-6 py-3 font-bold text-center w-[12%]">Estado</th>
                        <th className="px-6 py-3 font-bold text-right pr-6 w-[12%]">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {loading ? (
                        <tr>
                          <td colSpan={7} className="py-12 text-center">
                            <span className="material-symbols-outlined text-4xl text-ttp-primary animate-spin">sync</span>
                            <p className="text-sm text-slate-400 font-bold mt-2">Cargando profesores de la base de datos...</p>
                          </td>
                        </tr>
                      ) : filtered.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-12 text-center">
                            <span className="material-symbols-outlined text-4xl text-slate-200">person_search</span>
                            <p className="text-sm text-slate-400 font-medium mt-2">No se encontraron maestros</p>
                          </td>
                        </tr>
                      ) : (
                        filtered.map((t) => (
                          <tr key={t.id} className="hover:bg-slate-50/60 transition-colors">
                            {/* Name + contact */}
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-ttp-primary/10 text-ttp-primary font-extrabold font-montserrat text-sm flex items-center justify-center flex-shrink-0">
                                  {t.name.charAt(0)}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <p className="text-sm font-bold text-slate-800 truncate max-w-[150px] md:max-w-none">{t.name}</p>
                                    {(() => {
                                      const blockedCount = availabilityBlocks.filter(b => b.teacherId === t.id && b.type !== "disponible").length;
                                      if (blockedCount > 0) {
                                        return (
                                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-50 border border-rose-100 text-rose-600 flex items-center gap-0.5 flex-shrink-0 animate-pulse" title={`${blockedCount} bloques no disponibles o con clase`}>
                                            <span className="material-symbols-outlined text-[10px]" style={{ fontVariationSettings: "'FILL' 1" }}>event_busy</span>
                                            {blockedCount} bloques
                                          </span>
                                        );
                                      }
                                      return (
                                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-teal-50 border border-teal-100 text-teal-600 flex items-center gap-0.5 flex-shrink-0" title="Disponibilidad completa">
                                          <span className="material-symbols-outlined text-[10px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                                          Ok
                                        </span>
                                      );
                                    })()}
                                  </div>
                                  <p className="text-[10px] text-slate-400 font-medium truncate max-w-[200px] md:max-w-none">{t.email}</p>
                                </div>
                              </div>
                            </td>
                            {/* Specialty */}
                            <td className="px-6 py-4">
                              <p className="text-xs font-semibold text-slate-600 truncate max-w-[200px] md:max-w-none">{t.specialty}</p>
                              <p className="text-[10px] text-slate-400">Desde {formatSinceDate(t.since)}</p>
                            </td>
                            {/* Classes */}
                            <td className="px-6 py-4 text-center text-sm font-bold text-slate-700">
                              {t.classes}
                            </td>
                            {/* Students */}
                            <td className="px-6 py-4 text-center text-sm font-bold text-slate-700">
                              {t.students}
                            </td>
                            {/* Rate */}
                            <td className="px-6 py-4 text-right text-xs font-bold text-slate-700">
                              ${t.rate}/h
                            </td>
                            {/* Status */}
                            <td className="px-6 py-4 text-center">
                              <span className={`text-[9px] font-bold px-2 py-1 rounded-full border whitespace-nowrap ${
                                t.status === "activo"
                                  ? "bg-teal-50 border-teal-200 text-teal-600"
                                  : "bg-amber-50 border-amber-200 text-amber-600"
                              }`}>
                                {t.status === "activo" ? "Activo" : "Suspendido"}
                              </span>
                            </td>
                            {/* Actions */}
                            <td className="px-6 py-4 text-right pr-6">
                              <div className="flex items-center justify-end gap-1">
                                <button onClick={() => openSendEmail(t)} title="Enviar Correo" className="p-1.5 rounded-lg hover:bg-sky-50 text-slate-400 hover:text-sky-600 transition-colors">
                                  <span className="material-symbols-outlined text-base">mail</span>
                                </button>
                                <button onClick={() => openEdit(t)} title="Editar" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors">
                                  <span className="material-symbols-outlined text-base">edit</span>
                                </button>
                                <button onClick={() => setSuspendModal(t)} title={t.status === "activo" ? "Suspender" : "Reactivar"} className={`p-1.5 rounded-lg transition-colors ${t.status === "activo" ? "hover:bg-amber-50 text-slate-400 hover:text-amber-600" : "hover:bg-teal-50 text-slate-400 hover:text-teal-600"}`}>
                                  <span className="material-symbols-outlined text-base">{t.status === "activo" ? "block" : "check_circle"}</span>
                                </button>
                                <button onClick={() => setDeleteModal(t)} title="Eliminar" className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors">
                                  <span className="material-symbols-outlined text-base">delete</span>
                                </button>
                              </div>
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
            <div className="space-y-6">
              {/* Selector & Actions Card */}
              <div className="bg-white border border-slate-200/60 rounded-3xl p-6 shadow-sm flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                <div className="flex items-center gap-4 flex-wrap sm:flex-nowrap">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-ttp-primary/10 text-ttp-primary flex items-center justify-center flex-shrink-0">
                      <span className="material-symbols-outlined text-xl">person_4</span>
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Seleccionar Maestro
                      </label>
                      <select
                        value={selectedTeacherId}
                        onChange={(e) => setSelectedTeacherId(e.target.value)}
                        className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-ttp-primary/20 cursor-pointer w-[200px] truncate"
                      >
                        {teachers.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <button
                    onClick={() => openAddBlockModal("Lunes", "08:00", "09:00")}
                    className="bg-ttp-primary text-white px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-md shadow-ttp-primary/20"
                  >
                    <span className="material-symbols-outlined text-sm font-bold">add_box</span>
                    Agregar Bloque
                  </button>
                </div>

                {/* Bulk Actions */}
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleBulkAvailability("habilitar_todo")}
                    className="px-3 py-2 border border-teal-200 bg-teal-50 hover:bg-teal-100 text-teal-600 text-[11px] font-bold rounded-xl transition-all flex items-center gap-1 active:scale-95"
                  >
                    <span className="material-symbols-outlined text-sm">check_circle</span>
                    Habilitar Todo
                  </button>
                  <button
                    onClick={() => handleBulkAvailability("bloquear_todo")}
                    className="px-3 py-2 border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-600 text-[11px] font-bold rounded-xl transition-all flex items-center gap-1 active:scale-95"
                  >
                    <span className="material-symbols-outlined text-sm">block</span>
                    Bloquear Todo
                  </button>
                  <button
                    onClick={() => handleBulkAvailability("bloquear_mananas")}
                    className="px-3 py-2 border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-600 text-[11px] font-bold rounded-xl transition-all flex items-center gap-1 active:scale-95"
                  >
                    <span className="material-symbols-outlined text-sm">light_mode</span>
                    Bloquear Mañanas
                  </button>
                  <button
                    onClick={() => handleBulkAvailability("bloquear_tardes")}
                    className="px-3 py-2 border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 text-[11px] font-bold rounded-xl transition-all flex items-center gap-1 active:scale-95"
                  >
                    <span className="material-symbols-outlined text-sm">dark_mode</span>
                    Bloquear Tardes
                  </button>
                </div>
              </div>

              {/* Weekly Grid */}
              <div className="bg-white border border-slate-200/60 rounded-3xl shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <h3 className="font-montserrat font-bold text-slate-800 text-sm">
                      Cuadrícula de Disponibilidad Semanal
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Calendario de Lunes a Domingo. Haz clic en un bloque para editarlo, o en un espacio libre para agregar uno.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-4 text-[10px] font-bold">
                    <span className="flex items-center gap-1.5 text-emerald-600">
                      <span className="w-3.5 h-3.5 rounded bg-emerald-50 border border-emerald-200 inline-block"></span>
                      Disponible
                    </span>
                    <span className="flex items-center gap-1.5 text-sky-600">
                      <span className="w-3.5 h-3.5 rounded bg-sky-50 border border-sky-200 inline-block"></span>
                      Clase Asignada
                    </span>
                    <span className="flex items-center gap-1.5 text-rose-600">
                      <span className="w-3.5 h-3.5 rounded bg-rose-50 border border-rose-200 inline-block"></span>
                      No Disponible
                    </span>
                    <span className="flex items-center gap-1.5 text-slate-500">
                      <span className="w-3.5 h-3.5 rounded bg-slate-100 border border-slate-200 inline-block"></span>
                      Descanso
                    </span>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <div className="min-w-[900px] border-b border-slate-200 bg-slate-50/50" style={{ display: "grid", gridTemplateColumns: "80px repeat(7, 1fr)" }}>
                    <div className="p-3.5 border-r border-slate-100 flex items-center justify-center font-montserrat font-bold text-[10px] text-slate-400 uppercase tracking-wider">
                      Hora
                    </div>
                    {["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"].map((day) => (
                      <div key={day} className="p-3.5 border-r border-slate-100 text-center font-montserrat font-bold text-[11px] text-slate-600 uppercase tracking-wider">
                        {day}
                      </div>
                    ))}
                  </div>

                  <div className="relative min-w-[900px] flex h-[750px] overflow-hidden">
                    {/* Time slots column - locked exactly to the grid height */}
                    <div className="w-[80px] flex-shrink-0 flex flex-col bg-slate-50/20 border-r border-slate-100 h-full select-none justify-start">
                      {Array.from({ length: 15 }).map((_, i) => {
                        const hour = 7 + i;
                        const timeStr = `${String(hour).padStart(2, '0')}:00`;
                        return (
                          <div key={i} className="h-[50px] min-h-[50px] border-b border-slate-100/50 flex items-center justify-center font-montserrat font-semibold text-[10px] text-slate-400/90 tracking-wide relative">
                            {timeStr}
                          </div>
                        );
                      })}
                    </div>

                    {/* Day columns wrapper - layered architecture */}
                    <div className="flex-1 relative h-full bg-slate-50/5 select-none overflow-hidden">
                      {/* Layer 1: Backdrop Horizontal grid lines */}
                      <div className="absolute inset-0 pointer-events-none flex flex-col z-0">
                        {Array.from({ length: 15 }).map((_, i) => (
                          <div key={i} className="h-[50px] min-h-[50px] border-b border-slate-100/60"></div>
                        ))}
                      </div>

                      {/* Layer 2: Interactive Grid Columns */}
                      <div className="absolute inset-0 h-full z-10" style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
                        {["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"].map((day) => {
                          // 1. Obtener los bloques manuales que NO sean "clase_asignada" (ya que las clases se cargan dinámicamente)
                          const manualBlocks = availabilityBlocks.filter(
                            (b) => b.teacherId === selectedTeacherId && b.day === day && b.type !== "clase_asignada"
                          );

                          // Clases asignadas al profesor desde Supabase (por teacher_id)
                          const autoBlocks = classesList
                            .filter(c => c.teacher_id === selectedTeacherId)
                            .map(c => ({
                              id: `auto-${c.id}-${day}`,
                              teacherId: selectedTeacherId,
                              day: day,
                              type: "clase_asignada",
                              startTime: "08:00",
                              endTime: "09:00",
                              description: `Clase: ${c.title}`,
                              isAutoAssigned: true
                            }));

                          const dayBlocks = [...manualBlocks, ...autoBlocks];

                          const TYPE_STYLES = {
                            disponible: {
                              bg: "bg-gradient-to-br from-emerald-50/95 to-emerald-100/80 hover:from-emerald-100/95 hover:to-emerald-150/90 border-emerald-250/70 text-emerald-800",
                              accent: "#10b981",
                              label: "Disponible",
                              icon: "check_circle"
                            },
                            clase_asignada: {
                              bg: "bg-gradient-to-br from-sky-50/95 to-sky-100/80 hover:from-sky-100/95 hover:to-sky-150/90 border-sky-250/70 text-sky-800",
                              accent: "#0ea5e9",
                              label: "Clase Asignada",
                              icon: "school"
                            },
                            no_disponible: {
                              bg: "bg-gradient-to-br from-rose-50/95 to-rose-100/80 hover:from-rose-100/95 hover:to-rose-150/90 border-rose-250/70 text-rose-800",
                              accent: "#f43f5e",
                              label: "No Disponible",
                              icon: "event_busy"
                            },
                            dia_descanso: {
                              bg: "bg-gradient-to-br from-slate-100/95 to-slate-200/85 hover:from-slate-150/95 hover:to-slate-250/90 border-slate-300 text-slate-650",
                              accent: "#64748b",
                              label: "Día de Descanso",
                              icon: "coffee"
                            }
                          };

                          const getBlockStyle = (block) => {
                            if (block.type === "dia_descanso") {
                              return {
                                top: "2px",
                                height: "746px"
                              };
                            }
                            const toMin = t => {
                              const [h, m] = t.split(":").map(Number);
                              return h * 60 + m;
                            };
                            const startMin = toMin(block.startTime);
                            const endMin = toMin(block.endTime);
                            const startHourMin = 7 * 60;
                            const top = ((startMin - startHourMin) / 60) * 50;
                            const height = ((endMin - startMin) / 60) * 50;
                            return {
                              top: `${top + 2}px`,
                              height: `${height - 4}px`
                            };
                          };

                          return (
                            <div
                              key={day}
                              className="relative border-r border-slate-100 h-full group cursor-pointer transition-colors duration-150"
                              onClick={(e) => {
                                if (e.target !== e.currentTarget) return;
                                const rect = e.currentTarget.getBoundingClientRect();
                                const clickY = e.clientY - rect.top;
                                const hourClicked = 7 + Math.floor(clickY / 50);
                                const startStr = `${String(hourClicked).padStart(2, '0')}:00`;
                                const endStr = `${String(hourClicked + 1).padStart(2, '0')}:00`;
                                openAddBlockModal(day, startStr, endStr);
                              }}
                            >
                              {/* Hover Grid Click Placeholder Guide */}
                              <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-0">
                                {Array.from({ length: 15 }).map((_, i) => (
                                  <div
                                    key={i}
                                    style={{ position: "absolute", top: `${i * 50 + 2}px`, height: "46px", left: "2px", right: "2px" }}
                                    className="border border-dashed border-ttp-primary/20 rounded-xl bg-ttp-primary/[0.02] flex items-center justify-center text-[9px] text-ttp-primary/45 font-extrabold gap-1"
                                  >
                                    <span className="material-symbols-outlined text-xs">add</span>
                                    <span>Agregar</span>
                                  </div>
                                ))}
                              </div>

                              {dayBlocks.map((block) => {
                                const styles = TYPE_STYLES[block.type] || TYPE_STYLES.disponible;
                                const isDescanso = block.type === "dia_descanso";
                                return (
                                  <div
                                    key={block.id}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (block.isAutoAssigned) {
                                        showToast(`ℹ️ "${block.description}" es una clase asignada desde Horarios. Adminístrala en la sección de Horarios.`);
                                        return;
                                      }
                                      openEditBlockModal(block);
                                    }}
                                    style={getBlockStyle(block)}
                                    className={`absolute left-1 right-1 rounded-2xl p-2.5 border text-left flex flex-col justify-between shadow-[0_2px_8px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_20px_rgba(0,0,0,0.07)] hover:-translate-y-0.5 transition-all duration-200 group/card cursor-pointer active:scale-[0.99] z-10 overflow-hidden ${styles.bg}`}
                                  >
                                    {/* Left accented color bar */}
                                    <div 
                                      className="absolute left-0 top-0 bottom-0 w-[4px]"
                                      style={{ backgroundColor: styles.accent }}
                                    />
                                    
                                    <div className="min-w-0 pl-1.5">
                                      <div className="flex items-start justify-between gap-1 flex-wrap">
                                        <span className="text-[10px] font-extrabold tracking-wide uppercase flex items-center gap-1 text-slate-800">
                                          <span className="material-symbols-outlined text-[13px]" style={{ fontVariationSettings: "'FILL' 1", color: styles.accent }}>
                                            {styles.icon}
                                          </span>
                                          {styles.label}
                                        </span>
                                        <span className="text-[9px] font-bold bg-slate-900/5 px-1.5 py-0.5 rounded-full text-slate-700 flex-shrink-0">
                                          {block.startTime} - {block.endTime}
                                        </span>
                                      </div>
                                      {block.description && (
                                        <p className="text-[10px] font-semibold mt-1.5 text-slate-650 line-clamp-3 leading-snug">
                                          {block.description}
                                        </p>
                                      )}
                                    </div>
                                    {isDescanso && (
                                      <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(45deg,#e2e8f0_25%,transparent_25%,transparent_50%,#e2e8f0_50%,#e2e8f0_75%,transparent_75%,transparent)] bg-[length:16px_16px] opacity-10"></div>
                                    )}
                                    <span className="text-[9px] font-bold text-slate-700/80 bg-white/70 backdrop-blur-sm shadow-sm border border-slate-200/50 px-2.5 py-1 rounded-lg opacity-0 group-hover/card:opacity-100 transition-all duration-200 self-end uppercase scale-90 tracking-wide mt-2">
                                      {block.isAutoAssigned ? "Horario Oficial" : "Editar"}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ===== MODAL: Agregar Maestro ===== */}
      {addModal && (
        <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(15,23,42,0.7)", backdropFilter: "blur(4px)" }} onClick={(e) => { if (e.target === e.currentTarget) setAddModal(false); }}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-100 modal-card">
            <div className="flex items-center justify-between px-7 py-5 border-b border-slate-100 bg-slate-50">
              <div>
                <h2 className="font-montserrat font-bold text-slate-800">Agregar Maestro</h2>
                <p className="text-xs text-slate-400 font-medium">Nuevo integrante del equipo docente</p>
              </div>
              <button onClick={() => setAddModal(false)} className="w-8 h-8 rounded-xl bg-slate-200 hover:bg-slate-300 flex items-center justify-center transition-colors">
                <span className="material-symbols-outlined text-slate-600 text-lg">close</span>
              </button>
            </div>
            <form 
              onSubmit={handleAdd} 
              onKeyDown={(e) => {
                if (e.key === "Enter" && e.target.tagName === "INPUT") {
                  e.preventDefault();
                }
              }}
              className="p-7 space-y-4"
            >
              <div className="grid grid-cols-2 gap-4 max-h-[55vh] overflow-y-auto overflow-x-hidden pr-3">
                <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Nombre Completo *</label>
                  <input required autoFocus value={formData.name} onChange={(e) => {
                    const newName = e.target.value;
                    setFormData(p => {
                      const prevAutoUser = getAutoUsername(p.name);
                      const shouldOverwrite = !p.ttp_user || p.ttp_user === prevAutoUser;
                      const autoUser = getAutoUsername(newName);

                      return {
                        ...p,
                        name: newName,
                        ttp_user: shouldOverwrite ? autoUser : p.ttp_user
                      };
                    });
                  }} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-ttp-primary/20" placeholder="Lic. Nombre Apellido" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Email *</label>
                  <input required type="text" value={formData.email} onChange={(e) => setFormData(p => ({ ...p, email: e.target.value }))} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-ttp-primary/20" placeholder="correo@ttp.mx" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Teléfono</label>
                  <input value={formData.phone} onChange={(e) => setFormData(p => ({ ...p, phone: e.target.value }))} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-ttp-primary/20" placeholder="+52 55 0000 0000" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Especialidad *</label>
                  <input required value={formData.specialty} onChange={(e) => setFormData(p => ({ ...p, specialty: e.target.value }))} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-ttp-primary/20" placeholder="Business English, TOEFL..." />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Tarifa por Hora (MXN) *</label>
                  <input required type="number" value={formData.rate} onChange={(e) => setFormData(p => ({ ...p, rate: e.target.value }))} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-ttp-primary/20" placeholder="250" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Fecha de Nacimiento</label>
                  <input type="date" value={formData.birthdate} onChange={(e) => setFormData(p => ({ ...p, birthdate: e.target.value }))} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-ttp-primary/20 cursor-pointer" />
                </div>
                <div className="col-span-2 md:col-span-1">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Fecha de Ingreso</label>
                  <input type="date" value={formData.since} onChange={(e) => setFormData(p => ({ ...p, since: e.target.value }))} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-ttp-primary/20 cursor-pointer" />
                </div>

                {/* Subsección: Credenciales Burlington */}
                <div className="col-span-2 border-t border-slate-100 pt-3 mt-1 space-y-2">
                  <span className="text-[10px] font-bold text-ttp-primary uppercase tracking-wider block">Credenciales Burlington English</span>
                  <div className="grid grid-cols-2 gap-3 bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Usuario Burlington</label>
                      <input value={formData.burlington_user} onChange={(e) => setFormData(p => ({ ...p, burlington_user: e.target.value }))} className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-ttp-primary/10" placeholder="user.burlington" />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Contraseña Burlington</label>
                      <input type="text" value={formData.burlington_pass} onChange={(e) => setFormData(p => ({ ...p, burlington_pass: e.target.value }))} className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-ttp-primary/10" placeholder="••••••••" />
                    </div>
                  </div>
                </div>

                {/* Subsección: Credenciales TTP Hub */}
                <div className="col-span-2 border-t border-slate-100 pt-3 mt-1 space-y-2">
                  <span className="text-[10px] font-bold text-ttp-club uppercase tracking-wider block">Credenciales TTP Hub Portal</span>
                  <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Usuario TTP Hub</label>
                        <input value={formData.ttp_user} onChange={(e) => setFormData(p => ({ ...p, ttp_user: e.target.value }))} className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-ttp-primary/10" placeholder="teacher.name" />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Contraseña TTP Hub</label>
                        <div className="flex gap-2 min-w-0 items-center">
                          <input type="text" value={formData.ttp_pass} onChange={(e) => setFormData(p => ({ ...p, ttp_pass: e.target.value }))} className="flex-1 min-w-0 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-ttp-primary/10" placeholder="••••••••" />
                          <button type="button" onClick={handleGenerateRandomPassword} className="flex-shrink-0 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 rounded-lg text-[10px] font-bold flex items-center gap-1 active:scale-95 transition-all">
                            <span className="material-symbols-outlined text-xs">key</span> Generar
                          </button>
                        </div>
                      </div>
                    </div>
                    
                    <button type="button" onClick={() => handleCopyCredentials(formData.name)} className="w-full py-2 border border-dashed border-ttp-club/30 bg-ttp-club/5 hover:bg-ttp-club/10 text-ttp-club text-[10px] font-bold rounded-xl flex items-center justify-center gap-1 active:scale-95 transition-all">
                      <span className="material-symbols-outlined text-xs">content_copy</span> Copiar Credenciales de Acceso
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setAddModal(false)} className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl font-semibold text-sm hover:bg-slate-50 transition-all">Cancelar</button>
                <button type="submit" className="flex-1 py-2.5 bg-ttp-primary text-white rounded-xl font-bold text-sm hover:opacity-90 active:scale-95 transition-all shadow-md shadow-ttp-primary/20">Agregar Maestro</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===== MODAL: Editar Maestro ===== */}
      {editModal && (
        <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(15,23,42,0.7)", backdropFilter: "blur(4px)" }} onClick={(e) => { if (e.target === e.currentTarget) setEditModal(null); }}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-100 modal-card">
            <div className="flex items-center justify-between px-7 py-5 border-b border-slate-100 bg-slate-50">
              <div>
                <h2 className="font-montserrat font-bold text-slate-800">Editar Maestro</h2>
                <p className="text-xs text-slate-400 font-medium">{editModal.name}</p>
              </div>
              <button onClick={() => setEditModal(null)} className="w-8 h-8 rounded-xl bg-slate-200 hover:bg-slate-300 flex items-center justify-center transition-colors">
                <span className="material-symbols-outlined text-slate-600 text-lg">close</span>
              </button>
            </div>
            <form 
              onSubmit={handleEdit} 
              onKeyDown={(e) => {
                if (e.key === "Enter" && e.target.tagName === "INPUT") {
                  e.preventDefault();
                }
              }}
              className="p-7 space-y-4"
            >
              <div className="grid grid-cols-2 gap-4 max-h-[55vh] overflow-y-auto overflow-x-hidden pr-3">
                <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Nombre Completo</label>
                  <input required autoFocus value={formData.name} onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-ttp-primary/20" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Email</label>
                  <input required type="text" value={formData.email} onChange={(e) => setFormData(p => ({ ...p, email: e.target.value }))} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-ttp-primary/20" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Teléfono</label>
                  <input value={formData.phone} onChange={(e) => setFormData(p => ({ ...p, phone: e.target.value }))} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-ttp-primary/20" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Especialidad</label>
                  <input required value={formData.specialty} onChange={(e) => setFormData(p => ({ ...p, specialty: e.target.value }))} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-ttp-primary/20" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Tarifa/h (MXN)</label>
                  <input required type="number" value={formData.rate} onChange={(e) => setFormData(p => ({ ...p, rate: e.target.value }))} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-ttp-primary/20" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Fecha de Nacimiento</label>
                  <input type="date" value={formData.birthdate} onChange={(e) => setFormData(p => ({ ...p, birthdate: e.target.value }))} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-ttp-primary/20 cursor-pointer" />
                </div>
                <div className="col-span-2 md:col-span-1">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Fecha de Ingreso</label>
                  <input type="date" value={formData.since} onChange={(e) => setFormData(p => ({ ...p, since: e.target.value }))} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-ttp-primary/20 cursor-pointer" />
                </div>

                {/* Subsección: Credenciales Burlington */}
                <div className="col-span-2 border-t border-slate-100 pt-3 mt-1 space-y-2">
                  <span className="text-[10px] font-bold text-ttp-primary uppercase tracking-wider block">Credenciales Burlington English</span>
                  <div className="grid grid-cols-2 gap-3 bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Usuario Burlington</label>
                      <input value={formData.burlington_user} onChange={(e) => setFormData(p => ({ ...p, burlington_user: e.target.value }))} className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-ttp-primary/10" placeholder="user.burlington" />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Contraseña Burlington</label>
                      <input type="text" value={formData.burlington_pass} onChange={(e) => setFormData(p => ({ ...p, burlington_pass: e.target.value }))} className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-ttp-primary/10" placeholder="••••••••" />
                    </div>
                  </div>
                </div>

                {/* Subsección: Credenciales TTP Hub */}
                <div className="col-span-2 border-t border-slate-100 pt-3 mt-1 space-y-2">
                  <span className="text-[10px] font-bold text-ttp-club uppercase tracking-wider block">Credenciales TTP Hub Portal</span>
                  <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Usuario TTP Hub</label>
                        <input value={formData.ttp_user} onChange={(e) => setFormData(p => ({ ...p, ttp_user: e.target.value }))} className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-ttp-primary/10" placeholder="teacher.name" />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Contraseña TTP Hub</label>
                        <div className="flex gap-2 min-w-0 items-center">
                          <input type="text" value={formData.ttp_pass} onChange={(e) => setFormData(p => ({ ...p, ttp_pass: e.target.value }))} className="flex-1 min-w-0 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-ttp-primary/10" placeholder="••••••••" />
                          <button type="button" onClick={handleGenerateRandomPassword} className="flex-shrink-0 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 rounded-lg text-[10px] font-bold flex items-center gap-1 active:scale-95 transition-all">
                            <span className="material-symbols-outlined text-xs">key</span> Generar
                          </button>
                        </div>
                      </div>
                    </div>
                    
                    <button type="button" onClick={() => handleCopyCredentials(formData.name)} className="w-full py-2 border border-dashed border-ttp-club/30 bg-ttp-club/5 hover:bg-ttp-club/10 text-ttp-club text-[10px] font-bold rounded-xl flex items-center justify-center gap-1 active:scale-95 transition-all">
                      <span className="material-symbols-outlined text-xs">content_copy</span> Copiar Credenciales de Acceso
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setEditModal(null)} className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl font-semibold text-sm hover:bg-slate-50 transition-all">Cancelar</button>
                <button type="submit" className="flex-1 py-2.5 bg-ttp-primary text-white rounded-xl font-bold text-sm hover:opacity-90 active:scale-95 transition-all shadow-md shadow-ttp-primary/20">Guardar Cambios</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===== MODAL: Suspender / Reactivar ===== */}
      <ConfirmDialog
        open={!!suspendModal}
        title={suspendModal ? (suspendModal.status === "activo" ? "¿Suspender Maestro?" : "¿Reactivar Maestro?") : ""}
        description={suspendModal ? (
          suspendModal.status === "activo"
            ? `${suspendModal.name} perderá acceso al sistema y no podrá impartir clases.`
            : `${suspendModal.name} recuperará su acceso y podrá impartir clases nuevamente.`
        ) : ""}
        confirmLabel={suspendModal?.status === "activo" ? "Sí, Suspender" : "Sí, Reactivar"}
        variant={suspendModal?.status === "activo" ? "warning" : "info"}
        onConfirm={handleToggleSuspend}
        onCancel={() => setSuspendModal(null)}
      />

      {/* ===== MODAL: Eliminar Maestro ===== */}
      {deleteModal && (
        <div
          className="modal-backdrop fixed inset-0 z-[9999] flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(15,23,42,0.6)", backdropFilter: "blur(6px)" }}
          onClick={(e) => { if (e.target === e.currentTarget) { setDeleteModal(null); setDeleteConfirm(""); } }}
        >
          <div
            className="modal-card relative bg-white rounded-3xl shadow-2xl w-full max-w-sm border border-slate-100 overflow-hidden"
          >
            <div className="h-1 w-full bg-gradient-to-r from-rose-500 to-rose-400" />
            <div className="p-7 space-y-5 text-center">
              <div className="w-16 h-16 rounded-2xl bg-rose-50 mx-auto flex items-center justify-center ring-4 ring-white shadow-sm">
                <span className="material-symbols-outlined text-3xl text-rose-500" style={{ fontVariationSettings: "'FILL' 1" }}>delete_forever</span>
              </div>
              <div className="space-y-2">
                <h3 className="font-montserrat font-bold text-slate-800 text-xl">Eliminar Maestro</h3>
                <p className="text-sm text-slate-500 leading-relaxed">
                  Esta acción es <strong className="text-rose-600">permanente e irreversible</strong>.
                </p>
                <p className="text-[11px] font-semibold leading-relaxed border rounded-xl px-3 py-2 mt-2 bg-rose-50 border-rose-100 text-rose-600">
                  ⚠️ Esta acción no se puede deshacer.
                </p>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 text-left">
                  Escribe el nombre del maestro para confirmar
                </label>
                <input
                  autoFocus
                  value={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.value)}
                  placeholder={deleteModal.name}
                  className="w-full px-4 py-2.5 border border-rose-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-200"
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => { setDeleteModal(null); setDeleteConfirm(""); }}
                  className="flex-1 py-3 border border-slate-200 text-slate-500 rounded-2xl font-semibold text-sm hover:bg-slate-50 active:scale-95 transition-all duration-150"
                >Cancelar</button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleteConfirm.trim() !== deleteModal.name.trim()}
                  className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-bold text-sm active:scale-95 transition-all duration-150 shadow-lg shadow-rose-600/20 disabled:opacity-40 disabled:cursor-not-allowed"
                >Eliminar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== MODAL: Gestionar Bloque de Disponibilidad ===== */}
      {blockModal.open && (
        <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(15,23,42,0.7)", backdropFilter: "blur(4px)" }} onClick={(e) => { if (e.target === e.currentTarget) setBlockModal({ open: false, mode: "add", block: null }); }}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100 modal-card">
            <div className="flex items-center justify-between px-7 py-5 border-b border-slate-100 bg-slate-50">
              <div>
                <h2 className="font-montserrat font-bold text-slate-800">
                  {blockModal.mode === "add" ? "Agregar Bloque" : "Editar Bloque"}
                </h2>
                <p className="text-xs text-slate-400 font-medium">Configura el horario del docente</p>
              </div>
              <button onClick={() => setBlockModal({ open: false, mode: "add", block: null })} className="w-8 h-8 rounded-xl bg-slate-200 hover:bg-slate-300 flex items-center justify-center transition-colors">
                <span className="material-symbols-outlined text-slate-600 text-lg">close</span>
              </button>
            </div>
            <form onSubmit={handleSaveBlock} className="p-7 space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Día de la Semana</label>
                <select
                  value={blockForm.day}
                  onChange={(e) => setBlockForm(p => ({ ...p, day: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-ttp-primary/20"
                >
                  {["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"].map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Estado / Tipo de Bloque</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "disponible", label: "Disponible", color: "border-emerald-200 text-emerald-700 bg-emerald-50/50" },
                    { id: "no_disponible", label: "No Disponible", color: "border-rose-200 text-rose-700 bg-rose-50/50" },
                    { id: "dia_descanso", label: "Día de Descanso", color: "border-slate-250 text-slate-650 bg-slate-100/50" }
                  ].map(item => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setBlockForm(p => ({ ...p, type: item.id }))}
                      className={`p-3 border rounded-xl font-bold text-[10px] flex flex-col items-center justify-center gap-1 transition-all active:scale-[0.98] ${
                        blockForm.type === item.id 
                          ? `${item.color} ring-2 ring-ttp-primary border-transparent` 
                          : "border-slate-200 text-slate-500 bg-white hover:bg-slate-50"
                      }`}
                    >
                      <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>
                        {item.id === "disponible" ? "check_circle" : item.id === "no_disponible" ? "event_busy" : "coffee"}
                      </span>
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {blockForm.type !== "dia_descanso" && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Hora de Inicio</label>
                    <input
                      type="time"
                      required
                      value={blockForm.startTime}
                      onChange={(e) => setBlockForm(p => ({ ...p, startTime: e.target.value }))}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-ttp-primary/20 cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Hora de Fin</label>
                    <input
                      type="time"
                      required
                      value={blockForm.endTime}
                      onChange={(e) => setBlockForm(p => ({ ...p, endTime: e.target.value }))}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-ttp-primary/20 cursor-pointer"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Descripción / Motivo</label>
                <textarea
                  value={blockForm.description}
                  onChange={(e) => setBlockForm(p => ({ ...p, description: e.target.value }))}
                  placeholder={blockForm.type === "no_disponible" ? "Ej. Almuerzo, cita médica..." : "Detalles o notas..."}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-ttp-primary/20 min-h-[60px]"
                />
              </div>

              <div className="flex gap-3 pt-2">
                {blockModal.mode === "edit" && (
                  <button
                    type="button"
                    onClick={() => handleDeleteBlock(blockModal.block.id)}
                    className="px-4 py-2.5 bg-rose-50 border border-rose-200 text-rose-600 rounded-xl font-semibold text-sm hover:bg-rose-100 active:scale-95 transition-all flex items-center justify-center"
                    title="Eliminar bloque"
                  >
                    <span className="material-symbols-outlined text-base">delete</span>
                  </button>
                )}
                <button type="button" onClick={() => setBlockModal({ open: false, mode: "add", block: null })} className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl font-semibold text-sm hover:bg-slate-50 transition-all">Cancelar</button>
                <button type="submit" className="flex-1 py-2.5 bg-ttp-primary text-white rounded-xl font-bold text-sm hover:opacity-90 active:scale-95 transition-all shadow-md shadow-ttp-primary/20">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ===== MODAL: Enviar Correo a Maestro ===== */}
      {emailModalTeacher && (
        <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(15,23,42,0.7)", backdropFilter: "blur(4px)" }} onClick={(e) => { if (e.target === e.currentTarget) setEmailModalTeacher(null); }}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100 modal-card">
            <div className="flex items-center justify-between px-7 py-5 border-b border-slate-100 bg-slate-50">
              <div>
                <h2 className="font-montserrat font-bold text-slate-800">Enviar Correo Electrónico</h2>
                <p className="text-xs text-slate-400 font-medium">Destinatario: {emailModalTeacher.name}</p>
              </div>
              <button onClick={() => setEmailModalTeacher(null)} className="w-8 h-8 rounded-xl bg-slate-200 hover:bg-slate-300 flex items-center justify-center transition-colors">
                <span className="material-symbols-outlined text-slate-600 text-lg">close</span>
              </button>
            </div>
            
            <form onSubmit={handleSendEmail} className="p-7 space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Para (Correo electrónico)</label>
                <input type="text" readOnly value={emailModalTeacher.email} className="w-full px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-500 cursor-not-allowed focus:outline-none" />
              </div>
              
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Asunto *</label>
                <input required type="text" value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} disabled={emailSending} placeholder="Ej. Actualización de horario, Aviso importante..." className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-ttp-primary/20" />
              </div>
              
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Mensaje *</label>
                <textarea required value={emailBody} onChange={(e) => setEmailBody(e.target.value)} disabled={emailSending} placeholder="Escribe el cuerpo del correo aquí..." className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-ttp-primary/20 min-h-[150px] leading-relaxed" />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" disabled={emailSending} onClick={() => setEmailModalTeacher(null)} className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl font-semibold text-sm hover:bg-slate-50 transition-all">Cancelar</button>
                <button type="submit" disabled={emailSending} className="flex-1 py-2.5 bg-ttp-primary text-white rounded-xl font-bold text-sm hover:opacity-90 active:scale-95 transition-all shadow-md shadow-ttp-primary/20 flex items-center justify-center gap-1.5">
                  {emailSending ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Enviando...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-sm">send</span>
                      <span>Enviar Correo</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
