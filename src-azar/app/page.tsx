"use client";

import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { VideoChat } from "@/components/video-chat";
import { UserProfileModal } from "@/components/UserProfileModal";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";

export default function Home() {
  const { data: session, status } = useSession();
  const [showUserProfileModal, setShowUserProfileModal] = useState(false);
  const [profileChecked, setProfileChecked] = useState(false);

  // Check if user has necessary profile information
  useEffect(() => {
    if (status === "authenticated" && session?.user && !profileChecked) {
      // Check localStorage first to avoid unnecessary API calls
      const cachedProfile = localStorage.getItem(`profile_${session.user.id}`);

      if (cachedProfile) {
        try {
          const profile = JSON.parse(cachedProfile);
          const cacheTime = profile._cacheTime || 0;
          const now = Date.now();

          // Cache is valid for 5 minutes
          if (
            now - cacheTime < 5 * 60 * 1000 &&
            profile.gender &&
            profile.country
          ) {
            setProfileChecked(true);
            return;
          }
        } catch (error) {
          console.error("Error parsing cached profile:", error);
        }
      }

      // Check if user data exists in MongoDB
      const checkUserProfile = async () => {
        try {
          const response = await fetch("/api/users/profile");

          if (response.ok) {
            const data = await response.json();

            // Cache the profile data
            const profileWithCache = {
              ...data,
              _cacheTime: Date.now(),
            };
            localStorage.setItem(
              `profile_${session.user.id}`,
              JSON.stringify(profileWithCache)
            );

            // Only show modal if gender or country is missing
            if (!data.gender || !data.country) {
              setShowUserProfileModal(true);
            }
          } else {
            console.error(
              "Failed to fetch profile:",
              response.status,
              response.statusText
            );
            // If API fails, check if we have basic session data
            if (!session.user.name) {
              setShowUserProfileModal(true);
            }
          }
        } catch (error) {
          console.error("Error checking user profile:", error);
          // On error, only show modal if we don't have basic user info
          if (!session.user.name) {
            setShowUserProfileModal(true);
          }
        } finally {
          setProfileChecked(true);
        }
      };

      checkUserProfile();
    }
  }, [session, status, profileChecked]);

  const handleSaveUserProfile = async (userData: {
    gender: string;
    country: string;
  }) => {
    try {
      // Update user profile
      const response = await fetch("/api/users/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(userData),
      });

      if (response.ok) {
        const updatedData = await response.json();

        // Update cache
        const profileWithCache = {
          ...updatedData,
          _cacheTime: Date.now(),
        };
        localStorage.setItem(
          `profile_${session?.user?.id}`,
          JSON.stringify(profileWithCache)
        );

        setShowUserProfileModal(false);
      } else {
        console.error("Failed to update profile:", response.status);
        // Still close modal on error to prevent infinite loop
        setShowUserProfileModal(false);
      }
    } catch (error) {
      console.error("Error updating user profile:", error);
      // Still close modal on error to prevent infinite loop
      setShowUserProfileModal(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col bg-black">
      <Header />
      <div className="flex-grow">
        <VideoChat />
      </div>
      <Footer />

      <UserProfileModal
        isOpen={showUserProfileModal}
        onClose={() => setShowUserProfileModal(false)}
        onSave={handleSaveUserProfile}
      />
    </main>
  );
}
