class MatchingEngine {
  constructor() {
    this.users = new Map();
    this.waitingQueues = {
      gender: new Map(),
      location: new Map(),
      games: new Map(),
      general: [],
    };
    this.recentPartners = new Map();
    this.exactMatchQueue = [];
    this.twoMatchQueues = {
      genderLocation: [],
      genderGames: [],
      locationGames: [],
    };
    this.singleMatchQueues = {
      gender: [],
      location: [],
      games: [],
    };
    this.generalQueue = [];
    this.activeMatches = new Map();
    this.manualStops = new Set();
  }

  addUser(socketId, profile) {
    console.log("Adding user to matching engine:", { socketId, profile });

    // Remove user from any existing state
    this.removeUser(socketId);

    // Clear manual stop flag
    this.manualStops.delete(socketId);

    const {
      userGender = null,
      userLocation = null,
      matchGender = "all",
      matchLocation = null,
      matchGames = [],
    } = profile;

    const userProfile = {
      socketId,
      userGender,
      userLocation,
      matchGender,
      matchLocation,
      matchGames,
      timestamp: Date.now(),
    };

    // Store user in users map first
    this.users.set(socketId, userProfile);

    // Try to find a match
    const matchResult = this.findMatch(userProfile);

    if (matchResult) {
      return this.createMatch(
        userProfile,
        matchResult.match,
        matchResult.reason
      );
    }

    // Add to appropriate queue if no match found
    this.addToQueue(userProfile);
    return null;
  }

  removeUser(socketId) {
    this.removeFromAllQueues(socketId);
    this.users.delete(socketId);
    this.recentPartners.delete(socketId);
    console.log(`👤 User ${socketId} removed from matching engine`);
  }

  findMatch(userProfile) {
    console.log("🔍 Finding match for user:", userProfile);
    console.log("📊 Current queue sizes:", this.getQueueSizes());

    let match = this.findExactMatch(userProfile);
    if (match) {
      console.log("✅ Found exact match:", match);
      return {
        match,
        reason:
          "Perfect match - All preferences matched (gender, location, and games)",
      };
    }

    match = this.findTwoPreferenceMatch(userProfile);
    if (match) {
      console.log("✅ Found two-preference match:", match);
      const matchType = this.getTwoPreferenceMatchType(userProfile, match);
      return {
        match,
        reason: `Good match - Two preferences matched (${matchType})`,
      };
    }

    match = this.findSinglePreferenceMatch(userProfile);
    if (match) {
      console.log("✅ Found single-preference match:", match);
      const matchType = this.getSinglePreferenceMatchType(userProfile, match);
      return {
        match,
        reason: `Basic match - One preference matched (${matchType})`,
      };
    }

    match = this.findGeneralMatch(userProfile);
    if (match) {
      console.log("✅ Found general match:", match);
      return {
        match,
        reason:
          "Random match - No specific preferences matched, but both users are available",
      };
    }

    console.log("❌ No match found for user:", userProfile.socketId);
    return null;
  }

  getTwoPreferenceMatchType(userProfile, match) {
    if (
      this.matchesGender(userProfile, match) &&
      this.matchesLocation(userProfile, match)
    ) {
      return "gender and location";
    } else if (
      this.matchesGender(userProfile, match) &&
      this.matchesGames(userProfile, match)
    ) {
      return "gender and games";
    } else if (
      this.matchesLocation(userProfile, match) &&
      this.matchesGames(userProfile, match)
    ) {
      return "location and games";
    }
    return "unknown";
  }

  getSinglePreferenceMatchType(userProfile, match) {
    if (this.matchesGender(userProfile, match)) {
      return "gender";
    } else if (this.matchesLocation(userProfile, match)) {
      return "location";
    } else if (this.matchesGames(userProfile, match)) {
      return "games";
    }
    return "unknown";
  }

  findExactMatch(userProfile) {
    return this.exactMatchQueue.find(
      (candidate) =>
        this.isValidMatch(userProfile, candidate) &&
        this.matchesAllPreferences(userProfile, candidate) &&
        this.matchesAllPreferences(candidate, userProfile)
    );
  }

  findTwoPreferenceMatch(userProfile) {
    let match = this.twoMatchQueues.genderLocation.find(
      (candidate) =>
        this.isValidMatch(userProfile, candidate) &&
        this.matchesGenderAndLocation(userProfile, candidate) &&
        this.matchesGenderAndLocation(candidate, userProfile)
    );
    if (match) return match;

    match = this.twoMatchQueues.genderGames.find(
      (candidate) =>
        this.isValidMatch(userProfile, candidate) &&
        this.matchesGenderAndGames(userProfile, candidate) &&
        this.matchesGenderAndGames(candidate, userProfile)
    );
    if (match) return match;

    match = this.twoMatchQueues.locationGames.find(
      (candidate) =>
        this.isValidMatch(userProfile, candidate) &&
        this.matchesLocationAndGames(userProfile, candidate) &&
        this.matchesLocationAndGames(candidate, userProfile)
    );
    if (match) return match;

    return null;
  }

  findSinglePreferenceMatch(userProfile) {
    console.log("🔍 Checking single preference matches...");

    let match = this.singleMatchQueues.gender.find((candidate) => {
      console.log(`🔍 Checking gender queue candidate: ${candidate.socketId}`);
      return (
        this.isValidMatch(userProfile, candidate) &&
        this.matchesGender(userProfile, candidate) &&
        this.matchesGender(candidate, userProfile)
      );
    });
    if (match) {
      console.log("✅ Found gender preference match");
      return match;
    }

    match = this.singleMatchQueues.location.find((candidate) => {
      console.log(
        `🔍 Checking location queue candidate: ${candidate.socketId}`
      );
      return (
        this.isValidMatch(userProfile, candidate) &&
        this.matchesLocation(userProfile, candidate) &&
        this.matchesLocation(candidate, userProfile)
      );
    });
    if (match) {
      console.log("✅ Found location preference match");
      return match;
    }

    match = this.singleMatchQueues.games.find((candidate) => {
      console.log(`🔍 Checking games queue candidate: ${candidate.socketId}`);
      return (
        this.isValidMatch(userProfile, candidate) &&
        this.matchesGames(userProfile, candidate) &&
        this.matchesGames(candidate, userProfile)
      );
    });
    if (match) {
      console.log("✅ Found games preference match");
      return match;
    }

    console.log("❌ No single preference matches found");
    return null;
  }

  findGeneralMatch(userProfile) {
    console.log("🔍 Checking general queue matches...");
    const match = this.generalQueue.find((candidate) => {
      console.log(`🔍 Checking general queue candidate: ${candidate.socketId}`);
      return this.isValidMatch(userProfile, candidate);
    });

    if (match) {
      console.log("✅ Found general match");
    } else {
      console.log("❌ No general matches found");
    }

    return match;
  }

  matchesGender(userProfile, candidate) {
    // If candidate has no gender preference, they match with anyone
    if (
      !candidate.matchGender ||
      candidate.matchGender === "any" ||
      candidate.matchGender === "all" ||
      candidate.matchGender === null
    ) {
      return true;
    }

    // If user has no gender, they can only match with those who have no gender preference
    if (!userProfile.userGender || userProfile.userGender === null) {
      return (
        candidate.matchGender === "any" ||
        candidate.matchGender === "all" ||
        candidate.matchGender === null
      );
    }

    // Both have gender data, check if they match
    return candidate.matchGender === userProfile.userGender;
  }

  matchesLocation(userProfile, candidate) {
    if (
      !candidate.matchLocation ||
      candidate.matchLocation === "any" ||
      candidate.matchLocation === null
    ) {
      return true;
    }

    if (!userProfile.userLocation || userProfile.userLocation === null) {
      return (
        candidate.matchLocation === "any" || candidate.matchLocation === null
      );
    }

    return candidate.matchLocation === userProfile.userLocation;
  }

  matchesGames(userProfile, candidate) {
    if (!candidate.matchGames || candidate.matchGames.length === 0) return true;
    if (!userProfile.matchGames || userProfile.matchGames.length === 0)
      return true;

    return candidate.matchGames.some((game) =>
      userProfile.matchGames.includes(game)
    );
  }

  matchesGenderAndLocation(userProfile, candidate) {
    return (
      this.matchesGender(userProfile, candidate) &&
      this.matchesLocation(userProfile, candidate)
    );
  }

  matchesGenderAndGames(userProfile, candidate) {
    return (
      this.matchesGender(userProfile, candidate) &&
      this.matchesGames(userProfile, candidate)
    );
  }

  matchesLocationAndGames(userProfile, candidate) {
    return (
      this.matchesLocation(userProfile, candidate) &&
      this.matchesGames(userProfile, candidate)
    );
  }

  matchesAllPreferences(userProfile, candidate) {
    return (
      this.matchesGender(userProfile, candidate) &&
      this.matchesLocation(userProfile, candidate) &&
      this.matchesGames(userProfile, candidate)
    );
  }

  isValidMatch(userProfile, candidate) {
    // Check if they were recent partners
    const recentPartners =
      this.recentPartners.get(userProfile.socketId) || new Set();
    if (recentPartners.has(candidate.socketId)) {
      return false;
    }

    // Check if candidate is in manual stop
    if (this.manualStops.has(candidate.socketId)) {
      return false;
    }

    return true;
  }

  addToQueue(userProfile) {
    const { matchGender, matchLocation, matchGames } = userProfile;

    const hasGenderPref =
      matchGender &&
      matchGender !== "any" &&
      matchGender !== "all" &&
      matchGender !== null;
    const hasLocationPref =
      matchLocation && matchLocation !== "any" && matchLocation !== null;
    const hasGamesPref = matchGames && matchGames.length > 0;

    console.log(
      `📝 Adding ${userProfile.socketId} to queue. Preferences: gender=${
        hasGenderPref ? matchGender : "none"
      }, location=${hasLocationPref ? matchLocation : "none"}, games=${
        hasGamesPref ? matchGames.join(",") : "none"
      }`
    );

    if (hasGenderPref && hasLocationPref && hasGamesPref) {
      this.exactMatchQueue.push(userProfile);
      console.log(`➡️ Added to exact match queue`);
    } else if (hasGenderPref && hasLocationPref) {
      this.twoMatchQueues.genderLocation.push(userProfile);
      console.log(`➡️ Added to gender+location queue`);
    } else if (hasGenderPref && hasGamesPref) {
      this.twoMatchQueues.genderGames.push(userProfile);
      console.log(`➡️ Added to gender+games queue`);
    } else if (hasLocationPref && hasGamesPref) {
      this.twoMatchQueues.locationGames.push(userProfile);
      console.log(`➡️ Added to location+games queue`);
    } else if (hasGenderPref) {
      this.singleMatchQueues.gender.push(userProfile);
      console.log(`➡️ Added to gender queue`);
    } else if (hasLocationPref) {
      this.singleMatchQueues.location.push(userProfile);
      console.log(`➡️ Added to location queue`);
    } else if (hasGamesPref) {
      this.singleMatchQueues.games.push(userProfile);
      console.log(`➡️ Added to games queue`);
    } else {
      this.generalQueue.push(userProfile);
      console.log(`➡️ Added to general queue`);
    }

    console.log(
      "📊 Current queue sizes after adding user:",
      this.getQueueSizes()
    );
  }

  createMatch(user1, user2, reason = "Match found") {
    // Remove from queues but keep user profiles
    this.removeFromAllQueues(user1.socketId);
    this.removeFromAllQueues(user2.socketId);

    const matchId = `${user1.socketId}-${user2.socketId}-${Date.now()}`;
    const matchInfo = {
      matchId,
      user1: user1.socketId,
      user2: user2.socketId,
      startTime: Date.now(),
      reason,
    };

    // Set up match info
    this.activeMatches.set(user1.socketId, matchInfo);
    this.activeMatches.set(user2.socketId, matchInfo);

    // Update user profiles with partner information
    user1.partnerId = user2.socketId;
    user2.partnerId = user1.socketId;

    // Store updated profiles
    this.users.set(user1.socketId, user1);
    this.users.set(user2.socketId, user2);

    // Add to recent partners to prevent immediate re-matching
    this.addRecentPartner(user1.socketId, user2.socketId);
    this.addRecentPartner(user2.socketId, user1.socketId);

    console.log("Match created:", matchInfo);

    return {
      user1: user1.socketId,
      user2: user2.socketId,
      matchId,
      reason,
    };
  }

  addRecentPartner(socketId, partnerId) {
    if (!this.recentPartners.has(socketId)) {
      this.recentPartners.set(socketId, new Set());
    }

    const recentSet = this.recentPartners.get(socketId);
    recentSet.add(partnerId);

    if (recentSet.size > 5) {
      const oldestPartner = recentSet.values().next().value;
      recentSet.delete(oldestPartner);
    }
  }

  removeFromAllQueues(socketId) {
    // Remove from all new queues
    this.exactMatchQueue = this.exactMatchQueue.filter(
      (u) => u.socketId !== socketId
    );

    this.twoMatchQueues.genderLocation =
      this.twoMatchQueues.genderLocation.filter((u) => u.socketId !== socketId);
    this.twoMatchQueues.genderGames = this.twoMatchQueues.genderGames.filter(
      (u) => u.socketId !== socketId
    );
    this.twoMatchQueues.locationGames =
      this.twoMatchQueues.locationGames.filter((u) => u.socketId !== socketId);

    this.singleMatchQueues.gender = this.singleMatchQueues.gender.filter(
      (u) => u.socketId !== socketId
    );
    this.singleMatchQueues.location = this.singleMatchQueues.location.filter(
      (u) => u.socketId !== socketId
    );
    this.singleMatchQueues.games = this.singleMatchQueues.games.filter(
      (u) => u.socketId !== socketId
    );

    this.generalQueue = this.generalQueue.filter(
      (u) => u.socketId !== socketId
    );

    // Remove from old queue structure (for compatibility)
    this.waitingQueues.gender.forEach((users, gender) => {
      const index = users.findIndex((u) => (u.userId || u) === socketId);
      if (index > -1) users.splice(index, 1);
    });

    this.waitingQueues.location.forEach((users, location) => {
      const index = users.findIndex((u) => (u.userId || u) === socketId);
      if (index > -1) users.splice(index, 1);
    });

    this.waitingQueues.games.forEach((users, game) => {
      const index = users.findIndex((u) => (u.userId || u) === socketId);
      if (index > -1) users.splice(index, 1);
    });

    const generalIndex = this.waitingQueues.general.findIndex(
      (u) => (u.userId || u) === socketId
    );
    if (generalIndex > -1) this.waitingQueues.general.splice(generalIndex, 1);
  }

  disconnectUsers(socketId) {
    const matchInfo = this.activeMatches.get(socketId);

    if (matchInfo) {
      const partnerId =
        matchInfo.user1 === socketId ? matchInfo.user2 : matchInfo.user1;

      // Remove match info for both users
      this.activeMatches.delete(socketId);
      this.activeMatches.delete(partnerId);

      // Remove user info from users map
      const userProfile = this.users.get(socketId);
      if (userProfile) {
        userProfile.partnerId = null;
      }

      const partnerProfile = this.users.get(partnerId);
      if (partnerProfile) {
        partnerProfile.partnerId = null;
      }

      console.log(`Match disconnected: ${socketId} and ${partnerId}`);

      return partnerId;
    }

    // If no active match, just remove user
    this.removeUser(socketId);
    return null;
  }

  setManualStop(socketId) {
    this.manualStops.add(socketId);
    this.removeUser(socketId);
    console.log(`User ${socketId} manually stopped matching`);

    // Remove manual stop flag after 30 seconds
    setTimeout(() => {
      this.manualStops.delete(socketId);
      console.log(`Manual stop cleared for user ${socketId}`);
    }, 30000);
  }

  getQueueSizes() {
    return {
      exact: this.exactMatchQueue.length,
      twoMatch: {
        genderLocation: this.twoMatchQueues.genderLocation.length,
        genderGames: this.twoMatchQueues.genderGames.length,
        locationGames: this.twoMatchQueues.locationGames.length,
      },
      singleMatch: {
        gender: this.singleMatchQueues.gender.length,
        location: this.singleMatchQueues.location.length,
        games: this.singleMatchQueues.games.length,
      },
      general: this.generalQueue.length,
    };
  }

  getTotalQueueSize() {
    const sizes = this.getQueueSizes();
    return (
      sizes.exact +
      Object.values(sizes.twoMatch).reduce((a, b) => a + b, 0) +
      Object.values(sizes.singleMatch).reduce((a, b) => a + b, 0) +
      sizes.general
    );
  }
}

module.exports = MatchingEngine;
