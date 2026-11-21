"use client";
import { useState, useEffect, useRef } from "react";

type Msg = { from: "patient" | "bot" | "staff"; text: string; label?: string };

export default function Home() {
  const [msgs, setMsgs] = useState<Msg[]>([{ from: "bot", text: "Hello! I'm the FrontDesk AI assistant for Smile Dental Clinic, Banjara Hills, Hyderabad. How can I help you today?" }]);
  const [input, setInput] = useState("");
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [patientId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const stored = localStorage.getItem("frontdesk_patient_id");
    if (stored) return stored;
    const id = "P" + Math.random().toString(36).slice(2, 10);
    localStorage.setItem("frontdesk_patient_id", id);
    return id;
  });
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [msgs]);

  // Poll for staff replies on open tickets
  useEffect(() => {
    if (!ticketId || !patientId) return;
    const iv = setInterval(async () => {
      try {
        const r = await fetch("/api/tickets");
        const all = await r.json();
        const t = all.find((x: { id: string; replies: { from: string; text: string }[] }) => x.id === ticketId);
        if (t) {
          const staffReplies = t.replies.filter((x: { from: string }) => x.from === "staff");
          setMsgs(prev => {
            const existingStaffTexts = new Set(prev.filter(m => m.from === "staff").map(m => m.text));
            const newOnes = staffReplies.filter((x: { text: string }) => !existingStaffTexts.has(x.text));
            if (newOnes.length > 0) {
              return [...prev, ...newOnes.map((x: { text: string }) => ({ from: "staff" as const, text: x.text }))];
            }
            return prev;
          });
        }
      } catch {
        // ignore poll errors
      }
    }, 3000);
    return () => clearInterval(iv);
  }, [ticketId, patientId]);

  async function send() {
    if (!input.trim() || !patientId || sending) return;
    setSending(true);
    const text = input;
    setInput("");
    setMsgs(prev => [...prev, { from: "patient", text }]);
    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, patientId }),
      });
      const data = await r.json();
      setMsgs(prev => [...prev, { from: "bot", text: data.reply, label: data.label }]);
      if (data.ticketId) setTicketId(data.ticketId);
    } catch {
      setMsgs(prev => [...prev, { from: "bot", text: "Sorry, something went wrong. Please try again." }]);
    } finally {
      setSending(false);
    }
  }

  async function requestHuman() {
    if (!patientId || sending) return;
    setSending(true);
    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "", patientId, humanRequest: true }),
      });
      const data = await r.json();
      setMsgs(prev => [...prev, { from: "bot", text: data.reply, label: data.label }]);
      if (data.ticketId) setTicketId(data.ticketId);
    } catch {
      setMsgs(prev => [...prev, { from: "bot", text: "Sorry, couldn't submit your request. Please try again." }]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <header className="bg-indigo-600 text-white px-4 py-3 shadow-sm">
        <div className="max-w-xl mx-auto flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-indigo-600 font-bold text-xs">FD</div>
          <div>
            <div className="font-semibold text-sm">Smile Dental Clinic</div>
            <div className="text-xs opacity-90">Banjara Hills, Hyderabad</div>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-4 space-y-3" ref={scrollRef}>
        {msgs.map((m, i) => {
          const isPatient = m.from === "patient";
          const isStaff = m.from === "staff";
          return (
            <div key={i} className="flex w-full animate-in fade-in slide-in-from-bottom-2 duration-200">
              {isPatient ? (
                <div className="ml-auto">
                  <div className="inline-block bg-indigo-600 text-white text-sm px-4 py-2.5 rounded-lg rounded-tl-none shadow-sm whitespace-pre-wrap break-words max-w-[85%]">
                    {m.text}
                  </div>
                  <div className="text-[10px] text-indigo-500 text-right mt-0.5 pr-1">You</div>
                </div>
              ) : (
                <div className="mr-auto">
                  <div className={`inline-block text-sm px-4 py-2.5 rounded-lg rounded-tr-none shadow-sm whitespace-pre-wrap break-words max-w-[85%] ${isStaff ? "bg-green-100 text-green-900 border border-green-200" : "bg-white text-gray-900 border border-gray-200"}`}>
                    {m.text}
                  </div>
                  {m.label && (
                    <div className="text-[10px] text-indigo-500 mt-0.5 italic pr-1">{m.label}</div>
                  )}
                  <div className={`text-[10px] mt-0.5 ${isStaff ? "text-green-600" : "text-indigo-500"}`}>
                    {isStaff ? "Staff" : "FrontDesk AI"}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </main>

      <div className="border-t bg-white px-4 py-3 shadow-inner">
        <div className="max-w-xl mx-auto">
          <div className="flex items-end gap-2">
            <input
              className="flex-1 border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none placeholder-gray-400"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && send()}
              placeholder="Type your question..."
              disabled={sending}
            />
            <button
              className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              onClick={send}
              disabled={sending || !input.trim()}
            >
              Send
            </button>
          </div>
          <button
            className="mt-3 w-full border border-gray-300 rounded-xl px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            onClick={requestHuman}
            disabled={sending}
          >
            {sending ? "Submitting..." : "Request human assistance"}
          </button>
          {ticketId && (
            <div className="mt-2 text-xs text-gray-500">
              Ticket #{ticketId} — our team will respond shortly
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
