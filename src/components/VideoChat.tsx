"use client";

import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { PhaseOneDebugger } from "@/components/PhaseOneDebugger";

// Types for better type safety
interface MediaDeviceStatus {
  camera: boolean;
  microphone: boolean;
  permissions: {
    camera: PermissionState | null;
    microphone: PermissionState | null;
  };
}

interface ConnectionState {
  socket: "disconnected" | "connecting" | "connected" | "error";
  webrtc: "not_initialized" | "initialized" | "error";
  media: "not_ready" | "checking" | "ready" | "error";
  queue: "not_in_queue" | "searching" | "matched" | "error";
}

interface Phase1Checkpoints {
  socketConnection: boolean;
  networkConnectivity: boolean;
  webrtcInitialized: boolean;
  connectionStateSet: boolean;
  cameraPermission: boolean;
  microphonePermission: boolean;
  deviceAvailability: boolean;
  localStreamInitialized: boolean;
  mediaConstraintsSet: boolean;
  startButtonVisible: boolean;
  startButtonDisabled: boolean;
  nextButtonHidden: boolean;
  stopButtonHidden: boolean;
  videoFramesCleared: boolean;
  statesReset: boolean;
}

interface VideoChatProps {
  session: any;
}

export default function VideoChat({ session }: VideoChatProps) {
  const router = useRouter();

  // Socket and WebRTC refs
  const socketRef = useRef<Socket | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  // State management
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    socket: "disconnected",
    webrtc: "not_initialized",
    media: "not_ready",
    queue: "not_in_queue",
  });

  const [mediaDeviceStatus, setMediaDeviceStatus] = useState<MediaDeviceStatus>(
    {
      camera: false,
      microphone: false,
      permissions: {
        camera: null,
        microphone: null,
      },
    }
  );

  const [phase1Checkpoints, setPhase1Checkpoints] = useState<Phase1Checkpoints>(
    {
      socketConnection: false,
      networkConnectivity: false,
      webrtcInitialized: false,
      connectionStateSet: false,
      cameraPermission: false,
      microphonePermission: false,
      deviceAvailability: false,
      localStreamInitialized: false,
      mediaConstraintsSet: false,
      startButtonVisible: true,
      startButtonDisabled: true,
      nextButtonHidden: true,
      stopButtonHidden: true,
      videoFramesCleared: true,
      statesReset: true,
    }
  );

  const [debugMode, setDebugMode] = useState(true);
  const [isLookingForPartner, setIsLookingForPartner] = useState(false);
  const [mediaConstraints] = useState<MediaStreamConstraints>({
    video: {
      width: { ideal: 640 },
      height: { ideal: 480 },
      frameRate: { ideal: 30 },
    },
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });

  // WebRTC configuration
  const rtcConfig: RTCConfiguration = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
    ],
    iceCandidatePoolSize: 10,
  };

  // Phase 1: Socket Connection Validation
  const initializeSocketConnection = async () => {
    try {
      setConnectionState((prev) => ({ ...prev, socket: "connecting" }));

      // Wait for client-side environment
      if (typeof window === "undefined") return;

      // Initialize Socket.IO connection
      socketRef.current = io(
        process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001",
        {
          transports: ["websocket", "polling"],
          timeout: 5000,
          retries: 3,
        }
      );

      socketRef.current.on("connect", () => {
        console.log("✔ Socket connected:", socketRef.current?.id);

        // Use functional update to avoid stale closure
        setConnectionState((prev) => ({
          ...prev,
          socket: "connected" as const,
        }));

        // Send a test ping to validate connection
        socketRef.current?.emit("ping");
      });

      socketRef.current.on("disconnect", () => {
        console.log("❌ Socket disconnected");
        setConnectionState((prev) => ({ ...prev, socket: "disconnected" }));
        setPhase1Checkpoints((prev) => ({
          ...prev,
          socketConnection: false,
          networkConnectivity: false,
        }));
        updateStartButtonState();
      });

      socketRef.current.on("connect_error", (error) => {
        console.error("❌ Socket connection error:", error);
        setConnectionState((prev) => ({ ...prev, socket: "error" }));
        setPhase1Checkpoints((prev) => ({
          ...prev,
          socketConnection: false,
          networkConnectivity: false,
        }));
        updateStartButtonState();
      });

      // Handle pong response for connection health monitoring
      socketRef.current.on("pong", (data) => {
        console.log("🏓 Pong received:", data);
      });

      // Handle connection validation response
      socketRef.current.on("connection-validated", (data) => {
        console.log("✔ Connection validated:", data);
      });
    } catch (error) {
      console.error("❌ Failed to initialize socket:", error);
      setConnectionState((prev) => ({ ...prev, socket: "error" }));
    }
  };

  // Phase 1: Initialize WebRTC Configuration
  const initializeWebRTC = () => {
    try {
      if (typeof window === "undefined") return;

      peerConnectionRef.current = new RTCPeerConnection(rtcConfig);
      console.log("✔ WebRTC PeerConnection initialized");

      // Use functional update to avoid stale closure
      setConnectionState((prev) => {
        const newState = { ...prev, webrtc: "initialized" as const };
        // Don't call checkStartButtonState here to avoid race condition
        return newState;
      });
    } catch (error) {
      console.error("❌ Failed to initialize WebRTC:", error);
      setConnectionState((prev) => {
        const newState = { ...prev, webrtc: "error" as const };
        return newState;
      });
    }
  };

  // Phase 1: Media Device Preparation
  const checkMediaDevices = async () => {
    try {
      if (typeof window === "undefined") return;

      setConnectionState((prev) => ({ ...prev, media: "checking" }));

      // Check permissions first
      const cameraPermission = await navigator.permissions.query({
        name: "camera" as PermissionName,
      });
      const microphonePermission = await navigator.permissions.query({
        name: "microphone" as PermissionName,
      });

      setMediaDeviceStatus((prev) => ({
        ...prev,
        permissions: {
          camera: cameraPermission.state,
          microphone: microphonePermission.state,
        },
      }));

      setPhase1Checkpoints((prev) => ({
        ...prev,
        cameraPermission: cameraPermission.state === "granted",
        microphonePermission: microphonePermission.state === "granted",
      }));

      // Check device availability
      const devices = await navigator.mediaDevices.enumerateDevices();
      const hasCamera = devices.some((device) => device.kind === "videoinput");
      const hasMicrophone = devices.some(
        (device) => device.kind === "audioinput"
      );

      setMediaDeviceStatus((prev) => ({
        ...prev,
        camera: hasCamera,
        microphone: hasMicrophone,
      }));

      setPhase1Checkpoints((prev) => ({
        ...prev,
        deviceAvailability: hasCamera && hasMicrophone,
        mediaConstraintsSet: true,
      }));

      if (hasCamera && hasMicrophone) {
        setConnectionState((prev) => ({ ...prev, media: "ready" as const }));
        console.log("✔ Media devices available");
      } else {
        setConnectionState((prev) => ({ ...prev, media: "error" as const }));
        console.error("❌ Missing media devices");
      }
    } catch (error) {
      console.error("❌ Failed to check media devices:", error);
      setConnectionState((prev) => ({ ...prev, media: "error" }));
      setPhase1Checkpoints((prev) => ({
        ...prev,
        cameraPermission: false,
        microphonePermission: false,
        deviceAvailability: false,
      }));
    }
  };

  // Initialize local stream and start local video
  const initializeLocalStream = async () => {
    try {
      console.log("🎥 Starting local video stream...");

      // Get user media for local video
      const stream = await navigator.mediaDevices.getUserMedia(
        mediaConstraints
      );
      localStreamRef.current = stream;

      // Display local video
      const localVideo = document.getElementById(
        "localVideo"
      ) as HTMLVideoElement;
      if (localVideo) {
        localVideo.srcObject = stream;
        localVideo.style.display = "block";
        console.log("✔ Local video stream started");
      }

      setPhase1Checkpoints((prev) => ({
        ...prev,
        localStreamInitialized: true,
      }));
    } catch (error) {
      console.error("❌ Failed to start local video:", error);
      setPhase1Checkpoints((prev) => ({
        ...prev,
        localStreamInitialized: false,
      }));
    }
  };

  // Check if START button should be enabled
  const checkStartButtonState = (currentConnectionState = connectionState) => {
    const socketConnected = currentConnectionState.socket === "connected";
    const mediaReady = currentConnectionState.media === "ready";
    const webrtcReady = currentConnectionState.webrtc === "initialized";

    const shouldEnable = socketConnected && mediaReady && webrtcReady;

    console.log("🔍 Checking START button state:", {
      socketConnected,
      mediaReady,
      webrtcReady,
      shouldEnable,
    });

    setPhase1Checkpoints((prev) => ({
      ...prev,
      startButtonDisabled: !shouldEnable,
    }));
  };

  // Update START button state
  const updateStartButtonState = () => {
    setPhase1Checkpoints((prev) => ({
      ...prev,
      startButtonDisabled: true,
    }));
  };

  // Reset all connection states
  const resetAllStates = () => {
    setConnectionState({
      socket: "disconnected",
      webrtc: "not_initialized",
      media: "not_ready",
      queue: "not_in_queue",
    });

    setPhase1Checkpoints((prev) => ({
      ...prev,
      connectionStateSet: true,
      statesReset: true,
    }));

    console.log("✔ All states reset to initial values");
  };

  // Phase 2: START button functionality
  const handleStartChat = () => {
    console.log("🚀 Starting chat - looking for partner...");

    if (!socketRef.current || connectionState.socket !== "connected") {
      console.error("❌ Socket not connected");
      return;
    }

    setIsLookingForPartner(true);
    setConnectionState((prev) => ({ ...prev, queue: "searching" }));

    // Join the matching queue
    socketRef.current.emit("join", []); // Empty interests for now

    // Listen for partner match
    socketRef.current.on("partner-found", (partnerData) => {
      console.log("✔ Partner found:", partnerData);
      setIsLookingForPartner(false);
      setConnectionState((prev) => ({ ...prev, queue: "matched" }));
    });

    // Listen for partner disconnect
    socketRef.current.on("partner-disconnected", () => {
      console.log("❌ Partner disconnected");
      setIsLookingForPartner(false);
      setConnectionState((prev) => ({ ...prev, queue: "not_in_queue" }));
    });
  };

  // Clear video frames
  const clearVideoFrames = () => {
    // Clear any existing video elements
    const localVideo = document.getElementById(
      "localVideo"
    ) as HTMLVideoElement;
    const remoteVideo = document.getElementById(
      "remoteVideo"
    ) as HTMLVideoElement;

    if (localVideo) {
      localVideo.srcObject = null;
    }
    if (remoteVideo) {
      remoteVideo.srcObject = null;
    }

    setPhase1Checkpoints((prev) => ({ ...prev, videoFramesCleared: true }));
    console.log("✔ Video frames cleared");
  };

  // Validate all checkpoints based on current states
  const validateAllCheckpoints = () => {
    const socketConnected = connectionState.socket === "connected";
    const webrtcReady = connectionState.webrtc === "initialized";
    const mediaReady = connectionState.media === "ready";

    console.log("🔍 Validating checkpoints with current states:", {
      connectionState,
      mediaDeviceStatus,
      socketConnected,
      webrtcReady,
      mediaReady,
    });

    setPhase1Checkpoints((prev) => {
      const newCheckpoints = {
        ...prev,
        // Socket Connection Validation
        socketConnection: socketConnected,
        networkConnectivity: socketConnected,
        webrtcInitialized: webrtcReady,
        connectionStateSet: true,

        // Media Device Preparation
        cameraPermission:
          prev.cameraPermission ||
          mediaDeviceStatus.permissions.camera === "granted",
        microphonePermission:
          prev.microphonePermission ||
          mediaDeviceStatus.permissions.microphone === "granted",
        deviceAvailability:
          mediaDeviceStatus.camera && mediaDeviceStatus.microphone,
        localStreamInitialized: true, // This is set to true as we initialize the reference
        mediaConstraintsSet: true,

        // UI State Initialization
        startButtonVisible: true,
        startButtonDisabled: !(socketConnected && webrtcReady && mediaReady),
        nextButtonHidden: true,
        stopButtonHidden: true,
        videoFramesCleared: true,
        statesReset: true,
      };

      console.log("✔ Updated checkpoints:", newCheckpoints);
      return newCheckpoints;
    });
  };

  // Phase 1 initialization
  useEffect(() => {
    // Only run in browser environment
    if (typeof window === "undefined") return;

    console.log("🚀 Starting Phase 1: Initial Load & Setup");

    // Reset everything first
    resetAllStates();
    clearVideoFrames();

    // Initialize components in sequence (remove artificial delays)
    const initializePhase1 = async () => {
      try {
        // Initialize all components immediately but in order
        await initializeSocketConnection();
        initializeWebRTC();
        await checkMediaDevices();
        initializeLocalStream();
      } catch (error) {
        console.error("❌ Phase 1 initialization error:", error);
      }
    };

    initializePhase1();

    return () => {
      // Cleanup on unmount
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []); // Empty dependency array - only run once

  // Monitor connection states and update checkpoints
  useEffect(() => {
    console.log("🔄 Connection state changed:", connectionState);
    checkStartButtonState();
    validateAllCheckpoints();
  }, [connectionState]);

  // Monitor media device status changes
  useEffect(() => {
    console.log("🎥 Media device status changed:", mediaDeviceStatus);
    validateAllCheckpoints();
  }, [mediaDeviceStatus]);

  // Debug Component
  const DebugPanel = () => {
    const getStatusIcon = (status: boolean) => (status ? "✔" : "❌");
    const getConnectionColor = (state: string) => {
      switch (state) {
        case "connected":
          return "text-green-600";
        case "connecting":
          return "text-yellow-600";
        case "error":
          return "text-red-600";
        default:
          return "text-gray-600";
      }
    };

    return (
      <div className="bg-gray-900 text-white p-4 rounded-lg mb-6 font-mono text-sm">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-blue-400">
            🔧 Phase 1 Debug Panel
          </h3>
          <div className="flex space-x-2">
            <button
              onClick={() => setDebugMode(!debugMode)}
              className="px-3 py-1 bg-blue-600 rounded text-xs"
            >
              {debugMode ? "Hide" : "Show"}
            </button>
            <button
              onClick={validateAllCheckpoints}
              className="px-3 py-1 bg-green-600 rounded text-xs"
            >
              Force Validate
            </button>
          </div>
        </div>

        {debugMode && (
          <div className="space-y-4">
            {/* Connection States */}
            <div>
              <h4 className="text-yellow-400 font-bold mb-2">
                📡 Connection States
              </h4>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  Socket:{" "}
                  <span className={getConnectionColor(connectionState.socket)}>
                    {connectionState.socket}
                  </span>
                </div>
                <div>
                  WebRTC:{" "}
                  <span className={getConnectionColor(connectionState.webrtc)}>
                    {connectionState.webrtc}
                  </span>
                </div>
                <div>
                  Media:{" "}
                  <span className={getConnectionColor(connectionState.media)}>
                    {connectionState.media}
                  </span>
                </div>
                <div>
                  Queue:{" "}
                  <span className={getConnectionColor(connectionState.queue)}>
                    {connectionState.queue}
                  </span>
                </div>
              </div>
            </div>

            {/* Phase 1 Checkpoints */}
            <div>
              <h4 className="text-yellow-400 font-bold mb-2">
                ✔ Phase 1 Checkpoints
              </h4>
              <div className="space-y-1">
                <div className="text-green-400 font-bold">
                  🔌 Socket Connection Validation:
                </div>
                <div>
                  {getStatusIcon(phase1Checkpoints.socketConnection)} Socket
                  Connection
                </div>
                <div>
                  {getStatusIcon(phase1Checkpoints.networkConnectivity)} Network
                  Connectivity
                </div>
                <div>
                  {getStatusIcon(phase1Checkpoints.webrtcInitialized)} WebRTC
                  Initialized
                </div>
                <div>
                  {getStatusIcon(phase1Checkpoints.connectionStateSet)}{" "}
                  Connection State Set
                </div>

                <div className="text-green-400 font-bold mt-3">
                  🎥 Media Device Preparation:
                </div>
                <div>
                  {getStatusIcon(phase1Checkpoints.cameraPermission)} Camera
                  Permission
                </div>
                <div>
                  {getStatusIcon(phase1Checkpoints.microphonePermission)}{" "}
                  Microphone Permission
                </div>
                <div>
                  {getStatusIcon(phase1Checkpoints.deviceAvailability)} Device
                  Availability
                </div>
                <div>
                  {getStatusIcon(phase1Checkpoints.localStreamInitialized)}{" "}
                  Local Stream Initialized
                </div>
                <div>
                  {getStatusIcon(phase1Checkpoints.mediaConstraintsSet)} Media
                  Constraints Set
                </div>

                <div className="text-green-400 font-bold mt-3">
                  🎛️ UI State Initialization:
                </div>
                <div>
                  {getStatusIcon(phase1Checkpoints.startButtonVisible)} START
                  Button Visible
                </div>
                <div>
                  {getStatusIcon(!phase1Checkpoints.startButtonDisabled)} START
                  Button Enabled
                </div>
                <div>
                  {getStatusIcon(phase1Checkpoints.nextButtonHidden)} NEXT
                  Button Hidden
                </div>
                <div>
                  {getStatusIcon(phase1Checkpoints.stopButtonHidden)} STOP
                  Button Hidden
                </div>
                <div>
                  {getStatusIcon(phase1Checkpoints.videoFramesCleared)} Video
                  Frames Cleared
                </div>
                <div>
                  {getStatusIcon(phase1Checkpoints.statesReset)} States Reset
                </div>
              </div>
            </div>

            {/* Media Device Status */}
            <div>
              <h4 className="text-yellow-400 font-bold mb-2">
                🎬 Media Device Status
              </h4>
              <div>
                Camera Available: {mediaDeviceStatus.camera ? "✔" : "❌"}
              </div>
              <div>
                Microphone Available:{" "}
                {mediaDeviceStatus.microphone ? "✔" : "❌"}
              </div>
              <div>
                Camera Permission:{" "}
                {mediaDeviceStatus.permissions.camera || "not checked"}
              </div>
              <div>
                Microphone Permission:{" "}
                {mediaDeviceStatus.permissions.microphone || "not checked"}
              </div>
            </div>

            {/* Overall Phase 1 Status */}
            <div className="pt-2 border-t border-gray-700">
              <div className="text-lg">
                Phase 1 Complete:{" "}
                {connectionState.socket === "connected" &&
                connectionState.webrtc === "initialized" &&
                connectionState.media === "ready"
                  ? "✔"
                  : "❌"}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">
                Video Chat - Phase 1
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700">
                Welcome, {session?.user?.name}!
              </span>
              <button
                onClick={() => signOut()}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Debug Panel */}
          <DebugPanel />

          {/* Phase 1 Test Suite */}
          <PhaseOneDebugger />

          {/* Video Chat Interface */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Local Video */}
              <div className="bg-black rounded-lg aspect-video flex items-center justify-center relative">
                <video
                  id="localVideo"
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover rounded-lg"
                  style={{ display: "none" }} // Hidden until stream starts
                />
                <div className="text-white text-center absolute inset-0 flex items-center justify-center">
                  <div>
                    <div className="text-lg mb-2">Your Video</div>
                    <div className="text-sm opacity-75">
                      {localStreamRef.current
                        ? "Camera active"
                        : "Loading camera..."}
                    </div>
                  </div>
                </div>
              </div>

              {/* Remote Video */}
              <div className="bg-gray-800 rounded-lg aspect-video flex items-center justify-center">
                <video
                  id="remoteVideo"
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover rounded-lg"
                  style={{ display: "none" }} // Hidden until partner connects
                />
                <div className="text-white text-center">
                  <div className="text-lg mb-2">Stranger's Video</div>
                  <div className="text-sm opacity-75">
                    Waiting for connection...
                  </div>
                </div>
              </div>
            </div>

            {/* Controls */}
            <div className="mt-6 flex justify-center space-x-4">
              {/* START Button - Only visible, disabled until Phase 1 complete */}
              {phase1Checkpoints.startButtonVisible && (
                <button
                  disabled={
                    phase1Checkpoints.startButtonDisabled || isLookingForPartner
                  }
                  onClick={handleStartChat}
                  className={`px-8 py-3 rounded-lg font-semibold text-lg ${
                    phase1Checkpoints.startButtonDisabled || isLookingForPartner
                      ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                      : "bg-green-600 hover:bg-green-700 text-white"
                  }`}
                >
                  {isLookingForPartner ? "LOOKING..." : "START"}
                </button>
              )}

              {/* NEXT Button - Hidden in Phase 1 */}
              {!phase1Checkpoints.nextButtonHidden && (
                <button
                  disabled
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold"
                >
                  NEXT
                </button>
              )}

              {/* STOP Button - Hidden in Phase 1 */}
              {!phase1Checkpoints.stopButtonHidden && (
                <button
                  disabled
                  className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold"
                >
                  STOP
                </button>
              )}
            </div>

            {/* Connection Status */}
            <div className="mt-4 text-center">
              <div className="text-sm text-gray-600 mb-2">
                {connectionState.queue === "searching"
                  ? "🔍 Looking for stranger..."
                  : connectionState.queue === "matched"
                  ? "🟢 Connected to stranger"
                  : connectionState.socket === "connected"
                  ? "🟢 Connected to server"
                  : connectionState.socket === "connecting"
                  ? "🟡 Connecting to server..."
                  : connectionState.socket === "error"
                  ? "🔴 Connection failed"
                  : "⚪ Disconnected"}
              </div>

              {/* Phase 1 Progress Bar */}
              <div className="mt-2">
                <div className="text-xs text-gray-500 mb-1">
                  Phase 1 Progress (
                  {Object.values(phase1Checkpoints).filter(Boolean).length}/15)
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{
                      width: `${
                        (Object.values(phase1Checkpoints).filter(Boolean)
                          .length /
                          15) *
                        100
                      }%`,
                    }}
                  ></div>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <div className="mt-6 text-center space-x-4">
            <button
              onClick={() => router.push("/")}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium"
            >
              Go Home
            </button>
            <button
              onClick={() => router.push("/text-chat")}
              className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md text-sm font-medium"
            >
              Text Chat
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
