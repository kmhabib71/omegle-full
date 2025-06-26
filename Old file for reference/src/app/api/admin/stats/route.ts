import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import ChatSession from "@/models/ChatSession";
import SystemStats from "@/models/SystemStats";
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

    await connectDB();

    // Get current date stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Total users count
    const totalUsers = await User.countDocuments();

    // New registrations today
    const newRegistrationsToday = await User.countDocuments({
      createdAt: { $gte: today, $lt: tomorrow },
    });

    // Total sessions
    const totalSessions = await ChatSession.countDocuments();

    // Active sessions
    const activeSessions = await ChatSession.countDocuments({
      status: "active",
    });

    // Sessions today
    const sessionsToday = await ChatSession.countDocuments({
      startTime: { $gte: today, $lt: tomorrow },
    });

    // Text vs Video sessions today
    const textSessionsToday = await ChatSession.countDocuments({
      sessionType: "text",
      startTime: { $gte: today, $lt: tomorrow },
    });

    const videoSessionsToday = await ChatSession.countDocuments({
      sessionType: "video",
      startTime: { $gte: today, $lt: tomorrow },
    });

    // Average session duration (completed sessions only)
    const completedSessions = await ChatSession.find({
      status: { $in: ["ended", "disconnected"] },
      duration: { $exists: true, $gt: 0 },
    });

    const avgSessionDuration =
      completedSessions.length > 0
        ? completedSessions.reduce(
            (sum, session) => sum + (session.duration || 0),
            0
          ) / completedSessions.length
        : 0;

    // Recent sessions (last 10)
    const recentSessions = await ChatSession.find()
      .sort({ startTime: -1 })
      .limit(10)
      .select(
        "sessionId user1Id user2Id sessionType startTime endTime status duration interests"
      );

    // Popular interests
    const interestStats = await ChatSession.aggregate([
      { $unwind: "$interests" },
      { $group: { _id: "$interests", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    // User registration stats (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const registrationStats = await User.aggregate([
      {
        $match: {
          createdAt: { $gte: sevenDaysAgo },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Session stats (last 7 days)
    const sessionStats = await ChatSession.aggregate([
      {
        $match: {
          startTime: { $gte: sevenDaysAgo },
        },
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: "%Y-%m-%d", date: "$startTime" } },
            type: "$sessionType",
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.date": 1 } },
    ]);

    const stats = {
      overview: {
        totalUsers,
        newRegistrationsToday,
        totalSessions,
        activeSessions,
        sessionsToday,
        textSessionsToday,
        videoSessionsToday,
        avgSessionDuration: Math.round(avgSessionDuration),
      },
      recentSessions,
      popularInterests: interestStats.map((item) => ({
        interest: item._id,
        count: item.count,
      })),
      charts: {
        registrations: registrationStats,
        sessions: sessionStats,
      },
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error("Admin stats error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
