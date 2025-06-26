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
      id: user._id,
      name: user.name,
      email: user.email,
      username: user.username,
      bio: user.bio,
      gender: user.gender,
      profileImage: user.profileImage,
      image: user.image,
      matchGender: user.matchGender,
      matchCountry: user.matchCountry,
      matchInterest: user.matchInterest,
    });
  } catch (error) {
    console.error("Error fetching profile:", error);
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

    await connectDB();

    const body = await request.json();
    const { name, bio, gender, profileImage } = body;

    // Update user profile
    const updateData: any = {};

    if (name !== undefined) {
      updateData.name = name;
    }

    if (bio !== undefined) {
      updateData.bio = bio;
    }

    if (gender !== undefined) {
      updateData.gender = gender;
    }

    if (profileImage !== undefined) {
      updateData.profileImage = profileImage;
      updateData.image = profileImage; // Also update the main image field for NextAuth
    }

    const user = await User.findOneAndUpdate(
      { email: session.user.email },
      updateData,
      { new: true, runValidators: true }
    );

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      message: "Profile updated successfully",
      id: user._id,
      name: user.name,
      email: user.email,
      username: user.username,
      bio: user.bio,
      gender: user.gender,
      profileImage: user.profileImage,
      image: user.image,
    });
  } catch (error) {
    console.error("Error updating profile:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
