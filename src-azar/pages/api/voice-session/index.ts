import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { prisma } from "@/lib/prisma";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getServerSession(req, res, authOptions);

  if (!session?.user?.id) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const userId = session.user.id;

  switch (req.method) {
    case "GET":
      try {
        const voiceSessions = await prisma.voiceSession.findMany({
          where: {
            userId: userId,
          },
          orderBy: {
            startTime: "desc",
          },
          take: 50, // Limit to last 50 sessions
        });

        return res.status(200).json(voiceSessions);
      } catch (error) {
        console.error("Error fetching voice sessions:", error);
        return res.status(500).json({ error: "Internal server error" });
      }

    case "POST":
      try {
        const { targetId, duration } = req.body;

        const voiceSession = await prisma.voiceSession.create({
          data: {
            userId: userId,
            targetId: targetId,
            duration: duration,
            endTime: new Date(),
          },
        });

        return res.status(201).json(voiceSession);
      } catch (error) {
        console.error("Error creating voice session:", error);
        return res.status(500).json({ error: "Internal server error" });
      }

    case "PUT":
      try {
        const { sessionId, duration } = req.body;

        const voiceSession = await prisma.voiceSession.update({
          where: {
            id: sessionId,
            userId: userId, // Ensure user owns the session
          },
          data: {
            duration: duration,
            endTime: new Date(),
          },
        });

        return res.status(200).json(voiceSession);
      } catch (error) {
        console.error("Error updating voice session:", error);
        return res.status(500).json({ error: "Internal server error" });
      }

    default:
      res.setHeader("Allow", ["GET", "POST", "PUT"]);
      return res.status(405).json({ error: "Method not allowed" });
  }
}
