import { NextResponse } from "next/server";
import { verifyStaffUser, createSession, cleanupExpiredSessions } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const { username, password } = await req.json();
    if (!username || !password) {
      return NextResponse.json({ error: "Username and password are required" }, { status: 400 });
    }

    const user = verifyStaffUser(username, password);
    if (!user) {
      return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
    }

    cleanupExpiredSessions();
    const { sessionId } = createSession(user.id);

    const response = NextResponse.json({ success: true, user: { id: user.id, username: user.username } });
    response.cookies.set("session_id", sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 4 * 60 * 60,
      path: "/",
    });

    return response;
  } catch (err) {
    console.error("Login error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "Login failed", detail: process.env.NODE_ENV === "development" ? message : undefined }, { status: 500 });
  }
}
