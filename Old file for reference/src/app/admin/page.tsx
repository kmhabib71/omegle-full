"use client";

import { useState, useEffect } from "react";

interface AdminStats {
  overview: {
    totalUsers: number;
    newRegistrationsToday: number;
    totalSessions: number;
    activeSessions: number;
    sessionsToday: number;
    textSessionsToday: number;
    videoSessionsToday: number;
    avgSessionDuration: number;
  };
  recentSessions: Array<{
    _id: string;
    sessionId: string;
    user1Id: string;
    user2Id: string;
    sessionType: "text" | "video";
    startTime: string;
    endTime?: string;
    status: string;
    duration?: number;
    interests: string[];
  }>;
  popularInterests: Array<{
    interest: string;
    count: number;
  }>;
}

interface User {
  _id: string;
  name: string;
  email: string;
  provider: string;
  createdAt: string;
  stats: {
    totalSessions: number;
    activeSessions: number;
    textSessions: number;
    videoSessions: number;
    avgDuration: number;
  };
}

interface ChatSession {
  _id: string;
  sessionId: string;
  user1Id: string;
  user2Id: string;
  sessionType: "text" | "video";
  startTime: string;
  endTime?: string;
  status: string;
  duration?: number;
  currentDuration?: number;
  interests: string[];
  endReason?: string;
}

export default function AdminPanel() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [activeTab, setActiveTab] = useState("dashboard");

  // Data states
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [usersPage, setUsersPage] = useState(1);
  const [sessionsPage, setSessionsPage] = useState(1);
  const [usersPagination, setUsersPagination] = useState<any>(null);
  const [sessionsPagination, setSessionsPagination] = useState<any>(null);
  const [dataLoading, setDataLoading] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      if (activeTab === "dashboard") {
        fetchStats();
      } else if (activeTab === "users") {
        fetchUsers();
      } else if (activeTab === "sessions") {
        fetchSessions();
      }
    }
  }, [isAuthenticated, activeTab, usersPage, sessionsPage]);

  // Auto-refresh data every 30 seconds
  useEffect(() => {
    if (isAuthenticated) {
      const interval = setInterval(() => {
        if (activeTab === "dashboard") {
          fetchStats();
        } else if (activeTab === "sessions") {
          fetchSessions();
        }
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, activeTab]);

  const checkAuth = async () => {
    try {
      const response = await fetch("/api/admin/auth");
      const data = await response.json();
      setIsAuthenticated(data.authenticated);
    } catch (error) {
      console.error("Auth check error:", error);
    }
    setIsLoading(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");

    try {
      const response = await fetch("/api/admin/auth", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password }),
      });

      const data = await response.json();

      if (response.ok) {
        setIsAuthenticated(true);
        setPassword("");
      } else {
        setLoginError(data.error || "Login failed");
      }
    } catch (error) {
      setLoginError("Network error occurred");
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/admin/auth", { method: "DELETE" });
      setIsAuthenticated(false);
      setActiveTab("dashboard");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const fetchStats = async () => {
    setDataLoading(true);
    try {
      const response = await fetch("/api/admin/stats");
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      } else {
        console.error("Failed to fetch stats:", response.statusText);
      }
    } catch (error) {
      console.error("Stats fetch error:", error);
    }
    setDataLoading(false);
  };

  const fetchUsers = async () => {
    setDataLoading(true);
    try {
      const response = await fetch(
        `/api/admin/users?page=${usersPage}&limit=10`
      );
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users);
        setUsersPagination(data.pagination);
      } else {
        console.error("Failed to fetch users:", response.statusText);
      }
    } catch (error) {
      console.error("Users fetch error:", error);
    }
    setDataLoading(false);
  };

  const fetchSessions = async () => {
    setDataLoading(true);
    try {
      const response = await fetch(
        `/api/admin/sessions?page=${sessionsPage}&limit=10`
      );
      if (response.ok) {
        const data = await response.json();
        setSessions(data.sessions);
        setSessionsPagination(data.pagination);
      } else {
        console.error("Failed to fetch sessions:", response.statusText);
      }
    } catch (error) {
      console.error("Sessions fetch error:", error);
    }
    setDataLoading(false);
  };

  const deleteUser = async (userId: string) => {
    if (!confirm("Are you sure you want to delete this user?")) return;

    try {
      const response = await fetch(`/api/admin/users?userId=${userId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        fetchUsers();
        if (activeTab === "dashboard") fetchStats();
      } else {
        alert("Failed to delete user");
      }
    } catch (error) {
      console.error("Delete user error:", error);
      alert("Error deleting user");
    }
  };

  const terminateSession = async (sessionId: string) => {
    if (!confirm("Are you sure you want to terminate this session?")) return;

    try {
      const response = await fetch(
        `/api/admin/sessions?sessionId=${sessionId}`,
        {
          method: "DELETE",
        }
      );

      if (response.ok) {
        fetchSessions();
        if (activeTab === "dashboard") fetchStats();
      } else {
        alert("Failed to terminate session");
      }
    } catch (error) {
      console.error("Terminate session error:", error);
      alert("Error terminating session");
    }
  };

  const formatDuration = (seconds: number) => {
    if (!seconds || seconds < 0) return "0s";
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m ${remainingSeconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    } else {
      return `${remainingSeconds}s`;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const calculateCurrentDuration = (startTime: string) => {
    const start = new Date(startTime).getTime();
    const now = Date.now();
    return Math.floor((now - start) / 1000);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full space-y-8">
          <div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
              Admin Panel
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              Enter admin password to continue
            </p>
          </div>
          <form className="mt-8 space-y-6" onSubmit={handleLogin}>
            <div>
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Admin password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {loginError && (
              <div className="text-red-600 text-sm text-center">
                {loginError}
              </div>
            )}
            <div>
              <button
                type="submit"
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Sign in
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <h1 className="text-3xl font-bold text-gray-900">Admin Panel</h1>
              <span className="ml-4 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                Online
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {["dashboard", "users", "sessions"].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-4 px-1 border-b-2 font-medium text-sm capitalize ${
                  activeTab === tab
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {activeTab === "dashboard" && (
          <div className="px-4 py-6 sm:px-0">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
              {dataLoading && (
                <div className="flex items-center text-gray-500">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-500 mr-2"></div>
                  Loading...
                </div>
              )}
            </div>

            {stats ? (
              <>
                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                  <div className="bg-white overflow-hidden shadow rounded-lg">
                    <div className="p-5">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <div className="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center">
                            <span className="text-white text-sm font-bold">
                              U
                            </span>
                          </div>
                        </div>
                        <div className="ml-5 w-0 flex-1">
                          <dl>
                            <dt className="text-sm font-medium text-gray-500 truncate">
                              Total Users
                            </dt>
                            <dd className="text-lg font-medium text-gray-900">
                              {stats.overview.totalUsers}
                            </dd>
                          </dl>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white overflow-hidden shadow rounded-lg">
                    <div className="p-5">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <div className="w-8 h-8 bg-green-500 rounded-md flex items-center justify-center">
                            <span className="text-white text-sm font-bold">
                              S
                            </span>
                          </div>
                        </div>
                        <div className="ml-5 w-0 flex-1">
                          <dl>
                            <dt className="text-sm font-medium text-gray-500 truncate">
                              Active Sessions
                            </dt>
                            <dd className="text-lg font-medium text-gray-900">
                              {stats.overview.activeSessions}
                            </dd>
                          </dl>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white overflow-hidden shadow rounded-lg">
                    <div className="p-5">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <div className="w-8 h-8 bg-purple-500 rounded-md flex items-center justify-center">
                            <span className="text-white text-sm font-bold">
                              T
                            </span>
                          </div>
                        </div>
                        <div className="ml-5 w-0 flex-1">
                          <dl>
                            <dt className="text-sm font-medium text-gray-500 truncate">
                              Sessions Today
                            </dt>
                            <dd className="text-lg font-medium text-gray-900">
                              {stats.overview.sessionsToday}
                            </dd>
                          </dl>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white overflow-hidden shadow rounded-lg">
                    <div className="p-5">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <div className="w-8 h-8 bg-orange-500 rounded-md flex items-center justify-center">
                            <span className="text-white text-sm font-bold">
                              D
                            </span>
                          </div>
                        </div>
                        <div className="ml-5 w-0 flex-1">
                          <dl>
                            <dt className="text-sm font-medium text-gray-500 truncate">
                              Avg Duration
                            </dt>
                            <dd className="text-lg font-medium text-gray-900">
                              {formatDuration(
                                stats.overview.avgSessionDuration
                              )}
                            </dd>
                          </dl>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Recent Sessions */}
                <div className="bg-white shadow overflow-hidden sm:rounded-md mb-8">
                  <div className="px-4 py-5 sm:px-6">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">
                      Recent Sessions
                    </h3>
                    <p className="mt-1 max-w-2xl text-sm text-gray-500">
                      Latest chat sessions across the platform
                    </p>
                  </div>
                  <ul className="divide-y divide-gray-200">
                    {stats.recentSessions.length > 0 ? (
                      stats.recentSessions.map((session) => (
                        <li key={session._id}>
                          <div className="px-4 py-4 sm:px-6">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center">
                                <span
                                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                    session.sessionType === "video"
                                      ? "bg-blue-100 text-blue-800"
                                      : "bg-green-100 text-green-800"
                                  }`}
                                >
                                  {session.sessionType}
                                </span>
                                <span className="ml-2 text-sm text-gray-900">
                                  {session.sessionId.substring(0, 8)}...
                                </span>
                                <span
                                  className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                    session.status === "active"
                                      ? "bg-green-100 text-green-800"
                                      : "bg-gray-100 text-gray-800"
                                  }`}
                                >
                                  {session.status}
                                </span>
                              </div>
                              <div className="text-sm text-gray-500">
                                {formatDate(session.startTime)}
                              </div>
                            </div>
                            {session.interests.length > 0 && (
                              <div className="mt-2">
                                <div className="flex flex-wrap gap-1">
                                  {session.interests.map((interest, idx) => (
                                    <span
                                      key={idx}
                                      className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-800"
                                    >
                                      {interest}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </li>
                      ))
                    ) : (
                      <li className="px-4 py-4 sm:px-6 text-center text-gray-500">
                        No recent sessions found
                      </li>
                    )}
                  </ul>
                </div>

                {/* Popular Interests */}
                <div className="bg-white shadow overflow-hidden sm:rounded-md">
                  <div className="px-4 py-5 sm:px-6">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">
                      Popular Interests
                    </h3>
                    <p className="mt-1 max-w-2xl text-sm text-gray-500">
                      Most commonly used interests in chat sessions
                    </p>
                  </div>
                  <ul className="divide-y divide-gray-200">
                    {stats.popularInterests.length > 0 ? (
                      stats.popularInterests.map((item, idx) => (
                        <li key={idx}>
                          <div className="px-4 py-4 sm:px-6 flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-900">
                              {item.interest}
                            </span>
                            <span className="text-sm text-gray-500">
                              {item.count} sessions
                            </span>
                          </div>
                        </li>
                      ))
                    ) : (
                      <li className="px-4 py-4 sm:px-6 text-center text-gray-500">
                        No interest data available
                      </li>
                    )}
                  </ul>
                </div>
              </>
            ) : (
              <div className="bg-white shadow rounded-lg p-6 text-center">
                <p className="text-gray-500">
                  {dataLoading
                    ? "Loading dashboard data..."
                    : "No data available. Make sure the database is connected."}
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === "users" && (
          <div className="px-4 py-6 sm:px-0">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Users</h2>
              {dataLoading && (
                <div className="flex items-center text-gray-500">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-500 mr-2"></div>
                  Loading...
                </div>
              )}
            </div>

            <div className="bg-white shadow overflow-hidden sm:rounded-md">
              <ul className="divide-y divide-gray-200">
                {users.length > 0 ? (
                  users.map((user) => (
                    <li key={user._id}>
                      <div className="px-4 py-4 sm:px-6">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <div className="flex-shrink-0">
                              <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center">
                                <span className="text-sm font-medium text-gray-700">
                                  {user.name.charAt(0).toUpperCase()}
                                </span>
                              </div>
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">
                                {user.name}
                              </div>
                              <div className="text-sm text-gray-500">
                                {user.email}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-4">
                            <div className="text-sm text-gray-500">
                              <span className="font-medium">
                                {user.stats.totalSessions}
                              </span>{" "}
                              sessions
                            </div>
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                user.provider === "google"
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-gray-100 text-gray-800"
                              }`}
                            >
                              {user.provider}
                            </span>
                            <button
                              onClick={() => deleteUser(user._id)}
                              className="text-red-600 hover:text-red-900 text-sm font-medium"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                        <div className="mt-2 text-sm text-gray-500">
                          Joined: {formatDate(user.createdAt)}
                        </div>
                      </div>
                    </li>
                  ))
                ) : (
                  <li className="px-4 py-4 sm:px-6 text-center text-gray-500">
                    {dataLoading ? "Loading users..." : "No users found"}
                  </li>
                )}
              </ul>
            </div>

            {/* Pagination */}
            {usersPagination && usersPagination.totalPages > 1 && (
              <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6 mt-4">
                <div className="flex-1 flex justify-between sm:hidden">
                  <button
                    onClick={() => setUsersPage(usersPage - 1)}
                    disabled={!usersPagination.hasPrev}
                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setUsersPage(usersPage + 1)}
                    disabled={!usersPagination.hasNext}
                    className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
                <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-gray-700">
                      Showing page{" "}
                      <span className="font-medium">
                        {usersPagination.currentPage}
                      </span>{" "}
                      of{" "}
                      <span className="font-medium">
                        {usersPagination.totalPages}
                      </span>
                    </p>
                  </div>
                  <div>
                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                      <button
                        onClick={() => setUsersPage(usersPage - 1)}
                        disabled={!usersPagination.hasPrev}
                        className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Previous
                      </button>
                      <button
                        onClick={() => setUsersPage(usersPage + 1)}
                        disabled={!usersPagination.hasNext}
                        className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Next
                      </button>
                    </nav>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "sessions" && (
          <div className="px-4 py-6 sm:px-0">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Sessions</h2>
              {dataLoading && (
                <div className="flex items-center text-gray-500">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-500 mr-2"></div>
                  Loading...
                </div>
              )}
            </div>

            <div className="bg-white shadow overflow-hidden sm:rounded-md">
              <ul className="divide-y divide-gray-200">
                {sessions.length > 0 ? (
                  sessions.map((session) => (
                    <li key={session._id}>
                      <div className="px-4 py-4 sm:px-6">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                session.sessionType === "video"
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-green-100 text-green-800"
                              }`}
                            >
                              {session.sessionType}
                            </span>
                            <span className="ml-2 text-sm text-gray-900">
                              {session.sessionId.substring(0, 12)}...
                            </span>
                            <span
                              className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                session.status === "active"
                                  ? "bg-green-100 text-green-800"
                                  : "bg-gray-100 text-gray-800"
                              }`}
                            >
                              {session.status}
                            </span>
                          </div>
                          <div className="flex items-center space-x-4">
                            <div className="text-sm text-gray-500">
                              {session.status === "active"
                                ? `${formatDuration(
                                    calculateCurrentDuration(session.startTime)
                                  )} (ongoing)`
                                : session.duration
                                ? formatDuration(session.duration)
                                : "N/A"}
                            </div>
                            {session.status === "active" && (
                              <button
                                onClick={() =>
                                  terminateSession(session.sessionId)
                                }
                                className="text-red-600 hover:text-red-900 text-sm font-medium"
                              >
                                Terminate
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="mt-2 text-sm text-gray-500">
                          Started: {formatDate(session.startTime)}
                          {session.endTime && (
                            <span className="ml-4">
                              Ended: {formatDate(session.endTime)}
                            </span>
                          )}
                          {session.endReason && (
                            <span className="ml-4 text-xs bg-gray-100 px-2 py-1 rounded">
                              Reason: {session.endReason}
                            </span>
                          )}
                        </div>
                        {session.interests.length > 0 && (
                          <div className="mt-2">
                            <div className="flex flex-wrap gap-1">
                              {session.interests.map((interest, idx) => (
                                <span
                                  key={idx}
                                  className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-800"
                                >
                                  {interest}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </li>
                  ))
                ) : (
                  <li className="px-4 py-4 sm:px-6 text-center text-gray-500">
                    {dataLoading ? "Loading sessions..." : "No sessions found"}
                  </li>
                )}
              </ul>
            </div>

            {/* Pagination */}
            {sessionsPagination && sessionsPagination.totalPages > 1 && (
              <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6 mt-4">
                <div className="flex-1 flex justify-between sm:hidden">
                  <button
                    onClick={() => setSessionsPage(sessionsPage - 1)}
                    disabled={!sessionsPagination.hasPrev}
                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setSessionsPage(sessionsPage + 1)}
                    disabled={!sessionsPagination.hasNext}
                    className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
                <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-gray-700">
                      Showing page{" "}
                      <span className="font-medium">
                        {sessionsPagination.currentPage}
                      </span>{" "}
                      of{" "}
                      <span className="font-medium">
                        {sessionsPagination.totalPages}
                      </span>
                    </p>
                  </div>
                  <div>
                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                      <button
                        onClick={() => setSessionsPage(sessionsPage - 1)}
                        disabled={!sessionsPagination.hasPrev}
                        className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Previous
                      </button>
                      <button
                        onClick={() => setSessionsPage(sessionsPage + 1)}
                        disabled={!sessionsPagination.hasNext}
                        className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Next
                      </button>
                    </nav>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
