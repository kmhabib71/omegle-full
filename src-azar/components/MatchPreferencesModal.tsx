"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";

// List of countries for the filter
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

interface MatchPreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (preferences: {
    matchGender: string;
    matchCountry: string | null;
  }) => void;
  onStartChat: () => void;
  currentPreferences: {
    matchGender: string;
    matchCountry: string | null;
  };
}

export function MatchPreferencesModal({
  isOpen,
  onClose,
  onSave,
  onStartChat,
  currentPreferences,
}: MatchPreferencesModalProps) {
  const [matchGender, setMatchGender] = useState(
    currentPreferences.matchGender || "all"
  );
  const [matchCountry, setMatchCountry] = useState<string | null>(
    currentPreferences.matchCountry || null
  );
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    setMatchGender(currentPreferences.matchGender || "all");
    setMatchCountry(currentPreferences.matchCountry || null);
  }, [currentPreferences, isOpen]);

  const filteredCountries = countries.filter((country) =>
    country.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSave = () => {
    onSave({ matchGender, matchCountry });
    onClose();
  };

  const handleStartChat = () => {
    onSave({ matchGender, matchCountry });
    onStartChat();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-zinc-900 rounded-xl w-full max-w-md p-6 mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-white">
            Match Preferences
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
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
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <p className="text-zinc-400 mb-6">
          Choose who you want to be matched with.
        </p>

        {/* Match Gender Selection */}
        <div className="mb-6">
          <h3 className="text-white font-medium mb-3">I Want to Match With</h3>
          <div className="space-y-3">
            <div
              className={`p-4 rounded-lg border-2 flex items-center gap-3 cursor-pointer ${
                matchGender === "all"
                  ? "bg-blue-600/20 border-blue-600"
                  : "border-zinc-700 bg-zinc-800/50"
              }`}
              onClick={() => setMatchGender("all")}
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
                    d="M12 6v12m-8-6h16"
                  />
                </svg>
              </div>
              <div>
                <h3 className="font-medium text-white">Everyone</h3>
                <p className="text-sm text-gray-400">Match with anyone</p>
              </div>
            </div>

            <div
              className={`p-4 rounded-lg border-2 flex items-center gap-3 cursor-pointer ${
                matchGender === "male"
                  ? "bg-blue-600/20 border-blue-600"
                  : "border-zinc-700 bg-zinc-800/50"
              }`}
              onClick={() => setMatchGender("male")}
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
                <h3 className="font-medium text-white">Men</h3>
                <p className="text-sm text-gray-400">Match with men only</p>
              </div>
            </div>

            <div
              className={`p-4 rounded-lg border-2 flex items-center gap-3 cursor-pointer ${
                matchGender === "female"
                  ? "bg-blue-600/20 border-blue-600"
                  : "border-zinc-700 bg-zinc-800/50"
              }`}
              onClick={() => setMatchGender("female")}
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
                <h3 className="font-medium text-white">Women</h3>
                <p className="text-sm text-gray-400">Match with women only</p>
              </div>
            </div>
          </div>
        </div>

        {/* Match Country Selection */}
        <div className="mb-6">
          <h3 className="text-white font-medium mb-3">Match From Country</h3>
          <div className="mb-4">
            <input
              type="text"
              placeholder="Search countries..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full p-3 bg-zinc-800 border border-zinc-700 rounded-lg focus:outline-none focus:border-blue-500 text-white"
            />
          </div>

          <div
            className={`p-4 rounded-lg border-2 flex items-center gap-3 cursor-pointer mb-3 ${
              matchCountry === null
                ? "bg-blue-600/20 border-blue-600"
                : "border-zinc-700 bg-zinc-800/50"
            }`}
            onClick={() => setMatchCountry(null)}
          >
            <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center">
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
                  d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064"
                />
              </svg>
            </div>
            <div>
              <h3 className="font-medium text-white">Any Country</h3>
              <p className="text-sm text-gray-400">
                Match with users from any country
              </p>
            </div>
          </div>

          <div className="max-h-60 overflow-y-auto space-y-2">
            {filteredCountries.map((country) => (
              <div
                key={country.code}
                className={`p-3 rounded-lg border flex items-center gap-3 cursor-pointer ${
                  matchCountry === country.name
                    ? "bg-blue-600/20 border-blue-600"
                    : "border-zinc-700 bg-zinc-800/50"
                }`}
                onClick={() => setMatchCountry(country.name)}
              >
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center overflow-hidden">
                    <span className="text-lg">
                      {country.code
                        .toUpperCase()
                        .split("")
                        .map((c) =>
                          String.fromCodePoint(c.charCodeAt(0) + 127397)
                        )
                        .join("")}
                    </span>
                  </div>
                </div>
                <div className="text-white">{country.name}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3 mt-6">
          <Button
            onClick={handleStartChat}
            className="bg-blue-600 hover:bg-blue-700 text-white py-6 text-lg flex items-center justify-center gap-3"
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
                d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
            Start Video Chat
          </Button>

          <Button
            variant="outline"
            onClick={handleSave}
            className="border-zinc-700 text-zinc-300"
          >
            Save Preferences
          </Button>
        </div>
      </div>
    </div>
  );
}
