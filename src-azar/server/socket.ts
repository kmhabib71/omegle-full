import { Server as NetServer } from "http";
import { NextApiRequest } from "next";
import { Server as SocketIOServer } from "socket.io";
import { NextApiResponseServerIO } from "@/types/next";

// Active user tracker
interface ActiveUser {
  socketId: string;
  userId: string;
  username: string;
  gender?: string;
  country?: string;
  filters?: {
    gender?: string;
    countries?: string[];
    ageMin?: number;
    ageMax?: number;
  };
}

// Active video sessions
interface VideoSession {
  id: string;
  users: string[]; // Array of two user IDs
  socketIds: string[]; // Array of two socket IDs
  startTime: Date;
}

// Active text sessions
interface TextSession {
  id: string;
  users: string[]; // Array of two user IDs
  socketIds: string[]; // Array of two socket IDs
  startTime: Date;
}

// Active voice sessions
interface VoiceSession {
  id: string;
  users: string[]; // Array of two user IDs
  socketIds: string[]; // Array of two socket IDs
  startTime: Date;
}

// Global store for active users and sessions
let activeUsers: ActiveUser[] = [];
let pendingMatches: string[] = []; // Array of socket IDs waiting for video matches
let pendingTextMatches: string[] = []; // Array of socket IDs waiting for text matches
let pendingVoiceMatches: string[] = []; // Array of socket IDs waiting for voice matches
let activeSessions: VideoSession[] = [];
let activeTextSessions: TextSession[] = [];
let activeVoiceSessions: VoiceSession[] = [];

export const initSocketServer = (
  req: NextApiRequest,
  res: NextApiResponseServerIO
) => {
  if (!res.socket.server.io) {
    console.log("*First use, starting Socket.io server");

    const httpServer: NetServer = res.socket.server as any;
    const io = new SocketIOServer(httpServer, {
      path: "/api/socket",
      addTrailingSlash: false,
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
      },
    });

    // Socket.io server logic
    io.on("connection", (socket) => {
      console.log(`Socket connected: ${socket.id}`);

      // User authentication and registration
      socket.on(
        "register_user",
        (userData: {
          userId: string;
          username: string;
          gender?: string;
          country?: string;
          filters?: any;
        }) => {
          // Add user to active users
          const existingUserIndex = activeUsers.findIndex(
            (user) => user.userId === userData.userId
          );
          if (existingUserIndex !== -1) {
            // Update socket ID if user reconnects
            activeUsers[existingUserIndex].socketId = socket.id;
          } else {
            // Add new user
            activeUsers.push({
              socketId: socket.id,
              userId: userData.userId,
              username: userData.username,
              gender: userData.gender,
              country: userData.country,
              filters: userData.filters,
            });
          }

          // Emit online users count to everyone
          io.emit("online_users_count", activeUsers.length);
          console.log(`User registered: ${userData.username} (${socket.id})`);
        }
      );

      // Request video chat
      socket.on("request_video_chat", () => {
        // User is looking for a match
        console.log(`User ${socket.id} is looking for a video chat match`);

        // Add to pending matches if not already there
        if (!pendingMatches.includes(socket.id)) {
          pendingMatches.push(socket.id);
        }

        // Try to match with another user
        matchUsers();
      });

      // Request text chat
      socket.on("request_text_chat", () => {
        // User is looking for a text match
        console.log(`User ${socket.id} is looking for a text chat match`);

        // Add to pending text matches if not already there
        if (!pendingTextMatches.includes(socket.id)) {
          pendingTextMatches.push(socket.id);
        }

        // Try to match with another user for text chat
        matchTextUsers();
      });

      // Request voice chat
      socket.on("request_voice_chat", () => {
        // User is looking for a voice match
        console.log(`User ${socket.id} is looking for a voice chat match`);

        // Add to pending voice matches if not already there
        if (!pendingVoiceMatches.includes(socket.id)) {
          pendingVoiceMatches.push(socket.id);
        }

        // Try to match with another user for voice chat
        matchVoiceUsers();
      });

      // Stop looking for a match
      socket.on("cancel_video_search", () => {
        // Remove from pending matches
        pendingMatches = pendingMatches.filter((id) => id !== socket.id);
        console.log(`User ${socket.id} cancelled video chat search`);
      });

      // Stop looking for a text match
      socket.on("cancel_text_search", () => {
        // Remove from pending text matches
        pendingTextMatches = pendingTextMatches.filter(
          (id) => id !== socket.id
        );
        console.log(`User ${socket.id} cancelled text chat search`);
      });

      // Stop looking for a voice match
      socket.on("cancel_voice_search", () => {
        // Remove from pending voice matches
        pendingVoiceMatches = pendingVoiceMatches.filter(
          (id) => id !== socket.id
        );
        console.log(`User ${socket.id} cancelled voice chat search`);
      });

      // WebRTC signaling
      socket.on("signal", (data: { to: string; signal: any }) => {
        console.log(
          `Signal from ${socket.id} to ${data.to}: ${
            data.signal.type || "unknown"
          }`
        );
        io.to(data.to).emit("signal", {
          from: socket.id,
          signal: data.signal,
        });
      });

      // User ends a video chat
      socket.on("end_video_chat", (sessionId: string) => {
        const session = activeSessions.find((s) => s.id === sessionId);
        if (session) {
          // Notify the other user
          const otherSocketId = session.socketIds.find(
            (id) => id !== socket.id
          );
          if (otherSocketId) {
            io.to(otherSocketId).emit("chat_ended", { sessionId });
          }

          // Remove the session
          activeSessions = activeSessions.filter((s) => s.id !== sessionId);
          console.log(`Video chat ended: ${sessionId}`);
        }
      });

      // User ends a text chat
      socket.on("end_text_chat", (sessionId: string) => {
        const session = activeTextSessions.find((s) => s.id === sessionId);
        if (session) {
          // Notify the other user
          const otherSocketId = session.socketIds.find(
            (id) => id !== socket.id
          );
          if (otherSocketId) {
            io.to(otherSocketId).emit("text_chat_ended", { sessionId });
          }

          // Remove the session
          activeTextSessions = activeTextSessions.filter(
            (s) => s.id !== sessionId
          );
          console.log(`Text chat ended: ${sessionId}`);
        }
      });

      // User ends a voice chat
      socket.on("end_voice_chat", (sessionId: string) => {
        const session = activeVoiceSessions.find((s) => s.id === sessionId);
        if (session) {
          // Notify the other user
          const otherSocketId = session.socketIds.find(
            (id) => id !== socket.id
          );
          if (otherSocketId) {
            io.to(otherSocketId).emit("voice_chat_ended", { sessionId });
          }

          // Remove the session
          activeVoiceSessions = activeVoiceSessions.filter(
            (s) => s.id !== sessionId
          );
          console.log(`Voice chat ended: ${sessionId}`);
        }
      });

      // Chat message in video session
      socket.on(
        "chat_message",
        (data: { sessionId: string; message: string }) => {
          const session = activeSessions.find((s) => s.id === data.sessionId);
          if (session) {
            // Find the other user in the session
            const otherSocketId = session.socketIds.find(
              (id) => id !== socket.id
            );
            if (otherSocketId) {
              // Send the message to the other user
              io.to(otherSocketId).emit("chat_message", {
                sessionId: data.sessionId,
                message: data.message,
                from: socket.id,
              });
            }
          }
        }
      );

      // Text message in text chat session
      socket.on(
        "text_message",
        (data: { sessionId: string; message: string }) => {
          const session = activeTextSessions.find(
            (s) => s.id === data.sessionId
          );
          if (session) {
            // Find the other user in the session
            const otherSocketId = session.socketIds.find(
              (id) => id !== socket.id
            );
            if (otherSocketId) {
              // Send the message to the other user
              io.to(otherSocketId).emit("text_message", {
                sessionId: data.sessionId,
                message: data.message,
                from: socket.id,
              });
            }
          }
        }
      );

      // Voice message in voice chat session
      socket.on(
        "voice_message",
        (data: { sessionId: string; message: string }) => {
          const session = activeVoiceSessions.find(
            (s) => s.id === data.sessionId
          );
          if (session) {
            // Find the other user in the session
            const otherSocketId = session.socketIds.find(
              (id) => id !== socket.id
            );
            if (otherSocketId) {
              // Send the message to the other user
              io.to(otherSocketId).emit("voice_message", {
                sessionId: data.sessionId,
                message: data.message,
                from: socket.id,
              });
            }
          }
        }
      );

      // Voice signaling for WebRTC
      socket.on(
        "voice_signal",
        (data: { sessionId: string; signal: any; type: string }) => {
          const session = activeVoiceSessions.find(
            (s) => s.id === data.sessionId
          );
          if (session) {
            // Find the other user in the session
            const otherSocketId = session.socketIds.find(
              (id) => id !== socket.id
            );
            if (otherSocketId) {
              // Send the signal to the other user
              io.to(otherSocketId).emit("voice_signal", {
                signal: data.signal,
                type: data.type,
              });
            }
          }
        }
      );

      // Handle disconnection
      socket.on("disconnect", () => {
        console.log(`Socket disconnected: ${socket.id}`);

        // Remove from active users
        activeUsers = activeUsers.filter((user) => user.socketId !== socket.id);

        // Remove from pending matches
        pendingMatches = pendingMatches.filter((id) => id !== socket.id);
        pendingTextMatches = pendingTextMatches.filter(
          (id) => id !== socket.id
        );
        pendingVoiceMatches = pendingVoiceMatches.filter(
          (id) => id !== socket.id
        );

        // End any active video sessions
        const userSessions = activeSessions.filter((session) =>
          session.socketIds.includes(socket.id)
        );
        userSessions.forEach((session) => {
          const otherSocketId = session.socketIds.find(
            (id) => id !== socket.id
          );
          if (otherSocketId) {
            io.to(otherSocketId).emit("chat_ended", { sessionId: session.id });
          }
        });

        activeSessions = activeSessions.filter(
          (session) => !session.socketIds.includes(socket.id)
        );

        // End any active text sessions
        const userTextSessions = activeTextSessions.filter((session) =>
          session.socketIds.includes(socket.id)
        );
        userTextSessions.forEach((session) => {
          const otherSocketId = session.socketIds.find(
            (id) => id !== socket.id
          );
          if (otherSocketId) {
            io.to(otherSocketId).emit("text_chat_ended", {
              sessionId: session.id,
            });
          }
        });

        activeTextSessions = activeTextSessions.filter(
          (session) => !session.socketIds.includes(socket.id)
        );

        // End any active voice sessions
        const userVoiceSessions = activeVoiceSessions.filter((session) =>
          session.socketIds.includes(socket.id)
        );
        userVoiceSessions.forEach((session) => {
          const otherSocketId = session.socketIds.find(
            (id) => id !== socket.id
          );
          if (otherSocketId) {
            io.to(otherSocketId).emit("voice_chat_ended", {
              sessionId: session.id,
            });
          }
        });

        activeVoiceSessions = activeVoiceSessions.filter(
          (session) => !session.socketIds.includes(socket.id)
        );

        // Update online count
        io.emit("online_users_count", activeUsers.length);
      });
    });

    // Function to match users for video chat
    function matchUsers() {
      // Need at least 2 users to match
      if (pendingMatches.length < 2) return;

      // Find a pair of users to match
      const socket1 = pendingMatches.shift();
      const socket2 = pendingMatches.shift();

      if (socket1 && socket2) {
        // Create a session ID
        const sessionId = `session_${Date.now()}_${Math.random()
          .toString(36)
          .substring(2, 9)}`;

        // Get user IDs
        const user1 = activeUsers.find((user) => user.socketId === socket1);
        const user2 = activeUsers.find((user) => user.socketId === socket2);

        if (user1 && user2) {
          // Create a session
          const session: VideoSession = {
            id: sessionId,
            users: [user1.userId, user2.userId],
            socketIds: [socket1, socket2],
            startTime: new Date(),
          };

          activeSessions.push(session);

          // Notify both users about the match
          io.to(socket1).emit("video_chat_matched", {
            sessionId,
            peer: socket2,
            userData: {
              username: user2.username,
              country: user2.country,
            },
          });

          io.to(socket2).emit("video_chat_matched", {
            sessionId,
            peer: socket1,
            userData: {
              username: user1.username,
              country: user1.country,
            },
          });

          console.log(
            `Matched users for video chat: ${user1.username} and ${user2.username}`
          );
        }
      }
    }

    // Function to match users for text chat
    function matchTextUsers() {
      // Need at least 2 users to match
      if (pendingTextMatches.length < 2) return;

      // Find a pair of users to match
      const socket1 = pendingTextMatches.shift();
      const socket2 = pendingTextMatches.shift();

      if (socket1 && socket2) {
        // Create a session ID
        const sessionId = `text_session_${Date.now()}_${Math.random()
          .toString(36)
          .substring(2, 9)}`;

        // Get user IDs
        const user1 = activeUsers.find((user) => user.socketId === socket1);
        const user2 = activeUsers.find((user) => user.socketId === socket2);

        if (user1 && user2) {
          // Create a text session
          const session: TextSession = {
            id: sessionId,
            users: [user1.userId, user2.userId],
            socketIds: [socket1, socket2],
            startTime: new Date(),
          };

          activeTextSessions.push(session);

          // Notify both users about the match
          io.to(socket1).emit("text_chat_matched", {
            sessionId,
            peer: socket2,
            userData: {
              username: user2.username,
              country: user2.country,
            },
          });

          io.to(socket2).emit("text_chat_matched", {
            sessionId,
            peer: socket1,
            userData: {
              username: user1.username,
              country: user1.country,
            },
          });

          console.log(
            `Matched users for text chat: ${user1.username} and ${user2.username}`
          );
        }
      }
    }

    // Function to match users for voice chat
    function matchVoiceUsers() {
      // Need at least 2 users to match
      if (pendingVoiceMatches.length < 2) return;

      // Find a pair of users to match
      const socket1 = pendingVoiceMatches.shift();
      const socket2 = pendingVoiceMatches.shift();

      if (socket1 && socket2) {
        // Create a session ID
        const sessionId = `voice_session_${Date.now()}_${Math.random()
          .toString(36)
          .substring(2, 9)}`;

        // Get user IDs
        const user1 = activeUsers.find((user) => user.socketId === socket1);
        const user2 = activeUsers.find((user) => user.socketId === socket2);

        if (user1 && user2) {
          // Create a voice session
          const session: VoiceSession = {
            id: sessionId,
            users: [user1.userId, user2.userId],
            socketIds: [socket1, socket2],
            startTime: new Date(),
          };

          activeVoiceSessions.push(session);

          // Notify both users about the match
          io.to(socket1).emit("voice_chat_matched", {
            sessionId,
            peer: socket2,
            userData: {
              username: user2.username,
              country: user2.country,
            },
            isInitiator: true,
          });

          io.to(socket2).emit("voice_chat_matched", {
            sessionId,
            peer: socket1,
            userData: {
              username: user1.username,
              country: user1.country,
            },
            isInitiator: false,
          });

          console.log(
            `Matched users for voice chat: ${user1.username} and ${user2.username}`
          );
        }
      }
    }

    // Attach to server
    res.socket.server.io = io;
  }

  res.end();
};

export const config = {
  api: {
    bodyParser: false,
  },
};
