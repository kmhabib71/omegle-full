import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();

    const user = await User.findOne({ email: session.user.email });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      name: user.name,
      email: user.email,
      image: user.image,
      bio: user.bio,
      username: user.username,
      profileImage: user.profileImage,
      userGender: user.userGender,
      userLocation: user.userLocation,
      matchGender: user.matchGender,
      matchCountry: user.matchCountry,
      matchInterest: user.matchInterest,
    });
  } catch (error) {
    console.error("Profile GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    await connectDB();

    let user = await User.findOne({ email: session.user.email });

    if (!user) {
      user = new User({
        name: session.user.name,
        email: session.user.email,
        image: session.user.image,
        provider: "oauth",
      });
    }

    const allowedFields = [
      "name",
      "bio",
      "username",
      "profileImage",
      "userGender",
      "userLocation",
      "matchGender",
      "matchCountry",
      "matchInterest",
    ];

    allowedFields.forEach((field) => {
      if (body[field] !== undefined) {
        user[field] = body[field];
      }
    });

    await user.save();

    return NextResponse.json({
      message: "Profile updated successfully",
      user: {
        name: user.name,
        email: user.email,
        image: user.image,
        bio: user.bio,
        username: user.username,
        profileImage: user.profileImage,
        userGender: user.userGender,
        userLocation: user.userLocation,
        matchGender: user.matchGender,
        matchCountry: user.matchCountry,
        matchInterest: user.matchInterest,
      },
    });
  } catch (error) {
    console.error("Profile UPDATE error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
