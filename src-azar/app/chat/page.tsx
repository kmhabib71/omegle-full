"use client";

import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef, useCallback } from "react";
import { useSocket } from "@/hooks/useSocket";
import { useSession } from "next-auth/react";
import SimplePeer from "simple-peer";
import { LanguageTranslator } from "@/components/language-translator";
import { VideoChatControls } from "@/components/video-chat-controls";

interface Message {
  id: number;
  text: string;
  sender: "user" | "stranger";
  timestamp: Date;
}

export default function ChatPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [connecting, setConnecting] = useState(true);
  const [connected, setConnected] = useState(false);
  const [chatDuration, setChatDuration] = useState(0);
  const [showOptions, setShowOptions] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [activeFilter, setActiveFilter] = useState("none");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [strangerInfo, setStrangerInfo] = useState<{
    username?: string;
    country?: string;
    gender?: string;
    interests?: string[];
    matchedBy?: {
      gender?: boolean;
      country?: boolean;
      interests?: string[];
    };
  } | null>(null);
  const [translationEnabled, setTranslationEnabled] = useState(false);
  const [targetLanguage, setTargetLanguage] = useState("en");

  // New video chat controls state - auto-on by default when connected
  const [voiceActivationEnabled, setVoiceActivationEnabled] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [micEnabled, setMicEnabled] = useState(true);
  const [isPushToTalkMode, setIsPushToTalkMode] = useState(false);
  const [isAudioLevelActive, setIsAudioLevelActive] = useState(false);

  // Audio analysis refs for voice activation
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const microphoneRef = useRef<MediaStreamAudioSourceNode | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerRef = useRef<SimplePeer.Instance | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  const {
    socket,
    isConnected: socketConnected,
    requestVideoChat,
    cancelVideoSearch,
    endVideoChat,
    sendSignal,
    sendChatMessage,
    on,
    off,
  } = useSocket();

  // Load saved filter settings
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedFilter = localStorage.getItem("snappairActiveFilter");
      if (savedFilter) {
        setActiveFilter(savedFilter);
      }
    }
  }, []);

  // Check authentication status
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  // Initialize user's webcam
  useEffect(() => {
    if (!session) return;

    async function setupCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });

        localStreamRef.current = stream;

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        // Setup audio analysis for voice activation if enabled
        if (voiceActivationEnabled && stream.getAudioTracks().length > 0) {
          setupAudioAnalysis(stream);
        }

        // Start looking for a match once camera is ready
        setConnecting(true);
        requestVideoChat();
      } catch (error) {
        console.error("Error accessing webcam:", error);

        // Handle specific permission errors gracefully
        if (error instanceof Error) {
          if (error.name === "NotAllowedError") {
            console.warn(
              "Camera/microphone permission denied. Continuing without media."
            );
          } else if (error.name === "NotFoundError") {
            console.warn(
              "No camera/microphone found. Continuing without media."
            );
          } else if (error.name === "NotReadableError") {
            console.warn(
              "Camera/microphone is already in use. Continuing without media."
            );
          }
        }

        // Continue with connection even without camera/mic
        setConnecting(true);
        requestVideoChat();
      }
    }

    setupCamera();

    return () => {
      // Cleanup webcam stream
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          track.stop();
        });
      }
    };
  }, [session, requestVideoChat]);

  // Socket event handlers
  useEffect(() => {
    if (!socketConnected) return;

    // Handle match found
    const handleVideoMatch = (data: {
      sessionId: string;
      peer: string;
      userData: any;
      matchCriteria?: {
        gender?: boolean;
        country?: boolean;
        interests?: string[];
      };
    }) => {
      // Only accept new connections if we're looking for one
      // This prevents getting matched with multiple users simultaneously
      if (!connecting) {
        console.log("Received match but not in connecting state, ignoring");
        return;
      }

      console.log("Video match found, setting up connection:", data);

      // Update state immediately
      setConnecting(false);
      setConnected(true);
      setSessionId(data.sessionId);

      // Auto-enable video and audio transmission when connected
      setCameraEnabled(true);
      setMicEnabled(true);

      // Ensure local stream tracks are enabled
      if (localStreamRef.current) {
        const videoTrack = localStreamRef.current.getVideoTracks()[0];
        const audioTrack = localStreamRef.current.getAudioTracks()[0];
        if (videoTrack) videoTrack.enabled = true;
        if (audioTrack) audioTrack.enabled = true;
      }

      // Store match data including match criteria if available
      setStrangerInfo({
        ...data.userData,
        gender: data.userData?.gender,
        interests: data.userData?.interests || [],
        matchedBy: data.matchCriteria,
      });

      // Only one peer should be the initiator
      // Calculate a consistent initiator based on socket IDs to prevent both being initiators
      const shouldBeInitiator = data.peer.localeCompare(socket?.id || "") > 0;

      console.log(
        `I am ${shouldBeInitiator ? "initiator" : "receiver"} in session ${
          data.sessionId
        }`
      );

      // Clean up any existing peer connection first
      if (peerRef.current) {
        try {
          peerRef.current.destroy();
        } catch (error) {
          console.log("Error destroying previous peer:", error);
        }
        peerRef.current = null;
      }

      // Wait a bit to ensure clean state before creating new peer
      setTimeout(() => {
        // Initialize WebRTC peer connection with proper configuration
        const peer = new SimplePeer({
          initiator: shouldBeInitiator,
          trickle: true, // Enable trickle ICE for better connectivity
          stream: localStreamRef.current || undefined,
          config: {
            iceServers: [
              { urls: "stun:stun.l.google.com:19302" },
              { urls: "stun:stun1.l.google.com:19302" },
              { urls: "stun:stun2.l.google.com:19302" },
            ],
          },
        });

        // Send signal to the other peer when ready
        peer.on("signal", (signal) => {
          console.log(`Sending ${signal.type || "unknown"} signal to peer`);
          sendSignal({ to: data.peer, signal });
        });

        // Handle incoming video stream with immediate display
        peer.on("stream", (stream) => {
          console.log("Received remote stream:", stream);
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = stream;
            // Ensure video plays
            remoteVideoRef.current.play().catch((error) => {
              console.log(
                "Auto-play prevented, user interaction required:",
                error
              );
            });
          }
        });

        // Handle connection state changes
        peer.on("connect", () => {
          console.log("Peer connection established!");
          setConnected(true);
        });

        // Handle connection closed
        peer.on("close", () => {
          console.log("Peer connection closed");
          handleConnectionClosed();
        });

        // Handle errors with better error handling
        peer.on("error", (err) => {
          console.error("Peer connection error:", err);
          // Don't immediately close on errors, give it time to recover
          setTimeout(() => {
            if (peerRef.current && peerRef.current.destroyed) {
              handleConnectionClosed();
            }
          }, 3000);
        });

        peerRef.current = peer;
      }, 100);

      // Store the session ID
      setSessionId(data.sessionId);

      // Log the video chat session to the database with more details
      if (session?.user) {
        fetch("/api/video-session", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            targetId: data.userData.id || "unknown",
            targetData: {
              name: data.userData.name,
              username: data.userData.username,
              country: data.userData.country,
              gender: data.userData.gender,
              image: data.userData.image,
              matchCriteria: data.matchCriteria,
            },
          }),
        })
          .then((response) => response.json())
          .then((data) => {
            // Store the DB session ID for later updates
            if (data && data.id) {
              localStorage.setItem("currentVideoSessionId", data.id);
            }
          })
          .catch((error) => console.error("Error logging session:", error));
      }
    };

    // Handle incoming signal data for WebRTC
    const handleSignal = (data: { from: string; signal: any }) => {
      console.log(`Received ${data.signal.type || "unknown"} signal from peer`);

      // Accept signals when connected or connecting
      if (!connecting && !connected) {
        console.log(
          "Ignoring signal as we're not in a valid state to receive it"
        );
        return;
      }

      // If we're receiving an offer but don't have a peer, create one as non-initiator
      if (data.signal.type === "offer" && !peerRef.current) {
        console.log("Creating new peer as receiver for incoming offer");

        const newPeer = new SimplePeer({
          initiator: false,
          trickle: true, // Enable trickle ICE
          stream: localStreamRef.current || undefined,
          config: {
            iceServers: [
              { urls: "stun:stun.l.google.com:19302" },
              { urls: "stun:stun1.l.google.com:19302" },
              { urls: "stun:stun2.l.google.com:19302" },
            ],
          },
        });

        // Set up event handlers
        newPeer.on("signal", (signal) => {
          console.log(`Sending ${signal.type || "unknown"} signal to peer`);
          sendSignal({ to: data.from, signal });
        });

        newPeer.on("stream", (stream) => {
          console.log("Received remote stream in signal handler:", stream);
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = stream;
            // Ensure video plays
            remoteVideoRef.current.play().catch((error) => {
              console.log(
                "Auto-play prevented, user interaction required:",
                error
              );
            });
          }
        });

        newPeer.on("connect", () => {
          console.log("Peer connection established in signal handler!");
          setConnected(true);
        });

        newPeer.on("close", () => {
          console.log("Peer connection closed in signal handler");
          handleConnectionClosed();
        });

        newPeer.on("error", (err) => {
          console.error("Peer connection error in signal handler:", err);
          // Don't immediately close on errors, give it time to recover
          setTimeout(() => {
            if (newPeer.destroyed) {
              handleConnectionClosed();
            }
          }, 3000);
        });

        peerRef.current = newPeer;

        // Apply the signal to the new peer
        try {
          peerRef.current.signal(data.signal);
        } catch (error) {
          console.error("Error processing signal on new peer:", error);
        }
      }
      // If we already have a peer, apply the signal
      else if (peerRef.current && !peerRef.current.destroyed) {
        try {
          peerRef.current.signal(data.signal);
        } catch (error) {
          console.error("Error processing signal:", error);

          // If signal processing fails, don't immediately destroy
          // Some errors are recoverable
          if (error.message && error.message.includes("connection is closed")) {
            console.log("Connection closed, cleaning up");
            handleConnectionClosed();
          }
        }
      } else {
        console.log("No valid peer to handle signal, peer destroyed or null");
      }
    };

    // Handle when the other person ends the chat
    const handleChatEnded = (data: { sessionId: string }) => {
      if (sessionId === data.sessionId) {
        handleConnectionClosed();
      }
    };

    // Handle incoming chat messages
    const handleChatMessage = (data: {
      sessionId: string;
      message: string;
      from: string;
    }) => {
      if (sessionId === data.sessionId) {
        const strangerMessage: Message = {
          id: Date.now(),
          text: data.message,
          sender: "stranger",
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, strangerMessage]);
      }
    };

    // Register event listeners
    on("video_chat_matched", handleVideoMatch);
    on("signal", handleSignal);
    on("chat_ended", handleChatEnded);
    on("chat_message", handleChatMessage);

    // Cleanup
    return () => {
      off("video_chat_matched", handleVideoMatch);
      off("signal", handleSignal);
      off("chat_ended", handleChatEnded);
      off("chat_message", handleChatMessage);
    };
  }, [
    socketConnected,
    session,
    sendSignal,
    on,
    off,
    sessionId,
    endVideoChat,
    connecting,
    connected,
  ]);

  // Update chat duration timer
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (connected) {
      interval = setInterval(() => {
        setChatDuration((prev) => prev + 1);
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [connected]);

  // Scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, showChat]);

  // Format seconds to mm:ss
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  // Handle ending the chat
  const handleEndChat = () => {
    if (sessionId) {
      endVideoChat(sessionId);

      // Update the video session in the database
      const videoSessionId = localStorage.getItem("currentVideoSessionId");
      if (videoSessionId && session?.user) {
        fetch("/api/video-session", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            id: videoSessionId,
            endTime: new Date(),
            messageCount: messages.length,
          }),
        }).catch((error) =>
          console.error("Error updating video session:", error)
        );

        // Clear the stored session ID
        localStorage.removeItem("currentVideoSessionId");
      }
    }

    handleConnectionClosed();
    router.push("/");
  };

  // Handle finding a new chat partner
  const handleNextChat = () => {
    // Prevent multiple rapid clicks
    if (connecting) {
      console.log("Already looking for a new match, ignoring request");
      return;
    }

    // First, clean up existing connection state
    setConnecting(true);

    // End the current session on the server if it exists
    if (sessionId) {
      console.log(`Ending session ${sessionId} before finding new match`);
      endVideoChat(sessionId);

      // Reset session ID immediately to prevent race conditions
      setSessionId(null);
    }

    // Clean up the peer connection
    if (peerRef.current) {
      try {
        // Make sure to close any tracks first
        if (
          remoteVideoRef.current &&
          remoteVideoRef.current.srcObject instanceof MediaStream
        ) {
          const remoteTracks = (
            remoteVideoRef.current.srcObject as MediaStream
          ).getTracks();
          remoteTracks.forEach((track) => {
            track.stop();
          });
        }

        // Then destroy the peer connection
        peerRef.current.destroy();
        peerRef.current = null;
      } catch (error) {
        console.error("Error destroying peer connection:", error);
      }
    }

    // Clear remote video display
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }

    // Reset all session data and UI state
    setConnected(false);
    setChatDuration(0);
    setMessages([]);
    setShowChat(false);
    setStrangerInfo(null);

    // Cancel any pending search first
    cancelVideoSearch();

    // Add small delay to ensure server processes the disconnect before seeking new match
    setTimeout(() => {
      console.log("Requesting new match after cleanup");
      // Request a new match
      requestVideoChat();
    }, 1500); // Increased timeout to ensure proper cleanup
  };

  // Clean up the current connection
  const handleConnectionClosed = () => {
    console.log("Cleaning up connection...");

    // Properly destroy the peer connection
    if (peerRef.current) {
      try {
        // Make sure to close any tracks first
        if (
          remoteVideoRef.current &&
          remoteVideoRef.current.srcObject instanceof MediaStream
        ) {
          const remoteTracks = (
            remoteVideoRef.current.srcObject as MediaStream
          ).getTracks();
          remoteTracks.forEach((track) => {
            track.stop();
          });
        }

        // Then destroy the peer connection
        peerRef.current.destroy();
        peerRef.current = null;
      } catch (error) {
        console.error("Error destroying peer connection:", error);
      }
    }

    // Update connection state
    setConnected(false);
    setConnecting(false);

    // Clear remote video display
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }

    // Reset all session-related state
    setSessionId(null);
    setChatDuration(0);
    setMessages([]);
    setStrangerInfo(null);

    console.log("Connection cleanup completed");
  };

  // Send a chat message
  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (newMessage.trim() === "" || !sessionId) return;

    const userMessage: Message = {
      id: Date.now(),
      text: newMessage,
      sender: "user",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);

    // Send via socket
    sendChatMessage(sessionId, newMessage);

    // Update message count in the database
    const videoSessionId = localStorage.getItem("currentVideoSessionId");
    if (videoSessionId && session?.user) {
      const newCount = messages.length + 1; // +1 for the message we just added
      fetch("/api/video-session", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: videoSessionId,
          messageCount: newCount,
        }),
      }).catch((error) =>
        console.error("Error updating message count:", error)
      );
    }

    setNewMessage("");
  };

  // Toggle the chat panel
  const toggleChat = () => {
    setShowChat((prev) => !prev);
  };

  // Apply a video filter
  const applyFilter = (filter: string) => {
    setActiveFilter(filter);
    setShowOptions(false);
  };

  // Toggle auto-translation
  const toggleTranslation = () => {
    setTranslationEnabled(!translationEnabled);
  };

  // New video chat controls handlers
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
          if (analyserRef.current && voiceActivationEnabled) {
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
    [voiceActivationEnabled]
  );

  const handleVoiceActivationToggle = useCallback(
    (enabled: boolean) => {
      setVoiceActivationEnabled(enabled);
      setIsPushToTalkMode(!enabled);

      if (enabled && localStreamRef.current) {
        setupAudioAnalysis(localStreamRef.current);
      } else {
        setIsAudioLevelActive(false);
        if (audioContextRef.current) {
          audioContextRef.current.close();
          audioContextRef.current = null;
        }
      }
    },
    [setupAudioAnalysis]
  );

  const handleCameraToggle = useCallback((enabled: boolean) => {
    setCameraEnabled(enabled);

    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = enabled;
      }
    }
  }, []);

  const handleMicToggle = useCallback((enabled: boolean) => {
    setMicEnabled(enabled);

    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = enabled;
      }
    }
  }, []);

  const handlePushToTalkStart = useCallback(() => {
    if (localStreamRef.current && isPushToTalkMode) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = true;
      }
    }
  }, [isPushToTalkMode]);

  const handlePushToTalkEnd = useCallback(() => {
    if (localStreamRef.current && isPushToTalkMode) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = false;
      }
    }
  }, [isPushToTalkMode]);

  return (
    <main className="flex min-h-screen flex-col bg-black">
      <Header />

      <div className="h-screen pt-16 pb-10 flex flex-col">
        <div className="container mx-auto px-4 flex-grow flex flex-col">
          <div className="flex flex-col lg:flex-row gap-4 h-[75vh]">
            {/* User Video */}
            <div
              className={`relative rounded-3xl overflow-hidden flex-1 bg-snappair-primary ${
                activeFilter === "none" ? "" : "filter-effect"
              }`}
            >
              <div className="absolute left-5 top-5 z-10 bg-black/40 rounded-full px-3 py-1 flex items-center">
                <div
                  className={`w-3 h-3 rounded-full mr-2 ${
                    isAudioLevelActive && voiceActivationEnabled
                      ? "bg-green-400 animate-pulse"
                      : "bg-snappair-green"
                  }`}
                ></div>
                <span className="text-snappair-green text-sm font-medium">
                  YOU
                </span>
              </div>

              {/* Voice Activation Indicator */}
              {voiceActivationEnabled && isAudioLevelActive && (
                <div className="absolute left-5 top-16 z-10">
                  <div className="flex space-x-1">
                    <div className="w-1 h-4 bg-green-400 rounded-full animate-pulse" />
                    <div
                      className="w-1 h-6 bg-green-400 rounded-full animate-pulse"
                      style={{ animationDelay: "0.1s" }}
                    />
                    <div
                      className="w-1 h-3 bg-green-400 rounded-full animate-pulse"
                      style={{ animationDelay: "0.2s" }}
                    />
                  </div>
                </div>
              )}

              {/* Enhanced Video Chat Controls - positioned at bottom of local video */}
              {connected && (
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-20">
                  <VideoChatControls
                    onVoiceActivationToggle={handleVoiceActivationToggle}
                    onCameraToggle={handleCameraToggle}
                    onMicToggle={handleMicToggle}
                    onPushToTalkStart={handlePushToTalkStart}
                    onPushToTalkEnd={handlePushToTalkEnd}
                    initialVoiceActivation={voiceActivationEnabled}
                    initialCameraEnabled={cameraEnabled}
                    initialMicEnabled={micEnabled}
                  />
                </div>
              )}

              {/* Camera Effects Buttons */}
              <div className="absolute top-5 right-5 z-10 flex gap-2">
                {/* <Button
                  className="w-10 h-10 rounded-full bg-black/40 text-white hover:bg-black/60 p-2"
                  onClick={() => setShowOptions(!showOptions)}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z"
                      clipRule="evenodd"
                    />
                  </svg>
                </Button> */}

                {showOptions && (
                  <div className="absolute top-12 right-0 bg-black/80 rounded-lg p-3 flex flex-col gap-3 w-52">
                    <h3 className="text-white text-sm font-semibold">
                      Camera Filters
                    </h3>
                    <div className="grid grid-cols-3 gap-2">
                      {/* Filter options */}
                      <Button
                        onClick={() => applyFilter("none")}
                        className={`w-14 h-14 rounded-md p-1 ${
                          activeFilter === "none" ? "ring-2 ring-blue-400" : ""
                        }`}
                      >
                        <div className="bg-gradient-to-r from-zinc-800 to-zinc-700 w-full h-full rounded flex items-center justify-center text-xs">
                          None
                        </div>
                      </Button>
                      <Button
                        onClick={() => applyFilter("sepia")}
                        className={`w-14 h-14 rounded-md p-1 ${
                          activeFilter === "sepia" ? "ring-2 ring-blue-400" : ""
                        }`}
                      >
                        <div className="bg-gradient-to-r from-yellow-700 to-yellow-900 w-full h-full rounded flex items-center justify-center text-xs">
                          Sepia
                        </div>
                      </Button>
                      <Button
                        onClick={() => applyFilter("grayscale")}
                        className={`w-14 h-14 rounded-md p-1 ${
                          activeFilter === "grayscale"
                            ? "ring-2 ring-blue-400"
                            : ""
                        }`}
                      >
                        <div className="bg-gradient-to-r from-gray-400 to-gray-700 w-full h-full rounded flex items-center justify-center text-xs">
                          Gray
                        </div>
                      </Button>
                      <Button
                        onClick={() => applyFilter("blur")}
                        className={`w-14 h-14 rounded-md p-1 ${
                          activeFilter === "blur" ? "ring-2 ring-blue-400" : ""
                        }`}
                      >
                        <div className="bg-gradient-to-r from-blue-200 to-blue-400 w-full h-full rounded flex items-center justify-center text-xs backdrop-blur-sm">
                          Blur
                        </div>
                      </Button>
                      <Button
                        onClick={() => applyFilter("invert")}
                        className={`w-14 h-14 rounded-md p-1 ${
                          activeFilter === "invert"
                            ? "ring-2 ring-blue-400"
                            : ""
                        }`}
                      >
                        <div className="bg-gradient-to-r from-purple-400 to-indigo-500 w-full h-full rounded flex items-center justify-center text-xs">
                          Invert
                        </div>
                      </Button>
                      <Button
                        onClick={() => applyFilter("brightness")}
                        className={`w-14 h-14 rounded-md p-1 ${
                          activeFilter === "brightness"
                            ? "ring-2 ring-blue-400"
                            : ""
                        }`}
                      >
                        <div className="bg-gradient-to-r from-yellow-300 to-yellow-500 w-full h-full rounded flex items-center justify-center text-xs">
                          Bright
                        </div>
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Local video stream */}
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className={`absolute inset-0 w-full h-full object-cover ${
                  activeFilter === "sepia" ? "sepia" : ""
                } ${activeFilter === "grayscale" ? "grayscale" : ""} ${
                  activeFilter === "blur" ? "blur-sm" : ""
                } ${activeFilter === "invert" ? "invert" : ""} ${
                  activeFilter === "brightness" ? "brightness-150" : ""
                }`}
              />
            </div>

            {/* Stranger Video */}
            <div className="relative rounded-3xl overflow-hidden flex-1 bg-snappair-primary">
              <div className="absolute right-5 top-5 z-10 bg-black/40 rounded-full px-3 py-1 flex items-center">
                <div className="w-3 h-3 rounded-full bg-snappair-green mr-2"></div>
                <span className="text-snappair-green text-sm font-medium">
                  {strangerInfo?.username || "STRANGER"}
                </span>
              </div>

              {/* Country Badge */}
              {strangerInfo?.country && (
                <div className="absolute left-5 top-14 z-10 bg-black/40 rounded-lg px-3 py-1 text-white text-sm flex items-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4 mr-1"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9"
                    />
                  </svg>
                  {strangerInfo.country}
                </div>
              )}

              {/* Remote video stream */}
              {connecting ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-zinc-900">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white mb-4"></div>
                  <p className="text-xl mb-6">Finding your next match...</p>

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

                  {/* Match buttons always visible when connecting */}
                  <div className="flex flex-wrap justify-center gap-3 mb-4">
                    <Button
                      variant="outline"
                      className="rounded-full px-4 py-2 flex items-center justify-center gap-2 text-sm border-zinc-700 bg-zinc-800/70 hover:bg-zinc-700/80"
                      onClick={() => {
                        cancelVideoSearch();
                        router.push("/#gender");
                      }}
                    >
                      <span className="inline-flex items-center justify-center w-5 h-5 bg-blue-500 rounded-full">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-3 w-3 text-white"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                          />
                        </svg>
                      </span>
                      Match Gender
                    </Button>

                    <Button
                      variant="outline"
                      className="rounded-full px-4 py-2 flex items-center justify-center gap-2 text-sm border-zinc-700 bg-zinc-800/70 hover:bg-zinc-700/80"
                      onClick={() => {
                        cancelVideoSearch();
                        router.push("/#country");
                      }}
                    >
                      <span className="inline-flex items-center justify-center w-5 h-5 bg-green-500 rounded-full">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-3 w-3 text-white"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </span>
                      Match Country
                    </Button>

                    <Button
                      variant="outline"
                      className="rounded-full px-4 py-2 flex items-center justify-center gap-2 text-sm border-zinc-700 bg-zinc-800/70 hover:bg-zinc-700/80"
                      onClick={() => {
                        cancelVideoSearch();
                        router.push("/#interest");
                      }}
                    >
                      <span className="inline-flex items-center justify-center w-5 h-5 bg-purple-500 rounded-full">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-3 w-3 text-white"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 6h16M4 12h16m-7 6h7"
                          />
                        </svg>
                      </span>
                      Match Game
                    </Button>
                  </div>
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
            </div>
          </div>

          {/* Match Criteria Display */}
          {/* {connected && strangerInfo && (
            <div className="bg-zinc-800/80 rounded-xl p-3 mx-auto mb-3 max-w-lg">
              <h3 className="text-white font-medium mb-1">Matched By:</h3>
              <div className="flex flex-wrap gap-2">
                {strangerInfo.gender && (
                  <span
                    className={`${
                      strangerInfo.matchedBy?.gender
                        ? "bg-blue-500/20 text-blue-300"
                        : "bg-gray-500/20 text-gray-300"
                    } rounded-full px-3 py-1 text-sm`}
                  >
                    • Gender: {strangerInfo.gender}
                  </span>
                )}
                {strangerInfo.country && (
                  <span
                    className={`${
                      strangerInfo.matchedBy?.country
                        ? "bg-green-500/20 text-green-300"
                        : "bg-gray-500/20 text-gray-300"
                    } rounded-full px-3 py-1 text-sm`}
                  >
                    • Country: {strangerInfo.country}
                  </span>
                )}
                {strangerInfo.interests &&
                  strangerInfo.interests.length > 0 && (
                    <span
                      className={`${
                        strangerInfo.matchedBy?.interests &&
                        strangerInfo.matchedBy.interests.length > 0
                          ? "bg-purple-500/20 text-purple-300"
                          : "bg-gray-500/20 text-gray-300"
                      } rounded-full px-3 py-1 text-sm`}
                    >
                      • Interests:{" "}
                      {Array.isArray(strangerInfo.interests)
                        ? strangerInfo.interests.join(", ")
                        : strangerInfo.interests}
                    </span>
                  )}
              </div>
            </div>
          )} */}

          {/* Chat and Control Buttons */}
          <div className="flex items-center justify-center gap-3 my-4">
            <Button
              onClick={handleEndChat}
              className="rounded-full w-12 h-12 bg-red-600 hover:bg-red-700 flex items-center justify-center"
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
            </Button>

            <Button
              onClick={handleNextChat}
              className="rounded-full px-6 py-3 bg-blue-600 hover:bg-blue-700 flex items-center justify-center"
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
            </Button>

            <Button
              onClick={toggleChat}
              className={`rounded-full w-12 h-12 ${
                showChat
                  ? "bg-green-600 hover:bg-green-700"
                  : "bg-zinc-700 hover:bg-zinc-600"
              } flex items-center justify-center`}
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
            </Button>
          </div>

          {/* Chat Box (conditionally shown) */}
          {showChat && (
            <div className="absolute bottom-24 right-4 md:right-8 w-80 md:w-96 bg-zinc-800 rounded-lg shadow-lg overflow-hidden z-10">
              <div className="flex items-center justify-between bg-zinc-700 p-3">
                <h3 className="text-white font-medium">Chat</h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={toggleTranslation}
                    className={`text-xs p-1 rounded ${
                      translationEnabled
                        ? "bg-blue-600 text-white"
                        : "bg-zinc-600 text-zinc-300"
                    }`}
                  >
                    Auto-translate
                  </button>
                  <button
                    onClick={toggleChat}
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
              </div>

              <div className="h-60 overflow-y-auto p-3 bg-zinc-900">
                {messages.length === 0 ? (
                  <div className="text-center text-zinc-500 mt-10">
                    No messages yet. Say hello!
                  </div>
                ) : (
                  messages.map((message) => (
                    <div
                      key={message.id}
                      className={`mb-2 ${
                        message.sender === "user" ? "text-right" : "text-left"
                      }`}
                    >
                      <div
                        className={`inline-block rounded-lg px-3 py-2 max-w-[85%] ${
                          message.sender === "user"
                            ? "bg-blue-600 text-white"
                            : "bg-zinc-700 text-white"
                        }`}
                      >
                        {translationEnabled && message.sender === "stranger" ? (
                          <LanguageTranslator
                            originalText={message.text}
                            targetLanguage={targetLanguage}
                          />
                        ) : (
                          <p>{message.text}</p>
                        )}
                        <span className="text-xs opacity-60 block mt-1">
                          {message.timestamp.toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              <form onSubmit={sendMessage} className="p-2 bg-zinc-800">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-grow p-2 rounded bg-zinc-700 text-white placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <Button
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                    </svg>
                  </Button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
