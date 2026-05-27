"use client";

import React, { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";

export default function AuthGuard({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [authorized, setAuthorized] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // Ejecutar solo en el cliente
    if (typeof window === "undefined") return;

    const checkAuth = () => {
      const stored = localStorage.getItem("ttp_user_session");
      const isLoginPath = pathname === "/login";

      if (!stored) {
        // No hay sesión activa
        if (!isLoginPath) {
          // Intentando entrar a una ruta protegida -> redirigir a Login
          setAuthorized(false);
          setChecking(true);
          router.push("/login");
        } else {
          // Está en Login y no tiene sesión -> Permitir acceso libre
          setAuthorized(true);
          setChecking(false);
        }
      } else {
        // Hay sesión activa
        try {
          const user = JSON.parse(stored);
          const { role } = user;

          if (isLoginPath) {
            // Si ya está logueado e intenta ir a login, redirigir a su portal
            setAuthorized(false);
            setChecking(true);
            redirectByRole(role);
          } else {
            // Validar accesos basados en roles (RBAC)
            if (role === "teacher") {
              // Docente solo puede entrar a su portal
              if (pathname !== "/teachers/portal") {
                setAuthorized(false);
                setChecking(true);
                router.push("/teachers/portal");
              } else {
                setAuthorized(true);
                setChecking(false);
              }
            } else if (role === "student") {
              // Alumno solo puede entrar a su portal
              if (pathname !== "/students/portal" && !pathname.startsWith("/students/portal/")) {
                setAuthorized(false);
                setChecking(true);
                router.push("/students/portal");
              } else {
                setAuthorized(true);
                setChecking(false);
              }
            } else if (role === "admin") {
              // Administrador tiene acceso total a cualquier ruta administrativa
              // Pero si intenta entrar al portal de docentes o alumnos por error,
              // le dejamos explorar o lo mantenemos en el admin control panel.
              setAuthorized(true);
              setChecking(false);
            } else {
              // Rol desconocido -> redirigir a Login por seguridad
              localStorage.removeItem("ttp_user_session");
              router.push("/login");
            }
          }
        } catch (e) {
          // Sesión inválida/corrupta
          localStorage.removeItem("ttp_user_session");
          router.push("/login");
        }
      }
    };

    checkAuth();
  }, [pathname, router]);

  const redirectByRole = (role) => {
    if (role === "admin") {
      router.push("/");
    } else if (role === "teacher") {
      router.push("/teachers/portal");
    } else if (role === "student") {
      router.push("/students/portal");
    } else {
      router.push("/");
    }
  };

  // Mostrar una pantalla de carga premium mientras valida la sesión
  if (checking) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0d1321]">
        {/* Glow Effects */}
        <div className="absolute w-[300px] h-[300px] rounded-full bg-[#e74d8a]/10 blur-[80px] animate-pulse pointer-events-none" />
        
        <div className="z-10 space-y-4 text-center">
          {/* Spinner */}
          <div className="relative w-12 h-12 mx-auto">
            <div className="w-12 h-12 border-4 border-slate-800 rounded-full" />
            <div className="absolute inset-0 w-12 h-12 border-4 border-t-[#e74d8a] border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin" />
          </div>
          <div>
            <h3 className="font-montserrat font-bold text-white text-sm tracking-wide">
              Validando Accesos
            </h3>
            <p className="text-[10px] text-slate-400 font-semibold mt-1">
              Conectando de forma segura con TTP Hub...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return authorized ? <>{children}</> : null;
}
