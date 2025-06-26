import { NextRequest } from "next/server";
import { Server as SocketIOServer } from "socket.io";
import { Server as HTTPServer } from "http";

// Store for managing users and their connections
interface User {
  id: string;
  interests: string[];
  inCall: boolean;
  partnerId?: string;
}

const users = new Map<string, User>();
const waitingUsers = new Map<string, string[]>(); // interests -> user IDs

let io: SocketIOServer;

export async function GET(req: NextRequest) {
  if (!io) {
    // Initialize Socket.IO server
    const httpServer = new HTTPServer();
    io = new SocketIOServer(httpServer, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
      },
    });

    io.on("connection", (socket) => {
      console.log("User connected:", socket.id);

      // Handle user joining with interests
      socket.on("join", (interests: string[]) => {
        users.set(socket.id, {
          id: socket.id,
          interests,
          inCall: false,
        });

        // Try to find a match
        findMatch(socket.id, interests);
      });

      // Handle finding next partner
      socket.on("findNext", () => {
        const user = users.get(socket.id);
        if (user) {
          // Disconnect from current partner
          if (user.partnerId) {
            const partner = users.get(user.partnerId);
            if (partner) {
              partner.inCall = false;
              partner.partnerId = undefined;
              io.to(user.partnerId).emit("partnerDisconnected");
            }
          }

          // Reset user state
          user.inCall = false;
          user.partnerId = undefined;

          // Find new match
          findMatch(socket.id, user.interests);
        }
      });

      // Handle stopping chat
      socket.on("stopChat", () => {
        const user = users.get(socket.id);
        if (user && user.partnerId) {
          const partner = users.get(user.partnerId);
          if (partner) {
            partner.inCall = false;
            partner.partnerId = undefined;
            io.to(user.partnerId).emit("partnerDisconnected");
          }
          user.inCall = false;
          user.partnerId = undefined;
        }
      });

      // Handle WebRTC signaling
      socket.on("offer", (data) => {
        const user = users.get(socket.id);
        if (user && user.partnerId) {
          socket.to(user.partnerId).emit("offer", data);
        }
      });

      socket.on("answer", (data) => {
        const user = users.get(socket.id);
        if (user && user.partnerId) {
          socket.to(user.partnerId).emit("answer", data);
        }
      });

      socket.on("ice-candidate", (data) => {
        const user = users.get(socket.id);
        if (user && user.partnerId) {
          socket.to(user.partnerId).emit("ice-candidate", data);
        }
      });

      // Handle text messages
      socket.on("message", (message: string) => {
        const user = users.get(socket.id);
        if (user && user.partnerId) {
          socket.to(user.partnerId).emit("message", {
            text: message,
            sender: "stranger",
          });
        }
      });

      // Handle disconnect
      socket.on("disconnect", () => {
        console.log("User disconnected:", socket.id);
        const user = users.get(socket.id);
        if (user) {
          // Notify partner
          if (user.partnerId) {
            const partner = users.get(user.partnerId);
            if (partner) {
              partner.inCall = false;
              partner.partnerId = undefined;
              io.to(user.partnerId).emit("partnerDisconnected");
            }
          }

          // Remove from waiting lists
          waitingUsers.forEach((userIds, interests) => {
            const index = userIds.indexOf(socket.id);
            if (index > -1) {
              userIds.splice(index, 1);
            }
          });

          users.delete(socket.id);
        }
      });
    });
  }

  return new Response("Socket.IO server initialized", { status: 200 });
}

function findMatch(userId: string, interests: string[]) {
  const user = users.get(userId);
  if (!user || user.inCall) return;

  // First try to find someone with matching interests
  if (interests.length > 0) {
    for (const interest of interests) {
      const waitingList = waitingUsers.get(interest) || [];
      const availableUsers = waitingList.filter((id) => {
        const otherUser = users.get(id);
        return otherUser && !otherUser.inCall && id !== userId;
      });

      if (availableUsers.length > 0) {
        const partnerId = availableUsers[0];
        createMatch(userId, partnerId);
        return;
      }
    }
  }

  // If no match found with interests, try random matching
  for (const [otherUserId, otherUser] of users.entries()) {
    if (otherUserId !== userId && !otherUser.inCall) {
      createMatch(userId, otherUserId);
      return;
    }
  }

  // No match found, add to waiting list
  if (interests.length > 0) {
    for (const interest of interests) {
      if (!waitingUsers.has(interest)) {
        waitingUsers.set(interest, []);
      }
      waitingUsers.get(interest)!.push(userId);
    }
  } else {
    // Add to general waiting list
    if (!waitingUsers.has("general")) {
      waitingUsers.set("general", []);
    }
    waitingUsers.get("general")!.push(userId);
  }

  // Notify user they're waiting
  io.to(userId).emit("waiting");
}

function createMatch(userId1: string, userId2: string) {
  const user1 = users.get(userId1);
  const user2 = users.get(userId2);

  if (!user1 || !user2) return;

  // Set up the match
  user1.inCall = true;
  user1.partnerId = userId2;
  user2.inCall = true;
  user2.partnerId = userId1;

  // Remove from waiting lists
  waitingUsers.forEach((userIds) => {
    const index1 = userIds.indexOf(userId1);
    const index2 = userIds.indexOf(userId2);
    if (index1 > -1) userIds.splice(index1, 1);
    if (index2 > -1) userIds.splice(index2, 1);
  });

  // Notify both users
  io.to(userId1).emit("matched", { partnerId: userId2 });
  io.to(userId2).emit("matched", { partnerId: userId1 });
}
