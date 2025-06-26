"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import SimplePeer from "simple-peer";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

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

// Anonymous user tracking utility
const createAnonymousUser = async () => {
  try {
    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ isAnonymous: true }),
    });

    if (response.ok) {
      const data = await response.json();
      localStorage.setItem("anonymousUser", JSON.stringify(data.user));
      return data.user;
    }
  } catch (error) {
    console.error("Failed to create anonymous user:", error);
  }
  return null;
};

const getOrCreateAnonymousUser = async () => {
  // Check if we already have an anonymous user in localStorage
  const existingUser = localStorage.getItem("anonymousUser");
  if (existingUser) {
    try {
      return JSON.parse(existingUser);
    } catch (error) {
      console.error("Error parsing existing anonymous user:", error);
    }
  }

  // Create new anonymous user
  return await createAnonymousUser();
};

export default function SimplePeerTextChat({
  session,
}: SimplePeerTextChatProps) {
  const socketRef = useRef<Socket | null>(null);
  const peerRef = useRef<SimplePeer.Instance | null>(null);
  const chatMessagesRef = useRef<HTMLDivElement>(null);
  const searchParams = useSearchParams();

  // Anonymous user state
  const [anonymousUser, setAnonymousUser] = useState<any>(null);

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

  // Initialize anonymous user tracking
  useEffect(() => {
    const initializeUser = async () => {
      const user = await getOrCreateAnonymousUser();
      if (user) {
        setAnonymousUser(user);
        console.log("📝 Anonymous user initialized:", user.anonymousId);
      }
    };

    initializeUser();
  }, []);

  // Load interests from URL parameters or localStorage
  useEffect(() => {
    const urlInterests = searchParams.get("interests");
    const savedInterests = localStorage.getItem("omegle-interests");

    if (urlInterests) {
      // Parse comma-separated interests from URL
      const interestList = urlInterests
        .split(",")
        .map((i) => i.trim())
        .filter((i) => i.length > 0);
      setInterests(interestList);
      // Save to localStorage for persistence
      localStorage.setItem("omegle-interests", urlInterests);
    } else if (savedInterests) {
      // Load from localStorage if no URL params
      const interestList = savedInterests
        .split(",")
        .map((i) => i.trim())
        .filter((i) => i.length > 0);
      setInterests(interestList);
    }
  }, [searchParams]);

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
      const newInterests = [...interests, currentInterest.trim()];
      setInterests(newInterests);
      setCurrentInterest("");
      // Sync with localStorage
      localStorage.setItem("omegle-interests", newInterests.join(","));
    }
  }, [currentInterest, interests]);

  const removeInterest = useCallback(
    (interestToRemove: string) => {
      const newInterests = interests.filter(
        (interest) => interest !== interestToRemove
      );
      setInterests(newInterests);
      // Sync with localStorage
      if (newInterests.length > 0) {
        localStorage.setItem("omegle-interests", newInterests.join(","));
      } else {
        localStorage.removeItem("omegle-interests");
      }
    },
    [interests]
  );

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
    <div className="flex flex-col h-screen bg-white w-full">
      {/* Header - Fixed at top */}
      <div className="fixed top-0 left-0 right-0 w-full bg-gradient-to-r from-blue-600 via-blue-500 to-purple-600 text-white px-4 py-2 z-50 h-12 flex items-center justify-between shadow-lg">
        <div className="flex items-center space-x-4">
          <Link
            href="/"
            className="text-xl font-bold bg-gradient-to-r from-white to-blue-100 bg-clip-text text-transparent"
          >
            Omegle
          </Link>
          <div className="text-sm opacity-90">Talk to strangers!</div>
        </div>
        <div className="text-sm opacity-90">
          <span className="font-semibold text-green-300">38,000+</span> online
          now
        </div>
      </div>

      {/* Main Content Container - Below header */}
      <div className="flex flex-col md:flex-row h-screen mt-12 w-full">
        {/* Left Interests Area - 30% on desktop, full width on mobile */}
        <div className="w-full md:w-3/10 h-[50vh] md:h-[calc(100vh-3rem)] flex flex-col p-4 space-y-4 bg-gradient-to-br from-gray-50 to-white border-r border-gray-200 relative">
          {/* Interests Section */}
          <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl p-4 shadow-lg border border-gray-200 flex-1">
            <h3 className="text-lg font-semibold mb-3 text-gray-800 flex items-center gap-2">
              <span className="text-2xl">🎯</span>
              Interests (Optional)
            </h3>
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
                  className="flex-1 p-3 border-2 border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-400 text-sm text-black shadow-inner transition-all duration-200"
                />
                <button
                  onClick={addInterest}
                  disabled={
                    !currentInterest.trim() ||
                    isLookingForPartner ||
                    isConnected
                  }
                  className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 disabled:from-gray-300 disabled:to-gray-400 text-white px-6 py-2 rounded-full font-bold text-sm transition-all duration-200 transform hover:scale-105 shadow-lg shadow-blue-200 disabled:shadow-gray-100 disabled:hover:scale-100"
                >
                  Add
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2  p-3 bg-gray-50 rounded-xl">
              {interests.length === 0 ? (
                <div className="text-gray-500 text-sm text-center w-full mt-8">
                  <div className="text-3xl mb-2">💭</div>
                  <p>No interests added.</p>
                  <p className="text-xs">Leave empty for random matching.</p>
                </div>
              ) : (
                interests.map((interest) => (
                  <span
                    key={interest}
                    className="px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-full text-sm flex items-center gap-2 shadow-md"
                  >
                    {interest}
                    {!isLookingForPartner && !isConnected && (
                      <button
                        onClick={() => removeInterest(interest)}
                        className="hover:bg-blue-700 hover:bg-opacity-50 rounded-full w-5 h-5 flex items-center justify-center text-xs transition-colors"
                      >
                        ×
                      </button>
                    )}
                  </span>
                ))
              )}
            </div>
            <div className="mt-3 text-xs text-gray-600 bg-blue-50 p-3 rounded-xl">
              {interests.length > 0
                ? "🎯 Will match with people who share similar interests"
                : "🎲 Leave empty to match with random strangers"}
            </div>
          </div>

          {/* Loading Overlay for Interests Area */}
          {isSearching && (
            <div className="absolute inset-0 bg-gray-900 bg-opacity-80 backdrop-blur-sm flex items-center justify-center z-30 rounded-2xl">
              <div className="bg-opacity-95 backdrop-blur-md p-6 rounded-2xl text-center  border border-gray-200">
                <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
                <p className="text-lg font-semibold text-gray-200 mb-2">
                  Looking for someone...
                </p>
                <p className="text-sm text-gray-600">
                  {interests.length > 0
                    ? `Matching interests: ${interests.join(", ")}`
                    : "Random chat"}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Right Chat Area - 70% on desktop, full width on mobile */}
        <div className="w-full md:w-7/10 h-[50vh] md:h-[calc(100vh-3rem)] flex flex-col bg-gradient-to-br from-gray-50 to-white">
          {/* Chat Messages Area - Flexible height */}
          <div
            className="flex-1 overflow-y-auto p-4 space-y-3"
            ref={chatMessagesRef}
          >
            {messages.length === 0 ? (
              <div className="text-center text-gray-500 mt-8">
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-6 rounded-2xl border border-gray-200 shadow-sm">
                  <div className="text-3xl mb-3">💬</div>
                  <p className="text-sm text-gray-600 font-medium">
                    {isConnected
                      ? "You're connected to a stranger. Say hello!"
                      : isSearching
                      ? "Looking for someone to chat with..."
                      : "Click START to begin chatting"}
                  </p>
                </div>
              </div>
            ) : (
              messages.map((message) => (
                <div key={message.id} className="text-sm flex">
                  <div
                    className={`max-w-[80%] p-3 rounded-2xl shadow-sm ${
                      message.sender === "me"
                        ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white ml-auto"
                        : "bg-white border border-gray-200 text-gray-800"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`font-semibold text-xs ${
                          message.sender === "me"
                            ? "text-blue-100"
                            : "text-red-500"
                        }`}
                      >
                        {message.sender === "me" ? "You" : "Stranger"}
                      </span>
                      <span
                        className={`text-xs opacity-70 ${
                          message.sender === "me"
                            ? "text-blue-100"
                            : "text-gray-500"
                        }`}
                      >
                        {new Date(message.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <span className="break-words">{message.text}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Control Area - Fixed height */}
          <div className="min-h-[120px] md:min-h-[80px] bg-gradient-to-r from-white to-gray-50 border-t border-gray-200 p-3 flex flex-col shadow-lg">
            {/* Mobile: Stack buttons and input vertically */}
            <div className="flex flex-col space-y-3 md:hidden">
              {/* Action Buttons Row */}
              <div className="flex justify-center space-x-2">
                {!isLookingForPartner && !isConnected && (
                  <button
                    onClick={startSearch}
                    disabled={!canStart}
                    className={`px-8 py-2 rounded-full font-bold text-sm transition-all duration-200 transform hover:scale-105 shadow-lg ${
                      canStart
                        ? "bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white shadow-green-200"
                        : "bg-gray-300 text-gray-500 cursor-not-allowed shadow-gray-100"
                    }`}
                  >
                    START
                  </button>
                )}

                {isSearching && (
                  <button
                    onClick={stopSession}
                    className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white px-8 py-2 rounded-full font-bold text-sm transition-all duration-200 transform hover:scale-105 shadow-lg shadow-red-200"
                  >
                    STOP
                  </button>
                )}

                {isConnected && (
                  <>
                    <button
                      onClick={findNextPartner}
                      className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-6 py-2 rounded-full font-bold text-sm transition-all duration-200 transform hover:scale-105 shadow-lg shadow-blue-200"
                    >
                      NEXT
                    </button>
                    <button
                      onClick={stopSession}
                      className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white px-6 py-2 rounded-full font-bold text-sm transition-all duration-200 transform hover:scale-105 shadow-lg shadow-red-200"
                    >
                      STOP
                    </button>
                  </>
                )}
              </div>

              {/* Message Input Row */}
              <div className="flex space-x-2 w-full">
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
                  placeholder="Type a message..."
                  disabled={!isConnected}
                  className="flex-1 p-3 border-2 border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-400 text-sm text-black shadow-inner transition-all duration-200"
                />
                <button
                  onClick={sendMessage}
                  disabled={!currentMessage.trim() || !isConnected}
                  className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 disabled:from-gray-300 disabled:to-gray-400 text-white px-6 py-3 rounded-full font-bold text-sm transition-all duration-200 transform hover:scale-105 shadow-lg shadow-blue-200 disabled:shadow-gray-100 disabled:hover:scale-100"
                >
                  Send
                </button>
              </div>
            </div>

            {/* Desktop: Original horizontal layout */}
            <div className="hidden md:flex md:flex-row items-center space-x-2">
              {/* Action Buttons */}
              <div className="flex space-x-2">
                {!isLookingForPartner && !isConnected && (
                  <button
                    onClick={startSearch}
                    disabled={!canStart}
                    className={`px-6 py-2 rounded-full font-bold text-sm transition-all duration-200 transform hover:scale-105 shadow-lg ${
                      canStart
                        ? "bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white shadow-green-200"
                        : "bg-gray-300 text-gray-500 cursor-not-allowed shadow-gray-100"
                    }`}
                  >
                    START
                  </button>
                )}

                {isSearching && (
                  <button
                    onClick={stopSession}
                    className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white px-6 py-2 rounded-full font-bold text-sm transition-all duration-200 transform hover:scale-105 shadow-lg shadow-red-200"
                  >
                    STOP
                  </button>
                )}

                {isConnected && (
                  <>
                    <button
                      onClick={findNextPartner}
                      className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-6 py-2 rounded-full font-bold text-sm transition-all duration-200 transform hover:scale-105 shadow-lg shadow-blue-200"
                    >
                      NEXT
                    </button>
                    <button
                      onClick={stopSession}
                      className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white px-6 py-2 rounded-full font-bold text-sm transition-all duration-200 transform hover:scale-105 shadow-lg shadow-red-200"
                    >
                      STOP
                    </button>
                  </>
                )}
              </div>

              {/* Message Input and Send */}
              <div className="flex flex-1 space-x-2">
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
                  placeholder="Type a message..."
                  disabled={!isConnected}
                  className="flex-1 p-3 border-2 border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-400 text-sm text-black shadow-inner transition-all duration-200"
                />
                <button
                  onClick={sendMessage}
                  disabled={!currentMessage.trim() || !isConnected}
                  className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 disabled:from-gray-300 disabled:to-gray-400 text-white px-6 py-2 rounded-full font-bold text-sm transition-all duration-200 transform hover:scale-105 shadow-lg shadow-blue-200 disabled:shadow-gray-100 disabled:hover:scale-100"
                >
                  Send
                </button>
              </div>
            </div>

            {/* Status Info */}
            {/* <div className="mt-2 text-xs text-gray-500 flex justify-between bg-gray-50 px-3 py-2 rounded-full">
              <span className="flex items-center gap-1">
                <div
                  className={`w-2 h-2 rounded-full ${
                    isConnected
                      ? "bg-green-400 animate-pulse"
                      : isSearching
                      ? "bg-yellow-400 animate-pulse"
                      : "bg-gray-400"
                  }`}
                ></div>
                Status:{" "}
                <span
                  className={`font-medium ${
                    isConnected
                      ? "text-green-600"
                      : isSearching
                      ? "text-yellow-600"
                      : "text-gray-500"
                  }`}
                >
                  {isConnected
                    ? "Connected"
                    : isSearching
                    ? "Looking..."
                    : "Disconnected"}
                </span>
              </span>
              <span className="flex items-center gap-1">
                <div
                  className={`w-2 h-2 rounded-full ${
                    connectionState.socket === "connected"
                      ? "bg-green-400"
                      : "bg-red-400"
                  }`}
                ></div>
                Socket:{" "}
                <span className="font-medium">
                  {connectionState.socket === "connected" ? "✓" : "✗"}
                </span>
              </span>
            </div> */}
          </div>
        </div>
      </div>

      {/* 🚨 ENHANCED: Modal-style Disconnection Alert */}
      {/* {showDisconnectionAlert && (
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
      )} */}

      {/* Phase 6: Disconnection Message Display */}
      {/* {disconnectionMessage && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-orange-600 text-white px-6 py-3 rounded-lg z-40">
          <div className="flex items-center justify-center gap-2">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            <span className="text-sm font-semibold">
              {disconnectionMessage}
            </span>
          </div>
        </div>
      )} */}
    </div>
  );
}
