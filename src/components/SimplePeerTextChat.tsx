"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import SimplePeer from "simple-peer";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { MatchCriteriaControls } from "./MatchCriteriaControls";
import { PreferenceModals } from "./PreferenceModals";

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
  const searchParams = useSearchParams();
  const socketRef = useRef<Socket | null>(null);
  const peerRef = useRef<SimplePeer.Instance | null>(null);
  const chatMessagesRef = useRef<HTMLDivElement>(null);

  // Interest synchronization state
  const [interests, setInterests] = useState<string[]>([]);
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

  // Message state
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentMessage, setCurrentMessage] = useState("");

  // Match reason state
  const [matchReason, setMatchReason] = useState<string | null>(null);

  // Match criteria state for the controls
  const [matchCriteria, setMatchCriteria] = useState({
    gender: null as string | null,
    country: null as string | null,
    interests: [] as string[],
  });

  // Add modal state management at parent level
  const [showGenderModal, setShowGenderModal] = useState(false);
  const [showCountryModal, setShowCountryModal] = useState(false);
  const [showGameModal, setShowGameModal] = useState(false);

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

  // Load match criteria from localStorage
  useEffect(() => {
    const loadCriteria = () => {
      const savedGender = localStorage.getItem("snappairGenderFilter");
      const savedCountry = localStorage.getItem("snappairCountryFilter");
      const savedInterests = localStorage.getItem("snappairInterestFilter");

      setMatchCriteria({
        gender: savedGender && savedGender !== "all" ? savedGender : null,
        country: savedCountry || null,
        interests: savedInterests ? JSON.parse(savedInterests) : [],
      });
    };

    loadCriteria();
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

  // Modal handlers
  const handleOpenModal = (modalType: "gender" | "country" | "game") => {
    // Stop search when opening modal
    handleStopSearch();

    switch (modalType) {
      case "gender":
        setShowGenderModal(true);
        break;
      case "country":
        setShowCountryModal(true);
        break;
      case "game":
        setShowGameModal(true);
        break;
    }
  };

  const handleCloseModal = (modalType: "gender" | "country" | "game") => {
    switch (modalType) {
      case "gender":
        setShowGenderModal(false);
        break;
      case "country":
        setShowCountryModal(false);
        break;
      case "game":
        setShowGameModal(false);
        break;
    }
  };

  const handleModalOutsideClick = (e: React.MouseEvent, modalType: string) => {
    if (e.target === e.currentTarget) {
      switch (modalType) {
        case "gender":
          setShowGenderModal(false);
          break;
        case "country":
          setShowCountryModal(false);
          break;
        case "game":
          setShowGameModal(false);
          break;
      }
    }
  };

  // Preference change handlers
  const handleGenderChange = useCallback(
    (gender: string) => {
      const updatedCriteria = {
        ...matchCriteria,
        gender: gender === "all" ? null : gender,
      };
      setMatchCriteria(updatedCriteria);
    },
    [matchCriteria]
  );

  const handleCountryChange = useCallback(
    (country: string | null) => {
      const updatedCriteria = {
        ...matchCriteria,
        country,
      };
      setMatchCriteria(updatedCriteria);
    },
    [matchCriteria]
  );

  const handleGameChange = useCallback(
    (gameId: string, isSelected: boolean) => {
      let newInterests: string[];
      if (isSelected) {
        newInterests = [...matchCriteria.interests, gameId];
      } else {
        newInterests = matchCriteria.interests.filter((g) => g !== gameId);
      }

      const updatedCriteria = {
        ...matchCriteria,
        interests: newInterests,
      };
      setMatchCriteria(updatedCriteria);
    },
    [matchCriteria]
  );

  const handleClearAllGames = useCallback(() => {
    const updatedCriteria = {
      ...matchCriteria,
      interests: [],
    };
    setMatchCriteria(updatedCriteria);
  }, [matchCriteria]);

  const handleStopSearch = useCallback(() => {
    if (socketRef.current && isLookingForPartner) {
      socketRef.current.emit("stopChat");
      setIsLookingForPartner(false);
      setConnectionState((prev) => ({ ...prev, queue: "not_in_queue" }));
      console.log("🛑 Search stopped by user");
    }
  }, [isLookingForPartner]);

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

      // Clear match reason
      setMatchReason(null);

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
            // Build complete profile for matching engine using current criteria
            const profile = {
              userGender: localStorage.getItem("snappairUserGender") || null,
              userLocation:
                localStorage.getItem("snappairUserLocation") || null,
              matchGender: matchCriteria.gender || "all",
              matchLocation: matchCriteria.country || null,
              matchGames: matchCriteria.interests || [],
            };

            console.log("🔍 Auto-search with profile:", profile);

            socketRef.current.emit("find-partner", profile, (response: any) => {
              console.log("📨 Auto-search find-partner response:", response);
            });
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
    [clearMessages, matchCriteria]
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
      setIsLookingForPartner(false); // Stop looking for partner
      setConnectionState((prev) => ({ ...prev, queue: "matched" }));

      // Capture match reason for display
      if (data.matchReason) {
        setMatchReason(data.matchReason);
        console.log("💫 Match reason:", data.matchReason);
      }

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

    // Build complete profile for matching engine using current criteria
    const profile = {
      userGender: localStorage.getItem("snappairUserGender") || null,
      userLocation: localStorage.getItem("snappairUserLocation") || null,
      matchGender: matchCriteria.gender || "all",
      matchLocation: matchCriteria.country || null,
      matchGames: matchCriteria.interests || [],
    };

    console.log("🔍 Sending profile to server:", profile);

    socketRef.current.emit("find-partner", profile, (response: any) => {
      console.log("📨 Find-partner response:", response);
    });
  }, [matchCriteria]);

  const handleDone = useCallback(() => {
    // Close all modals
    setShowGenderModal(false);
    setShowCountryModal(false);
    setShowGameModal(false);

    // Restart search with updated criteria
    setTimeout(() => {
      startSearch();
    }, 500);
  }, [startSearch]);

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

    // Clear match reason
    setMatchReason(null);

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
      // Build complete profile for matching engine using current criteria
      const profile = {
        userGender: localStorage.getItem("snappairUserGender") || null,
        userLocation: localStorage.getItem("snappairUserLocation") || null,
        matchGender: matchCriteria.gender || "all",
        matchLocation: matchCriteria.country || null,
        matchGames: matchCriteria.interests || [],
      };

      console.log("🔍 Re-matching with profile:", profile);

      socketRef.current.emit("find-partner", profile, (response: any) => {
        console.log("📨 Re-queue find-partner response:", response);
      });
    }

    // Button State Management happens automatically via state changes
    console.log(
      "✅ Button state updated: NEXT hidden, STOP enabled, searching indicator shown"
    );
  }, [partnerId, clearMessages, matchCriteria]);

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

    // Clear match reason
    setMatchReason(null);

    console.log("✅ Session completely terminated - UI reset to initial state");
    console.log("✅ START button will show, NEXT and STOP buttons hidden");
  }, [partnerId, clearMessages]);

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
    <div className="h-screen pt-16 pb-10 flex flex-col">
      <div className="container mx-auto px-4 flex-grow flex flex-col">
        <div className="flex flex-col lg:flex-row gap-4 h-[75vh]">
          {/* Left Side - Chat Interface */}
          <div className="relative rounded-3xl overflow-hidden flex-1 bg-snappair-primary">
            <div className="absolute left-5 top-5 z-10 bg-black/40 rounded-full px-3 py-1 flex items-center">
              <div className="w-3 h-3 rounded-full mr-2 bg-snappair-green"></div>
              <span className="text-snappair-green text-sm font-medium">
                YOUR CHAT
              </span>
            </div>

            {/* Chat Messages Area */}
            <div className="absolute inset-0 flex flex-col p-6 pt-20">
              <div
                ref={chatMessagesRef}
                className="flex-1 overflow-y-auto mb-4 bg-black/20 rounded-lg p-4 backdrop-blur-sm"
              >
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-white/70">
                    <div className="text-6xl mb-4">💬</div>
                    <p className="text-xl mb-2">
                      {isConnected
                        ? "Start your conversation!"
                        : "Connect with someone to start chatting"}
                    </p>
                    <p className="text-sm text-white/50">
                      Your messages will appear here
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
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
                          className={`max-w-xs lg:max-w-md px-4 py-3 rounded-2xl text-sm ${
                            message.sender === "me"
                              ? "bg-blue-600 text-white"
                              : "bg-white/10 text-white backdrop-blur-sm"
                          }`}
                        >
                          <div className="break-words">{message.text}</div>
                          <div className="text-xs opacity-70 mt-1">
                            {new Date(message.timestamp).toLocaleTimeString(
                              [],
                              {
                                hour: "2-digit",
                                minute: "2-digit",
                              }
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Message Input */}
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
                    isConnected
                      ? "Type your message..."
                      : "Connect to start chatting"
                  }
                  disabled={!isConnected}
                  className="flex-1 px-4 py-3 rounded-full bg-white/10 backdrop-blur-sm text-white placeholder:text-white/50 border border-white/20 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <button
                  onClick={sendMessage}
                  disabled={!isConnected || !currentMessage.trim()}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed p-3 rounded-full text-white transition-colors"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Right Side - Connection Status */}
          <div className="relative rounded-3xl overflow-hidden flex-1 bg-snappair-primary">
            <div className="absolute right-5 top-5 z-10 bg-black/40 rounded-full px-3 py-1 flex items-center">
              <div className="w-3 h-3 rounded-full bg-snappair-green mr-2"></div>
              <span className="text-snappair-green text-sm font-medium">
                {partnerId ? "STRANGER" : "CONNECTING..."}
              </span>
            </div>

            {/* Connection Area */}
            {isLookingForPartner ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-zinc-900">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white mb-4"></div>
                <p className="text-xl mb-6">Finding your chat partner...</p>

                {/* Match Criteria Controls - Show criteria and allow editing during search */}
                <div className="mb-6 z-20">
                  <MatchCriteriaControls
                    isVisible={true}
                    currentCriteria={matchCriteria}
                    onOpenModal={handleOpenModal}
                    onStopSearch={handleStopSearch}
                  />
                </div>

                {/* People animation background */}
                <div className="absolute inset-0 overflow-hidden -z-10">
                  <div
                    className="absolute inset-0"
                    style={{
                      backgroundImage: "url('/people.webp')",
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                      opacity: 0.15,
                      animation: "pan 25s infinite alternate ease-in-out",
                    }}
                  />
                </div>

                <style jsx>{`
                  @keyframes pan {
                    from {
                      transform: scale(1.2) translateX(-5%) translateY(-2%);
                    }
                    to {
                      transform: scale(1.2) translateX(5%) translateY(2%);
                    }
                  }
                `}</style>
              </div>
            ) : isConnected ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-gradient-to-br from-blue-900/50 to-purple-900/50">
                <div className="text-8xl mb-6 animate-pulse">💬</div>
                <h2 className="text-3xl font-bold mb-4">Connected!</h2>
                <p className="text-lg mb-6 text-center max-w-md">
                  You're now chatting with a stranger. Be respectful and enjoy
                  your conversation!
                </p>

                {/* Partner Info */}
                <div className="bg-black/20 rounded-lg p-4 backdrop-blur-sm">
                  <div className="flex items-center text-white/80 text-sm">
                    <div className="w-2 h-2 rounded-full bg-green-400 mr-2 animate-pulse"></div>
                    <span>Partner ID: {partnerId?.substring(0, 8)}...</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-gradient-to-br from-gray-800 to-gray-900">
                <div className="text-8xl mb-6 opacity-50">💭</div>
                <h2 className="text-2xl font-bold mb-4">Ready to Chat</h2>
                <p className="text-lg text-center max-w-md text-white/70">
                  Click START to find someone to chat with!
                </p>
              </div>
            )}

            {/* Match Reason Display - Bottom of connection area */}
            {matchReason && isConnected && (
              <div className="absolute bottom-3 left-3 right-3 bg-black/60 backdrop-blur-sm rounded-lg px-3 py-2 z-10">
                <div className="flex items-center text-white text-sm">
                  <div className="w-2 h-2 rounded-full bg-snappair-green mr-2 animate-pulse"></div>
                  <span className="font-medium text-snappair-green">
                    Match:
                  </span>
                  <span className="ml-2 text-white">{matchReason}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Control Buttons */}
        <div className="flex items-center justify-center gap-3 my-4">
          {!isLookingForPartner && !isConnected && (
            <button
              onClick={startSearch}
              disabled={!canStart}
              className={`rounded-full px-6 py-3 flex items-center justify-center font-semibold text-lg ${
                canStart
                  ? "bg-green-600 hover:bg-green-700 text-white"
                  : "bg-gray-600 text-gray-400 cursor-not-allowed"
              }`}
            >
              START
            </button>
          )}

          {isLookingForPartner && (
            <div className="flex items-center gap-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              <span className="text-lg text-white">
                {disconnectionMessage
                  ? "Looking for new stranger..."
                  : "Searching for chat partner..."}
              </span>
              <button
                onClick={stopSession}
                className="px-6 py-2 bg-red-600 hover:bg-red-700 rounded-lg font-semibold text-white"
              >
                STOP
              </button>
            </div>
          )}

          {isConnected && (
            <>
              <button
                onClick={stopSession}
                className="rounded-full w-12 h-12 bg-red-600 hover:bg-red-700 flex items-center justify-center text-white"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>

              <button
                onClick={findNextPartner}
                className="rounded-full px-6 py-3 bg-blue-600 hover:bg-blue-700 flex items-center justify-center text-white font-semibold"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 mr-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 5l7 7-7 7M5 5l7 7-7 7"
                  />
                </svg>
                Next
              </button>

              {/* Clear Chat Button */}
              <button
                onClick={clearMessages}
                className="rounded-full w-12 h-12 bg-purple-600 hover:bg-purple-700 flex items-center justify-center text-white"
                title="Clear Chat"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            </>
          )}
        </div>

        {/* Disconnection Alert Modal */}
        {showDisconnectionAlert && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
            <div className="bg-red-600 text-white p-8 rounded-xl shadow-2xl max-w-md w-full mx-4 text-center animate-pulse">
              <div className="text-6xl mb-4">⚠️</div>
              <h2 className="text-2xl font-bold mb-4">Partner Disconnected!</h2>
              <p className="text-lg mb-4">Your chat partner has left.</p>
              <p className="text-md">
                Automatically searching for a new stranger...
              </p>
              <div className="mt-6">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto"></div>
              </div>
            </div>
          </div>
        )}

        {/* Preference Modals - Rendered at parent level to persist */}
        <PreferenceModals
          showGenderModal={showGenderModal}
          showCountryModal={showCountryModal}
          showGameModal={showGameModal}
          matchPreferences={{
            matchGender: matchCriteria.gender || "all",
            matchCountry: matchCriteria.country,
            matchInterest:
              matchCriteria.interests.length > 0
                ? matchCriteria.interests
                : null,
          }}
          onGenderChange={handleGenderChange}
          onCountryChange={handleCountryChange}
          onGameChange={handleGameChange}
          onClearAllGames={handleClearAllGames}
          onCloseModal={handleCloseModal}
          onModalOutsideClick={handleModalOutsideClick}
          showDoneButton={true}
          onDone={handleDone}
        />
      </div>
    </div>
  );
}
