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
  media: "not_ready" | "checking" | "ready";
  queue: "not_in_queue" | "searching" | "matched";
}

interface MediaDeviceStatus {
  camera: boolean;
  microphone: boolean;
  permissions: {
    camera: "granted" | "denied" | "prompt";
    microphone: "granted" | "denied" | "prompt";
  };
}

// Add message interface
interface Message {
  id: string;
  text: string;
  sender: "me" | "partner";
  timestamp: number;
}

interface SimplePeerVideoChatProps {
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

export default function SimplePeerVideoChat({
  session,
}: SimplePeerVideoChatProps) {
  const searchParams = useSearchParams();
  const socketRef = useRef<Socket | null>(null);
  const peerRef = useRef<SimplePeer.Instance | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const chatMessagesRef = useRef<HTMLDivElement>(null);

  // Interest synchronization state
  const [interests, setInterests] = useState<string[]>([]);
  // Anonymous user state
  const [anonymousUser, setAnonymousUser] = useState<any>(null);

  const [connectionState, setConnectionState] = useState<ConnectionState>({
    socket: "disconnected",
    peer: "not_initialized",
    media: "not_ready",
    queue: "not_in_queue",
  });

  const [mediaDeviceStatus, setMediaDeviceStatus] = useState<MediaDeviceStatus>(
    {
      camera: false,
      microphone: false,
      permissions: { camera: "prompt", microphone: "prompt" },
    }
  );

  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLookingForPartner, setIsLookingForPartner] = useState(false);
  const [disconnectionMessage, setDisconnectionMessage] = useState<
    string | null
  >(null);
  const [showDisconnectionAlert, setShowDisconnectionAlert] = useState(false);

  // Add message state
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

  // Interest synchronization effect
  useEffect(() => {
    // Get interests from URL parameters
    const interestsParam = searchParams.get("interests");
    if (interestsParam) {
      const urlInterests = interestsParam
        .split(",")
        .map((i) => i.trim())
        .filter(Boolean);
      setInterests(urlInterests);
      // Save to localStorage for persistence
      localStorage.setItem("userInterests", JSON.stringify(urlInterests));
    } else {
      // Load from localStorage if no URL params
      const savedInterests = localStorage.getItem("userInterests");
      if (savedInterests) {
        try {
          const parsed = JSON.parse(savedInterests);
          if (Array.isArray(parsed)) {
            setInterests(parsed);
          }
        } catch (error) {
          console.error("Error parsing saved interests:", error);
        }
      }
    }
  }, [searchParams]);

  // Phase 6: Partner Disconnection Handler
  const handlePartnerDisconnection = useCallback(
    (reason: string, skipAutoSearch: boolean = false) => {
      console.log("🔌 Phase 6: Handling partner disconnection -", reason);

      // 🚨 ENHANCED: Show both browser alert and visual modal for immediate user notification
      // if (typeof window !== "undefined") {
      //   alert(
      //     `⚠️ Partner Disconnected!\n\n${reason}\n\n${
      //       skipAutoSearch
      //         ? "Click START to find a new stranger."
      //         : "Looking for a new stranger..."
      //     }`
      //   );
      // }

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

      // Clear partner video immediately
      if (remoteVideoRef.current) {
        console.log("✅ Clearing partner video immediately");
        remoteVideoRef.current.srcObject = null;
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
    [clearMessages]
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
        "🔗 Initializing SimplePeer connection, initiator:",
        isInitiator,
        "partnerId:",
        partnerIdParam
      );

      if (!localStreamRef.current) {
        console.error("❌ No local stream available for peer connection");
        return;
      }

      if (peerRef.current) {
        peerRef.current.destroy();
      }

      peerRef.current = new SimplePeer({
        initiator: isInitiator,
        trickle: true,
        stream: localStreamRef.current,
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
        console.log("🎉 SimplePeer connection established!");
        setConnectionState((prev) => ({ ...prev, peer: "connected" }));
      });

      peerRef.current.on("stream", (remoteStream) => {
        console.log("🎥 Received remote stream");
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream;
        }
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
    [addMessage]
  );

  const initializeMedia = useCallback(async () => {
    console.log("🎥 Initializing media devices...");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      localStreamRef.current = stream;

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      setMediaDeviceStatus({
        camera: stream.getVideoTracks().length > 0,
        microphone: stream.getAudioTracks().length > 0,
        permissions: { camera: "granted", microphone: "granted" },
      });

      setConnectionState((prev) => ({ ...prev, media: "ready" }));
      console.log("✅ Media devices initialized successfully");
    } catch (error) {
      console.error("❌ Media initialization failed:", error);
      setConnectionState((prev) => ({ ...prev, media: "not_ready" }));
    }
  }, []);

  const startSearch = useCallback(() => {
    console.log("🔍 Starting partner search...");

    if (!socketRef.current?.connected) {
      console.error("❌ Socket not connected");
      return;
    }

    setIsLookingForPartner(true);
    setConnectionState((prev) => ({ ...prev, queue: "searching" }));

    socketRef.current.emit("find-partner", interests, (response: any) => {
      console.log("📨 Find-partner response:", response);
    });
  }, []);

  // Phase 5A: NEXT Button Click (Find New Partner)
  const findNextPartner = useCallback(() => {
    console.log("🔄 Phase 5A: Finding next partner...");

    // Current Connection Cleanup
    if (peerRef.current) {
      console.log("✅ Closing SimplePeer connection via destroy()");
      peerRef.current.destroy();
      peerRef.current = null;
    }

    // Clear remote video element
    if (remoteVideoRef.current) {
      console.log("✅ Clearing remote video element");
      remoteVideoRef.current.srcObject = null;
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
  }, [partnerId, clearMessages]);

  // Phase 5B: STOP Button Click (Complete Termination)
  const stopSession = useCallback(() => {
    console.log("🛑 Phase 5B: Complete session termination...");

    // Complete Cleanup
    if (peerRef.current) {
      console.log("✅ Closing SimplePeer connection");
      peerRef.current.destroy();
      peerRef.current = null;
    }

    // Stop all media streams (keep local stream for potential restart)
    if (remoteVideoRef.current) {
      console.log("✅ Clearing remote video element");
      remoteVideoRef.current.srcObject = null;
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

  useEffect(() => {
    initializeSocket();
    initializeMedia();

    return () => {
      if (peerRef.current) {
        peerRef.current.destroy();
      }
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [initializeSocket, initializeMedia]);

  const canStart =
    connectionState.socket === "connected" &&
    connectionState.media === "ready" &&
    !isLookingForPartner;

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
        {/* Left Video Area - 30% on desktop, full width on mobile */}
        <div className="w-full md:w-3/10 h-[50vh] md:h-[calc(100vh-3rem)] flex flex-col p-1 space-y-1 relative">
          {/* Remote Video (Stranger) */}
          <div className="flex-1 relative bg-gradient-to-br from-gray-900 to-gray-800 border-2 border-gray-300 rounded-lg overflow-hidden shadow-lg">
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
              style={{ transform: "scaleX(-1)" }}
            />
            {!isConnected && (
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
                <div className="text-center text-white">
                  <div className="text-4xl mb-2">👤</div>
                  <p className="text-sm text-gray-200">
                    {isConnected
                      ? "Connecting..."
                      : isSearching
                      ? "Looking for stranger..."
                      : "No stranger connected"}
                  </p>
                </div>
              </div>
            )}
            <div className="absolute top-2 left-2 bg-gradient-to-r from-black to-gray-800 bg-opacity-70 text-white px-3 py-1 rounded-full text-xs font-medium">
              Stranger
            </div>

            {/* Modern Loading Overlay - Only over remote video */}
            {isSearching && (
              <div className="absolute inset-0 bg-gray-900 bg-opacity-20 backdrop-blur-sm flex items-center justify-center z-30 rounded-lg">
                <div className=" bg-opacity-95 backdrop-blur-md p-4 rounded-2xl text-center  border border-white border-opacity-30">
                  <div className="animate-spin rounded-full h-6 w-6 border-3 border-blue-500 border-t-transparent mx-auto mb-3"></div>
                  <p className="text-sm font-semibold text-gray-200 mb-1">
                    Looking for someone...
                  </p>
                  <p className="text-xs text-gray-200">Random chat</p>
                </div>
              </div>
            )}
          </div>

          {/* Local Video (You) */}
          <div className="flex-1 relative bg-gradient-to-br from-gray-900 to-gray-800 border-2 border-gray-300 rounded-lg overflow-hidden shadow-lg">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
              style={{ transform: "scaleX(-1)" }}
            />
            {connectionState.media !== "ready" && (
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
                <div className="text-center text-white">
                  <div className="text-4xl mb-2">📹</div>
                  <p className="text-sm text-gray-300">Camera not active</p>
                </div>
              </div>
            )}
            <div className="absolute top-2 left-2 bg-gradient-to-r from-blue-600 to-blue-500 bg-opacity-90 text-white px-3 py-1 rounded-full text-xs font-medium">
              You
            </div>
          </div>
        </div>

        {/* Right Chat Area - 70% on desktop, full width on mobile */}
        <div className="w-full md:w-[70%] h-auto md:h-[calc(100vh-3rem)] max-h-[50vh] md:max-h-[calc(100vh-3rem)] flex flex-col bg-gradient-to-br from-gray-50 to-white md:border-l border-gray-300 shadow-inner overflow-y-auto md:overflow-y-visible fixed md:static bottom-0 md:bottom-auto">
          {" "}
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
