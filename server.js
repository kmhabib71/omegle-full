const { createServer } = require("http");
const { Server } = require("socket.io");

// Store for managing users and their connections
const users = new Map();
const waitingUsers = new Map(); // interests -> array of {userId, timestamp} objects for FIFO ordering

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

  // 🚨 DEBUG: Log all incoming events
  socket.onAny((eventName, ...args) => {
    console.log(`📥 EVENT RECEIVED: ${eventName} from ${socket.id}`, args);

    // Special logging for ICE candidate events
    if (eventName.includes("ice") || eventName.includes("peer")) {
      console.log(`🧊 ICE/PEER EVENT DETAILS:`, {
        eventName,
        socketId: socket.id,
        argsLength: args.length,
        hasCallback:
          args.length > 0 && typeof args[args.length - 1] === "function",
        timestamp: Date.now(),
      });
    }
  });

  // Phase 1: Handle connection validation
  socket.emit("connection-validated", {
    socketId: socket.id,
    timestamp: Date.now(),
    status: "connected",
  });

  // Handle user finding partner (Phase 2) - renamed from "join" as it's reserved
  socket.on("find-partner", (interests = [], callback) => {
    console.log(
      "🚀 FIND-PARTNER EVENT RECEIVED from:",
      socket.id,
      "with interests:",
      interests
    );

    // Send acknowledgment if callback provided
    if (typeof callback === "function") {
      callback({
        success: true,
        message: "Find-partner event received by server",
        socketId: socket.id,
        timestamp: Date.now(),
      });
    }

    // 🔧 FIX: Check if user is already connected to someone (NEXT button scenario)
    const existingUser = users.get(socket.id);
    if (existingUser && existingUser.partnerId && existingUser.inCall) {
      console.log(
        "🔄 User clicking NEXT - disconnecting current partner:",
        existingUser.partnerId
      );

      const currentPartnerId = existingUser.partnerId;
      const currentPartner = users.get(currentPartnerId);

      // 🚨 ATOMIC DISCONNECTION: Reset both users' states simultaneously to prevent cascade
      existingUser.inCall = false;
      existingUser.partnerId = undefined;

      if (currentPartner) {
        currentPartner.inCall = false;
        currentPartner.partnerId = undefined;

        // Only notify partner if they're still connected to this user (prevent double notifications)
        if (
          currentPartner.partnerId === socket.id ||
          !currentPartner.partnerId
        ) {
          io.to(currentPartnerId).emit("partner-disconnected", {
            skipAutoSearch: false,
            reason: "Partner clicked NEXT",
          });
          console.log(
            "✅ Partner notified about disconnection (auto-search enabled):",
            currentPartnerId
          );
        }
      }
    }

    console.log("📊 Current users before join:", Array.from(users.keys()));
    console.log(
      "📊 Current users data before join:",
      Array.from(users.entries())
    );
    console.log("📊 Current waiting lists before join:");
    waitingUsers.forEach((userIds, key) => {
      console.log(`  ${key}: [${userIds.join(", ")}]`);
    });

    users.set(socket.id, {
      id: socket.id,
      interests,
      inCall: false,
    });

    console.log("📊 Current users after join:", Array.from(users.keys()));
    console.log(
      "📊 Current users data after join:",
      Array.from(users.entries())
    );

    // Try to find a match
    console.log("🔍 CALLING findMatch for:", socket.id);
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
          io.to(user.partnerId).emit("partner-disconnected", {
            skipAutoSearch: false,
            reason: "Partner clicked NEXT",
          });
        }
      }

      // Reset user state
      user.inCall = false;
      user.partnerId = undefined;

      // Find new match
      findMatch(socket.id, user.interests);
    }
  });

  // Handle leaving queue
  socket.on("leave-queue", () => {
    console.log("📤 User leaving queue:", socket.id);

    // Remove from waiting lists
    waitingUsers.forEach((userIds, interests) => {
      const index = userIds.indexOf(socket.id);
      if (index > -1) {
        userIds.splice(index, 1);
      }
    });

    socket.emit("queue-left");
  });

  // Handle partner disconnect
  socket.on("disconnect-partner", () => {
    console.log("🔌 Disconnecting partner for:", socket.id);
    const user = users.get(socket.id);
    if (user && user.partnerId) {
      const partner = users.get(user.partnerId);
      if (partner) {
        partner.inCall = false;
        partner.partnerId = undefined;
        io.to(user.partnerId).emit("partner-disconnected", {
          skipAutoSearch: false,
          reason: "Partner manually disconnected",
        });
      }
      user.inCall = false;
      user.partnerId = undefined;
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
        io.to(user.partnerId).emit("partner-disconnected", {
          skipAutoSearch: false,
          reason: "Partner stopped the chat",
        });
      }
      user.inCall = false;
      user.partnerId = undefined;
    }
    socket.emit("chat-stopped");
  });

  // Phase 3: WebRTC signaling events
  socket.on("webrtc-offer", (data) => {
    console.log(
      "📤 Forwarding WebRTC offer from:",
      socket.id,
      "to:",
      data.partnerId
    );
    if (data.partnerId) {
      socket.to(data.partnerId).emit("webrtc-offer", {
        ...data,
        partnerId: socket.id,
      });
    }
  });

  socket.on("webrtc-answer", (data) => {
    console.log(
      "📥 Forwarding WebRTC answer from:",
      socket.id,
      "to:",
      data.partnerId
    );
    if (data.partnerId) {
      socket.to(data.partnerId).emit("webrtc-answer", {
        ...data,
        partnerId: socket.id,
      });
    }
  });

  socket.on("webrtc-ice-candidate", (data, callback) => {
    console.log(
      "🧊 Forwarding ICE candidate from:",
      socket.id,
      "to:",
      data.partnerId
    );
    console.log("🧊 ICE candidate details:", {
      type: data.candidate?.type,
      candidate: data.candidate?.candidate?.substring(0, 50) + "...",
    });

    if (data.partnerId) {
      socket.to(data.partnerId).emit("webrtc-ice-candidate", {
        ...data,
        partnerId: socket.id,
      });

      // Send acknowledgment
      if (typeof callback === "function") {
        callback({
          success: true,
          message: "ICE candidate forwarded successfully",
          timestamp: Date.now(),
        });
      }
    } else {
      if (typeof callback === "function") {
        callback({
          success: false,
          message: "No partner ID provided",
          timestamp: Date.now(),
        });
      }
    }
  });

  // Legacy WebRTC signaling (for backward compatibility)
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

  // SimplePeer WebRTC signal handler
  socket.on("webrtc-signal", (data, callback) => {
    console.log(
      "📡 Forwarding WebRTC signal from:",
      socket.id,
      "to:",
      data.partnerId,
      "type:",
      data.type
    );

    if (data.partnerId) {
      socket.to(data.partnerId).emit("webrtc-signal", {
        ...data,
        partnerId: socket.id,
      });

      // Send acknowledgment
      if (typeof callback === "function") {
        callback({
          success: true,
          message: "WebRTC signal forwarded successfully",
          socketId: socket.id,
          timestamp: Date.now(),
        });
      }
    } else {
      if (typeof callback === "function") {
        callback({
          success: false,
          message: "No partner ID provided",
          socketId: socket.id,
          timestamp: Date.now(),
        });
      }
    }
  });

  // Custom ICE candidate handler with acknowledgment (legacy)
  socket.on("custom-ice-exchange", (data, callback) => {
    console.log(
      "🧊 Forwarding ICE candidate from:",
      socket.id,
      "to:",
      data.partnerId
    );
    console.log("🧊 ICE candidate details:", {
      type: data.candidate?.type,
      candidate: data.candidate?.candidate?.substring(0, 50) + "...",
    });

    if (data.partnerId) {
      socket.to(data.partnerId).emit("custom-ice-exchange", {
        ...data,
        partnerId: socket.id,
      });

      // Send acknowledgment
      if (typeof callback === "function") {
        callback({
          success: true,
          message: "ICE candidate forwarded successfully",
          socketId: socket.id,
          timestamp: Date.now(),
        });
      }
    } else {
      if (typeof callback === "function") {
        callback({
          success: false,
          message: "No partner ID provided",
          timestamp: Date.now(),
        });
      }
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
          // Don't skip auto-search for unexpected disconnections (user closes browser, network issues, etc.)
          io.to(user.partnerId).emit("partner-disconnected", {
            skipAutoSearch: false,
            reason: "Partner disconnected unexpectedly",
          });
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
  socket.on("ping", (callback) => {
    console.log("🏓 PING received from:", socket.id);
    socket.emit("pong", { timestamp: Date.now() });
    // Send callback if provided
    if (typeof callback === "function") {
      callback({ received: true, timestamp: Date.now() });
    }
  });

  // 🚨 DEBUG: Test ICE candidate reception
  socket.on("test-ice-event", (data, callback) => {
    console.log("🧪 TEST ICE EVENT RECEIVED:", data);
    if (typeof callback === "function") {
      callback({ received: true, timestamp: Date.now() });
    }
  });

  // 🚨 DEBUG: Simple test handler
  socket.on("simple-test", (data) => {
    console.log(
      "🧪 SIMPLE-TEST EVENT RECEIVED from:",
      socket.id,
      "data:",
      data
    );
    // Send response back to client
    socket.emit("test-response", {
      message: "Server received your simple-test",
      originalData: data,
      timestamp: Date.now(),
    });
  });

  // 🚨 DEBUG: Request server test
  socket.on("request-server-test", (data) => {
    console.log("🧪 SERVER-TEST REQUEST from:", socket.id, "data:", data);
    // Send a test event back to the client
    socket.emit("test-response", {
      message: "This is a server-initiated test event",
      clientId: data.clientId,
      timestamp: Date.now(),
    });
  });

  // 🚨 DEBUG: Test alternative join event name
  socket.on("join-user", (interests = [], callback) => {
    console.log(
      "🧪 JOIN-USER EVENT RECEIVED from:",
      socket.id,
      "with interests:",
      interests
    );
    if (typeof callback === "function") {
      callback({
        success: true,
        message: "Join-user event received by server",
        socketId: socket.id,
        timestamp: Date.now(),
      });
    }
  });
});

function findMatch(userId, interests) {
  const user = users.get(userId);
  if (!user || user.inCall) return;

  console.log("🔍 Finding match for:", userId, "with interests:", interests);
  console.log("📊 Current users:", Array.from(users.keys()));
  console.log(
    "📊 Users in call:",
    Array.from(users.values())
      .filter((u) => u.inCall)
      .map((u) => u.id)
  );

  // 🚀 FIFO QUEUE SYSTEM: Try to find someone from waiting lists FIRST (First In, First Out)

  // FIRST: Try to find someone with matching interests (if both have interests)
  if (interests.length > 0) {
    console.log("🔍 Trying interest-based FIFO matching...");
    for (const interest of interests) {
      const waitingList = waitingUsers.get(interest) || [];
      const availableUsers = waitingList.filter((id) => {
        const otherUser = users.get(id);
        return otherUser && !otherUser.inCall && id !== userId;
      });

      if (availableUsers.length > 0) {
        const partnerId = availableUsers[0]; // FIFO: First in queue gets matched
        console.log("✔ Found interest-based FIFO partner:", partnerId);
        createMatch(userId, partnerId);
        return;
      }
    }
  }

  // SECOND: Check general waiting list for users without interests (FIFO)
  console.log("🔍 Checking general waiting list (FIFO)...");
  const generalWaitingList = waitingUsers.get("general") || [];
  const availableGeneralUsers = generalWaitingList.filter((id) => {
    const otherUser = users.get(id);
    return otherUser && !otherUser.inCall && id !== userId;
  });

  if (availableGeneralUsers.length > 0) {
    const partnerId = availableGeneralUsers[0]; // FIFO: First in queue gets matched
    console.log("✔ Found general FIFO partner:", partnerId);
    createMatch(userId, partnerId);
    return;
  }

  // THIRD: Only if no one is waiting, try to match with any available user
  console.log(
    "🎯 No one in queues, trying immediate matching with available users..."
  );
  for (const [otherUserId, otherUser] of users.entries()) {
    if (otherUserId !== userId && !otherUser.inCall) {
      console.log("✔ Found available partner (no queue):", otherUserId);
      createMatch(userId, otherUserId);
      return;
    }
  }

  // FOURTH: No match found, add to appropriate waiting list
  console.log("⏳ No match found, adding to waiting list...");

  if (interests.length > 0) {
    // Add to interest-specific waiting lists
    for (const interest of interests) {
      if (!waitingUsers.has(interest)) {
        waitingUsers.set(interest, []);
      }
      if (!waitingUsers.get(interest).includes(userId)) {
        waitingUsers.get(interest).push(userId);
      }
    }
    console.log("📝 Added to interest waiting lists:", interests);
  } else {
    // Add to general waiting list
    if (!waitingUsers.has("general")) {
      waitingUsers.set("general", []);
    }
    if (!waitingUsers.get("general").includes(userId)) {
      waitingUsers.get("general").push(userId);
    }
    console.log("📝 Added to general waiting list");
  }

  // Log current waiting lists for debugging
  console.log("📊 Current waiting lists:");
  waitingUsers.forEach((userIds, key) => {
    console.log(`  ${key}: [${userIds.join(", ")}]`);
  });

  // Notify user they're waiting
  io.to(userId).emit("waiting");
}

function createMatch(userId1, userId2) {
  const user1 = users.get(userId1);
  const user2 = users.get(userId2);

  if (!user1 || !user2) {
    console.error("❌ Cannot create match - user not found:", {
      userId1,
      userId2,
      user1: !!user1,
      user2: !!user2,
    });
    return;
  }

  console.log("🤝 Creating match between:", userId1, "and", userId2);

  // Set up the match
  user1.inCall = true;
  user1.partnerId = userId2;
  user2.inCall = true;
  user2.partnerId = userId1;

  // Remove from waiting lists
  let removedFromLists = 0;
  waitingUsers.forEach((userIds, listName) => {
    const index1 = userIds.indexOf(userId1);
    const index2 = userIds.indexOf(userId2);
    if (index1 > -1) {
      userIds.splice(index1, 1);
      removedFromLists++;
      console.log(`✔ Removed ${userId1} from ${listName} waiting list`);
    }
    if (index2 > -1) {
      userIds.splice(index2, 1);
      removedFromLists++;
      console.log(`✔ Removed ${userId2} from ${listName} waiting list`);
    }
  });
  console.log(`📝 Removed users from ${removedFromLists} waiting list entries`);

  // Determine who should initiate WebRTC
  const initiator = userId1 < userId2 ? userId1 : userId2;
  const sessionId = `${userId1 < userId2 ? userId1 : userId2}-${
    userId1 < userId2 ? userId2 : userId1
  }-${Date.now()}`;

  console.log(
    `🎯 Match details: initiator=${initiator}, sessionId=${sessionId}`
  );

  // Emit partner-found event for Phase 3
  console.log(`📤 Sending partner-found to ${userId1}`);
  io.to(userId1).emit("partner-found", {
    partnerId: userId2,
    sessionId: sessionId,
    isInitiator: userId1 === initiator,
  });

  console.log(`📤 Sending partner-found to ${userId2}`);
  io.to(userId2).emit("partner-found", {
    partnerId: userId1,
    sessionId: sessionId,
    isInitiator: userId2 === initiator,
  });

  // Also emit legacy matched event for backward compatibility
  io.to(userId1).emit("matched", {
    partnerId: userId2,
    isInitiator: userId1 === initiator,
    sessionId: sessionId,
  });

  io.to(userId2).emit("matched", {
    partnerId: userId1,
    isInitiator: userId2 === initiator,
    sessionId: sessionId,
  });

  console.log("✅ Match created successfully!");
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
