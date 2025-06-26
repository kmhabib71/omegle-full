import { NextApiRequest, NextApiResponse } from "next";
import clientPromise from "@/lib/mongodb";
import bcrypt from "bcrypt";
import { z } from "zod";

// Validation schema for registration
const registrationSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  username: z.string().min(3, "Username must be at least 3 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  gender: z.string().optional(),
  country: z.string().optional(),
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow POST requests
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    console.log("Registration attempt:", {
      body: { ...req.body, password: "[REDACTED]" },
      headers: req.headers["content-type"],
    });

    // Validate request body
    const validationResult = registrationSchema.safeParse(req.body);
    if (!validationResult.success) {
      console.error("Validation failed:", validationResult.error.errors);
      return res.status(400).json({
        error: "Validation failed",
        details: validationResult.error.errors,
      });
    }

    const { name, username, email, password, gender, country } =
      validationResult.data;

    // Connect to MongoDB
    console.log("Connecting to MongoDB...");
    const client = await clientPromise;
    const db = client.db();
    const usersCollection = db.collection("users");
    const filtersCollection = db.collection("filters");
    console.log("MongoDB connected successfully");

    // Check if username already exists
    console.log("Checking for existing username:", username);
    const existingUsername = await usersCollection.findOne({ username });

    if (existingUsername) {
      console.log("Username already exists:", username);
      return res.status(400).json({ error: "Username already exists" });
    }

    // Check if email already exists (if provided)
    if (email) {
      console.log("Checking for existing email:", email);
      const existingEmail = await usersCollection.findOne({ email });

      if (existingEmail) {
        console.log("Email already exists:", email);
        return res.status(400).json({ error: "Email already exists" });
      }
    }

    // Hash the password
    console.log("Hashing password...");
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user
    console.log("Creating new user...");
    const userDoc = {
      name,
      username,
      email,
      password: hashedPassword,
      gender: gender || "all",
      country: country || null,
      onlineStatus: true,
      lastActive: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      signInMethod: "credentials",
    };

    const result = await usersCollection.insertOne(userDoc);
    console.log("User created with ID:", result.insertedId);

    // Create default filter preferences
    console.log("Creating default filter preferences...");
    const filterDoc = {
      userId: result.insertedId.toString(),
      gender: "all",
      ageMin: 18,
      ageMax: 99,
      countries: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await filtersCollection.insertOne(filterDoc);
    console.log("Filter preferences created");

    // Return user data without the password
    const user = {
      id: result.insertedId.toString(),
      name,
      username,
      email,
      gender: gender || "all",
      country: country || null,
      createdAt: new Date(),
    };

    console.log("Registration successful for user:", username);
    return res.status(201).json({
      message: "User registered successfully",
      user,
    });
  } catch (error) {
    console.error("Registration error details:", {
      message: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
      error: error,
    });

    // Return more specific error messages based on error type
    if (error instanceof Error) {
      if (
        error.message.includes("MongoServerError") ||
        error.message.includes("connection")
      ) {
        return res.status(500).json({
          error: "Database connection failed. Please try again later.",
        });
      }
      if (error.message.includes("validation")) {
        return res.status(400).json({
          error: "Invalid data provided. Please check your input.",
        });
      }
    }

    return res.status(500).json({
      error: "Registration failed. Please try again later.",
      details:
        process.env.NODE_ENV === "development"
          ? error instanceof Error
            ? error.message
            : "Unknown error"
          : undefined,
    });
  }
}
