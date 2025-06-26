import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import clientPromise from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { z } from "zod";

// Match preferences schema for validation
const matchPreferencesSchema = z.object({
  matchGender: z.string().optional(),
  matchCountry: z.string().nullable().optional(),
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
      return getMatchPreferences(res, userId);
    case "PUT":
      return updateMatchPreferences(req, res, userId);
    default:
      return res.status(405).json({ error: "Method not allowed" });
  }
}

// Get user's match preferences
async function getMatchPreferences(res: NextApiResponse, userId: string) {
  try {
    const client = await clientPromise;
    const db = client.db();
    const preferencesCollection = db.collection("matchPreferences");

    const preferences = await preferencesCollection.findOne({ userId });

    if (!preferences) {
      // Return default preferences if none exist
      return res.status(200).json({
        matchGender: "all",
        matchCountry: null,
      });
    }

    return res.status(200).json({
      ...preferences,
      id: preferences._id.toString(),
    });
  } catch (error) {
    console.error("Error fetching match preferences:", error);
    return res.status(500).json({ error: "Failed to fetch match preferences" });
  }
}

// Update user's match preferences
async function updateMatchPreferences(
  req: NextApiRequest,
  res: NextApiResponse,
  userId: string
) {
  try {
    const client = await clientPromise;
    const db = client.db();
    const preferencesCollection = db.collection("matchPreferences");

    // Validate request body
    const validationResult = matchPreferencesSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: validationResult.error.errors,
      });
    }

    const { matchGender, matchCountry } = validationResult.data;

    // Check if preferences exist
    const existingPreferences = await preferencesCollection.findOne({ userId });

    if (existingPreferences) {
      // Update existing preferences
      await preferencesCollection.updateOne(
        { userId },
        {
          $set: {
            matchGender: matchGender || existingPreferences.matchGender,
            matchCountry:
              matchCountry !== undefined
                ? matchCountry
                : existingPreferences.matchCountry,
            updatedAt: new Date(),
          },
        }
      );
    } else {
      // Create new preferences
      await preferencesCollection.insertOne({
        userId,
        matchGender: matchGender || "all",
        matchCountry,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    // Get the updated preferences
    const updatedPreferences = await preferencesCollection.findOne({ userId });

    return res.status(200).json({
      ...updatedPreferences,
      id: updatedPreferences?._id.toString(),
    });
  } catch (error) {
    console.error("Error updating match preferences:", error);
    return res
      .status(500)
      .json({ error: "Failed to update match preferences" });
  }
}
