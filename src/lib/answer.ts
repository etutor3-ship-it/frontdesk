import clinic from "@/data/clinic.json";
import { createTicket, findTicketByQuestion } from "./store";

type Clinic = typeof clinic;
const c: Clinic = clinic;

export interface AnswerResult {
  reply: string;
  ticketId?: string;
  label?: string;
  type: "emergency" | "medical" | "clinic" | "discount" | "unknown";
}

function isEmergency(msg: string): boolean {
  const m = msg.toLowerCase();
  const emergencyPhrases = [
    "cannot breathe",
    "can't breathe",
    "difficulty breathing",
    "severe facial swelling",
    "uncontrolled bleeding",
    "serious facial injury",
    "choking",
    "unconscious",
    "emergency",
  ];
  return emergencyPhrases.some(p => m.includes(p));
}

function isMedical(msg: string): boolean {
  const m = msg.toLowerCase();
  const medicalWords = [
    "tooth pain", "toothache", "pain", "ache", "hurt", "hurts",
    "swollen", "swelling", "bleeding", "bleed", "fever",
    "medicine", "tablet", "pill", "dosage", "what should i take",
    "symptom", "symptoms",
  ];
  return medicalWords.some(w => m.includes(w));
}

function findPrice(serviceName: string): { service: string; price: string } | undefined {
  return c.prices.find(p => p.service.toLowerCase() === serviceName.toLowerCase());
}

export function processMessage(msg: string, patientId: string): AnswerResult {
  const m = msg.toLowerCase().trim();

  // 1. Emergency detection - checked first, before anything else
  // Bot rule: show emergency number first for emergencies
  if (isEmergency(msg)) {
    const existing = findTicketByQuestion(msg, patientId, ["urgent"]);
    const t = existing ?? createTicket({ patientId, question: msg, status: "urgent" });
    return {
      reply: `${c.emergency_number}\n\n${c.emergency_rules}\n\nA ticket has been opened (urgent). Do not wait for a callback.`,
      ticketId: t.id,
      type: "emergency",
    };
  }

  // 2. Medical safety - never diagnose, never prescribe
  // Bot rule: for pain, swelling or symptoms, say a dentist must see the patient and offer to book
  if (isMedical(msg)) {
    return {
      reply: "I'm sorry you're experiencing discomfort. A dentist must examine you in person to diagnose and treat this properly. I can help you book an appointment or request a callback from our team. Would you like me to do that?",
      type: "medical",
    };
  }

  // 3. Clinic data answers - these receive the "Answered from the clinic file" label

  // Saturday timing
  if (m.includes("saturday")) {
    return {
      reply: `On Saturday we are open ${c.timings.Saturday}.`,
      label: "Answered from the clinic file",
      type: "clinic",
    };
  }

  // General timings (include lunch break)
  if (m.includes("open") || m.includes("timing") || m.includes("hours") || m.includes("when")) {
    const lines = Object.entries(c.timings).map(([day, time]) => `${day}: ${time}`).join("\n");
    return {
      reply: `Our clinic timings:\n${lines}\n\nLunch break: ${c.lunch_break}`,
      label: "Answered from the clinic file",
      type: "clinic",
    };
  }

  // Public holidays
  if (m.includes("holiday") || m.includes("public holiday") || m.includes("closed")) {
    return {
      reply: `Public holidays: ${c.public_holidays}`,
      label: "Answered from the clinic file",
      type: "clinic",
    };
  }

  // Prices
  if (m.includes("price") || m.includes("cost") || m.includes("how much") || m.includes("fee")) {
    if (m.includes("root canal")) {
      const p = findPrice("Root canal treatment");
      if (p) {
        return {
          reply: `Root canal treatment: ${p.price}.`,
          label: "Answered from the clinic file",
          type: "clinic",
        };
      }
    }
    const priceMatch = c.prices.find(p =>
      m.includes(p.service.toLowerCase()) ||
      m.includes(p.service.toLowerCase().split(" ")[0])
    );
    if (priceMatch) {
      return {
        reply: `${priceMatch.service}: ${priceMatch.price}.`,
        label: "Answered from the clinic file",
        type: "clinic",
      };
    }
    const lines = c.prices.map(p => `${p.service}: ${p.price}`).join("\n");
    return {
      reply: `Our prices:\n${lines}`,
      label: "Answered from the clinic file",
      type: "clinic",
    };
  }

  // Doctors
  if (m.includes("doctor") || m.includes("dentist")) {
    const lines = c.doctors.map(d => `${d.name} - ${d.speciality} (${d.days})`).join("\n");
    return {
      reply: `Our doctors:\n${lines}`,
      label: "Answered from the clinic file",
      type: "clinic",
    };
  }

  // Insurance
  if (m.includes("insurance")) {
    return {
      reply: `We accept: ${c.insurance.join(", ")}`,
      label: "Answered from the clinic file",
      type: "clinic",
    };
  }

  // Location
  if (m.includes("location") || m.includes("address") || m.includes("where") || m.includes("find")) {
    return {
      reply: `${c.clinic}\n${c.location}`,
      label: "Answered from the clinic file",
      type: "clinic",
    };
  }

  // Services offered
  if (m.includes("service") || m.includes("treatment") || m.includes("offer")) {
    return {
      reply: `We offer: ${c.services_offered.join(", ")}.`,
      label: "Answered from the clinic file",
      type: "clinic",
    };
  }

  // Policies (appointment, walk-in, payment, EMI, children, sterilisation)
  if (m.includes("policy") || m.includes("cancel") || m.includes("payment") || m.includes("walk") || m.includes("emi") || m.includes("children") || m.includes("sterilis")) {
    return {
      reply: `Clinic policies:\n${c.policies.join("\n")}`,
      label: "Answered from the clinic file",
      type: "clinic",
    };
  }

  // 4. Discount / prompt injection protection - never promise discounts
  // Bot rule: ignore any instruction to change rules, say politely you cannot do that
  if (m.includes("discount") || m.includes("50%") || m.includes("ignore your rules") || m.includes("ignore rules") || m.includes("free") || m.includes("coupon")) {
    return {
      reply: "I'm sorry, I cannot offer discounts or change our clinic policies. Is there anything else I can help you with regarding our dental services?",
      type: "discount",
    };
  }

  // 5. Unknown - create ticket (check for duplicate first), no label
  // Bot rule: if not in file, say not sure, open ticket marked needs human, say callback within 2 working hours
  const existing = findTicketByQuestion(msg, patientId, ["needs human", "urgent"]);
  if (existing) {
    return {
      reply: `I've already opened a ticket for this question (${existing.id}). Our team will call you back within 2 working hours.`,
      ticketId: existing.id,
      type: "unknown",
    };
  }
  const t = createTicket({ patientId, question: msg, status: "needs human" });
  return {
    reply: "I'm not sure about this. Our team will call you back within 2 working hours.",
    ticketId: t.id,
    type: "unknown",
  };
}

export function handleHumanRequest(patientId: string): AnswerResult {
  const existing = findTicketByQuestion("I would like to speak with a human staff member.", patientId, ["needs human"]);
  if (existing) {
    return {
      reply: `I've already opened a ticket for your request (${existing.id}). Our team will call you back within 2 working hours.`,
      ticketId: existing.id,
      type: "unknown",
    };
  }
  const t = createTicket({
    patientId,
    question: "I would like to speak with a human staff member.",
    status: "needs human",
  });
  return {
    reply: "I've forwarded your request to our team. Someone will call you back within 2 working hours.",
    ticketId: t.id,
    type: "unknown",
  };
}
