"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "@/utils/supabaseClient";

const DataContext = createContext({
  teachers: [],
  setTeachers: () => {},
  students: [],
  setStudents: () => {},
  courses: [],
  setCourses: () => {},
  groups: [],
  setGroups: () => {},
  loading: true,
  refreshAll: async () => {},
  refreshTeachers: async () => {},
  refreshStudents: async () => {},
  refreshCourses: async () => {},
  refreshGroups: async () => {},
});

export function DataProvider({ children }) {
  const [teachers, setTeachers] = useState([]);
  const [students, setStudents] = useState([]);
  const [courses, setCourses] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchTeachers = async () => {
    try {
      const { data: teachersData, error } = await supabase.from("teachers").select("*");
      if (error) throw error;
      if (!teachersData) return [];
      
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
      return mapped;
    } catch (err) {
      console.error("Error loading teachers in context:", err);
      return [];
    }
  };

  const fetchStudents = async () => {
    try {
      const { data, error } = await supabase.from("students").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      setStudents(data || []);
      return data || [];
    } catch (err) {
      console.error("Error loading students in context:", err);
      return [];
    }
  };

  const fetchCourses = async () => {
    try {
      const { data, error } = await supabase.from("courses").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      setCourses(data || []);
      return data || [];
    } catch (err) {
      console.error("Error loading courses in context:", err);
      return [];
    }
  };

  const fetchGroups = async () => {
    try {
      const { data, error } = await supabase.from("groups").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      setGroups(data || []);
      return data || [];
    } catch (err) {
      console.error("Error loading groups in context:", err);
      return [];
    }
  };

  const refreshAll = async () => {
    setLoading(true);
    await Promise.all([
      fetchTeachers(),
      fetchStudents(),
      fetchCourses(),
      fetchGroups()
    ]);
    setLoading(false);
  };

  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("ttp_user_session") : null;
    if (stored) {
      try {
        const user = JSON.parse(stored);
        if (user && user.role === "admin") {
          refreshAll();
        } else {
          setLoading(false);
        }
      } catch (e) {
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, []);

  return (
    <DataContext.Provider
      value={{
        teachers,
        setTeachers,
        students,
        setStudents,
        courses,
        setCourses,
        groups,
        setGroups,
        loading,
        refreshAll,
        refreshTeachers: fetchTeachers,
        refreshStudents: fetchStudents,
        refreshCourses: fetchCourses,
        refreshGroups: fetchGroups,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  return useContext(DataContext);
}
