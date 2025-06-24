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

export default function SimplePeerVoiceChat({
  session,
}: SimplePeerVoiceChatProps) {
  const socketRef = useRef<Socket | null>(null);
  const peerRef = useRef<SimplePeer.Instance | null>(null);
  const localAudioRef = useRef<HTMLAudioElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

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
  const [interests, setInterests] = useState<string[]>([]);
  const [currentInterest, setCurrentInterest] = useState("");
  const [isMuted, setIsMuted] = useState(false);

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

      // Clear partner audio immediately
      if (remoteAudioRef.current) {
        console.log("✅ Clearing partner audio immediately");
        remoteAudioRef.current.srcObject = null;
      }

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
    [interests]
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
        "🔗 Initializing SimplePeer connection for voice chat, initiator:",
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
        console.log("🎉 SimplePeer voice chat connection established!");
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
    [handlePartnerDisconnection, partnerId]
  );

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

  const startSearch = useCallback(() => {
    console.log("🔍 Starting partner search for voice chat...");

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

    // Clear remote audio element
    if (remoteAudioRef.current) {
      console.log("✅ Clearing remote audio element");
      remoteAudioRef.current.srcObject = null;
    }

    // Log session end (in a real app, this would log to database)
    console.log("✅ Logging session end for partner:", partnerId);

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
  }, [partnerId, interests]);

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
    if (remoteAudioRef.current) {
      console.log("✅ Clearing remote audio element");
      remoteAudioRef.current.srcObject = null;
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

    console.log("✅ Session completely terminated - UI reset to initial state");
    console.log("✅ START button will show, NEXT and STOP buttons hidden");
  }, [partnerId]);

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

  // Mute/Unmute functionality
  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      audioTracks.forEach((track) => {
        track.enabled = isMuted;
      });
      setIsMuted(!isMuted);
    }
  }, [isMuted]);

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
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-4">
      <div className="w-full max-w-6xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">SimplePeer Voice Chat</h1>
          <p className="text-gray-400">
            Connect with strangers for voice conversations
          </p>
        </div>

        <div className="bg-gray-800 rounded-lg p-4 mb-6">
          <h3 className="text-lg font-semibold mb-3">Connection Status</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
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
                connectionState.media === "ready"
                  ? "bg-green-600"
                  : "bg-red-600"
              }`}
            >
              Audio: {connectionState.media}
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
              <p className="text-lg mb-4">
                Your partner has left the voice chat.
              </p>
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

          {/* Voice Controls Section */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-3">
              {isConnected
                ? "Voice Chat Active"
                : "Voice Chat (Connect to enable)"}
            </h3>

            {/* Audio Elements (hidden) */}
            <audio ref={localAudioRef} autoPlay muted />
            <audio ref={remoteAudioRef} autoPlay />

            <div className="h-64 bg-gray-700 rounded-lg p-6 mb-3 flex flex-col items-center justify-center">
              {isConnected ? (
                <div className="text-center">
                  <div className="text-6xl mb-4">🎤</div>
                  <div className="text-xl font-semibold mb-2">
                    Voice Chat Active
                  </div>
                  <div className="text-gray-300 mb-4">
                    Connected to: {partnerId}
                  </div>
                  <button
                    onClick={toggleMute}
                    className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
                      isMuted
                        ? "bg-red-600 hover:bg-red-700 text-white"
                        : "bg-green-600 hover:bg-green-700 text-white"
                    }`}
                  >
                    {isMuted ? "🔇 Unmute" : "🎤 Mute"}
                  </button>
                </div>
              ) : (
                <div className="text-center">
                  <div className="text-6xl mb-4 opacity-50">🎤</div>
                  <div className="text-gray-400 text-lg">
                    {isSearching
                      ? "Searching for voice chat partner..."
                      : "Connect with a partner to start voice chat"}
                  </div>
                </div>
              )}
            </div>
            <div className="text-sm text-gray-400 text-center">
              Microphone:{" "}
              {mediaDeviceStatus.microphone ? "✅ Ready" : "❌ Not Available"}
              {isConnected && (
                <span className="ml-4">
                  Status: {isMuted ? "🔇 Muted" : "🎤 Active"}
                </span>
              )}
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
