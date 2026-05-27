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

  // Función interna para actualizar el estado offline en localStorage
  const updateLocalState = (isSuccess) => {
    if (typeof window === "undefined") return;

    // 1. Actualizar el alumno en ttp_students_local
    const storedStudents = localStorage.getItem("ttp_students_local");
    if (storedStudents && payload.studentId) {
      try {
        const students = JSON.parse(storedStudents);
        const updatedStudents = students.map(s => {
          if (s.id === payload.studentId) {
            return {
              ...s,
              status: isSuccess ? "active" : "moroso",
              payment_status: isSuccess ? "al_corriente" : "pago_fallido",
              amount_due: isSuccess ? 0 : amount,
              last_payment_date: isSuccess ? new Date().toISOString().split("T")[0] : s.last_payment_date
            };
          }
          return s;
        });
        localStorage.setItem("ttp_students_local", JSON.stringify(updatedStudents));
      } catch (e) {
        console.error("Error updating local students in webhook simulation:", e);
      }
    }

    // 2. Agregar la transacción correspondiente en ttp_transactions_local
    const storedTransactions = localStorage.getItem("ttp_transactions_local");
    let transactions = [];
    if (storedTransactions) {
      try {
        transactions = JSON.parse(storedTransactions);
      } catch (e) {}
    }

    const newTx = {
      id: `t-webhook-${Date.now()}`,
      description: isSuccess 
        ? `Pago en Línea Stripe - Colegiatura - ${studentName}` 
        : `Pago Fallido Stripe - Colegiatura - ${studentName}`,
      amount: amount,
      status: isSuccess ? "processed" : "overdue",
      category: "Colegiatura Mensual",
      date: new Date().toLocaleDateString("es-ES", {
        day: "numeric",
        month: "short",
        year: "numeric"
      })
    };

    transactions = [newTx, ...transactions];
    localStorage.setItem("ttp_transactions_local", JSON.stringify(transactions));
  };

  if (eventType === "invoice.payment_succeeded") {
    // 1. Registrar la transacción en la tabla billing_transactions en Supabase
    try {
      const { error: insertErr } = await supabase
        .from("billing_transactions")
        .insert([
          {
            description: `Pago en Línea Stripe - Colegiatura - ${studentName}`,
            amount: amount,
            status: "processed",
            category: "Colegiatura Mensual"
          }
        ]);
      
      if (insertErr) throw insertErr;

      // 2. Actualizar el estatus del alumno a "active"
      if (payload.studentId) {
        const { error: updateErr } = await supabase
          .from("students")
          .update({
            status: "active",
            amount_due: 0.00,
            last_payment_date: new Date().toISOString().split("T")[0]
          })
          .eq("id", payload.studentId);

        if (updateErr) throw updateErr;
      }

      // Sincronizar localmente también por consistencia
      updateLocalState(true);
      showToast(`⚡ Webhook Stripe: Pago de $${amount} de ${studentName} registrado con éxito.`);
    } catch (err) {
      console.warn("Error en actualización de base de datos de Supabase. Aplicando Simulación local exitosa.");
      updateLocalState(true);
      showToast(`⚡ Webhook Stripe (Simulado): Pago de $${amount} de ${studentName} aprobado.`);
    }

  } else if (eventType === "invoice.payment_failed") {
    // 1. Actualizar el estatus del alumno a "moroso" en la base de datos
    try {
      if (payload.studentId) {
        const { error: updateErr } = await supabase
          .from("students")
          .update({
            status: "moroso",
            amount_due: amount
          })
          .eq("id", payload.studentId);

        if (updateErr) throw updateErr;
      }
      
      updateLocalState(false);
      showToast(`⚠️ Webhook Stripe: Pago fallido por $${amount} de ${studentName}. Alumno marcado como moroso.`);
    } catch (err) {
      console.warn("Fallo actualización local de webhook para pago fallido.");
      updateLocalState(false);
      showToast(`⚠️ Webhook Stripe (Simulado): Pago fallido por $${amount} de ${studentName}.`);
    }
  }

  // Ejecutar callback para refrescar la interfaz
  if (refreshCallback) {
    refreshCallback();
  }
}
