import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const { to, subject, text, html } = await request.json();

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "La llave API de Resend (RESEND_API_KEY) no está configurada en el servidor (.env.local)." },
        { status: 500 }
      );
    }

    // Call Resend API directly using native fetch to keep dependencies light and compile 100% cleanly
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || "TTP Hub <onboarding@resend.dev>", // Custom domain can be used when verified in Resend dashboard and added as RESEND_FROM_EMAIL env var.
        to: [to],
        subject: subject,
        text: text,
        html: html || `<div style="font-family: sans-serif; color: #1e293b; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px dashed #e2e8f0; border-radius: 16px;">${text.replace(/\n/g, "<br>")}</div>`,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.message || "Error al enviar correo mediante Resend API." },
        { status: response.status }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
