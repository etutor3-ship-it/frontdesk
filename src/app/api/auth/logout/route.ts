import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { destroySession } from "@/lib/auth";

export async function POST() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("session_id")?.value;
  if (sessionId) {
    destroySession(sessionId);
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set("session_id", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });

  return response;
}
