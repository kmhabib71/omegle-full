const { createServer } = require("http");
const { Server } = require("socket.io");

// Store for managing users and their connections
const users = new Map();
const waitingUsers = new Map(); // interests -> user IDs

// Create HTTP server
const httpServer = createServer((req, res) => {
  // Add CORS headers for all HTTP requests
  res.setHeader("Access-Control-Allow-Origin", "http://localhost:3000");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, HEAD");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Handle preflight requests
  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  // Simple HTTP response for health checks
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Socket.IO Server is running!");
});

// Create Socket.IO server
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  console.log("✔ User connected:", socket.id);

  // Phase 1: Handle connection validation
  socket.emit("connection-validated", {
    socketId: socket.id,
    timestamp: Date.now(),
    status: "connected",
  });

  // Handle user joining with interests (Phase 2)
  socket.on("join", (interests = []) => {
    console.log("🚀 User joining:", socket.id, "with interests:", interests);

    users.set(socket.id, {
      id: socket.id,
      interests,
      inCall: false,
    });

    // Try to find a match
    findMatch(socket.id, interests);
  });

  // Handle finding next partner (Phase 5)
  socket.on("findNext", () => {
    console.log("🔄 Finding next partner for:", socket.id);
    const user = users.get(socket.id);
    if (user) {
      // Disconnect from current partner
      if (user.partnerId) {
        const partner = users.get(user.partnerId);
        if (partner) {
          partner.inCall = false;
          partner.partnerId = undefined;
          io.to(user.partnerId).emit("partner-disconnected");
        }
      }

      // Reset user state
      user.inCall = false;
      user.partnerId = undefined;

      // Find new match
      findMatch(socket.id, user.interests);
    }
  });

  // Handle stopping chat (Phase 7)
  socket.on("stopChat", () => {
    console.log("🛑 Stopping chat for:", socket.id);
    const user = users.get(socket.id);
    if (user && user.partnerId) {
      const partner = users.get(user.partnerId);
      if (partner) {
        partner.inCall = false;
        partner.partnerId = undefined;
        io.to(user.partnerId).emit("partner-disconnected");
      }
      user.inCall = false;
      user.partnerId = undefined;
    }
    socket.emit("chat-stopped");
  });

  // WebRTC signaling (Phase 3)
  socket.on("offer", (data) => {
    console.log("📤 Forwarding offer from:", socket.id);
    const user = users.get(socket.id);
    if (user && user.partnerId) {
      socket.to(user.partnerId).emit("offer", data);
    }
  });

  socket.on("answer", (data) => {
    console.log("📥 Forwarding answer from:", socket.id);
    const user = users.get(socket.id);
    if (user && user.partnerId) {
      socket.to(user.partnerId).emit("answer", data);
    }
  });

  socket.on("ice-candidate", (data) => {
    console.log("🧊 Forwarding ICE candidate from:", socket.id);
    const user = users.get(socket.id);
    if (user && user.partnerId) {
      socket.to(user.partnerId).emit("ice-candidate", data);
    }
  });

  // Handle text messages (Phase 4)
  socket.on("message", (message) => {
    const user = users.get(socket.id);
    if (user && user.partnerId) {
      socket.to(user.partnerId).emit("message", {
        text: message,
        sender: "stranger",
        timestamp: Date.now(),
      });
    }
  });

  // Handle disconnect (Phase 6)
  socket.on("disconnect", () => {
    console.log("❌ User disconnected:", socket.id);
    const user = users.get(socket.id);
    if (user) {
      // Notify partner
      if (user.partnerId) {
        const partner = users.get(user.partnerId);
        if (partner) {
          partner.inCall = false;
          partner.partnerId = undefined;
          io.to(user.partnerId).emit("partner-disconnected");
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

  // Heartbeat for connection monitoring
  socket.on("ping", () => {
    socket.emit("pong", { timestamp: Date.now() });
  });
});

function findMatch(userId, interests) {
  const user = users.get(userId);
  if (!user || user.inCall) return;

  console.log("🔍 Finding match for:", userId, "with interests:", interests);

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
      waitingUsers.get(interest).push(userId);
    }
  } else {
    // Add to general waiting list
    if (!waitingUsers.has("general")) {
      waitingUsers.set("general", []);
    }
    waitingUsers.get("general").push(userId);
  }

  // Notify user they're waiting
  console.log("⏳ User added to waiting list:", userId);
  io.to(userId).emit("waiting");
}

function createMatch(userId1, userId2) {
  const user1 = users.get(userId1);
  const user2 = users.get(userId2);

  if (!user1 || !user2) return;

  console.log("🤝 Creating match between:", userId1, "and", userId2);

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

  // Notify both users - determine who should initiate WebRTC
  const initiator = userId1 < userId2 ? userId1 : userId2;

  io.to(userId1).emit("matched", {
    partnerId: userId2,
    isInitiator: userId1 === initiator,
    sessionId: `${Math.min(userId1, userId2)}-${Math.max(userId1, userId2)}`,
  });

  io.to(userId2).emit("matched", {
    partnerId: userId1,
    isInitiator: userId2 === initiator,
    sessionId: `${Math.min(userId1, userId2)}-${Math.max(userId1, userId2)}`,
  });
}

const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, (err) => {
  if (err) {
    console.error("❌ Server failed to start:", err);
    process.exit(1);
  }
  console.log(`🚀 Socket.IO server ready on http://localhost:${PORT}`);
  console.log("📡 WebRTC signaling server is running");
  console.log("🔧 Phase 1 debugging enabled");
});

// Handle process termination gracefully
process.on("SIGINT", () => {
  console.log("\n🛑 Shutting down Socket.IO server...");
  httpServer.close(() => {
    console.log("✔ Server closed successfully");
    process.exit(0);
  });
});
