import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import clientPromise from "@/lib/mongodb";
import { z } from "zod";

// Filter schema for validation
const filterSchema = z.object({
  gender: z.string().optional(),
  ageMin: z.number().min(18).optional(),
  ageMax: z.number().max(99).optional(),
  countries: z.array(z.string()).optional(),
  language: z.string().optional(),
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
      return getUserFilters(res, userId);
    case "PUT":
      return updateUserFilters(req, res, userId);
    default:
      return res.status(405).json({ error: "Method not allowed" });
  }
}

// Get user's filter preferences
async function getUserFilters(res: NextApiResponse, userId: string) {
  try {
    const client = await clientPromise;
    const db = client.db();
    const filtersCollection = db.collection("filters");

    const filter = await filtersCollection.findOne({ userId });

    if (!filter) {
      return res.status(404).json({ error: "Filter preferences not found" });
    }

    return res.status(200).json({
      ...filter,
      id: filter._id.toString(),
    });
  } catch (error) {
    console.error("Error fetching filters:", error);
    return res
      .status(500)
      .json({ error: "Failed to fetch filter preferences" });
  }
}

// Update user's filter preferences
async function updateUserFilters(
  req: NextApiRequest,
  res: NextApiResponse,
  userId: string
) {
  try {
    const client = await clientPromise;
    const db = client.db();
    const filtersCollection = db.collection("filters");

    // Validate request body
    const validationResult = filterSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: validationResult.error.errors,
      });
    }

    const { gender, ageMin, ageMax, countries, language } =
      validationResult.data;

    // Check if filter exists
    const existingFilter = await filtersCollection.findOne({ userId });

    if (existingFilter) {
      // Update existing filter
      await filtersCollection.updateOne(
        { userId },
        {
          $set: {
            gender,
            ageMin,
            ageMax,
            countries,
            language,
            updatedAt: new Date(),
          },
        }
      );

      const updatedFilter = await filtersCollection.findOne({ userId });

      if (!updatedFilter) {
        return res.status(404).json({ error: "Filter not found after update" });
      }

      return res.status(200).json({
        ...updatedFilter,
        id: updatedFilter._id.toString(),
      });
    } else {
      // Create new filter
      const insertResult = await filtersCollection.insertOne({
        userId,
        gender,
        ageMin,
        ageMax,
        countries: countries || [],
        language,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const newFilter = {
        _id: insertResult.insertedId,
        userId,
        gender,
        ageMin,
        ageMax,
        countries: countries || [],
        language,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      return res.status(200).json({
        ...newFilter,
        id: newFilter._id.toString(),
      });
    }
  } catch (error) {
    console.error("Error updating filters:", error);
    return res
      .status(500)
      .json({ error: "Failed to update filter preferences" });
  }
}
