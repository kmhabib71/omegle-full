"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import SimplePeerVoiceChat from "../../components/SimplePeerVoiceChat";
import UserProfileModal from "../../components/UserProfileModal";

interface UserProfile {
  userGender: string;
  userLocation: string;
}

export default function VoiceChat() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileChecked, setProfileChecked] = useState(false);

  const checkUserProfile = async () => {
    try {
      // Check localStorage first
      const localUserGender = localStorage.getItem("snappairUserGender");
      const localUserLocation = localStorage.getItem("snappairUserLocation");

      let hasLocalProfile = localUserGender && localUserLocation;
      let hasDbProfile = false;

      // If user is authenticated, check database
      if (session?.user?.email) {
        try {
          const response = await fetch("/api/users/profile");
          if (response.ok) {
            const userData = await response.json();
            hasDbProfile = userData.userGender && userData.userLocation;
          }
        } catch (error) {
          console.error("Error checking database profile:", error);
        }
      }

      // Show modal if profile data is missing from both localStorage and database
      if (!hasLocalProfile || (session?.user?.email && !hasDbProfile)) {
        setShowProfileModal(true);
      }
    } catch (error) {
      console.error("Error checking user profile:", error);
    } finally {
      setProfileChecked(true);
    }
  };

  useEffect(() => {
    if (status === "loading") return;

    if (status === "unauthenticated") {
      router.push("/auth/signin");
      return;
    }

    // Check user profile after authentication status is determined
    checkUserProfile();
  }, [status, session, router]);

  const handleProfileComplete = async (profile: UserProfile) => {
    console.log("Profile completed:", profile);

    // Save to localStorage
    localStorage.setItem("snappairUserGender", profile.userGender);
    localStorage.setItem("snappairUserLocation", profile.userLocation);

    // Save to database if authenticated
    if (session?.user?.email) {
      try {
        const response = await fetch("/api/users/profile", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userGender: profile.userGender,
            userLocation: profile.userLocation,
          }),
        });

        if (!response.ok) {
          console.error("Failed to save profile to database");
        }
      } catch (error) {
        console.error("Error saving profile to database:", error);
      }
    }

    setShowProfileModal(false);
  };

  if (status === "loading" || !profileChecked) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <UserProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        onComplete={handleProfileComplete}
      />

      {!showProfileModal && <SimplePeerVoiceChat />}
    </div>
  );
}
