import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import ChatSession from "@/models/ChatSession";
import AdminSession from "@/models/AdminSession";

async function verifyAdminAuth(request: NextRequest) {
  const sessionId = request.cookies.get("admin-session")?.value;

  if (!sessionId) {
    return false;
  }

  await connectDB();
  const session = await AdminSession.findOne({
    sessionId,
    isActive: true,
  });

  return !!session;
}

export async function GET(request: NextRequest) {
  try {
    const isAuthenticated = await verifyAdminAuth(request);

    if (!isAuthenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const status = searchParams.get("status") || "";
    const sessionType = searchParams.get("sessionType") || "";
    const sortBy = searchParams.get("sortBy") || "startTime";
    const sortOrder = searchParams.get("sortOrder") || "desc";

    await connectDB();

    // Build filter query
    const filterQuery: any = {};
    if (status && status !== "all") {
      filterQuery.status = status;
    }
    if (sessionType && sessionType !== "all") {
      filterQuery.sessionType = sessionType;
    }

    // Build sort object
    const sortObj: any = {};
    sortObj[sortBy] = sortOrder === "desc" ? -1 : 1;

    // Get sessions with pagination
    const sessions = await ChatSession.find(filterQuery)
      .sort(sortObj)
      .skip((page - 1) * limit)
      .limit(limit);

    // Get total count for pagination
    const totalSessions = await ChatSession.countDocuments(filterQuery);

    // Calculate duration for active sessions
    const sessionsWithDuration = sessions.map((session) => {
      const sessionObj = session.toObject();

      if (session.status === "active" && !session.duration) {
        const currentTime = new Date();
        const startTime = new Date(session.startTime);
        sessionObj.currentDuration = Math.floor(
          (currentTime.getTime() - startTime.getTime()) / 1000
        );
      }

      return sessionObj;
    });

    return NextResponse.json({
      sessions: sessionsWithDuration,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalSessions / limit),
        totalSessions,
        hasNext: page < Math.ceil(totalSessions / limit),
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    console.error("Admin sessions error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const isAuthenticated = await verifyAdminAuth(request);

    if (!isAuthenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json(
        { error: "Session ID is required" },
        { status: 400 }
      );
    }

    await connectDB();

    // End the session
    const updatedSession = await ChatSession.findOneAndUpdate(
      { sessionId },
      {
        status: "disconnected",
        endTime: new Date(),
        endReason: "admin_terminate",
      },
      { new: true }
    );

    if (!updatedSession) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Calculate duration if not already set
    if (!updatedSession.duration && updatedSession.endTime) {
      const startTime = new Date(updatedSession.startTime);
      const endTime = new Date(updatedSession.endTime);
      updatedSession.duration = Math.floor(
        (endTime.getTime() - startTime.getTime()) / 1000
      );
      await updatedSession.save();
    }

    return NextResponse.json({
      success: true,
      message: "Session terminated successfully",
    });
  } catch (error) {
    console.error("Admin terminate session error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
