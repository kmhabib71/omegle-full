"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { VideoChatControls } from "./video-chat-controls";
import { useSocket } from "@/hooks/useSocket";
import { Button } from "@/components/ui/button";
import { Phone, PhoneOff, MessageCircle, MoreHorizontal } from "lucide-react";

interface EnhancedVideoChatProps {
  onEndCall?: () => void;
  onMessageToggle?: () => void;
  sessionId?: string;
  isIncoming?: boolean;
  remoteUserName?: string;
}

export function EnhancedVideoChat({
  onEndCall,
  onMessageToggle,
  sessionId,
  isIncoming = false,
  remoteUserName = "Anonymous User",
}: EnhancedVideoChatProps) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isCallActive, setIsCallActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [voiceActivated, setVoiceActivated] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [micEnabled, setMicEnabled] = useState(true);
  const [isPushToTalkMode, setIsPushToTalkMode] = useState(false);
  const [isAudioLevelActive, setIsAudioLevelActive] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const callTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const microphoneRef = useRef<MediaStreamAudioSourceNode | null>(null);

  const { sendSignal, on } = useSocket();

  // Initialize WebRTC peer connection
  const initializePeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ],
    });

    pc.onicecandidate = (event) => {
      if (event.candidate && sessionId) {
        sendSignal({
          to: sessionId,
          signal: { type: "ice-candidate", candidate: event.candidate },
        });
      }
    };

    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      setRemoteStream(remoteStream);
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
      }
    };

    pc.onconnectionstatechange = () => {
      console.log("Connection state:", pc.connectionState);
      if (pc.connectionState === "connected") {
        setIsCallActive(true);
        setIsConnecting(false);
        startCallTimer();
      } else if (
        pc.connectionState === "disconnected" ||
        pc.connectionState === "failed"
      ) {
        handleEndCall();
      }
    };

    peerConnectionRef.current = pc;
    return pc;
  }, [sessionId, sendSignal]);

  // Setup local media stream
  const setupLocalStream = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: cameraEnabled,
        audio: micEnabled,
      });

      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Setup audio analysis for voice activation
      if (voiceActivated && stream.getAudioTracks().length > 0) {
        setupAudioAnalysis(stream);
      }

      return stream;
    } catch (error) {
      console.error("Error accessing media devices:", error);
      return null;
    }
  }, [cameraEnabled, micEnabled, voiceActivated]);

  // Setup audio analysis for voice activation
  const setupAudioAnalysis = useCallback(
    (stream: MediaStream) => {
      try {
        audioContextRef.current = new (window.AudioContext ||
          (window as any).webkitAudioContext)();
        analyserRef.current = audioContextRef.current.createAnalyser();
        microphoneRef.current =
          audioContextRef.current.createMediaStreamSource(stream);

        microphoneRef.current.connect(analyserRef.current);
        analyserRef.current.fftSize = 256;

        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        const threshold = 100; // Adjust this value based on sensitivity

        const checkAudioLevel = () => {
          if (analyserRef.current) {
            analyserRef.current.getByteFrequencyData(dataArray);
            const average =
              dataArray.reduce((sum, value) => sum + value, 0) /
              dataArray.length;

            setIsAudioLevelActive(average > threshold);

            if (voiceActivated) {
              requestAnimationFrame(checkAudioLevel);
            }
          }
        };

        checkAudioLevel();
      } catch (error) {
        console.error("Error setting up audio analysis:", error);
      }
    },
    [voiceActivated]
  );

  // Start call timer
  const startCallTimer = useCallback(() => {
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
    }

    callTimerRef.current = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);
  }, []);

  // Format call duration
  const formatDuration = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  }, []);

  // Handle voice activation toggle
  const handleVoiceActivationToggle = useCallback(
    (enabled: boolean) => {
      setVoiceActivated(enabled);
      setIsPushToTalkMode(!enabled);

      if (enabled && localStream) {
        setupAudioAnalysis(localStream);
      } else {
        setIsAudioLevelActive(false);
        if (audioContextRef.current) {
          audioContextRef.current.close();
          audioContextRef.current = null;
        }
      }
    },
    [localStream, setupAudioAnalysis]
  );

  // Handle camera toggle
  const handleCameraToggle = useCallback(
    (enabled: boolean) => {
      setCameraEnabled(enabled);

      if (localStream) {
        const videoTrack = localStream.getVideoTracks()[0];
        if (videoTrack) {
          videoTrack.enabled = enabled;
        }
      }
    },
    [localStream]
  );

  // Handle microphone toggle
  const handleMicToggle = useCallback(
    (enabled: boolean) => {
      setMicEnabled(enabled);

      if (localStream) {
        const audioTrack = localStream.getAudioTracks()[0];
        if (audioTrack) {
          audioTrack.enabled = enabled;
        }
      }
    },
    [localStream]
  );

  // Handle push-to-talk start
  const handlePushToTalkStart = useCallback(() => {
    if (localStream && isPushToTalkMode) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = true;
      }
    }
  }, [localStream, isPushToTalkMode]);

  // Handle push-to-talk end
  const handlePushToTalkEnd = useCallback(() => {
    if (localStream && isPushToTalkMode) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = false;
      }
    }
  }, [localStream, isPushToTalkMode]);

  // Handle end call
  const handleEndCall = useCallback(() => {
    // Stop call timer
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }

    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    // Stop local stream
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
      setLocalStream(null);
    }

    // Clean up audio context
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    setIsCallActive(false);
    setIsConnecting(false);
    setCallDuration(0);
    setRemoteStream(null);

    onEndCall?.();
  }, [localStream, onEndCall]);

  // Initialize components
  useEffect(() => {
    setupLocalStream();
    initializePeerConnection();

    return () => {
      handleEndCall();
    };
  }, []);

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden">
      {/* Remote Video */}
      <div className="absolute inset-0">
        {remoteStream ? (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-900">
            <div className="text-center">
              <div className="w-32 h-32 bg-gray-700 rounded-full flex items-center justify-center mb-4 mx-auto">
                <span className="text-4xl text-gray-400">
                  {remoteUserName.charAt(0).toUpperCase()}
                </span>
              </div>
              <p className="text-white text-lg">{remoteUserName}</p>
              <p className="text-gray-400">
                {isConnecting ? "Connecting..." : "Waiting for connection..."}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Local Video (Picture-in-Picture) */}
      <div className="absolute top-4 right-4 w-32 h-24 bg-gray-800 rounded-lg overflow-hidden shadow-lg border-2 border-white/20">
        {localStream && cameraEnabled ? (
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-700">
            <span className="text-white text-sm">Camera Off</span>
          </div>
        )}
        {isAudioLevelActive && (
          <div className="absolute bottom-1 right-1 w-2 h-2 bg-green-400 rounded-full animate-pulse" />
        )}
      </div>

      {/* Call Info */}
      <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-sm rounded-lg px-4 py-2">
        <p className="text-white font-medium">{remoteUserName}</p>
        {isCallActive && (
          <p className="text-green-400 text-sm">
            {formatDuration(callDuration)}
          </p>
        )}
        {isConnecting && (
          <p className="text-yellow-400 text-sm">Connecting...</p>
        )}
      </div>

      {/* Video Chat Controls */}
      <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2">
        <VideoChatControls
          onVoiceActivationToggle={handleVoiceActivationToggle}
          onCameraToggle={handleCameraToggle}
          onMicToggle={handleMicToggle}
          onPushToTalkStart={handlePushToTalkStart}
          onPushToTalkEnd={handlePushToTalkEnd}
          initialVoiceActivation={voiceActivated}
          initialCameraEnabled={cameraEnabled}
          initialMicEnabled={micEnabled}
        />
      </div>

      {/* Call Action Buttons */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-4">
        <Button
          onClick={onMessageToggle}
          className="w-12 h-12 rounded-full bg-blue-500 hover:bg-blue-600 flex items-center justify-center"
          title="Toggle Chat"
        >
          <MessageCircle size={20} />
        </Button>

        <Button
          onClick={handleEndCall}
          className="w-12 h-12 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center"
          title="End Call"
        >
          <PhoneOff size={20} />
        </Button>

        <Button
          className="w-12 h-12 rounded-full bg-gray-600 hover:bg-gray-700 flex items-center justify-center"
          title="More Options"
        >
          <MoreHorizontal size={20} />
        </Button>
      </div>

      {/* Voice Activation Indicator */}
      {voiceActivated && isAudioLevelActive && (
        <div className="absolute top-1/2 left-4 transform -translate-y-1/2">
          <div className="flex flex-col items-center space-y-2">
            <div className="w-1 h-8 bg-green-400 rounded-full animate-pulse" />
            <div
              className="w-1 h-12 bg-green-400 rounded-full animate-pulse"
              style={{ animationDelay: "0.1s" }}
            />
            <div
              className="w-1 h-6 bg-green-400 rounded-full animate-pulse"
              style={{ animationDelay: "0.2s" }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
