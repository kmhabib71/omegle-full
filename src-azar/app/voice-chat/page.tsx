"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { useSocket } from "@/hooks/useSocket";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

interface Message {
  id: string;
  sender: string;
  content: string;
  timestamp: Date;
  isOwn: boolean;
}

interface Stranger {
  id: string;
  name: string;
  country?: string;
  interests?: string[];
}

export default function VoiceChatPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const isOnline = useOnlineStatus();
  const {
    socket,
    isConnected,
    requestVoiceChat,
    cancelVoiceSearch,
    endVoiceChat,
    sendVoiceMessage,
    on,
    off,
  } = useSocket();

  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [message, setMessage] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [stranger, setStranger] = useState<Stranger | null>(null);
  const [connectionTime, setConnectionTime] = useState(0);
  const [translationEnabled, setTranslationEnabled] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [peerConnection, setPeerConnection] =
    useState<RTCPeerConnection | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const localAudioRef = useRef<HTMLAudioElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const sessionIdRef = useRef<string | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Redirect if not authenticated
  useEffect(() => {
    if (!session) {
      router.push("/login");
    }
  }, [session, router]);

  // Initialize WebRTC
  const initializeWebRTC = async () => {
    try {
      // Get user media (audio only)
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
      setLocalStream(stream);

      if (localAudioRef.current) {
        localAudioRef.current.srcObject = stream;
        localAudioRef.current.muted = true; // Prevent echo
      }

      // Create peer connection
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
        ],
      });

      // Add local stream to peer connection
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      // Handle remote stream
      pc.ontrack = (event) => {
        const [remoteStream] = event.streams;
        setRemoteStream(remoteStream);
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = remoteStream;
        }
      };

      setPeerConnection(pc);
      return pc;
    } catch (error) {
      console.error("Error initializing WebRTC:", error);
      alert("Could not access microphone. Please check your permissions.");
    }
  };

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  // Start timer
  const startTimer = () => {
    timerRef.current = setInterval(() => {
      setConnectionTime((prev) => prev + 1);
    }, 1000);
  };

  // Stop timer
  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  // Format duration
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Start voice chat when component mounts
  useEffect(() => {
    if (socket && isConnected && !connecting && !connected && isOnline) {
      setConnecting(true);
      requestVoiceChat();
    }
  }, [socket, isConnected, connecting, connected, requestVoiceChat, isOnline]);

  // Socket event handlers
  useEffect(() => {
    if (!socket) return;

    const handleVoiceChatMatched = async (data: {
      sessionId: string;
      peer: string;
      userData: {
        username: string;
        country?: string;
      };
      isInitiator: boolean;
    }) => {
      setSessionId(data.sessionId);
      sessionIdRef.current = data.sessionId;
      setStranger({
        id: data.peer,
        name: data.userData.username,
        country: data.userData.country,
      });
      setConnecting(false);
      setConnected(true);
      startTimer();

      // Initialize WebRTC
      const pc = await initializeWebRTC();
      if (pc && data.isInitiator) {
        // Create offer if initiator
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit("voice_signal", {
            sessionId: data.sessionId,
            signal: offer,
            type: "offer",
          });
        } catch (error) {
          console.error("Error creating offer:", error);
        }
      }

      // Forced state update with timeout
      setTimeout(() => {
        setConnecting(false);
        setConnected(true);
      }, 100);
    };

    const handleVoiceMessage = (data: {
      sessionId: string;
      message: string;
      from: string;
    }) => {
      // Only process messages for current session
      if (data.sessionId !== sessionIdRef.current) return;

      const newMessage: Message = {
        id: Date.now().toString(),
        sender: data.from,
        content: data.message,
        timestamp: new Date(),
        isOwn: false, // Messages from others
      };
      setMessages((prev) => [...prev, newMessage]);
      scrollToBottom();
    };

    const handleVoiceSignal = async (data: {
      signal: RTCSessionDescriptionInit | RTCIceCandidateInit;
      type: "offer" | "answer" | "ice-candidate";
    }) => {
      if (!peerConnection) return;

      try {
        if (data.type === "offer") {
          await peerConnection.setRemoteDescription(
            data.signal as RTCSessionDescriptionInit
          );
          const answer = await peerConnection.createAnswer();
          await peerConnection.setLocalDescription(answer);
          socket.emit("voice_signal", {
            sessionId: sessionIdRef.current,
            signal: answer,
            type: "answer",
          });
        } else if (data.type === "answer") {
          await peerConnection.setRemoteDescription(
            data.signal as RTCSessionDescriptionInit
          );
        } else if (data.type === "ice-candidate") {
          await peerConnection.addIceCandidate(
            data.signal as RTCIceCandidateInit
          );
        }
      } catch (error) {
        console.error("Error handling voice signal:", error);
      }
    };

    const handleVoiceChatEnded = () => {
      console.log("Voice chat ended");
      setConnected(false);
      setConnecting(false);
      stopTimer();

      // Clean up WebRTC
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
        setLocalStream(null);
      }
      if (peerConnection) {
        peerConnection.close();
        setPeerConnection(null);
      }

      router.push("/");
    };

    // Register event listeners
    on("voice_chat_matched", handleVoiceChatMatched);
    on("voice_message", handleVoiceMessage);
    on("voice_signal", handleVoiceSignal);
    on("voice_chat_ended", handleVoiceChatEnded);

    // Cleanup
    return () => {
      off("voice_chat_matched", handleVoiceChatMatched);
      off("voice_message", handleVoiceMessage);
      off("voice_signal", handleVoiceSignal);
      off("voice_chat_ended", handleVoiceChatEnded);
    };
  }, [socket, on, off, session, router, peerConnection, localStream]);

  // Handle ICE candidates
  useEffect(() => {
    if (!peerConnection || !socket) return;

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("voice_signal", {
          sessionId: sessionIdRef.current,
          signal: event.candidate,
          type: "ice-candidate",
        });
      }
    };
  }, [peerConnection, socket]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (connecting) {
        cancelVoiceSearch();
      }
      stopTimer();
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
      }
      if (peerConnection) {
        peerConnection.close();
      }
    };
  }, [connecting, cancelVoiceSearch, localStream, peerConnection]);

  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = isMuted;
      });
      setIsMuted(!isMuted);
    }
  };

  const handleSendMessage = () => {
    if (!message.trim() || !sessionId) return;

    const messageId = Date.now().toString();
    sendVoiceMessage(sessionId, message);

    const newMessage: Message = {
      id: messageId,
      sender: session?.user?.id || "",
      content: message,
      timestamp: new Date(),
      isOwn: true,
    };

    setMessages((prev) => [...prev, newMessage]);
    setMessage("");
    scrollToBottom();
  };

  const handleNext = () => {
    if (sessionId) {
      endVoiceChat(sessionId);
      // Create new session
      setConnected(false);
      setConnecting(true);
      setMessages([]);
      setStranger(null);
      setConnectionTime(0);
      sessionIdRef.current = null;
      stopTimer();

      // Clean up WebRTC
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
        setLocalStream(null);
      }
      if (peerConnection) {
        peerConnection.close();
        setPeerConnection(null);
      }

      // Request new voice chat
      setTimeout(() => {
        requestVoiceChat();
      }, 1000);
    }
  };

  const handleStop = () => {
    if (sessionId) {
      endVoiceChat(sessionId);
    }
    router.push("/");
  };

  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white pt-24">
      {/* Hidden audio elements */}
      <audio ref={localAudioRef} autoPlay muted />
      <audio ref={remoteAudioRef} autoPlay />

      {/* Offline Message */}
      {!isOnline && (
        <div className="fixed top-20 left-0 right-0 z-50 bg-red-600 text-white text-center py-2">
          <div className="flex items-center justify-center gap-2">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            <span>
              No internet connection. Please check your network and try again.
            </span>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto p-4 h-screen flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex-shrink-0 mb-4">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold">Voice Chat</h1>
            <div className="flex gap-2">
              <Button
                onClick={handleNext}
                variant="outline"
                className="bg-green-600 hover:bg-green-700 text-white border-green-600"
                disabled={!connected}
              >
                Next
              </Button>
              <Button
                onClick={handleStop}
                variant="outline"
                className="bg-red-600 hover:bg-red-700 text-white border-red-600"
              >
                Stop
              </Button>
            </div>
          </div>

          {/* Connection Status */}
          <div className="bg-gray-800 rounded-lg p-4 mb-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div
                  className={`w-3 h-3 rounded-full ${
                    !isOnline
                      ? "bg-red-500"
                      : connected
                      ? "bg-green-500"
                      : "bg-yellow-500"
                  }`}
                ></div>
                <span className="text-sm">
                  {!isOnline
                    ? "No internet connection"
                    : connecting && !connected
                    ? "Finding someone to chat with..."
                    : connected
                    ? "Connected"
                    : "Disconnected"}
                </span>
              </div>
              {connected && (
                <span className="text-sm text-gray-400">
                  {formatDuration(connectionTime)}
                </span>
              )}
            </div>

            {/* Stranger Info */}
            {stranger && (
              <div className="mt-2 pt-2 border-t border-gray-700">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium">Stranger from</span>
                    <span className="ml-1 text-blue-400">
                      {stranger.country || "Unknown"}
                    </span>
                  </div>
                  {stranger.interests && stranger.interests.length > 0 && (
                    <div className="flex gap-1">
                      {stranger.interests.slice(0, 3).map((interest, index) => (
                        <span
                          key={index}
                          className="text-xs bg-blue-600 px-2 py-1 rounded"
                        >
                          {interest}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Voice Controls */}
            {connected && (
              <div className="mt-2 pt-2 border-t border-gray-700">
                <div className="flex items-center justify-between">
                  <Button
                    onClick={toggleMute}
                    variant="outline"
                    size="sm"
                    className={`${
                      isMuted
                        ? "bg-red-600 hover:bg-red-700"
                        : "bg-gray-600 hover:bg-gray-700"
                    } text-white`}
                  >
                    {isMuted ? (
                      <svg
                        className="w-4 h-4"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                      </svg>
                    ) : (
                      <svg
                        className="w-4 h-4"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M12 2c1.1 0 2 .9 2 2v6c0 1.1-.9 2-2 2s-2-.9-2-2V4c0-1.1.9-2 2-2zm6 6c0 3.31-2.69 6-6 6s-6-2.69-6-6H4c0 3.52 2.61 6.43 6 6.92V21h4v-2.08c3.39-.49 6-3.4 6-6.92h-2z" />
                      </svg>
                    )}
                    {isMuted ? "Unmute" : "Mute"}
                  </Button>
                  <div className="text-sm text-gray-400">Voice chat active</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 bg-gray-800 rounded-lg mb-4 min-h-0 overflow-hidden">
          <div className="h-full overflow-y-auto p-4">
            {messages.length === 0 && connected && (
              <div className="text-center text-gray-400 py-8">
                <p>Voice chat started! You can also send text messages.</p>
                <p className="text-sm mt-2">
                  Start talking or type a message below.
                </p>
              </div>
            )}
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`mb-4 flex ${
                  msg.isOwn ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                    msg.isOwn
                      ? "bg-blue-600 text-white"
                      : "bg-gray-700 text-white"
                  }`}
                >
                  <p className="break-words">{msg.content}</p>
                  <p className="text-xs opacity-70 mt-1">
                    {msg.timestamp.toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Message Input */}
        <div className="flex-shrink-0">
          <div className="flex gap-2">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={
                connected ? "Type a message..." : "Please wait to connect..."
              }
              disabled={!connected}
              onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
              className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
            />
            <Button
              onClick={handleSendMessage}
              disabled={!connected || !message.trim()}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Send
            </Button>
            <Button
              onClick={() => setTranslationEnabled(!translationEnabled)}
              variant="outline"
              className="border-gray-600 text-gray-300 hover:bg-gray-700"
              disabled={!connected}
            >
              {translationEnabled ? "🌐" : "🌍"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
