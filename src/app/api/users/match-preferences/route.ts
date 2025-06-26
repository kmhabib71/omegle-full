import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();

    const body = await request.json();
    const { matchGender, matchCountry, matchInterest } = body;

    // Update user preferences
    const updateData: any = {};

    if (matchGender !== undefined) {
      updateData.matchGender = matchGender;
    }

    if (matchCountry !== undefined) {
      updateData.matchCountry = matchCountry;
    }

    if (matchInterest !== undefined) {
      updateData.matchInterest = matchInterest || [];
    }

    // First check if user exists, if not create them
    let user = await User.findOne({ email: session.user.email });

    if (!user) {
      // Create user if they don't exist (this can happen with Google auth)
      user = await User.create({
        name: session.user.name || "User",
        email: session.user.email,
        image: session.user.image,
        provider: "google",
        emailVerified: new Date(),
        ...updateData,
      });
    } else {
      user = await User.findOneAndUpdate(
        { email: session.user.email },
        updateData,
        { new: true, runValidators: true }
      );
    }

    if (!user) {
      return NextResponse.json(
        { error: "Failed to update preferences" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "Preferences updated successfully",
      matchGender: user.matchGender,
      matchCountry: user.matchCountry,
      matchInterest: user.matchInterest,
    });
  } catch (error) {
    console.error("Error updating match preferences:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();

    const user = await User.findOne(
      { email: session.user.email },
      { matchGender: 1, matchCountry: 1, matchInterest: 1 }
    );

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      matchGender: user.matchGender || "all",
      matchCountry: user.matchCountry || null,
      matchInterest: user.matchInterest || [],
    });
  } catch (error) {
    console.error("Error fetching match preferences:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
