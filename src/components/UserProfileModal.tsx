"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";

interface UserProfile {
  userGender: string;
  userLocation: string;
}

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (profile: UserProfile) => void;
}

const COUNTRIES = [
  "Afghanistan",
  "Albania",
  "Algeria",
  "Argentina",
  "Armenia",
  "Australia",
  "Austria",
  "Azerbaijan",
  "Bahrain",
  "Bangladesh",
  "Belarus",
  "Belgium",
  "Bolivia",
  "Bosnia and Herzegovina",
  "Brazil",
  "Bulgaria",
  "Cambodia",
  "Canada",
  "Chile",
  "China",
  "Colombia",
  "Croatia",
  "Czech Republic",
  "Denmark",
  "Ecuador",
  "Egypt",
  "Estonia",
  "Finland",
  "France",
  "Georgia",
  "Germany",
  "Ghana",
  "Greece",
  "Hungary",
  "Iceland",
  "India",
  "Indonesia",
  "Iran",
  "Iraq",
  "Ireland",
  "Israel",
  "Italy",
  "Japan",
  "Jordan",
  "Kazakhstan",
  "Kenya",
  "Kuwait",
  "Latvia",
  "Lebanon",
  "Lithuania",
  "Luxembourg",
  "Malaysia",
  "Mexico",
  "Morocco",
  "Netherlands",
  "New Zealand",
  "Nigeria",
  "Norway",
  "Pakistan",
  "Peru",
  "Philippines",
  "Poland",
  "Portugal",
  "Qatar",
  "Romania",
  "Russia",
  "Saudi Arabia",
  "Singapore",
  "Slovakia",
  "Slovenia",
  "South Africa",
  "South Korea",
  "Spain",
  "Sri Lanka",
  "Sweden",
  "Switzerland",
  "Thailand",
  "Turkey",
  "Ukraine",
  "United Arab Emirates",
  "United Kingdom",
  "United States",
  "Vietnam",
];

export default function UserProfileModal({
  isOpen,
  onClose,
  onComplete,
}: UserProfileModalProps) {
  const { data: session } = useSession();
  const [userGender, setUserGender] = useState("");
  const [userLocation, setUserLocation] = useState("");
  const [detectedLocation, setDetectedLocation] = useState("");
  const [locationLoading, setLocationLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showCountryList, setShowCountryList] = useState(false);

  useEffect(() => {
    if (isOpen) {
      detectLocation();
    }
  }, [isOpen]);

  const detectLocation = async () => {
    try {
      setLocationLoading(true);

      // Try multiple location APIs to avoid CORS issues
      let location = "Unknown";

      try {
        // First try: ipapi.co with CORS-friendly endpoint
        const response = await fetch("https://ipapi.co/country_name/", {
          method: "GET",
          headers: {
            Accept: "text/plain",
          },
        });

        if (response.ok) {
          location = await response.text();
          console.log("Location detected via ipapi.co:", location);
        } else {
          throw new Error("ipapi.co failed");
        }
      } catch (error) {
        console.log("ipapi.co failed, trying alternative...");

        try {
          // Second try: Alternative API
          const response = await fetch("https://api.country.is/");
          const data = await response.json();
          location = data.country || "Unknown";
          console.log("Location detected via country.is:", location);
        } catch (error2) {
          console.log("country.is failed, trying third option...");

          try {
            // Third try: Another alternative
            const response = await fetch(
              "https://api.ipgeolocation.io/ipgeo?apiKey=free"
            );
            const data = await response.json();
            location = data.country_name || "Unknown";
            console.log("Location detected via ipgeolocation:", location);
          } catch (error3) {
            console.error("All location APIs failed:", error3);
            location = "Unknown";
          }
        }
      }

      setDetectedLocation(location);
      // Set the detected location as default if it exists in our country list
      if (COUNTRIES.includes(location)) {
        setUserLocation(location);
      }
    } catch (error) {
      console.error("Location detection error:", error);
      setDetectedLocation("Unknown");
    } finally {
      setLocationLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!userGender || !userLocation) {
      alert("Please select your gender and location.");
      return;
    }

    setLoading(true);

    try {
      const profile: UserProfile = {
        userGender,
        userLocation,
      };

      localStorage.setItem("snappairUserGender", userGender);
      localStorage.setItem("snappairUserLocation", userLocation);

      if (session?.user?.email) {
        const response = await fetch("/api/users/profile", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userGender,
            userLocation,
          }),
        });

        if (!response.ok) {
          console.error("Failed to save profile to database");
        }
      }

      onComplete(profile);
      onClose();
    } catch (error) {
      console.error("Error saving profile:", error);
      alert("Failed to save profile. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCountrySelect = (country: string) => {
    setUserLocation(country);
    setShowCountryList(false);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50 p-4"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.6)" }}
    >
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Welcome to SnapPair!
          </h2>
          <p className="text-gray-600">
            Help us personalize your experience by sharing some basic
            information.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              What is your gender?
            </label>
            <div className="grid grid-cols-3 gap-3">
              {["male", "female", "other"].map((gender) => (
                <button
                  key={gender}
                  type="button"
                  onClick={() => setUserGender(gender)}
                  className={`p-3 rounded-lg border-2 transition-all duration-200 ${
                    userGender === gender
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-gray-200 hover:border-gray-300 text-gray-700"
                  }`}
                >
                  <div className="text-center">
                    <div className="text-2xl mb-1">
                      {gender === "male"
                        ? "👨"
                        : gender === "female"
                        ? "👩"
                        : "🧑"}
                    </div>
                    <div className="text-sm font-medium capitalize">
                      {gender}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Your Location
            </label>

            {locationLoading ? (
              <div className="flex items-center justify-center p-4 bg-gray-50 rounded-lg">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                <span className="ml-2 text-gray-600">
                  Detecting your location...
                </span>
              </div>
            ) : (
              <div className="space-y-3">
                {detectedLocation && detectedLocation !== "Unknown" && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center">
                      <span className="text-green-600 mr-2">📍</span>
                      <span className="text-green-800 font-medium">
                        Detected: {detectedLocation}
                      </span>
                    </div>
                  </div>
                )}

                <div className="relative">
                  <label className="block text-xs text-gray-500 mb-1">
                    Select your country:
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowCountryList(!showCountryList)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-left bg-white"
                  >
                    {userLocation || "Select your country..."}
                    <span className="float-right">▼</span>
                  </button>

                  {showCountryList && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {COUNTRIES.map((country) => (
                        <button
                          key={country}
                          type="button"
                          onClick={() => handleCountrySelect(country)}
                          className="w-full text-left text-gray-900 p-3 hover:bg-blue-50 border-b border-gray-100 last:border-b-0"
                        >
                          {country}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-xs text-blue-800">
              <span className="font-medium">Privacy:</span> This information
              helps us match you with people based on your preferences.
            </p>
          </div>

          <button
            type="submit"
            disabled={
              loading || !userGender || !userLocation || locationLoading
            }
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
          >
            {loading ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Saving...
              </div>
            ) : (
              "Continue to SnapPair"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
