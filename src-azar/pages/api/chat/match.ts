import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import clientPromise from "@/lib/mongodb";
import { ObjectId } from "mongodb";

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

  // Only allow GET method for matching
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const client = await clientPromise;
    const db = client.db();
    const usersCollection = db.collection("users");
    const preferencesCollection = db.collection("matchPreferences");

    // Get current user info
    const currentUser = await usersCollection.findOne({
      _id: new ObjectId(userId),
    });

    if (!currentUser) {
      return res.status(404).json({ error: "User not found" });
    }

    // Get user preferences
    const userPreferences = await preferencesCollection.findOne({ userId });
    const matchGender = userPreferences?.matchGender || "all";
    const matchCountry = userPreferences?.matchCountry || null;
    const matchInterests = userPreferences?.matchInterest || null;

    // Build query to find matches
    const baseQuery = {
      _id: { $ne: new ObjectId(userId) },
      // Other criteria like online status could be added here
    };

    // Try to find a match using all criteria
    let potentialMatch = await findMatch(
      usersCollection,
      baseQuery,
      matchGender,
      matchCountry,
      matchInterests
    );

    // If no match found with all criteria, relax interest criteria
    if (!potentialMatch) {
      potentialMatch = await findMatch(
        usersCollection,
        baseQuery,
        matchGender,
        matchCountry,
        null
      );
    }

    // If still no match, relax country criteria
    if (!potentialMatch) {
      potentialMatch = await findMatch(
        usersCollection,
        baseQuery,
        matchGender,
        null,
        null
      );
    }

    // If still no match, relax gender criteria
    if (!potentialMatch) {
      potentialMatch = await findMatch(
        usersCollection,
        baseQuery,
        "all",
        null,
        null
      );
    }

    // If still no match, get any user
    if (!potentialMatch) {
      potentialMatch = await usersCollection.findOne(baseQuery);
    }

    if (!potentialMatch) {
      return res.status(404).json({ error: "No users available for matching" });
    }

    // Remove sensitive fields from match
    const { password, ...safeMatch } = potentialMatch;

    return res.status(200).json({
      match: {
        ...safeMatch,
        id: safeMatch._id.toString(),
      },
    });
  } catch (error) {
    console.error("Error finding match:", error);
    return res.status(500).json({ error: "Failed to find match" });
  }
}

async function findMatch(
  usersCollection: any,
  baseQuery: any,
  matchGender: string,
  matchCountry: string | null,
  matchInterests: string[] | null
) {
  const query = { ...baseQuery };

  // Add gender criteria if specified
  if (matchGender !== "all") {
    query.gender = matchGender;
  }

  // Add country criteria if specified
  if (matchCountry) {
    query.country = matchCountry;
  }

  // Add interest criteria if specified and not empty
  if (matchInterests && matchInterests.length > 0) {
    // Look for users with at least one matching interest
    query.interests = { $in: matchInterests };
  }

  // Find matching users
  const matchingUsers = await usersCollection.find(query).toArray();

  if (matchingUsers.length === 0) {
    return null;
  }

  // Return a random user from matching users
  const randomIndex = Math.floor(Math.random() * matchingUsers.length);
  return matchingUsers[randomIndex];
}
