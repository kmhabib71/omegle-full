const { createServer } = require("http");
const { Server } = require("socket.io");
const MatchingEngine = require("./server/modules/matchingEngine");

// Create matching engine instance
const matchingEngine = new MatchingEngine();

// Store for managing users and their connections (legacy - will be replaced by matchingEngine)
const users = new Map();
const waitingUsers = new Map(); // interests -> user IDs
const recentPartners = new Map(); // userId -> Set of recent partner IDs to prevent immediate re-matching

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
    if (existingUser && existingUser.partnerId && existingUser.inCall) {
      console.log(
        "🔄 User clicking NEXT - disconnecting current partner:",
        existingUser.partnerId
      );

      const currentPartnerId = existingUser.partnerId;

      // Disconnect users using matching engine
      matchingEngine.disconnectUsers(socket.id, currentPartnerId);

      // Notify partner
      io.to(currentPartnerId).emit("partner-disconnected", {
        skipAutoSearch: false,
        reason: "Partner clicked NEXT",
      });
    }

    // Add user to matching engine with enhanced profile
    const userProfileData = {
      userGender: userProfile.userGender || null,
      userLocation: userProfile.userLocation || null,
      matchGender: userProfile.matchGender || "all",
      matchLocation: userProfile.matchLocation || null,
      matchGames: userProfile.matchGames || userProfile.interests || [],
    };

    matchingEngine.addUser(socket.id, userProfileData);

    // Legacy support - also add to old users map for backward compatibility
    users.set(socket.id, {
      id: socket.id,
      interests: userProfile.matchGames || userProfile.interests || [],
      inCall: false,
      manualStop: false,
    });

    // Try to find a match using new engine
    console.log("🔍 CALLING enhanced findMatch for:", socket.id);
    const match = matchingEngine.findMatch(socket.id);

    if (match) {
      // Match found - create session and notify both users
      const { userId1, userId2 } = match;
      const initiator = userId1 < userId2 ? userId1 : userId2;
      const sessionId = `${userId1 < userId2 ? userId1 : userId2}-${
        userId1 < userId2 ? userId2 : userId1
      }-${Date.now()}`;

      console.log(
        `🎯 Enhanced match details: initiator=${initiator}, sessionId=${sessionId}`
      );

      // Update legacy users map for compatibility
      if (users.has(userId1)) {
        users.get(userId1).inCall = true;
        users.get(userId1).partnerId = userId2;
      }
      if (users.has(userId2)) {
        users.get(userId2).inCall = true;
        users.get(userId2).partnerId = userId1;
      }

      // Emit partner-found event
      io.to(userId1).emit("partner-found", {
        partnerId: userId2,
        sessionId: sessionId,
        isInitiator: userId1 === initiator,
      });

      io.to(userId2).emit("partner-found", {
        partnerId: userId1,
        sessionId: sessionId,
        isInitiator: userId2 === initiator,
      });

      // Legacy compatibility
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

      console.log("✅ Enhanced match created successfully!");
    } else {
      console.log("📝 User added to enhanced waiting queues");
    }
  });

  // Handle finding next partner (Phase 5)
  socket.on("findNext", () => {
    console.log("🔄 Finding next partner for:", socket.id);
    const user = matchingEngine.users.get(socket.id);
    if (user && user.partnerId) {
      // Disconnect from current partner using matching engine
      matchingEngine.disconnectUsers(socket.id, user.partnerId);

      // Update legacy users map
      if (users.has(user.partnerId)) {
        users.get(user.partnerId).inCall = false;
        users.get(user.partnerId).partnerId = undefined;
      }

      // Notify partner
      io.to(user.partnerId).emit("partner-disconnected", {
        skipAutoSearch: false,
        reason: "Partner clicked NEXT",
      });

      // Find new match using matching engine
      const match = matchingEngine.findMatch(socket.id);
      if (match) {
        const { userId1, userId2 } = match;
        const initiator = userId1 < userId2 ? userId1 : userId2;
        const sessionId = `${Date.now()}-${Math.random()
          .toString(36)
          .substr(2, 9)}`;

        // Update legacy users map
        if (users.has(userId1)) {
          users.get(userId1).inCall = true;
          users.get(userId1).partnerId = userId2;
        }
        if (users.has(userId2)) {
          users.get(userId2).inCall = true;
          users.get(userId2).partnerId = userId1;
        }

        // Notify both users
        io.to(userId1).emit("partner-found", {
          partnerId: userId2,
          sessionId: sessionId,
          isInitiator: userId1 === initiator,
        });

        io.to(userId2).emit("partner-found", {
          partnerId: userId1,
          sessionId: sessionId,
          isInitiator: userId2 === initiator,
        });
      }
    }
  });

  // Handle leaving queue
  socket.on("leave-queue", () => {
    console.log("📤 User leaving queue:", socket.id);
    matchingEngine.removeFromAllQueues(socket.id);

    // Legacy cleanup
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
    const user = matchingEngine.users.get(socket.id);
    if (user && user.partnerId) {
      matchingEngine.disconnectUsers(socket.id, user.partnerId);

      // Update legacy users map
      if (users.has(user.partnerId)) {
        users.get(user.partnerId).inCall = false;
        users.get(user.partnerId).partnerId = undefined;
      }

      io.to(user.partnerId).emit("partner-disconnected", {
        skipAutoSearch: false,
        reason: "Partner manually disconnected",
      });
    }
  });

  // Handle stopping chat (Phase 7)
  socket.on("stopChat", () => {
    console.log("🛑 Stopping chat for:", socket.id);
    const user = matchingEngine.users.get(socket.id);
    if (user && user.partnerId) {
      matchingEngine.disconnectUsers(socket.id, user.partnerId);

      // Update legacy users map
      if (users.has(user.partnerId)) {
        users.get(user.partnerId).inCall = false;
        users.get(user.partnerId).partnerId = undefined;
      }

      io.to(user.partnerId).emit("partner-disconnected", {
        skipAutoSearch: false,
        reason: "Partner stopped the chat",
      });

      // Set manual stop flag using matching engine
      matchingEngine.setManualStop(socket.id);

      // Update legacy users map
      if (users.has(socket.id)) {
        users.get(socket.id).manualStop = true;
        setTimeout(() => {
          if (users.has(socket.id)) {
            users.get(socket.id).manualStop = false;
          }
        }, 30000);
      }
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

    // Get user from matching engine
    const user = matchingEngine.users.get(socket.id);
    if (user) {
      // Notify partner using matching engine
      if (user.partnerId) {
        matchingEngine.disconnectUsers(socket.id, user.partnerId);

        // Update legacy users map
        if (users.has(user.partnerId)) {
          users.get(user.partnerId).inCall = false;
          users.get(user.partnerId).partnerId = undefined;
        }

        // Don't skip auto-search for unexpected disconnections
        io.to(user.partnerId).emit("partner-disconnected", {
          skipAutoSearch: false,
          reason: "Partner disconnected unexpectedly",
        });
      }

      // Remove from matching engine
      matchingEngine.removeUser(socket.id);
    }

    // Legacy cleanup
    if (users.has(socket.id)) {
      const legacyUser = users.get(socket.id);
      if (legacyUser.partnerId) {
        const partner = users.get(legacyUser.partnerId);
        if (partner) {
          partner.inCall = false;
          partner.partnerId = undefined;
        }
      }
      users.delete(socket.id);
    }

    // Remove from waiting lists (legacy)
    waitingUsers.forEach((userIds, interests) => {
      const index = userIds.indexOf(socket.id);
      if (index > -1) {
        userIds.splice(index, 1);
      }
    });
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
  console.log(`🔍 Finding match for user ${userId} with interests:`, interests);

  // 🚨 DEBUG: Log current state
  console.log("📊 Current users:", Array.from(users.keys()));
  console.log("📊 Current waitingUsers:", Array.from(waitingUsers.entries()));
  console.log("📊 Recent partners:", Array.from(recentPartners.entries()));

  // Check users status
  users.forEach((user, id) => {
    console.log(
      `👤 User ${id}: inCall=${user.inCall}, manualStop=${user.manualStop}, partnerId=${user.partnerId}`
    );
  });

  // ✅ FIXED: Use First In, First Out (FIFO) ordering for fair matching
  // 1️⃣ Try to match with waiting users having same interests (FIFO order)
  for (const [interestKey, userArray] of waitingUsers.entries()) {
    if (interestKey === interests.join(",") && userArray.length > 0) {
      console.log(`🔍 Checking interest-based matches for key: ${interestKey}`);
      for (let i = 0; i < userArray.length; i++) {
        const potentialMatch = userArray[i];
        const potentialMatchId = potentialMatch.userId || potentialMatch; // Handle both object and string
        console.log(`🔍 Checking potential match: ${potentialMatchId}`);

        // 🚨 NEW: Skip if recently connected or in manual stop
        if (
          potentialMatchId !== userId &&
          users.has(potentialMatchId) &&
          !users.get(potentialMatchId).inCall &&
          !users.get(potentialMatchId).manualStop &&
          !wereRecentlyConnected(userId, potentialMatchId)
        ) {
          console.log(
            `✅ Found interest-based match: ${userId} ↔ ${potentialMatchId}`
          );
          // Remove from waiting queue
          userArray.splice(i, 1);
          if (userArray.length === 0) {
            waitingUsers.delete(interestKey);
          }
          createMatch(userId, potentialMatchId);
          return potentialMatchId;
        } else {
          console.log(
            `❌ Skipping ${potentialMatchId}: inCall=${
              users.get(potentialMatchId)?.inCall
            }, manualStop=${
              users.get(potentialMatchId)?.manualStop
            }, recentlyConnected=${wereRecentlyConnected(
              userId,
              potentialMatchId
            )}`
          );
        }
      }
    }
  }

  // 2️⃣ Try to match with general waiting users (FIFO order)
  if (waitingUsers.has("general") && waitingUsers.get("general").length > 0) {
    console.log(`🔍 Checking general queue matches`);
    const generalUsers = waitingUsers.get("general");
    for (let i = 0; i < generalUsers.length; i++) {
      const potentialMatch = generalUsers[i];
      const potentialMatchId = potentialMatch.userId || potentialMatch; // Handle both object and string
      console.log(`🔍 Checking general potential match: ${potentialMatchId}`);

      // 🚨 NEW: Skip if recently connected or in manual stop
      if (
        potentialMatchId !== userId &&
        users.has(potentialMatchId) &&
        !users.get(potentialMatchId).inCall &&
        !users.get(potentialMatchId).manualStop &&
        !wereRecentlyConnected(userId, potentialMatchId)
      ) {
        console.log(
          `✅ Found general queue match: ${userId} ↔ ${potentialMatchId}`
        );
        // Remove from waiting queue
        generalUsers.splice(i, 1);
        if (generalUsers.length === 0) {
          waitingUsers.delete("general");
        }
        createMatch(userId, potentialMatchId);
        return potentialMatchId;
      } else {
        console.log(
          `❌ Skipping general ${potentialMatchId}: inCall=${
            users.get(potentialMatchId)?.inCall
          }, manualStop=${
            users.get(potentialMatchId)?.manualStop
          }, recentlyConnected=${wereRecentlyConnected(
            userId,
            potentialMatchId
          )}`
        );
      }
    }
  }

  // 3️⃣ Try immediate matching with any available user (only if no queue exists)
  let hasAnyWaitingUsers = false;
  for (const [key, userArray] of waitingUsers.entries()) {
    if (userArray.length > 0) {
      hasAnyWaitingUsers = true;
      break;
    }
  }

  if (!hasAnyWaitingUsers) {
    console.log(`🔍 No waiting users, trying immediate matching`);
    for (const [candidateId, candidate] of users.entries()) {
      console.log(`🔍 Checking immediate candidate: ${candidateId}`);
      // 🚨 NEW: Skip if recently connected or in manual stop
      if (
        candidateId !== userId &&
        !candidate.inCall &&
        !candidate.manualStop &&
        !wereRecentlyConnected(userId, candidateId)
      ) {
        console.log(`✅ Found immediate match: ${userId} ↔ ${candidateId}`);
        createMatch(userId, candidateId);
        return candidateId;
      } else {
        console.log(
          `❌ Skipping immediate ${candidateId}: inCall=${
            candidate.inCall
          }, manualStop=${
            candidate.manualStop
          }, recentlyConnected=${wereRecentlyConnected(userId, candidateId)}`
        );
      }
    }
  }

  console.log(`❌ No match found for user ${userId}. Adding to queue...`);

  // Add to appropriate queue
  const queueKey = interests.length > 0 ? interests.join(",") : "general";
  if (!waitingUsers.has(queueKey)) {
    waitingUsers.set(queueKey, []);
  }

  // Add user to queue (as object for FIFO)
  waitingUsers.get(queueKey).push({
    userId: userId,
    timestamp: Date.now(),
  });

  console.log(`📝 Added ${userId} to ${queueKey} queue`);
  return null;
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

  // 🚨 NEW: Add recent partner tracking
  addRecentPartner(userId1, userId2);
  addRecentPartner(userId2, userId1);

  // Set up the match
  user1.inCall = true;
  user1.partnerId = userId2;
  user1.manualStop = false; // Reset manual stop flag when in call
  user2.inCall = true;
  user2.partnerId = userId1;
  user2.manualStop = false; // Reset manual stop flag when in call

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

// Function to add recent partner with cleanup after 30 seconds
function addRecentPartner(userId, partnerId) {
  if (!recentPartners.has(userId)) {
    recentPartners.set(userId, new Set());
  }
  recentPartners.get(userId).add(partnerId);

  // Clean up after 30 seconds
  setTimeout(() => {
    if (recentPartners.has(userId)) {
      recentPartners.get(userId).delete(partnerId);
    }
  }, 30000);
}

// Function to check if two users were recently connected
function wereRecentlyConnected(userId1, userId2) {
  return (
    (recentPartners.has(userId1) && recentPartners.get(userId1).has(userId2)) ||
    (recentPartners.has(userId2) && recentPartners.get(userId2).has(userId1))
  );
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
