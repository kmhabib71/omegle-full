"use client";

import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface HistoryItem {
  id: string;
  type: "video";
  startTime: string;
  endTime: string | null;
  duration: number;
  messageCount: number;
  starred: boolean;
  userInfo: {
    name: string;
    username: string;
    email: string;
    country: string | null;
    gender: string | null;
    imageUrl: string | null;
  };
  targetInfo: {
    name: string;
    username: string;
    country: string | null;
    gender: string | null;
    imageUrl: string | null;
  };
  matchCriteria: {
    gender?: boolean;
    country?: boolean;
    interests?: string[];
  } | null;
}

export default function HistoryPage() {
  const [selectedFilter, setSelectedFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { data: session, status } = useSession();
  const router = useRouter();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  // Fetch history data
  useEffect(() => {
    if (status === "authenticated") {
      setLoading(true);
      fetch("/api/video-session")
        .then((response) => {
          if (!response.ok) {
            throw new Error("Failed to fetch history");
          }
          return response.json();
        })
        .then((data) => {
          setHistoryItems(data);
          setLoading(false);
        })
        .catch((err) => {
          console.error("Error fetching history:", err);
          setError("Failed to load history. Please try again.");
          setLoading(false);
        });
    }
  }, [status]);

  const handleStarToggle = (id: string) => {
    // Update locally first for responsive UI
    setHistoryItems(
      historyItems.map((item) =>
        item.id === id ? { ...item, starred: !item.starred } : item
      )
    );

    // Update in database
    fetch("/api/video-session", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id,
        starred: !historyItems.find((item) => item.id === id)?.starred,
      }),
    }).catch((error) => console.error("Error updating starred status:", error));
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffDays === 0) {
      return `Today, ${date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })}`;
    } else if (diffDays === 1) {
      return `Yesterday, ${date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })}`;
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const formatDuration = (seconds: number) => {
    if (!seconds) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getAvatarText = (name: string) => {
    return name.charAt(0).toUpperCase();
  };

  const getRandomEmoji = (name: string) => {
    const emojis = ["👨", "👩", "👧", "👦", "👱‍♀️", "👱", "👨‍🦰", "👩‍🦰", "👨‍🦱", "👩‍🦱"];
    // Use the name to generate a consistent emoji for the same person
    const index =
      name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0) %
      emojis.length;
    return emojis[index];
  };

  const filteredItems = historyItems.filter((item) => {
    // Apply search filter
    const matchesSearch =
      searchQuery === "" ||
      item.targetInfo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.targetInfo.country &&
        item.targetInfo.country
          .toLowerCase()
          .includes(searchQuery.toLowerCase()));

    // Apply type filter
    const matchesFilter =
      selectedFilter === "all" ||
      (selectedFilter === "starred" && item.starred);

    return matchesSearch && matchesFilter;
  });

  // Sort by date (newest first)
  const sortedItems = [...filteredItems].sort(
    (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
  );

  return (
    <main className="flex min-h-screen flex-col bg-black">
      <Header />

      <div className="container mx-auto px-4 py-20 flex-1">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold text-white mb-6">My History</h1>

          {/* Filters and Search */}
          <div className="bg-zinc-900 rounded-lg p-4 mb-6">
            <div className="flex flex-col md:flex-row justify-between gap-4">
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => setSelectedFilter("all")}
                  className={`rounded-full px-4 py-2 text-sm ${
                    selectedFilter === "all" ? "bg-blue-600" : "bg-zinc-800"
                  }`}
                >
                  All
                </Button>
                <Button
                  onClick={() => setSelectedFilter("starred")}
                  className={`rounded-full px-4 py-2 text-sm ${
                    selectedFilter === "starred" ? "bg-blue-600" : "bg-zinc-800"
                  }`}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4 mr-1"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  Starred
                </Button>
                <Button
                  onClick={() => setSelectedFilter("video")}
                  className={`rounded-full px-4 py-2 text-sm ${
                    selectedFilter === "video" ? "bg-blue-600" : "bg-zinc-800"
                  }`}
                >
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
                      d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                  Video Chats
                </Button>
              </div>

              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name or country..."
                  className="bg-zinc-800 border border-zinc-700 rounded-full px-4 py-2 pl-10 w-full md:w-64 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
            </div>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="bg-zinc-900 rounded-lg p-8 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <p className="text-zinc-400">Loading your chat history...</p>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="bg-zinc-900 rounded-lg p-8 text-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-12 w-12 mx-auto text-red-500 mb-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <h3 className="text-xl font-medium text-zinc-400">Error</h3>
              <p className="text-zinc-500 mt-2">{error}</p>
            </div>
          )}

          {/* Empty State */}
          {!loading && !error && sortedItems.length === 0 && (
            <div className="bg-zinc-900 rounded-lg p-8 text-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-12 w-12 mx-auto text-zinc-700 mb-4"
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
              <h3 className="text-xl font-medium text-zinc-400">
                No history found
              </h3>
              <p className="text-zinc-500 mt-2">
                No entries match your current filter or search criteria.
              </p>
              {selectedFilter !== "all" && (
                <Button
                  onClick={() => setSelectedFilter("all")}
                  className="mt-4 bg-blue-600 hover:bg-blue-700"
                >
                  Show All History
                </Button>
              )}
            </div>
          )}

          {/* History List */}
          {!loading && !error && sortedItems.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sortedItems.map((item) => (
                <div
                  key={item.id}
                  className="bg-zinc-900 rounded-lg overflow-hidden shadow-lg border border-zinc-800 transition-all hover:border-zinc-700"
                >
                  <div className="flex p-4">
                    <div className="flex-shrink-0 mr-4">
                      <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-2xl">
                        {item.targetInfo?.imageUrl ? (
                          <img
                            src={item.targetInfo?.imageUrl}
                            alt={item.targetInfo?.name || "User"}
                            className="w-full h-full rounded-full object-cover"
                          />
                        ) : (
                          getRandomEmoji(
                            item.targetInfo?.name ||
                              item.targetInfo?.username ||
                              "Unknown"
                          )
                        )}
                      </div>
                    </div>
                    <div className="flex-grow">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-medium text-white">
                          {item.targetInfo?.name ||
                            item.targetInfo?.username ||
                            "Unknown User"}
                        </h3>
                        <span className="text-xs text-zinc-500">
                          {formatDate(item.startTime)}
                        </span>
                      </div>
                      <div className="flex items-center text-zinc-400 text-sm">
                        <span className="mr-2">
                          {item.targetInfo?.country || "Unknown Location"}
                        </span>
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4 text-blue-400"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                        </svg>
                      </div>
                      <div className="flex items-center justify-between mt-3">
                        <div className="flex items-center text-zinc-500 text-sm">
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
                              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                          {formatDuration(item.duration)}

                          {item.messageCount > 0 && (
                            <span className="ml-3 flex items-center">
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
                                  d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                                />
                              </svg>
                              {item.messageCount}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleStarToggle(item.id)}
                            className="text-zinc-400 hover:text-yellow-500 transition-colors"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className={`h-5 w-5 ${
                                item.starred
                                  ? "text-yellow-500 fill-current"
                                  : ""
                              }`}
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                              />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Footer />
    </main>
  );
}
