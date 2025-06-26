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

  // Toggle message area state
  const [showMessageArea, setShowMessageArea] = useState(true);

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

      // Clear partner video immediately
      if (remoteVideoRef.current) {
        console.log("✅ Clearing partner video immediately");
        remoteVideoRef.current.srcObject = null;
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
    [addMessage, partnerId, handlePartnerDisconnection]
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

    // Clear remote video element
    if (remoteVideoRef.current) {
      console.log("✅ Clearing remote video element");
      remoteVideoRef.current.srcObject = null;
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

    // Clear match reason
    setMatchReason(null);

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
    <div className="h-screen pt-16 pb-10 flex flex-col">
      <div className="container mx-auto px-4 flex-grow flex flex-col">
        <div className="flex flex-col lg:flex-row gap-4 h-[75vh]">
          {/* User Video */}
          <div className="relative rounded-3xl overflow-hidden flex-1 bg-snappair-primary">
            <div className="absolute left-5 top-5 z-10 bg-black/40 rounded-full px-3 py-1 flex items-center">
              <div className="w-3 h-3 rounded-full mr-2 bg-snappair-green"></div>
              <span className="text-snappair-green text-sm font-medium">
                YOU
              </span>
            </div>

            {/* Local video stream */}
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="absolute inset-0 w-full h-full object-cover"
            />
          </div>

          {/* Stranger Video */}
          <div className="relative rounded-3xl overflow-hidden flex-1 bg-snappair-primary">
            <div className="absolute right-5 top-5 z-10 bg-black/40 rounded-full px-3 py-1 flex items-center">
              <div className="w-3 h-3 rounded-full bg-snappair-green mr-2"></div>
              <span className="text-snappair-green text-sm font-medium">
                {partnerId ? "STRANGER" : "CONNECTING..."}
              </span>
            </div>

            {/* Remote video stream */}
            {isLookingForPartner ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-zinc-900">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white mb-4"></div>
                <p className="text-xl mb-6">Finding your next match...</p>

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
            ) : (
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                muted={false}
                controls={false}
                className="absolute inset-0 w-full h-full object-cover"
                onLoadedMetadata={() => {
                  console.log("Remote video metadata loaded");
                  if (remoteVideoRef.current) {
                    remoteVideoRef.current.play().catch(console.error);
                  }
                }}
                onCanPlay={() => {
                  console.log("Remote video can play");
                }}
                onPlay={() => {
                  console.log("Remote video started playing");
                }}
              />
            )}

            {/* Match Reason Display - Bottom of remote video */}
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
                  : "Searching for partner..."}
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

              {/* Toggle Message Area Button */}
              <button
                onClick={() => setShowMessageArea(!showMessageArea)}
                className="rounded-full w-12 h-12 bg-purple-600 hover:bg-purple-700 flex items-center justify-center text-white"
                title={showMessageArea ? "Hide Chat" : "Show Chat"}
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
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
              </button>
            </>
          )}
        </div>

        {/* Chat Box (conditionally shown) - positioned at bottom right */}
        {isConnected && showMessageArea && (
          <div className="absolute bottom-24 right-4 md:right-8 w-80 md:w-96 bg-zinc-800 rounded-lg shadow-lg overflow-hidden z-10">
            <div className="flex items-center justify-between bg-zinc-700 p-3">
              <h3 className="text-white font-medium">Chat</h3>
              <button
                onClick={clearMessages}
                className="text-zinc-300 hover:text-white"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>

            <div
              ref={chatMessagesRef}
              className="h-60 overflow-y-auto p-3 bg-zinc-900"
            >
              {messages.length === 0 ? (
                <div className="text-center text-zinc-500 mt-10">
                  No messages yet. Say hello!
                </div>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={`mb-2 ${
                      message.sender === "me" ? "text-right" : "text-left"
                    }`}
                  >
                    <div
                      className={`inline-block rounded-lg px-3 py-2 max-w-[85%] ${
                        message.sender === "me"
                          ? "bg-blue-600 text-white"
                          : "bg-zinc-700 text-white"
                      }`}
                    >
                      <p>{message.text}</p>
                      <span className="text-xs opacity-60 block mt-1">
                        {new Date(message.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-2 bg-zinc-800">
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
                  placeholder="Type a message..."
                  className="flex-grow p-2 rounded bg-zinc-700 text-white placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button
                  onClick={sendMessage}
                  disabled={!currentMessage.trim()}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed px-4 py-2 rounded text-white"
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
        )}

        {/* Disconnection Alert Modal */}
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
