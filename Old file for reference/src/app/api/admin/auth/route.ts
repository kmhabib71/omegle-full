import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import AdminSession from "@/models/AdminSession";
import { randomUUID } from "crypto";

const ADMIN_PASSWORD = "admin123";

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json();

    if (!password) {
      return NextResponse.json(
        { error: "Password is required" },
        { status: 400 }
      );
    }

    if (password !== ADMIN_PASSWORD) {
      return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    }

    await connectDB();

    // Create admin session
    const sessionId = randomUUID();
    const ipAddress =
      request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const userAgent = request.headers.get("user-agent") || "unknown";

    const adminSession = await AdminSession.create({
      sessionId,
      ipAddress,
      userAgent,
    });

    const response = NextResponse.json({
      success: true,
      sessionId,
      message: "Admin authenticated successfully",
    });

    // Set secure cookie
    response.cookies.set("admin-session", sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    });

    return response;
  } catch (error) {
    console.error("Admin auth error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const sessionId = request.cookies.get("admin-session")?.value;

    if (!sessionId) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    await connectDB();

    const session = await AdminSession.findOne({
      sessionId,
      isActive: true,
    });

    if (!session) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    // Update last activity
    session.lastActivity = new Date();
    await session.save();

    return NextResponse.json({
      authenticated: true,
      sessionId,
    });
  } catch (error) {
    console.error("Admin auth check error:", error);
    return NextResponse.json({ authenticated: false }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const sessionId = request.cookies.get("admin-session")?.value;

    if (sessionId) {
      await connectDB();
      await AdminSession.updateOne({ sessionId }, { isActive: false });
    }

    const response = NextResponse.json({
      success: true,
      message: "Logged out successfully",
    });

    response.cookies.delete("admin-session");

    return response;
  } catch (error) {
    console.error("Admin logout error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
