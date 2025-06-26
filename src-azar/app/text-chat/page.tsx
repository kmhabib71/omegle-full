"use client";

import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { useSocket } from "@/hooks/useSocket";
import { useSession } from "next-auth/react";

interface Message {
  id: number;
  text: string;
  sender: "user" | "stranger";
  timestamp: Date;
}

export default function TextChatPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [connecting, setConnecting] = useState(true);
  const [connected, setConnected] = useState(false);
  const [chatDuration, setChatDuration] = useState(0);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [dbSessionId, setDbSessionId] = useState<string | null>(null);
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

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatDurationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const currentSessionRef = useRef<string | null>(null);
  const isConnectedRef = useRef<boolean>(false);

  const {
    socket,
    isConnected: socketConnected,
    requestTextChat,
    cancelTextSearch,
    endTextChat,
    sendTextMessage,
    on,
    off,
  } = useSocket();

  // Check authentication status
  useEffect(() => {
    console.log("Auth status check:", status, session);
    if (status === "unauthenticated") {
      console.log("User unauthenticated, redirecting to login");
      router.push("/login");
    }
  }, [status, router, session]);

  // Start looking for a text chat match when component mounts
  useEffect(() => {
    console.log("Text chat request effect:", {
      session: !!session,
      socketConnected,
      status,
    });
    if (!session || !socketConnected) {
      console.log(
        "Not requesting text chat - missing session or socket not connected"
      );
      return;
    }

    console.log("Requesting text chat...");
    setConnecting(true);
    requestTextChat();
  }, [session, socketConnected, requestTextChat, status]);

  // Socket event handlers
  useEffect(() => {
    if (!socket) return;
    console.log("Setting up socket event handlers...");

    // Handle text chat match found
    const handleTextChatMatch = async (data: {
      sessionId: string;
      peer: string;
      userData: any;
      matchCriteria?: {
        gender?: boolean;
        country?: boolean;
        interests?: string[];
      };
    }) => {
      console.log("✅ TEXT CHAT MATCH FOUND!", data);

      // Store match data immediately
      setStrangerInfo({
        ...data.userData,
        gender: data.userData?.gender,
        interests: data.userData?.interests || [],
        matchedBy: data.matchCriteria,
      });

      // Force state update to ensure UI reflects connection
      setTimeout(() => {
        setConnecting(false);
        setConnected(true);
        setSessionId(data.sessionId);
        currentSessionRef.current = data.sessionId;
        isConnectedRef.current = true;
        console.log("✅ State updated: connecting=false, connected=true");
      }, 100);

      // Start chat duration timer
      chatDurationIntervalRef.current = setInterval(() => {
        setChatDuration((prev) => prev + 1);
      }, 1000);

      // Log the text chat session to the database
      try {
        const response = await fetch("/api/text-session", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            targetId: data.peer, // Using peer socket ID as target
            targetData: {
              ...data.userData,
              matchCriteria: data.matchCriteria,
            },
          }),
        });

        if (response.ok) {
          const sessionData = await response.json();
          setDbSessionId(sessionData.id);
          console.log("Text chat session logged:", sessionData.id);
        } else {
          console.error("Failed to log text chat session");
        }
      } catch (error) {
        console.error("Error logging text chat session:", error);
      }

      console.log(`Text chat matched in session ${data.sessionId}`);
    };

    // Handle text chat ended
    const handleTextChatEnded = (data: { sessionId: string }) => {
      console.log("Text chat ended event received:", data);
      if (
        data.sessionId === currentSessionRef.current &&
        isConnectedRef.current
      ) {
        handleConnectionClosed();
      }
    };

    // Handle incoming text message
    const handleTextMessage = (data: {
      sessionId: string;
      message: string;
      from: string;
    }) => {
      console.log("Text message received:", data);
      // Only add message if it's for our current session and we're connected
      if (
        data.sessionId === currentSessionRef.current &&
        isConnectedRef.current
      ) {
        const messageObj: Message = {
          id: Date.now(),
          text: data.message,
          sender: "stranger",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, messageObj]);
        setTimeout(scrollToBottom, 50);
      }
    };

    // Set up event listeners
    console.log("🔧 Setting up text chat event listeners...");
    on("text_chat_matched", handleTextChatMatch);
    on("text_chat_ended", handleTextChatEnded);
    on("text_message", handleTextMessage);

    return () => {
      off("text_chat_matched", handleTextChatMatch);
      off("text_chat_ended", handleTextChatEnded);
      off("text_message", handleTextMessage);
    };
  }, [socket, on, off]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (chatDurationIntervalRef.current) {
        clearInterval(chatDurationIntervalRef.current);
      }
    };
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  const handleEndChat = async () => {
    if (sessionId) {
      endTextChat(sessionId);
    }

    // Update the database session with end time and final message count
    if (dbSessionId) {
      try {
        await fetch("/api/text-session", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            id: dbSessionId,
            endTime: new Date().toISOString(),
            messageCount: messages.length,
          }),
        });
      } catch (error) {
        console.error("Error updating text session:", error);
      }
    }

    handleConnectionClosed();
  };

  const handleNextChat = async () => {
    if (sessionId) {
      endTextChat(sessionId);
    }

    // Update the database session with end time and final message count
    if (dbSessionId) {
      try {
        await fetch("/api/text-session", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            id: dbSessionId,
            endTime: new Date().toISOString(),
            messageCount: messages.length,
          }),
        });
      } catch (error) {
        console.error("Error updating text session:", error);
      }
    }

    // Reset state
    setMessages([]);
    setChatDuration(0);
    setConnected(false);
    setConnecting(true);
    setSessionId(null);
    setDbSessionId(null);
    setStrangerInfo(null);
    currentSessionRef.current = null;
    isConnectedRef.current = false;

    // Clear duration timer
    if (chatDurationIntervalRef.current) {
      clearInterval(chatDurationIntervalRef.current);
    }

    // Start looking for a new match
    setTimeout(() => {
      requestTextChat();
    }, 1000);
  };

  const handleConnectionClosed = () => {
    console.log("❌ Connection closed, cleaning up...");
    setConnected(false);
    setConnecting(false);
    isConnectedRef.current = false;
    currentSessionRef.current = null;

    // Clear duration timer
    if (chatDurationIntervalRef.current) {
      clearInterval(chatDurationIntervalRef.current);
    }

    // Only redirect if we're not in the middle of connecting
    // This prevents immediate redirects when the page first loads
    console.log("Scheduling redirect to home in 3 seconds...");
    setTimeout(() => {
      // Double check we're still not connected before redirecting
      if (!isConnectedRef.current && !connecting) {
        console.log("Redirecting to home now...");
        router.push("/");
      } else {
        console.log("Not redirecting - user is connected or connecting");
      }
    }, 3000);
  };

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !sessionId || !connected) return;

    const messageObj: Message = {
      id: Date.now(),
      text: newMessage,
      sender: "user",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, messageObj]);
    sendTextMessage(sessionId, newMessage);
    setNewMessage("");
    setTimeout(scrollToBottom, 50);
  };

  const toggleTranslation = () => {
    setTranslationEnabled(!translationEnabled);
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <Header />

      <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full p-4 pt-24 max-h-screen">
        {/* Chat Header */}
        <div className="flex items-center justify-between mb-4 p-4 bg-zinc-900 rounded-lg flex-shrink-0">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div
                className={`w-3 h-3 rounded-full ${
                  connected
                    ? "bg-green-500"
                    : connecting
                    ? "bg-yellow-500"
                    : "bg-red-500"
                }`}
              ></div>
              <span className="text-sm">
                {connected
                  ? "Connected"
                  : connecting
                  ? "Connecting..."
                  : "Disconnected"}
              </span>
            </div>

            {connected && (
              <div className="text-sm text-gray-400">
                Duration: {formatTime(chatDuration)}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={toggleTranslation}
              className={`text-xs px-3 py-1 ${
                translationEnabled ? "bg-blue-600" : "bg-gray-600"
              }`}
            >
              {translationEnabled ? "Translation ON" : "Translation OFF"}
            </Button>

            {connected && (
              <>
                <Button
                  onClick={handleNextChat}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-sm"
                >
                  Next
                </Button>
                <Button
                  onClick={handleEndChat}
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 text-sm"
                >
                  End
                </Button>
              </>
            )}
          </div>
        </div>

        {connecting && !connected && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
              <p className="text-xl">Finding someone to chat with...</p>
              <p className="text-gray-400 mt-2">This might take a moment</p>
              <p className="text-xs text-gray-500 mt-2">
                Debug: connecting={connecting.toString()}, connected=
                {connected.toString()}
              </p>
            </div>
          </div>
        )}

        {connected && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Stranger Info */}
            {strangerInfo && (
              <div className="mb-4 p-3 bg-zinc-800 rounded-lg flex-shrink-0">
                <div className="flex items-center gap-4 text-sm">
                  <span>
                    You're chatting with:{" "}
                    <strong>{strangerInfo.username}</strong>
                  </span>
                  {strangerInfo.country && (
                    <span>from {strangerInfo.country}</span>
                  )}
                </div>
              </div>
            )}

            {/* Messages Container - Fixed height with scroll */}
            <div className="flex-1 bg-zinc-900 rounded-lg p-4 overflow-y-auto mb-4 flex flex-col">
              <div className="flex-1">
                <div className="space-y-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${
                        message.sender === "user"
                          ? "justify-end"
                          : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-xs px-4 py-2 rounded-lg ${
                          message.sender === "user"
                            ? "bg-blue-600 text-white"
                            : "bg-gray-600 text-white"
                        }`}
                      >
                        {translationEnabled && message.sender === "stranger" ? (
                          <div>
                            <div className="text-xs text-gray-300 mb-1">
                              Original:
                            </div>
                            <div className="text-gray-300 text-sm mb-2">
                              {message.text}
                            </div>
                            <div className="text-xs text-gray-300 mb-1">
                              Translation:
                            </div>
                            <div className="italic">
                              Translation feature will be implemented
                            </div>
                          </div>
                        ) : (
                          message.text
                        )}
                        <div className="text-xs text-gray-300 mt-1">
                          {message.timestamp.toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              </div>
            </div>

            {/* Message Input - Fixed at bottom */}
            <form onSubmit={sendMessage} className="flex gap-2 flex-shrink-0">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type your message..."
                className="flex-1 px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                disabled={!connected}
              />
              <Button
                type="submit"
                disabled={!connected || !newMessage.trim()}
                className="bg-blue-600 hover:bg-blue-700 px-6 py-2"
              >
                Send
              </Button>
            </form>
          </div>
        )}

        {!connecting && !connected && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <p className="text-xl mb-4">Chat ended</p>
              <p className="text-gray-400">
                Redirecting to home in 5 seconds...
              </p>
              <Button
                onClick={() => router.push("/")}
                className="mt-4 bg-blue-600 hover:bg-blue-700"
              >
                Go Home Now
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
