"use client";

import { Button } from "@/components/ui/button";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useSocket } from "@/hooks/useSocket";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { MatchGenderModal } from "@/components/MatchGenderModal";
import { MatchCountryModal } from "@/components/MatchCountryModal";
import { MatchInterestModal } from "@/components/MatchInterestModal";

export function VideoChat() {
  const [activeTooltip, setActiveTooltip] = useState(true);
  const [matchPreferences, setMatchPreferences] = useState<{
    matchGender: string;
    matchCountry: string | null;
    matchInterest: string[] | null;
  }>({
    matchGender: "all",
    matchCountry: null,
    matchInterest: null,
  });

  const [isMatchGenderModalOpen, setIsMatchGenderModalOpen] = useState(false);
  const [isMatchCountryModalOpen, setIsMatchCountryModalOpen] = useState(false);
  const [isMatchInterestModalOpen, setIsMatchInterestModalOpen] =
    useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isVideoConnecting, setIsVideoConnecting] = useState(false);
  const [isTextConnecting, setIsTextConnecting] = useState(false);
  const [isVoiceConnecting, setIsVoiceConnecting] = useState(false);
  const [isVideoBlurred, setIsVideoBlurred] = useState(false);
  const [showCameraOptions, setShowCameraOptions] = useState(false);
  const [activeFilter, setActiveFilter] = useState("none");
  const blurTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const connectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  const { data: session, status } = useSession();
  const isOnline = useOnlineStatus();
  const {
    onlineUsers,
    isConnected,
    requestVideoChat,
    requestTextChat,
    requestVoiceChat,
  } = useSocket();
  const router = useRouter();

  // Initialize user's webcam for preview
  useEffect(() => {
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
      } catch (error) {
        console.error("Error accessing webcam:", error);

        // Handle specific permission errors gracefully
        if (error instanceof Error) {
          if (error.name === "NotAllowedError") {
            console.warn(
              "Camera/microphone permission denied. User can still use text chat."
            );
          } else if (error.name === "NotFoundError") {
            console.warn(
              "No camera/microphone found. User can still use text chat."
            );
          } else if (error.name === "NotReadableError") {
            console.warn(
              "Camera/microphone is already in use. User can still use text chat."
            );
          }
        }

        // Don't show alert or block the UI - let users proceed without camera
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
  }, []);

  // Load preferences from localStorage on component mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedGender = localStorage.getItem("snappairGenderFilter") || "all";
      const savedCountry =
        localStorage.getItem("snappairCountryFilter") || null;

      // Parse the saved interests JSON string or default to null
      let savedInterests = null;
      try {
        const savedInterestsStr = localStorage.getItem(
          "snappairInterestFilter"
        );
        if (savedInterestsStr) {
          savedInterests = JSON.parse(savedInterestsStr);
        }
      } catch (err) {
        console.error("Error parsing saved interests:", err);
      }

      setMatchPreferences({
        matchGender: savedGender,
        matchCountry: savedCountry,
        matchInterest: savedInterests,
      });
    }
  }, []);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
      }
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
      }
    };
  }, []);

  // Fetch user preferences from the API when session is available
  useEffect(() => {
    if (session?.user) {
      // Fetch match gender and country
      fetch("/api/users/match-preferences")
        .then((res) => res.json())
        .then((data) => {
          if (data && !data.error) {
            setMatchPreferences((prev) => ({
              ...prev,
              matchGender: data.matchGender || "all",
              matchCountry: data.matchCountry || null,
            }));

            // Save to local storage
            localStorage.setItem(
              "snappairGenderFilter",
              data.matchGender || "all"
            );
            if (data.matchCountry) {
              localStorage.setItem("snappairCountryFilter", data.matchCountry);
            } else {
              localStorage.removeItem("snappairCountryFilter");
            }
          }
        })
        .catch((error) =>
          console.error("Error fetching match preferences:", error)
        );

      // Fetch Match Game
      fetch("/api/users/match-interest")
        .then((res) => res.json())
        .then((data) => {
          if (data && !data.error) {
            setMatchPreferences((prev) => ({
              ...prev,
              matchInterest: data.matchInterest,
            }));

            // Save to local storage
            if (data.matchInterest) {
              localStorage.setItem(
                "snappairInterestFilter",
                JSON.stringify(data.matchInterest)
              );
            } else {
              localStorage.removeItem("snappairInterestFilter");
            }
          }
        })
        .catch((error) => console.error("Error fetching Match Game:", error));
    }
  }, [session]);

  const handleStartChat = () => {
    if (!session) {
      // Redirect to login if not authenticated
      router.push("/login");
      return;
    }

    // Save current preferences to the server
    saveMatchPreferencesToServer();

    // Save active filter to localStorage for use in chat page
    localStorage.setItem("snappairActiveFilter", activeFilter);

    // Set connecting state to true and apply blur
    setIsVideoConnecting(true);
    setIsVideoBlurred(true);

    // Set a timeout to initiate the connection
    connectionTimeoutRef.current = setTimeout(() => {
      // Start a video chat after 1 second delay (keeping the blur)
      requestVideoChat();

      // After 2 seconds total, start removing the blur
      blurTimeoutRef.current = setTimeout(() => {
        setIsVideoBlurred(false);
      }, 2000);

      // Navigate to chat after the delay
      router.push("/chat");
    }, 1000);
  };

  const handleStartTextChat = () => {
    if (!session) {
      // Redirect to login if not authenticated
      router.push("/login");
      return;
    }

    // Save current preferences to the server
    saveMatchPreferencesToServer();

    // Set connecting state to true
    setIsTextConnecting(true);

    // Set a timeout to initiate the connection
    connectionTimeoutRef.current = setTimeout(() => {
      // Navigate to text chat page (text chat page will handle the request)
      router.push("/text-chat");
    }, 1000);
  };

  const handleStartVoiceChat = () => {
    if (!session) {
      // Redirect to login if not authenticated
      router.push("/login");
      return;
    }

    // Save current preferences to the server
    saveMatchPreferencesToServer();

    // Set connecting state to true
    setIsVoiceConnecting(true);

    // Set a timeout to initiate the connection
    connectionTimeoutRef.current = setTimeout(() => {
      // Navigate to voice chat page (voice chat page will handle the request)
      router.push("/voice-chat");
    }, 1000);
  };

  const handleCancelConnect = () => {
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = null;
    }
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }
    setIsConnecting(false);
    setIsVideoBlurred(false);
  };

  const saveMatchPreferencesToServer = () => {
    if (session?.user) {
      // Save gender and country preferences
      fetch("/api/users/match-preferences", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          matchGender: matchPreferences.matchGender,
          matchCountry: matchPreferences.matchCountry,
        }),
      }).catch((error) =>
        console.error("Error saving match preferences:", error)
      );

      // Save interest preferences
      fetch("/api/users/match-interest", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          matchInterest: matchPreferences.matchInterest,
        }),
      }).catch((error) => console.error("Error saving Match Game:", error));
    }
  };

  const handleSaveMatchGender = (matchGender: string) => {
    setMatchPreferences((prev) => ({
      ...prev,
      matchGender,
    }));

    // Save to localStorage
    localStorage.setItem("snappairGenderFilter", matchGender);

    // Save to server if logged in - do this immediately
    if (session?.user) {
      fetch("/api/users/match-preferences", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          matchGender,
          matchCountry: matchPreferences.matchCountry,
        }),
      }).catch((error) => console.error("Error saving match gender:", error));
    }
  };

  const handleSaveMatchCountry = (matchCountry: string | null) => {
    setMatchPreferences((prev) => ({
      ...prev,
      matchCountry,
    }));

    // Save to localStorage
    if (matchCountry) {
      localStorage.setItem("snappairCountryFilter", matchCountry);
    } else {
      localStorage.removeItem("snappairCountryFilter");
    }

    // Save to server if logged in - do this immediately
    if (session?.user) {
      fetch("/api/users/match-preferences", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          matchGender: matchPreferences.matchGender,
          matchCountry,
        }),
      }).catch((error) => console.error("Error saving match country:", error));
    }
  };

  const handleSaveMatchInterest = (matchInterest: string[] | null) => {
    setMatchPreferences((prev) => ({
      ...prev,
      matchInterest,
    }));

    // Save to localStorage
    if (matchInterest) {
      localStorage.setItem(
        "snappairInterestFilter",
        JSON.stringify(matchInterest)
      );
    } else {
      localStorage.removeItem("snappairInterestFilter");
    }

    // Save to server if logged in - do this immediately
    if (session?.user) {
      fetch("/api/users/match-interest", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          matchInterest,
        }),
      }).catch((error) => console.error("Error saving Match Game:", error));
    }
  };

  // Display text helpers for preferences
  const getMatchGenderText = () => {
    switch (matchPreferences.matchGender) {
      case "male":
        return "Men";
      case "female":
        return "Women";
      default:
        return "Everyone";
    }
  };

  const getMatchCountryText = () => {
    return matchPreferences.matchCountry || "Any Country";
  };

  const getMatchInterestText = () => {
    if (
      !matchPreferences.matchInterest ||
      matchPreferences.matchInterest.length === 0
    ) {
      return "Any Game";
    }

    if (matchPreferences.matchInterest.length === 1) {
      const gameName = games.find(
        (g) => g.id === matchPreferences.matchInterest?.[0]
      )?.name;
      return gameName || matchPreferences.matchInterest[0];
    }

    return `${matchPreferences.matchInterest.length} Games`;
  };

  // List of games for display
  const games = [
    { id: "rainbow-six-siege", name: "Rainbow Six Siege" },
    { id: "league-of-legends", name: "League of Legends" },
    { id: "grand-theft-auto-v", name: "Grand Theft Auto V" },
    { id: "minecraft", name: "Minecraft" },
    { id: "fortnite", name: "Fortnite" },
    { id: "valorant", name: "Valorant" },
    { id: "counter-strike-2", name: "Counter-Strike 2" },
    { id: "call-of-duty-warzone", name: "Call of Duty: Warzone" },
    { id: "dead-by-daylight", name: "Dead by Daylight" },
    { id: "marvel-rivals", name: "Marvel Rivals" },
    { id: "apex-legends", name: "Apex Legends" },
    { id: "overwatch-2", name: "Overwatch 2" },
    { id: "roblox", name: "Roblox" },
    { id: "rocket-league", name: "Rocket League" },
    { id: "genshin-impact", name: "Genshin Impact" },
  ];

  // Apply a video filter
  const applyFilter = (filter: string) => {
    setActiveFilter(filter);
    setShowCameraOptions(false);
  };

  return (
    <div className="min-h-screen pt-16 pb-10 flex flex-col">
      {/* Offline Message */}
      {!isOnline && (
        <div className="fixed top-16 left-0 right-0 z-50 bg-red-600 text-white text-center py-2">
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

      <div className="container mx-auto px-4 flex-grow flex flex-col">
        {/* Main split screen video section */}
        <div className="flex-grow flex flex-col">
          <div className="flex flex-col lg:flex-row gap-4 h-[50vh] md:h-[55vh]">
            {/* Left Video Preview */}
            <div className="relative rounded-3xl overflow-hidden flex-1 bg-snappair-primary">
              <div className="absolute left-5 top-5 bg-black/40 rounded-full px-3 py-1 flex items-center">
                <div className="w-3 h-3 rounded-full bg-snappair-green mr-2"></div>
                <span className="text-snappair-green text-sm font-medium">
                  ONLINE
                </span>
              </div>

              {/* Camera Effects Button */}
              <div className="absolute top-5 right-5 z-10 flex gap-2">
                {/* <Button
                  className="w-10 h-10 rounded-full bg-black/40 text-white hover:bg-black/60 p-2"
                  onClick={() => setShowCameraOptions(!showCameraOptions)}
                  data-onboarding="camera-filters"
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

                {showCameraOptions && (
                  <div className="absolute top-12 right-0 bg-black/80 rounded-lg p-3 flex flex-col gap-3 w-52 z-20">
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

              {/* Left Video Overlay */}
              <div className="absolute inset-0 pointer-events-none">
                <div className="w-full h-full bg-gradient-to-b from-black/20 via-transparent to-black/40"></div>
              </div>
            </div>

            {/* Right Video Preview */}
            <div className="relative rounded-3xl overflow-hidden flex-1 bg-snappair-primary">
              <div className="absolute right-5 top-5 bg-black/40 rounded-full px-3 py-1 flex items-center">
                <div className="w-3 h-3 rounded-full bg-snappair-green mr-2"></div>
                <span className="text-snappair-green text-sm font-medium">
                  ONLINE
                </span>
              </div>

              {/* Right Video Placeholder */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-full h-full bg-gradient-to-b from-black/20 via-transparent to-black/80"></div>

                {/* People animation background */}
                <div className="absolute inset-0 overflow-hidden">
                  <div
                    className="absolute inset-0 animate-[pan_15s_linear_infinite_alternate]"
                    style={{
                      backgroundImage: "url('/people.webp')",
                      backgroundSize: "cover",
                      backgroundPosition: "center",
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

                {/* Blur overlay for transition */}
                {isVideoBlurred && (
                  <div
                    className="absolute inset-0 bg-black/50 backdrop-blur-xl transition-all duration-1000 z-10"
                    style={{
                      opacity: isVideoBlurred ? 1 : 0,
                    }}
                  />
                )}

                {/* Match buttons overlay during connecting state */}
                {isConnecting && (
                  <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/70">
                    <div className="text-white text-xl mb-6">
                      Finding a match...
                    </div>

                    <div className="flex flex-wrap justify-center gap-3 mb-6">
                      <Button
                        variant="outline"
                        className="rounded-full px-4 py-2 flex items-center justify-center gap-2 text-sm border-zinc-700 bg-zinc-800/70 hover:bg-zinc-700/80"
                        onClick={() => {
                          handleCancelConnect();
                          setIsMatchGenderModalOpen(true);
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
                        {getMatchGenderText()}
                      </Button>

                      <Button
                        variant="outline"
                        className="rounded-full px-4 py-2 flex items-center justify-center gap-2 text-sm border-zinc-700 bg-zinc-800/70 hover:bg-zinc-700/80"
                        onClick={() => {
                          handleCancelConnect();
                          setIsMatchCountryModalOpen(true);
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
                        {getMatchCountryText()}
                      </Button>

                      <Button
                        variant="outline"
                        className="rounded-full px-4 py-2 flex items-center justify-center gap-2 text-sm border-zinc-700 bg-zinc-800/70 hover:bg-zinc-700/80"
                        onClick={() => {
                          handleCancelConnect();
                          setIsMatchInterestModalOpen(true);
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
                              d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h8m-5-9v.01M12 3v.01M15 3v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                        </span>
                        {getMatchInterestText()}
                      </Button>
                    </div>

                    <Button
                      onClick={handleCancelConnect}
                      className="bg-red-600 hover:bg-red-700 text-white rounded-full px-6 py-2"
                    >
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Disclaimer */}
          {/* <div className="text-center text-xs text-gray-400 mt-3 mb-2">
            All images are of models and are used for illustrative purposes
            only.
          </div> */}

          {/* Online Counter */}
          <div className="flex items-center justify-center gap-2 my-2">
            <div className="w-2 h-2 rounded-full bg-snappair-green"></div>
            <span className="text-white">
              {onlineUsers.toLocaleString()} are matching now!
            </span>
          </div>

          {/* Match Preferences Buttons */}
          <div
            className="flex flex-wrap justify-center gap-3 mt-1 mb-4"
            data-onboarding="filters"
          >
            {/* Match Gender Button */}
            <Button
              variant="outline"
              className="rounded-full px-6 py-6 flex items-center justify-center gap-2 text-md border-zinc-700 bg-zinc-800/60 hover:bg-zinc-700/80"
              onClick={() => setIsMatchGenderModalOpen(true)}
            >
              <span className="inline-flex items-center justify-center w-6 h-6 bg-blue-500 rounded-full">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4 text-white"
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
              {getMatchGenderText()}
            </Button>

            {/* Match Country Button */}
            <Button
              variant="outline"
              className=" rounded-full px-6 py-6 flex items-center justify-center gap-2 text-md border-zinc-700 bg-zinc-800/60 hover:bg-zinc-700/80"
              onClick={() => setIsMatchCountryModalOpen(true)}
            >
              <span className="inline-flex items-center justify-center w-6 h-6 bg-green-500 rounded-full">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4 text-white"
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
              {getMatchCountryText()}
            </Button>

            {/* Select Game Button */}
            <Button
              variant="outline"
              className="rounded-full px-6 py-6 flex items-center justify-center gap-2 text-md border-zinc-700 bg-zinc-800/60 hover:bg-zinc-700/80"
              onClick={() => setIsMatchInterestModalOpen(true)}
            >
              <span className="inline-flex items-center justify-center w-6 h-6 bg-purple-500 rounded-full">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h8m-5-9v.01M12 3v.01M15 3v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </span>
              {getMatchInterestText()}
            </Button>
          </div>

          {/* Start Chat Buttons */}
          <div className="mt-2 mb-6 space-y-3">
            <Button
              onClick={handleStartChat}
              className="rounded-full w-full max-w-2xl mx-auto flex items-center justify-center gap-3 text-xl py-6 bg-white text-black hover:bg-gray-100"
              data-onboarding="start-video-chat"
              disabled={
                isVideoConnecting ||
                isTextConnecting ||
                isVoiceConnecting ||
                !isOnline
              }
            >
              {isVideoConnecting ? (
                <>
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-black"></div>
                  Connecting...
                </>
              ) : (
                <>
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
                      d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                  Start Video Chat
                </>
              )}
            </Button>

            <Button
              onClick={handleStartTextChat}
              className="rounded-full w-full max-w-2xl mx-auto flex items-center justify-center gap-3 text-xl py-6 bg-blue-600 text-white hover:bg-blue-700"
              data-onboarding="start-text-chat"
              disabled={
                isVideoConnecting ||
                isTextConnecting ||
                isVoiceConnecting ||
                !isOnline
              }
            >
              {isTextConnecting ? (
                <>
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                  Connecting...
                </>
              ) : (
                <>
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
                  Start Text Chat
                </>
              )}
            </Button>

            <Button
              onClick={handleStartVoiceChat}
              className="rounded-full w-full max-w-2xl mx-auto flex items-center justify-center gap-3 text-xl py-6 bg-green-600 text-white hover:bg-green-700"
              data-onboarding="start-voice-chat"
              disabled={
                isVideoConnecting ||
                isTextConnecting ||
                isVoiceConnecting ||
                !isOnline
              }
            >
              {isVoiceConnecting ? (
                <>
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                  Connecting...
                </>
              ) : (
                <>
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
                      d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                    />
                  </svg>
                  Start Voice Chat
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* History Button */}
      <div
        className="fixed bottom-4 right-4 md:bottom-8 md:right-8"
        data-onboarding="history"
      >
        <Button
          className="bg-zinc-800 hover:bg-zinc-700 rounded-full w-12 h-12 flex items-center justify-center"
          onClick={() => router.push("/history")}
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
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </Button>
      </div>

      {/* Match Gender Modal */}
      <MatchGenderModal
        isOpen={isMatchGenderModalOpen}
        onClose={() => setIsMatchGenderModalOpen(false)}
        onSave={handleSaveMatchGender}
        currentMatchGender={matchPreferences.matchGender}
      />

      {/* Match Country Modal */}
      <MatchCountryModal
        isOpen={isMatchCountryModalOpen}
        onClose={() => setIsMatchCountryModalOpen(false)}
        onSave={handleSaveMatchCountry}
        currentMatchCountry={matchPreferences.matchCountry}
      />

      {/* Match Game Modal */}
      <MatchInterestModal
        isOpen={isMatchInterestModalOpen}
        onClose={() => setIsMatchInterestModalOpen(false)}
        onSave={handleSaveMatchInterest}
        currentMatchInterest={matchPreferences.matchInterest}
      />
    </div>
  );
}
