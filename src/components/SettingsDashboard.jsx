"use client";

import React, { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import ConfirmDialog from "@/components/ConfirmDialog";
import { toast } from "sonner";
import { supabase } from "@/utils/supabaseClient";

// Definido FUERA del componente para que React no lo recree en cada render
function ModalWrapper({ onClose, children }) {
  return (
    <div
      className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(15,23,42,0.7)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100 modal-card">
        {children}
      </div>
    </div>
  );
}

const emptyCourse = {
  name: "", level: "", customLevel: "",
  durationType: "months",   // "months" | "dates"
  duration: "",             // usado cuando durationType === "months"
  courseStartDate: "",      // usado cuando durationType === "dates"
  courseEndDate: "",
  price: "", classType: "grupal", allowedTeachers: []
};


const CEFR_LEVELS = [
  { value: "A1",    label: "A1 — Principiante" },
  { value: "A2",    label: "A2 — Básico" },
  { value: "A1-A2", label: "A1–A2 — Principiante / Básico" },
  { value: "B1",    label: "B1 — Intermedio" },
  { value: "B2",    label: "B2 — Intermedio Alto" },
  { value: "B1-B2", label: "B1–B2 — Intermedio" },
  { value: "C1",    label: "C1 — Avanzado" },
  { value: "C2",    label: "C2 — Maestría" },
  { value: "C1-C2", label: "C1–C2 — Avanzado / Maestría" },
  { value: "A1-C2", label: "A1–C2 — Todos los niveles" },
  { value: "custom", label: "Otro (personalizado)" },
];

const DURATION_OPTIONS = [
  "1 mes", "2 meses", "3 meses", "4 meses",
  "5 meses", "6 meses", "8 meses", "10 meses",
  "12 meses", "Mensual (recurrente)", "Semestral", "Anual",
];

const emptyGroup  = { code: "", course: "", teacher_id: "", schedule: "", capacity: "" };

export default function SettingsDashboard() {
  const [activeTab, setActiveTab]       = useState("cursos");
  const [deleteConfirmModal, setDeleteConfirmModal] = useState(null); // { titleType: '', name: '', onConfirm: fn }

  // ── Cursos ──────────────────────────────────────────────────────────────────
  const [courses, setCourses]             = useState([]);
  const [addCourseModal, setAddCourseModal] = useState(false);
  const [editCourseModal, setEditCourseModal] = useState(null);
  const [courseForm, setCourseForm]       = useState(emptyCourse);

  // ── Grupos ──────────────────────────────────────────────────────────────────
  const [groups, setGroups]             = useState([]);
  const [addGroupModal, setAddGroupModal] = useState(false);
  const [editGroupModal, setEditGroupModal] = useState(null);
  const [groupForm, setGroupForm]       = useState(emptyGroup);

  // ── Usuarios ────────────────────────────────────────────────────────────────
  const [users, setUsers]               = useState([]);
  const [addUserModal, setAddUserModal] = useState(false);
  const [userForm, setUserForm]         = useState({ name: "", email: "", role: "Teacher" });

  // ── Maestros disponibles (para seleccionar en cursos) ───────────────────────
  const [teachersList, setTeachersList] = useState([]);

  // ── Correo de Sistema ───────────────────────────────────────────────────────
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPass, setSmtpPass] = useState("");
  const [showSmtpPass, setShowSmtpPass] = useState(false);
  const [savingSmtp, setSavingSmtp] = useState(false);

  const handleSaveSmtp = async (e) => {
    e.preventDefault();
    setSavingSmtp(true);
    try {
      const { error: errUser } = await supabase
        .from("system_settings")
        .upsert({ key: "GMAIL_USER", value: smtpUser.trim().toLowerCase() });

      const { error: errPass } = await supabase
        .from("system_settings")
        .upsert({ key: "GMAIL_PASS", value: smtpPass.trim().replace(/\s/g, "") });

      if (errUser || errPass) throw new Error(errUser?.message || errPass?.message);
      showToast("✅ Configuración de correo guardada e integrada.");
    } catch (err) {
      showToast(`⛔ Error: Asegúrate de ejecutar el script SQL en tu panel de Supabase para activar esta tabla.`);
    } finally {
      setSavingSmtp(false);
    }
  };

  const showToast = (msg) => {
    // Detect type from emoji prefix
    if (msg.startsWith("✅")) toast.success(msg.replace("✅ ", ""));
    else if (msg.startsWith("✏️")) toast.success(msg.replace("✏️ ", ""));
    else if (msg.startsWith("🗑️")) toast.error(msg.replace("🗑️ ", ""));
    else if (msg.startsWith("📦")) toast.warning(msg.replace("📦 ", ""));
    else if (msg.startsWith("⛔")) toast.warning(msg.replace("⛔ ", ""));
    else toast(msg);
  };

  useEffect(() => {
    const load = async () => {
      const [{ data: c }, { data: g }, { data: u }, { data: t }] = await Promise.all([
        supabase.from("courses").select("*").order("created_at", { ascending: false }),
        supabase.from("groups").select("*").order("created_at", { ascending: false }),
        supabase.from("system_users").select("*").order("created_at", { ascending: false }),
        supabase.from("teachers").select("id, name, email, specialty, status"),
      ]);
      if (c) setCourses(c);
      if (g) setGroups(g);
      if (u) setUsers(u);
      if (t) setTeachersList(t);

      // Cargar configuraciones de correo SMTP
      try {
        const { data: s } = await supabase.from("system_settings").select("*");
        if (s) {
          const uSetting = s.find(item => item.key === "GMAIL_USER")?.value || "";
          const pSetting = s.find(item => item.key === "GMAIL_PASS")?.value || "";
          setSmtpUser(uSetting);
          setSmtpPass(pSetting);
        }
      } catch (e) {}
    };
    load();
  }, []);

  const tabs = [
    { id: "cursos",   label: "Cursos",            icon: "menu_book" },
    { id: "grupos",   label: "Grupos",             icon: "groups" },
    { id: "usuarios", label: "Usuarios y Accesos", icon: "manage_accounts" },
    { id: "correo",   label: "Correo de Sistema",  icon: "mail" },
  ];

  // ── Handlers Cursos ─────────────────────────────────────────────────────────
  const handleAddCourse = async (e) => {
    e.preventDefault();
    const { data, error } = await supabase.from("courses").insert([{
      name: courseForm.name,
      level: courseForm.level || "",
      custom_level: courseForm.customLevel || "",
      duration_type: courseForm.durationType || "months",
      duration: courseForm.duration || "",
      course_start_date: courseForm.courseStartDate || null,
      course_end_date: courseForm.courseEndDate || null,
      price: Number(courseForm.price) || 0,
      class_type: courseForm.classType || "grupal",
      allowed_teachers: courseForm.allowedTeachers || [],
      status: "activo",
    }]).select().single();
    if (error) { showToast("⛔ Error al crear curso."); return; }
    setCourses(p => [data, ...p]);
    setAddCourseModal(false);
    setCourseForm(emptyCourse);
    showToast("✅ Curso creado exitosamente.");
  };
  const handleEditCourse = async (e) => {
    e.preventDefault();
    const { data, error } = await supabase.from("courses").update({
      name: courseForm.name,
      level: courseForm.level || "",
      custom_level: courseForm.customLevel || "",
      duration_type: courseForm.durationType || "months",
      duration: courseForm.duration || "",
      course_start_date: courseForm.courseStartDate || null,
      course_end_date: courseForm.courseEndDate || null,
      price: Number(courseForm.price) || 0,
      class_type: courseForm.classType || "grupal",
      allowed_teachers: courseForm.allowedTeachers || [],
    }).eq("id", editCourseModal.id).select().single();
    if (error) { showToast("⛔ Error al actualizar curso."); return; }
    setCourses(p => p.map(c => c.id === data.id ? data : c));
    setEditCourseModal(null);
    showToast("✏️ Curso actualizado.");
  };
  const handleArchiveCourse = async (c) => {
    const next = c.status === "activo" ? "archivado" : "activo";
    const { error } = await supabase.from("courses").update({ status: next }).eq("id", c.id);
    if (error) { showToast("⛔ Error al archivar curso."); return; }
    setCourses(p => p.map(x => x.id === c.id ? { ...x, status: next } : x));
    showToast(next === "archivado" ? `📦 Curso "${c.name}" archivado.` : `✅ Curso "${c.name}" reactivado.`);
  };
  const handleDeleteCourse = (c) => {
    setDeleteConfirmModal({
      titleType: "Curso",
      name: c.name,
      onConfirm: async () => {
        const { error } = await supabase.from("courses").delete().eq("id", c.id);
        if (error) { showToast("⛔ Error al eliminar curso."); return; }
        setCourses(p => p.filter(x => x.id !== c.id));
        showToast(`🗑️ Curso "${c.name}" eliminado.`);
      }
    });
  };

  // Togglear maestro en la lista de allowedTeachers del courseForm
  const toggleTeacherInCourse = (teacherId) => {
    setCourseForm(prev => {
      const current = prev.allowedTeachers || [];
      return {
        ...prev,
        allowedTeachers: current.includes(teacherId)
          ? current.filter(id => id !== teacherId)
          : [...current, teacherId]
      };
    });
  };

  // Label de nivel mostrado (maneja nivel personalizado)
  const displayLevel = (c) => {
    if (!c) return "";
    if (c.level === "none" || !c.level) return "";
    if (c.level === "custom") return c.customLevel || "Personalizado";
    return c.level;
  };

  // ── Handlers Grupos ─────────────────────────────────────────────────────────
  const handleAddGroup = async (e) => {
    e.preventDefault();
    const { data, error } = await supabase.from("groups").insert([{
      code: groupForm.code,
      course: groupForm.course,
      teacher_id: groupForm.teacher_id || null,
      schedule: groupForm.schedule,
      capacity: Number(groupForm.capacity) || 15,
      enrolled: 0,
      status: "activo",
    }]).select().single();
    if (error) { showToast("⛔ Error al crear grupo."); return; }
    setGroups(p => [data, ...p]);
    setAddGroupModal(false);
    setGroupForm(emptyGroup);
    showToast("✅ Grupo creado exitosamente.");
  };
  const handleEditGroup = async (e) => {
    e.preventDefault();
    const { data, error } = await supabase.from("groups").update({
      code: groupForm.code,
      course: groupForm.course,
      teacher_id: groupForm.teacher_id || null,
      schedule: groupForm.schedule,
      capacity: Number(groupForm.capacity) || 15,
    }).eq("id", editGroupModal.id).select().single();
    if (error) { showToast("⛔ Error al actualizar grupo."); return; }
    setGroups(p => p.map(g => g.id === data.id ? data : g));
    setEditGroupModal(null);
    showToast("✏️ Grupo actualizado.");
  };
  const handleDeleteGroup = (g) => {
    setDeleteConfirmModal({
      titleType: "Grupo",
      name: g.code,
      onConfirm: async () => {
        const { error } = await supabase.from("groups").delete().eq("id", g.id);
        if (error) { showToast("⛔ Error al eliminar grupo."); return; }
        setGroups(p => p.filter(x => x.id !== g.id));
        showToast(`🗑️ Grupo ${g.code} eliminado.`);
      }
    });
  };

  // ── Handlers Usuarios ───────────────────────────────────────────────────────
  const handleAddUser = async (e) => {
    e.preventDefault();
    const { data, error } = await supabase.from("system_users").insert([{
      name: userForm.name,
      email: userForm.email,
      role: userForm.role,
      status: "activo",
    }]).select().single();
    if (error) { showToast("⛔ Error al crear usuario."); return; }
    setUsers(p => [data, ...p]);
    setAddUserModal(false);
    setUserForm({ name: "", email: "", role: "Teacher" });
    showToast("✅ Usuario creado y acceso habilitado.");
  };
  const handleToggleUser = async (u) => {
    const next = u.status === "activo" ? "inactivo" : "activo";
    const { error } = await supabase.from("system_users").update({ status: next }).eq("id", u.id);
    if (error) { showToast("⛔ Error al actualizar usuario."); return; }
    setUsers(p => p.map(x => x.id === u.id ? { ...x, status: next } : x));
    showToast(next === "inactivo" ? `⛔ Acceso de ${u.name} desactivado.` : `✅ Acceso de ${u.name} reactivado.`);
  };
  const handleDeleteUser = (u) => {
    setDeleteConfirmModal({
      titleType: "Usuario",
      name: u.name,
      onConfirm: async () => {
        const { error } = await supabase.from("system_users").delete().eq("id", u.id);
        if (error) { showToast("⛔ Error al eliminar usuario."); return; }
        setUsers(p => p.filter(x => x.id !== u.id));
        showToast(`🗑️ Usuario "${u.name}" eliminado.`);
      }
    });
  };

  const roleColor = (role) => role === "Admin"
    ? "bg-ttp-primary/10 text-ttp-primary border-ttp-primary/20"
    : role === "Teacher"
    ? "bg-sky-50 text-sky-600 border-sky-200"
    : "bg-slate-100 text-slate-500 border-slate-200";

  const inputCls = "w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-ttp-primary/20 bg-white";
  const labelCls = "block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1";

  // Obtener nombre completo de un maestro por su id
  const teacherName = (id) => {
    const t = teachersList.find(t => t.id === id);
    if (!t) return id;
    return `${t.firstName || t.name || ""} ${t.lastName || ""}`.trim() || t.email || id;
  };

  return (
    <div className="flex min-h-screen bg-slate-50 font-inter relative">
      <Sidebar activeName="Configuración" />

      <main className="flex-1 md:ml-64 min-h-screen flex flex-col">
        <header className="flex justify-between items-center w-full px-6 md:px-10 h-16 sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200">
          <div>
            <h2 className="font-montserrat font-bold text-slate-800 text-lg">Configuración</h2>
            <p className="text-xs text-slate-400 font-medium">Cursos, grupos y usuarios del sistema</p>
          </div>
        </header>

        <div className="p-6 md:p-10 max-w-7xl mx-auto w-full space-y-6">
          <div className="bg-white border border-slate-200/60 rounded-3xl shadow-sm overflow-hidden">
            {/* Tabs */}
            <div className="flex border-b border-slate-100 bg-slate-50/50">
              {tabs.map((tab) => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-6 py-4 font-semibold text-sm transition-all relative ${activeTab === tab.id ? "text-ttp-primary font-bold" : "text-slate-500 hover:text-slate-800"}`}>
                  <span className="material-symbols-outlined text-lg">{tab.icon}</span>
                  {tab.label}
                  {activeTab === tab.id && <div className="absolute bottom-0 left-4 right-4 h-0.5 bg-ttp-primary rounded-full" />}
                </button>
              ))}
            </div>

            <div className="p-6">
              {/* ── CURSOS ─────────────────────────────────────────────────────── */}
              {activeTab === "cursos" && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="font-montserrat font-bold text-slate-800">Catálogo de Cursos</h3>
                    <button onClick={() => { setCourseForm(emptyCourse); setAddCourseModal(true); }}
                      className="bg-ttp-primary text-white px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-md shadow-ttp-primary/20">
                      <span className="material-symbols-outlined text-base">add</span> Nuevo Curso
                    </button>
                  </div>

                  {courses.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
                      <span className="material-symbols-outlined text-4xl opacity-30">menu_book</span>
                      <p className="text-sm font-semibold">No hay cursos en el catálogo. Crea el primero.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {courses.map((c) => (
                        <div key={c.id} className={`flex items-center justify-between p-4 rounded-2xl border transition-colors ${c.status === "archivado" ? "bg-slate-50/50 border-slate-100 opacity-60" : "bg-white border-slate-200/60"}`}>
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-ttp-primary/10 flex items-center justify-center flex-shrink-0">
                              <span className="material-symbols-outlined text-ttp-primary text-lg">
                                {c.classType === "privada" ? "person" : c.classType === "club" ? "record_voice_over" : "groups"}
                              </span>
                            </div>
                            <div>
                              <p className="font-bold text-slate-800 text-sm">{c.name}</p>
                              <p className="text-[11px] text-slate-400 font-medium">
                                {displayLevel(c) && `Nivel: ${displayLevel(c)} · `}{c.duration && `${c.duration} · `}
                                {c.price ? `$${Number(c.price).toLocaleString()} MXN` : ""}
                                {c.classType && ` · ${c.classType === "grupal" ? "Grupal" : c.classType === "privada" ? "Privado" : "Conv. Club"}`}
                              </p>
                              {c.allowedTeachers && c.allowedTeachers.length > 0 && (
                                <p className="text-[10px] text-sky-500 font-semibold mt-0.5">
                                  👤 {c.allowedTeachers.map(id => teacherName(id)).join(", ")}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-[9px] font-bold px-2 py-1 rounded-full border ${c.status === "activo" ? "bg-teal-50 border-teal-200 text-teal-600" : "bg-slate-100 border-slate-200 text-slate-500"}`}>
                              {c.status}
                            </span>
                            <button onClick={() => { setCourseForm({ name: c.name, level: c.level, customLevel: c.customLevel || "", durationType: c.durationType || "months", duration: c.duration || "", courseStartDate: c.courseStartDate || "", courseEndDate: c.courseEndDate || "", price: c.price, classType: c.classType || "grupal", allowedTeachers: c.allowedTeachers || [] }); setEditCourseModal(c); }}
                              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors">
                              <span className="material-symbols-outlined text-base">edit</span>
                            </button>
                            <button onClick={() => handleArchiveCourse(c)}
                              className="p-1.5 rounded-lg hover:bg-amber-50 text-slate-400 hover:text-amber-600 transition-colors"
                              title={c.status === "activo" ? "Archivar Curso" : "Reactivar Curso"}>
                              <span className="material-symbols-outlined text-base">{c.status === "activo" ? "archive" : "unarchive"}</span>
                            </button>
                            <button onClick={() => handleDeleteCourse(c)}
                              className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors"
                              title="Eliminar Curso">
                              <span className="material-symbols-outlined text-base">delete</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── GRUPOS ─────────────────────────────────────────────────────── */}
              {activeTab === "grupos" && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="font-montserrat font-bold text-slate-800">Grupos Activos</h3>
                    <button onClick={() => { setGroupForm(emptyGroup); setAddGroupModal(true); }}
                      className="bg-ttp-primary text-white px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-md shadow-ttp-primary/20">
                      <span className="material-symbols-outlined text-base">add</span> Nuevo Grupo
                    </button>
                  </div>

                  {groups.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
                      <span className="material-symbols-outlined text-4xl opacity-30">groups</span>
                      <p className="text-sm font-semibold">No hay grupos registrados aún.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {groups.map((g) => (
                        <div key={g.id} className="flex items-center justify-between p-4 rounded-2xl border border-slate-200/60 bg-white">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-sky-50 flex items-center justify-center flex-shrink-0">
                              <span className="font-montserrat font-extrabold text-sky-600 text-xs">{g.code}</span>
                            </div>
                            <div>
                              <p className="font-bold text-slate-800 text-sm">{g.course}</p>
                              <p className="text-[11px] text-slate-400 font-medium">{teacherName(g.teacher_id)} · {g.schedule} · {g.enrolled ?? 0}/{g.capacity} alumnos</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-16">
                              <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${(g.enrolled ?? 0) >= g.capacity ? "bg-rose-400" : "bg-teal-400"}`} style={{ width: `${Math.min(((g.enrolled ?? 0) / g.capacity) * 100, 100)}%` }} />
                              </div>
                            </div>
                            <button onClick={() => { setGroupForm({ code: g.code, course: g.course, teacher_id: g.teacher_id || "", schedule: g.schedule, capacity: g.capacity }); setEditGroupModal(g); }}
                              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors">
                              <span className="material-symbols-outlined text-base">edit</span>
                            </button>
                            <button onClick={() => handleDeleteGroup(g)}
                              className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors">
                              <span className="material-symbols-outlined text-base">delete</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── USUARIOS ───────────────────────────────────────────────────── */}
              {activeTab === "usuarios" && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="font-montserrat font-bold text-slate-800">Usuarios del Sistema</h3>
                    <button onClick={() => setAddUserModal(true)}
                      className="bg-ttp-primary text-white px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-md shadow-ttp-primary/20">
                      <span className="material-symbols-outlined text-base">person_add</span> Nuevo Usuario
                    </button>
                  </div>
                  {users.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
                      <span className="material-symbols-outlined text-4xl opacity-30">manage_accounts</span>
                      <p className="text-sm font-semibold">No hay usuarios registrados.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {users.map((u) => (
                        <div key={u.id} className={`flex items-center justify-between p-4 rounded-2xl border transition-colors ${u.status === "inactivo" ? "opacity-50 bg-slate-50/50 border-slate-100" : "bg-white border-slate-200/60"}`}>
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-ttp-primary/10 text-ttp-primary font-extrabold font-montserrat flex items-center justify-center flex-shrink-0">
                              {u.name.charAt(0)}
                            </div>
                            <div>
                              <p className="font-bold text-slate-800 text-sm">{u.name}</p>
                              <p className="text-[11px] text-slate-400 font-medium">{u.email} · Último acceso: {u.lastLogin}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-[9px] font-bold px-2 py-1 rounded-full border ${roleColor(u.role)}`}>{u.role}</span>
                            <button onClick={() => handleToggleUser(u)}
                              className={`p-1.5 rounded-lg transition-colors ${u.status === "activo" ? "hover:bg-amber-50 text-slate-400 hover:text-amber-600" : "hover:bg-teal-50 text-slate-400 hover:text-teal-600"}`}
                              title={u.status === "activo" ? "Desactivar Usuario" : "Activar Usuario"}>
                              <span className="material-symbols-outlined text-base">{u.status === "activo" ? "block" : "check_circle"}</span>
                            </button>
                            <button onClick={() => handleDeleteUser(u)}
                              className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors"
                              title="Eliminar Usuario">
                              <span className="material-symbols-outlined text-base">delete</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── CORREO DE SISTEMA ───────────────────────────────────────────── */}
              {activeTab === "correo" && (
                <div className="space-y-6">
                  <div>
                    <h3 className="font-montserrat font-bold text-slate-800 text-sm">Configuración de Correo Electrónico (Gmail SMTP)</h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Configura la cuenta de Gmail del sistema para enviar avisos, credenciales y notificaciones a los maestros de forma directa y 100% gratuita.
                    </p>
                  </div>

                  <form onSubmit={handleSaveSmtp} className="bg-slate-50 border border-slate-200/50 p-6 rounded-3xl space-y-4 max-w-xl">
                    <div>
                      <label className={labelCls}>Cuenta de Gmail Remitente *</label>
                      <input
                        required
                        type="email"
                        value={smtpUser}
                        onChange={(e) => setSmtpUser(e.target.value)}
                        className={inputCls}
                        placeholder="ejemplo@gmail.com"
                      />
                      <p className="text-[10px] text-slate-400 mt-1 font-medium">Esta cuenta se utilizará como remitente de todos los correos del portal.</p>
                    </div>

                    <div>
                      <label className={labelCls}>Contraseña de Aplicación de Google (16 caracteres) *</label>
                      <div className="flex gap-2">
                        <input
                          required
                          type={showSmtpPass ? "text" : "password"}
                          value={smtpPass}
                          onChange={(e) => setSmtpPass(e.target.value)}
                          className={`${inputCls} flex-1`}
                          placeholder="•••• •••• •••• ••••"
                          maxLength={30}
                        />
                        <button
                          type="button"
                          onClick={() => setShowSmtpPass(!showSmtpPass)}
                          className="px-3 border border-slate-200 hover:bg-slate-100 text-slate-650 rounded-xl text-xs font-bold transition-all flex items-center justify-center bg-white cursor-pointer active:scale-95"
                        >
                          <span className="material-symbols-outlined text-base">
                            {showSmtpPass ? "visibility_off" : "visibility"}
                          </span>
                        </button>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1.5 font-medium leading-relaxed">
                        ⚠️ **No ingreses tu contraseña normal de Gmail**. Por seguridad, debes generar una contraseña de aplicación de 16 caracteres desde tu cuenta de Google.
                      </p>
                    </div>

                    <button
                      type="submit"
                      disabled={savingSmtp}
                      className="w-full py-2.5 bg-ttp-primary text-white rounded-xl font-bold text-sm hover:opacity-90 active:scale-95 transition-all shadow-md shadow-ttp-primary/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {savingSmtp ? (
                        <>
                          <span className="material-symbols-outlined text-base animate-spin">sync</span>
                          Guardando...
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-base">save</span>
                          Guardar Configuración de Correo
                        </>
                      )}
                    </button>
                  </form>

                  {/* Tutorial Card */}
                  <div className="bg-sky-50 border border-sky-100 rounded-3xl p-6 space-y-4 max-w-xl">
                    <div className="flex items-center gap-2.5 text-sky-800">
                      <span className="material-symbols-outlined text-xl">info</span>
                      <h4 className="font-montserrat font-bold text-sm">¿Cómo obtener tu Contraseña de Aplicación?</h4>
                    </div>
                    <ol className="text-xs text-sky-700 space-y-2 list-decimal list-inside font-medium leading-relaxed">
                      <li>Ve a tu Cuenta de Google en <a href="https://myaccount.google.com" target="_blank" className="underline font-bold" rel="noopener noreferrer">myaccount.google.com</a>.</li>
                      <li>Asegúrate de activar la **Verificación en 2 pasos** en la pestaña **Seguridad**.</li>
                      <li>Busca **\"Contraseñas de aplicación\"** en la barra de búsqueda de arriba.</li>
                      <li>Escribe un nombre (ej. `TTP Hub`), haz clic en **Crear** y copia el código de 16 letras amarillas. ¡Ese es el código que debes pegar aquí!</li>
                    </ol>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* ── Modal Agregar Curso ───────────────────────────────────────────────── */}
      {addCourseModal && (
        <ModalWrapper onClose={() => setAddCourseModal(false)}>
          <div className="flex items-center justify-between px-7 py-5 border-b border-slate-100 bg-slate-50">
            <h2 className="font-montserrat font-bold text-slate-800">Nuevo Curso</h2>
            <button onClick={() => setAddCourseModal(false)} className="w-8 h-8 rounded-xl bg-slate-200 hover:bg-slate-300 flex items-center justify-center">
              <span className="material-symbols-outlined text-slate-600 text-lg">close</span>
            </button>
          </div>
          <form 
            onSubmit={handleAddCourse} 
            onKeyDown={(e) => {
              if (e.key === "Enter" && e.target.tagName === "INPUT") {
                e.preventDefault();
              }
            }}
            className="p-7 space-y-4 max-h-[80vh] overflow-y-auto"
          >
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className={labelCls}>Nombre del Curso *</label>
                <input required autoFocus value={courseForm.name} onChange={e => setCourseForm(p => ({ ...p, name: e.target.value }))} className={inputCls} />
              </div>

              {/* Tipo de Clase */}
              <div className="col-span-2">
                <label className={labelCls}>Tipo de Clase *</label>
                <div className="grid grid-cols-3 gap-2 mt-1">
                  {[
                    { value: "grupal",  label: "Grupal",            icon: "group" },
                    { value: "privada", label: "Privado",           icon: "person" },
                    { value: "club",    label: "Conversation Club", icon: "record_voice_over" },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setCourseForm(p => ({ ...p, classType: opt.value }))}
                      className={`flex flex-col items-center gap-1 py-3 rounded-xl border-2 text-xs font-bold transition-all ${
                        courseForm.classType === opt.value
                          ? "border-ttp-primary bg-ttp-primary/5 text-ttp-primary"
                          : "border-slate-200 text-slate-500 hover:border-slate-300"
                      }`}
                    >
                      <span className="material-symbols-outlined text-lg">{opt.icon}</span>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Nivel CEFR */}
              <div className="col-span-2 space-y-2">
                <label className={labelCls}>Nivel del Curso</label>
                {/* Casilla Sin nivel */}
                <button
                  type="button"
                  onClick={() => setCourseForm(p => ({ ...p, level: p.level === "none" ? "" : "none", customLevel: "" }))}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 text-xs font-bold transition-all ${
                    courseForm.level === "none"
                      ? "border-slate-500 bg-slate-100 text-slate-700"
                      : "border-slate-200 text-slate-400 hover:border-slate-300"
                  }`}
                >
                  <span className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                    courseForm.level === "none" ? "border-slate-600 bg-slate-600" : "border-slate-300"
                  }`}>
                    {courseForm.level === "none" && <span className="material-symbols-outlined text-white text-[11px] font-bold">check</span>}
                  </span>
                  Sin nivel requerido
                </button>

                {/* Dropdown CEFR (oculto si Sin nivel está activo) */}
                {courseForm.level !== "none" && (
                  <select
                    value={courseForm.level}
                    onChange={e => setCourseForm(p => ({ ...p, level: e.target.value, customLevel: "" }))}
                    className={inputCls}
                  >
                    <option value="">— Seleccionar nivel —</option>
                    {CEFR_LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                  </select>
                )}
              </div>

              {/* Vigencia / Duración del Ciclo */}
              <div className="col-span-2 space-y-2">
                <label className={labelCls}>Vigencia del Ciclo</label>

                {/* Toggle Por meses / Por fechas */}
                <div className="flex gap-2">
                  {[
                    { val: "months", label: "Por meses",  icon: "calendar_month" },
                    { val: "dates",  label: "Por fechas", icon: "date_range" },
                  ].map(opt => (
                    <button
                      key={opt.val}
                      type="button"
                      onClick={() => setCourseForm(p => ({ ...p, durationType: opt.val }))}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 text-xs font-bold transition-all ${
                        courseForm.durationType === opt.val
                          ? "border-ttp-primary bg-ttp-primary/5 text-ttp-primary"
                          : "border-slate-200 text-slate-400 hover:border-slate-300"
                      }`}
                    >
                      <span className="material-symbols-outlined text-sm">{opt.icon}</span>
                      {opt.label}
                    </button>
                  ))}
                </div>

                {/* Por meses: dropdown predefinido */}
                {courseForm.durationType === "months" && (
                  <select
                    value={courseForm.duration}
                    onChange={e => setCourseForm(p => ({ ...p, duration: e.target.value }))}
                    className={inputCls}
                  >
                    <option value="">— Seleccionar duración —</option>
                    {DURATION_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                )}

                {/* Por fechas: date pickers */}
                {courseForm.durationType === "dates" && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Fecha de inicio</label>
                      <input
                        type="date"
                        value={courseForm.courseStartDate || ""}
                        onChange={e => setCourseForm(p => ({ ...p, courseStartDate: e.target.value }))}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Fecha de fin</label>
                      <input
                        type="date"
                        value={courseForm.courseEndDate || ""}
                        onChange={e => setCourseForm(p => ({ ...p, courseEndDate: e.target.value }))}
                        className={inputCls}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Nivel personalizado (solo si eligieron "Otro") */}
              {courseForm.level === "custom" && (
                <div className="col-span-2">
                  <label className={labelCls}>Nivel personalizado</label>
                  <input
                    value={courseForm.customLevel || ""}
                    onChange={e => setCourseForm(p => ({ ...p, customLevel: e.target.value }))}
                    placeholder="Ej. Kids A1, Corporate C1..."
                    className={inputCls}
                  />
                </div>
              )}

              <div className="col-span-2">
                <label className={labelCls}>Precio Mensual (MXN)</label>
                <input type="number" value={courseForm.price} onChange={e => setCourseForm(p => ({ ...p, price: e.target.value }))} className={inputCls} />
              </div>
            </div>

            {/* Maestros habilitados */}
            <div>
              <label className={labelCls}>Maestros Habilitados para este Curso</label>
              {teachersList.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No hay maestros registrados aún. Agrégalos en el módulo de Maestros.</p>
              ) : (
                <div className="space-y-2 mt-1 max-h-40 overflow-y-auto pr-1">
                  {teachersList.map((t) => {
                    const tId = t.id;
                    const tName = `${t.firstName || t.name || ""} ${t.lastName || ""}`.trim() || t.email || tId;
                    const checked = (courseForm.allowedTeachers || []).includes(tId);
                    return (
                      <label key={tId} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${checked ? "border-ttp-primary/40 bg-ttp-primary/5" : "border-slate-100 hover:border-slate-200"}`}>
                        <input type="checkbox" checked={checked} onChange={() => toggleTeacherInCourse(tId)} className="w-4 h-4 accent-ttp-primary rounded" />
                        <div>
                          <p className="text-sm font-semibold text-slate-800">{tName}</p>
                          {t.specialty && <p className="text-[10px] text-slate-400">{t.specialty}</p>}
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setAddCourseModal(false)} className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl font-semibold text-sm hover:bg-slate-50">Cancelar</button>
              <button type="submit" className="flex-1 py-2.5 bg-ttp-primary text-white rounded-xl font-bold text-sm hover:opacity-90 active:scale-95 transition-all shadow-md shadow-ttp-primary/20">Crear Curso</button>
            </div>
          </form>
        </ModalWrapper>
      )}

      {/* ── Modal Editar Curso ────────────────────────────────────────────────── */}
      {editCourseModal && (
        <ModalWrapper onClose={() => setEditCourseModal(null)}>
          <div className="flex items-center justify-between px-7 py-5 border-b border-slate-100 bg-slate-50">
            <h2 className="font-montserrat font-bold text-slate-800">Editar Curso</h2>
            <button onClick={() => setEditCourseModal(null)} className="w-8 h-8 rounded-xl bg-slate-200 hover:bg-slate-300 flex items-center justify-center">
              <span className="material-symbols-outlined text-slate-600 text-lg">close</span>
            </button>
          </div>
          <form 
            onSubmit={handleEditCourse} 
            onKeyDown={(e) => {
              if (e.key === "Enter" && e.target.tagName === "INPUT") {
                e.preventDefault();
              }
            }}
            className="p-7 space-y-4 max-h-[80vh] overflow-y-auto"
          >
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className={labelCls}>Nombre del Curso</label>
                <input required autoFocus value={courseForm.name} onChange={e => setCourseForm(p => ({ ...p, name: e.target.value }))} className={inputCls} />
              </div>

              {/* Tipo de Clase */}
              <div className="col-span-2">
                <label className={labelCls}>Tipo de Clase *</label>
                <div className="grid grid-cols-3 gap-2 mt-1">
                  {[
                    { value: "grupal",  label: "Grupal",            icon: "group" },
                    { value: "privada", label: "Privado",           icon: "person" },
                    { value: "club",    label: "Conversation Club", icon: "record_voice_over" },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setCourseForm(p => ({ ...p, classType: opt.value }))}
                      className={`flex flex-col items-center gap-1 py-3 rounded-xl border-2 text-xs font-bold transition-all ${
                        courseForm.classType === opt.value
                          ? "border-ttp-primary bg-ttp-primary/5 text-ttp-primary"
                          : "border-slate-200 text-slate-500 hover:border-slate-300"
                      }`}
                    >
                      <span className="material-symbols-outlined text-lg">{opt.icon}</span>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Nivel CEFR */}
              <div className="col-span-2 space-y-2">
                <label className={labelCls}>Nivel del Curso</label>
                {/* Casilla Sin nivel */}
                <button
                  type="button"
                  onClick={() => setCourseForm(p => ({ ...p, level: p.level === "none" ? "" : "none", customLevel: "" }))}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 text-xs font-bold transition-all ${
                    courseForm.level === "none"
                      ? "border-slate-500 bg-slate-100 text-slate-700"
                      : "border-slate-200 text-slate-400 hover:border-slate-300"
                  }`}
                >
                  <span className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                    courseForm.level === "none" ? "border-slate-600 bg-slate-600" : "border-slate-300"
                  }`}>
                    {courseForm.level === "none" && <span className="material-symbols-outlined text-white text-[11px] font-bold">check</span>}
                  </span>
                  Sin nivel requerido
                </button>

                {/* Dropdown CEFR (oculto si Sin nivel está activo) */}
                {courseForm.level !== "none" && (
                  <select
                    value={courseForm.level}
                    onChange={e => setCourseForm(p => ({ ...p, level: e.target.value, customLevel: "" }))}
                    className={inputCls}
                  >
                    <option value="">— Seleccionar nivel —</option>
                    {CEFR_LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                  </select>
                )}
              </div>

              {/* Vigencia / Duración del Ciclo */}
              <div className="col-span-2 space-y-2">
                <label className={labelCls}>Vigencia del Ciclo</label>

                {/* Toggle Por meses / Por fechas */}
                <div className="flex gap-2">
                  {[
                    { val: "months", label: "Por meses",  icon: "calendar_month" },
                    { val: "dates",  label: "Por fechas", icon: "date_range" },
                  ].map(opt => (
                    <button
                      key={opt.val}
                      type="button"
                      onClick={() => setCourseForm(p => ({ ...p, durationType: opt.val }))}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 text-xs font-bold transition-all ${
                        courseForm.durationType === opt.val
                          ? "border-ttp-primary bg-ttp-primary/5 text-ttp-primary"
                          : "border-slate-200 text-slate-400 hover:border-slate-300"
                      }`}
                    >
                      <span className="material-symbols-outlined text-sm">{opt.icon}</span>
                      {opt.label}
                    </button>
                  ))}
                </div>

                {/* Por meses: dropdown predefinido */}
                {courseForm.durationType === "months" && (
                  <select
                    value={courseForm.duration}
                    onChange={e => setCourseForm(p => ({ ...p, duration: e.target.value }))}
                    className={inputCls}
                  >
                    <option value="">— Seleccionar duración —</option>
                    {DURATION_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                )}

                {/* Por fechas: date pickers */}
                {courseForm.durationType === "dates" && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Fecha de inicio</label>
                      <input
                        type="date"
                        value={courseForm.courseStartDate || ""}
                        onChange={e => setCourseForm(p => ({ ...p, courseStartDate: e.target.value }))}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Fecha de fin</label>
                      <input
                        type="date"
                        value={courseForm.courseEndDate || ""}
                        onChange={e => setCourseForm(p => ({ ...p, courseEndDate: e.target.value }))}
                        className={inputCls}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Nivel personalizado (solo si eligieron "Otro") */}
              {courseForm.level === "custom" && (
                <div className="col-span-2">
                  <label className={labelCls}>Nivel personalizado</label>
                  <input
                    value={courseForm.customLevel || ""}
                    onChange={e => setCourseForm(p => ({ ...p, customLevel: e.target.value }))}
                    placeholder="Ej. Kids A1, Corporate C1..."
                    className={inputCls}
                  />
                </div>
              )}

              <div className="col-span-2">
                <label className={labelCls}>Precio (MXN)</label>
                <input type="number" value={courseForm.price} onChange={e => setCourseForm(p => ({ ...p, price: e.target.value }))} className={inputCls} />
              </div>
            </div>

            {/* Maestros habilitados */}
            <div>
              <label className={labelCls}>Maestros Habilitados para este Curso</label>
              {teachersList.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No hay maestros registrados aún.</p>
              ) : (
                <div className="space-y-2 mt-1 max-h-40 overflow-y-auto pr-1">
                  {teachersList.map((t) => {
                    const tId = t.id;
                    const tName = `${t.firstName || t.name || ""} ${t.lastName || ""}`.trim() || t.email || tId;
                    const checked = (courseForm.allowedTeachers || []).includes(tId);
                    return (
                      <label key={tId} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${checked ? "border-ttp-primary/40 bg-ttp-primary/5" : "border-slate-100 hover:border-slate-200"}`}>
                        <input type="checkbox" checked={checked} onChange={() => toggleTeacherInCourse(tId)} className="w-4 h-4 accent-ttp-primary rounded" />
                        <div>
                          <p className="text-sm font-semibold text-slate-800">{tName}</p>
                          {t.specialty && <p className="text-[10px] text-slate-400">{t.specialty}</p>}
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setEditCourseModal(null)} className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl font-semibold text-sm hover:bg-slate-50">Cancelar</button>
              <button type="submit" className="flex-1 py-2.5 bg-ttp-primary text-white rounded-xl font-bold text-sm hover:opacity-90 active:scale-95 transition-all shadow-md shadow-ttp-primary/20">Guardar Cambios</button>
            </div>
          </form>
        </ModalWrapper>
      )}

      {/* ── Modal Agregar Grupo ───────────────────────────────────────────────── */}
      {addGroupModal && (
        <ModalWrapper onClose={() => setAddGroupModal(false)}>
          <div className="flex items-center justify-between px-7 py-5 border-b border-slate-100 bg-slate-50">
            <h2 className="font-montserrat font-bold text-slate-800">Nuevo Grupo</h2>
            <button onClick={() => setAddGroupModal(false)} className="w-8 h-8 rounded-xl bg-slate-200 hover:bg-slate-300 flex items-center justify-center">
              <span className="material-symbols-outlined text-slate-600 text-lg">close</span>
            </button>
          </div>
          <form 
            onSubmit={handleAddGroup} 
            onKeyDown={(e) => {
              if (e.key === "Enter" && e.target.tagName === "INPUT") {
                e.preventDefault();
              }
            }}
            className="p-7 space-y-4"
          >
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Código *</label>
                <input required autoFocus value={groupForm.code} onChange={e => setGroupForm(p => ({ ...p, code: e.target.value }))} placeholder="EMP-C" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Cupo Máximo *</label>
                <input required type="number" value={groupForm.capacity} onChange={e => setGroupForm(p => ({ ...p, capacity: e.target.value }))} className={inputCls} />
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Curso *</label>
                <select required value={groupForm.course} onChange={e => setGroupForm(p => ({ ...p, course: e.target.value }))} className={inputCls}>
                  <option value="">— Seleccionar curso —</option>
                  {courses.filter(c => c.status === "activo").map(c => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Maestro</label>
                <select value={groupForm.teacher_id} onChange={e => setGroupForm(p => ({ ...p, teacher_id: e.target.value }))} className={inputCls}>
                  <option value="">— Sin maestro asignado —</option>
                  {teachersList.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Horario</label>
                <input value={groupForm.schedule} onChange={e => setGroupForm(p => ({ ...p, schedule: e.target.value }))} placeholder="Lun/Mié 08:00" className={inputCls} />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setAddGroupModal(false)} className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl font-semibold text-sm hover:bg-slate-50">Cancelar</button>
              <button type="submit" className="flex-1 py-2.5 bg-ttp-primary text-white rounded-xl font-bold text-sm hover:opacity-90 active:scale-95 transition-all shadow-md shadow-ttp-primary/20">Crear Grupo</button>
            </div>
          </form>
        </ModalWrapper>
      )}

      {/* ── Modal Editar Grupo ────────────────────────────────────────────────── */}
      {editGroupModal && (
        <ModalWrapper onClose={() => setEditGroupModal(null)}>
          <div className="flex items-center justify-between px-7 py-5 border-b border-slate-100 bg-slate-50">
            <h2 className="font-montserrat font-bold text-slate-800">Editar Grupo {editGroupModal.code}</h2>
            <button onClick={() => setEditGroupModal(null)} className="w-8 h-8 rounded-xl bg-slate-200 hover:bg-slate-300 flex items-center justify-center">
              <span className="material-symbols-outlined text-slate-600 text-lg">close</span>
            </button>
          </div>
          <form 
            onSubmit={handleEditGroup} 
            onKeyDown={(e) => {
              if (e.key === "Enter" && e.target.tagName === "INPUT") {
                e.preventDefault();
              }
            }}
            className="p-7 space-y-4"
          >
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Código</label>
                <input required autoFocus value={groupForm.code} onChange={e => setGroupForm(p => ({ ...p, code: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Cupo</label>
                <input type="number" value={groupForm.capacity} onChange={e => setGroupForm(p => ({ ...p, capacity: e.target.value }))} className={inputCls} />
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Curso</label>
                <select value={groupForm.course} onChange={e => setGroupForm(p => ({ ...p, course: e.target.value }))} className={inputCls}>
                  <option value="">— Seleccionar curso —</option>
                  {courses.filter(c => c.status === "activo").map(c => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Maestro</label>
                <select value={groupForm.teacher_id} onChange={e => setGroupForm(p => ({ ...p, teacher_id: e.target.value }))} className={inputCls}>
                  <option value="">— Sin maestro asignado —</option>
                  {teachersList.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Horario</label>
                <input value={groupForm.schedule} onChange={e => setGroupForm(p => ({ ...p, schedule: e.target.value }))} className={inputCls} />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setEditGroupModal(null)} className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl font-semibold text-sm hover:bg-slate-50">Cancelar</button>
              <button type="submit" className="flex-1 py-2.5 bg-ttp-primary text-white rounded-xl font-bold text-sm hover:opacity-90 active:scale-95 transition-all shadow-md shadow-ttp-primary/20">Guardar</button>
            </div>
          </form>
        </ModalWrapper>
      )}

      {/* ── Modal Agregar Usuario ─────────────────────────────────────────────── */}
      {addUserModal && (
        <ModalWrapper onClose={() => setAddUserModal(false)}>
          <div className="flex items-center justify-between px-7 py-5 border-b border-slate-100 bg-slate-50">
            <h2 className="font-montserrat font-bold text-slate-800">Nuevo Usuario</h2>
            <button onClick={() => setAddUserModal(false)} className="w-8 h-8 rounded-xl bg-slate-200 hover:bg-slate-300 flex items-center justify-center">
              <span className="material-symbols-outlined text-slate-600 text-lg">close</span>
            </button>
          </div>
          <form 
            onSubmit={handleAddUser} 
            onKeyDown={(e) => {
              if (e.key === "Enter" && e.target.tagName === "INPUT") {
                e.preventDefault();
              }
            }}
            className="p-7 space-y-4"
          >
            <div>
              <label className={labelCls}>Nombre Completo *</label>
              <input required autoFocus value={userForm.name} onChange={e => setUserForm(p => ({ ...p, name: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Email *</label>
              <input required type="text" value={userForm.email} onChange={e => setUserForm(p => ({ ...p, email: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Rol de Acceso *</label>
              <select value={userForm.role} onChange={e => setUserForm(p => ({ ...p, role: e.target.value }))} className={`${inputCls} cursor-pointer`}>
                <option>Admin</option><option>Teacher</option><option>Viewer</option>
              </select>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setAddUserModal(false)} className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl font-semibold text-sm hover:bg-slate-50">Cancelar</button>
              <button type="submit" className="flex-1 py-2.5 bg-ttp-primary text-white rounded-xl font-bold text-sm hover:opacity-90 active:scale-95 transition-all shadow-md shadow-ttp-primary/20">Crear Usuario</button>
            </div>
          </form>
        </ModalWrapper>
      )}
      
      <ConfirmDialog
        open={!!deleteConfirmModal}
        title={deleteConfirmModal ? `¿Eliminar ${deleteConfirmModal.titleType}?` : ""}
        description={deleteConfirmModal ? `¿Estás seguro de que deseas eliminar permanentemente a "${deleteConfirmModal.name}"? Esta acción no se puede deshacer.` : ""}
        confirmLabel="Sí, Eliminar"
        variant="danger"
        onConfirm={() => { deleteConfirmModal?.onConfirm(); setDeleteConfirmModal(null); }}
        onCancel={() => setDeleteConfirmModal(null)}
      />
    </div>
  );
}
