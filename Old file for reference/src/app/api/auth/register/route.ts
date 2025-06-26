import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import { v4 as uuidv4 } from "uuid";

export async function POST(request: NextRequest) {
  try {
    const { email, password, isAnonymous } = await request.json();

    await connectDB();

    // Handle anonymous user creation
    if (isAnonymous) {
      const anonymousId = `anon_${uuidv4()}`;
      const anonymousUser = new User({
        email: `${anonymousId}@anonymous.local`,
        name: `Anonymous User ${anonymousId.slice(-8)}`,
        provider: "anonymous",
        isAnonymous: true,
        anonymousId: anonymousId,
        createdAt: new Date(),
      });

      await anonymousUser.save();

      return NextResponse.json({
        success: true,
        message: "Anonymous user created successfully",
        user: {
          id: anonymousUser._id,
          anonymousId: anonymousId,
          name: anonymousUser.name,
          isAnonymous: true,
        },
      });
    }

    // Handle regular user registration
    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return NextResponse.json(
        { error: "User already exists" },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create new user
    const user = new User({
      email,
      password: hashedPassword,
      provider: "credentials",
    });

    await user.save();

    return NextResponse.json({
      success: true,
      message: "User created successfully",
      user: {
        id: user._id,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
