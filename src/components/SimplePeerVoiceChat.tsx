"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import SimplePeer from "simple-peer";
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
  microphone: boolean;
  permissions: {
    microphone: "granted" | "denied" | "prompt";
  };
}

interface SimplePeerVoiceChatProps {
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
  const existingUser = localStorage.getItem("anonymousUser");
  if (existingUser) {
    try {
      return JSON.parse(existingUser);
    } catch (error) {
      console.error("Error parsing existing anonymous user:", error);
    }
  }
  return await createAnonymousUser();
};

export default function SimplePeerVoiceChat({
  session,
}: SimplePeerVoiceChatProps) {
  const searchParams = useSearchParams();
  const socketRef = useRef<Socket | null>(null);
  const peerRef = useRef<SimplePeer.Instance | null>(null);
  const localAudioRef = useRef<HTMLAudioElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  const [interests, setInterests] = useState<string[]>([]);
  const [anonymousUser, setAnonymousUser] = useState<any>(null);

  const [connectionState, setConnectionState] = useState<ConnectionState>({
    socket: "disconnected",
    peer: "not_initialized",
    media: "not_ready",
    queue: "not_in_queue",
  });

  const [mediaDeviceStatus, setMediaDeviceStatus] = useState<MediaDeviceStatus>(
    {
      microphone: false,
      permissions: { microphone: "prompt" },
    }
  );

  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLookingForPartner, setIsLookingForPartner] = useState(false);
  const [disconnectionMessage, setDisconnectionMessage] = useState<
    string | null
  >(null);
  const [showDisconnectionAlert, setShowDisconnectionAlert] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [matchReason, setMatchReason] = useState<string | null>(null);

  const [matchCriteria, setMatchCriteria] = useState({
    gender: null as string | null,
    country: null as string | null,
    interests: [] as string[],
  });

  const [showGenderModal, setShowGenderModal] = useState(false);
  const [showCountryModal, setShowCountryModal] = useState(false);
  const [showGameModal, setShowGameModal] = useState(false);

  // Initialize anonymous user
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

  // Interest synchronization
  useEffect(() => {
    const interestsParam = searchParams.get("interests");
    if (interestsParam) {
      const urlInterests = interestsParam
        .split(",")
        .map((i) => i.trim())
        .filter(Boolean);
      setInterests(urlInterests);
      localStorage.setItem("userInterests", JSON.stringify(urlInterests));
    } else {
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

  // Modal handlers
  const handleOpenModal = (modalType: "gender" | "country" | "game") => {
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

  // Partner disconnection handler
  const handlePartnerDisconnection = useCallback(
    (reason: string, skipAutoSearch: boolean = false) => {
      console.log("🔌 Partner disconnected:", reason);

      setShowDisconnectionAlert(true);
      setTimeout(() => {
        setShowDisconnectionAlert(false);
      }, 2000);

      if (peerRef.current) {
        peerRef.current.destroy();
        peerRef.current = null;
      }

      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = null;
      }

      setMatchReason(null);
      setPartnerId(null);
      setSessionId(null);

      if (!skipAutoSearch) {
        setIsLookingForPartner(true);
        setDisconnectionMessage(`${reason} - Looking for new stranger...`);
        setConnectionState((prev) => ({
          ...prev,
          peer: "not_initialized",
          queue: "searching",
        }));

        setTimeout(() => {
          if (socketRef.current?.connected) {
            const profile = {
              userGender: localStorage.getItem("snappairUserGender") || null,
              userLocation:
                localStorage.getItem("snappairUserLocation") || null,
              matchGender: matchCriteria.gender || "all",
              matchLocation: matchCriteria.country || null,
              matchGames: matchCriteria.interests || [],
            };

            socketRef.current.emit("find-partner", profile, (response: any) => {
              console.log("📨 Auto-search response:", response);
            });
          }
        }, 1000);

        setTimeout(() => {
          setDisconnectionMessage(null);
        }, 5000);
      } else {
        setIsLookingForPartner(false);
        setDisconnectionMessage(
          `${reason} - Click START to find a new stranger.`
        );
        setConnectionState((prev) => ({
          ...prev,
          peer: "not_initialized",
          queue: "not_in_queue",
        }));

        setTimeout(() => {
          setDisconnectionMessage(null);
        }, 8000);
      }
    },
    [matchCriteria]
  );

  // Initialize socket
  const initializeSocket = useCallback(() => {
    if (socketRef.current?.connected) {
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
      setIsLookingForPartner(false);
      setConnectionState((prev) => ({ ...prev, queue: "matched" }));

      if (data.matchReason) {
        setMatchReason(data.matchReason);
      }

      initializePeerWithData(data.isInitiator, data.partnerId, data.sessionId);
    });

    socketRef.current.on("webrtc-signal", (data) => {
      console.log("📡 Received WebRTC signal:", data.type);
      if (peerRef.current && !peerRef.current.destroyed) {
        peerRef.current.signal(data.signal);
      }
    });

    socketRef.current.on("partner-disconnected", (data) => {
      const skipAutoSearch = data?.skipAutoSearch || false;
      const reason = data?.reason || "Partner disconnected";
      handlePartnerDisconnection(reason, skipAutoSearch);
    });

    setConnectionState((prev) => ({ ...prev, socket: "connecting" }));
  }, [handlePartnerDisconnection]);

  // Initialize peer connection
  const initializePeerWithData = useCallback(
    (isInitiator: boolean, partnerIdParam: string, sessionIdParam: string) => {
      console.log("🔗 Initializing voice peer connection");

      if (!localStreamRef.current) {
        console.error("❌ No local stream available");
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
        if (socketRef.current && partnerIdParam) {
          socketRef.current.emit("webrtc-signal", {
            partnerId: partnerIdParam,
            sessionId: sessionIdParam,
            signal,
            type: signal.type || "signal",
          });
        }
      });

      peerRef.current.on("connect", () => {
        console.log("🎉 Voice connection established!");
        setConnectionState((prev) => ({ ...prev, peer: "connected" }));
      });

      peerRef.current.on("stream", (remoteStream) => {
        console.log("🎤 Received remote audio stream");
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = remoteStream;
        }
      });

      peerRef.current.on("error", (err) => {
        console.error("❌ SimplePeer error:", err);
        setConnectionState((prev) => ({ ...prev, peer: "failed" }));
        if (partnerId) {
          handlePartnerDisconnection("Connection error occurred", false);
        }
      });

      peerRef.current.on("close", () => {
        console.log("🔌 SimplePeer connection closed");
        setConnectionState((prev) => ({ ...prev, peer: "not_initialized" }));
        if (partnerId) {
          handlePartnerDisconnection("Connection closed", false);
        }
      });

      setConnectionState((prev) => ({ ...prev, peer: "connecting" }));
    },
    [handlePartnerDisconnection, partnerId]
  );

  // Initialize media
  const initializeMedia = useCallback(async () => {
    console.log("🎤 Initializing audio devices...");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      localStreamRef.current = stream;

      if (localAudioRef.current) {
        localAudioRef.current.srcObject = stream;
      }

      setMediaDeviceStatus({
        microphone: stream.getAudioTracks().length > 0,
        permissions: { microphone: "granted" },
      });

      setConnectionState((prev) => ({ ...prev, media: "ready" }));
      console.log("✅ Audio devices initialized successfully");
    } catch (error) {
      console.error("❌ Audio initialization failed:", error);
      setConnectionState((prev) => ({ ...prev, media: "not_ready" }));
    }
  }, []);

  // Start search
  const startSearch = useCallback(() => {
    console.log("🔍 Starting voice partner search...");

    if (!socketRef.current?.connected) {
      console.error("❌ Socket not connected");
      return;
    }

    setIsLookingForPartner(true);
    setConnectionState((prev) => ({ ...prev, queue: "searching" }));

    const profile = {
      userGender: localStorage.getItem("snappairUserGender") || null,
      userLocation: localStorage.getItem("snappairUserLocation") || null,
      matchGender: matchCriteria.gender || "all",
      matchLocation: matchCriteria.country || null,
      matchGames: matchCriteria.interests || [],
    };

    console.log("🔍 Sending voice profile to server:", profile);

    socketRef.current.emit("find-partner", profile, (response: any) => {
      console.log("📨 Find-partner response:", response);
    });
  }, [matchCriteria]);

  // Handle Done button from modals
  const handleDone = useCallback(() => {
    setShowGenderModal(false);
    setShowCountryModal(false);
    setShowGameModal(false);

    setTimeout(() => {
      startSearch();
    }, 500);
  }, [startSearch]);

  // Find next partner
  const findNextPartner = useCallback(() => {
    console.log("🔄 Finding next partner...");

    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }

    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }

    setMatchReason(null);
    setPartnerId(null);
    setSessionId(null);
    setConnectionState((prev) => ({
      ...prev,
      peer: "not_initialized",
      queue: "searching",
    }));

    setIsLookingForPartner(true);

    if (socketRef.current?.connected) {
      const profile = {
        userGender: localStorage.getItem("snappairUserGender") || null,
        userLocation: localStorage.getItem("snappairUserLocation") || null,
        matchGender: matchCriteria.gender || "all",
        matchLocation: matchCriteria.country || null,
        matchGames: matchCriteria.interests || [],
      };

      socketRef.current.emit("find-partner", profile, (response: any) => {
        console.log("📨 Re-queue response:", response);
      });
    }
  }, [matchCriteria]);

  // Stop session
  const stopSession = useCallback(() => {
    console.log("🛑 Complete session termination...");

    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }

    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }

    if (partnerId && socketRef.current?.connected) {
      socketRef.current.emit("stopChat");
    }

    if (socketRef.current?.connected) {
      socketRef.current.emit("leave-queue");
    }

    setPartnerId(null);
    setSessionId(null);
    setIsLookingForPartner(false);
    setDisconnectionMessage(null);
    setConnectionState((prev) => ({
      ...prev,
      peer: "not_initialized",
      queue: "not_in_queue",
    }));

    setMatchReason(null);
  }, [partnerId]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      audioTracks.forEach((track) => {
        track.enabled = isMuted;
      });
      setIsMuted(!isMuted);
    }
  }, [isMuted]);

  // Initialize on mount
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
          {/* Left Side - Voice Controls Interface */}
          <div className="relative rounded-3xl overflow-hidden flex-1 bg-snappair-primary">
            <div className="absolute left-5 top-5 z-10 bg-black/40 rounded-full px-3 py-1 flex items-center">
              <div className="w-3 h-3 rounded-full mr-2 bg-snappair-green"></div>
              <span className="text-snappair-green text-sm font-medium">
                YOUR VOICE
              </span>
            </div>

            {/* Audio Elements (hidden) */}
            <audio ref={localAudioRef} autoPlay muted />

            {/* Voice Control Area */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
              <div className="text-center mb-8">
                <div
                  className={`text-8xl mb-6 ${
                    isConnected ? "animate-pulse" : ""
                  }`}
                >
                  {isMuted ? "🔇" : "🎤"}
                </div>
                <h2 className="text-3xl font-bold mb-4">Voice Chat</h2>
                <p className="text-lg text-white/80 mb-6">
                  Microphone:{" "}
                  {mediaDeviceStatus.microphone
                    ? "✅ Ready"
                    : "❌ Not Available"}
                </p>
              </div>

              {/* Voice Controls */}
              {isConnected && (
                <div className="space-y-4">
                  <button
                    onClick={toggleMute}
                    className={`px-8 py-4 rounded-full font-semibold text-lg transition-all duration-200 ${
                      isMuted
                        ? "bg-red-600 hover:bg-red-700 text-white shadow-lg"
                        : "bg-green-600 hover:bg-green-700 text-white shadow-lg"
                    }`}
                  >
                    {isMuted ? "🔇 Unmute" : "🎤 Mute"}
                  </button>

                  {/* Audio Status Indicator */}
                  <div className="bg-black/20 rounded-lg p-4 backdrop-blur-sm">
                    <div className="flex items-center justify-center text-white/80 text-sm">
                      <div
                        className={`w-2 h-2 rounded-full mr-2 ${
                          isMuted ? "bg-red-400" : "bg-green-400"
                        } animate-pulse`}
                      ></div>
                      <span>
                        {isMuted ? "Microphone Muted" : "Voice Active"}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Voice Visualization */}
              {!isConnected && (
                <div className="bg-black/20 rounded-lg p-6 backdrop-blur-sm">
                  <div className="flex items-center space-x-2">
                    {[...Array(5)].map((_, i) => (
                      <div
                        key={i}
                        className={`w-1 bg-blue-400 rounded-full animate-pulse`}
                        style={{
                          height: `${Math.random() * 40 + 20}px`,
                          animationDelay: `${i * 0.1}s`,
                        }}
                      />
                    ))}
                  </div>
                  <p className="text-center text-white/60 text-sm mt-3">
                    Ready for voice connection
                  </p>
                </div>
              )}
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

            {/* Audio Elements (hidden) */}
            <audio ref={remoteAudioRef} autoPlay />

            {/* Connection Area */}
            {isLookingForPartner ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-zinc-900">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white mb-4"></div>
                <p className="text-xl mb-6">Finding your voice partner...</p>

                {/* Match Criteria Controls */}
                <div className="mb-6 z-20">
                  <MatchCriteriaControls
                    isVisible={true}
                    currentCriteria={matchCriteria}
                    onOpenModal={handleOpenModal}
                    onStopSearch={handleStopSearch}
                  />
                </div>

                {/* Background animation */}
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
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-gradient-to-br from-purple-900/50 to-pink-900/50">
                <div className="text-8xl mb-6 animate-pulse">🔊</div>
                <h2 className="text-3xl font-bold mb-4">Voice Connected!</h2>
                <p className="text-lg mb-6 text-center max-w-md">
                  You're now in a voice chat with a stranger. Speak clearly and
                  enjoy your conversation!
                </p>

                {/* Partner Info */}
                <div className="bg-black/20 rounded-lg p-4 backdrop-blur-sm mb-4">
                  <div className="flex items-center text-white/80 text-sm">
                    <div className="w-2 h-2 rounded-full bg-green-400 mr-2 animate-pulse"></div>
                    <span>Partner ID: {partnerId?.substring(0, 8)}...</span>
                  </div>
                </div>

                {/* Voice Level Indicator */}
                <div className="bg-black/20 rounded-lg p-4 backdrop-blur-sm">
                  <div className="flex items-center space-x-2">
                    <span className="text-white/60 text-sm mr-3">
                      Voice Level:
                    </span>
                    {[...Array(8)].map((_, i) => (
                      <div
                        key={i}
                        className="w-1 bg-gradient-to-t from-green-400 to-blue-400 rounded-full animate-pulse"
                        style={{
                          height: `${Math.random() * 30 + 10}px`,
                          animationDelay: `${i * 0.15}s`,
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-gradient-to-br from-gray-800 to-gray-900">
                <div className="text-8xl mb-6 opacity-50">🎧</div>
                <h2 className="text-2xl font-bold mb-4">Ready for Voice</h2>
                <p className="text-lg text-center max-w-md text-white/70">
                  Click START to find someone to talk with!
                </p>
              </div>
            )}

            {/* Match Reason Display */}
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

        {/* Disconnection Message */}
        {disconnectionMessage && (
          <div className="bg-orange-600 rounded-lg p-4 mb-6 text-center">
            <div className="flex items-center justify-center gap-2">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              <span className="text-lg font-semibold text-white">
                {disconnectionMessage}
              </span>
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
                  : "Searching for voice partner..."}
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

              {/* Mute Toggle Button */}
              <button
                onClick={toggleMute}
                className={`rounded-full w-12 h-12 flex items-center justify-center text-white transition-colors ${
                  isMuted
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-green-600 hover:bg-green-700"
                }`}
                title={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted ? (
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
                      d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"
                    />
                  </svg>
                ) : (
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
                      d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                    />
                  </svg>
                )}
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
              <p className="text-lg mb-4">Your voice partner has left.</p>
              <p className="text-md">
                Automatically searching for a new stranger...
              </p>
              <div className="mt-6">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto"></div>
              </div>
            </div>
          </div>
        )}

        {/* Preference Modals */}
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
