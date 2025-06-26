import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
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
    const search = searchParams.get("search") || "";
    const sortBy = searchParams.get("sortBy") || "createdAt";
    const sortOrder = searchParams.get("sortOrder") || "desc";

    await connectDB();

    // Build search query
    const searchQuery: any = {};
    if (search) {
      searchQuery.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    // Build sort object
    const sortObj: any = {};
    sortObj[sortBy] = sortOrder === "desc" ? -1 : 1;

    // Get users with pagination
    const users = await User.find(searchQuery)
      .select("-password")
      .sort(sortObj)
      .skip((page - 1) * limit)
      .limit(limit);

    // Get total count for pagination
    const totalUsers = await User.countDocuments(searchQuery);

    // Get user session stats
    const usersWithStats = await Promise.all(
      users.map(async (user) => {
        const sessionStats = await ChatSession.aggregate([
          {
            $match: {
              $or: [
                { user1Id: user._id.toString() },
                { user2Id: user._id.toString() },
              ],
            },
          },
          {
            $group: {
              _id: null,
              totalSessions: { $sum: 1 },
              activeSessions: {
                $sum: {
                  $cond: [{ $eq: ["$status", "active"] }, 1, 0],
                },
              },
              textSessions: {
                $sum: {
                  $cond: [{ $eq: ["$sessionType", "text"] }, 1, 0],
                },
              },
              videoSessions: {
                $sum: {
                  $cond: [{ $eq: ["$sessionType", "video"] }, 1, 0],
                },
              },
              avgDuration: {
                $avg: {
                  $cond: [
                    {
                      $and: [
                        { $ne: ["$duration", null] },
                        { $gt: ["$duration", 0] },
                      ],
                    },
                    "$duration",
                    null,
                  ],
                },
              },
            },
          },
        ]);

        const stats = sessionStats[0] || {
          totalSessions: 0,
          activeSessions: 0,
          textSessions: 0,
          videoSessions: 0,
          avgDuration: 0,
        };

        return {
          ...user.toObject(),
          stats: {
            totalSessions: stats.totalSessions,
            activeSessions: stats.activeSessions,
            textSessions: stats.textSessions,
            videoSessions: stats.videoSessions,
            avgDuration: Math.round(stats.avgDuration || 0),
          },
        };
      })
    );

    return NextResponse.json({
      users: usersWithStats,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalUsers / limit),
        totalUsers,
        hasNext: page < Math.ceil(totalUsers / limit),
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    console.error("Admin users error:", error);
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
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    await connectDB();

    // Delete user
    const deletedUser = await User.findByIdAndDelete(userId);

    if (!deletedUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Also end any active sessions for this user
    await ChatSession.updateMany(
      {
        $or: [{ user1Id: userId }, { user2Id: userId }],
        status: "active",
      },
      {
        status: "disconnected",
        endTime: new Date(),
        endReason: "admin_delete",
      }
    );

    return NextResponse.json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    console.error("Admin delete user error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
