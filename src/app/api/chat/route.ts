import { NextResponse } from "next/server";
import { processMessage, handleHumanRequest } from "@/lib/answer";

const MAX_MESSAGE_LENGTH = 2000;
const PATIENT_ID_PATTERN = /^[a-zA-Z0-9_-]{1,50}$/;

function validatePatientId(pid: string): string {
  if (!PATIENT_ID_PATTERN.test(pid)) {
    return "anon";
  }
  return pid;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { message, patientId, humanRequest, context } = body as {
      message?: string;
      patientId?: string;
      humanRequest?: boolean;
      context?: Array<{ role: string; content: string }>;
    };

    // Validate message
    if (humanRequest !== true && (!message || typeof message !== "string" || message.trim().length === 0)) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    if (message && message.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json({ error: "Message too long" }, { status: 400 });
    }

    // Validate and sanitize patientId
    const pid = patientId && typeof patientId === "string" ? validatePatientId(patientId) : "anon";

    const msg = String(message || "").trim();

    // Build conversation context for the AI (patient + bot turns only)
    const aiContext = (context || [])
      .filter((c: { role: string; content: string }) => c.role === "patient" || c.role === "bot")
      .map((c: { role: string; content: string }) => ({
        role: (c.role === "bot" ? "assistant" : "user") as "system" | "user" | "assistant",
        content: c.content,
      }));

    if (humanRequest) {
      const result = handleHumanRequest(pid);
      return NextResponse.json(result);
    }

    const result = await processMessage(msg, pid, aiContext);
    // Only return safe fields to the patient
    return NextResponse.json({
      reply: result.reply,
      label: result.label,
      ticketId: result.ticketId,
      type: result.type,
    });
  } catch (err) {
    console.error("Chat error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "Invalid request", detail: process.env.NODE_ENV === "development" ? message : undefined }, { status: 400 });
  }
}
