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

  // Handle different methods
  switch (req.method) {
    case "POST":
      return createVideoSession(req, res, userId);
    case "GET":
      return getVideoSessions(req, res, userId);
    case "PUT":
      return updateVideoSession(req, res, userId);
    default:
      return res.status(405).json({ error: "Method not allowed" });
  }
}

// Create a new video session record
async function createVideoSession(
  req: NextApiRequest,
  res: NextApiResponse,
  userId: string
) {
  try {
    const { targetId, targetData = {} } = req.body;
    const client = await clientPromise;
    const db = client.db();
    const videoSessionsCollection = db.collection("videoSessions");
    const usersCollection = db.collection("users");

    // Get current user data
    const currentUser = await usersCollection.findOne({
      _id: new ObjectId(userId),
    });

    // Create a record with more detailed information
    const sessionData = {
      userId,
      targetId,
      startTime: new Date(),
      endTime: null, // Will be updated when session ends
      duration: 0, // Will be calculated when session ends
      userInfo: {
        name: currentUser?.name || "Unknown User",
        username: currentUser?.username || "unknown",
        email: currentUser?.email || "",
        country: currentUser?.country || null,
        gender: currentUser?.gender || null,
        imageUrl: currentUser?.image || null,
      },
      targetInfo: {
        name: targetData.name || "Unknown User",
        username: targetData.username || "unknown",
        country: targetData.country || null,
        gender: targetData.gender || null,
        imageUrl: targetData.image || null,
      },
      matchCriteria: targetData.matchCriteria || null,
      messageCount: 0, // Will be updated as messages are exchanged
      starred: false,
      createdAt: new Date(),
    };

    const videoSession = await videoSessionsCollection.insertOne(sessionData);

    return res.status(201).json({
      id: videoSession.insertedId.toString(),
      ...sessionData,
    });
  } catch (error) {
    console.error("Error creating video session:", error);
    return res.status(500).json({ error: "Failed to create video session" });
  }
}

// Get all video sessions for a user
async function getVideoSessions(
  req: NextApiRequest,
  res: NextApiResponse,
  userId: string
) {
  try {
    const client = await clientPromise;
    const db = client.db();
    const videoSessionsCollection = db.collection("videoSessions");

    const videoSessions = await videoSessionsCollection
      .find({ userId })
      .sort({ startTime: -1 }) // -1 for descending order
      .toArray();

    // Convert ObjectId to string for each session
    const formattedSessions = videoSessions.map((session) => ({
      ...session,
      id: session._id.toString(),
    }));

    return res.status(200).json(formattedSessions);
  } catch (error) {
    console.error("Error fetching video sessions:", error);
    return res.status(500).json({ error: "Failed to fetch video sessions" });
  }
}

// Update an existing video session (end time, duration, or starred status)
async function updateVideoSession(
  req: NextApiRequest,
  res: NextApiResponse,
  userId: string
) {
  try {
    const { id, endTime, messageCount, starred } = req.body;
    const client = await clientPromise;
    const db = client.db();
    const videoSessionsCollection = db.collection("videoSessions");

    // Find the existing session
    const existingSession = await videoSessionsCollection.findOne({
      _id: new ObjectId(id),
      userId,
    });

    if (!existingSession) {
      return res.status(404).json({ error: "Video session not found" });
    }

    // Create the update object based on provided fields
    const updateFields: { [key: string]: any } = {};

    if (endTime) {
      // Set end time and calculate duration
      updateFields.endTime = new Date(endTime);
      const startTime = new Date(existingSession.startTime);
      const durationMs = updateFields.endTime.getTime() - startTime.getTime();
      updateFields.duration = Math.round(durationMs / 1000); // Duration in seconds
    }

    if (messageCount !== undefined) {
      updateFields.messageCount = messageCount;
    }

    if (starred !== undefined) {
      updateFields.starred = starred;
    }

    // Update the session
    await videoSessionsCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateFields }
    );

    // Return the updated session
    const updatedSession = await videoSessionsCollection.findOne({
      _id: new ObjectId(id),
    });

    return res.status(200).json({
      ...updatedSession,
      id: updatedSession?._id.toString(),
    });
  } catch (error) {
    console.error("Error updating video session:", error);
    return res.status(500).json({ error: "Failed to update video session" });
  }
}
