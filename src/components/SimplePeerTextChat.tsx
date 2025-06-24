"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import SimplePeer from "simple-peer";

interface ConnectionState {
  socket: "disconnected" | "connecting" | "connected";
  peer:
    | "not_initialized"
    | "initialized"
    | "connecting"
    | "connected"
    | "failed";
  queue: "not_in_queue" | "searching" | "matched";
}

interface Message {
  id: string;
  text: string;
  sender: "me" | "partner";
  timestamp: number;
}

interface SimplePeerTextChatProps {
  session?: any;
}

export default function SimplePeerTextChat({
  session,
}: SimplePeerTextChatProps) {
  const socketRef = useRef<Socket | null>(null);
  const peerRef = useRef<SimplePeer.Instance | null>(null);
  const chatMessagesRef = useRef<HTMLDivElement>(null);

  const [connectionState, setConnectionState] = useState<ConnectionState>({
    socket: "disconnected",
    peer: "not_initialized",
    queue: "not_in_queue",
  });

  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLookingForPartner, setIsLookingForPartner] = useState(false);
  const [disconnectionMessage, setDisconnectionMessage] = useState<
    string | null
  >(null);
  const [showDisconnectionAlert, setShowDisconnectionAlert] = useState(false);
  const [interests, setInterests] = useState<string[]>([]);
  const [currentInterest, setCurrentInterest] = useState("");

  // Message state
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentMessage, setCurrentMessage] = useState("");

  // Add message functions
  const addMessage = useCallback((text: string, sender: "me" | "partner") => {
    const newMessage: Message = {
      id: Date.now().toString(),
      text,
      sender,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, newMessage]);

    // Auto-scroll to bottom
    setTimeout(() => {
      if (chatMessagesRef.current) {
        chatMessagesRef.current.scrollTop =
          chatMessagesRef.current.scrollHeight;
      }
    }, 100);
  }, []);

  const sendMessage = useCallback(() => {
    if (
      !currentMessage.trim() ||
      !peerRef.current ||
      connectionState.peer !== "connected"
    ) {
      return;
    }

    try {
      // Send message through SimplePeer data channel
      peerRef.current.send(
        JSON.stringify({
          type: "chat-message",
          text: currentMessage.trim(),
        })
      );

      // Add to our own message list
      addMessage(currentMessage.trim(), "me");
      setCurrentMessage("");
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  }, [currentMessage, connectionState.peer, addMessage]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setCurrentMessage("");
  }, []);

  // Phase 6: Partner Disconnection Handler
  const handlePartnerDisconnection = useCallback(
    (reason: string, skipAutoSearch: boolean = false) => {
      console.log("🔌 Phase 6: Handling partner disconnection -", reason);

      // Show visual disconnection alert modal
      setShowDisconnectionAlert(true);
      setTimeout(() => {
        setShowDisconnectionAlert(false);
      }, 2000);

      // 1. Disconnection Detection - Clean up connection resources
      if (peerRef.current) {
        console.log("✅ Cleaning up SimplePeer connection resources");
        peerRef.current.destroy();
        peerRef.current = null;
      }

      // Clear chat messages
      clearMessages();

      // 2. Auto-Search Activation - Conditionally re-enter matching queue
      setPartnerId(null);
      setSessionId(null);

      if (!skipAutoSearch) {
        console.log("✅ Auto-search activation - re-entering matching queue");
        setIsLookingForPartner(true);
        setDisconnectionMessage(`${reason} - Looking for new stranger...`);

        // Update connection status
        setConnectionState((prev) => ({
          ...prev,
          peer: "not_initialized",
          queue: "searching",
        }));

        // Start new search automatically with a small delay to prevent cascade
        setTimeout(() => {
          if (socketRef.current?.connected) {
            socketRef.current.emit(
              "find-partner",
              interests,
              (response: any) => {
                console.log("📨 Auto-search find-partner response:", response);
              }
            );
          }
        }, 1000);

        // Clear disconnection message after 5 seconds
        setTimeout(() => {
          setDisconnectionMessage(null);
        }, 5000);
      } else {
        console.log("⏸️ Skipping auto-search to prevent cascade");
        setIsLookingForPartner(false);
        setDisconnectionMessage(
          `${reason} - Click START to find a new stranger.`
        );

        // Update connection status to idle
        setConnectionState((prev) => ({
          ...prev,
          peer: "not_initialized",
          queue: "not_in_queue",
        }));

        // Clear message after longer delay
        setTimeout(() => {
          setDisconnectionMessage(null);
        }, 8000);
      }

      console.log("✅ Phase 6 complete: Auto-search activated, UI updated");
    },
    [clearMessages, interests]
  );

  const initializeSocket = useCallback(() => {
    console.log("🔌 Initializing socket connection...");

    if (socketRef.current?.connected) {
      console.log("✅ Socket already connected");
      return;
    }

    socketRef.current = io("http://localhost:3001", {
      transports: ["websocket"],
      upgrade: true,
    });

    socketRef.current.on("connect", () => {
      console.log("✅ Socket connected:", socketRef.current?.id);
      setConnectionState((prev) => ({ ...prev, socket: "connected" }));
    });

    socketRef.current.on("disconnect", () => {
      console.log("❌ Socket disconnected");
      setConnectionState((prev) => ({ ...prev, socket: "disconnected" }));
    });

    socketRef.current.on("partner-found", (data) => {
      console.log("🎯 Partner found:", data);
      setPartnerId(data.partnerId);
      setSessionId(data.sessionId);
      setConnectionState((prev) => ({ ...prev, queue: "matched" }));

      // Use data directly instead of state
      const isInitiator = data.isInitiator;
      initializePeerWithData(isInitiator, data.partnerId, data.sessionId);
    });

    socketRef.current.on("webrtc-signal", (data) => {
      console.log("📡 Received WebRTC signal:", data.type);
      if (peerRef.current && !peerRef.current.destroyed) {
        peerRef.current.signal(data.signal);
      }
    });

    // Phase 6: Partner Disconnection Handling
    socketRef.current.on("partner-disconnected", (data) => {
      console.log(
        "🔌 Phase 6: Partner disconnected - handling disconnection",
        data
      );
      const skipAutoSearch = data?.skipAutoSearch || false;
      const reason = data?.reason || "Partner disconnected";
      handlePartnerDisconnection(reason, skipAutoSearch);
    });

    setConnectionState((prev) => ({ ...prev, socket: "connecting" }));
  }, [handlePartnerDisconnection]);

  const initializePeerWithData = useCallback(
    (isInitiator: boolean, partnerIdParam: string, sessionIdParam: string) => {
      console.log(
        "🔗 Initializing SimplePeer connection for text chat, initiator:",
        isInitiator,
        "partnerId:",
        partnerIdParam
      );

      if (peerRef.current) {
        peerRef.current.destroy();
      }

      // Initialize SimplePeer without stream (text-only)
      peerRef.current = new SimplePeer({
        initiator: isInitiator,
        trickle: true,
        config: {
          iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:global.stun.twilio.com:3478" },
          ],
        },
      });

      peerRef.current.on("signal", (signal) => {
        console.log(
          "📤 Sending signal to partner via socket, partnerId:",
          partnerIdParam
        );
        if (socketRef.current && partnerIdParam) {
          socketRef.current.emit(
            "webrtc-signal",
            {
              partnerId: partnerIdParam,
              sessionId: sessionIdParam,
              signal,
              type: signal.type || "signal",
            },
            (ack: any) => {
              console.log("📨 Signal acknowledgment:", ack);
            }
          );
        } else {
          console.error(
            "❌ Cannot send signal - missing partnerId or socket:",
            {
              hasSocket: !!socketRef.current,
              partnerId: partnerIdParam,
              sessionId: sessionIdParam,
            }
          );
        }
      });

      peerRef.current.on("connect", () => {
        console.log("🎉 SimplePeer text chat connection established!");
        setConnectionState((prev) => ({ ...prev, peer: "connected" }));
      });

      // Handle incoming data (text messages)
      peerRef.current.on("data", (data) => {
        try {
          const message = JSON.parse(data.toString());
          if (message.type === "chat-message") {
            addMessage(message.text, "partner");
          }
        } catch (error) {
          console.error("Failed to parse incoming message:", error);
        }
      });

      peerRef.current.on("error", (err) => {
        console.error("❌ SimplePeer error:", err);
        setConnectionState((prev) => ({ ...prev, peer: "failed" }));
        // Phase 6: Handle unexpected disconnections
        if (partnerId) {
          handlePartnerDisconnection("Connection error occurred", false);
        }
      });

      peerRef.current.on("close", () => {
        console.log("🔌 SimplePeer connection closed");
        setConnectionState((prev) => ({ ...prev, peer: "not_initialized" }));
        // Phase 6: Handle WebRTC connection closure
        if (partnerId) {
          handlePartnerDisconnection("Connection closed", false);
        }
      });

      setConnectionState((prev) => ({ ...prev, peer: "connecting" }));
    },
    [addMessage, handlePartnerDisconnection, partnerId]
  );

  const startSearch = useCallback(() => {
    console.log("🔍 Starting partner search for text chat...");

    if (!socketRef.current?.connected) {
      console.error("❌ Socket not connected");
      return;
    }

    setIsLookingForPartner(true);
    setConnectionState((prev) => ({ ...prev, queue: "searching" }));

    socketRef.current.emit("find-partner", interests, (response: any) => {
      console.log("📨 Find-partner response:", response);
    });
  }, [interests]);

  // Phase 5A: NEXT Button Click (Find New Partner)
  const findNextPartner = useCallback(() => {
    console.log("🔄 Phase 5A: Finding next partner...");

    // Current Connection Cleanup
    if (peerRef.current) {
      console.log("✅ Closing SimplePeer connection via destroy()");
      peerRef.current.destroy();
      peerRef.current = null;
    }

    // Log session end (in a real app, this would log to database)
    console.log("✅ Logging session end for partner:", partnerId);

    // Clear chat messages
    clearMessages();

    // Re-queue Process
    setPartnerId(null);
    setSessionId(null);
    setConnectionState((prev) => ({
      ...prev,
      peer: "not_initialized",
      queue: "searching", // Update UI to "searching" state
    }));

    // Add user back to matching queue & Start new matching process
    console.log("✅ Adding user back to matching queue");
    setIsLookingForPartner(true);

    if (socketRef.current?.connected) {
      socketRef.current.emit("find-partner", interests, (response: any) => {
        console.log("📨 Re-queue find-partner response:", response);
      });
    }

    // Button State Management happens automatically via state changes
    console.log(
      "✅ Button state updated: NEXT hidden, STOP enabled, searching indicator shown"
    );
  }, [partnerId, clearMessages, interests]);

  // Phase 5B: STOP Button Click (Complete Termination)
  const stopSession = useCallback(() => {
    console.log("🛑 Phase 5B: Complete session termination...");

    // Complete Cleanup
    if (peerRef.current) {
      console.log("✅ Closing SimplePeer connection");
      peerRef.current.destroy();
      peerRef.current = null;
    }

    // 🔧 FIX: Notify partner about disconnection BEFORE stopping
    if (partnerId && socketRef.current?.connected) {
      console.log("✅ Notifying partner about STOP disconnection");
      socketRef.current.emit("stopChat");
    }

    // Remove from matching queue
    if (socketRef.current?.connected) {
      console.log("✅ Removing from matching queue");
      socketRef.current.emit("leave-queue");
    }

    // UI Reset
    setPartnerId(null);
    setSessionId(null);
    setIsLookingForPartner(false);
    setDisconnectionMessage(null);
    setConnectionState((prev) => ({
      ...prev,
      peer: "not_initialized",
      queue: "not_in_queue",
    }));

    // Clear chat messages
    clearMessages();
    console.log("✅ Session completely terminated - UI reset to initial state");
    console.log("✅ START button will show, NEXT and STOP buttons hidden");
  }, [partnerId, clearMessages]);

  // Interest management functions
  const addInterest = useCallback(() => {
    if (currentInterest.trim() && !interests.includes(currentInterest.trim())) {
      setInterests((prev) => [...prev, currentInterest.trim()]);
      setCurrentInterest("");
    }
  }, [currentInterest, interests]);

  const removeInterest = useCallback((interestToRemove: string) => {
    setInterests((prev) =>
      prev.filter((interest) => interest !== interestToRemove)
    );
  }, []);

  useEffect(() => {
    initializeSocket();

    return () => {
      if (peerRef.current) {
        peerRef.current.destroy();
      }
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [initializeSocket]);

  const canStart =
    connectionState.socket === "connected" && !isLookingForPartner;
  const isConnected = connectionState.peer === "connected";
  const isSearching = connectionState.queue === "searching";

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-4">
      <div className="w-full max-w-6xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">SimplePeer Text Chat</h1>
          <p className="text-gray-400">
            Connect with strangers for text conversations
          </p>
        </div>

        <div className="bg-gray-800 rounded-lg p-4 mb-6">
          <h3 className="text-lg font-semibold mb-3">Connection Status</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div
              className={`p-2 rounded ${
                connectionState.socket === "connected"
                  ? "bg-green-600"
                  : "bg-red-600"
              }`}
            >
              Socket: {connectionState.socket}
            </div>
            <div
              className={`p-2 rounded ${
                connectionState.peer === "connected"
                  ? "bg-green-600"
                  : "bg-yellow-600"
              }`}
            >
              Peer: {connectionState.peer}
            </div>
            <div
              className={`p-2 rounded ${
                connectionState.queue === "matched"
                  ? "bg-green-600"
                  : "bg-yellow-600"
              }`}
            >
              Queue: {connectionState.queue}
            </div>
          </div>
        </div>

        {/* Phase 6: Disconnection Message Display */}
        {disconnectionMessage && (
          <div className="bg-orange-600 rounded-lg p-4 mb-6 text-center">
            <div className="flex items-center justify-center gap-2">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              <span className="text-lg font-semibold">
                {disconnectionMessage}
              </span>
            </div>
          </div>
        )}

        {/* 🚨 ENHANCED: Modal-style Disconnection Alert */}
        {showDisconnectionAlert && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
            <div className="bg-red-600 text-white p-8 rounded-xl shadow-2xl max-w-md w-full mx-4 text-center animate-pulse">
              <div className="text-6xl mb-4">⚠️</div>
              <h2 className="text-2xl font-bold mb-4">Partner Disconnected!</h2>
              <p className="text-lg mb-4">Your partner has left the chat.</p>
              <p className="text-md">
                Automatically searching for a new stranger...
              </p>
              <div className="mt-6">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto"></div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Interests Section */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-3">Interests (Optional)</h3>
            <div className="mb-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={currentInterest}
                  onChange={(e) => setCurrentInterest(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addInterest();
                    }
                  }}
                  placeholder="Add an interest..."
                  disabled={isLookingForPartner || isConnected}
                  className="flex-1 px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <button
                  onClick={addInterest}
                  disabled={
                    !currentInterest.trim() ||
                    isLookingForPartner ||
                    isConnected
                  }
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-colors"
                >
                  Add
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 min-h-[120px]">
              {interests.length === 0 ? (
                <div className="text-gray-400 text-sm text-center w-full mt-8">
                  No interests added. Leave empty for random matching.
                </div>
              ) : (
                interests.map((interest) => (
                  <span
                    key={interest}
                    className="px-3 py-1 bg-blue-600 text-white rounded-full text-sm flex items-center gap-2"
                  >
                    {interest}
                    {!isLookingForPartner && !isConnected && (
                      <button
                        onClick={() => removeInterest(interest)}
                        className="hover:bg-blue-700 rounded-full w-5 h-5 flex items-center justify-center text-xs"
                      >
                        ×
                      </button>
                    )}
                  </span>
                ))
              )}
            </div>
            <div className="mt-3 text-xs text-gray-400">
              {interests.length > 0
                ? "Will match with people who share similar interests"
                : "Leave empty to match with random strangers"}
            </div>
          </div>

          {/* Chat Section */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-3">
              {isConnected ? "Chat with Stranger" : "Chat (Connect to enable)"}
            </h3>
            <div
              ref={chatMessagesRef}
              className="h-64 bg-gray-700 rounded-lg p-3 mb-3 overflow-y-auto"
            >
              {messages.length === 0 ? (
                <div className="text-gray-400 text-sm text-center mt-24">
                  {isConnected
                    ? "No messages yet. Start chatting!"
                    : "Connect with a partner to start chatting"}
                </div>
              ) : (
                <div className="space-y-2">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${
                        message.sender === "me"
                          ? "justify-end"
                          : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-xs px-3 py-2 rounded-lg text-sm ${
                          message.sender === "me"
                            ? "bg-blue-600 text-white"
                            : "bg-gray-600 text-white"
                        }`}
                      >
                        <div className="break-words">{message.text}</div>
                        <div className="text-xs opacity-70 mt-1">
                          {new Date(message.timestamp).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={currentMessage}
                onChange={(e) => setCurrentMessage(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder={
                  isConnected ? "Type your message..." : "Connect to chat"
                }
                disabled={!isConnected}
                className="flex-1 px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <button
                onClick={sendMessage}
                disabled={!isConnected || !currentMessage.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-colors"
              >
                Send
              </button>
            </div>
            <div className="mt-2 text-xs text-gray-400">
              {partnerId
                ? `Connected to: ${partnerId}`
                : "No partner connected"}
            </div>
          </div>
        </div>

        <div className="flex justify-center gap-4">
          {!isLookingForPartner && !isConnected && (
            <button
              onClick={startSearch}
              disabled={!canStart}
              className={`px-8 py-3 rounded-lg font-semibold text-lg ${
                canStart
                  ? "bg-green-600 hover:bg-green-700 text-white"
                  : "bg-gray-600 text-gray-400 cursor-not-allowed"
              }`}
            >
              START
            </button>
          )}

          {isSearching && (
            <div className="flex items-center gap-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              <span className="text-lg">
                {disconnectionMessage
                  ? "Looking for new stranger..."
                  : interests.length > 0
                  ? `Searching for partner with similar interests...`
                  : "Searching for random partner..."}
              </span>
              <button
                onClick={stopSession}
                className="px-6 py-2 bg-red-600 hover:bg-red-700 rounded-lg font-semibold"
              >
                STOP
              </button>
            </div>
          )}

          {isConnected && (
            <div className="flex items-center gap-4">
              <span className="text-lg text-green-400">✅ Connected!</span>
              <button
                onClick={findNextPartner}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold"
              >
                NEXT
              </button>
              <button
                onClick={stopSession}
                className="px-6 py-2 bg-red-600 hover:bg-red-700 rounded-lg font-semibold"
              >
                STOP
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
