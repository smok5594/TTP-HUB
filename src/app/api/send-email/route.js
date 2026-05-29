import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { supabase } from "@/utils/supabaseClient";

export async function POST(request) {
  try {
    const { to, subject, text, html } = await request.json();

    let gmailUser = process.env.GMAIL_USER;
    let gmailPass = process.env.GMAIL_PASS;

    // Fallback: Si no existen en environment variables, consultar la base de datos
    if (!gmailUser || !gmailPass) {
      try {
        const { data, error } = await supabase
          .from("system_settings")
          .select("*");
        if (!error && data) {
          const dbUser = data.find(item => item.key === "GMAIL_USER")?.value;
          const dbPass = data.find(item => item.key === "GMAIL_PASS")?.value;
          if (dbUser) gmailUser = dbUser;
          if (dbPass) gmailPass = dbPass;
        }
      } catch (e) {
        console.error("Error al obtener configuraciones de correo de la base de datos:", e);
      }
    }

    if (!gmailUser || !gmailPass) {
      return NextResponse.json(
        { 
          error: "Las credenciales de Gmail SMTP no están configuradas. Por favor, confíguralas en tu panel de control (Configuración > Correo de Sistema) o mediante variables de entorno." 
        },
        { status: 500 }
      );
    }

    // Configure Nodemailer transporter with secure Gmail SMTP settings
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: gmailUser,
        pass: gmailPass, // This must be a 16-character Google App Password (Contraseña de Aplicación)
      },
    });

    const mailOptions = {
      from: `"TTP Hub Portal" <${gmailUser}>`,
      to: to,
      subject: subject,
      text: text,
      html: html || `<div style="font-family: sans-serif; color: #1e293b; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px dashed #e2e8f0; border-radius: 16px;">${text.replace(/\n/g, "<br>")}</div>`,
    };

    // Send email asynchronously
    const info = await transporter.sendMail(mailOptions);

    return NextResponse.json({ success: true, messageId: info.messageId });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
