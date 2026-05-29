import { Montserrat, Inter } from "next/font/google";
import AuthGuard from "@/components/AuthGuard";
import { Toaster } from "sonner";
import GlobalUppercaseListener from "@/components/GlobalUppercaseListener";
import "./globals.css";

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat",
  weight: ["600", "700"],
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  weight: ["400", "500", "600"],
});

export const metadata = {
  title: "TTP Hub - Panel de Control de Administración",
  description: "Dashboard de Administración para la gestión académica, financiera y operativa de TTP Hub.",
  keywords: ["TTP Hub", "Admin Dashboard", "Gestión Educativa", "Control Académico"],
  authors: [{ name: "TTP Hub" }],
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="es"
      className={`${inter.variable} ${montserrat.variable} h-full antialiased light`}
    >
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
        />
      </head>
      <body className="min-h-full bg-ttp-slateBg text-slate-900 font-inter antialiased">
        <GlobalUppercaseListener />
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: "#0f172a",
              color: "#f8fafc",
              border: "1px solid #1e293b",
              borderRadius: "14px",
              fontSize: "13px",
              fontWeight: "600",
              padding: "12px 16px",
              boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
            },
          }}
          richColors
          closeButton
        />
        <AuthGuard>{children}</AuthGuard>
      </body>
    </html>
  );
}
