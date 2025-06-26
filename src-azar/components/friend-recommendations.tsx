"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface User {
  id: number;
  name: string;
  username: string;
  country: string;
  avatar: string;
  isOnline: boolean;
  isPremium: boolean;
  matchPercentage: number;
  sharedInterests: string[];
  lastSeen?: string;
}

export function FriendRecommendations() {
  const [recommendations, setRecommendations] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Mock user interests for the current user (in a real app this would come from the user's profile)
  const myInterests = [
    'Photography', 'Travel', 'Music', 'Movies', 'Reading',
    'Gaming', 'Cooking', 'Fitness', 'Art', 'Technology'
  ];

  // Fetch recommendations when component mounts
  useEffect(() => {
    // Simulate API fetch delay
    const timer = setTimeout(() => {
      setRecommendations(getMockRecommendations());
      setIsLoading(false);
    }, 1200);

    return () => clearTimeout(timer);
  }, []);

  // Generate mock recommendations
  const getMockRecommendations = (): User[] => {
    // In a real app, this would be an API call to get personalized recommendations
    return [
      {
        id: 1,
        name: 'Jessica',
        username: 'jessica_k',
        country: 'South Korea',
        avatar: '👩',
        isOnline: true,
        isPremium: true,
        matchPercentage: 92,
        sharedInterests: ['Photography', 'Travel', 'Music']
      },
      {
        id: 2,
        name: 'Carlos',
        username: 'carlos_r',
        country: 'Spain',
        avatar: '👨',
        isOnline: false,
        isPremium: false,
        matchPercentage: 85,
        sharedInterests: ['Gaming', 'Movies', 'Technology'],
        lastSeen: '2 hours ago'
      },
      {
        id: 3,
        name: 'Emma',
        username: 'emma_w',
        country: 'United Kingdom',
        avatar: '👩‍🦰',
        isOnline: true,
        isPremium: true,
        matchPercentage: 78,
        sharedInterests: ['Reading', 'Art', 'Travel']
      },
      {
        id: 4,
        name: 'Ahmed',
        username: 'ahmed_h',
        country: 'Egypt',
        avatar: '👨‍🦱',
        isOnline: false,
        isPremium: false,
        matchPercentage: 74,
        sharedInterests: ['Cooking', 'Travel', 'Photography'],
        lastSeen: '1 day ago'
      },
      {
        id: 5,
        name: 'Priya',
        username: 'priya_s',
        country: 'India',
        avatar: '👩‍🎓',
        isOnline: true,
        isPremium: false,
        matchPercentage: 67,
        sharedInterests: ['Technology', 'Art', 'Reading']
      }
    ];
  };

  // Refresh recommendations
  const refreshRecommendations = () => {
    setIsLoading(true);

    // Simulate API fetch delay
    setTimeout(() => {
      // Simulate new recommendations by shuffling the existing ones
      const shuffled = [...recommendations].sort(() => 0.5 - Math.random());

      // Update match percentages slightly for demo effect
      const updated = shuffled.map(rec => ({
        ...rec,
        matchPercentage: Math.min(99, Math.max(60, rec.matchPercentage + Math.floor(Math.random() * 10) - 5))
      }));

      setRecommendations(updated);
      setIsLoading(false);
    }, 1000);
  };

  return (
    <div className="bg-zinc-900 rounded-xl overflow-hidden shadow-lg">
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 px-6 py-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold text-white">Recommended for You</h2>
          <Button
            onClick={refreshRecommendations}
            className="bg-white/20 hover:bg-white/30 text-white text-sm"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                Refreshing...
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh
              </>
            )}
          </Button>
        </div>
        <p className="text-blue-100 text-sm">
          People with similar interests you might want to connect with
        </p>
      </div>

      <div className="p-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-10">
            <div className="h-10 w-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-zinc-400">Finding people you'll click with...</p>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {recommendations.map(user => (
                <div key={user.id} className="bg-zinc-800 rounded-lg p-4 flex items-start">
                  <div className="relative flex-shrink-0 mr-3">
                    <div className={`w-12 h-12 flex items-center justify-center text-2xl rounded-full bg-gradient-to-r from-blue-600 to-purple-600`}>
                      {user.avatar}
                    </div>
                    {user.isOnline && (
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-zinc-800"></div>
                    )}
                  </div>

                  <div className="flex-grow">
                    <div className="flex justify-between">
                      <div>
                        <h3 className="text-white font-medium flex items-center">
                          {user.name}
                          {user.isPremium && (
                            <span className="ml-1 text-yellow-500">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                              </svg>
                            </span>
                          )}
                        </h3>
                        <p className="text-zinc-400 text-sm">@{user.username} • {user.country}</p>
                      </div>

                      <div className="flex items-start">
                        <div className="flex-shrink-0 bg-purple-900/60 text-purple-300 text-xs font-medium px-2 py-1 rounded-full flex items-center">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                          </svg>
                          {user.matchPercentage}% match
                        </div>
                      </div>
                    </div>

                    <div className="mt-2">
                      <div className="text-zinc-400 text-xs mb-1">Common interests:</div>
                      <div className="flex flex-wrap gap-1">
                        {user.sharedInterests.map((interest, idx) => (
                          <span key={idx} className="bg-blue-900/30 text-blue-300 text-xs px-2 py-1 rounded-full">
                            {interest}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-3">
                      <div className="text-xs text-zinc-500">
                        {user.isOnline ? 'Online now' : `Last seen ${user.lastSeen}`}
                      </div>

                      <div className="flex space-x-2">
                        <Button className="bg-purple-600 hover:bg-purple-700 text-white text-xs h-8 px-3">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                          </svg>
                          Message
                        </Button>
                        <Button className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-8 px-3">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          Video Chat
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 text-center">
              <Link href="/search" className="text-blue-400 hover:text-blue-300 text-sm flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
                See more recommendations
              </Link>
            </div>
          </>
        )}
      </div>

      <div className="bg-zinc-800 px-4 py-3 flex justify-between items-center text-sm">
        <div className="text-zinc-400">
          Recommendations based on your interests
        </div>

        <Link href="/profile" className="text-blue-400 hover:text-blue-300">
          Update interests
        </Link>
      </div>
    </div>
  );
}

// Interest Selection Component for profile page
interface InterestOption {
  id: string;
  name: string;
  category: string;
}

interface InterestSelectorProps {
  selectedInterests: string[];
  onInterestsChange: (interests: string[]) => void;
  maxSelections?: number;
}

export function InterestSelector({
  selectedInterests,
  onInterestsChange,
  maxSelections = 10
}: InterestSelectorProps) {
  const [searchQuery, setSearchQuery] = useState("");

  // Sample interest options grouped by category
  const interestOptions: InterestOption[] = [
    // Activities
    { id: 'travel', name: 'Travel', category: 'Activities' },
    { id: 'hiking', name: 'Hiking', category: 'Activities' },
    { id: 'camping', name: 'Camping', category: 'Activities' },
    { id: 'yoga', name: 'Yoga', category: 'Activities' },
    { id: 'fitness', name: 'Fitness', category: 'Activities' },
    { id: 'running', name: 'Running', category: 'Activities' },
    { id: 'swimming', name: 'Swimming', category: 'Activities' },
    { id: 'cycling', name: 'Cycling', category: 'Activities' },

    // Arts & Entertainment
    { id: 'movies', name: 'Movies', category: 'Arts & Entertainment' },
    { id: 'music', name: 'Music', category: 'Arts & Entertainment' },
    { id: 'reading', name: 'Reading', category: 'Arts & Entertainment' },
    { id: 'art', name: 'Art', category: 'Arts & Entertainment' },
    { id: 'photography', name: 'Photography', category: 'Arts & Entertainment' },
    { id: 'dancing', name: 'Dancing', category: 'Arts & Entertainment' },
    { id: 'singing', name: 'Singing', category: 'Arts & Entertainment' },
    { id: 'theatre', name: 'Theatre', category: 'Arts & Entertainment' },

    // Food & Drink
    { id: 'cooking', name: 'Cooking', category: 'Food & Drink' },
    { id: 'baking', name: 'Baking', category: 'Food & Drink' },
    { id: 'coffee', name: 'Coffee', category: 'Food & Drink' },
    { id: 'wine', name: 'Wine', category: 'Food & Drink' },
    { id: 'foodie', name: 'Foodie', category: 'Food & Drink' },
    { id: 'vegan', name: 'Vegan', category: 'Food & Drink' },

    // Technology
    { id: 'technology', name: 'Technology', category: 'Technology' },
    { id: 'programming', name: 'Programming', category: 'Technology' },
    { id: 'gaming', name: 'Gaming', category: 'Technology' },
    { id: 'ai', name: 'AI', category: 'Technology' },
    { id: 'crypto', name: 'Cryptocurrency', category: 'Technology' },

    // Other
    { id: 'pets', name: 'Pets', category: 'Other' },
    { id: 'dogs', name: 'Dogs', category: 'Other' },
    { id: 'cats', name: 'Cats', category: 'Other' },
    { id: 'volunteer', name: 'Volunteering', category: 'Other' },
    { id: 'astrology', name: 'Astrology', category: 'Other' },
    { id: 'spirituality', name: 'Spirituality', category: 'Other' },
    { id: 'meditation', name: 'Meditation', category: 'Other' },
  ];

  // Filter interests by search query
  const filteredInterests = searchQuery.trim() === ""
    ? interestOptions
    : interestOptions.filter(interest =>
        interest.name.toLowerCase().includes(searchQuery.toLowerCase())
      );

  // Group interests by category
  const groupedInterests = filteredInterests.reduce((acc, interest) => {
    if (!acc[interest.category]) {
      acc[interest.category] = [];
    }
    acc[interest.category].push(interest);
    return acc;
  }, {} as Record<string, InterestOption[]>);

  // Toggle interest selection
  const toggleInterest = (interestId: string) => {
    if (selectedInterests.includes(interestId)) {
      // Remove interest
      onInterestsChange(selectedInterests.filter(id => id !== interestId));
    } else if (selectedInterests.length < maxSelections) {
      // Add interest if under max limit
      onInterestsChange([...selectedInterests, interestId]);
    }
  };

  return (
    <div>
      <div className="mb-4">
        <h3 className="text-white font-medium mb-2">Your Interests ({selectedInterests.length}/{maxSelections})</h3>
        <p className="text-zinc-400 text-sm mb-4">
          Select interests to help us find people you'll click with.
        </p>

        <div className="relative mb-4">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search interests..."
            className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-4 py-2 pl-10 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          {selectedInterests.map(interestId => {
            const interest = interestOptions.find(opt => opt.id === interestId);
            if (!interest) return null;

            return (
              <div
                key={interest.id}
                className="bg-blue-600 text-white text-sm px-3 py-1 rounded-full flex items-center"
              >
                {interest.name}
                <button
                  onClick={() => toggleInterest(interest.id)}
                  className="ml-2 text-white/80 hover:text-white"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            );
          })}

          {selectedInterests.length === 0 && (
            <div className="text-zinc-500 text-sm">No interests selected yet</div>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {Object.entries(groupedInterests).map(([category, interests]) => (
          <div key={category}>
            <h4 className="text-zinc-300 font-medium mb-2">{category}</h4>
            <div className="flex flex-wrap gap-2">
              {interests.map(interest => (
                <button
                  key={interest.id}
                  onClick={() => toggleInterest(interest.id)}
                  disabled={selectedInterests.length >= maxSelections && !selectedInterests.includes(interest.id)}
                  className={`
                    text-sm px-3 py-1 rounded-full
                    ${selectedInterests.includes(interest.id)
                      ? 'bg-blue-600 text-white'
                      : selectedInterests.length >= maxSelections
                        ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                        : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                    }
                  `}
                >
                  {interest.name}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
