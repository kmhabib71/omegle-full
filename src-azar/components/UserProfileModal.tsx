"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";

// List of countries for the selection
const countries = [
  { code: "us", name: "United States" },
  { code: "gb", name: "United Kingdom" },
  { code: "ca", name: "Canada" },
  { code: "au", name: "Australia" },
  { code: "fr", name: "France" },
  { code: "de", name: "Germany" },
  { code: "jp", name: "Japan" },
  { code: "kr", name: "South Korea" },
  { code: "cn", name: "China" },
  { code: "in", name: "India" },
  { code: "br", name: "Brazil" },
  { code: "ru", name: "Russia" },
  { code: "es", name: "Spain" },
  { code: "it", name: "Italy" },
  { code: "mx", name: "Mexico" },
  { code: "za", name: "South Africa" },
  { code: "nl", name: "Netherlands" },
  { code: "se", name: "Sweden" },
  { code: "sg", name: "Singapore" },
  { code: "tr", name: "Turkey" },
];

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (userData: { gender: string; country: string }) => void;
}

export function UserProfileModal({
  isOpen,
  onClose,
  onSave,
}: UserProfileModalProps) {
  const [gender, setGender] = useState("male");
  const [country, setCountry] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Auto-detect user's country when modal opens
  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      fetch("https://ipwho.is/")
        .then((res) => res.json())
        .then((data) => {
          setCountry(data.country);
          setIsLoading(false);
        })
        .catch((error) => {
          console.error("Error detecting country:", error);
          setCountry("Unknown");
          setIsLoading(false);
        });
    }
  }, [isOpen]);

  const handleSave = () => {
    onSave({ gender, country });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-zinc-900 rounded-xl w-full max-w-md p-6 mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-white">
            Complete Your Profile
          </h2>
        </div>

        <p className="text-zinc-400 mb-6">
          Please select your gender to get started.
          {isLoading
            ? " Detecting your country..."
            : country
            ? ` We detected you're from ${country}.`
            : ""}
        </p>

        {/* Gender Selection */}
        <div className="mb-6">
          <h3 className="text-white font-medium mb-3">Your Gender</h3>
          <div className="space-y-3">
            <div
              className={`p-4 rounded-lg border-2 flex items-center gap-3 cursor-pointer ${
                gender === "male"
                  ? "bg-blue-600/20 border-blue-600"
                  : "border-zinc-700 bg-zinc-800/50"
              }`}
              onClick={() => setGender("male")}
            >
              <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6 text-white"
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
              </div>
              <div>
                <h3 className="font-medium text-white">Male</h3>
              </div>
            </div>

            <div
              className={`p-4 rounded-lg border-2 flex items-center gap-3 cursor-pointer ${
                gender === "female"
                  ? "bg-blue-600/20 border-blue-600"
                  : "border-zinc-700 bg-zinc-800/50"
              }`}
              onClick={() => setGender("female")}
            >
              <div className="w-10 h-10 rounded-full bg-pink-500 flex items-center justify-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6 text-white"
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
              </div>
              <div>
                <h3 className="font-medium text-white">Female</h3>
              </div>
            </div>

            <div
              className={`p-4 rounded-lg border-2 flex items-center gap-3 cursor-pointer ${
                gender === "other"
                  ? "bg-blue-600/20 border-blue-600"
                  : "border-zinc-700 bg-zinc-800/50"
              }`}
              onClick={() => setGender("other")}
            >
              <div className="w-10 h-10 rounded-full bg-purple-500 flex items-center justify-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6 text-white"
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
              </div>
              <div>
                <h3 className="font-medium text-white">Other</h3>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <Button
            onClick={handleSave}
            disabled={isLoading}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6"
          >
            {isLoading ? "Loading..." : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}
