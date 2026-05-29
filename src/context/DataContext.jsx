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
  schedules: [],
  setSchedules: () => {},
  availability: [],
  setAvailability: () => {},
  loading: true,
  refreshAll: async () => {},
  refreshTeachers: async () => {},
  refreshStudents: async () => {},
  refreshCourses: async () => {},
  refreshGroups: async () => {},
  refreshSchedules: async () => {},
  refreshAvailability: async () => {},
});

export function DataProvider({ children }) {
  const [teachers, setTeachers] = useState([]);
  const [students, setStudents] = useState([]);
  const [courses, setCourses] = useState([]);
  const [groups, setGroups] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [availability, setAvailability] = useState([]);
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

  const fetchSchedules = async () => {
    try {
      const { data, error } = await supabase.from("schedules").select("*");
      if (error) throw error;
      setSchedules(data || []);
      return data || [];
    } catch (err) {
      console.error("Error loading schedules in context:", err);
      return [];
    }
  };

  const fetchAvailability = async () => {
    try {
      const { data, error } = await supabase.from("teacher_availability").select("*");
      if (error) throw error;
      
      const mapped = (data || []).map(b => ({
        id: b.id,
        teacherId: b.teacher_id,
        day: b.day,
        type: b.type,
        startTime: b.start_time,
        endTime: b.end_time,
        description: b.description || ""
      }));
      setAvailability(mapped);
      return mapped;
    } catch (err) {
      console.error("Error loading availability in context:", err);
      return [];
    }
  };

  const refreshAll = async () => {
    setLoading(true);
    await Promise.all([
      fetchTeachers(),
      fetchStudents(),
      fetchCourses(),
      fetchGroups(),
      fetchSchedules(),
      fetchAvailability()
    ]);
    setLoading(false);
  };

  useEffect(() => {
    let active = true;
    let didInitialLoad = false;

    const checkSessionAndLoad = () => {
      if (typeof window === "undefined" || !active) return;
      const stored = localStorage.getItem("ttp_user_session");
      if (stored) {
        try {
          const user = JSON.parse(stored);
          if (user && user.role === "admin") {
            if (!didInitialLoad) {
              didInitialLoad = true;
              refreshAll();
            }
          } else {
            setLoading(false);
          }
        } catch (e) {
          setLoading(false);
        }
      } else {
        // Clear global cache upon logout
        setTeachers([]);
        setStudents([]);
        setCourses([]);
        setGroups([]);
        setSchedules([]);
        setAvailability([]);
        setLoading(false);
        didInitialLoad = false;
      }
    };

    checkSessionAndLoad();

    // Check periodically in case user logs in or out
    const interval = setInterval(checkSessionAndLoad, 1000);

    return () => {
      active = false;
      clearInterval(interval);
    };
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
        schedules,
        setSchedules,
        availability,
        setAvailability,
        loading,
        refreshAll,
        refreshTeachers: fetchTeachers,
        refreshStudents: fetchStudents,
        refreshCourses: fetchCourses,
        refreshGroups: fetchGroups,
        refreshSchedules: fetchSchedules,
        refreshAvailability: fetchAvailability,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  return useContext(DataContext);
}
