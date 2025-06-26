"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSocket } from "@/hooks/useSocket";
import { Button } from "@/components/ui/button";
import { VideoChatControls } from "./video-chat-controls";
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  PhoneOff,
  MessageCircle,
  UserCircle,
  Phone,
} from "lucide-react";

interface VoiceChatProps {
  onEndCall?: () => void;
  onMessageToggle?: () => void;
  sessionId?: string;
  isIncoming?: boolean;
  remoteUserName?: string;
}

export function VoiceChat({
  onEndCall,
  onMessageToggle,
  sessionId,
  isIncoming = false,
  remoteUserName = "Anonymous User",
}: VoiceChatProps) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isCallActive, setIsCallActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [voiceActivated, setVoiceActivated] = useState(false);
  const [micEnabled, setMicEnabled] = useState(true);
  const [speakerEnabled, setSpeakerEnabled] = useState(true);
  const [isPushToTalkMode, setIsPushToTalkMode] = useState(false);
  const [isAudioLevelActive, setIsAudioLevelActive] = useState(false);
  const [isPushToTalkActive, setIsPushToTalkActive] = useState(false);
  const [isHoldingT, setIsHoldingT] = useState(false);

  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const callTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const microphoneRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const pushToTalkRef = useRef<boolean>(false);

  const { sendSignal, on } = useSocket();

  // Handle keyboard events for push-to-talk
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "t" && !event.repeat) {
        setIsHoldingT(true);
        setIsPushToTalkActive(true);
        pushToTalkRef.current = true;
        handlePushToTalkStart();
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "t") {
        setIsHoldingT(false);
        setIsPushToTalkActive(false);
        pushToTalkRef.current = false;
        handlePushToTalkEnd();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

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
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = remoteStream;
      }
    };

    pc.onconnectionstatechange = () => {
      console.log("Connection state:", pc.connectionState);
      if (pc.connectionState === "connected") {
        setIsCallActive(true);
        setIsConnecting(false);
        startCallTimer();

        // Auto-enable microphone transmission when connected
        setMicEnabled(true);

        // Ensure local stream audio track is enabled
        if (localStream) {
          const audioTrack = localStream.getAudioTracks()[0];
          if (audioTrack) {
            audioTrack.enabled = true;
          }
        }
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

  // Setup local audio stream
  const setupLocalStream = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      setLocalStream(stream);

      // Setup audio analysis for voice activation
      if (voiceActivated && stream.getAudioTracks().length > 0) {
        setupAudioAnalysis(stream);
      }

      return stream;
    } catch (error) {
      console.error("Error accessing microphone:", error);
      return null;
    }
  }, [voiceActivated]);

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
          if (analyserRef.current && voiceActivated) {
            analyserRef.current.getByteFrequencyData(dataArray);
            const average =
              dataArray.reduce((sum, value) => sum + value, 0) /
              dataArray.length;

            setIsAudioLevelActive(average > threshold);
            requestAnimationFrame(checkAudioLevel);
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
  const handleVoiceActivationToggle = useCallback(() => {
    const newState = !voiceActivated;
    setVoiceActivated(newState);
    setIsPushToTalkMode(!newState);

    if (newState && localStream) {
      setupAudioAnalysis(localStream);
    } else {
      setIsAudioLevelActive(false);
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
    }
  }, [voiceActivated, localStream, setupAudioAnalysis]);

  // Handle microphone toggle
  const handleMicToggle = useCallback(() => {
    const newState = !micEnabled;
    setMicEnabled(newState);

    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = newState;
      }
    }
  }, [micEnabled, localStream]);

  // Handle speaker toggle
  const handleSpeakerToggle = useCallback(() => {
    const newState = !speakerEnabled;
    setSpeakerEnabled(newState);

    if (remoteAudioRef.current) {
      remoteAudioRef.current.muted = !newState;
    }
  }, [speakerEnabled]);

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

  // Handle mouse-based push-to-talk
  const handlePushToTalkMouseDown = useCallback(() => {
    if (!pushToTalkRef.current) {
      setIsPushToTalkActive(true);
      pushToTalkRef.current = true;
      handlePushToTalkStart();
    }
  }, [handlePushToTalkStart]);

  const handlePushToTalkMouseUp = useCallback(() => {
    if (pushToTalkRef.current && !isHoldingT) {
      setIsPushToTalkActive(false);
      pushToTalkRef.current = false;
      handlePushToTalkEnd();
    }
  }, [handlePushToTalkEnd, isHoldingT]);

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
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 p-4">
      {/* Remote Audio */}
      <audio ref={remoteAudioRef} autoPlay />

      {/* User Avatar and Info */}
      <div className="text-center mb-8">
        <div className="relative mb-6">
          <div className="w-40 h-40 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-2xl">
            {remoteStream ? (
              <div className="w-36 h-36 bg-green-500 rounded-full flex items-center justify-center animate-pulse">
                <UserCircle size={80} className="text-white" />
              </div>
            ) : (
              <UserCircle size={80} className="text-white" />
            )}
          </div>

          {/* Voice Level Indicator */}
          {isAudioLevelActive && (
            <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2">
              <div className="flex space-x-1">
                <div className="w-2 h-6 bg-green-400 rounded-full animate-pulse" />
                <div
                  className="w-2 h-8 bg-green-400 rounded-full animate-pulse"
                  style={{ animationDelay: "0.1s" }}
                />
                <div
                  className="w-2 h-4 bg-green-400 rounded-full animate-pulse"
                  style={{ animationDelay: "0.2s" }}
                />
              </div>
            </div>
          )}
        </div>

        <h2 className="text-3xl font-bold text-white mb-2">{remoteUserName}</h2>

        {isCallActive && (
          <div className="bg-black/30 backdrop-blur-sm rounded-full px-4 py-2 inline-block">
            <p className="text-green-400 text-lg font-mono">
              {formatDuration(callDuration)}
            </p>
          </div>
        )}

        {isConnecting && (
          <p className="text-yellow-400 text-lg animate-pulse">Connecting...</p>
        )}

        {!isCallActive && !isConnecting && (
          <p className="text-gray-400">Waiting for connection...</p>
        )}
      </div>

      {/* Voice Controls */}
      <div className="flex items-center justify-center gap-6 mb-8">
        <VideoChatControls
          onVoiceActivationToggle={handleVoiceActivationToggle}
          onCameraToggle={() => {}} // No camera in voice chat, so empty function
          onMicToggle={handleMicToggle}
          onPushToTalkStart={handlePushToTalkStart}
          onPushToTalkEnd={handlePushToTalkEnd}
          initialVoiceActivation={voiceActivated}
          initialCameraEnabled={false} // No camera in voice chat
          initialMicEnabled={micEnabled}
        />
      </div>

      {/* Call Action Buttons */}
      <div className="flex gap-6">
        <Button
          onClick={onMessageToggle}
          className="w-14 h-14 rounded-full bg-blue-500 hover:bg-blue-600 flex items-center justify-center shadow-lg"
          title="Toggle Chat"
        >
          <MessageCircle size={24} />
        </Button>

        <Button
          onClick={handleEndCall}
          className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-lg"
          title="End Call"
        >
          <PhoneOff size={24} />
        </Button>
      </div>

      {/* Audio Level Visualization (when voice activated) */}
      {voiceActivated && (
        <div className="fixed bottom-8 left-8">
          <div className="flex items-end space-x-1 h-16">
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className={`w-2 bg-green-400 rounded-full transition-all duration-150 ${
                  isAudioLevelActive
                    ? `h-${Math.floor(Math.random() * 12) + 4}`
                    : "h-2"
                }`}
                style={{
                  animationDelay: `${i * 0.1}s`,
                  height: isAudioLevelActive
                    ? `${Math.floor(Math.random() * 40) + 8}px`
                    : "8px",
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
