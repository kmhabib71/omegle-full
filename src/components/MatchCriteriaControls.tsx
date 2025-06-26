"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "./ui/button";

interface MatchCriteria {
  gender: string | null;
  country: string | null;
  interests: string[];
}

interface MatchCriteriaControlsProps {
  isVisible: boolean;
  currentCriteria: MatchCriteria;
  onCriteriaUpdate: (criteria: MatchCriteria) => void;
  onStopSearch: () => void;
}

export function MatchCriteriaControls({
  isVisible,
  currentCriteria,
  onCriteriaUpdate,
  onStopSearch,
}: MatchCriteriaControlsProps) {
  const [showGenderModal, setShowGenderModal] = useState(false);
  const [showCountryModal, setShowCountryModal] = useState(false);
  const [showInterestModal, setShowInterestModal] = useState(false);

  const [tempGender, setTempGender] = useState(currentCriteria.gender || "all");
  const [tempCountry, setTempCountry] = useState(currentCriteria.country || "");
  const [tempInterests, setTempInterests] = useState<string[]>(
    currentCriteria.interests || []
  );
  const [newInterest, setNewInterest] = useState("");

  useEffect(() => {
    setTempGender(currentCriteria.gender || "all");
    setTempCountry(currentCriteria.country || "");
    setTempInterests(currentCriteria.interests || []);
  }, [currentCriteria]);

  const handleGenderUpdate = useCallback(
    async (gender: string) => {
      const updatedCriteria = {
        ...currentCriteria,
        gender: gender === "all" ? null : gender,
      };

      // Update localStorage
      localStorage.setItem("snappairMatchGender", gender);

      // Update database
      try {
        await fetch("/api/users/match-preferences", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ matchGender: gender }),
        });
      } catch (error) {
        console.error("Error updating gender preference:", error);
      }

      onCriteriaUpdate(updatedCriteria);
      setShowGenderModal(false);
    },
    [currentCriteria, onCriteriaUpdate]
  );

  const handleCountryUpdate = useCallback(
    async (country: string) => {
      const updatedCriteria = {
        ...currentCriteria,
        country: country || null,
      };

      // Update localStorage
      localStorage.setItem("snappairMatchCountry", country);

      // Update database
      try {
        await fetch("/api/users/match-preferences", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ matchCountry: country }),
        });
      } catch (error) {
        console.error("Error updating country preference:", error);
      }

      onCriteriaUpdate(updatedCriteria);
      setShowCountryModal(false);
    },
    [currentCriteria, onCriteriaUpdate]
  );

  const handleInterestUpdate = useCallback(
    async (interests: string[]) => {
      const updatedCriteria = {
        ...currentCriteria,
        interests,
      };

      // Update localStorage
      localStorage.setItem("snappairMatchInterests", JSON.stringify(interests));

      // Update database
      try {
        await fetch("/api/users/match-preferences", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ matchInterest: interests }),
        });
      } catch (error) {
        console.error("Error updating interest preference:", error);
      }

      onCriteriaUpdate(updatedCriteria);
      setShowInterestModal(false);
    },
    [currentCriteria, onCriteriaUpdate]
  );

  const addInterest = () => {
    if (newInterest.trim() && !tempInterests.includes(newInterest.trim())) {
      setTempInterests([...tempInterests, newInterest.trim()]);
      setNewInterest("");
    }
  };

  const removeInterest = (interest: string) => {
    setTempInterests(tempInterests.filter((i) => i !== interest));
  };

  if (!isVisible) return null;

  return (
    <>
      {/* Match Criteria Buttons */}
      <div className="flex flex-wrap justify-center gap-3 mb-4">
        <Button
          variant="outline"
          className="rounded-full px-4 py-2 flex items-center justify-center gap-2 text-sm border-zinc-700 bg-zinc-800/70 hover:bg-zinc-700/80"
          onClick={() => {
            onStopSearch();
            setShowGenderModal(true);
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
          Match Gender: {currentCriteria.gender || "All"}
        </Button>

        <Button
          variant="outline"
          className="rounded-full px-4 py-2 flex items-center justify-center gap-2 text-sm border-zinc-700 bg-zinc-800/70 hover:bg-zinc-700/80"
          onClick={() => {
            onStopSearch();
            setShowCountryModal(true);
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
          Match Country: {currentCriteria.country || "All"}
        </Button>

        <Button
          variant="outline"
          className="rounded-full px-4 py-2 flex items-center justify-center gap-2 text-sm border-zinc-700 bg-zinc-800/70 hover:bg-zinc-700/80"
          onClick={() => {
            onStopSearch();
            setShowInterestModal(true);
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
                d="M4 6h16M4 12h16m-7 6h7"
              />
            </svg>
          </span>
          Interests: {currentCriteria.interests?.length || 0}
        </Button>
      </div>

      {/* Gender Modal */}
      {showGenderModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-zinc-900 rounded-xl w-full max-w-md p-6 mx-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-white">
                Match Gender Preference
              </h2>
              <button
                onClick={() => setShowGenderModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <svg
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

            <div className="space-y-3">
              {["all", "male", "female"].map((gender) => (
                <button
                  key={gender}
                  onClick={() => handleGenderUpdate(gender)}
                  className={`w-full p-3 rounded-lg text-left transition-colors ${
                    tempGender === gender
                      ? "bg-blue-600 text-white"
                      : "bg-zinc-800 text-gray-300 hover:bg-zinc-700"
                  }`}
                >
                  {gender === "all"
                    ? "All Genders"
                    : gender.charAt(0).toUpperCase() + gender.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Country Modal */}
      {showCountryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-zinc-900 rounded-xl w-full max-w-md p-6 mx-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-white">
                Match Country Preference
              </h2>
              <button
                onClick={() => setShowCountryModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <svg
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

            <div className="mb-4">
              <input
                type="text"
                value={tempCountry}
                onChange={(e) => setTempCountry(e.target.value)}
                placeholder="Enter country name or leave empty for all"
                className="w-full p-3 bg-zinc-800 text-white rounded-lg border border-zinc-700 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => handleCountryUpdate(tempCountry)}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg"
              >
                Save
              </button>
              <button
                onClick={() => handleCountryUpdate("")}
                className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded-lg"
              >
                All Countries
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Interest Modal */}
      {showInterestModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-zinc-900 rounded-xl w-full max-w-md p-6 mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-white">
                Match Interests
              </h2>
              <button
                onClick={() => setShowInterestModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <svg
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

            <div className="mb-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newInterest}
                  onChange={(e) => setNewInterest(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addInterest();
                    }
                  }}
                  placeholder="Add an interest..."
                  className="flex-1 p-3 bg-zinc-800 text-white rounded-lg border border-zinc-700 focus:border-blue-500 focus:outline-none"
                />
                <button
                  onClick={addInterest}
                  disabled={!newInterest.trim()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg"
                >
                  Add
                </button>
              </div>
            </div>

            <div className="mb-4">
              <h3 className="text-white mb-2">Current Interests:</h3>
              <div className="flex flex-wrap gap-2 min-h-[60px]">
                {tempInterests.length === 0 ? (
                  <div className="text-gray-400 text-sm">
                    No interests added. Leave empty for random matching.
                  </div>
                ) : (
                  tempInterests.map((interest) => (
                    <span
                      key={interest}
                      className="px-3 py-1 bg-blue-600 text-white rounded-full text-sm flex items-center gap-2"
                    >
                      {interest}
                      <button
                        onClick={() => removeInterest(interest)}
                        className="hover:bg-blue-700 rounded-full w-5 h-5 flex items-center justify-center text-xs"
                      >
                        ×
                      </button>
                    </span>
                  ))
                )}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => handleInterestUpdate(tempInterests)}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg"
              >
                Save Interests
              </button>
              <button
                onClick={() => handleInterestUpdate([])}
                className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded-lg"
              >
                Clear All
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
