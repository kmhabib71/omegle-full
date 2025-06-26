const { createServer } = require("http");
const { Server } = require("socket.io");
const MatchingEngine = require("./server/modules/matchingEngine");

// Create matching engine instance
const matchingEngine = new MatchingEngine();

// Legacy WebRTC compatibility maps (keeping minimal for backward compatibility)
const users = new Map();

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
  socket.on("find-partner", (userProfile = {}, callback) => {
    console.log(
      "🚀 FIND-PARTNER EVENT RECEIVED from:",
      socket.id,
      "with profile:",
      userProfile
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

    // Handle existing connection (NEXT button scenario)
    const existingUser = matchingEngine.users.get(socket.id);
    if (existingUser && existingUser.partnerId) {
      console.log(
        "🔄 User clicking NEXT - disconnecting current partner:",
        existingUser.partnerId
      );

      const currentPartnerId = existingUser.partnerId;

      // Disconnect users using matching engine
      const partnerId = matchingEngine.disconnectUsers(socket.id);
      if (partnerId) {
        // Notify partner
        io.to(partnerId).emit("partner-disconnected", {
          skipAutoSearch: false,
          reason: "Partner clicked NEXT",
        });
      }
    }

    // Add user to matching engine with enhanced profile
    const userProfileData = {
      userGender: userProfile.userGender || null,
      userLocation: userProfile.userLocation || null,
      matchGender: userProfile.matchGender || "all",
      matchLocation:
        userProfile.matchCountry || userProfile.matchLocation || null,
      matchGames:
        userProfile.matchGames ||
        userProfile.interests ||
        userProfile.matchInterest ||
        [],
    };

    console.log(
      "🔍 User profile data being sent to matching engine:",
      userProfileData
    );

    // The addUser method handles finding matches internally
    const matchResult = matchingEngine.addUser(socket.id, userProfileData);

    if (matchResult) {
      // Match found - create session and notify both users
      const { user1, user2, matchId } = matchResult;
      const initiator = user1 < user2 ? user1 : user2;
      const sessionId = matchId;

      console.log(
        `🎯 Enhanced match details: user1=${user1}, user2=${user2}, initiator=${initiator}, sessionId=${sessionId}`
      );

      // Emit partner-found event
      io.to(user1).emit("partner-found", {
        partnerId: user2,
        sessionId: sessionId,
        isInitiator: user1 === initiator,
      });

      io.to(user2).emit("partner-found", {
        partnerId: user1,
        sessionId: sessionId,
        isInitiator: user2 === initiator,
      });

      // Legacy compatibility
      io.to(user1).emit("matched", {
        partnerId: user2,
        isInitiator: user1 === initiator,
        sessionId: sessionId,
      });

      io.to(user2).emit("matched", {
        partnerId: user1,
        isInitiator: user2 === initiator,
        sessionId: sessionId,
      });

      console.log("✅ Enhanced match created successfully!");
    } else {
      console.log("📝 User added to enhanced waiting queues");
    }
  });

  // Handle finding next partner (Phase 5)
  socket.on("findNext", (userProfile = {}) => {
    console.log("🔄 Finding next partner for:", socket.id);

    // Disconnect from current partner using matching engine
    const partnerId = matchingEngine.disconnectUsers(socket.id);
    if (partnerId) {
      // Notify partner
      io.to(partnerId).emit("partner-disconnected", {
        skipAutoSearch: false,
        reason: "Partner clicked NEXT",
      });
    }

    // Use provided profile or default
    const userProfileData = {
      userGender: userProfile.userGender || null,
      userLocation: userProfile.userLocation || null,
      matchGender: userProfile.matchGender || "all",
      matchLocation:
        userProfile.matchCountry || userProfile.matchLocation || null,
      matchGames:
        userProfile.matchGames ||
        userProfile.interests ||
        userProfile.matchInterest ||
        [],
    };

    console.log("🔍 Profile data for findNext:", userProfileData);

    const matchResult = matchingEngine.addUser(socket.id, userProfileData);
    if (matchResult) {
      const { user1, user2, matchId } = matchResult;
      const initiator = user1 < user2 ? user1 : user2;

      // Notify both users
      io.to(user1).emit("partner-found", {
        partnerId: user2,
        sessionId: matchId,
        isInitiator: user1 === initiator,
      });

      io.to(user2).emit("partner-found", {
        partnerId: user1,
        sessionId: matchId,
        isInitiator: user2 === initiator,
      });

      // Legacy compatibility
      io.to(user1).emit("matched", {
        partnerId: user2,
        isInitiator: user1 === initiator,
        sessionId: matchId,
      });

      io.to(user2).emit("matched", {
        partnerId: user1,
        isInitiator: user2 === initiator,
        sessionId: matchId,
      });
    }
  });

  // Handle leaving queue
  socket.on("leave-queue", () => {
    console.log("📤 User leaving queue:", socket.id);
    matchingEngine.removeFromAllQueues(socket.id);
    socket.emit("queue-left");
  });

  // Handle partner disconnect
  socket.on("disconnect-partner", () => {
    console.log("🔌 Disconnecting partner for:", socket.id);
    const partnerId = matchingEngine.disconnectUsers(socket.id);
    if (partnerId) {
      io.to(partnerId).emit("partner-disconnected", {
        skipAutoSearch: false,
        reason: "Partner manually disconnected",
      });
    }
  });

  // Handle stopping chat (Phase 7)
  socket.on("stopChat", () => {
    console.log("🛑 Stopping chat for:", socket.id);
    const partnerId = matchingEngine.disconnectUsers(socket.id);
    if (partnerId) {
      io.to(partnerId).emit("partner-disconnected", {
        skipAutoSearch: false,
        reason: "Partner stopped the chat",
      });
    }

    // Set manual stop flag using matching engine
    matchingEngine.setManualStop(socket.id);
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
    const matchInfo = matchingEngine.activeMatches.get(socket.id);
    if (matchInfo) {
      const partnerId =
        matchInfo.user1 === socket.id ? matchInfo.user2 : matchInfo.user1;
      socket.to(partnerId).emit("offer", data);
    }
  });

  socket.on("answer", (data) => {
    console.log("📥 Forwarding answer from:", socket.id);
    const matchInfo = matchingEngine.activeMatches.get(socket.id);
    if (matchInfo) {
      const partnerId =
        matchInfo.user1 === socket.id ? matchInfo.user2 : matchInfo.user1;
      socket.to(partnerId).emit("answer", data);
    }
  });

  socket.on("ice-candidate", (data) => {
    console.log("🧊 Forwarding ICE candidate from:", socket.id);
    const matchInfo = matchingEngine.activeMatches.get(socket.id);
    if (matchInfo) {
      const partnerId =
        matchInfo.user1 === socket.id ? matchInfo.user2 : matchInfo.user1;
      socket.to(partnerId).emit("ice-candidate", data);
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
    const matchInfo = matchingEngine.activeMatches.get(socket.id);
    if (matchInfo) {
      const partnerId =
        matchInfo.user1 === socket.id ? matchInfo.user2 : matchInfo.user1;
      socket.to(partnerId).emit("message", {
        text: message,
        sender: "stranger",
        timestamp: Date.now(),
      });
    }
  });

  // Handle disconnect (Phase 6)
  socket.on("disconnect", () => {
    console.log("❌ User disconnected:", socket.id);

    // Disconnect from current partner using matching engine
    const partnerId = matchingEngine.disconnectUsers(socket.id);
    if (partnerId) {
      // Don't skip auto-search for unexpected disconnections
      io.to(partnerId).emit("partner-disconnected", {
        skipAutoSearch: false,
        reason: "Partner disconnected unexpectedly",
      });
    }

    // Remove from matching engine
    matchingEngine.removeUser(socket.id);
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
