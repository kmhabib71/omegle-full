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

    this.removeUser(socketId);

    this.manualStops.delete(socketId);

    const {
      userGender = "any",
      userLocation = "any",
      matchGender = "any",
      matchLocation = "any",
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

    const match = this.findMatch(userProfile);

    if (match) {
      return this.createMatch(userProfile, match);
    }

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
    console.log("Finding match for user:", userProfile);

    let match = this.findExactMatch(userProfile);
    if (match) {
      console.log("Found exact match");
      return match;
    }

    match = this.findTwoPreferenceMatch(userProfile);
    if (match) {
      console.log("Found two-preference match");
      return match;
    }

    match = this.findSinglePreferenceMatch(userProfile);
    if (match) {
      console.log("Found single-preference match");
      return match;
    }

    match = this.findGeneralMatch(userProfile);
    if (match) {
      console.log("Found general match");
      return match;
    }

    return null;
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
    let match = this.singleMatchQueues.gender.find(
      (candidate) =>
        this.isValidMatch(userProfile, candidate) &&
        this.matchesGender(userProfile, candidate) &&
        this.matchesGender(candidate, userProfile)
    );
    if (match) return match;

    match = this.singleMatchQueues.location.find(
      (candidate) =>
        this.isValidMatch(userProfile, candidate) &&
        this.matchesLocation(userProfile, candidate) &&
        this.matchesLocation(candidate, userProfile)
    );
    if (match) return match;

    match = this.singleMatchQueues.games.find(
      (candidate) =>
        this.isValidMatch(userProfile, candidate) &&
        this.matchesGames(userProfile, candidate) &&
        this.matchesGames(candidate, userProfile)
    );
    if (match) return match;

    return null;
  }

  findGeneralMatch(userProfile) {
    return this.generalQueue.find((candidate) =>
      this.isValidMatch(userProfile, candidate)
    );
  }

  matchesGender(userProfile, candidate) {
    return (
      candidate.matchGender === "any" ||
      candidate.matchGender === userProfile.userGender
    );
  }

  matchesLocation(userProfile, candidate) {
    return (
      candidate.matchLocation === "any" ||
      candidate.matchLocation === userProfile.userLocation
    );
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
    const recentPartners =
      this.recentPartners.get(userProfile.socketId) || new Set();
    if (recentPartners.has(candidate.socketId)) {
      return false;
    }

    if (this.manualStops.has(candidate.socketId)) {
      return false;
    }

    return true;
  }

  addToQueue(userProfile) {
    const { matchGender, matchLocation, matchGames } = userProfile;

    const hasGenderPref = matchGender && matchGender !== "any";
    const hasLocationPref = matchLocation && matchLocation !== "any";
    const hasGamesPref = matchGames && matchGames.length > 0;

    if (hasGenderPref && hasLocationPref && hasGamesPref) {
      this.exactMatchQueue.push(userProfile);
    } else if (hasGenderPref && hasLocationPref) {
      this.twoMatchQueues.genderLocation.push(userProfile);
    } else if (hasGenderPref && hasGamesPref) {
      this.twoMatchQueues.genderGames.push(userProfile);
    } else if (hasLocationPref && hasGamesPref) {
      this.twoMatchQueues.locationGames.push(userProfile);
    } else if (hasGenderPref) {
      this.singleMatchQueues.gender.push(userProfile);
    } else if (hasLocationPref) {
      this.singleMatchQueues.location.push(userProfile);
    } else if (hasGamesPref) {
      this.singleMatchQueues.games.push(userProfile);
    } else {
      this.generalQueue.push(userProfile);
    }

    console.log(
      "User added to queue. Current queue sizes:",
      this.getQueueSizes()
    );
  }

  createMatch(user1, user2) {
    this.removeUser(user1.socketId);
    this.removeUser(user2.socketId);

    const matchId = `${user1.socketId}-${user2.socketId}-${Date.now()}`;
    const matchInfo = {
      matchId,
      user1: user1.socketId,
      user2: user2.socketId,
      startTime: Date.now(),
    };

    this.activeMatches.set(user1.socketId, matchInfo);
    this.activeMatches.set(user2.socketId, matchInfo);

    this.addRecentPartner(user1.socketId, user2.socketId);
    this.addRecentPartner(user2.socketId, user1.socketId);

    this.removeFromAllQueues(user1.socketId);
    this.removeFromAllQueues(user2.socketId);

    console.log("Match created:", matchInfo);

    return {
      user1: user1.socketId,
      user2: user2.socketId,
      matchId,
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

      this.activeMatches.delete(socketId);
      this.activeMatches.delete(partnerId);

      console.log(`Match disconnected: ${socketId} and ${partnerId}`);

      return partnerId;
    }

    this.removeUser(socketId);

    return null;
  }

  setManualStop(socketId) {
    this.manualStops.add(socketId);
    this.removeUser(socketId);
    console.log(`User ${socketId} manually stopped matching`);
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
