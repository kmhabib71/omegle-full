const { createServer } = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");

// Store for managing users and their connections
const users = new Map();
const waitingUsers = new Map(); // interests -> user IDs
const recentPartners = new Map(); // userId -> Set of recent partner IDs to prevent immediate re-matching

// MongoDB connection and models
let ChatSession;
let connectDB;

// Initialize MongoDB connection
async function initMongoDB() {
  try {
    const MONGODB_URI =
      process.env.MONGODB_URI ||
      "mongodb+srv://learnwithaidev:Flower71@cluster0.lv8e9xe.mongodb.net/omegle?retryWrites=true&w=majority&appName=Cluster0";

    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(MONGODB_URI, {
        bufferCommands: false,
      });
      console.log("✅ MongoDB connected for session tracking");
    }

    // Define ChatSession schema
    const ChatSessionSchema = new mongoose.Schema(
      {
        sessionId: { type: String, required: true, unique: true },
        user1Id: { type: String, required: true },
        user2Id: { type: String, required: true },
        sessionType: { type: String, enum: ["text", "video"], required: true },
        startTime: { type: Date, default: Date.now },
        endTime: { type: Date },
        duration: { type: Number },
        status: {
          type: String,
          enum: ["active", "ended", "disconnected"],
          default: "active",
        },
        interests: [{ type: String }],
        messagesCount: { type: Number, default: 0 },
        endReason: {
          type: String,
          enum: ["next", "stop", "disconnect", "error"],
        },
      },
      { timestamps: true }
    );

    ChatSession =
      mongoose.models.ChatSession ||
      mongoose.model("ChatSession", ChatSessionSchema);
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error);
  }
}

// Initialize MongoDB when server starts
initMongoDB();

// Helper function to create session in database
async function createSessionInDB(
  sessionId,
  user1Id,
  user2Id,
  interests,
  sessionType = "text"
) {
  if (!ChatSession) return;

  try {
    await ChatSession.create({
      sessionId,
      user1Id,
      user2Id,
      interests: interests || [],
      sessionType,
      status: "active",
    });
    console.log(`📝 Session ${sessionId} created in database`);
  } catch (error) {
    console.error("❌ Failed to create session in DB:", error);
  }
}

// Helper function to end session in database
async function endSessionInDB(sessionId, endReason = "disconnect") {
  if (!ChatSession) return;

  try {
    const session = await ChatSession.findOne({ sessionId });
    if (session && session.status === "active") {
      const endTime = new Date();
      const duration = Math.floor((endTime - session.startTime) / 1000);

      await ChatSession.updateOne(
        { sessionId },
        {
          status: "ended",
          endTime,
          duration,
          endReason,
        }
      );
      console.log(`📝 Session ${sessionId} ended in database (${duration}s)`);
    }
  } catch (error) {
    console.error("❌ Failed to end session in DB:", error);
  }
}

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

      // End session in database
      if (existingUser.sessionId) {
        endSessionInDB(existingUser.sessionId, "next");
      }

      // 🚨 ATOMIC DISCONNECTION: Reset both users' states simultaneously to prevent cascade
      existingUser.inCall = false;
      existingUser.partnerId = undefined;
      existingUser.sessionId = undefined;

      if (currentPartner) {
        // End partner's session too
        if (currentPartner.sessionId) {
          endSessionInDB(currentPartner.sessionId, "next");
        }

        currentPartner.inCall = false;
        currentPartner.partnerId = undefined;
        currentPartner.sessionId = undefined;

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

    // Reset manual stop flag when user starts finding partner
    const existingUserData = users.get(socket.id);
    users.set(socket.id, {
      id: socket.id,
      interests,
      inCall: false,
      manualStop: false, // Reset manual stop flag when actively finding partner
    });

    if (existingUserData && existingUserData.manualStop) {
      console.log("🟢 Manual stop flag reset for:", socket.id);
    }

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
      // End current session in database
      if (user.sessionId) {
        endSessionInDB(user.sessionId, "next");
      }

      // Disconnect from current partner
      if (user.partnerId) {
        const partner = users.get(user.partnerId);
        if (partner) {
          // End partner's session too
          if (partner.sessionId) {
            endSessionInDB(partner.sessionId, "next");
          }

          partner.inCall = false;
          partner.partnerId = undefined;
          partner.sessionId = undefined;

          io.to(user.partnerId).emit("partner-disconnected", {
            skipAutoSearch: false,
            reason: "Partner clicked NEXT",
          });
        }
      }

      // Reset user state
      user.inCall = false;
      user.partnerId = undefined;
      user.sessionId = undefined;

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
      // End session in database
      if (user.sessionId) {
        endSessionInDB(user.sessionId, "disconnect");
      }

      const partner = users.get(user.partnerId);
      if (partner) {
        // End partner's session too
        if (partner.sessionId) {
          endSessionInDB(partner.sessionId, "disconnect");
        }

        partner.inCall = false;
        partner.partnerId = undefined;
        partner.sessionId = undefined;

        io.to(user.partnerId).emit("partner-disconnected", {
          skipAutoSearch: false,
          reason: "Partner manually disconnected",
        });
      }
      user.inCall = false;
      user.partnerId = undefined;
      user.sessionId = undefined;
    }
  });

  // Handle stopping chat (Phase 7)
  socket.on("stopChat", () => {
    console.log("🛑 Stopping chat for:", socket.id);
    const user = users.get(socket.id);
    if (user && user.partnerId) {
      // End session in database
      if (user.sessionId) {
        endSessionInDB(user.sessionId, "stop");
      }

      const partner = users.get(user.partnerId);
      if (partner) {
        // End partner's session too
        if (partner.sessionId) {
          endSessionInDB(partner.sessionId, "stop");
        }

        partner.inCall = false;
        partner.partnerId = undefined;
        partner.sessionId = undefined;

        io.to(user.partnerId).emit("partner-disconnected", {
          skipAutoSearch: false,
          reason: "Partner stopped the chat",
        });
      }
      user.inCall = false;
      user.partnerId = undefined;
      user.sessionId = undefined;
      // 🚨 FIXED: Set manual stop flag for 30 seconds only
      user.manualStop = true;
      console.log("🛑 Manual stop flag set for 30 seconds:", socket.id);

      // Auto-reset manualStop after 30 seconds
      setTimeout(() => {
        const currentUser = users.get(socket.id);
        if (currentUser && currentUser.manualStop) {
          currentUser.manualStop = false;
          console.log("🟢 Manual stop flag auto-reset for:", socket.id);
        }
      }, 30000);
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
      // End session in database if user was in a call
      if (user.partnerId && user.sessionId) {
        endSessionInDB(user.sessionId, "disconnect");
      }

      // Notify partner
      if (user.partnerId) {
        const partner = users.get(user.partnerId);
        if (partner) {
          // End session for partner too
          if (partner.sessionId) {
            endSessionInDB(partner.sessionId, "disconnect");
          }

          partner.inCall = false;
          partner.partnerId = undefined;
          partner.sessionId = undefined;

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

  // Generate sessionId first
  const sessionId = `${userId1 < userId2 ? userId1 : userId2}-${
    userId1 < userId2 ? userId2 : userId1
  }-${Date.now()}`;

  // 🚨 NEW: Add recent partner tracking
  addRecentPartner(userId1, userId2);
  addRecentPartner(userId2, userId1);

  // Set up the match
  user1.inCall = true;
  user1.partnerId = userId2;
  user1.sessionId = sessionId;
  user1.manualStop = false; // Reset manual stop flag when in call
  user2.inCall = true;
  user2.partnerId = userId1;
  user2.sessionId = sessionId;
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

  console.log(
    `🎯 Match details: initiator=${initiator}, sessionId=${sessionId}`
  );

  // Create session in database
  const interests = [...(user1.interests || []), ...(user2.interests || [])];
  const uniqueInterests = [...new Set(interests)];
  createSessionInDB(sessionId, userId1, userId2, uniqueInterests, "text");

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
