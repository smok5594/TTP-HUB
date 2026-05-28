import { supabase } from "./supabaseClient";

/**
 * TTP Hub - Stripe Automation & Webhook Simulator
 * Emulates live Stripe transactions, failed cards, and triggers Supabase state changes.
 */

// Generates a mock Stripe Checkout URL
export function generateCheckoutUrl(studentId, courseName, amount) {
  return `https://checkout.stripe.com/pay/cs_test_${Math.random().toString(36).substring(2)}?student=${studentId}&amount=${amount}`;
}

// Simulates a programmatic charge via Stripe API
export async function simulateStripeCharge(student, amount, isSuccessful = true) {
  const chargeId = `ch_test_${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
  
  const mockCharge = {
    id: chargeId,
    amount: amount,
    currency: "mxn",
    status: isSuccessful ? "succeeded" : "failed",
    payment_method_details: {
      type: "card",
      card: {
        brand: "visa",
        last4: String(Math.floor(1000 + Math.random() * 9000)),
        exp_month: 12,
        exp_year: 2028
      }
    },
    receipt_url: `https://stripe.com/receipts/acct_1032/${chargeId}`,
    created: Math.floor(Date.now() / 1000)
  };

  return mockCharge;
}

/**
 * Triggers a simulated Stripe Webhook and updates the Supabase schema or local states
 * Types: "invoice.payment_succeeded", "invoice.payment_failed"
 */
export async function handleMockWebhookEvent(eventType, payload, showToast, refreshCallback) {
  console.log(`[Stripe Webhook] Recibido evento simulado: ${eventType}`);

  const studentName = payload.studentName || "Estudiante";
  const studentEmail = payload.studentEmail || "student@email.com";
  const amount = Number(payload.amount) || 2450.00;

  if (eventType === "invoice.payment_succeeded") {
    try {
      const { error: insertErr } = await supabase.from("billing_transactions").insert([{
        description: `Pago en Línea Stripe - Colegiatura - ${studentName}`,
        amount,
        status: "processed",
        category: "Colegiatura Mensual",
        student_id: payload.studentId || null,
        student_name: studentName,
        type: "payment",
        method: "Stripe"
      }]);
      if (insertErr) throw insertErr;

      if (payload.studentId) {
        await supabase.from("students").update({
          status: "active",
          payment_status: "al_corriente",
          amount_due: 0,
          last_payment_date: new Date().toISOString().split("T")[0]
        }).eq("id", payload.studentId);
      }

      showToast(`⚡ Webhook Stripe: Pago de $${amount} de ${studentName} registrado con éxito.`);
    } catch (err) {
      showToast(`⛔ Error al registrar pago Stripe: ${err.message}`);
    }

  } else if (eventType === "invoice.payment_failed") {
    try {
      if (payload.studentId) {
        await supabase.from("students").update({
          status: "moroso",
          payment_status: "moroso",
          amount_due: amount
        }).eq("id", payload.studentId);
      }
      showToast(`⚠️ Webhook Stripe: Pago fallido por $${amount} de ${studentName}. Alumno marcado como moroso.`);
    } catch (err) {
      showToast(`⛔ Error al registrar pago fallido: ${err.message}`);
    }
  }

  // Ejecutar callback para refrescar la interfaz
  if (refreshCallback) {
    refreshCallback();
  }
}
