import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { addReply, setStatus, listTickets } from "@/lib/store";
import { getSession } from "@/lib/auth";

async function getStaffId(): Promise<number | null> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("session_id")?.value;
  if (!sessionId) return null;
  const session = getSession(sessionId);
  return session ? session.id : null;
}

export async function GET() {
  const staffId = await getStaffId();
  if (!staffId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(listTickets());
}

export async function POST(req: Request) {
  const staffId = await getStaffId();
  if (!staffId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { ticketId, reply, status } = body;

  if (status) {
    const t = setStatus(ticketId, status);
    if (!t) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }
    return NextResponse.json(t);
  }

  if (!reply || typeof reply !== "string" || !reply.trim()) {
    return NextResponse.json({ error: "Reply text is required" }, { status: 400 });
  }

  const t = addReply(ticketId, "staff", reply.trim());
  if (!t) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }
  return NextResponse.json(t);
}
