"use client";

import { useState, useEffect, useRef } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import SimplePeerVideoChat from "@/components/SimplePeerVideoChat";
import SimplePeerVoiceChat from "@/components/SimplePeerVoiceChat";
import SimplePeerTextChat from "@/components/SimplePeerTextChat";
import UserProfileModal from "@/components/UserProfileModal";

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  // Filter states
  const [matchPreferences, setMatchPreferences] = useState({
    matchGender: "all",
    matchCountry: null as string | null,
    matchInterest: null as string[] | null,
  });

  // User profile state
  const [userProfile, setUserProfile] = useState({
    userGender: null as string | null,
    userLocation: null as string | null,
  });

  // Modal states
  const [showGenderModal, setShowGenderModal] = useState(false);
  const [showCountryModal, setShowCountryModal] = useState(false);
  const [showGameModal, setShowGameModal] = useState(false);
  const [showUserProfileModal, setShowUserProfileModal] = useState(false);

  // Connection states
  const [isVideoConnecting, setIsVideoConnecting] = useState(false);
  const [isTextConnecting, setIsTextConnecting] = useState(false);
  const [isVoiceConnecting, setIsVoiceConnecting] = useState(false);

  // Camera states
  const [showCameraOptions, setShowCameraOptions] = useState(false);
  const [activeFilter, setActiveFilter] = useState("none");

  // Chat states
  const [activeChat, setActiveChat] = useState<string | null>(null);

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

  // Load preferences from localStorage and database on component mount
  useEffect(() => {
    const loadPreferences = async () => {
      if (typeof window !== "undefined") {
        // Check if user profile exists
        const savedUserGender = localStorage.getItem("snappairUserGender");
        const savedUserLocation = localStorage.getItem("snappairUserLocation");

        if (!savedUserGender || !savedUserLocation) {
          // Show user profile modal if profile is not set
          setShowUserProfileModal(true);
        } else {
          // Load user profile from localStorage
          setUserProfile({
            userGender: savedUserGender,
            userLocation: savedUserLocation,
          });
        }

        // Load match preferences from localStorage for immediate UI update
        const savedGender =
          localStorage.getItem("snappairGenderFilter") || "all";
        const savedCountry =
          localStorage.getItem("snappairCountryFilter") || null;

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

        // If user is authenticated, sync localStorage to database and then load from database
        if (session?.user) {
          try {
            // First sync localStorage preferences to database
            await syncLocalStorageToDatabase();

            // Then load the latest preferences from database
            const response = await fetch("/api/users/match-preferences");
            if (response.ok) {
              const dbPreferences = await response.json();

              // Update state and localStorage with database values
              setMatchPreferences({
                matchGender: dbPreferences.matchGender || "all",
                matchCountry: dbPreferences.matchCountry || null,
                matchInterest: dbPreferences.matchInterest || null,
              });

              // Sync localStorage with database values
              localStorage.setItem(
                "snappairGenderFilter",
                dbPreferences.matchGender || "all"
              );

              if (dbPreferences.matchCountry) {
                localStorage.setItem(
                  "snappairCountryFilter",
                  dbPreferences.matchCountry
                );
              } else {
                localStorage.removeItem("snappairCountryFilter");
              }

              if (
                dbPreferences.matchInterest &&
                dbPreferences.matchInterest.length > 0
              ) {
                localStorage.setItem(
                  "snappairInterestFilter",
                  JSON.stringify(dbPreferences.matchInterest)
                );
              } else {
                localStorage.removeItem("snappairInterestFilter");
              }
            }

            // Also load user profile from database if authenticated
            const profileResponse = await fetch("/api/users/profile");
            if (profileResponse.ok) {
              const dbProfile = await profileResponse.json();
              if (dbProfile.userGender && dbProfile.userLocation) {
                setUserProfile({
                  userGender: dbProfile.userGender,
                  userLocation: dbProfile.userLocation,
                });

                // Sync with localStorage
                localStorage.setItem(
                  "snappairUserGender",
                  dbProfile.userGender
                );
                localStorage.setItem(
                  "snappairUserLocation",
                  dbProfile.userLocation
                );
              }
            }
          } catch (error) {
            console.error("Error loading preferences from database:", error);
          }
        }
      }
    };

    loadPreferences();
  }, [session]);

  // Handle user profile completion
  const handleUserProfileComplete = (profile: {
    userGender: string;
    userLocation: string;
  }) => {
    setUserProfile(profile);
    console.log("User profile completed:", profile);
  };

  // Chat handlers
  const handleVideoChat = () => {
    if (!session) {
      router.push("/auth/signin");
      return;
    }

    // Store user profile data in sessionStorage for the chat pages to use
    const chatProfile = {
      userGender: userProfile.userGender,
      userLocation: userProfile.userLocation,
      matchGender: matchPreferences.matchGender,
      matchLocation: matchPreferences.matchCountry,
      matchGames: matchPreferences.matchInterest || [],
    };

    sessionStorage.setItem("snappairChatProfile", JSON.stringify(chatProfile));
    console.log("Starting video chat with profile:", chatProfile);

    setIsVideoConnecting(true);
    setTimeout(() => {
      router.push("/video-chat");
    }, 1000);
  };

  const handleVoiceChat = () => {
    if (!session) {
      router.push("/auth/signin");
      return;
    }

    // Store user profile data in sessionStorage for the chat pages to use
    const chatProfile = {
      userGender: userProfile.userGender,
      userLocation: userProfile.userLocation,
      matchGender: matchPreferences.matchGender,
      matchLocation: matchPreferences.matchCountry,
      matchGames: matchPreferences.matchInterest || [],
    };

    sessionStorage.setItem("snappairChatProfile", JSON.stringify(chatProfile));
    console.log("Starting voice chat with profile:", chatProfile);

    setIsVoiceConnecting(true);
    setTimeout(() => {
      router.push("/voice-chat");
    }, 1000);
  };

  const handleTextChat = () => {
    if (!session) {
      router.push("/auth/signin");
      return;
    }

    // Store user profile data in sessionStorage for the chat pages to use
    const chatProfile = {
      userGender: userProfile.userGender,
      userLocation: userProfile.userLocation,
      matchGender: matchPreferences.matchGender,
      matchLocation: matchPreferences.matchCountry,
      matchGames: matchPreferences.matchInterest || [],
    };

    sessionStorage.setItem("snappairChatProfile", JSON.stringify(chatProfile));
    console.log("Starting text chat with profile:", chatProfile);

    setIsTextConnecting(true);
    setTimeout(() => {
      router.push("/text-chat");
    }, 1000);
  };

  // Filter text helpers
  const getMatchGenderText = () => {
    switch (matchPreferences.matchGender) {
      case "male":
        return "Male";
      case "female":
        return "Female";
      default:
        return "Everyone";
    }
  };

  const getMatchCountryText = () => {
    return matchPreferences.matchCountry || "Worldwide";
  };

  const getMatchGameText = () => {
    if (
      !matchPreferences.matchInterest ||
      matchPreferences.matchInterest.length === 0
    ) {
      return "Any Game";
    }
    if (matchPreferences.matchInterest.length === 1) {
      const game = games.find(
        (g) => g.id === matchPreferences.matchInterest![0]
      );
      return game ? game.name : matchPreferences.matchInterest[0];
    }
    return `${matchPreferences.matchInterest.length} Games`;
  };

  // Game list
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

  // Auto-save handlers for preferences
  const savePreferencesToDatabase = async (preferences: {
    matchGender?: string;
    matchCountry?: string | null;
    matchInterest?: string[] | null;
  }) => {
    // Only save to database if user is authenticated
    if (!session?.user?.email) {
      return;
    }

    try {
      const response = await fetch("/api/users/match-preferences", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(preferences),
      });

      if (!response.ok) {
        console.error("Failed to save preferences to database");
      }
    } catch (error) {
      console.error("Error saving preferences to database:", error);
    }
  };

  // Sync localStorage preferences to database when user logs in
  const syncLocalStorageToDatabase = async () => {
    if (!session?.user?.email) return;

    try {
      // Get preferences from localStorage
      const savedGender = localStorage.getItem("snappairGenderFilter") || "all";
      const savedCountry =
        localStorage.getItem("snappairCountryFilter") || null;

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

      // Save to database
      await savePreferencesToDatabase({
        matchGender: savedGender,
        matchCountry: savedCountry,
        matchInterest: savedInterests,
      });
    } catch (error) {
      console.error("Error syncing localStorage to database:", error);
    }
  };

  const handleGenderChange = (gender: string) => {
    setMatchPreferences((prev) => ({ ...prev, matchGender: gender }));
    localStorage.setItem("snappairGenderFilter", gender);

    // Save to database if authenticated
    if (session?.user?.email) {
      savePreferencesToDatabase({ matchGender: gender });
    }
  };

  const handleCountryChange = (country: string | null) => {
    setMatchPreferences((prev) => ({ ...prev, matchCountry: country }));
    if (country) {
      localStorage.setItem("snappairCountryFilter", country);
    } else {
      localStorage.removeItem("snappairCountryFilter");
    }

    // Save to database if authenticated
    if (session?.user?.email) {
      savePreferencesToDatabase({ matchCountry: country });
    }
  };

  const handleGameChange = (gameId: string, isSelected: boolean) => {
    const currentGames = matchPreferences.matchInterest || [];
    let newGames: string[];

    if (isSelected) {
      newGames = [...currentGames, gameId];
    } else {
      newGames = currentGames.filter((g) => g !== gameId);
    }

    const finalGames = newGames.length > 0 ? newGames : null;
    setMatchPreferences((prev) => ({ ...prev, matchInterest: finalGames }));

    if (finalGames) {
      localStorage.setItem(
        "snappairInterestFilter",
        JSON.stringify(finalGames)
      );
    } else {
      localStorage.removeItem("snappairInterestFilter");
    }

    // Save to database if authenticated
    if (session?.user?.email) {
      savePreferencesToDatabase({ matchInterest: finalGames });
    }
  };

  const handleClearAllGames = () => {
    setMatchPreferences((prev) => ({ ...prev, matchInterest: null }));
    localStorage.removeItem("snappairInterestFilter");

    // Save to database if authenticated
    if (session?.user?.email) {
      savePreferencesToDatabase({ matchInterest: null });
    }
  };

  // Handle outside click to close modals
  const handleModalOutsideClick = (e: React.MouseEvent, modalType: string) => {
    if (e.target === e.currentTarget) {
      switch (modalType) {
        case "gender":
          setShowGenderModal(false);
          break;
        case "country":
          setShowCountryModal(false);
          break;
        case "game":
          setShowGameModal(false);
          break;
      }
    }
  };

  // Camera filter handler
  const applyFilter = (filter: string) => {
    setActiveFilter(filter);
  };

  return (
    <main className="flex min-h-screen flex-col bg-black">
      <Header />

      <div className="flex-grow">
        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 py-8 pt-24">
          {/* <div className="text-center mb-8">
            <h2 className="text-4xl font-bold mb-4">
              Connect with Strangers Worldwide
            </h2>
            <p className="text-gray-400 text-lg">
              Start video, text, or voice chats with people from around the
              world
            </p>
          </div> */}

          {/* Video Preview Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Left Video Preview (User's Camera) */}
            <div className="relative rounded-3xl overflow-hidden bg-gray-900 aspect-[4/3]">
              {/* Camera Controls */}
              <div className="absolute top-4 right-4 z-10">
                <button
                  onClick={() => setShowCameraOptions(!showCameraOptions)}
                  className="bg-black/40 hover:bg-black/60 rounded-full p-3 transition-colors"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                </button>

                {/* Camera Filter Options */}
                {showCameraOptions && (
                  <div className="absolute top-12 right-0 bg-black/80 rounded-lg p-3 w-52 z-20">
                    <h3 className="text-white text-sm font-semibold mb-3">
                      Camera Filters
                    </h3>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => applyFilter("none")}
                        className={`w-14 h-14 rounded-md p-1 ${
                          activeFilter === "none" ? "ring-2 ring-blue-400" : ""
                        }`}
                      >
                        <div className="bg-gradient-to-r from-zinc-800 to-zinc-700 w-full h-full rounded flex items-center justify-center text-xs">
                          None
                        </div>
                      </button>
                      <button
                        onClick={() => applyFilter("sepia")}
                        className={`w-14 h-14 rounded-md p-1 ${
                          activeFilter === "sepia" ? "ring-2 ring-blue-400" : ""
                        }`}
                      >
                        <div className="bg-gradient-to-r from-yellow-700 to-yellow-900 w-full h-full rounded flex items-center justify-center text-xs">
                          Sepia
                        </div>
                      </button>
                      <button
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
                      </button>
                      <button
                        onClick={() => applyFilter("blur")}
                        className={`w-14 h-14 rounded-md p-1 ${
                          activeFilter === "blur" ? "ring-2 ring-blue-400" : ""
                        }`}
                      >
                        <div className="bg-gradient-to-r from-blue-200 to-blue-400 w-full h-full rounded flex items-center justify-center text-xs backdrop-blur-sm">
                          Blur
                        </div>
                      </button>
                      <button
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
                      </button>
                      <button
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
                      </button>
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

              {/* Video Overlay */}
              <div className="absolute inset-0 pointer-events-none">
                <div className="w-full h-full bg-gradient-to-b from-black/20 via-transparent to-black/40"></div>
              </div>
            </div>

            {/* Right Video Preview (Partner Placeholder) */}
            <div className="relative rounded-3xl overflow-hidden bg-gray-900 aspect-[4/3]">
              <div className="absolute right-5 top-5 bg-black/40 rounded-full px-3 py-1 flex items-center">
                <div className="w-3 h-3 rounded-full bg-green-500 mr-2"></div>
                <span className="text-green-400 text-sm font-medium">
                  READY
                </span>
              </div>

              {/* Partner Video Placeholder */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-full h-full bg-gradient-to-b from-black/20 via-transparent to-black/80"></div>

                {/* Placeholder content */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-6xl mb-4">👥</div>
                    <div className="text-xl font-semibold">
                      Ready to Connect
                    </div>
                    <div className="text-gray-400 mt-2">
                      Choose your chat type below
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Filter Buttons and Desktop Video Chat */}
          <div className="flex flex-wrap justify-center gap-4 mb-8">
            {/* Gender Filter Button */}
            <button
              className="rounded-full px-6 py-3 flex items-center justify-center gap-2 text-sm border border-gray-700 bg-gray-800/60 hover:bg-gray-700/80 transition-colors"
              onClick={() => setShowGenderModal(true)}
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
            </button>

            {/* Location Filter Button */}
            <button
              className="rounded-full px-6 py-3 flex items-center justify-center gap-2 text-sm border border-gray-700 bg-gray-800/60 hover:bg-gray-700/80 transition-colors"
              onClick={() => setShowCountryModal(true)}
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
            </button>

            {/* Game Filter Button */}
            <button
              className="rounded-full px-6 py-3 flex items-center justify-center gap-2 text-sm border border-gray-700 bg-gray-800/60 hover:bg-gray-700/80 transition-colors"
              onClick={() => setShowGameModal(true)}
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
              {getMatchGameText()}
            </button>

            {/* Desktop Video Chat Button */}
            <button
              onClick={handleVideoChat}
              disabled={
                isVideoConnecting || isTextConnecting || isVoiceConnecting
              }
              className="hidden lg:flex rounded-full px-8 py-3 items-center justify-center gap-3 text-lg bg-white text-black hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isVideoConnecting ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-black"></div>
                  Connecting...
                </>
              ) : (
                <>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
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
            </button>
          </div>

          {/* Start Chat Buttons */}
          <div className="max-w-2xl mx-auto space-y-4">
            {/* Mobile Video Chat Button */}
            <button
              onClick={handleVideoChat}
              disabled={
                isVideoConnecting || isTextConnecting || isVoiceConnecting
              }
              className="lg:hidden rounded-full w-full flex items-center justify-center gap-3 text-xl py-6 bg-white text-black hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
            </button>

            {/* Text Chat Button */}
            <button
              onClick={handleTextChat}
              disabled={
                isVideoConnecting || isTextConnecting || isVoiceConnecting
              }
              className="rounded-full w-full flex items-center justify-center gap-3 text-xl py-6 bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
            </button>

            {/* Voice Chat Button */}
            <button
              onClick={handleVoiceChat}
              disabled={
                isVideoConnecting || isTextConnecting || isVoiceConnecting
              }
              className="rounded-full w-full flex items-center justify-center gap-3 text-xl py-6 bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
            </button>
          </div>

          {/* Info Section */}
          <div className="mt-12 text-center text-gray-400">
            <p className="text-sm">
              Connect with strangers from around the world safely and
              anonymously.
              <br />
              Please be respectful and follow community guidelines.
            </p>
          </div>
        </div>
      </div>
      <Footer />

      {/* Modal Overlays */}
      {showGenderModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={(e) => handleModalOutsideClick(e, "gender")}
        >
          <div className="bg-gray-800 rounded-lg max-w-md w-full mx-4 flex flex-col max-h-[80vh]">
            <div className="p-6 pb-4">
              <h3 className="text-lg font-semibold mb-4">
                Select Gender Preference
              </h3>
            </div>
            <div className="flex-1 overflow-y-auto px-6">
              <div className="space-y-3">
                {[
                  { id: "all", label: "Everyone" },
                  { id: "male", label: "Male" },
                  { id: "female", label: "Female" },
                ].map((option) => (
                  <button
                    key={option.id}
                    onClick={() => handleGenderChange(option.id)}
                    className={`w-full text-left p-4 rounded-lg cursor-pointer transition-all duration-200 ${
                      matchPreferences.matchGender === option.id
                        ? "bg-blue-600 text-white shadow-lg"
                        : "bg-gray-700 hover:bg-gray-600 text-gray-200"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="p-6 pt-4 border-t border-gray-700">
              <button
                onClick={() => setShowGenderModal(false)}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-lg font-medium transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {showCountryModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={(e) => handleModalOutsideClick(e, "country")}
        >
          <div className="bg-gray-800 rounded-lg max-w-md w-full mx-4 flex flex-col max-h-[80vh]">
            <div className="p-6 pb-4">
              <h3 className="text-lg font-semibold mb-4">
                Select Location Preference
              </h3>
            </div>
            <div className="flex-1 overflow-y-auto px-6">
              <div className="space-y-3">
                {[
                  { id: null, label: "Worldwide" },
                  { id: "US", label: "United States" },
                  { id: "UK", label: "United Kingdom" },
                  { id: "CA", label: "Canada" },
                ].map((option) => (
                  <button
                    key={option.id || "worldwide"}
                    onClick={() => handleCountryChange(option.id)}
                    className={`w-full text-left p-4 rounded-lg cursor-pointer transition-all duration-200 ${
                      matchPreferences.matchCountry === option.id
                        ? "bg-green-600 text-white shadow-lg"
                        : "bg-gray-700 hover:bg-gray-600 text-gray-200"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="p-6 pt-4 border-t border-gray-700">
              <button
                onClick={() => setShowCountryModal(false)}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-lg font-medium transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {showGameModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={(e) => handleModalOutsideClick(e, "game")}
        >
          <div className="bg-gray-800 rounded-lg max-w-md w-full mx-4 flex flex-col max-h-[80vh]">
            <div className="p-6 pb-4">
              <h3 className="text-lg font-semibold mb-4">
                Select Game Preference
              </h3>
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-gray-400">
                  {matchPreferences.matchInterest?.length || 0} selected
                </span>
                <button
                  onClick={handleClearAllGames}
                  className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
                >
                  Clear All
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-6">
              <div className="space-y-2">
                {games.map((game) => (
                  <button
                    key={game.id}
                    onClick={() =>
                      handleGameChange(
                        game.id,
                        !matchPreferences.matchInterest?.includes(game.id)
                      )
                    }
                    className={`w-full text-left p-4 rounded-lg cursor-pointer transition-all duration-200 ${
                      matchPreferences.matchInterest?.includes(game.id)
                        ? "bg-purple-600 text-white shadow-lg"
                        : "bg-gray-700 hover:bg-gray-600 text-gray-200"
                    }`}
                  >
                    {game.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="p-6 pt-4 border-t border-gray-700">
              <button
                onClick={() => setShowGameModal(false)}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-lg font-medium transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {showUserProfileModal && (
        <UserProfileModal
          isOpen={showUserProfileModal}
          onClose={() => setShowUserProfileModal(false)}
          onComplete={handleUserProfileComplete}
        />
      )}
    </main>
  );
}
