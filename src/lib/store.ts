import { db } from "./db";

export type TicketStatus = "needs human" | "urgent" | "answered" | "closed";

export type TicketReply = {
  id: number;
  from: "staff" | "patient";
  text: string;
  at: string;
};

export type Ticket = {
  id: string;
  patientId: string;
  question: string;
  status: TicketStatus;
  replies: TicketReply[];
  createdAt: string;
};

export function listTickets(): Ticket[] {
  const rows = db.prepare(
    "SELECT id, patient_id, question, status, created_at FROM tickets ORDER BY created_at DESC"
  ).all() as Array<{
    id: string;
    patient_id: string;
    question: string;
    status: TicketStatus;
    created_at: string;
  }>;

  return rows.map((row) => {
    const replies = db.prepare(
      "SELECT id, from_role, text, created_at as at FROM ticket_replies WHERE ticket_id = ? ORDER BY created_at ASC"
    ).all(row.id) as Array<{
      id: number;
      from_role: "staff" | "patient";
      text: string;
      at: string;
    }>;

    return {
      id: row.id,
      patientId: row.patient_id,
      question: row.question,
      status: row.status,
      replies: replies.map((r) => ({
        id: r.id,
        from: r.from_role,
        text: r.text,
        at: r.at,
      })),
      createdAt: row.created_at,
    };
  });
}

export function getTicket(id: string): Ticket | undefined {
  const row = db.prepare(
    "SELECT id, patient_id, question, status, created_at FROM tickets WHERE id = ?"
  ).get(id) as {
    id: string;
    patient_id: string;
    question: string;
    status: TicketStatus;
    created_at: string;
  } | undefined;

  if (!row) return undefined;

  const replies = db.prepare(
    "SELECT id, from_role, text, created_at as at FROM ticket_replies WHERE ticket_id = ? ORDER BY created_at ASC"
  ).all(row.id) as Array<{
    id: number;
    from_role: "staff" | "patient";
    text: string;
    at: string;
  }>;

  return {
    id: row.id,
    patientId: row.patient_id,
    question: row.question,
    status: row.status,
    replies: replies.map((r) => ({
      id: r.id,
      from: r.from_role,
      text: r.text,
      at: r.at,
    })),
    createdAt: row.created_at,
  };
}

export function findTicketByQuestion(
  question: string,
  patientId: string,
  statuses: TicketStatus[]
): Ticket | undefined {
  const placeholders = statuses.map(() => "?").join(",");
  const row = db.prepare(
    `SELECT id, patient_id, question, status, created_at FROM tickets
     WHERE question = ? AND patient_id = ? AND status IN (${placeholders})
     LIMIT 1`
  ).get(question, patientId, ...statuses) as {
    id: string;
    patient_id: string;
    question: string;
    status: TicketStatus;
    created_at: string;
  } | undefined;

  if (!row) return undefined;

  const replies = db.prepare(
    "SELECT id, from_role, text, created_at as at FROM ticket_replies WHERE ticket_id = ? ORDER BY created_at ASC"
  ).all(row.id) as Array<{
    id: number;
    from_role: "staff" | "patient";
    text: string;
    at: string;
  }>;

  return {
    id: row.id,
    patientId: row.patient_id,
    question: row.question,
    status: row.status,
    replies: replies.map((r) => ({
      id: r.id,
      from: r.from_role,
      text: r.text,
      at: r.at,
    })),
    createdAt: row.created_at,
  };
}

export function createTicket(t: Omit<
  Ticket,
  "id" | "createdAt" | "replies"
> & { replies?: TicketReply[] }): Ticket {
  // Generate next ticket ID based on max existing ID
  const maxIdRow = db.prepare("SELECT MAX(CAST(SUBSTR(id, 2) AS INTEGER)) as maxId FROM tickets").get() as {
    maxId: number | null;
  };
  const nextNum = (maxIdRow.maxId || 0) + 1;
  const ticketId = `T${String(nextNum).padStart(4, "0")}`;
  const now = new Date().toISOString();

  const insertTicket = db.prepare(
    "INSERT INTO tickets (id, patient_id, question, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
  );
  insertTicket.run(
    ticketId,
    t.patientId,
    t.question,
    t.status,
    now,
    now
  );

  if (t.replies && t.replies.length > 0) {
    const insertReply = db.prepare(
      "INSERT INTO ticket_replies (ticket_id, from_role, text, created_at) VALUES (?, ?, ?, ?)"
    );
    for (const r of t.replies) {
      insertReply.run(ticketId, r.from, r.text, r.at || now);
    }
  }

  return getTicket(ticketId)!;
}

export function addReply(
  id: string,
  from: "staff" | "patient",
  text: string
): Ticket | undefined {
  const ticket = getTicket(id);
  if (!ticket) return undefined;

  const now = new Date().toISOString();
  const insertReply = db.prepare(
    "INSERT INTO ticket_replies (ticket_id, from_role, text, created_at) VALUES (?, ?, ?, ?)"
  );
  insertReply.run(id, from, text, now);

  if (from === "staff") {
    db.prepare("UPDATE tickets SET status = 'answered', updated_at = ? WHERE id = ?").run(
      now,
      id
    );
  }

  return getTicket(id);
}

export function setStatus(
  id: string,
  status: TicketStatus
): Ticket | undefined {
  const ticket = getTicket(id);
  if (!ticket) return undefined;

  const now = new Date().toISOString();
  db.prepare("UPDATE tickets SET status = ?, updated_at = ? WHERE id = ?").run(
    status,
    now,
    id
  );

  return getTicket(id);
}
