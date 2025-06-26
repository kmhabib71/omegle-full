import { useState, useEffect, useRef, useCallback } from "react";
import { useSocket } from "./useSocket";

export interface WebRTCConfig {
  video?: boolean;
  audio?: boolean;
  echoCancellation?: boolean;
  noiseSuppression?: boolean;
  autoGainControl?: boolean;
}

export interface UseWebRTCProps {
  sessionId?: string;
  isInitiator?: boolean;
  config?: WebRTCConfig;
  onRemoteStream?: (stream: MediaStream) => void;
  onConnectionStateChange?: (state: RTCPeerConnectionState) => void;
  onError?: (error: Error) => void;
}

export function useWebRTC({
  sessionId,
  isInitiator = false,
  config = { video: true, audio: true },
  onRemoteStream,
  onConnectionStateChange,
  onError,
}: UseWebRTCProps) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [connectionState, setConnectionState] =
    useState<RTCPeerConnectionState>("new");
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const iceCandidateQueueRef = useRef<RTCIceCandidate[]>([]);

  const { sendSignal, on } = useSocket();

  // Create peer connection
  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
      ],
    });

    pc.onicecandidate = (event) => {
      if (event.candidate && sessionId) {
        sendSignal({
          to: sessionId,
          signal: {
            type: "ice-candidate",
            candidate: event.candidate,
          },
        });
      }
    };

    pc.ontrack = (event) => {
      const [stream] = event.streams;
      setRemoteStream(stream);
      onRemoteStream?.(stream);
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      setConnectionState(state);
      setIsConnected(state === "connected");
      onConnectionStateChange?.(state);

      if (state === "failed" || state === "disconnected") {
        cleanup();
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log("ICE connection state:", pc.iceConnectionState);
    };

    peerConnectionRef.current = pc;
    return pc;
  }, [sessionId, sendSignal, onRemoteStream, onConnectionStateChange]);

  // Get user media
  const getUserMedia = useCallback(async () => {
    try {
      const constraints: MediaStreamConstraints = {
        video: config.video
          ? {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              frameRate: { ideal: 30 },
            }
          : false,
        audio: config.audio
          ? {
              echoCancellation: config.echoCancellation ?? true,
              noiseSuppression: config.noiseSuppression ?? true,
              autoGainControl: config.autoGainControl ?? true,
            }
          : false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setLocalStream(stream);
      localStreamRef.current = stream;
      return stream;
    } catch (err) {
      const error =
        err instanceof Error ? err : new Error("Failed to get user media");
      setError(error);
      onError?.(error);
      return null;
    }
  }, [config, onError]);

  // Add local stream to peer connection
  const addLocalStreamToPeer = useCallback(
    (stream: MediaStream, pc: RTCPeerConnection) => {
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });
    },
    []
  );

  // Create offer
  const createOffer = useCallback(async () => {
    if (!peerConnectionRef.current || !localStreamRef.current) return;

    try {
      const pc = peerConnectionRef.current;
      addLocalStreamToPeer(localStreamRef.current, pc);

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      if (sessionId) {
        sendSignal({
          to: sessionId,
          signal: {
            type: "offer",
            offer: offer,
          },
        });
      }
    } catch (err) {
      const error =
        err instanceof Error ? err : new Error("Failed to create offer");
      setError(error);
      onError?.(error);
    }
  }, [sessionId, sendSignal, addLocalStreamToPeer, onError]);

  // Create answer
  const createAnswer = useCallback(
    async (offer: RTCSessionDescriptionInit) => {
      if (!peerConnectionRef.current || !localStreamRef.current) return;

      try {
        const pc = peerConnectionRef.current;
        addLocalStreamToPeer(localStreamRef.current, pc);

        await pc.setRemoteDescription(offer);

        // Process queued ICE candidates
        while (iceCandidateQueueRef.current.length > 0) {
          const candidate = iceCandidateQueueRef.current.shift();
          if (candidate) {
            await pc.addIceCandidate(candidate);
          }
        }

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        if (sessionId) {
          sendSignal({
            to: sessionId,
            signal: {
              type: "answer",
              answer: answer,
            },
          });
        }
      } catch (err) {
        const error =
          err instanceof Error ? err : new Error("Failed to create answer");
        setError(error);
        onError?.(error);
      }
    },
    [sessionId, sendSignal, addLocalStreamToPeer, onError]
  );

  // Handle answer
  const handleAnswer = useCallback(
    async (answer: RTCSessionDescriptionInit) => {
      if (!peerConnectionRef.current) return;

      try {
        await peerConnectionRef.current.setRemoteDescription(answer);

        // Process queued ICE candidates
        while (iceCandidateQueueRef.current.length > 0) {
          const candidate = iceCandidateQueueRef.current.shift();
          if (candidate) {
            await peerConnectionRef.current.addIceCandidate(candidate);
          }
        }
      } catch (err) {
        const error =
          err instanceof Error ? err : new Error("Failed to handle answer");
        setError(error);
        onError?.(error);
      }
    },
    [onError]
  );

  // Handle ICE candidate
  const handleIceCandidate = useCallback(async (candidate: RTCIceCandidate) => {
    if (!peerConnectionRef.current) return;

    try {
      if (peerConnectionRef.current.remoteDescription) {
        await peerConnectionRef.current.addIceCandidate(candidate);
      } else {
        // Queue the candidate until remote description is set
        iceCandidateQueueRef.current.push(candidate);
      }
    } catch (err) {
      console.error("Error handling ICE candidate:", err);
    }
  }, []);

  // Toggle video
  const toggleVideo = useCallback((enabled: boolean) => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = enabled;
      }
    }
  }, []);

  // Toggle audio
  const toggleAudio = useCallback((enabled: boolean) => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = enabled;
      }
    }
  }, []);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    setLocalStream(null);
    setRemoteStream(null);
    setConnectionState("closed");
    setIsConnected(false);
    setError(null);
  }, []);

  // Initialize WebRTC
  const initializeWebRTC = useCallback(async () => {
    try {
      createPeerConnection();
      const stream = await getUserMedia();

      if (stream && isInitiator) {
        // If we're the initiator, create an offer
        setTimeout(() => {
          createOffer();
        }, 1000); // Small delay to ensure everything is set up
      }
    } catch (err) {
      const error =
        err instanceof Error ? err : new Error("Failed to initialize WebRTC");
      setError(error);
      onError?.(error);
    }
  }, [createPeerConnection, getUserMedia, isInitiator, createOffer, onError]);

  // Socket event handlers
  useEffect(() => {
    if (!sessionId) return;

    const handleSignal = (data: any) => {
      const { signal } = data;

      switch (signal.type) {
        case "offer":
          createAnswer(signal.offer);
          break;
        case "answer":
          handleAnswer(signal.answer);
          break;
        case "ice-candidate":
          handleIceCandidate(signal.candidate);
          break;
        default:
          console.warn("Unknown signal type:", signal.type);
      }
    };

    on("signal", handleSignal);

    return () => {
      // Remove socket listeners
      // Note: This would need to be implemented in the socket hook
    };
  }, [sessionId, on, createAnswer, handleAnswer, handleIceCandidate]);

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return {
    localStream,
    remoteStream,
    connectionState,
    isConnected,
    error,
    initializeWebRTC,
    createOffer,
    createAnswer,
    handleAnswer,
    handleIceCandidate,
    toggleVideo,
    toggleAudio,
    cleanup,
  };
}
