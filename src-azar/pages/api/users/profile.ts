import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import clientPromise from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { z } from "zod";

// Profile schema for validation
const profileSchema = z.object({
  gender: z.string().optional(),
  country: z.string().optional(),
  name: z.string().optional(),
  username: z.string().optional(),
  bio: z.string().optional(),
  profileImage: z.string().optional(),
  image: z.string().optional(),
  // Add additional profile fields as needed
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Verify session
  const session = await getServerSession(req, res, authOptions);
  if (!session || !session.user || !session.user.id) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const userId = session.user.id;

  // Handle different methods
  switch (req.method) {
    case "GET":
      return getUserProfile(res, userId);
    case "PUT":
      return updateUserProfile(req, res, userId);
    default:
      return res.status(405).json({ error: "Method not allowed" });
  }
}

// Get user's profile
async function getUserProfile(res: NextApiResponse, userId: string) {
  try {
    const client = await clientPromise;
    const db = client.db();
    const usersCollection = db.collection("users");

    const user = await usersCollection.findOne({ _id: new ObjectId(userId) });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Filter out sensitive data
    const { password, ...profile } = user;

    return res.status(200).json({
      ...profile,
      id: profile._id.toString(),
    });
  } catch (error) {
    console.error("Error fetching profile:", error);
    return res.status(500).json({ error: "Failed to fetch profile" });
  }
}

// Update user's profile
async function updateUserProfile(
  req: NextApiRequest,
  res: NextApiResponse,
  userId: string
) {
  try {
    const client = await clientPromise;
    const db = client.db();
    const usersCollection = db.collection("users");

    // Validate request body
    const validationResult = profileSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: validationResult.error.errors,
      });
    }

    const updateData = validationResult.data;

    // Only include fields that are present in the request
    const filteredUpdateData = Object.fromEntries(
      Object.entries(updateData).filter(([_, v]) => v !== undefined)
    );

    if (Object.keys(filteredUpdateData).length === 0) {
      return res.status(400).json({
        error: "No valid fields to update",
      });
    }

    // Update the user
    await usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      {
        $set: {
          ...filteredUpdateData,
          updatedAt: new Date(),
        },
      }
    );

    // Get the updated user
    const updatedUser = await usersCollection.findOne({
      _id: new ObjectId(userId),
    });

    if (!updatedUser) {
      return res.status(404).json({ error: "User not found after update" });
    }

    // Filter out sensitive data
    const { password, ...profile } = updatedUser;

    return res.status(200).json({
      ...profile,
      id: profile._id.toString(),
    });
  } catch (error) {
    console.error("Error updating profile:", error);
    return res.status(500).json({ error: "Failed to update profile" });
  }
}
