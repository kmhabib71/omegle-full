"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";

// List of games for the filter
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
];

interface MatchInterestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (matchGames: string[] | null) => void;
  currentMatchInterest: string[] | null;
}

export function MatchInterestModal({
  isOpen,
  onClose,
  onSave,
  currentMatchInterest,
}: MatchInterestModalProps) {
  const [matchGames, setMatchGames] = useState<string[]>(
    currentMatchInterest || []
  );
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    setMatchGames(currentMatchInterest || []);
  }, [currentMatchInterest, isOpen]);

  const filteredGames = games.filter((game) =>
    game.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleToggleGame = useCallback(
    (gameId: string) => {
      setMatchGames((prev) => {
        const newGames = prev.includes(gameId)
          ? prev.filter((id) => id !== gameId)
          : [...prev, gameId];

        // Schedule auto-save for next tick to avoid render cycle issues
        setTimeout(() => {
          onSave(newGames.length === 0 ? null : newGames);
        }, 0);

        return newGames;
      });
    },
    [onSave]
  );

  const handleClearAll = useCallback(() => {
    setMatchGames([]);
    setTimeout(() => {
      onSave(null);
    }, 0);
  }, [onSave]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={onClose}
    >
      <div
        className="bg-zinc-900 rounded-xl w-full max-w-md p-6 mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-white">
            Select Game Preferences
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
          Choose what games you want to match on. Select multiple games to find
          users with similar gaming interests.
        </p>

        {/* Selected Games Counter */}
        <div className="flex justify-between items-center mb-4">
          <div className="text-white">
            <span className="font-medium">{matchGames.length}</span> games
            selected
          </div>
          {matchGames.length > 0 && (
            <Button
              variant="ghost"
              onClick={handleClearAll}
              className="text-xs text-zinc-400 hover:text-white px-2 py-1"
            >
              Clear All
            </Button>
          )}
        </div>

        {/* Match Game Selection */}
        <div className="mb-6">
          <h3 className="text-white font-medium mb-3">Select Games</h3>
          <div className="mb-4">
            <input
              type="text"
              placeholder="Search games..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full p-3 bg-zinc-800 border border-zinc-700 rounded-lg focus:outline-none focus:border-blue-500 text-white"
            />
          </div>

          <div className="max-h-60 overflow-y-auto space-y-2">
            {filteredGames.map((game) => (
              <div
                key={game.id}
                className={`p-3 rounded-lg border flex items-center gap-3 cursor-pointer ${
                  matchGames.includes(game.id)
                    ? "bg-blue-600/20 border-blue-600"
                    : "border-zinc-700 bg-zinc-800/50"
                }`}
                onClick={() => handleToggleGame(game.id)}
              >
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center overflow-hidden">
                    {matchGames.includes(game.id) ? (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5 text-white"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    ) : (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5 text-white"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </div>
                </div>
                <div className="text-white">{game.name}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-center mt-6">
          <Button
            onClick={onClose}
            variant="outline"
            className="border-zinc-700 text-zinc-300 hover:bg-zinc-700 py-3 px-8"
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
