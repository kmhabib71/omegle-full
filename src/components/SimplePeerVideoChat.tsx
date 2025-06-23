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
  camera: boolean;
  microphone: boolean;
  permissions: {
    camera: "granted" | "denied" | "prompt";
    microphone: "granted" | "denied" | "prompt";
  };
}

export default function SimplePeerVideoChat() {
  const socketRef = useRef<Socket | null>(null);
  const peerRef = useRef<SimplePeer.Instance | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

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

    setConnectionState((prev) => ({ ...prev, socket: "connecting" }));
  }, []);

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

      peerRef.current.on("error", (err) => {
        console.error("❌ SimplePeer error:", err);
        setConnectionState((prev) => ({ ...prev, peer: "failed" }));
      });

      peerRef.current.on("close", () => {
        console.log("🔌 SimplePeer connection closed");
        setConnectionState((prev) => ({ ...prev, peer: "not_initialized" }));
      });

      setConnectionState((prev) => ({ ...prev, peer: "connecting" }));
    },
    []
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

    socketRef.current.emit("find-partner", [], (response: any) => {
      console.log("📨 Find-partner response:", response);
    });
  }, []);

  const stopSession = useCallback(() => {
    console.log("🛑 Stopping current session...");

    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }

    setPartnerId(null);
    setSessionId(null);
    setIsLookingForPartner(false);
    setConnectionState((prev) => ({
      ...prev,
      peer: "not_initialized",
      queue: "not_in_queue",
    }));

    if (socketRef.current?.connected) {
      socketRef.current.emit("leave-queue");
    }
  }, []);

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
          <h1 className="text-4xl font-bold mb-2">SimplePeer Video Chat</h1>
          <p className="text-gray-400">Connect with strangers worldwide</p>
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
              Media: {connectionState.media}
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-3">You</h3>
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-64 bg-gray-700 rounded-lg object-cover"
            />
            <div className="mt-2 text-sm text-gray-400">
              Camera: {mediaDeviceStatus.camera ? "✅" : "❌"} | Microphone:{" "}
              {mediaDeviceStatus.microphone ? "✅" : "❌"}
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-3">
              {isConnected ? "Partner" : "Waiting for partner..."}
            </h3>
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-64 bg-gray-700 rounded-lg object-cover"
            />
            <div className="mt-2 text-sm text-gray-400">
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
                  ? "bg-blue-600 hover:bg-blue-700 text-white"
                  : "bg-gray-600 text-gray-400 cursor-not-allowed"
              }`}
            >
              Start
            </button>
          )}

          {isSearching && (
            <div className="flex items-center gap-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              <span className="text-lg">Searching for partner...</span>
              <button
                onClick={stopSession}
                className="px-6 py-2 bg-red-600 hover:bg-red-700 rounded-lg font-semibold"
              >
                Stop
              </button>
            </div>
          )}

          {isConnected && (
            <div className="flex items-center gap-4">
              <span className="text-lg text-green-400">✅ Connected!</span>
              <button
                onClick={stopSession}
                className="px-6 py-2 bg-red-600 hover:bg-red-700 rounded-lg font-semibold"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
