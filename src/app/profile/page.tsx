"use client";

import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useRef } from "react";
import { signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Toaster, toast } from "react-hot-toast";

// Extend the Session User type to include additional properties
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      username?: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      bio?: string;
      gender?: string;
    };
  }
}

export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState("profile");
  const [gender, setGender] = useState("male");
  const [notifications, setNotifications] = useState(true);
  const [darkMode, setDarkMode] = useState(true);
  const [autoNextChat, setAutoNextChat] = useState(false);
  const [allowMessages, setAllowMessages] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Add profile form state
  const [profileForm, setProfileForm] = useState({
    displayName: "",
    username: "",
    email: "",
    bio: "",
    profileImage: "",
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data: session, status, update } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
    } else if (session?.user) {
      // Initial profile data from session
      setProfileForm({
        displayName: session.user.name || "",
        username: session.user.username || "",
        email: session.user.email || "",
        bio: session.user.bio || "",
        profileImage: session.user.image || "",
      });

      setGender(session.user.gender || "male");

      // Fetch the latest profile data from API
      fetchProfileData();

      setIsLoading(false);
    } else if (status === "loading") {
      setIsLoading(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, router, session]); // Intentionally omitting fetchProfileData from dependencies

  // Function to fetch latest profile data
  const fetchProfileData = async () => {
    try {
      const response = await fetch("/api/users/profile");
      if (response.ok) {
        const data = await response.json();
        console.log("Fetched profile data:", data);

        // Update form with latest data from database
        setProfileForm((prevForm) => ({
          ...prevForm,
          displayName: data.name || prevForm.displayName,
          username: data.username || prevForm.username,
          email: data.email || prevForm.email,
          bio: data.bio || prevForm.bio,
          profileImage: data.profileImage || prevForm.profileImage,
        }));

        if (data.gender) {
          setGender(data.gender);
        }
      }
    } catch (error) {
      console.error("Error fetching profile data:", error);
    }
  };

  const handleProfileChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setProfileForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleGenderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setGender(e.target.value);
  };

  const handleProfileImageClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size must be less than 5MB");
      return;
    }

    // Check file type
    if (!file.type.startsWith("image/")) {
      toast.error("Only image files are allowed");
      return;
    }

    setIsUploading(true);

    try {
      // Upload to imgbb
      const formData = new FormData();
      formData.append("image", file);
      formData.append("key", "095dc4323bd3e44ab59f99f2c79205a8");

      const response = await fetch("https://api.imgbb.com/1/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        // Update form with new image URL
        setProfileForm((prev) => ({
          ...prev,
          profileImage: data.data.url,
        }));
        toast.success("Image uploaded successfully");
      } else {
        toast.error("Failed to upload image");
      }
    } catch (error) {
      console.error("Error uploading image:", error);
      toast.error("Error uploading image");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (isSaving) return;

    setIsSaving(true);

    console.log("Saving profile with data:", {
      name: profileForm.displayName,
      bio: profileForm.bio,
      gender: gender,
      image: profileForm.profileImage,
    });

    try {
      // Update profile using the existing API route
      const response = await fetch("/api/users/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: profileForm.displayName,
          bio: profileForm.bio,
          gender: gender,
          profileImage: profileForm.profileImage,
        }),
      });

      const data = await response.json();
      console.log("Response from API:", data);

      if (response.ok) {
        // First update local state to reflect changes immediately
        setProfileForm({
          ...profileForm,
          displayName: data.name || profileForm.displayName,
          bio: data.bio || profileForm.bio,
          profileImage: data.profileImage || profileForm.profileImage,
        });

        setGender(data.gender || gender);

        // Then update the session
        try {
          await update({
            ...session,
            user: {
              ...session?.user,
              name: profileForm.displayName,
              image: profileForm.profileImage,
              bio: profileForm.bio,
              gender: gender,
            },
          });

          toast.success("Profile updated successfully");

          // Force a full reload to ensure the session is updated correctly
          setTimeout(() => {
            window.location.reload();
          }, 1000);
        } catch (sessionError) {
          console.error("Error updating session:", sessionError);
          // Still show success since database was updated
          toast.success(
            "Profile saved to database, but session update failed. Please refresh the page."
          );
        }
      } else {
        toast.error(data.error || "Failed to update profile");
      }
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error("Error updating profile");
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    await signOut({ redirect: false });
    router.push("/auth/signin");
  };

  return (
    <main className="flex min-h-screen flex-col bg-black">
      <Header />
      <Toaster position="top-center" />

      <div className="container mx-auto px-4 py-20 flex-1">
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto bg-zinc-900 rounded-xl overflow-hidden shadow-lg">
            {/* Profile Header */}
            <div className="relative">
              <div className="h-32 md:h-48 bg-gradient-to-r from-blue-600 to-purple-600"></div>
              <div className="absolute bottom-0 transform translate-y-1/2 left-8">
                <div
                  className="w-24 h-24 md:w-32 md:h-32 bg-zinc-800 rounded-full border-4 border-zinc-900 flex items-center justify-center overflow-hidden cursor-pointer relative"
                  onClick={handleProfileImageClick}
                >
                  {isUploading ? (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white"></div>
                    </div>
                  ) : (
                    <>
                      {profileForm.profileImage ? (
                        <img
                          src={profileForm.profileImage}
                          alt={profileForm.displayName || "User"}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-16 w-16 md:h-20 md:w-20 text-zinc-500"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1}
                            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                          />
                        </svg>
                      )}
                      <div className="absolute inset-0 bg-black/30 opacity-0 hover:opacity-100 flex items-center justify-center transition-opacity">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-8 w-8 text-white"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                        </svg>
                      </div>
                    </>
                  )}
                </div>
                {/* Hidden file input */}
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/*"
                  onChange={handleFileChange}
                />
              </div>
              {/* Add Refresh Button */}
              <div className="absolute top-4 right-4">
                <Button
                  onClick={fetchProfileData}
                  className="bg-zinc-800/70 hover:bg-zinc-700/90 text-white rounded-full h-10 w-10 flex items-center justify-center"
                  title="Refresh Profile"
                >
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
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                </Button>
              </div>
            </div>

            {/* Profile Info */}
            <div className="pt-16 pb-6 px-8">
              <h1 className="text-2xl font-bold text-white">
                {profileForm.displayName || "User"}
              </h1>
              <p className="text-zinc-400">
                @
                {profileForm.username ||
                  profileForm.displayName?.toLowerCase().replace(/\s+/g, "") ||
                  "user"}
              </p>
            </div>

            {/* Tabs */}
            <div className="border-b border-zinc-800">
              <nav className="flex px-8" aria-label="Tabs">
                <button
                  onClick={() => setActiveTab("profile")}
                  className={`py-4 px-4 text-sm font-medium border-b-2 ${
                    activeTab === "profile"
                      ? "border-blue-500 text-blue-500"
                      : "border-transparent text-zinc-400 hover:text-zinc-300 hover:border-zinc-700"
                  }`}
                >
                  Profile
                </button>
                <button
                  onClick={() => setActiveTab("settings")}
                  className={`py-4 px-4 text-sm font-medium border-b-2 ${
                    activeTab === "settings"
                      ? "border-blue-500 text-blue-500"
                      : "border-transparent text-zinc-400 hover:text-zinc-300 hover:border-zinc-700"
                  }`}
                >
                  Settings
                </button>
              </nav>
            </div>

            {/* Tab Content */}
            <div className="p-8">
              {/* Profile Tab */}
              {activeTab === "profile" && (
                <div>
                  <h2 className="text-xl font-semibold text-white mb-4">
                    Profile Information
                  </h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-zinc-400 text-sm font-medium mb-2">
                        Display Name
                      </label>
                      <input
                        type="text"
                        name="displayName"
                        value={profileForm.displayName}
                        onChange={handleProfileChange}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-zinc-400 text-sm font-medium mb-2">
                        Username (read-only)
                      </label>
                      <input
                        type="text"
                        name="username"
                        value={profileForm.username}
                        readOnly
                        className="w-full bg-zinc-800/50 border border-zinc-700 rounded-md px-3 py-2 text-zinc-400 cursor-not-allowed"
                      />
                    </div>

                    <div>
                      <label className="block text-zinc-400 text-sm font-medium mb-2">
                        Email (read-only)
                      </label>
                      <input
                        type="email"
                        name="email"
                        value={profileForm.email}
                        readOnly
                        className="w-full bg-zinc-800/50 border border-zinc-700 rounded-md px-3 py-2 text-zinc-400 cursor-not-allowed"
                      />
                    </div>

                    <div>
                      <label className="block text-zinc-400 text-sm font-medium mb-2">
                        Gender
                      </label>
                      <select
                        value={gender}
                        onChange={handleGenderChange}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                  </div>

                  <div className="mt-6">
                    <label className="block text-zinc-400 text-sm font-medium mb-2">
                      Bio
                    </label>
                    <textarea
                      rows={4}
                      name="bio"
                      value={profileForm.bio}
                      onChange={handleProfileChange}
                      placeholder="Tell others about yourself..."
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    ></textarea>
                  </div>

                  <div className="mt-6">
                    <Button
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                      onClick={handleSaveProfile}
                      disabled={isSaving}
                    >
                      {isSaving ? (
                        <span className="flex items-center">
                          <span className="animate-spin mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
                          Saving...
                        </span>
                      ) : (
                        "Save Changes"
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {/* Settings Tab */}
              {activeTab === "settings" && (
                <div>
                  <h2 className="text-xl font-semibold text-white mb-4">
                    Account Settings
                  </h2>

                  <div className="space-y-6">
                    <div className="flex items-center justify-between py-3 border-b border-zinc-800">
                      <div>
                        <h3 className="text-white font-medium">
                          Notifications
                        </h3>
                        <p className="text-zinc-400 text-sm">
                          Receive notifications about new matches
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={notifications}
                          onChange={() => setNotifications(!notifications)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-zinc-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between py-3 border-b border-zinc-800">
                      <div>
                        <h3 className="text-white font-medium">Dark Mode</h3>
                        <p className="text-zinc-400 text-sm">
                          Use dark theme across the app
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={darkMode}
                          onChange={() => setDarkMode(!darkMode)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-zinc-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between py-3 border-b border-zinc-800">
                      <div>
                        <h3 className="text-white font-medium">
                          Auto-skip to Next Chat
                        </h3>
                        <p className="text-zinc-400 text-sm">
                          Automatically move to next match after 30 seconds of
                          no activity
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={autoNextChat}
                          onChange={() => setAutoNextChat(!autoNextChat)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-zinc-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between py-3 border-b border-zinc-800">
                      <div>
                        <h3 className="text-white font-medium">
                          Allow Direct Messages
                        </h3>
                        <p className="text-zinc-400 text-sm">
                          Let other users send you text messages
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={allowMessages}
                          onChange={() => setAllowMessages(!allowMessages)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-zinc-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
                  </div>

                  <div className="mt-8 space-y-4">
                    <h3 className="text-white font-medium">Account Actions</h3>

                    <div className="flex flex-col sm:flex-row gap-3">
                      <Button className="bg-zinc-800 hover:bg-zinc-700 text-white">
                        Change Password
                      </Button>
                      <Button className="bg-zinc-800 hover:bg-zinc-700 text-white">
                        Download My Data
                      </Button>
                      <Button
                        onClick={handleLogout}
                        disabled={loggingOut}
                        className="bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center"
                      >
                        {loggingOut ? (
                          "Logging out..."
                        ) : (
                          <>
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
                                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                              />
                            </svg>
                            Sign Out
                          </>
                        )}
                      </Button>
                      <Button className="bg-red-600 hover:bg-red-700 text-white">
                        Delete Account
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <Footer />
    </main>
  );
}
