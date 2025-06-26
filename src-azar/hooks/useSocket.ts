import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { useSession } from "next-auth/react";

// Define base socket URL - fix CORS issue
const SOCKET_URL =
  process.env.NODE_ENV === "production"
    ? "https://snappair.com"
    : typeof window !== "undefined"
    ? window.location.origin
    : "http://localhost:4000";

export function useSocket() {
  const { data: session } = useSession();
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState(0);
  const socketRef = useRef<Socket | null>(null);

  // Initialize socket connection
  useEffect(() => {
    // Only connect if user is authenticated
    if (!session?.user) return;

    // Create socket instance if not exists
    if (!socketRef.current) {
      socketRef.current = io(SOCKET_URL, {
        path: "/api/socket",
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });
    }

    const socket = socketRef.current;

    // Socket event handlers
    function onConnect() {
      setIsConnected(true);
      console.log("Socket connected");

      // Register user in the socket server
      if (session?.user) {
        socket.emit("register_user", {
          userId: session?.user.id,
          username: session?.user.username || session?.user.name,
          // Add any other user properties needed
        });
      }
    }

    function onDisconnect() {
      setIsConnected(false);
      console.log("Socket disconnected");
    }

    function onOnlineUsersCount(count: number) {
      setOnlineUsers(count);
    }

    // Set up event listeners
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("online_users_count", onOnlineUsersCount);

    // Connect to socket server
    if (!socket.connected) {
      socket.connect();
    }

    // Cleanup on unmount
    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("online_users_count", onOnlineUsersCount);
    };
  }, [session]);

  // Disconnect socket when component unmounts
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  // Request a video chat match
  const requestVideoChat = useCallback(() => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit("request_video_chat");
    }
  }, [isConnected]);

  // Request a text chat match
  const requestTextChat = useCallback(() => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit("request_text_chat");
    }
  }, [isConnected]);

  // Request a voice chat match
  const requestVoiceChat = useCallback(() => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit("request_voice_chat");
    }
  }, [isConnected]);

  // Cancel video chat search
  const cancelVideoSearch = useCallback(() => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit("cancel_video_search");
    }
  }, [isConnected]);

  // Cancel text chat search
  const cancelTextSearch = useCallback(() => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit("cancel_text_search");
    }
  }, [isConnected]);

  // Cancel voice chat search
  const cancelVoiceSearch = useCallback(() => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit("cancel_voice_search");
    }
  }, [isConnected]);

  // End a video chat session
  const endVideoChat = useCallback(
    (sessionId: string) => {
      if (socketRef.current && isConnected) {
        socketRef.current.emit("end_video_chat", sessionId);
      }
    },
    [isConnected]
  );

  // End a text chat session
  const endTextChat = useCallback(
    (sessionId: string) => {
      if (socketRef.current && isConnected) {
        socketRef.current.emit("end_text_chat", sessionId);
      }
    },
    [isConnected]
  );

  // End a voice chat session
  const endVoiceChat = useCallback(
    (sessionId: string) => {
      if (socketRef.current && isConnected) {
        socketRef.current.emit("end_voice_chat", sessionId);
      }
    },
    [isConnected]
  );

  // Send WebRTC signal
  const sendSignal = useCallback(
    (data: { to: string; signal: any }) => {
      if (socketRef.current && isConnected) {
        socketRef.current.emit("signal", data);
      }
    },
    [isConnected]
  );

  // Send chat message in video session
  const sendChatMessage = useCallback(
    (sessionId: string, message: string) => {
      if (socketRef.current && isConnected) {
        socketRef.current.emit("chat_message", { sessionId, message });
      }
    },
    [isConnected]
  );

  // Send text message in text chat session
  const sendTextMessage = useCallback(
    (sessionId: string, message: string) => {
      if (socketRef.current && isConnected) {
        socketRef.current.emit("text_message", { sessionId, message });
      }
    },
    [isConnected]
  );

  // Send voice message in voice chat session
  const sendVoiceMessage = useCallback(
    (sessionId: string, message: string) => {
      if (socketRef.current && isConnected) {
        socketRef.current.emit("voice_message", { sessionId, message });
      }
    },
    [isConnected]
  );

  // Generic event listener setup
  const on = useCallback(
    (event: string, callback: (...args: any[]) => void) => {
      if (socketRef.current) {
        socketRef.current.on(event, callback);
      }
    },
    []
  );

  // Generic event listener removal
  const off = useCallback(
    (event: string, callback: (...args: any[]) => void) => {
      if (socketRef.current) {
        socketRef.current.off(event, callback);
      }
    },
    []
  );

  return {
    socket: socketRef.current,
    isConnected,
    onlineUsers,
    requestVideoChat,
    requestTextChat,
    requestVoiceChat,
    cancelVideoSearch,
    cancelTextSearch,
    cancelVoiceSearch,
    endVideoChat,
    endTextChat,
    endVoiceChat,
    sendSignal,
    sendChatMessage,
    sendTextMessage,
    sendVoiceMessage,
    on,
    off,
  };
}
