"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import SimplePeer from "simple-peer";
import { MatchCriteriaControls } from "./MatchCriteriaControls";

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

  // Match criteria state
  const [matchCriteria, setMatchCriteria] = useState({
    gender: null as string | null,
    country: null as string | null,
    interests: [] as string[],
  });

  // Load match criteria from localStorage
  useEffect(() => {
    const savedGender = localStorage.getItem("snappairMatchGender");
    const savedCountry = localStorage.getItem("snappairMatchCountry");
    const savedInterests = localStorage.getItem("snappairMatchInterests");

    setMatchCriteria({
      gender: savedGender && savedGender !== "all" ? savedGender : null,
      country: savedCountry || null,
      interests: savedInterests ? JSON.parse(savedInterests) : [],
    });
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

  // Helper function to build search profile consistently
  const buildSearchProfile = useCallback(() => {
    return {
      userGender: localStorage.getItem("snappairUserGender"),
      userLocation: localStorage.getItem("snappairUserLocation"),
      matchGender: matchCriteria.gender || "all",
      matchCountry: matchCriteria.country,
      matchInterest: matchCriteria.interests,
    };
  }, [matchCriteria]);

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
            const searchProfile = buildSearchProfile();
            console.log("🔍 Auto-searching with profile:", searchProfile);
            socketRef.current.emit(
              "find-partner",
              searchProfile,
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
    [clearMessages, buildSearchProfile]
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

    // Include match criteria in the search
    const searchProfile = {
      userGender: localStorage.getItem("snappairUserGender"),
      userLocation: localStorage.getItem("snappairUserLocation"),
      matchGender: matchCriteria.gender || "all",
      matchCountry: matchCriteria.country,
      matchInterest:
        matchCriteria.interests.length > 0
          ? matchCriteria.interests
          : interests,
    };

    console.log("🔍 Text chat searching with profile:", searchProfile);

    socketRef.current.emit("find-partner", searchProfile, (response: any) => {
      console.log("📨 Find-partner response:", response);
    });
  }, [interests, matchCriteria]);

  // Handle match criteria updates
  const handleCriteriaUpdate = useCallback(
    (newCriteria: any) => {
      setMatchCriteria(newCriteria);

      // Restart search with new criteria if currently searching
      if (isLookingForPartner) {
        setTimeout(() => {
          startSearch();
        }, 100);
      }
    },
    [isLookingForPartner, startSearch]
  );

  const handleStopSearch = useCallback(() => {
    if (socketRef.current && isLookingForPartner) {
      socketRef.current.emit("cancel-search");
      setIsLookingForPartner(false);
      setConnectionState((prev) => ({ ...prev, queue: "not_in_queue" }));
    }
  }, [isLookingForPartner]);

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
      const searchProfile = buildSearchProfile();
      console.log("🔍 Next partner search with profile:", searchProfile);
      socketRef.current.emit("find-partner", searchProfile, (response: any) => {
        console.log("📨 Re-queue find-partner response:", response);
      });
    }

    // Button State Management happens automatically via state changes
    console.log(
      "✅ Button state updated: NEXT hidden, STOP enabled, searching indicator shown"
    );
  }, [partnerId, clearMessages, buildSearchProfile]);

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
    <div className="h-screen pt-16 pb-10 flex flex-col">
      <div className="container mx-auto px-4 flex-grow flex flex-col">
        <div className="flex flex-col lg:flex-row gap-4 h-[75vh]">
          {/* User Chat Area */}
          <div className="relative rounded-3xl overflow-hidden flex-1 bg-snappair-primary">
            <div className="absolute left-5 top-5 z-10 bg-black/40 rounded-full px-3 py-1 flex items-center">
              <div className="w-3 h-3 rounded-full mr-2 bg-snappair-green"></div>
              <span className="text-snappair-green text-sm font-medium">
                YOU
              </span>
            </div>

            {/* Chat Messages */}
            <div className="absolute inset-0 pt-16 pb-20 px-6">
              <div
                ref={chatMessagesRef}
                className="h-full overflow-y-auto space-y-3"
              >
                {messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center text-gray-400">
                      <div className="text-6xl mb-4">💬</div>
                      <div className="text-lg">
                        Your messages will appear here
                      </div>
                    </div>
                  </div>
                ) : (
                  messages
                    .filter((msg) => msg.sender === "me")
                    .map((message) => (
                      <div key={message.id} className="flex justify-end">
                        <div className="max-w-xs px-4 py-2 rounded-2xl bg-blue-600 text-white">
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
                    ))
                )}
              </div>
            </div>

            {/* Message Input */}
            {isConnected && (
              <div className="absolute bottom-4 left-4 right-4">
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
                    placeholder="Type your message..."
                    className="flex-1 px-4 py-3 bg-black/40 text-white rounded-full border border-gray-600 focus:border-blue-500 focus:outline-none placeholder-gray-400"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!currentMessage.trim()}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-full font-semibold transition-colors"
                  >
                    Send
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Stranger Chat Area */}
          <div className="relative rounded-3xl overflow-hidden flex-1 bg-snappair-primary">
            <div className="absolute right-5 top-5 z-10 bg-black/40 rounded-full px-3 py-1 flex items-center">
              <div className="w-3 h-3 rounded-full bg-snappair-green mr-2"></div>
              <span className="text-snappair-green text-sm font-medium">
                {partnerId ? "STRANGER" : "CONNECTING..."}
              </span>
            </div>

            {/* Stranger Messages or Search State */}
            {isLookingForPartner ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-zinc-900">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white mb-4"></div>
                <p className="text-xl mb-6">
                  Finding your text chat partner...
                </p>

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

                {/* Match Criteria Controls - shown while searching */}
                <MatchCriteriaControls
                  currentCriteria={matchCriteria}
                  onCriteriaUpdate={handleCriteriaUpdate}
                  onStopSearch={handleStopSearch}
                  isVisible={isLookingForPartner}
                />

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
            ) : (
              <div className="absolute inset-0 pt-16 pb-4 px-6">
                <div className="h-full overflow-y-auto space-y-3">
                  {isConnected ? (
                    messages
                      .filter((msg) => msg.sender === "partner")
                      .map((message) => (
                        <div key={message.id} className="flex justify-start">
                          <div className="max-w-xs px-4 py-2 rounded-2xl bg-gray-600 text-white">
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
                      ))
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center text-gray-400">
                        <div className="text-6xl mb-4 opacity-50">💬</div>
                        <div className="text-lg">
                          Waiting for stranger's messages...
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
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
                  : interests.length > 0
                  ? `Searching for partner with similar interests...`
                  : "Searching for random partner..."}
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}
