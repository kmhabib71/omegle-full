"use client";

import { useCallback } from "react";
import { useSession } from "next-auth/react";

interface PreferenceModalProps {
  showGenderModal: boolean;
  showCountryModal: boolean;
  showGameModal: boolean;
  matchPreferences: {
    matchGender: string;
    matchCountry: string | null;
    matchInterest: string[] | null;
  };
  onGenderChange: (gender: string) => void;
  onCountryChange: (country: string | null) => void;
  onGameChange: (gameId: string, isSelected: boolean) => void;
  onClearAllGames: () => void;
  onCloseModal: (modalType: "gender" | "country" | "game") => void;
  onModalOutsideClick: (e: React.MouseEvent, modalType: string) => void;
  showDoneButton?: boolean;
  onDone?: () => void;
}

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
  { id: "singing", name: "Singing" },
  { id: "dancing", name: "Dancing" },
  { id: "cooking", name: "Cooking" },
  { id: "sports", name: "Sports" },
  { id: "music", name: "Music" },
  { id: "movies", name: "Movies" },
  { id: "books", name: "Books" },
  { id: "travel", name: "Travel" },
  { id: "photography", name: "Photography" },
  { id: "art", name: "Art" },
];

export function PreferenceModals({
  showGenderModal,
  showCountryModal,
  showGameModal,
  matchPreferences,
  onGenderChange,
  onCountryChange,
  onGameChange,
  onClearAllGames,
  onCloseModal,
  onModalOutsideClick,
  showDoneButton = false,
  onDone,
}: PreferenceModalProps) {
  const { data: session } = useSession();

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

  const handleGenderChange = useCallback(
    (gender: string) => {
      onGenderChange(gender);
      localStorage.setItem("snappairGenderFilter", gender);

      // Save to database if authenticated
      if (session?.user?.email) {
        savePreferencesToDatabase({ matchGender: gender });
      }

      if (!showDoneButton) {
        onCloseModal("gender");
      }
    },
    [onGenderChange, session?.user?.email, showDoneButton, onCloseModal]
  );

  const handleCountryChange = useCallback(
    (country: string | null) => {
      onCountryChange(country);
      if (country) {
        localStorage.setItem("snappairCountryFilter", country);
      } else {
        localStorage.removeItem("snappairCountryFilter");
      }

      // Save to database if authenticated
      if (session?.user?.email) {
        savePreferencesToDatabase({ matchCountry: country });
      }

      if (!showDoneButton) {
        onCloseModal("country");
      }
    },
    [onCountryChange, session?.user?.email, showDoneButton, onCloseModal]
  );

  const handleGameChange = useCallback(
    (gameId: string, isSelected: boolean) => {
      onGameChange(gameId, isSelected);

      // Get current games and update
      const currentGames = matchPreferences.matchInterest || [];
      let newGames: string[];

      if (isSelected) {
        newGames = [...currentGames, gameId];
      } else {
        newGames = currentGames.filter((g) => g !== gameId);
      }

      const finalGames = newGames.length > 0 ? newGames : null;

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
    },
    [onGameChange, matchPreferences.matchInterest, session?.user?.email]
  );

  const handleClearAllGames = useCallback(() => {
    onClearAllGames();
    localStorage.removeItem("snappairInterestFilter");

    // Save to database if authenticated
    if (session?.user?.email) {
      savePreferencesToDatabase({ matchInterest: null });
    }
  }, [onClearAllGames, session?.user?.email]);

  const handleDone = useCallback(() => {
    if (onDone) {
      onDone();
    }
  }, [onDone]);

  return (
    <>
      {/* Gender Modal */}
      {showGenderModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={(e) => onModalOutsideClick(e, "gender")}
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
              {showDoneButton ? (
                <button
                  onClick={handleDone}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-lg font-medium transition-colors"
                >
                  Done & Restart Search
                </button>
              ) : (
                <button
                  onClick={() => onCloseModal("gender")}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-lg font-medium transition-colors"
                >
                  Done
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Country Modal */}
      {showCountryModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={(e) => onModalOutsideClick(e, "country")}
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
                  { id: "Australia", label: "Australia" },
                  { id: "Germany", label: "Germany" },
                  { id: "France", label: "France" },
                  { id: "Japan", label: "Japan" },
                  { id: "India", label: "India" },
                  { id: "Brazil", label: "Brazil" },
                  { id: "Bangladesh", label: "Bangladesh" },
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
              {showDoneButton ? (
                <button
                  onClick={handleDone}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-lg font-medium transition-colors"
                >
                  Done & Restart Search
                </button>
              ) : (
                <button
                  onClick={() => onCloseModal("country")}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-lg font-medium transition-colors"
                >
                  Done
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Game Modal */}
      {showGameModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={(e) => onModalOutsideClick(e, "game")}
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
              {showDoneButton ? (
                <button
                  onClick={handleDone}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-lg font-medium transition-colors"
                >
                  Done & Restart Search
                </button>
              ) : (
                <button
                  onClick={() => onCloseModal("game")}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-lg font-medium transition-colors"
                >
                  Done
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
