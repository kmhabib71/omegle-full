import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import clientPromise from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { z } from "zod";

// Match Game schema for validation - updated to handle array
const matchInterestSchema = z.object({
  matchInterest: z.union([
    z.array(z.string()).nullable().optional(),
    z.string().nullable().optional(),
  ]),
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
      return getMatchInterest(res, userId);
    case "PUT":
      return updateMatchInterest(req, res, userId);
    default:
      return res.status(405).json({ error: "Method not allowed" });
  }
}

// Get user's Match Game preference
async function getMatchInterest(res: NextApiResponse, userId: string) {
  try {
    const client = await clientPromise;
    const db = client.db();
    const preferencesCollection = db.collection("matchPreferences");

    const preferences = await preferencesCollection.findOne({ userId });

    if (!preferences) {
      // Return default preferences if none exist
      return res.status(200).json({
        matchInterest: null,
      });
    }

    return res.status(200).json({
      matchInterest: preferences.matchInterest || null,
      id: preferences._id.toString(),
    });
  } catch (error) {
    console.error("Error fetching Match Game:", error);
    return res.status(500).json({ error: "Failed to fetch Match Game" });
  }
}

// Update user's Match Game preference
async function updateMatchInterest(
  req: NextApiRequest,
  res: NextApiResponse,
  userId: string
) {
  try {
    const client = await clientPromise;
    const db = client.db();
    const preferencesCollection = db.collection("matchPreferences");

    // Validate request body
    const validationResult = matchInterestSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: validationResult.error.errors,
      });
    }

    let { matchInterest } = validationResult.data;

    // Handle legacy format (convert single string to array if needed)
    if (typeof matchInterest === "string") {
      matchInterest = [matchInterest];
    }

    // Check if preferences exist
    const existingPreferences = await preferencesCollection.findOne({ userId });

    if (existingPreferences) {
      // Update existing preferences
      await preferencesCollection.updateOne(
        { userId },
        {
          $set: {
            matchInterest:
              matchInterest !== undefined
                ? matchInterest
                : existingPreferences.matchInterest,
            updatedAt: new Date(),
          },
        }
      );
    } else {
      // Create new preferences
      await preferencesCollection.insertOne({
        userId,
        matchInterest,
        matchGender: "all", // default values
        matchCountry: null, // default values
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    // Get the updated preferences
    const updatedPreferences = await preferencesCollection.findOne({ userId });

    return res.status(200).json({
      matchInterest: updatedPreferences?.matchInterest || null,
      id: updatedPreferences?._id.toString(),
    });
  } catch (error) {
    console.error("Error updating Match Game:", error);
    return res.status(500).json({ error: "Failed to update Match Game" });
  }
}
