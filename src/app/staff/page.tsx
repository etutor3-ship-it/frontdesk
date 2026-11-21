"use client";
import { useState, useEffect } from "react";

type TicketStatus = "needs human" | "urgent" | "answered" | "closed";

type Filter = "all" | "urgent" | "needs human" | "resolved";

type TicketReply = {
  from: "staff" | "patient";
  text: string;
  at: string;
};

type Ticket = {
  id: string;
  patientId: string;
  question: string;
  status: TicketStatus;
  replies: TicketReply[];
  createdAt: string;
};

const FILTERS: Filter[] = ["all", "urgent", "needs human", "resolved"];

export default function Staff() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [replies, setReplies] = useState<Record<string, string>>({});
  const [statuses, setStatuses] = useState<Record<string, TicketStatus>>({});
  const [loading, setLoading] = useState(false);
  const [staffUser, setStaffUser] = useState<{ id: number; username: string } | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth/session");
        const data = await res.json();
        if (data.authenticated && data.user) {
          setStaffUser(data.user);
        } else {
          window.location.href = "/login";
        }
      } catch {
        window.location.href = "/login";
      } finally {
        setAuthChecked(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!authChecked) return;
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/tickets");
        const data = await res.json();
        if (mounted) {
          setTickets(data);
          data.forEach((t: Ticket) => {
            if (!statuses[t.id]) {
              setStatuses(prev => ({ ...prev, [t.id]: t.status }));
            }
          });
        }
      } catch {
        // ignore
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    const iv = setInterval(() => {
      (async () => {
        try {
          const res = await fetch("/api/tickets");
          const data = await res.json();
          if (mounted) setTickets(data);
        } catch {
          // ignore
        }
      })();
    }, 5000);
    return () => { mounted = false; clearInterval(iv); };
  }, [authChecked, statuses]);

  const filtered = tickets.filter(t => {
    if (filter === "all") return true;
    if (filter === "urgent") return t.status === "urgent";
    if (filter === "needs human") return t.status === "needs human";
    if (filter === "resolved") return t.status === "answered" || t.status === "closed";
    return true;
  });

  const statusColor = (s: TicketStatus) => {
    switch (s) {
      case "urgent": return "bg-red-100 text-red-700 border border-red-200";
      case "needs human": return "bg-amber-100 text-amber-700 border border-amber-200";
      case "answered": return "bg-green-100 text-green-700 border border-green-200";
      case "closed": return "bg-gray-100 text-gray-700 border border-gray-200";
    }
  };

  async function sendReply(id: string) {
    const text = replies[id];
    if (!text || !text.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId: id, reply: text.trim() }),
      });
      if (!res.ok) return;
      const t = await res.json();
      setReplies(prev => ({ ...prev, [id]: "" }));
      setStatuses(prev => ({ ...prev, [id]: (t as Ticket).status }));
      await refreshTickets();
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  async function changeStatus(id: string, newStatus: TicketStatus) {
    setLoading(true);
    try {
      await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId: id, status: newStatus }),
      });
      setStatuses(prev => ({ ...prev, [id]: newStatus }));
      await refreshTickets();
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  async function refreshTickets() {
    try {
      const res = await fetch("/api/tickets");
      const data = await res.json();
      setTickets(data);
    } catch {
      // ignore
    }
  }

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // ignore
    } finally {
      window.location.href = "/login";
    }
  }

  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-indigo-600 text-white px-4 py-3 shadow-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-indigo-600 font-bold text-xs">FD</div>
            <div>
              <div className="font-semibold text-sm">FrontDesk — Staff Dashboard</div>
              <div className="text-xs opacity-90">Smile Dental Clinic, Banjara Hills, Hyderabad</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-xs opacity-90">
              {staffUser?.username} ({tickets.length} tickets)
            </div>
            <button
              onClick={handleLogout}
              className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-4">
        <div className="flex flex-wrap gap-2 mb-4">
          {FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full text-sm border ${
                filter === f
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
              }`}
            >
              {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {filtered.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-sm">No tickets found.</div>
          ) : (
            filtered.map(t => (
              <div key={t.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-indigo-600">{t.id}</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${statusColor(t.status)}`}>
                        {t.status}
                      </span>
                    </div>
                    <div className="text-sm text-gray-900 break-words">{t.question}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      Created: {new Date(t.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex items-end gap-2">
                    <select
                      value={statuses[t.id] || t.status}
                      onChange={e => changeStatus(t.id, e.target.value as TicketStatus)}
                      className="text-xs border rounded px-2 py-1 bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                      <option value="needs human">Needs Human</option>
                      <option value="urgent">Urgent</option>
                      <option value="answered">Answered</option>
                      <option value="closed">Closed</option>
                    </select>
                  </div>
                </div>

                <div className="px-4 py-3">
                  {t.replies.length === 0 ? (
                    <div className="text-xs text-gray-400 text-center py-2">No replies yet</div>
                  ) : (
                    <div className="space-y-2">
                      {t.replies.map((r, i) => (
                        <div key={i} className={`flex gap-2 ${r.from === "staff" ? "justify-end" : "justify-start"}`}>
                          <div className={`text-xs px-3 py-1.5 rounded-lg ${
                            r.from === "staff" ? "bg-indigo-100 text-indigo-700" : "bg-gray-100 text-gray-700"
                          }`}>
                            {r.text}
                          </div>
                          <div className="text-[10px] text-gray-400 mt-0.5">
                            {r.from === "staff" ? "Staff" : "Patient"} · {new Date(r.at).toLocaleString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="px-4 py-3 border-t border-gray-100">
                  <div className="flex gap-2">
                    <input
                      className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                      value={replies[t.id] || ""}
                      onChange={e => setReplies(prev => ({ ...prev, [t.id]: e.target.value }))}
                      placeholder="Type your reply..."
                      disabled={loading}
                    />
                    <button
                      onClick={() => sendReply(t.id)}
                      disabled={loading || !replies[t.id]?.trim()}
                      className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed hover:bg-indigo-700 transition-colors"
                    >
                      Send
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="mt-8 text-xs text-gray-500 text-center">
          <p>Tickets are stored in a persistent SQLite database.</p>
          <p>Production deployment requires HTTPS, rate limiting, and regular security audits.</p>
        </div>
      </div>
    </div>
  );
}
