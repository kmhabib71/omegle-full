"use client";

import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { io, Socket } from "socket.io-client";
import SimplePeer from "simple-peer";
import { PhaseOneDebugger } from "@/components/PhaseOneDebugger";
import { PhaseTwoDebugger } from "@/components/PhaseTwoDebugger";
import { PhaseThreeDebugger } from "@/components/PhaseThreeDebugger";

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
  queue: "not_in_queue" | "searching" | "matched" | "connected" | "error";
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

export default function VideoChatSimplePeer({ session }: VideoChatProps) {
  const router = useRouter();

  // Socket and SimplePeer refs
  const socketRef = useRef<Socket | null>(null);
  const peerRef = useRef<SimplePeer.Instance | null>(null);
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
  const [showStopButton, setShowStopButton] = useState(false);
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isConnectedToPartner, setIsConnectedToPartner] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isInitiator, setIsInitiator] = useState(false);
  const [showNextButton, setShowNextButton] = useState(false);
  const [messageInputEnabled, setMessageInputEnabled] = useState(false);

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

  // Phase 1: Socket Connection Validation
  const initializeSocketConnection = async () => {
    try {
      console.log("🔌 Initializing socket connection...");
      setConnectionState((prev) => ({ ...prev, socket: "connecting" }));

      if (typeof window === "undefined") return;

      socketRef.current = io(
        process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001",
        {
          transports: ["websocket", "polling"],
          timeout: 5000,
          retries: 3,
        }
      );

      socketRef.current.on("connect", () => {
        console.log("✅ Socket connected:", socketRef.current?.id);
        setConnectionState((prev) => ({ ...prev, socket: "connected" }));
        setPhase1Checkpoints((prev) => ({
          ...prev,
          socketConnection: true,
          networkConnectivity: true,
        }));
        updateStartButtonState();
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
        handlePartnerDisconnect();
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

      setupPartnerListeners();
    } catch (error) {
      console.error("❌ Socket initialization error:", error);
      setConnectionState((prev) => ({ ...prev, socket: "error" }));
    }
  };

  const initializeSimplePeer = () => {
    console.log("🔗 Initializing SimplePeer...");
    setConnectionState((prev) => ({ ...prev, webrtc: "initialized" }));
    setPhase1Checkpoints((prev) => ({
      ...prev,
      webrtcInitialized: true,
      connectionStateSet: true,
    }));
    updateStartButtonState();
  };

  const checkMediaDevices = async () => {
    try {
      console.log("🎥 Checking media devices...");
      setConnectionState((prev) => ({ ...prev, media: "checking" }));

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Media devices not supported");
      }

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
      }));

      setConnectionState((prev) => ({ ...prev, media: "ready" }));
      updateStartButtonState();
    } catch (error) {
      console.error("❌ Media device check failed:", error);
      setConnectionState((prev) => ({ ...prev, media: "error" }));
    }
  };

  const initializeLocalStream = async () => {
    try {
      console.log("🎥 Initializing media devices...");

      const stream = await navigator.mediaDevices.getUserMedia(
        mediaConstraints
      );
      localStreamRef.current = stream;

      setPhase1Checkpoints((prev) => ({
        ...prev,
        localStreamInitialized: true,
        mediaConstraintsSet: true,
        cameraPermission: true,
        microphonePermission: true,
      }));

      console.log("✅ Media devices initialized successfully");
      updateStartButtonState();
    } catch (error) {
      console.error("❌ Failed to initialize local stream:", error);
      setConnectionState((prev) => ({ ...prev, media: "error" }));
    }
  };

  const updateStartButtonState = () => {
    const canStart =
      connectionState.socket === "connected" &&
      connectionState.webrtc === "initialized" &&
      connectionState.media === "ready" &&
      localStreamRef.current !== null;

    setPhase1Checkpoints((prev) => ({
      ...prev,
      startButtonDisabled: !canStart,
    }));
  };

  const resetAllStates = () => {
    setIsLookingForPartner(false);
    setShowStopButton(false);
    setPartnerId(null);
    setRemoteStream(null);
    setIsConnectedToPartner(false);
    setSessionId(null);
    setIsInitiator(false);
    setShowNextButton(false);
    setMessageInputEnabled(false);
    setConnectionState((prev) => ({ ...prev, queue: "not_in_queue" }));

    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }

    clearVideoFrames();
  };

  const handleStartChat = async () => {
    try {
      console.log("🔍 Starting partner search...");

      if (connectionState.socket !== "connected") {
        console.error("❌ Socket not connected");
        return;
      }

      if (!localStreamRef.current) {
        console.error("❌ Local stream not available");
        await initializeLocalStream();
        if (!localStreamRef.current) return;
      }

      const localVideo = document.getElementById(
        "localVideo"
      ) as HTMLVideoElement;
      if (localVideo && localStreamRef.current) {
        localVideo.srcObject = localStreamRef.current;
        localVideo.style.display = "block";
        console.log("✅ Local video stream displayed");
      }

      setIsLookingForPartner(true);
      setShowStopButton(true);
      setConnectionState((prev) => ({ ...prev, queue: "searching" }));

      setPhase1Checkpoints((prev) => ({
        ...prev,
        startButtonVisible: false,
        nextButtonHidden: true,
        stopButtonHidden: false,
      }));

      socketRef.current?.emit("find-partner", [], (response: any) => {
        console.log("📨 Find-partner response:", response);
      });
    } catch (error) {
      console.error("❌ Error starting chat:", error);
      resetAllStates();
    }
  };

  const setupPartnerListeners = () => {
    if (!socketRef.current) return;

    socketRef.current.on("partner-found", (data: any) => {
      console.log("🎯 Partner found:", data);
      setPartnerId(data.partnerId);
      setSessionId(data.sessionId);
      setIsInitiator(data.isInitiator);
      setConnectionState((prev) => ({ ...prev, queue: "matched" }));

      initializePeerConnection(
        data.partnerId,
        data.sessionId,
        data.isInitiator
      );
    });

    socketRef.current.on("webrtc-signal", (data: any) => {
      console.log("📡 Received WebRTC signal:", data.signal.type);
      if (peerRef.current) {
        peerRef.current.signal(data.signal);
      }
    });
  };

  const initializePeerConnection = (
    partnerId: string,
    sessionId: string,
    isInitiator: boolean
  ) => {
    try {
      console.log(
        "🔗 Initializing SimplePeer connection, initiator:",
        isInitiator,
        "partnerId:",
        partnerId
      );

      if (!localStreamRef.current) {
        console.error("❌ No local stream available for peer connection");
        return;
      }

      peerRef.current = new SimplePeer({
        initiator: isInitiator,
        trickle: true,
        stream: localStreamRef.current,
      });

      peerRef.current.on("signal", (signal: any) => {
        console.log(
          "📤 Sending signal to partner via socket, partnerId:",
          partnerId
        );
        socketRef.current?.emit(
          "webrtc-signal",
          {
            partnerId,
            sessionId,
            signal,
            type: signal.type,
          },
          (response: any) => {
            console.log("📨 Signal acknowledgment:", response);
          }
        );
      });

      peerRef.current.on("connect", () => {
        console.log("🎉 SimplePeer connection established!");
        setIsConnectedToPartner(true);
        setConnectionState((prev) => ({ ...prev, queue: "connected" }));
        setIsLookingForPartner(false);
        setShowNextButton(true);
        setMessageInputEnabled(true);
      });

      peerRef.current.on("stream", (stream: MediaStream) => {
        console.log("🎥 Received remote stream");
        setRemoteStream(stream);

        const remoteVideo = document.getElementById(
          "remoteVideo"
        ) as HTMLVideoElement;
        if (remoteVideo) {
          remoteVideo.srcObject = stream;
          remoteVideo.style.display = "block";
          console.log("✅ Remote video stream displayed");
        }
      });

      peerRef.current.on("error", (error: any) => {
        console.error("❌ SimplePeer error:", error);
        handlePartnerDisconnect();
      });

      peerRef.current.on("close", () => {
        console.log("❌ SimplePeer connection closed");
        handlePartnerDisconnect();
      });
    } catch (error) {
      console.error("❌ Error initializing peer connection:", error);
      handlePartnerDisconnect();
    }
  };

  const handlePartnerDisconnect = () => {
    console.log("🔄 Handling partner disconnect");

    setIsConnectedToPartner(false);
    setIsLookingForPartner(false);
    setShowStopButton(false);
    setShowNextButton(false);
    setMessageInputEnabled(false);
    setPartnerId(null);
    setSessionId(null);
    setRemoteStream(null);
    setConnectionState((prev) => ({ ...prev, queue: "not_in_queue" }));

    setPhase1Checkpoints((prev) => ({
      ...prev,
      startButtonVisible: true,
      nextButtonHidden: true,
      stopButtonHidden: true,
    }));

    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }

    clearVideoFrames();
  };

  const handleStopChat = () => {
    console.log("🛑 Stopping chat");

    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }

    if (socketRef.current && isLookingForPartner) {
      socketRef.current.emit("leave-queue");
    }

    resetAllStates();
  };

  const clearVideoFrames = () => {
    const localVideo = document.getElementById(
      "localVideo"
    ) as HTMLVideoElement;
    const remoteVideo = document.getElementById(
      "remoteVideo"
    ) as HTMLVideoElement;

    if (localVideo) {
      localVideo.style.display = "none";
      localVideo.srcObject = null;
    }

    if (remoteVideo) {
      remoteVideo.style.display = "none";
      remoteVideo.srcObject = null;
    }

    setPhase1Checkpoints((prev) => ({
      ...prev,
      videoFramesCleared: true,
    }));
  };

  const testSocketConnection = () => {
    if (!socketRef.current) {
      console.log("❌ No socket connection to test");
      return;
    }

    console.log("🧪 Testing socket connection...");
    console.log("Socket ID:", socketRef.current.id);
    console.log("Socket connected:", socketRef.current.connected);

    socketRef.current.emit("ping", { timestamp: Date.now() });

    socketRef.current.emit("find-partner", [], (response: any) => {
      console.log("🧪 Test find-partner response:", response);
    });
  };

  const runPhase3Test = async () => {
    console.log("🧪 Running Phase 3 test...");

    if (!socketRef.current?.connected) {
      console.error("❌ Socket not connected for Phase 3 test");
      return;
    }

    if (!localStreamRef.current) {
      console.error("❌ No local stream for Phase 3 test");
      return;
    }

    console.log("✅ Phase 3 prerequisites met");
    console.log("- Socket connected:", socketRef.current.connected);
    console.log("- Local stream available:", !!localStreamRef.current);
    console.log("- SimplePeer ready:", typeof SimplePeer !== "undefined");
  };

  useEffect(() => {
    const initializePhase1 = async () => {
      console.log("🚀 Starting Phase 1 initialization...");

      await initializeSocketConnection();
      initializeSimplePeer();
      await checkMediaDevices();
      await initializeLocalStream();

      console.log("✅ Phase 1 initialization complete");
    };

    initializePhase1();

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      if (peerRef.current) {
        peerRef.current.destroy();
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-gray-900">
                🎥 Video Chat (SimplePeer)
              </h1>
              <div className="text-sm text-gray-500">
                Welcome, {session?.user?.email}
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setDebugMode(!debugMode)}
                className={`px-3 py-1 rounded text-sm font-medium ${
                  debugMode
                    ? "bg-red-100 text-red-700 hover:bg-red-200"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {debugMode ? "Hide Debug" : "Show Debug"}
              </button>
              <button
                onClick={() => signOut()}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {debugMode && (
            <>
              <PhaseOneDebugger
                connectionState={connectionState}
                mediaDeviceStatus={mediaDeviceStatus}
                checkpoints={phase1Checkpoints}
                onTestSocket={testSocketConnection}
              />

              <PhaseTwoDebugger
                connectionState={connectionState}
                isLookingForPartner={isLookingForPartner}
                showStopButton={showStopButton}
                localStream={localStreamRef.current}
              />

              <PhaseThreeDebugger
                connectionState={connectionState}
                partnerId={partnerId}
                peerConnection={peerRef.current as any}
                localStream={localStreamRef.current}
                remoteStream={remoteStream}
                isConnectedToPartner={isConnectedToPartner}
                sessionId={sessionId}
                onTestPhase3={runPhase3Test}
              />

              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h3 className="text-red-800 font-semibold mb-2">
                  🚨 DEBUG MODE
                </h3>
                <button
                  onClick={testSocketConnection}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded font-semibold"
                >
                  Test Socket Connection
                </button>
                <p className="text-sm text-red-600 mt-2">
                  Click this button and check both browser console and server
                  terminal for logs
                </p>
              </div>
            </>
          )}

          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-black rounded-lg aspect-video flex items-center justify-center relative">
                <video
                  id="localVideo"
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover rounded-lg"
                  style={{ display: "none" }}
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

              <div className="bg-gray-800 rounded-lg aspect-video flex items-center justify-center">
                <video
                  id="remoteVideo"
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover rounded-lg"
                  style={{ display: "none" }}
                />
                <div className="text-white text-center">
                  <div className="text-lg mb-2">Stranger's Video</div>
                  <div className="text-sm opacity-75">
                    Waiting for connection...
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-center space-x-4">
              {phase1Checkpoints.startButtonVisible &&
                !isConnectedToPartner && (
                  <button
                    disabled={
                      phase1Checkpoints.startButtonDisabled ||
                      isLookingForPartner
                    }
                    onClick={handleStartChat}
                    className={`px-8 py-3 rounded-lg font-semibold text-lg ${
                      phase1Checkpoints.startButtonDisabled ||
                      isLookingForPartner
                        ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                        : "bg-green-600 hover:bg-green-700 text-white"
                    }`}
                  >
                    {isLookingForPartner ? "LOOKING..." : "START"}
                  </button>
                )}

              {showNextButton && (
                <button
                  onClick={() => {
                    console.log("🔄 Finding next partner...");
                    handleStopChat();
                    setTimeout(() => handleStartChat(), 1000);
                  }}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold"
                >
                  NEXT
                </button>
              )}

              {showStopButton && (
                <button
                  onClick={handleStopChat}
                  className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold"
                >
                  STOP
                </button>
              )}
            </div>

            {messageInputEnabled && (
              <div className="mt-4 flex space-x-2">
                <input
                  type="text"
                  placeholder="Type a message..."
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      console.log("💬 Message sent:", e.currentTarget.value);
                      e.currentTarget.value = "";
                    }
                  }}
                />
                <button
                  onClick={() => console.log("💬 Send button clicked")}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold"
                >
                  Send
                </button>
              </div>
            )}

            <div className="mt-4 text-center">
              <div className="text-sm text-gray-600 mb-2">
                {isConnectedToPartner
                  ? "🎥 Video chat active with stranger"
                  : connectionState.queue === "matched"
                  ? "🔄 Establishing connection..."
                  : connectionState.queue === "searching"
                  ? "🔍 Looking for stranger..."
                  : connectionState.socket === "connected"
                  ? "🟢 Connected to server"
                  : connectionState.socket === "connecting"
                  ? "🟡 Connecting to server..."
                  : connectionState.socket === "error"
                  ? "🔴 Connection failed"
                  : "⚪ Disconnected"}
              </div>

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
            <button
              onClick={() => router.push("/simplepeer-test")}
              className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-md text-sm font-medium"
            >
              SimplePeer Test
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
