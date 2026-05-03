import React, { useEffect, useMemo, useRef, useState } from "react";

const GAME_INNINGS = 4;

const defaultPlayers = {
  away: ["Away Player 1", "Away Player 2", "Away Player 3", "Away Player 4"],
  home: ["Home Player 1", "Home Player 2", "Home Player 3", "Home Player 4"],
};

const emptyGameRosters = {
  away: [],
  home: [],
};

const resultButtons = [
  { label: "Single", type: "single", bases: 1, atBat: 1, hit: 1 },
  { label: "Double", type: "double", bases: 2, atBat: 1, hit: 1 },
  { label: "Triple", type: "triple", bases: 3, atBat: 1, hit: 1 },
  { label: "Home Run", type: "home_run", bases: 4, atBat: 1, hit: 1, homeRun: 1 },
  { label: "Walk", type: "walk", bases: 0, atBat: 0, walk: 1 },
  { label: "Out", type: "out", bases: 0, atBat: 1, out: 1 },
  { label: "Strikeout", type: "strikeout", bases: 0, atBat: 1, out: 1, strikeout: 1 },
];

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function cloneLeagueRecord(league) {
  return league ? JSON.parse(JSON.stringify(league)) : null;
}

function emptyBases() {
  return { first: null, second: null, third: null };
}

function emptyStats() {
  return { GP: 0, PA: 0, AB: 0, H: 0, D2: 0, D3: 0, BB: 0, K: 0, HR: 0, R: 0, RBI: 0, LOB: 0 };
}

function emptyPitchingStats() {
  return { GP: 0, BF: 0, AB: 0, OUTS: 0, H: 0, R: 0, BB: 0, K: 0, HR: 0, ER: 0, UER: 0 };
}

function currentYearNumber() {
  return new Date().getFullYear();
}

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function currentTimeInputValue() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

function defaultScheduleTimeValue() {
  return "18:00";
}

function parseDateValue(dateValue) {
  if (!dateValue) return null;
  const parsed = new Date(`${dateValue}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function dateDiffInDays(startDateValue, endDateValue) {
  const start = parseDateValue(startDateValue);
  const end = parseDateValue(endDateValue);
  if (!start || !end) return null;
  return Math.round((end.getTime() - start.getTime()) / 86400000);
}

function addDaysToDateValue(dateValue, days) {
  const date = parseDateValue(dateValue);
  if (!date) return "";
  date.setDate(date.getDate() + Number(days || 0));
  return date.toISOString().slice(0, 10);
}

function makeDivisionNames(count, existingDivisions = []) {
  const safeCount = Math.max(0, Number(count) || 0);
  if (safeCount === 0) return [];
  return Array.from({ length: safeCount }, (_, index) => existingDivisions[index] || `Division ${index + 1}`);
}

function getDefaultDivisionForTeam(teamIndex, teamCount, divisions = []) {
  if (!divisions.length) return "";
  const divisionIndex = Math.min(divisions.length - 1, Math.floor((Math.max(0, teamIndex) * divisions.length) / Math.max(1, Number(teamCount) || 1)));
  return divisions[divisionIndex] || "";
}

function makeLeagueTeams(count, playersPerTeam, existingTeams = [], divisions = [], leaguePlayers = []) {
  const safeCount = Math.max(1, Number(count) || 1);
  const safePlayersPerTeam = Math.max(1, Number(playersPerTeam) || 1);
  const hasDivisions = divisions.length > 0;
  const leaguePlayerNames = getLeaguePlayerNames(leaguePlayers);

  return Array.from({ length: safeCount }, (_, teamIndex) => {
    const existing = existingTeams[teamIndex] || {};
    const fallbackPlayers = Array.from({ length: safePlayersPerTeam }, (_, playerIndex) => leaguePlayerNames[teamIndex * safePlayersPerTeam + playerIndex] || "");
    const existingPlayers = (existing.players || []).filter((player) => leaguePlayerNames.includes(player));
    const captain = leaguePlayerNames.includes(existing.captain) ? existing.captain : "";
    const players = Array.from({ length: safePlayersPerTeam }, (_, playerIndex) => existingPlayers[playerIndex] || "");
    if (captain && leaguePlayerNames.includes(captain) && !players.includes(captain)) {
      const blankIndex = players.findIndex((player) => !String(player || "").trim());
      if (blankIndex >= 0) players[blankIndex] = captain;
      else players[0] = captain;
    }
    const cleanPlayers = players.map((player) => String(player || "").trim()).filter(Boolean);
    const battingOrder = cleanRoster(existing.battingOrder || cleanPlayers).filter((player) => cleanPlayers.includes(player));
    const pitchingOrder = cleanRoster(existing.pitchingOrder || cleanPlayers).filter((player) => cleanPlayers.includes(player));

    cleanPlayers.forEach((player) => {
      if (!battingOrder.includes(player)) battingOrder.push(player);
      if (!pitchingOrder.includes(player)) pitchingOrder.push(player);
    });

    return {
      id: existing.id || newId(),
      name: existing.name || `Team ${teamIndex + 1}`,
      logoUrl: existing.logoUrl || "",
      captain,
      captainValue: existing.captainValue === "" ? "" : normalizeCaptainValueInput(existing.captainValue, false),
      division: hasDivisions ? existing.division || getDefaultDivisionForTeam(teamIndex, safeCount, divisions) : "",
      players,
      battingOrder,
      pitchingOrder,
      sessionRosters: existing.sessionRosters || {},
    };
  });
}

function makeDefaultFields() {
  return [
    { id: newId(), name: "Main Field", address: "", notes: "", rules: [], isMain: true },
  ];
}

function getMainField(fields = []) {
  return fields.find((field) => field.isMain) || fields[0] || null;
}

function getFirstExtraInning(gameInningsValue = GAME_INNINGS) {
  return Math.max(2, (Number(gameInningsValue) || GAME_INNINGS) + 1);
}

function getOrdinalSuffix(numberValue) {
  const number = Math.abs(Number(numberValue) || 0);
  const lastTwo = number % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return "th";
  const lastDigit = number % 10;
  if (lastDigit === 1) return "st";
  if (lastDigit === 2) return "nd";
  if (lastDigit === 3) return "rd";
  return "th";
}

function makeDefaultGameRules() {
  return {
    gameInnings: 4,
    powerPlaysEnabled: true,
    powerPlayLimitType: "per_inning",
    powerPlayLimitAmount: 1,
    whammysEnabled: true,
    pudwhackerEnabled: false,
    runRuleEnabled: false,
    runRuleRuns: 8,
    runRuleBeforeFourthOnly: false,
    walkRunRuleCountsAsHr: true,
    extraRunnerRules: [],
    ghostRunnersCountAsRbi: true,
  };
}

function makeDefaultLeagueRuleItem(sectionTitle = "Rule") {
  return {
    id: newId(),
    title: `${sectionTitle} Rule`,
    text: "",
    note: "",
  };
}

function makeDefaultLeagueRuleSection(index = 0, title = "New Section") {
  return {
    id: newId(),
    title: title || `Section ${index + 1}`,
    description: "",
    rules: [],
  };
}

function normalizeLeagueRuleSections(leagueRules = []) {
  const rules = Array.isArray(leagueRules) ? leagueRules : [];
  if (rules.length === 0) return [];

  const alreadySectioned = rules.some((entry) => Array.isArray(entry?.rules));
  if (alreadySectioned) {
    return rules.map((section, index) => ({
      id: section.id || newId(),
      title: section.title || `Section ${index + 1}`,
      description: section.description || "",
      rules: (section.rules || []).map((rule, ruleIndex) => ({
        id: rule.id || newId(),
        title: rule.title || `Rule ${ruleIndex + 1}`,
        text: rule.text ?? rule.description ?? "",
        note: rule.note ?? rule.notes ?? rule.penalty ?? "",
      })),
    }));
  }

  return [{
    id: newId(),
    title: "General Rules",
    description: "Imported rules from the previous league rules layout.",
    rules: rules.map((rule, index) => ({
      id: rule.id || newId(),
      title: rule.title || `Rule ${index + 1}`,
      text: rule.text ?? rule.description ?? "",
      note: rule.note ?? rule.notes ?? rule.penalty ?? "",
    })),
  }];
}

function makeRuleAnchor(section) {
  return `rule-section-${String(section?.id || section?.title || "section").replace(/[^a-z0-9-_]+/gi, "-")}`;
}

function summarizeRuleSectionsForLog(leagueRules = []) {
  const sections = normalizeLeagueRuleSections(leagueRules || []);
  const ruleCount = sections.reduce((total, section) => total + (section.rules || []).length, 0);
  return { sectionCount: sections.length, ruleCount, sectionTitles: sections.map((section) => section.title || "Untitled Section") };
}

function makeLeagueRuleChangeLogEntry(beforeLeague = {}, afterLeague = {}) {
  const beforeSummary = summarizeRuleSectionsForLog(beforeLeague.leagueRules || []);
  const afterSummary = summarizeRuleSectionsForLog(afterLeague.leagueRules || []);
  const sectionDelta = afterSummary.sectionCount - beforeSummary.sectionCount;
  const ruleDelta = afterSummary.ruleCount - beforeSummary.ruleCount;
  const details = [];
  if (sectionDelta > 0) details.push(`${sectionDelta} section${sectionDelta === 1 ? "" : "s"} added`);
  if (sectionDelta < 0) details.push(`${Math.abs(sectionDelta)} section${Math.abs(sectionDelta) === 1 ? "" : "s"} removed`);
  if (ruleDelta > 0) details.push(`${ruleDelta} rule${ruleDelta === 1 ? "" : "s"} added`);
  if (ruleDelta < 0) details.push(`${Math.abs(ruleDelta)} rule${Math.abs(ruleDelta) === 1 ? "" : "s"} removed`);
  if (details.length === 0) details.push("Rule text, headings, notes, descriptions, or section order updated");

  return {
    id: newId(),
    createdAt: new Date().toISOString(),
    createdAtDisplay: new Date().toLocaleString(),
    summary: details.join(" · "),
    beforeSectionCount: beforeSummary.sectionCount,
    afterSectionCount: afterSummary.sectionCount,
    beforeRuleCount: beforeSummary.ruleCount,
    afterRuleCount: afterSummary.ruleCount,
    sectionTitles: afterSummary.sectionTitles,
  };
}

function makeDefaultAwards() {
  return [
    { id: newId(), category: "MVP", winner: "", legacyPoints: 2 },
    { id: newId(), category: "Best Hitter", winner: "", legacyPoints: 1 },
    { id: newId(), category: "Best Pitcher", winner: "", legacyPoints: 1 },
  ];
}

function makeDefaultAwardDefaults() {
  return makeDefaultAwards().map(({ category, legacyPoints }) => ({ id: newId(), category, legacyPoints }));
}

function makeDefaultScheduleWeek(weekNumber = 1, sessionId = "") {
  return { id: newId(), name: `Week ${weekNumber}`, date: "", fieldId: "", sessionId, isTournament: false, games: [] };
}

function makeDefaultScheduledGame(league, season, weekGameCount = 0, sessionId = "") {
  const activeSessionId = season?.sessionsEnabled ? sessionId || season.currentSessionId || season.sessions?.[0]?.id || "" : "";
  return {
    id: newId(),
    name: `Game ${weekGameCount + 1}`,
    time: defaultScheduleTimeValue(),
    sessionId: activeSessionId,
    awayTeamId: "",
    homeTeamId: "",
    completedGameId: "",
  };
}

function getNextLeagueSeasonYear(years = []) {
  const existingYears = (years || []).map((yearEntry) => Number(yearEntry.year)).filter(Boolean);
  if (existingYears.length === 0) return currentYearNumber();
  return Math.max(...existingYears) + 1;
}

function isDuplicateLeagueSeasonYear(years = [], yearValue, currentYearId = "") {
  const safeYear = Number(yearValue);
  if (!safeYear) return false;
  return (years || []).some((yearEntry) => yearEntry.id !== currentYearId && Number(yearEntry.year) === safeYear);
}

function makeDefaultLeagues() {
  const year = currentYearNumber();
  const defaultLeagueId = "default-league";
  return [
    {
      id: defaultLeagueId,
      name: "New Wiffle League",
      logoUrl: "",
      years: [makeDefaultSeasonRecord(year, makeDefaultAwards())],
      enableCaptains: true,
      currentSeasonYear: year,
      awardDefaults: makeDefaultAwardDefaults(),
      defaultGameRules: makeDefaultGameRules(),
      fields: makeDefaultFields(),
      leagueRules: [],
      leagueRuleChangeLog: [],
      players: [],
      teamCount: 8,
      playersPerTeam: 4,
      divisionCount: 2,
      divisions: makeDivisionNames(2),
      teams: makeLeagueTeams(8, 4, [], makeDivisionNames(2), []),
    },
  ];
}

function removeUnsavedBlankLeaguePlayers(leagues = []) {
  return (leagues || []).map((league) => ({
    ...league,
    players: (league.players || []).filter((player) => String(player?.name || "").trim()),
  }));
}

function canonicalizePlayerRecordsForDirtyCheck(players = []) {
  return (players || [])
    .filter((player) => String(player?.name || "").trim())
    .map((player) => ({
      name: String(player.name || "").trim(),
      phone: player.phone || "",
      bats: player.bats || "R",
      pitches: player.pitches || "R",
      photoUrl: player.photoUrl || "",
      heightFeet: player.heightFeet ?? "",
      heightInches: player.heightInches ?? "",
      leagueIds: [...(player.leagueIds || [])].sort(),
    }))
    .sort((a, b) => a.name.localeCompare(b.name) || a.leagueIds.join(",").localeCompare(b.leagueIds.join(",")));
}

const WIFFLE_LOCAL_STORAGE_KEY = "wiffle-app-state-v1";
const WIFFLE_SHARED_STATE_ENDPOINT = "/.netlify/functions/wiffle-state";
const WIFFLE_SHARED_STATE_POLL_MS = 15000;

function getSavedAtTime(state) {
  const savedAt = state?.savedAt ? new Date(state.savedAt).getTime() : 0;
  return Number.isFinite(savedAt) ? savedAt : 0;
}

function loadPersistedAppState() {
  if (typeof window === "undefined") return null;
  try {
    const rawValue = window.localStorage.getItem(WIFFLE_LOCAL_STORAGE_KEY);
    if (!rawValue) return null;
    const parsed = JSON.parse(rawValue);
    if (parsed && typeof parsed === "object" && !window.__WIFFLE_SYNC_BASE_SAVED_AT) {
      window.__WIFFLE_SYNC_BASE_SAVED_AT = parsed.savedAt || "";
    }
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch (error) {
    console.warn("Unable to load saved Wiffle app data.", error);
    return null;
  }
}

function savePersistedAppState(state) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(WIFFLE_LOCAL_STORAGE_KEY, JSON.stringify(state));
    window.fetch?.(WIFFLE_SHARED_STATE_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Wiffle-Base-Saved-At": window.__WIFFLE_SYNC_BASE_SAVED_AT || "",
      },
      body: JSON.stringify(state),
      keepalive: true,
    }).then(async (response) => {
      if (response.ok) {
        window.__WIFFLE_SYNC_BASE_SAVED_AT = state.savedAt || "";
        return;
      }

      if (response.status !== 409) return;
      const conflict = await response.json().catch(() => null);
      const latestState = conflict?.state || null;
      if (!latestState || typeof latestState !== "object") return;
      window.localStorage.setItem(WIFFLE_LOCAL_STORAGE_KEY, JSON.stringify(latestState));
      window.__WIFFLE_SYNC_BASE_SAVED_AT = latestState.savedAt || "";
      console.warn("Skipped saving stale Wiffle data because another browser has newer saved data.");
      window.dispatchEvent(new CustomEvent("wiffle:shared-state-updated", { detail: latestState }));
    }).catch((error) => {
      console.warn("Unable to save shared Wiffle app data.", error);
    });
  } catch (error) {
    console.warn("Unable to save Wiffle app data. Browser storage may be full, usually from large uploaded photos/logos.", error);
    window.alert?.("Some Wiffle data could not be saved because browser storage is full. Try removing or replacing large team/player pictures.");
  }
}

function makeDefaultSeasonRecord(year = currentYearNumber(), defaultAwards = makeDefaultAwards()) {
  return {
    id: newId(),
    year,
    notes: "",
    sessionsEnabled: false,
    sessionCount: 1,
    currentSessionId: "",
    keepRostersForSessions: true,
    keepTeamIdentityForSessions: true,
    sessions: [{ id: newId(), name: "Session 1", rosterNotes: "" }],
    scheduleWeeks: [],
    awards: defaultAwards.map((award) => ({ ...award, id: newId(), winner: "" })),
  };
}

function normalizeSeasonRecord(yearEntry) {
  const hasSessions = Boolean(yearEntry && yearEntry.sessionsEnabled);
  const rawSessionCount = Number(yearEntry && yearEntry.sessionCount) || (hasSessions ? 2 : 1);
  const sessionCount = hasSessions ? Math.max(2, rawSessionCount) : Math.max(1, rawSessionCount);
  const sessions = Array.from({ length: sessionCount }, (_, index) => {
    const existing = yearEntry?.sessions?.[index] || {};
    return { id: existing.id || newId(), name: existing.name || `Session ${index + 1}`, rosterNotes: existing.rosterNotes || "" };
  });
  const normalized = {
    ...makeDefaultSeasonRecord(Number(yearEntry?.year) || currentYearNumber()),
    ...(yearEntry || {}),
    sessionCount,
    sessions,
    awards: yearEntry?.awards?.length ? yearEntry.awards : makeDefaultAwards(),
  };
  return { ...normalized, currentSessionId: normalized.currentSessionId || sessions[0]?.id || "", scheduleWeeks: normalized.scheduleWeeks || [], drafts: normalized.drafts || {} };
}

function isLeagueDraftEnabledForSession(season = {}, sessionId = "") {
  const normalized = normalizeSeasonRecord(season || {});
  const safeSessionId = sessionId || normalized.currentSessionId || normalized.sessions?.[0]?.id || "default-session";
  return Boolean(normalized.drafts?.[safeSessionId]?.enabled);
}

function setLeagueDraftEnabledForSessionRecord(season = {}, sessionId = "", isEnabled = false, league = {}) {
  const normalized = normalizeSeasonRecord(season || {});
  const safeSessionId = sessionId || normalized.currentSessionId || normalized.sessions?.[0]?.id || "default-session";
  const currentDraft = normalizeDraftSettings(normalized.drafts?.[safeSessionId], league, safeSessionId);
  const nextDraft = Boolean(isEnabled)
    ? { ...currentDraft, enabled: true }
    : { ...currentDraft, enabled: false, captainValues: {} };
  return {
    ...normalized,
    drafts: {
      ...(normalized.drafts || {}),
      [safeSessionId]: normalizeDraftSettings(nextDraft, league, safeSessionId),
    },
  };
}

function makeDefaultDraftSettings(league = {}, sessionId = "") {
  return {
    enabled: false,
    started: false,
    cap: 200,
    timerSeconds: 60,
    maxCarryoverEnabled: false,
    maxCarryover: 50,
    draftOrder: (league.teams || []).map((team) => team.id),
    playerValues: {},
    draftedPlayers: {},
    lockedTeamIds: [],
    completed: false,
    currentBid: null,
    bidHistory: [],
    nominationIndex: 0,
    sessionId,
  };
}

function normalizeDraftSettings(draft = {}, league = {}, sessionId = "") {
  const defaults = makeDefaultDraftSettings(league, sessionId);
  const validTeamIds = new Set((league.teams || []).map((team) => team.id));
  const draftOrder = [...new Set([...(draft.draftOrder || []), ...defaults.draftOrder])].filter((teamId) => validTeamIds.has(teamId));
  const captainValues = { ...(draft.captainValues || {}) };
  (league.teams || []).forEach((team) => {
    const captain = String(team.captain || "").trim();
    if (captain && captainValues[team.id] == null) captainValues[team.id] = normalizeCaptainValueInput(team.captainValue, false);
  });
  return {
    ...defaults,
    ...draft,
    enabled: Boolean(draft.enabled),
    started: Boolean(draft.started || Object.values(draft.draftedPlayers || {}).some((players) => (players || []).length > 0)),
    completed: Boolean(draft.completed),
    cap: Math.max(1, Number(draft.cap ?? defaults.cap) || defaults.cap),
    timerSeconds: Math.max(5, Number(draft.timerSeconds ?? defaults.timerSeconds) || defaults.timerSeconds),
    maxCarryoverEnabled: Boolean(draft.maxCarryoverEnabled),
    maxCarryover: Math.max(0, Number(draft.maxCarryover ?? defaults.maxCarryover) || 0),
    draftOrder,
    playerValues: draft.playerValues || {},
    captainValues,
    draftedPlayers: draft.draftedPlayers || {},
    lockedTeamIds: draft.lockedTeamIds || [],
    currentBid: draft.currentBid || null,
    bidHistory: draft.bidHistory || [],
    nominationIndex: Math.max(0, Number(draft.nominationIndex) || 0),
    sessionId,
  };
}

function getDraftedPlayerTeamId(draft, playerName) {
  const cleanName = String(playerName || "").trim();
  if (!cleanName) return "";
  return Object.entries(draft?.draftedPlayers || {}).find(([, players]) => (players || []).includes(cleanName))?.[0] || "";
}

function getTeamDraftSpend(draft, teamId) {
  const captainSpend = Number(draft?.captainValues?.[teamId]) || 0;
  const playerSpend = (draft?.draftedPlayers?.[teamId] || []).reduce((total, player) => total + (Number(draft?.playerValues?.[player]) || 0), 0);
  return captainSpend + playerSpend;
}

function getDraftMaxCarryover(draft = {}) {
  return draft.maxCarryoverEnabled ? Math.max(0, Number(draft.maxCarryover) || 0) : null;
}

function getDraftMinimumSpend(draft = {}) {
  const carryover = getDraftMaxCarryover(draft);
  if (carryover == null) return 0;
  return Math.max(0, (Number(draft.cap) || 0) - carryover);
}

function getUndraftedNonCaptainPlayers(league = {}, draft = {}) {
  const captainNames = new Set((league.teams || []).map((team) => String(team.captain || "").trim()).filter(Boolean));
  return getLeaguePlayerOptions(league).filter((player) => !captainNames.has(player) && !getDraftedPlayerTeamId(draft, player));
}

function getTeamDraftRosterCount(draft = {}, teamId = "") {
  return (draft?.draftedPlayers?.[teamId] || []).length;
}

function getTeamRosterTargetCount(league = {}, teamId = "") {
  const team = (league.teams || []).find((item) => item.id === teamId);
  const playersPerTeam = Math.max(1, Number(league.playersPerTeam) || 1);
  return Math.max(0, playersPerTeam - (team?.captain ? 1 : 0));
}

function getTeamTotalRosterTargetCount(league = {}, teamId = "") {
  return Math.max(1, Number(league.playersPerTeam) || 1);
}

function getTeamDraftedTotalCount(league = {}, draft = {}, teamId = "") {
  const team = (league.teams || []).find((item) => item.id === teamId);
  return (team?.captain ? 1 : 0) + (draft?.draftedPlayers?.[teamId] || []).length;
}

function isTeamDraftRosterFull(league = {}, draft = {}, teamId = "") {
  return getTeamDraftedTotalCount(league, draft, teamId) >= getTeamTotalRosterTargetCount(league, teamId);
}

function isTeamFinalDraftPick(league = {}, draft = {}, teamId = "") {
  const target = getTeamRosterTargetCount(league, teamId);
  if (target <= 0) return true;
  return getTeamDraftRosterCount(draft, teamId) + 1 >= target;
}

function getDraftRosterFullError(league = {}, draft = {}, teamId = "") {
  if (!teamId) return "";
  if (isTeamDraftRosterFull(league, draft, teamId)) {
    const target = getTeamTotalRosterTargetCount(league, teamId);
    return `This team already has ${target} player${target === 1 ? "" : "s"} for this draft roster.`;
  }
  return "";
}

function getTeamDraftRemainingPlayerSlots(league = {}, draft = {}, teamId = "") {
  const target = getTeamRosterTargetCount(league, teamId);
  const draftedCount = getTeamDraftRosterCount(draft, teamId);
  return Math.max(0, target - draftedCount);
}

function getTeamDraftMinimumBid(league = {}, draft = {}, teamId = "") {
  if (!teamId || isTeamDraftRosterFull(league, draft, teamId)) return 0;
  const maximumBid = getTeamDraftMaximumBid(league, draft, teamId);
  if (!draft?.maxCarryoverEnabled || !isTeamFinalDraftPick(league, draft, teamId)) return Math.min(1, maximumBid);
  const currentSpend = getTeamDraftSpend(draft, teamId);
  const minimumSpend = getDraftMinimumSpend(draft);
  const carryoverMinimum = Math.max(1, minimumSpend - currentSpend);
  return Math.max(1, Math.min(maximumBid, carryoverMinimum));
}

function getDraftMinimumBidError(league = {}, draft = {}, teamId = "", bidAmount = 0) {
  if (!teamId) return "";
  const safeBid = Math.max(0, Number(bidAmount) || 0);
  const minimumBid = getTeamDraftMinimumBid(league, draft, teamId);
  if (safeBid > 0 && safeBid < minimumBid) {
    return `This bid is too low. Minimum bid is $${minimumBid} so this team can still reach the required minimum spend.`;
  }
  return "";
}

function getTeamDraftMaximumBid(league = {}, draft = {}, teamId = "") {
  if (!teamId || isTeamDraftRosterFull(league, draft, teamId)) return 0;
  const currentSpend = getTeamDraftSpend(draft, teamId);
  const cap = Number(draft?.cap) || 0;
  const capRemaining = Math.max(0, cap - currentSpend);
  const slotsRemainingBeforePick = getTeamDraftRemainingPlayerSlots(league, draft, teamId);
  const slotsRemainingAfterPick = Math.max(0, slotsRemainingBeforePick - 1);
  const reserveForRemainingPlayers = slotsRemainingAfterPick;
  return Math.max(0, capRemaining - reserveForRemainingPlayers);
}

function getDraftMaximumBidError(league = {}, draft = {}, teamId = "", bidAmount = 0) {
  if (!teamId) return "";
  const safeBid = Math.max(0, Number(bidAmount) || 0);
  const maximumBid = getTeamDraftMaximumBid(league, draft, teamId);
  if (safeBid > maximumBid) {
    const remainingSlotsAfterPick = Math.max(0, getTeamDraftRemainingPlayerSlots(league, draft, teamId) - 1);
    return `This bid is too high. Maximum bid is $${maximumBid} because this team must save at least $1 for each of its ${remainingSlotsAfterPick} remaining roster spot${remainingSlotsAfterPick === 1 ? "" : "s"}.`;
  }
  return "";
}

function getDraftCarryoverError(league = {}, draft = {}, teamId = "", bidAmount = 0) {
  if (!draft?.maxCarryoverEnabled || !isTeamFinalDraftPick(league, draft, teamId)) return "";
  const minimumSpend = getDraftMinimumSpend(draft);
  const currentSpend = getTeamDraftSpend(draft, teamId);
  const safeBid = Math.max(0, Number(bidAmount) || 0);
  const projectedSpend = currentSpend + safeBid;
  if (projectedSpend < minimumSpend) {
    return `This final pick would leave the team below the required minimum spend of $${minimumSpend}. Increase the bid to at least $${minimumSpend - currentSpend}.`;
  }
  return "";
}

function getDraftCurrentBid(draft = {}, playerName = "") {
  const cleanPlayer = String(playerName || "").trim();
  const currentBid = draft?.currentBid || null;
  if (!cleanPlayer || !currentBid || currentBid.player !== cleanPlayer) return null;
  return currentBid;
}

function getDraftBidHistory(draft = {}, playerName = "") {
  const cleanPlayer = String(playerName || "").trim();
  if (!cleanPlayer) return [];
  return (draft?.bidHistory || []).filter((bid) => bid.player === cleanPlayer).slice(-8).reverse();
}

function hasDraftStarted(draft = {}) {
  return Boolean(draft.started || Object.values(draft.draftedPlayers || {}).some((players) => (players || []).length > 0));
}

function getDraftedPlayerCount(draft = {}) {
  return Object.values(draft.draftedPlayers || {}).reduce((total, players) => total + (players || []).length, 0);
}

function isDraftComplete(league = {}, draft = {}) {
  if (draft.completed) return true;
  const eligibleTeams = (league.teams || []).filter((team) => !(draft.lockedTeamIds || []).includes(team.id));
  const allEligibleTeamsFull = eligibleTeams.length > 0 && eligibleTeams.every((team) => isTeamDraftRosterFull(league, draft, team.id));
  return allEligibleTeamsFull;
}

function getDraftNominatingTeamId(league = {}, draft = {}) {
  const order = (draft.draftOrder || []).filter((teamId) => {
    const teamExists = (league.teams || []).some((team) => team.id === teamId);
    return teamExists && !(draft.lockedTeamIds || []).includes(teamId) && !isTeamDraftRosterFull(league, draft, teamId);
  });
  if (order.length === 0) return "";
  const rawIndex = Math.max(0, Number(draft.nominationIndex) || 0);
  return order[rawIndex % order.length] || "";
}

function getNextDraftNominationIndex(league = {}, draft = {}) {
  const order = (draft.draftOrder || []).filter((teamId) => {
    const teamExists = (league.teams || []).some((team) => team.id === teamId);
    return teamExists && !(draft.lockedTeamIds || []).includes(teamId) && !isTeamDraftRosterFull(league, draft, teamId);
  });
  if (order.length === 0) return 0;
  return (Math.max(0, Number(draft.nominationIndex) || 0) + 1) % order.length;
}

function makeResetDraftSettings(league = {}, sessionId = "", existingDraft = {}) {
  return {
    ...makeDefaultDraftSettings(league, sessionId),
    enabled: Boolean(existingDraft.enabled),
    cap: Math.max(1, Number(existingDraft.cap) || 200),
    maxCarryoverEnabled: Boolean(existingDraft.maxCarryoverEnabled),
    maxCarryover: Math.max(0, Number(existingDraft.maxCarryover) || 50),
    captainValues: existingDraft.captainValues || {},
    draftOrder: existingDraft.draftOrder || (league.teams || []).map((team) => team.id),
    nominationIndex: 0,
  };
}

function normalizeCaptainValueInput(value, allowBlank = true) {
  if (allowBlank && value === "") return "";
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return allowBlank ? "" : 1;
  return Math.max(1, numericValue);
}

function getCaptainDraftValue(draft = {}, team = {}) {
  const draftValue = draft?.captainValues?.[team.id];
  if (draftValue !== "" && draftValue != null && Number.isFinite(Number(draftValue)) && Number(draftValue) > 0) return Number(draftValue);
  const teamValue = team?.captainValue;
  if (teamValue !== "" && teamValue != null && Number.isFinite(Number(teamValue)) && Number(teamValue) > 0) return Number(teamValue);
  return 0;
}

function makeDefaultLeaguePlayers(teamCount = 8, playersPerTeam = 4) {
  const totalPlayers = Math.max(1, Number(teamCount) || 8) * Math.max(1, Number(playersPerTeam) || 4);
  return Array.from({ length: totalPlayers }, () => ({
    id: newId(),
    name: "",
    phone: "",
    bats: "R",
    pitches: "R",
  }));
}

function normalizeLeaguePlayer(player) {
  return {
    id: player?.id || newId(),
    name: player?.name || "",
    phone: player?.phone || "",
    bats: player?.bats || "R",
    pitches: player?.pitches || "R",
    photoUrl: player?.photoUrl || "",
    heightFeet: player?.heightFeet === "" ? "" : Math.max(0, Number(player?.heightFeet) || 0),
    heightInches: player?.heightInches === "" ? "" : Math.max(0, Math.min(11, Number(player?.heightInches) || 0)),
  };
}

function normalizePlayerKey(name, fallbackId = "") {
  const cleanName = String(name || "").trim().toLowerCase();
  return cleanName || `blank-${fallbackId || newId()}`;
}

function collectGlobalPlayers(leagues = [], freeAgentPlayers = []) {
  const playerMap = new Map();

  (leagues || []).forEach((league) => {
    (league.players || []).map(normalizeLeaguePlayer).filter((player) => String(player.name || "").trim()).forEach((player) => {
      const key = normalizePlayerKey(player.name, player.id);
      const existing = playerMap.get(key) || {
        ...player,
        key,
        leagueIds: [],
        sourceIds: {},
        sourceNames: {},
      };

      const nextLeagueIds = existing.leagueIds.includes(league.id) ? existing.leagueIds : [...existing.leagueIds, league.id];
      playerMap.set(key, {
        ...existing,
        ...Object.fromEntries(Object.entries(player).filter(([, value]) => value !== "" && value != null)),
        name: existing.name || player.name || "",
        phone: player.phone || existing.phone || "",
        bats: player.bats || existing.bats || "R",
        pitches: player.pitches || existing.pitches || "R",
        photoUrl: player.photoUrl || existing.photoUrl || "",
        heightFeet: player.heightFeet ?? existing.heightFeet ?? "",
        heightInches: player.heightInches ?? existing.heightInches ?? "",
        key,
        leagueIds: nextLeagueIds,
        sourceIds: { ...(existing.sourceIds || {}), [league.id]: player.id },
        sourceNames: { ...(existing.sourceNames || {}), [league.id]: player.name || "" },
      });
    });
  });

  (freeAgentPlayers || []).map(normalizeLeaguePlayer).forEach((player) => {
    const cleanName = String(player.name || "").trim();
    if (!cleanName) return;
    const key = normalizePlayerKey(cleanName, player.id);
    const existing = playerMap.get(key) || {
      ...player,
      key,
      leagueIds: [],
      sourceIds: {},
      sourceNames: {},
    };

    playerMap.set(key, {
      ...existing,
      ...Object.fromEntries(Object.entries(player).filter(([, value]) => value !== "" && value != null)),
      id: player.id || existing.id || newId(),
      name: existing.name || cleanName,
      phone: player.phone || existing.phone || "",
      bats: player.bats || existing.bats || "R",
      pitches: player.pitches || existing.pitches || "R",
      photoUrl: player.photoUrl || existing.photoUrl || "",
      heightFeet: player.heightFeet ?? existing.heightFeet ?? "",
      heightInches: player.heightInches ?? existing.heightInches ?? "",
      key,
      leagueIds: existing.leagueIds || [],
      sourceIds: existing.sourceIds || {},
      sourceNames: existing.sourceNames || {},
    });
  });

  return [...playerMap.values()].sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")) || String(a.key).localeCompare(String(b.key)));
}

function cleanTeamAfterPlayerSync(team, oldName = "", newName = "", shouldRemove = false) {
  const replaceName = (name) => {
    if (!oldName || name !== oldName) return name;
    return shouldRemove ? "" : newName;
  };
  const cleanPlayers = (players = []) => (players || []).map(replaceName);
  const cleanOrder = (players = []) => cleanRoster((players || []).map(replaceName).filter(Boolean));

  return {
    ...team,
    captain: replaceName(team.captain || ""),
    players: cleanPlayers(team.players || []),
    battingOrder: cleanOrder(team.battingOrder || []),
    pitchingOrder: cleanOrder(team.pitchingOrder || []),
    sessionRosters: Object.fromEntries(
      Object.entries(team.sessionRosters || {}).map(([sessionId, roster]) => [
        sessionId,
        {
          ...roster,
          captain: replaceName(roster?.captain || ""),
          players: cleanPlayers(roster?.players || []),
          battingOrder: cleanOrder(roster?.battingOrder || []),
          pitchingOrder: cleanOrder(roster?.pitchingOrder || []),
        },
      ]),
    ),
  };
}

function syncGlobalPlayerDraftsToLeagues(leagues = [], playerDrafts = []) {
  const cleanDrafts = (playerDrafts || [])
    .map((player) => ({ ...player, name: String(player.name || "").trim(), leagueIds: player.leagueIds || [] }))
    .filter((player) => player.name);

  return (leagues || []).map((league) => {
    const leagueDrafts = cleanDrafts.filter((player) => player.leagueIds.includes(league.id));
    const draftByExistingId = Object.fromEntries(leagueDrafts.map((player) => [player.sourceIds?.[league.id], player]).filter(([id]) => Boolean(id)));
    const draftByName = Object.fromEntries(leagueDrafts.map((player) => [String(player.sourceNames?.[league.id] || player.name || "").trim(), player]).filter(([name]) => Boolean(name)));
    const currentPlayers = (league.players || []).map(normalizeLeaguePlayer);
    const usedDraftKeys = new Set();
    let teams = league.teams || [];

    const nextExistingPlayers = currentPlayers.flatMap((existingPlayer) => {
      const draft = draftByExistingId[existingPlayer.id] || draftByName[String(existingPlayer.name || "").trim()] || null;
      if (!draft) {
        teams = teams.map((team) => cleanTeamAfterPlayerSync(team, existingPlayer.name, "", true));
        return [];
      }
      usedDraftKeys.add(draft.key);
      const oldName = String(existingPlayer.name || "").trim();
      const newName = String(draft.name || "").trim();
      if (oldName && newName && oldName !== newName) teams = teams.map((team) => cleanTeamAfterPlayerSync(team, oldName, newName, false));
      return [{
        ...existingPlayer,
        id: existingPlayer.id,
        name: newName,
        phone: draft.phone || "",
        bats: draft.bats || "R",
        pitches: draft.pitches || "R",
        photoUrl: draft.photoUrl || "",
        heightFeet: draft.heightFeet === "" ? "" : Math.max(0, Number(draft.heightFeet) || 0),
        heightInches: draft.heightInches === "" ? "" : Math.max(0, Math.min(11, Number(draft.heightInches) || 0)),
      }];
    });

    const newPlayers = leagueDrafts
      .filter((draft) => !usedDraftKeys.has(draft.key))
      .map((draft) => ({
        id: newId(),
        name: draft.name,
        phone: draft.phone || "",
        bats: draft.bats || "R",
        pitches: draft.pitches || "R",
        photoUrl: draft.photoUrl || "",
        heightFeet: draft.heightFeet === "" ? "" : Math.max(0, Number(draft.heightFeet) || 0),
        heightInches: draft.heightInches === "" ? "" : Math.max(0, Math.min(11, Number(draft.heightInches) || 0)),
      }));

    return { ...league, players: [...nextExistingPlayers, ...newPlayers], teams };
  });
}

function syncGlobalPlayerDraftsToFreeAgents(playerDrafts = []) {
  return (playerDrafts || [])
    .map((player) => ({ ...player, name: String(player.name || "").trim(), leagueIds: player.leagueIds || [] }))
    .filter((player) => player.name && player.leagueIds.length === 0)
    .map((player) => ({
      id: player.id || newId(),
      name: player.name,
      phone: player.phone || "",
      bats: player.bats || "R",
      pitches: player.pitches || "R",
      photoUrl: player.photoUrl || "",
      heightFeet: player.heightFeet === "" ? "" : Math.max(0, Number(player.heightFeet) || 0),
      heightInches: player.heightInches === "" ? "" : Math.max(0, Math.min(11, Number(player.heightInches) || 0)),
    }));
}

function getLeaguePlayerProfile(league, playerName) {
  const cleanName = String(playerName || "").trim();
  return (league?.players || []).map(normalizeLeaguePlayer).find((player) => String(player.name || "").trim() === cleanName) || null;
}

function getPlayerProfileFromLeagues(leagues = [], playerName = "") {
  const cleanName = String(playerName || "").trim();
  if (!cleanName) return null;
  for (const league of leagues || []) {
    const profile = getLeaguePlayerProfile(league, cleanName);
    if (profile) return profile;
  }
  return null;
}

function handednessLabel(value) {
  if (value === "L") return "Left";
  if (value === "B") return "Both";
  return "Right";
}

function getLeaguePlayerOptions(league) {
  return (league?.players || [])
    .map((player) => String(player.name || "").trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}

function getLeaguePlayerNames(leaguePlayers = []) {
  return leaguePlayers.map((player) => String(player.name || "").trim()).filter(Boolean);
}

function ensureLeaguePlayersForRoster(existingPlayers = [], teamCount = 8, playersPerTeam = 4) {
  const needed = Math.max(1, Number(teamCount) || 8) * Math.max(1, Number(playersPerTeam) || 4);
  const nextPlayers = [...(existingPlayers || [])];
  for (let index = nextPlayers.length; index < needed; index += 1) {
    nextPlayers.push({ id: newId(), name: "", phone: "", bats: "R", pitches: "R" });
  }
  return nextPlayers;
}

function ensureCaptainOnRoster(players = [], battingOrder = [], pitchingOrder = [], captain = "") {
  if (!captain) return { players, battingOrder, pitchingOrder };
  const nextPlayers = [...(players || [])];
  if (!nextPlayers.includes(captain)) {
    const blankIndex = nextPlayers.findIndex((player) => !String(player || "").trim());
    if (blankIndex >= 0) nextPlayers[blankIndex] = captain;
    else nextPlayers[0] = captain;
  }
  const cleanPlayers = cleanRoster(nextPlayers);
  const nextBattingOrder = cleanRoster(battingOrder || cleanPlayers).filter((player) => cleanPlayers.includes(player));
  const nextPitchingOrder = cleanRoster(pitchingOrder || cleanPlayers).filter((player) => cleanPlayers.includes(player));
  if (!nextBattingOrder.includes(captain)) nextBattingOrder.unshift(captain);
  if (!nextPitchingOrder.includes(captain)) nextPitchingOrder.unshift(captain);
  return { players: nextPlayers, battingOrder: nextBattingOrder, pitchingOrder: nextPitchingOrder };
}

function getTeamRosterForSession(team, sessionId = "", keepTeamIdentityForSessions = true) {
  if (!sessionId) return team;
  const sessionRoster = team?.sessionRosters?.[sessionId];
  if (!sessionRoster) return team;
  const captain = team?.captain || sessionRoster?.captain || "";
  const roster = ensureCaptainOnRoster(
    sessionRoster.players || team.players || [],
    sessionRoster.battingOrder || sessionRoster.players || team.battingOrder || team.players || [],
    sessionRoster.pitchingOrder || sessionRoster.players || team.pitchingOrder || team.players || [],
    captain,
  );
  return {
    ...team,
    ...(!keepTeamIdentityForSessions ? { name: sessionRoster.name || team.name, logoUrl: sessionRoster.logoUrl || team.logoUrl } : {}),
    players: roster.players,
    battingOrder: roster.battingOrder,
    pitchingOrder: roster.pitchingOrder,
  };
}

function getLeagueTeamsForSession(league, sessionId = "", keepTeamIdentityForSessions = true) {
  return (league?.teams || []).map((team) => getTeamRosterForSession(team, sessionId, keepTeamIdentityForSessions));
}

function getLeaguePlayerAssignments(league, sessionId = "") {
  const assignments = {};
  getLeagueTeamsForSession(league, sessionId, true).forEach((team, teamIndex) => {
    (team.players || []).forEach((player, playerIndex) => {
      const cleanName = String(player || "").trim();
      if (!cleanName) return;
      if (!assignments[cleanName]) assignments[cleanName] = [];
      assignments[cleanName].push({ teamIndex, playerIndex, teamName: team.name });
    });
  });
  return assignments;
}

function isPlayerAssignedSomewhereElse(assignments, playerName, teamIndex, playerIndex) {
  const cleanName = String(playerName || "").trim();
  if (!cleanName) return false;
  return (assignments[cleanName] || []).some((assignment) => assignment.teamIndex !== teamIndex || assignment.playerIndex !== playerIndex);
}

function getLeagueDuplicateAssignments(league, sessionId = "") {
  return Object.entries(getLeaguePlayerAssignments(league, sessionId))
    .filter(([, assignments]) => assignments.length > 1)
    .map(([player, assignments]) => ({ player, assignments }));
}

const extraBaseOptions = [
  { value: "none", label: "No runners" },
  { value: "first", label: "Runner on 1st" },
  { value: "second", label: "Runner on 2nd" },
  { value: "third", label: "Runner on 3rd" },
  { value: "first_second", label: "Runners on 1st & 2nd" },
  { value: "first_third", label: "Runners on 1st & 3rd" },
  { value: "second_third", label: "Runners on 2nd & 3rd" },
  { value: "loaded", label: "Bases loaded" },
];

const fieldRuleActionOptions = [
  { value: "bat_again", label: "Bat again" },
  { value: "extra_run_batting", label: "Bonus run for batting team" },
  { value: "extra_run_defense", label: "Bonus run for other team" },
  { value: "automatic_out", label: "Automatic out" },
  { value: "single", label: "Set result: Single" },
  { value: "double", label: "Set result: Double" },
  { value: "triple", label: "Set result: Triple" },
  { value: "home_run", label: "Set result: HR" },
];

const fieldRuleResultActions = ["single", "double", "triple", "home_run", "automatic_out"];

function getFieldRuleActions(rule) {
  if (Array.isArray(rule?.actions)) return rule.actions;
  return rule?.action ? [rule.action] : [];
}

function fieldRuleHasRunAction(rule) {
  const actions = getFieldRuleActions(rule);
  return actions.includes("extra_run_batting") || actions.includes("extra_run_defense");
}

function fieldRulePrimaryResultAction(rule) {
  const actions = getFieldRuleActions(rule);
  return actions.find((action) => fieldRuleResultActions.includes(action)) || null;
}

function toggleFieldRuleAction(actions, action, isChecked) {
  const currentActions = Array.isArray(actions) ? actions : [];
  const oppositeBonusAction = action === "extra_run_batting" ? "extra_run_defense" : action === "extra_run_defense" ? "extra_run_batting" : null;

  if (isChecked) {
    const withoutOpposite = oppositeBonusAction ? currentActions.filter((item) => item !== oppositeBonusAction) : currentActions;
    return [...new Set([...withoutOpposite, action])];
  }

  return currentActions.filter((item) => item !== action);
}

function fieldRuleActionSummary(rule) {
  const actions = getFieldRuleActions(rule);
  return actions
    .map((action) => fieldRuleActionOptions.find((option) => option.value === action)?.label || action)
    .join(" + ");
}

function fieldRuleHasAutomaticOut(rule) {
  return getFieldRuleActions(rule).includes("automatic_out");
}

function getFieldRuleResultItems(rule) {
  const actions = getFieldRuleActions(rule);
  const items = [];
  const resultAction = fieldRulePrimaryResultAction(rule);
  const runs = Number(rule?.runs) || 0;
  const automaticOuts = Math.max(1, Number(rule?.outs) || 1);

  if (resultAction) {
    if (resultAction === "automatic_out") items.push(`${automaticOuts} automatic out${automaticOuts === 1 ? "" : "s"}`);
    else items.push(`Score play as: ${resultAction.replace("home_run", "home run")}`);
  }
  if (actions.includes("extra_run_batting") && runs !== 0) items.push(`${runs > 0 ? "+" : ""}${runs} bonus run${Math.abs(runs) === 1 ? "" : "s"} for batting team${rule?.countBonusRunsAsRbi ? " with RBI credit" : " with no RBI credit"}`);
  if (actions.includes("extra_run_defense") && runs !== 0) items.push(`${runs > 0 ? "+" : ""}${runs} bonus run${Math.abs(runs) === 1 ? "" : "s"} for other team`);
  if (actions.includes("bat_again")) items.push("Same batter bats again");

  return items.length ? items : ["No actions selected"];
}

function describeFieldRule(rule) {
  return getFieldRuleResultItems(rule).join(" + ");
}

function formatInningsPitched(outs) {
  const fullInnings = Math.floor(outs / 3);
  const remainingOuts = outs % 3;
  return `${fullInnings}.${remainingOuts}`;
}

function cleanRoster(roster) {
  const cleaned = roster.map((name) => String(name || "").trim()).filter(Boolean);
  return cleaned.length > 0 ? cleaned : ["Player 1"];
}

function csvEscape(value) {
  const stringValue = String(value ?? "");
  const newline = String.fromCharCode(10);
  const needsEscaping = stringValue.includes(",") || stringValue.includes(newline) || stringValue.includes('"');
  if (needsEscaping) return `"${stringValue.replace(/"/g, '""')}"`;
  return stringValue;
}

function makeCsvRow(values) {
  return values.map(csvEscape).join(",");
}

function downloadTextFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function resizeImageFileToDataUrl(file, options = {}) {
  const { maxSize = 360, quality = 0.72 } = options;
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve("");
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read this image file."));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("Could not load this image. Try a different file."));
      image.onload = () => {
        const originalWidth = image.width || maxSize;
        const originalHeight = image.height || maxSize;
        const scale = Math.min(1, maxSize / Math.max(originalWidth, originalHeight));
        const width = Math.max(1, Math.round(originalWidth * scale));
        const height = Math.max(1, Math.round(originalHeight * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");
        if (!context) {
          reject(new Error("Could not prepare this image for saving."));
          return;
        }
        context.drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      image.src = String(reader.result || "");
    };
    reader.readAsDataURL(file);
  });
}

function formatPlayerName(player, subStatus) {
  return subStatus?.[player] ? `${player} (Sub)` : player;
}

function isPlayerMarkedSub(player, subStatusByTeam = {}) {
  return Boolean(Object.values(subStatusByTeam || {}).some((teamSubs) => teamSubs?.[player]));
}

function getSubPlayerNamesFromSubStatus(subStatusByTeam = {}) {
  return [...new Set(Object.values(subStatusByTeam || {}).flatMap((teamSubs) => Object.entries(teamSubs || {}).filter(([, isSub]) => Boolean(isSub)).map(([player]) => player)).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function getKnownSubPlayers(previousGames = [], currentSubPlayers = { away: {}, home: {} }) {
  const names = new Set();
  (previousGames || []).forEach((savedGame) => {
    getSubPlayerNamesFromSubStatus(savedGame.savedSetup?.subPlayers || {}).forEach((name) => names.add(name));
  });
  getSubPlayerNamesFromSubStatus(currentSubPlayers).forEach((name) => names.add(name));
  return [...names].filter(Boolean).sort((a, b) => a.localeCompare(b));
}

function isSubAlreadyOnTeam(teamPlayers = [], subSlots = {}, subName = "", currentIndex = -1) {
  const cleanSubName = String(subName || "").trim();
  if (!cleanSubName) return false;
  return (teamPlayers || []).some((player, index) => {
    if (index === currentIndex) return false;
    return Boolean(subSlots?.[index]) && String(player || "").trim() === cleanSubName;
  });
}

function isSubAlreadyInGame(teamPlayersBySide = {}, subSlotsBySide = {}, subName = "", currentTeamKey = "", currentIndex = -1) {
  const cleanSubName = String(subName || "").trim();
  if (!cleanSubName) return false;
  return Object.entries(teamPlayersBySide || {}).some(([teamKey, players]) => (players || []).some((player, index) => {
    if (teamKey === currentTeamKey && index === currentIndex) return false;
    return Boolean(subSlotsBySide?.[teamKey]?.[index]) && String(player || "").trim() === cleanSubName;
  }));
}

function isPlayerAlreadyInGame(teamPlayersBySide = {}, playerName = "", currentTeamKey = "", currentIndex = -1) {
  const cleanName = String(playerName || "").trim();
  if (!cleanName) return false;
  return Object.entries(teamPlayersBySide || {}).some(([teamKey, players]) => (players || []).some((player, index) => {
    if (teamKey === currentTeamKey && index === currentIndex) return false;
    return String(player || "").trim() === cleanName;
  }));
}

function getSelectableLeaguePlayersForGame(leaguePlayerOptions = [], teamPlayersBySide = {}, currentTeamKey = "", currentIndex = -1, currentPlayer = "") {
  const cleanCurrent = String(currentPlayer || "").trim();
  return (leaguePlayerOptions || []).filter((player) => {
    const cleanPlayer = String(player || "").trim();
    if (!cleanPlayer) return false;
    if (cleanPlayer === cleanCurrent) return true;
    return !isPlayerAlreadyInGame(teamPlayersBySide, cleanPlayer, currentTeamKey, currentIndex);
  });
}

function buildSubIndexFromSavedGames(previousGames = [], scope = "season", seasonYear = null, leagueId = null, sessionId = "all") {
  const subIndex = {};
  (previousGames || []).forEach((savedGame) => {
    const setup = savedGame.savedSetup || {};
    if (leagueId && setup.setupLeagueId !== leagueId) return;
    if (scope === "season") {
      const gameYear = setup.gameSeasonYear || (savedGame.gameDate ? Number(String(savedGame.gameDate).slice(0, 4)) : null);
      if (seasonYear && Number(gameYear) !== Number(seasonYear)) return;
      if (sessionId && sessionId !== "all" && setup.gameSessionId !== sessionId) return;
    }
    getSubPlayerNamesFromSubStatus(setup.subPlayers || {}).forEach((name) => { subIndex[name] = true; });
  });
  return subIndex;
}

function buildSubCountsFromSavedGames(previousGames = [], scope = "season", seasonYear = null, leagueId = null, sessionId = "all") {
  const subCounts = {};
  (previousGames || []).forEach((savedGame) => {
    const setup = savedGame.savedSetup || {};
    if (leagueId && setup.setupLeagueId !== leagueId) return;
    if (scope === "season") {
      const gameYear = setup.gameSeasonYear || (savedGame.gameDate ? Number(String(savedGame.gameDate).slice(0, 4)) : null);
      if (seasonYear && Number(gameYear) !== Number(seasonYear)) return;
      if (sessionId && sessionId !== "all" && setup.gameSessionId !== sessionId) return;
    }
    getSubPlayerNamesFromSubStatus(setup.subPlayers || {}).forEach((name) => {
      subCounts[name] = (subCounts[name] || 0) + 1;
    });
  });
  return subCounts;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getPitcherForInning(pitchingOrder, inning, extraPitcherForInning, gameInnings = GAME_INNINGS) {
  const cleanOrder = cleanRoster(pitchingOrder);
  const regulationInnings = Math.max(1, Number(gameInnings) || GAME_INNINGS);
  if (inning > regulationInnings && extraPitcherForInning) return extraPitcherForInning;
  const index = (Math.max(1, inning) - 1) % cleanOrder.length;
  return cleanOrder[index];
}

function cloneBases(bases) {
  return { first: bases.first, second: bases.second, third: bases.third };
}

function getExtraRunnerRuleForInning(extraRunnerRules, inning) {
  return [...(extraRunnerRules || [])]
    .filter((rule) => {
      if (!rule.bases || rule.bases === "none") return false;
      const startInning = Number(rule.startInning);
      if (rule.sameRestOfGame) return startInning <= inning;
      return startInning === inning;
    })
    .sort((a, b) => Number(b.startInning) - Number(a.startInning))[0] || null;
}

function previousBatterName(order, batterIndex, stepsBack) {
  const cleanOrder = cleanRoster(order);
  const index = ((batterIndex - stepsBack) % cleanOrder.length + cleanOrder.length) % cleanOrder.length;
  return cleanOrder[index];
}

function getExtraInningStartState(extraRunnerRules, battingOrder, teamKey, inning, batterIndex, ghostRunnersCountAsRbi = true) {
  const rule = getExtraRunnerRuleForInning(extraRunnerRules, inning);
  if (!rule) return { bases: emptyBases(), ghostRunners: [], ghostRunnersCountAsRbi };

  const order = cleanRoster(battingOrder?.[teamKey] || []);
  const bases = emptyBases();
  const ghostRunners = [];
  const runner1 = previousBatterName(order, batterIndex, 1);
  const runner2 = previousBatterName(order, batterIndex, 2);
  const runner3 = previousBatterName(order, batterIndex, 3);

  function place(base, runner) {
    bases[base] = runner;
    if (runner) ghostRunners.push(runner);
  }

  if (rule.bases === "first") place("first", runner1);
  if (rule.bases === "second") place("second", runner1);
  if (rule.bases === "third") place("third", runner1);
  if (rule.bases === "first_second") {
    place("first", runner1);
    place("second", runner2);
  }
  if (rule.bases === "first_third") {
    place("first", runner1);
    place("third", runner2);
  }
  if (rule.bases === "second_third") {
    place("second", runner1);
    place("third", runner2);
  }
  if (rule.bases === "loaded") {
    place("first", runner1);
    place("second", runner2);
    place("third", runner3);
  }

  return { bases, ghostRunners, ghostRunnersCountAsRbi }; 
}

function getExtraInningStartBases(extraRunnerRules, battingOrder, teamKey, inning, batterIndex, ghostRunnersCountAsRbi = true) {
  return getExtraInningStartState(extraRunnerRules, battingOrder, teamKey, inning, batterIndex, ghostRunnersCountAsRbi).bases;
}

function getWinner(game) {
  if (game.homeScore > game.awayScore) return "home";
  if (game.awayScore > game.homeScore) return "away";
  return null;
}

function finalizeGameState(game, reason = "Game final") {
  game.status = "final";
  game.finalReason = reason;
  game.winner = getWinner(game);
  game.outs = 0;
  game.bases = emptyBases();
}

function moveToNextHalfInning(game, options = {}) {
  const { extraRunnerRules = [], battingOrder = defaultPlayers, ghostRunnersCountAsRbi = true, gameInnings = GAME_INNINGS } = options;
  const regulationInnings = Math.max(1, Number(gameInnings) || GAME_INNINGS);
  game.outs = 0;
  game.bases = emptyBases();
  game.ghostRunners = [];
  game.ghostRunnersCountAsRbi = true;

  function applyExtraStart(teamKey) {
    const startState = getExtraInningStartState(
      extraRunnerRules,
      battingOrder,
      teamKey,
      game.inning,
      teamKey === "away" ? game.awayBatterIndex : game.homeBatterIndex,
      ghostRunnersCountAsRbi,
    );
    game.bases = startState.bases;
    game.ghostRunners = startState.ghostRunners;
    game.ghostRunnersCountAsRbi = startState.ghostRunnersCountAsRbi;
  }

  if (game.half === "top") {
    if (game.inning >= regulationInnings && game.homeScore > game.awayScore) {
      finalizeGameState(game, "Home team led after the top half, so the bottom half was skipped.");
      return;
    }
    game.half = "bottom";
    applyExtraStart("home");
    return;
  }

  if (game.inning >= regulationInnings && game.homeScore !== game.awayScore) {
    finalizeGameState(game, "Game ended after a completed inning.");
    return;
  }

  game.half = "top";
  game.inning += 1;
  applyExtraStart("away");
}

function getForcedWalkOutcome(currentBases, batter) {
  const nextBases = cloneBases(currentBases);
  const scored = [];

  if (currentBases.first && currentBases.second && currentBases.third) {
    scored.push(currentBases.third);
    nextBases.third = currentBases.second;
    nextBases.second = currentBases.first;
    nextBases.first = batter;
  } else if (currentBases.first && currentBases.second) {
    nextBases.third = currentBases.second;
    nextBases.second = currentBases.first;
    nextBases.first = batter;
  } else if (currentBases.first) {
    nextBases.second = currentBases.first;
    nextBases.first = batter;
  } else {
    nextBases.first = batter;
  }

  return {
    basesAfter: nextBases,
    scored,
    runs: scored.length,
    rbi: scored.length,
    description: scored.length > 0 ? `${scored.join(", ")} scored on a bases-loaded walk.` : `${batter} walked.`,
  };
}

function getHitAdvanceOutcome(currentBases, batter, bases) {
  const nextBases = emptyBases();
  const scored = [];
  const runners = [
    { baseNumber: 3, player: currentBases.third },
    { baseNumber: 2, player: currentBases.second },
    { baseNumber: 1, player: currentBases.first },
  ].filter((runner) => runner.player);

  runners.forEach((runner) => {
    const destination = runner.baseNumber + bases;
    if (destination >= 4) scored.push(runner.player);
    if (destination === 3) nextBases.third = runner.player;
    if (destination === 2) nextBases.second = runner.player;
    if (destination === 1) nextBases.first = runner.player;
  });

  if (bases >= 4) scored.push(batter);
  if (bases === 1) nextBases.first = batter;
  if (bases === 2) nextBases.second = batter;
  if (bases === 3) nextBases.third = batter;

  return {
    basesAfter: nextBases,
    scored,
    runs: scored.length,
    rbi: scored.length,
    description: scored.length > 0 ? `${scored.join(", ")} scored.` : "No runs scored.",
  };
}

function calculateAutoAdvance(currentBases, batter, result) {
  if (result.type === "walk") return getForcedWalkOutcome(currentBases, batter);
  if (result.bases > 0) return getHitAdvanceOutcome(currentBases, batter, result.bases);
  return { basesAfter: cloneBases(currentBases), scored: [], runs: 0, rbi: 0, description: "No base advancement." };
}

function getInningRunsBeforePlay(lineScore, team, inning) {
  const inningIndex = Math.max(0, inning - 1);
  if (team === "away") return lineScore.awayRunsByInning[inningIndex] || 0;
  return lineScore.homeRunsByInning[inningIndex] || 0;
}

function shouldRunRuleEndHalf({ runRuleEnabled, runRuleRuns, inningRunsBefore, playRuns, inning = 1, runRuleBeforeFourthOnly = false, gameInnings = GAME_INNINGS }) {
  if (!runRuleEnabled) return false;
  const regulationInnings = Math.max(1, Number(gameInnings) || GAME_INNINGS);
  if (runRuleBeforeFourthOnly && inning >= regulationInnings) return false;
  if (!Number.isFinite(runRuleRuns) || runRuleRuns <= 0) return false;
  return playRuns > 0 && inningRunsBefore < runRuleRuns && inningRunsBefore + playRuns >= runRuleRuns;
}

function getRunRuleWalkHomeRunOutcome(currentBases, batter) {
  return getHitAdvanceOutcome(currentBases, batter, 4);
}

function getSacFlyOutcome(currentBases) {
  const basesAfter = cloneBases(currentBases);
  const scored = [];

  if (currentBases.third) {
    scored.push(currentBases.third);
    basesAfter.third = null;
  }

  return {
    basesAfter,
    scored,
    runs: scored.length,
    rbi: scored.length,
    description: scored.length > 0 ? `${scored.join(", ")} scored on a sacrifice fly.` : "Sacrifice fly recorded.",
  };
}

function getDoublePlayOutcome(currentBases) {
  const basesAfter = cloneBases(currentBases);
  let leadRunner = null;

  if (currentBases.third) {
    leadRunner = currentBases.third;
    basesAfter.third = null;
  } else if (currentBases.second) {
    leadRunner = currentBases.second;
    basesAfter.second = null;
  } else if (currentBases.first) {
    leadRunner = currentBases.first;
    basesAfter.first = null;
  }

  return {
    basesAfter,
    leadRunner,
    scored: [],
    runs: 0,
    rbi: 0,
    description: leadRunner ? `Double play: batter and lead runner ${leadRunner} are out.` : "Double play: batter out; no lead runner was on base.",
  };
}

function getTriplePlayOutcome(currentBases) {
  const basesAfter = cloneBases(currentBases);
  const removedRunners = [];

  if (currentBases.third) {
    removedRunners.push(currentBases.third);
    basesAfter.third = null;
  }
  if (currentBases.second && removedRunners.length < 2) {
    removedRunners.push(currentBases.second);
    basesAfter.second = null;
  }
  if (currentBases.first && removedRunners.length < 2) {
    removedRunners.push(currentBases.first);
    basesAfter.first = null;
  }

  return {
    basesAfter,
    removedRunners,
    scored: [],
    runs: 0,
    rbi: 0,
    description: removedRunners.length > 0 ? `Triple play: batter and ${removedRunners.join(" and ")} are out.` : "Triple play recorded.",
  };
}

function countBaseRunners(bases) {
  return [bases.first, bases.second, bases.third].filter(Boolean).length;
}

function calculateState(events, options = {}) {
  const regulationInnings = Math.max(1, Number(options.gameInnings) || GAME_INNINGS);
  const game = {
    gameInnings: regulationInnings,
    awayScore: 0,
    homeScore: 0,
    inning: 1,
    half: "top",
    outs: 0,
    bases: emptyBases(),
    awayBatterIndex: 0,
    homeBatterIndex: 0,
    status: "live",
    winner: null,
    finalReason: "",
    stats: {},
    pitchingStats: {},
    ghostRunners: [],
    ghostRunnersCountAsRbi: true,
  };

  function ensurePlayer(player) {
    if (!game.stats[player]) game.stats[player] = emptyStats();
    game.stats[player].GP = 1;
    return game.stats[player];
  }

  function ensurePitcher(player) {
    if (!player) return null;
    if (!game.pitchingStats[player]) game.pitchingStats[player] = emptyPitchingStats();
    game.pitchingStats[player].GP = 1;
    return game.pitchingStats[player];
  }

  events.forEach((event) => {
    if (event.type === "end_half") {
      moveToNextHalfInning(game, options);
      return;
    }

    if (event.type === "finalize") {
      finalizeGameState(game, "Game finalized manually.");
      return;
    }

    if (event.type === "score_adjustment") {
      if (event.team === "away") game.awayScore += event.runs;
      if (event.team === "home") game.homeScore += event.runs;

      if (event.team === "home" && event.inning >= regulationInnings && event.half === "bottom" && game.homeScore > game.awayScore) {
        finalizeGameState(game, "Walk-off score adjustment.");
      }
      return;
    }

    if (event.type === "rbi_adjustment") {
      const stat = ensurePlayer(event.batter);
      stat.RBI += event.rbi || 0;
      return;
    }

    if (event.type === "field_rule") return;

    if (event.type !== "play") return;

    const scoreKey = event.team === "away" ? "awayScore" : "homeScore";
    game[scoreKey] += event.runs;
    game.outs += event.outs;
    game.bases = event.basesAfter ? cloneBases(event.basesAfter) : cloneBases(game.bases);
    if (Array.isArray(event.scored) && event.scored.length > 0) {
      game.ghostRunners = game.ghostRunners.filter((runnerName) => !event.scored.includes(runnerName));
    }
    const activeBaseRunners = [game.bases.first, game.bases.second, game.bases.third].filter(Boolean);
    game.ghostRunners = game.ghostRunners.filter((runnerName) => activeBaseRunners.includes(runnerName));

    const stat = ensurePlayer(event.batter);
    stat.PA += 1;
    stat.AB += event.atBat;
    stat.H += event.hit;
    stat.D2 += event.double || 0;
    stat.D3 += event.triple || 0;
    stat.BB += event.walk;
    stat.K += event.strikeout;
    stat.HR += event.homeRun;
    stat.RBI += event.rbi;
    if ((event.outs || 0) > 0 && (event.atBat || 0) > 0 && !(event.hit || 0) && !(event.walk || 0) && !(event.homeRun || 0)) {
      stat.LOB += countBaseRunners(event.basesAfter || event.basesBefore || emptyBases());
    }

    const pitcherStat = ensurePitcher(event.pitcher);
    if (pitcherStat) {
      pitcherStat.BF += 1;
      pitcherStat.AB += event.atBat || 0;
      pitcherStat.OUTS += event.outs || 0;
      pitcherStat.H += event.hit || 0;
      pitcherStat.R += event.runs || 0;
      pitcherStat.BB += event.walk || 0;
      pitcherStat.K += event.strikeout || 0;
      pitcherStat.HR += event.homeRun || 0;
      pitcherStat.ER += event.earnedRuns ?? event.runs ?? 0;
      pitcherStat.UER += event.unearnedRuns || 0;
    }

    if (Array.isArray(event.scored)) {
      event.scored.forEach((runnerName) => {
        const runnerStat = ensurePlayer(runnerName);
        runnerStat.R += 1;
      });
    }

    if (!event.repeatBatter) {
      if (event.team === "away") game.awayBatterIndex += 1;
      if (event.team === "home") game.homeBatterIndex += 1;
    }

    if (event.team === "home" && event.inning >= regulationInnings && event.half === "bottom" && game.homeScore > game.awayScore) {
      finalizeGameState(game, "Walk-off win.");
      return;
    }

    if (game.outs >= 3 || event.endHalf) moveToNextHalfInning(game, options);
  });

  return game;
}

function buildLineScore(events, game) {
  const visibleInnings = Math.max(Number(game?.gameInnings) || GAME_INNINGS, game.inning);
  const inningNumbers = Array.from({ length: visibleInnings }, (_, index) => index + 1);
  const awayRunsByInning = Array(visibleInnings).fill(0);
  const homeRunsByInning = Array(visibleInnings).fill(0);
  let awayHits = 0;
  let homeHits = 0;

  events.forEach((event) => {
    if (!event.inning || event.inning < 1) return;
    const inningIndex = event.inning - 1;
    if (inningIndex >= visibleInnings) return;

    if (event.type === "play") {
      if (event.team === "away") {
        awayRunsByInning[inningIndex] += event.runs || 0;
        awayHits += event.hit || 0;
      }
      if (event.team === "home") {
        homeRunsByInning[inningIndex] += event.runs || 0;
        homeHits += event.hit || 0;
      }
    }

    if (event.type === "score_adjustment") {
      if (event.team === "away") awayRunsByInning[inningIndex] += event.runs || 0;
      if (event.team === "home") homeRunsByInning[inningIndex] += event.runs || 0;
    }
  });

  function shouldShowInningCell(team, inningNumber) {
    if (game.status === "final") return true;
    if (inningNumber < game.inning) return true;
    if (inningNumber > game.inning) return false;
    if (game.half === "top") return team === "away";
    if (game.half === "bottom") return true;
    return false;
  }

  return { inningNumbers, awayRunsByInning, homeRunsByInning, awayHits, homeHits, awayRunsTotal: game.awayScore, homeRunsTotal: game.homeScore, shouldShowInningCell };
}

function buildTaggedHittingSplits(events) {
  const splits = {};

  function ensureSplit(player) {
    if (!splits[player]) {
      splits[player] = { player, PA: 0, AB: 0, H: 0, BB: 0, K: 0, HR: 0, R: 0, RBI: 0, WHAMMY: 0 };
    }
    return splits[player];
  }

  events.forEach((event) => {
    if (event.type !== "play" || !event.modifier) return;
    if (event.modifier !== "power_play" && event.modifier !== "whammy") return;

    const stat = ensureSplit(event.batter);
    stat.PA += 1;
    stat.AB += event.atBat || 0;
    stat.H += event.hit || 0;
    stat.BB += event.walk || 0;
    stat.K += event.strikeout || 0;
    stat.HR += event.homeRun || 0;
    stat.RBI += event.rbi || 0;
    if (event.modifier === "whammy") stat.WHAMMY += 1;

    if (Array.isArray(event.scored)) {
      event.scored.forEach((runnerName) => {
        const runnerStat = ensureSplit(runnerName);
        runnerStat.R += 1;
      });
    }
  });

  return Object.values(splits).sort((a, b) => a.player.localeCompare(b.player));
}

function buildPudwhackerSplits(events) {
  const splits = {};

  function ensureSplit(player) {
    if (!splits[player]) {
      splits[player] = { player, PA: 0, AB: 0, H: 0, BB: 0, K: 0, HR: 0, R: 0, RBI: 0, PUDWHACKER: 0 };
    }
    return splits[player];
  }

  events.forEach((event) => {
    if (event.type !== "play" || event.modifier !== "pudwhacker") return;

    const stat = ensureSplit(event.batter);
    stat.PA += 1;
    stat.AB += event.atBat || 0;
    stat.H += event.hit || 0;
    stat.BB += event.walk || 0;
    stat.K += event.strikeout || 0;
    stat.HR += event.homeRun || 0;
    stat.RBI += event.rbi || 0;
    stat.PUDWHACKER += 1;

    if (Array.isArray(event.scored)) {
      event.scored.forEach((runnerName) => {
        const runnerStat = ensureSplit(runnerName);
        runnerStat.R += 1;
      });
    }
  });

  return Object.values(splits).sort((a, b) => a.player.localeCompare(b.player));
}

function isWhammyBlockingPowerPlayThisHalf(events, defensiveTeam, inning, half) {
  return events.some(
    (event) =>
      event.type === "play" &&
      event.modifier === "whammy" &&
      event.defensiveTeam === defensiveTeam &&
      event.inning === inning &&
      event.half === half &&
      !event.walk,
  );
}

function countPowerPlaysThisGame(events, team) {
  return events.filter((event) => event.type === "play" && event.modifier === "power_play" && event.team === team && !event.walk).length;
}

function countPowerPlaysThisHalf(events, team, inning, half) {
  return events.filter(
    (event) =>
      event.type === "play" &&
      event.modifier === "power_play" &&
      event.team === team &&
      event.inning === inning &&
      event.half === half &&
      !event.walk,
  ).length;
}

function isPowerPlayLimitReached(events, team, defensiveTeam, inning, half, limitType, limitAmount) {
  if (isWhammyBlockingPowerPlayThisHalf(events, defensiveTeam, inning, half)) return true;
  const safeLimit = Math.max(0, Number(limitAmount) || 0);
  if (safeLimit <= 0) return true;
  if (limitType === "per_game") return countPowerPlaysThisGame(events, team) >= safeLimit;
  return countPowerPlaysThisHalf(events, team, inning, half) >= safeLimit;
}

function isPowerPlayUsedThisHalf(events, team, defensiveTeam, inning, half) {
  return isPowerPlayLimitReached(events, team, defensiveTeam, inning, half, "per_inning", 1);
}

function countWhammysThisGame(events, defensiveTeam) {
  return events.filter((event) => event.type === "play" && event.modifier === "whammy" && event.defensiveTeam === defensiveTeam).length;
}

function countWhammysThisHalf(events, defensiveTeam, inning, half) {
  return events.filter(
    (event) =>
      event.type === "play" &&
      event.modifier === "whammy" &&
      event.defensiveTeam === defensiveTeam &&
      event.inning === inning &&
      event.half === half,
  ).length;
}

function isWhammyUsedThisGame(events, defensiveTeam) {
  return countWhammysThisGame(events, defensiveTeam) > 0;
}

function isWhammyLimitReached(events, defensiveTeam, inning, half, limitType, limitAmount) {
  const safeLimit = Math.max(0, Number(limitAmount) || 0);
  if (safeLimit <= 0) return true;
  if (limitType === "per_game") return countWhammysThisGame(events, defensiveTeam) >= safeLimit;
  return countWhammysThisHalf(events, defensiveTeam, inning, half) >= safeLimit;
}

function countPudwhackersThisGame(events, team) {
  return events.filter((event) => event.type === "play" && event.modifier === "pudwhacker" && event.team === team).length;
}

function isPudwhackerUsedThisGame(events, team) {
  return countPudwhackersThisGame(events, team) > 0;
}

function isPudwhackerAvailable(events, team, inning, enabled) {
  return Boolean(enabled) && inning < 4 && !isPudwhackerUsedThisGame(events, team);
}

function modifierLabel(modifier) {
  if (modifier === "power_play") return "Power Play";
  if (modifier === "whammy") return "Whammy";
  if (modifier === "pudwhacker") return "Pudwhacker";
  return "";
}

function average(hits, atBats) {
  if (!atBats) return ".000";
  return (hits / atBats).toFixed(3).replace(/^0/, "");
}

function rate(numerator, denominator) {
  if (!denominator) return ".000";
  return (numerator / denominator).toFixed(3).replace(/^0/, "");
}

function safeNumber(value) {
  return Number(value) || 0;
}

function totalBases(stat = {}) {
  const hits = safeNumber(stat.H);
  const doubles = safeNumber(stat.D2);
  const triples = safeNumber(stat.D3);
  const homers = safeNumber(stat.HR);
  const singles = Math.max(0, hits - doubles - triples - homers);
  return singles + doubles * 2 + triples * 3 + homers * 4;
}

function obp(stat = {}) {
  return rate(safeNumber(stat.H) + safeNumber(stat.BB), safeNumber(stat.AB) + safeNumber(stat.BB));
}

function slg(stat = {}) {
  return rate(totalBases(stat), safeNumber(stat.AB));
}

function ops(stat = {}) {
  const denominatorObp = safeNumber(stat.AB) + safeNumber(stat.BB);
  const obpValue = denominatorObp ? (safeNumber(stat.H) + safeNumber(stat.BB)) / denominatorObp : 0;
  const slgValue = safeNumber(stat.AB) ? totalBases(stat) / safeNumber(stat.AB) : 0;
  return formatAverageValue(obpValue + slgValue);
}

function hrPerPa(stat = {}) {
  return rate(safeNumber(stat.HR), safeNumber(stat.PA));
}

function soPerPa(stat = {}) {
  return rate(safeNumber(stat.K), safeNumber(stat.PA));
}

function era(stat = {}, inningsPerGame = GAME_INNINGS) {
  const outs = safeNumber(stat.OUTS);
  if (!outs) return "0.00";
  const regulationOuts = Math.max(1, Number(inningsPerGame) || GAME_INNINGS) * 3;
  return ((safeNumber(stat.ER ?? stat.R) * regulationOuts) / outs).toFixed(2);
}

function whip(stat = {}) {
  const outs = safeNumber(stat.OUTS);
  if (!outs) return "0.00";
  return (((safeNumber(stat.H) + safeNumber(stat.BB)) * 3) / outs).toFixed(2);
}

function pitcherLobPercent(stat = {}) {
  const baserunners = safeNumber(stat.H) + safeNumber(stat.BB);
  const numerator = baserunners - safeNumber(stat.R);
  const denominator = baserunners - (1.4 * safeNumber(stat.HR));
  if (denominator <= 0) return ".000";
  return formatAverageValue(Math.max(0, numerator) / denominator);
}

function kToBb(stat = {}) {
  const walks = safeNumber(stat.BB);
  if (!walks) return safeNumber(stat.K) ? `${safeNumber(stat.K).toFixed(1)}:0` : "0.0";
  return (safeNumber(stat.K) / walks).toFixed(2);
}

function formatBattingLine(stat) {
  const safeStat = stat || emptyStats();
  return `${safeStat.H || 0}-${safeStat.AB || 0}, ${average(safeStat.H || 0, safeStat.AB || 0)} AVG, ${safeStat.RBI || 0} RBI, ${safeStat.HR || 0} HR, ${safeStat.LOB || 0} LOB`;
}

function formatPitchingLine(stat) {
  const safeStat = stat || emptyPitchingStats();
  return `${formatInningsPitched(safeStat.OUTS || 0)} IP, ${safeStat.R || 0} R, ${safeStat.ER ?? safeStat.R ?? 0} ER, ${safeStat.H || 0} HA, ${safeStat.BB || 0} BB, ${era(safeStat)} ERA, ${whip(safeStat)} WHIP, ${pitcherLobPercent(safeStat)} LOB%`;
}

function getPlayerBattingStat(stats, player) {
  return stats?.[player] || emptyStats();
}

function getPlayerPitchingStat(stats, player) {
  return stats?.[player] || emptyPitchingStats();
}

function statScopeLabel(scope) {
  if (scope === "season") return "Season";
  if (scope === "career") return "Career";
  if (scope === "head-to-head") return "Head-to-Head";
  return "Game";
}

function battingRowsFromStats(stats) {
  return Object.entries(stats || {}).sort(([a], [b]) => a.localeCompare(b));
}

function pitchingRowsFromStats(stats) {
  return Object.entries(stats || {}).sort(([a], [b]) => a.localeCompare(b));
}

function aggregateBattingStats(stats = {}) {
  const total = emptyStats();
  Object.values(stats || {}).forEach((stat) => {
    total.GP += stat.GP || (Object.values(stat || {}).some((value) => Number(value) > 0) ? 1 : 0);
    total.PA += stat.PA || 0;
    total.AB += stat.AB || 0;
    total.R += stat.R || 0;
    total.RBI += stat.RBI || 0;
    total.LOB += stat.LOB || 0;
    total.H += stat.H || 0;
    total.D2 += stat.D2 || 0;
    total.D3 += stat.D3 || 0;
    total.HR += stat.HR || 0;
    total.BB += stat.BB || 0;
    total.K += stat.K || 0;
  });
  return total;
}

function aggregatePitchingStats(stats = {}) {
  const total = emptyPitchingStats();
  Object.values(stats || {}).forEach((stat) => {
    total.GP += stat.GP || (Object.values(stat || {}).some((value) => Number(value) > 0) ? 1 : 0);
    total.OUTS += stat.OUTS || 0;
    total.H += stat.H || 0;
    total.BB += stat.BB || 0;
    total.HR += stat.HR || 0;
    total.R += stat.R || 0;
    total.UER += stat.UER || 0;
    total.ER += stat.ER ?? stat.R ?? 0;
    total.K += stat.K || 0;
    total.BF += stat.BF || 0;
    total.AB += stat.AB || 0;
  });
  return total;
}

function statsForPlayers(stats, players) {
  const playerSet = new Set((players || []).map((player) => String(player || "").trim()).filter(Boolean));
  return Object.fromEntries(Object.entries(stats || {}).filter(([player]) => playerSet.has(player)));
}

function addBattingStats(target, source) {
  Object.entries(source || {}).forEach(([player, stat]) => {
    if (!target[player]) target[player] = emptyStats();
    target[player].GP += stat.GP || (Object.values(stat || {}).some((value) => Number(value) > 0) ? 1 : 0);
    target[player].PA += stat.PA || 0;
    target[player].AB += stat.AB || 0;
    target[player].H += stat.H || 0;
    target[player].D2 += stat.D2 || 0;
    target[player].D3 += stat.D3 || 0;
    target[player].BB += stat.BB || 0;
    target[player].K += stat.K || 0;
    target[player].HR += stat.HR || 0;
    target[player].R += stat.R || 0;
    target[player].RBI += stat.RBI || 0;
    target[player].LOB += stat.LOB || 0;
  });
}

function splitBattingStatsBySubStatus(source, subIndex = {}) {
  const official = {};
  const subs = {};
  Object.entries(source || {}).forEach(([player, stat]) => {
    addBattingStats(subIndex[player] ? subs : official, { [player]: stat });
  });
  return { official, subs };
}

function splitPitchingStatsBySubStatus(source, subIndex = {}) {
  const official = {};
  const subs = {};
  Object.entries(source || {}).forEach(([player, stat]) => {
    addPitchingStats(subIndex[player] ? subs : official, { [player]: stat });
  });
  return { official, subs };
}

function filterStatsBySubIndex(stats, subIndex = {}, shouldBeSub = true) {
  return Object.fromEntries(Object.entries(stats || {}).filter(([player]) => Boolean(subIndex[player]) === shouldBeSub));
}

function addLegacyPointsFromAwards(target, league, scope = "season", seasonYear = null) {
  (league?.years || []).map(normalizeSeasonRecord).forEach((season) => {
    if (scope === "season" && Number(season.year) !== Number(seasonYear)) return;
    (season.awards || []).forEach((award) => {
      const winner = String(award.winner || "").trim();
      if (!winner) return;
      if (!target[winner]) target[winner] = 0;
      target[winner] += Math.max(1, Math.min(3, Number(award.legacyPoints) || 1));
    });
  });
}

function addPitchingStats(target, source) {
  Object.entries(source || {}).forEach(([player, stat]) => {
    if (!target[player]) target[player] = emptyPitchingStats();
    target[player].GP += stat.GP || (Object.values(stat || {}).some((value) => Number(value) > 0) ? 1 : 0);
    target[player].BF += stat.BF || 0;
    target[player].AB += stat.AB || 0;
    target[player].OUTS += stat.OUTS || 0;
    target[player].H += stat.H || 0;
    target[player].R += stat.R || 0;
    target[player].BB += stat.BB || 0;
    target[player].K += stat.K || 0;
    target[player].HR += stat.HR || 0;
    target[player].ER += stat.ER ?? stat.R ?? 0;
    target[player].UER += stat.UER || 0;
  });
}

function buildLeaguePlayerIndex(league) {
  const index = {};
  (league?.teams || []).forEach((team) => {
    (team.players || []).forEach((player) => {
      const cleanName = String(player || "").trim();
      if (cleanName) index[cleanName] = team.name;
    });
  });
  return index;
}

function buildLeagueAggregateStats({ league, previousGames, scope = "season", seasonYear = null, sessionId = "all", tournamentOnly = false }) {
  const battingStats = {};
  const pitchingStats = {};
  const subBattingStats = {};
  const subPitchingStats = {};
  const subIndex = buildSubIndexFromSavedGames(previousGames, scope, seasonYear, league?.id, sessionId);
  const subCounts = buildSubCountsFromSavedGames(previousGames, scope, seasonYear, league?.id, sessionId);
  const playerTeamIndex = buildLeaguePlayerIndex(league);

  (previousGames || []).forEach((savedGame) => {
    if (savedGame.status !== "final") return;
    const setup = savedGame.savedSetup || {};
    if (setup.setupLeagueId !== league?.id) return;
    if (setup.isLeagueExhibition) return;
    if (scope === "season") {
      const gameYear = setup.gameSeasonYear || (savedGame.gameDate ? Number(String(savedGame.gameDate).slice(0, 4)) : null);
      if (seasonYear && Number(gameYear) !== Number(seasonYear)) return;
      if (sessionId && sessionId !== "all" && setup.gameSessionId !== sessionId) return;
    }
    if (tournamentOnly && !Boolean(setup.isTournament || savedGame.isTournament)) return;
    const savedSubIndex = buildSubIndexFromSavedGames([savedGame], "career");
    const splitBatting = splitBattingStatsBySubStatus(savedGame.stats || {}, savedSubIndex);
    const splitPitching = splitPitchingStatsBySubStatus(savedGame.pitchingStats || {}, savedSubIndex);
    addBattingStats(battingStats, splitBatting.official);
    addBattingStats(subBattingStats, splitBatting.subs);
    addPitchingStats(pitchingStats, splitPitching.official);
    addPitchingStats(subPitchingStats, splitPitching.subs);
  });

  const legacyPoints = {};
  addLegacyPointsFromAwards(legacyPoints, league, scope, seasonYear);

  return { battingStats, pitchingStats, subBattingStats, subPitchingStats, legacyPoints, subIndex, subCounts, playerTeamIndex };
}

function buildExhibitionAggregateStats(previousGames = []) {
  const battingStats = {};
  const pitchingStats = {};
  const subBattingStats = {};
  const subPitchingStats = {};
  const subIndex = buildSubIndexFromSavedGames(previousGames, "career");
  const subCounts = buildSubCountsFromSavedGames(previousGames, "career");
  const playerTeamIndex = {};

  (previousGames || []).forEach((savedGame) => {
    if (savedGame.status !== "final") return;
    const setup = savedGame.savedSetup || {};
    const isExhibitionGame = !setup.setupLeagueId || setup.setupLeagueId === "custom" || Boolean(setup.isLeagueExhibition);
    if (!isExhibitionGame) return;

    Object.entries(savedGame.teamPlayers || {}).forEach(([teamKey, players]) => {
      const teamName = teamKey === "away" ? savedGame.awayTeam : savedGame.homeTeam;
      (players || []).forEach((player) => {
        const cleanPlayer = String(player || "").trim();
        if (cleanPlayer && !playerTeamIndex[cleanPlayer]) playerTeamIndex[cleanPlayer] = teamName || "Exhibition";
      });
    });

    const savedSubIndex = buildSubIndexFromSavedGames([savedGame], "career");
    const splitBatting = splitBattingStatsBySubStatus(savedGame.stats || {}, savedSubIndex);
    const splitPitching = splitPitchingStatsBySubStatus(savedGame.pitchingStats || {}, savedSubIndex);
    addBattingStats(battingStats, splitBatting.official);
    addBattingStats(subBattingStats, splitBatting.subs);
    addPitchingStats(pitchingStats, splitPitching.official);
    addPitchingStats(subPitchingStats, splitPitching.subs);
  });

  return { battingStats, pitchingStats, subBattingStats, subPitchingStats, subIndex, subCounts, playerTeamIndex };
}

function buildHeadToHeadStats(batter, pitcher, previousGames, league = null, scope = "career", seasonYear = null) {
  const batterStats = emptyStats();
  const pitcherStats = emptyPitchingStats();

  (previousGames || []).forEach((savedGame) => {
    if (savedGame.status !== "final") return;
    const setup = savedGame.savedSetup || {};
    // For head-to-head, include both league and exhibition games
    // Only filter by league if specified
    if (league && setup.setupLeagueId !== league.id) return;
    if (scope === "season") {
      const gameYear = setup.gameSeasonYear || (savedGame.gameDate ? Number(String(savedGame.gameDate).slice(0, 4)) : null);
      if (seasonYear && Number(gameYear) !== Number(seasonYear)) return;
    }

    // Check if this game had the batter vs pitcher matchup
    const gameEvents = savedGame.events || [];
    let batterFacedPitcher = false;

    gameEvents.forEach((event) => {
      if (event.type === "play" && event.batter === batter && event.pitcher === pitcher) {
        batterFacedPitcher = true;
      }
    });

    if (batterFacedPitcher) {
      // Aggregate batter stats vs this pitcher
      const batterGameStats = savedGame.stats?.[batter] || emptyStats();
      addBattingStats({ [batter]: batterStats }, { [batter]: batterGameStats });

      // Aggregate pitcher stats vs this batter
      const pitcherGameStats = savedGame.pitchingStats?.[pitcher] || emptyPitchingStats();
      addPitchingStats({ [pitcher]: pitcherStats }, { [pitcher]: pitcherGameStats });
    }
  });

  return { batterStats: batterStats, pitcherStats: pitcherStats };
}

function leagueSeasonYears(league, previousGames) {
  const years = new Set((league?.years || []).map((yearEntry) => Number(yearEntry.year)).filter(Boolean));
  (previousGames || []).forEach((savedGame) => {
    const setup = savedGame.savedSetup || {};
    if (setup.setupLeagueId !== league?.id) return;
    const gameYear = setup.gameSeasonYear || (savedGame.gameDate ? Number(String(savedGame.gameDate).slice(0, 4)) : null);
    if (gameYear) years.add(Number(gameYear));
  });
  return [...years].sort((a, b) => b - a);
}

function leaguePlayerNamesFromStats(battingStats, pitchingStats) {
  return [...new Set([...Object.keys(battingStats || {}), ...Object.keys(pitchingStats || {})])].sort((a, b) => a.localeCompare(b));
}

function filterStatsByPlayer(stats, selectedPlayer) {
  if (!selectedPlayer || selectedPlayer === "all") return stats;
  return stats?.[selectedPlayer] ? { [selectedPlayer]: stats[selectedPlayer] } : {};
}

function eventMatchesPlayerVsScope(savedGame, league, scope = "season", seasonYear = null) {
  if (!savedGame || savedGame.status !== "final") return false;
  const setup = savedGame.savedSetup || {};
  if (scope === "exhibition") {
    const isExhibitionGame = !setup.setupLeagueId || setup.setupLeagueId === "custom" || Boolean(setup.isLeagueExhibition);
    if (!isExhibitionGame) return false;
    if (setup.setupLeagueId === "custom" && league) return false;
    if (league && setup.setupLeagueId !== league.id) return false;
  } else {
    if (setup.setupLeagueId !== league?.id) return false;
    if (setup.isLeagueExhibition) return false;
  }
  if (scope === "season") {
    const gameYear = setup.gameSeasonYear || (savedGame.gameDate ? Number(String(savedGame.gameDate).slice(0, 4)) : null);
    if (seasonYear && Number(gameYear) !== Number(seasonYear)) return false;
  }
  return true;
}

function buildPlayerVsStats({ league, previousGames, scope = "season", seasonYear = null, hitter = "all", pitcher = "all" }) {
  const hittingStats = {};
  const pitchingStats = {};
  const cleanHitter = String(hitter || "all");
  const cleanPitcher = String(pitcher || "all");

  function addHittingEvent(batter, event) {
    if (!batter) return;
    if (!hittingStats[batter]) hittingStats[batter] = emptyStats();
    const stat = hittingStats[batter];
    stat.GP = 1;
    stat.PA += 1;
    stat.AB += event.atBat || 0;
    stat.H += event.hit || 0;
    stat.D2 += event.double || 0;
    stat.D3 += event.triple || 0;
    stat.BB += event.walk || 0;
    stat.K += event.strikeout || 0;
    stat.HR += event.homeRun || 0;
    stat.RBI += event.rbi || 0;
    if ((event.outs || 0) > 0 && (event.atBat || 0) > 0 && !(event.hit || 0) && !(event.walk || 0) && !(event.homeRun || 0)) {
      stat.LOB += countBaseRunners(event.basesAfter || event.basesBefore || emptyBases());
    }
  }

  function addPitchingEvent(pitcherName, event) {
    if (!pitcherName) return;
    if (!pitchingStats[pitcherName]) pitchingStats[pitcherName] = emptyPitchingStats();
    const stat = pitchingStats[pitcherName];
    stat.GP = 1;
    stat.BF += 1;
    stat.AB += event.atBat || 0;
    stat.OUTS += event.outs || 0;
    stat.H += event.hit || 0;
    stat.R += event.runs || 0;
    stat.BB += event.walk || 0;
    stat.K += event.strikeout || 0;
    stat.HR += event.homeRun || 0;
    stat.ER += event.earnedRuns ?? event.runs ?? 0;
    stat.UER += event.unearnedRuns || 0;
  }

  (previousGames || []).forEach((savedGame) => {
    if (!eventMatchesPlayerVsScope(savedGame, league, scope, seasonYear)) return;
    const savedSubIndex = buildSubIndexFromSavedGames([savedGame], "career");
    (savedGame.events || []).forEach((event) => {
      if (event.type !== "play") return;
      const batter = String(event.batter || "").trim();
      const pitcherName = String(event.pitcher || "").trim();
      if (!batter || !pitcherName) return;
      if (savedSubIndex[batter] || savedSubIndex[pitcherName]) return;
      if (cleanHitter !== "all" && batter !== cleanHitter) return;
      if (cleanPitcher !== "all" && pitcherName !== cleanPitcher) return;
      addHittingEvent(batter, event);
      addPitchingEvent(pitcherName, event);
    });
  });

  return { hittingStats, pitchingStats };
}

function formatAverageValue(value) {
  return value.toFixed(3).replace(/^0/, "");
}

const leaderStatOptions = [
  { id: "AVG", label: "Batting Average", type: "batting", getValue: (stat) => (stat.AB ? stat.H / stat.AB : 0), format: formatAverageValue },
  { id: "H", label: "Hits", type: "batting", getValue: (stat) => stat.H || 0 },
  { id: "HR", label: "Home Runs", type: "batting", getValue: (stat) => stat.HR || 0 },
  { id: "RBI", label: "RBI", type: "batting", getValue: (stat) => stat.RBI || 0 },
  { id: "LP", label: "Legacy Points", type: "legacy", getValue: (value) => value || 0 },
  { id: "SUB", label: "Sub Appearances", type: "sub", getValue: (value) => value || 0 },
  { id: "R", label: "Runs", type: "batting", getValue: (stat) => stat.R || 0 },
  { id: "BB", label: "Walks", type: "batting", getValue: (stat) => stat.BB || 0 },
  { id: "K_HIT", label: "Batter Strikeouts", type: "batting", getValue: (stat) => stat.K || 0 },
  { id: "IP", label: "Innings Pitched", type: "pitching", getValue: (stat) => stat.OUTS || 0, format: (value) => formatInningsPitched(value) },
  { id: "P_K", label: "Pitching Strikeouts", type: "pitching", getValue: (stat) => stat.K || 0 },
  { id: "P_BB", label: "Walks Allowed", type: "pitching", getValue: (stat) => stat.BB || 0 },
  { id: "P_H", label: "Hits Allowed", type: "pitching", getValue: (stat) => stat.H || 0 },
  { id: "P_R", label: "Runs Allowed", type: "pitching", getValue: (stat) => stat.R || 0 },
  { id: "P_HR", label: "Home Runs Allowed", type: "pitching", getValue: (stat) => stat.HR || 0 },
];

function getLeaderRows(option, battingStats, pitchingStats, playerTeamIndex, limit = 5, legacyPoints = {}, subCounts = {}) {
  const sourceStats = option.type === "pitching" ? pitchingStats : option.type === "legacy" ? legacyPoints : option.type === "sub" ? subCounts : battingStats;
  return Object.entries(sourceStats || {})
    .map(([player, stat]) => ({ player, team: playerTeamIndex[player] || "—", value: option.getValue(stat), stat }))
    .filter((row) => row.value > 0)
    .sort((a, b) => b.value - a.value || a.player.localeCompare(b.player))
    .slice(0, limit);
}

function runSelfTests() {
  const tests = [];

  function test(name, fn) {
    try {
      fn();
      tests.push({ name, pass: true, message: "Passed" });
    } catch (error) {
      tests.push({ name, pass: false, message: error.message });
    }
  }

  function expectEqual(actual, expected, message) {
    if (actual !== expected) throw new Error(`${message}. Expected ${expected}, got ${actual}`);
  }

  test("Home run scores batter and existing runners", () => {
    const outcome = calculateAutoAdvance({ first: "Runner 1", second: null, third: "Runner 3" }, "Batter", resultButtons[3]);
    expectEqual(outcome.runs, 3, "Home run should score all runners and batter");
    expectEqual(outcome.rbi, 3, "Home run RBI should match runs scored");
    expectEqual(outcome.basesAfter.first, null, "Bases should be empty after HR");
    expectEqual(outcome.basesAfter.second, null, "Bases should be empty after HR");
    expectEqual(outcome.basesAfter.third, null, "Bases should be empty after HR");
  });

  test("Runner on third scores on a single and batter goes to first", () => {
    const outcome = calculateAutoAdvance({ first: null, second: null, third: "Runner 3" }, "Batter", resultButtons[0]);
    expectEqual(outcome.runs, 1, "Single should score runner from third");
    expectEqual(outcome.rbi, 1, "Batter should get one RBI");
    expectEqual(outcome.basesAfter.first, "Batter", "Batter should end on first");
    expectEqual(outcome.basesAfter.third, null, "Third should be empty");
  });

  test("Double advances runners two bases", () => {
    const outcome = calculateAutoAdvance({ first: "Runner 1", second: null, third: null }, "Batter", resultButtons[1]);
    expectEqual(outcome.runs, 0, "Runner from first should not score on simple two-base advance");
    expectEqual(outcome.basesAfter.third, "Runner 1", "Runner from first should advance to third");
    expectEqual(outcome.basesAfter.second, "Batter", "Batter should end on second");
  });

  test("Bases-loaded walk scores one and forces runners", () => {
    const outcome = calculateAutoAdvance({ first: "Runner 1", second: "Runner 2", third: "Runner 3" }, "Batter", resultButtons[4]);
    expectEqual(outcome.runs, 1, "Bases-loaded walk should score one run");
    expectEqual(outcome.basesAfter.first, "Batter", "Batter should go to first");
    expectEqual(outcome.basesAfter.second, "Runner 1", "Runner from first should move to second");
    expectEqual(outcome.basesAfter.third, "Runner 2", "Runner from second should move to third");
  });

  test("Run rule ends half-inning when threshold is reached", () => {
    expectEqual(shouldRunRuleEndHalf({ runRuleEnabled: true, runRuleRuns: 8, inningRunsBefore: 7, playRuns: 2, inning: 1 }), true, "Run rule should trigger after reaching threshold");
    expectEqual(shouldRunRuleEndHalf({ runRuleEnabled: true, runRuleRuns: 8, inningRunsBefore: 8, playRuns: 1, inning: 1 }), false, "Run rule should not retrigger if already past threshold");
    expectEqual(shouldRunRuleEndHalf({ runRuleEnabled: false, runRuleRuns: 8, inningRunsBefore: 7, playRuns: 2, inning: 1 }), false, "Disabled run rule should not trigger");
  });

  test("Run rule can be limited to before the 4th inning", () => {
    expectEqual(shouldRunRuleEndHalf({ runRuleEnabled: true, runRuleRuns: 8, inningRunsBefore: 7, playRuns: 2, inning: 3, runRuleBeforeFourthOnly: true, gameInnings: 4 }), true, "Run rule should trigger before the final inning when limited");
    expectEqual(shouldRunRuleEndHalf({ runRuleEnabled: true, runRuleRuns: 8, inningRunsBefore: 7, playRuns: 2, inning: 4, runRuleBeforeFourthOnly: true, gameInnings: 4 }), false, "Run rule should not trigger in the final inning when limited");
    expectEqual(shouldRunRuleEndHalf({ runRuleEnabled: true, runRuleRuns: 8, inningRunsBefore: 7, playRuns: 2, inning: 4, runRuleBeforeFourthOnly: true, gameInnings: 5 }), true, "Run rule should trigger in the 4th for a 5-inning game when limited");
    expectEqual(shouldRunRuleEndHalf({ runRuleEnabled: true, runRuleRuns: 8, inningRunsBefore: 7, playRuns: 2, inning: 5, runRuleBeforeFourthOnly: true, gameInnings: 5 }), false, "Run rule should not trigger in the 5th for a 5-inning game when limited");
  });

  test("Run rule walk HR scores all runners and batter", () => {
    const outcome = getRunRuleWalkHomeRunOutcome({ first: "Runner 1", second: "Runner 2", third: "Runner 3" }, "Batter");
    expectEqual(outcome.runs, 4, "Run rule walk HR should score four with bases loaded");
    expectEqual(outcome.basesAfter.first, null, "Bases should clear");
    expectEqual(outcome.basesAfter.second, null, "Bases should clear");
    expectEqual(outcome.basesAfter.third, null, "Bases should clear");
  });

  test("Scores can go below zero", () => {
    const state = calculateState([
      { type: "score_adjustment", team: "away", inning: 1, half: "top", runs: -1 },
      { type: "score_adjustment", team: "home", inning: 1, half: "bottom", runs: -2 },
    ]);
    expectEqual(state.awayScore, -1, "Away score should allow negative values");
    expectEqual(state.homeScore, -2, "Home score should allow negative values");
  });

  test("Manual bonus and removed runs affect score without player stats", () => {
    const state = calculateState([
      { type: "score_adjustment", team: "home", inning: 1, half: "bottom", runs: 1 },
      { type: "score_adjustment", team: "home", inning: 1, half: "bottom", runs: -1 },
      { type: "score_adjustment", team: "home", inning: 1, half: "bottom", runs: 2 },
    ]);
    expectEqual(state.homeScore, 2, "Home score should reflect adjustments");
    expectEqual(Object.keys(state.stats).length, 0, "Adjustments should not create player stats");
  });

  test("Line score tracks inning runs and hits", () => {
    const events = [
      { type: "play", team: "away", inning: 1, half: "top", runs: 2, hit: 1 },
      { type: "play", team: "away", inning: 1, half: "top", runs: 0, hit: 1 },
      { type: "score_adjustment", team: "home", inning: 1, half: "bottom", runs: -1 },
      { type: "play", team: "home", inning: 2, half: "bottom", runs: 3, hit: 1 },
    ];
    const state = { inning: 2, half: "bottom", status: "live", awayScore: 2, homeScore: 2 };
    const lineScore = buildLineScore(events, state);
    expectEqual(lineScore.awayRunsByInning[0], 2, "Away first-inning runs should total 2");
    expectEqual(lineScore.awayHits, 2, "Away hits should total 2");
    expectEqual(lineScore.homeRunsByInning[0], -1, "Home first-inning negative adjustment should count");
    expectEqual(lineScore.homeRunsByInning[1], 3, "Home second-inning runs should total 3");
    expectEqual(lineScore.homeHits, 1, "Home hits should total 1");
  });

  test("Pitching order loops in extra innings unless manually selected", () => {
    const order = ["P1", "P2", "P3", "P4"];
    expectEqual(getPitcherForInning(order, 1), "P1", "First inning pitcher should be P1");
    expectEqual(getPitcherForInning(order, 4), "P4", "Fourth inning pitcher should be P4");
    expectEqual(getPitcherForInning(order, 5), "P1", "Extras should default back to P1");
    expectEqual(getPitcherForInning(order, 5, "P3"), "P3", "Extras should allow selected pitcher override");
  });

  test("Power Play is not consumed when the batter walks", () => {
    const events = [{ type: "play", team: "away", defensiveTeam: "home", inning: 1, half: "top", modifier: "power_play", walk: 1 }];
    expectEqual(isPowerPlayUsedThisHalf(events, "away", "home", 1, "top"), false, "Walk should not consume power play");
  });

  test("Whammy prevents Power Play from being used in the same half inning when the batter does not walk", () => {
    const events = [{ type: "play", team: "away", defensiveTeam: "home", inning: 1, half: "top", modifier: "whammy", walk: 0 }];
    expectEqual(isPowerPlayUsedThisHalf(events, "away", "home", 1, "top"), true, "Non-walk Whammy should lock out power play");
  });

  test("Whammy walk does not prevent Power Play from being used in the same half inning", () => {
    const events = [{ type: "play", team: "away", defensiveTeam: "home", inning: 1, half: "top", modifier: "whammy", walk: 1 }];
    expectEqual(isPowerPlayUsedThisHalf(events, "away", "home", 1, "top"), false, "Whammy walk should not lock out power play");
  });

  test("Whammy is consumed for the game even when the batter walks", () => {
    const events = [{ type: "play", defensiveTeam: "home", inning: 1, half: "top", modifier: "whammy", walk: 1 }];
    expectEqual(isWhammyUsedThisGame(events, "home"), true, "Walk should still consume whammy for the game");
  });

  test("Power Play limits can be set per game or per inning and Whammy stays once per game", () => {
    const events = [
      { type: "play", team: "away", defensiveTeam: "home", inning: 1, half: "top", modifier: "power_play", walk: 0 },
      { type: "play", team: "away", defensiveTeam: "home", inning: 2, half: "top", modifier: "power_play", walk: 1 },
      { type: "play", defensiveTeam: "home", inning: 1, half: "top", modifier: "whammy", walk: 1 },
    ];
    expectEqual(countPowerPlaysThisGame(events, "away"), 1, "Power Play walks should not consume usage");
    expectEqual(countPowerPlaysThisHalf(events, "away", 1, "top"), 1, "Should count Power Plays in the current half-inning");
    expectEqual(isPowerPlayLimitReached(events, "away", "home", 3, "top", "per_game", 1), true, "Power Play game limit should block another use");
    expectEqual(isWhammyUsedThisGame(events, "home"), true, "Whammy should be used after one call");
    expectEqual(countWhammysThisGame(events, "home"), 1, "Whammy should count once for the game");
  });

  test("Tagged hitting splits combine Power Play and Whammy plays with Whammy count", () => {
    const splits = buildTaggedHittingSplits([
      { type: "play", batter: "Batter 1", modifier: "power_play", atBat: 1, hit: 1, walk: 0, strikeout: 0, homeRun: 0, rbi: 1, scored: [] },
      { type: "play", batter: "Batter 1", modifier: "whammy", atBat: 0, hit: 0, walk: 1, strikeout: 0, homeRun: 0, rbi: 0, scored: [] },
    ]);
    expectEqual(splits.length, 1, "Should create one combined row per player");
    expectEqual(splits[0].H, 1, "Power Play hit should count in combined split");
    expectEqual(splits[0].BB, 1, "Whammy walk should count in combined split");
    expectEqual(splits[0].WHAMMY, 1, "Whammy count should track whammies separately");
  });

  test("Pudwhacker splits track Pudwhacker plate appearances separately", () => {
    const splits = buildPudwhackerSplits([
      { type: "play", batter: "Batter 1", modifier: "pudwhacker", atBat: 1, hit: 1, walk: 0, strikeout: 0, homeRun: 0, rbi: 1, scored: [] },
      { type: "play", batter: "Batter 1", modifier: "power_play", atBat: 1, hit: 1, walk: 0, strikeout: 0, homeRun: 0, rbi: 0, scored: [] },
    ]);
    expectEqual(splits.length, 1, "Should only include Pudwhacker plays");
    expectEqual(splits[0].PA, 1, "Should count one Pudwhacker PA");
    expectEqual(splits[0].H, 1, "Should count Pudwhacker hit");
    expectEqual(splits[0].PUDWHACKER, 1, "Should count Pudwhacker uses");
  });

  test("Pudwhacker is once per game and only before the 4th inning", () => {
    const events = [{ type: "play", team: "away", inning: 1, half: "top", modifier: "pudwhacker" }];
    expectEqual(isPudwhackerAvailable([], "away", 3, true), true, "Pudwhacker should be available before the 4th");
    expectEqual(isPudwhackerAvailable([], "away", 4, true), false, "Pudwhacker should not be available in the 4th");
    expectEqual(isPudwhackerAvailable(events, "away", 2, true), false, "Pudwhacker should not be available after being used once");
  });

  test("Extra inning runner rules can be one-inning only or same rest of game", () => {
    const rules = [
      { id: "r6", startInning: 6, bases: "second", sameRestOfGame: false },
      { id: "r7", startInning: 7, bases: "loaded", sameRestOfGame: true },
    ];
    const order = { away: ["A1", "A2", "A3", "A4"], home: ["H1", "H2", "H3", "H4"] };
    const sixth = getExtraInningStartState(rules, order, "away", 6, 0, false);
    expectEqual(sixth.bases.second, "A4", "6th inning should start with previous batter on second");
    expectEqual(sixth.ghostRunnersCountAsRbi, false, "Ghost runner RBI setting should come from the global rule");
    const seventh = getExtraInningStartState(rules, order, "away", 7, 0);
    expectEqual(seventh.bases.first, "A4", "Loaded rule should put previous batter on first");
    expectEqual(seventh.bases.second, "A3", "Loaded rule should put second previous batter on second");
    expectEqual(seventh.bases.third, "A2", "Loaded rule should put third previous batter on third");
    const eighth = getExtraInningStartState(rules, order, "away", 8, 0);
    expectEqual(eighth.bases.first, "A4", "Same rest of game rule should continue into later innings");
    const batterFourUp = getExtraInningStartState([{ id: "r6", startInning: 6, bases: "loaded", sameRestOfGame: true }], order, "away", 6, 3);
    expectEqual(batterFourUp.bases.third, "A1", "When batter #4 is up, batter #1 should be on third");
    expectEqual(batterFourUp.bases.second, "A2", "When batter #4 is up, batter #2 should be on second");
    expectEqual(batterFourUp.bases.first, "A3", "When batter #4 is up, batter #3 should be on first");
  });

  test("Ghost runners appear in game state after advancing to configured extra inning", () => {
    const rules = [{ id: "r5", startInning: 5, bases: "second", sameRestOfGame: true, ghostRunnersCountAsRbi: true }];
    const order = { away: ["A1", "A2", "A3", "A4"], home: ["H1", "H2", "H3", "H4"] };
    const state = calculateState(
      [
        { type: "end_half", inning: 1, half: "top" },
        { type: "end_half", inning: 1, half: "bottom" },
        { type: "end_half", inning: 2, half: "top" },
        { type: "end_half", inning: 2, half: "bottom" },
        { type: "end_half", inning: 3, half: "top" },
        { type: "end_half", inning: 3, half: "bottom" },
        { type: "end_half", inning: 4, half: "top" },
        { type: "end_half", inning: 4, half: "bottom" },
      ],
      { extraRunnerRules: rules, battingOrder: order },
    );
    expectEqual(state.inning, 5, "Game should advance to the 5th");
    expectEqual(state.bases.second, "A4", "Ghost runner should show on second in game state");
  });

  test("Ghost runners appear when a half-inning ends from outs", () => {
    const rules = [{ id: "r5", startInning: 5, bases: "loaded", sameRestOfGame: true, ghostRunnersCountAsRbi: true }];
    const order = { away: ["A1", "A2", "A3", "A4"], home: ["H1", "H2", "H3", "H4"] };
    const events = [];
    for (let inning = 1; inning <= 4; inning += 1) {
      events.push(
        { type: "play", team: "away", inning, half: "top", batter: "A1", pitcher: "H1", runs: 0, rbi: 0, outs: 3, atBat: 1, hit: 0, walk: 0, strikeout: 0, homeRun: 0, repeatBatter: true, basesAfter: emptyBases(), scored: [] },
        { type: "play", team: "home", inning, half: "bottom", batter: "H1", pitcher: "A1", runs: 0, rbi: 0, outs: 3, atBat: 1, hit: 0, walk: 0, strikeout: 0, homeRun: 0, repeatBatter: true, basesAfter: emptyBases(), scored: [] },
      );
    }
    const state = calculateState(events, { extraRunnerRules: rules, battingOrder: order });
    expectEqual(state.inning, 5, "Game should advance to the 5th through outs");
    expectEqual(state.bases.first, "A4", "Loaded ghost rule should put previous batter on first");
    expectEqual(state.bases.second, "A3", "Loaded ghost rule should put second previous batter on second");
    expectEqual(state.bases.third, "A2", "Loaded ghost rule should put third previous batter on third");
  });

  test("Sac fly scores only the runner from third and gives batter an RBI out", () => {
    const outcome = getSacFlyOutcome({ first: "Runner 1", second: "Runner 2", third: "Runner 3" });
    expectEqual(outcome.runs, 1, "Sac fly should score one runner");
    expectEqual(outcome.rbi, 1, "Sac fly should credit one RBI");
    expectEqual(outcome.basesAfter.first, "Runner 1", "Runner on first should stay");
    expectEqual(outcome.basesAfter.second, "Runner 2", "Runner on second should stay");
    expectEqual(outcome.basesAfter.third, null, "Runner on third should score");
  });

  test("Roster cleaner removes blank names and keeps at least one player", () => {
    const cleaned = cleanRoster([" Nick ", "", "  ", "Marcus"]);
    expectEqual(cleaned.length, 2, "Roster should remove blanks");
    expectEqual(cleaned[0], "Nick", "Roster should trim names");
    expectEqual(cleanRoster(["", " "])[0], "Player 1", "Roster should keep fallback player");
  });

  test("Home team walk-off ends the game in the bottom of the 4th or later", () => {
    const state = calculateState([
      { type: "score_adjustment", team: "away", inning: 1, half: "top", runs: 3 },
      { type: "score_adjustment", team: "home", inning: 1, half: "bottom", runs: 3 },
      {
        type: "play",
        team: "home",
        inning: 5,
        half: "bottom",
        batter: "Home Player 1",
        pitcher: "Away Player 1",
        result: "Home Run",
        runs: 1,
        rbi: 1,
        outs: 0,
        atBat: 1,
        hit: 1,
        walk: 0,
        strikeout: 0,
        homeRun: 1,
        repeatBatter: false,
        endHalf: false,
        basesAfter: { first: null, second: null, third: null },
        scored: ["Home Player 1"],
      },
    ]);
    expectEqual(state.status, "final", "Walk-off should end game");
    expectEqual(state.winner, "home", "Home team should be winner");
  });

  test("Home team leading after the top of the 4th ends the game before the bottom half", () => {
    const state = calculateState([
      { type: "score_adjustment", team: "home", inning: 1, half: "bottom", runs: 1 },
      { type: "end_half", inning: 1, half: "top" },
      { type: "end_half", inning: 1, half: "bottom" },
      { type: "end_half", inning: 2, half: "top" },
      { type: "end_half", inning: 2, half: "bottom" },
      { type: "end_half", inning: 3, half: "top" },
      { type: "end_half", inning: 3, half: "bottom" },
      { type: "end_half", inning: 4, half: "top" },
    ]);
    expectEqual(state.status, "final", "Game should be final after top 4 when home leads");
    expectEqual(state.winner, "home", "Home should be marked as winner");
  });

  test("CSV escaping handles commas, quotes, and newlines", () => {
    expectEqual(csvEscape('A,B'), '"A,B"', "Comma should be escaped");
    expectEqual(csvEscape('A "quote"'), '"A ""quote"""', "Quote should be escaped");
    expectEqual(makeCsvRow(["A", "B"]), "A,B", "CSV row should join fields");
  });

  test("Current matchup stat formatters handle empty and populated stats", () => {
    expectEqual(
      formatBattingLine({ PA: 1, AB: 1, H: 1, BB: 0, K: 0, HR: 1, R: 1, RBI: 2 }),
      "1-1, 1.000 AVG, 1.000 OBP, 4.000 SLG, 2 RBI, 1 HR",
      "Batting line should summarize current hitter",
    );
    expectEqual(
      formatPitchingLine({ BF: 2, OUTS: 3, H: 1, R: 1, BB: 0, K: 1, HR: 1 }),
      "1.0 IP, 1 R, 1 ER, 1 HA, 0 BB, 4.00 ERA, 1.00 WHIP",
      "Pitching line should summarize current pitcher",
    );
  });

  return tests;
}

function Card({ children }) {
  return <div className="w-full max-w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm sm:rounded-2xl">{children}</div>;
}

function PlayerAvatar({ playerName, profile, size = "md" }) {
  const dimensions = size === "lg" ? "h-24 w-24" : size === "sm" ? "h-10 w-10" : "h-14 w-14";
  const textSize = size === "lg" ? "text-2xl" : size === "sm" ? "text-sm" : "text-lg";
  const cleanName = String(playerName || "?").trim();
  const nameParts = cleanName.split(" ").filter(Boolean);
  const initials = nameParts.map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "?";
  return (
    <div className={`flex ${dimensions} shrink-0 items-center justify-center overflow-hidden rounded-2xl border bg-slate-100 ${textSize} font-black text-slate-500 shadow-sm`}>
      {profile?.photoUrl ? <img src={profile.photoUrl} alt={`${cleanName} profile`} className="h-full w-full object-cover" /> : initials}
    </div>
  );
}

function Button({ children, onClick, variant = "primary", disabled = false }) {
  const styles = {
    primary: "bg-slate-900 text-white hover:bg-slate-700",
    secondary: "bg-slate-100 text-slate-900 hover:bg-slate-200",
    outline: "bg-white text-slate-900 border border-slate-300 hover:bg-slate-50",
    danger: "bg-red-600 text-white hover:bg-red-500",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex min-h-11 touch-manipulation items-center justify-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant] || styles.primary}`}
    >
      {children}
    </button>
  );
}

function NumberControl({ label, value, setValue, allowNegative = false }) {
  return (
    <div className="rounded-xl border bg-white p-3">
      <label className="text-xs font-semibold uppercase text-slate-500">{label}</label>
      <div className="mt-2 flex items-center gap-2">
        <Button variant="outline" onClick={() => setValue(allowNegative ? value - 1 : Math.max(0, value - 1))}>−</Button>
        <div className="w-10 text-center text-2xl font-bold">{value}</div>
        <Button variant="outline" onClick={() => setValue(value + 1)}>+</Button>
      </div>
    </div>
  );
}

function BaseDiamond({ bases }) {
  function Base({ label, runner, positionClass }) {
    return (
      <div className={`absolute ${positionClass} flex flex-col items-center gap-1`}>
        <div className={`flex h-11 w-11 rotate-45 items-center justify-center rounded-lg border-2 sm:h-14 sm:w-14 ${runner ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-400"}`}>
          <span className="-rotate-45 text-xs font-black">{label}</span>
        </div>
        <div className="min-h-5 max-w-20 truncate text-center text-[11px] font-semibold text-slate-700 sm:max-w-28 sm:text-xs">{runner || "Empty"}</div>
      </div>
    );
  }

  return (
    <div className="relative mx-auto h-52 w-full max-w-xs rounded-xl bg-green-50 sm:h-64 sm:max-w-sm sm:rounded-2xl">
      <div className="absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rotate-45 border-4 border-dashed border-green-300 sm:h-36 sm:w-36" />
      <Base label="1B" runner={bases.first} positionClass="right-6 top-24 sm:right-8 sm:top-28" />
      <Base label="2B" runner={bases.second} positionClass="left-1/2 top-4 -translate-x-1/2 sm:top-6" />
      <Base label="3B" runner={bases.third} positionClass="left-6 top-24 sm:left-8 sm:top-28" />
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-center sm:bottom-5">
        <div className="mx-auto h-8 w-8 rotate-45 rounded-md border-2 border-slate-400 bg-white sm:h-10 sm:w-10" />
        <div className="mt-2 text-xs font-bold uppercase text-slate-500">Home</div>
      </div>
    </div>
  );
}

function LineScore({ awayTeam, homeTeam, game, lineScore }) {
  function renderCell(team, inning, index, runsByInning) {
    if (!lineScore.shouldShowInningCell(team, inning)) return "—";
    return runsByInning[index];
  }

  return (
    <Card>
      <div className="p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">Line Score</h2>
            <p className="text-xs text-slate-500">4-inning game format with total runs and hits.</p>
          </div>
          <div className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600">
            {game.status === "final" ? "Final" : `${game.half === "top" ? "Top" : "Bottom"} ${game.inning}`}
          </div>
        </div>

        <div className="overflow-auto">
          <table className="min-w-full border-collapse text-center text-sm">
            <thead>
              <tr className="border-b bg-slate-50 text-xs uppercase text-slate-500">
                <th className="sticky left-0 bg-slate-50 px-3 py-2 text-left">Team</th>
                {lineScore.inningNumbers.map((inning) => <th key={inning} className="px-3 py-2">{inning}</th>)}
                <th className="px-3 py-2 font-black text-slate-900">R</th>
                <th className="px-3 py-2 font-black text-slate-900">H</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b bg-white">
                <td className="sticky left-0 bg-white px-3 py-2 text-left font-semibold">{awayTeam}</td>
                {lineScore.inningNumbers.map((inning, index) => <td key={inning} className="px-3 py-2">{renderCell("away", inning, index, lineScore.awayRunsByInning)}</td>)}
                <td className="px-3 py-2 text-lg font-black">{lineScore.awayRunsTotal}</td>
                <td className="px-3 py-2 text-lg font-black">{lineScore.awayHits}</td>
              </tr>
              <tr className="bg-white">
                <td className="sticky left-0 bg-white px-3 py-2 text-left font-semibold">{homeTeam}</td>
                {lineScore.inningNumbers.map((inning, index) => <td key={inning} className="px-3 py-2">{renderCell("home", inning, index, lineScore.homeRunsByInning)}</td>)}
                <td className="px-3 py-2 text-lg font-black">{lineScore.homeRunsTotal}</td>
                <td className="px-3 py-2 text-lg font-black">{lineScore.homeHits}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  );
}

function SavedLineScore({ savedGame }) {
  const lineScore = savedGame.lineScore || {};
  const inningNumbers = lineScore.inningNumbers || [];
  const awayRunsByInning = lineScore.awayRunsByInning || [];
  const homeRunsByInning = lineScore.homeRunsByInning || [];

  return (
    <div className="mt-4 rounded-2xl border bg-slate-50 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-lg font-bold">Line Score</h3>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-bold uppercase text-slate-500">Final</span>
      </div>
      <div className="overflow-auto">
        <table className="min-w-full border-collapse text-center text-sm">
          <thead>
            <tr className="border-b bg-white text-xs uppercase text-slate-500">
              <th className="sticky left-0 bg-white px-3 py-2 text-left">Team</th>
              {inningNumbers.map((inning) => <th key={inning} className="px-3 py-2">{inning}</th>)}
              <th className="px-3 py-2 font-black text-slate-900">R</th>
              <th className="px-3 py-2 font-black text-slate-900">H</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b bg-slate-50">
              <td className="sticky left-0 bg-slate-50 px-3 py-2 text-left font-semibold">{savedGame.awayTeam}</td>
              {inningNumbers.map((inning, index) => <td key={inning} className="px-3 py-2">{awayRunsByInning[index] ?? 0}</td>)}
              <td className="px-3 py-2 text-lg font-black">{lineScore.awayRunsTotal ?? savedGame.awayScore}</td>
              <td className="px-3 py-2 text-lg font-black">{lineScore.awayHits ?? 0}</td>
            </tr>
            <tr className="bg-slate-50">
              <td className="sticky left-0 bg-slate-50 px-3 py-2 text-left font-semibold">{savedGame.homeTeam}</td>
              {inningNumbers.map((inning, index) => <td key={inning} className="px-3 py-2">{homeRunsByInning[index] ?? 0}</td>)}
              <td className="px-3 py-2 text-lg font-black">{lineScore.homeRunsTotal ?? savedGame.homeScore}</td>
              <td className="px-3 py-2 text-lg font-black">{lineScore.homeHits ?? 0}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TeamPlayerEditor({ teamKey, teamName, players, subStatus, subSlots = {}, teamPlayersBySide = {}, subSlotsBySide = {}, onRenamePlayer, onAddPlayer, onRemovePlayer, onToggleSub, onSelectSubPlayer, allPlayerRecords = [], onStartInlinePlayerCreation }) {
  function renderPlayerSelect(player, index, isSub = false) {
    return (
      <select
        className={`w-full rounded-lg border px-3 py-2 text-sm ${String(player || "").trim() ? "" : "border-red-500 bg-red-50 text-red-700"}`}
        value={player || ""}
        onChange={(event) => {
          if (event.target.value === "add-new-player") {
            onStartInlinePlayerCreation(teamKey, index, isSub);
            return;
          }
          if (isSub) onSelectSubPlayer(teamKey, index, event.target.value);
          else onRenamePlayer(teamKey, index, event.target.value);
        }}
      >
        <option value="">Select player...</option>
        <option value="add-new-player">Add New Player</option>
        {allPlayerRecords.map((playerRecord) => {
          const playerName = String(playerRecord.name || "").trim();
          if (!playerName) return null;
          const alreadyInGame = isPlayerAlreadyInGame(teamPlayersBySide, playerName, teamKey, index);
          return (
            <option key={playerRecord.key || playerRecord.id || playerName} value={playerName} disabled={alreadyInGame && playerName !== player}>
              {alreadyInGame && playerName !== player ? `${playerName} - already in game` : playerName}
            </option>
          );
        })}
      </select>
    );
  }

  return (
    <div className="rounded-xl border bg-slate-50 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <h3 className="font-bold">{teamName} Players</h3>
          <p className="text-xs text-slate-500">Select players from the global Players list. Use "Add New Player" to create a new player.</p>
        </div>
        <Button variant="outline" onClick={() => onAddPlayer(teamKey)}>+ Add</Button>
      </div>
      <div className="space-y-2">
        {players.length === 0 && <p className="rounded-xl border bg-white p-3 text-sm font-semibold text-slate-500">No players added yet. Click + Add, then select players for this roster.</p>}
        {players.map((player, index) => {
          const isSub = Boolean(subSlots?.[index] || subStatus?.[player]);
          return (
            <div key={`${teamKey}-player-${index}`} className="grid grid-cols-[2rem_1fr_auto_auto] items-center gap-2">
              <div className="text-center text-sm font-bold text-slate-500">{index + 1}</div>
              <div>
                {isSub ? (
                  renderPlayerSelect(player, index, true)
                ) : (
                  renderPlayerSelect(player, index, false)
                )}
                {!String(player || "").trim() && <p className="mt-1 text-xs font-semibold text-red-600">Select a player from the Players list.</p>}
                {isSub && isSubAlreadyOnTeam(players, subSlots, player, index) && <p className="mt-1 text-xs font-semibold text-red-600">This sub is already in another roster spot for this team.</p>}
                {isSub && isSubAlreadyInGame(teamPlayersBySide, subSlotsBySide, player, teamKey, index) && <p className="mt-1 text-xs font-semibold text-red-600">This sub is already playing for the other team.</p>}
                {!isSub && isPlayerAlreadyInGame(teamPlayersBySide, player, teamKey, index) && <p className="mt-1 text-xs font-semibold text-red-600">This player is already on the other roster.</p>}
              </div>
              <label className="flex items-center gap-1 rounded-lg border bg-white px-2 py-2 text-xs font-semibold text-slate-600">
                <input type="checkbox" checked={isSub} onChange={(event) => onToggleSub(teamKey, index, player, event.target.checked)} />
                Sub
              </label>
              <button type="button" className="rounded-lg border bg-white px-2 py-1 text-xs font-bold text-red-600 disabled:opacity-40" onClick={() => onRemovePlayer(teamKey, index)} disabled={players.length <= 1} title="Remove player">×</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ReorderOnlyEditor({ teamKey, teamName, title, description, players, subStatus, onMovePlayer }) {
  return (
    <div className="rounded-xl border bg-slate-50 p-3">
      <div className="mb-2">
        <h3 className="font-bold">{teamName} {title}</h3>
        <p className="text-xs text-slate-500">{description}</p>
      </div>
      <div className="space-y-2">
        {players.map((player, index) => (
          <div key={`${teamKey}-${title}-${index}-${player}`} className="grid grid-cols-[2rem_1fr_auto] items-center gap-2 rounded-lg bg-white p-2">
            <div className="text-center text-sm font-bold text-slate-500">{index + 1}</div>
            <div className="truncate text-sm font-semibold">{formatPlayerName(player, subStatus)}</div>
            <div className="flex gap-1">
              <button type="button" className="rounded-lg border bg-white px-2 py-1 text-xs font-bold disabled:opacity-40" onClick={() => onMovePlayer(teamKey, index, -1)} disabled={index === 0} title="Move up">↑</button>
              <button type="button" className="rounded-lg border bg-white px-2 py-1 text-xs font-bold disabled:opacity-40" onClick={() => onMovePlayer(teamKey, index, 1)} disabled={index === players.length - 1} title="Move down">↓</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function calculateLeagueStandings(league, previousGames) {
  const rows = (league?.teams || []).map((team) => ({
    teamId: team.id,
    teamName: team.name,
    division: team.division || "",
    logoUrl: team.logoUrl || "",
    wins: 0,
    losses: 0,
    ties: 0,
    runsFor: 0,
    runsAgainst: 0,
    runDiff: 0,
    winPct: 0,
  }));
  const byName = Object.fromEntries(rows.map((row) => [row.teamName, row]));

  (previousGames || []).forEach((savedGame) => {
    if (savedGame.status !== "final") return;
    const setup = savedGame.savedSetup || {};
    if (setup.setupLeagueId !== league?.id) return;
    if (setup.isLeagueExhibition) return;
    const away = byName[savedGame.awayTeam];
    const home = byName[savedGame.homeTeam];
    if (!away || !home) return;

    const awayScore = Number(savedGame.awayScore) || 0;
    const homeScore = Number(savedGame.homeScore) || 0;
    away.runsFor += awayScore;
    away.runsAgainst += homeScore;
    home.runsFor += homeScore;
    home.runsAgainst += awayScore;

    if (awayScore > homeScore) {
      away.wins += 1;
      home.losses += 1;
    } else if (homeScore > awayScore) {
      home.wins += 1;
      away.losses += 1;
    } else {
      away.ties += 1;
      home.ties += 1;
    }
  });

  rows.forEach((row) => {
    const games = row.wins + row.losses + row.ties;
    row.runDiff = row.runsFor - row.runsAgainst;
    row.winPct = games ? (row.wins + row.ties * 0.5) / games : 0;
  });

  return rows.sort((a, b) => b.winPct - a.winPct || b.wins - a.wins || b.runDiff - a.runDiff || a.teamName.localeCompare(b.teamName));
}

function StandingsTable({ league, previousGames }) {
  const standings = calculateLeagueStandings(league, previousGames);
  const divisionNames = makeDivisionNames(league?.divisionCount || 0, league?.divisions || []);
  const hasDivisions = divisionNames.length > 0;
  const groups = hasDivisions
    ? divisionNames.map((division) => ({ division, teams: standings.filter((row) => row.division === division) }))
    : [{ division: "League Standings", teams: standings }];
  const unassigned = hasDivisions ? standings.filter((row) => !divisionNames.includes(row.division)) : [];
  if (unassigned.length > 0) groups.push({ division: "Unassigned", teams: unassigned });

  return (
    <Card>
      <div className="p-5">
        <div className="mb-3">
          <h2 className="text-xl font-bold">{league?.name || "League"} Standings</h2>
          <p className="text-sm text-slate-500">Based on finalized saved league games.</p>
        </div>
        <div className="space-y-5">
          {groups.map(({ division, teams }) => (
            <div key={division}>
              <h3 className="mb-2 text-sm font-black uppercase text-slate-500">{division}</h3>
              <div className="overflow-auto rounded-xl border">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr><th className="px-3 py-2">Team</th><th>W</th><th>L</th><th>T</th><th>PCT</th><th>RF</th><th>RA</th><th>DIFF</th></tr>
                  </thead>
                  <tbody>
                    {teams.map((row) => (
                      <tr key={row.teamId} className="border-t">
                        <td className="px-3 py-2 font-semibold">
                          <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg border bg-white text-[10px] text-slate-400">
                              {row.logoUrl ? <img src={row.logoUrl} alt={`${row.teamName} logo`} className="h-full w-full object-contain" /> : "Logo"}
                            </div>
                            {row.teamName}
                          </div>
                        </td>
                        <td>{row.wins}</td><td>{row.losses}</td><td>{row.ties}</td><td>{row.winPct.toFixed(3).replace(/^0/, "")}</td><td>{row.runsFor}</td><td>{row.runsAgainst}</td><td>{row.runDiff > 0 ? `+${row.runDiff}` : row.runDiff}</td>
                      </tr>
                    ))}
                    {teams.length === 0 && <tr><td className="px-3 py-3 text-slate-500" colSpan="8">No teams found yet.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

function RuleLimitEditor({ title, limitType, setLimitType, limitAmount, setLimitAmount, disabled = false }) {
  return (
    <div className="rounded-lg border bg-white p-3">
      <div className="mb-2 text-sm font-bold">{title}</div>

      <div className="grid gap-2 sm:grid-cols-2">
        <Button
          variant={limitType === "per_game" ? "primary" : "outline"}
          onClick={() => setLimitType("per_game")}
          disabled={disabled}
        >
          Per Game
        </Button>
        <Button
          variant={limitType === "per_inning" ? "primary" : "outline"}
          onClick={() => setLimitType("per_inning")}
          disabled={disabled}
        >
          Per Inning
        </Button>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
        <label className="text-xs font-semibold uppercase text-slate-500">Quantity</label>
        <input
          type="number"
          min="0"
          className="w-28 rounded-xl border px-3 py-2 text-sm font-semibold"
          value={limitAmount}
          disabled={disabled}
          onChange={(event) => setLimitAmount(Math.max(0, Number(event.target.value) || 0))}
        />
      </div>
    </div>
  );
}

function BattingStatsTable({ stats, compact = false, summaryLabel = "League Avg / Total", showGP = true, currentGameView = false }) {
  const rows = battingRowsFromStats(stats);
  const displayRows = compact ? rows.slice(0, 4) : rows;
  const averageRow = aggregateBattingStats(stats);
  const showAverageRow = rows.length > 0;
  const colSpan = currentGameView ? 9 : showGP ? 19 : 18;
  return (
    <div className="overflow-x-auto rounded-xl border bg-white">
      <table className={`${currentGameView ? "min-w-[760px]" : "min-w-[1240px]"} table-fixed text-left text-sm`}>
        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            <th className="sticky left-0 z-10 w-44 bg-slate-50 px-3 py-2">Player</th>
            {currentGameView ? (
              <><th className="w-14 px-3 py-2">AB</th><th className="w-14 px-3 py-2">R</th><th className="w-14 px-3 py-2">H</th><th className="w-14 px-3 py-2">RBI</th><th className="w-14 px-3 py-2">HR</th><th className="w-14 px-3 py-2">BB</th><th className="w-14 px-3 py-2">K</th><th className="w-14 px-3 py-2">LOB</th></>
            ) : (
              <>{showGP && <th className="w-14 px-3 py-2">GP</th>}<th className="w-14 px-3 py-2">PA</th><th className="w-14 px-3 py-2">AB</th><th className="w-16 px-3 py-2">Runs</th><th className="w-14 px-3 py-2">RBI</th><th className="w-14 px-3 py-2">Hits</th><th className="w-14 px-3 py-2">2B</th><th className="w-14 px-3 py-2">3B</th><th className="w-14 px-3 py-2">HR</th><th className="w-14 px-3 py-2">BB</th><th className="w-14 px-3 py-2">SO</th><th className="w-14 px-3 py-2">LOB</th><th className="w-16 px-3 py-2">AVG</th><th className="w-16 px-3 py-2">OBP</th><th className="w-16 px-3 py-2">SLG</th><th className="w-16 px-3 py-2">OPS</th><th className="w-20 px-3 py-2">HR-PA</th><th className="w-20 px-3 py-2">SO-PA</th></>
            )}
          </tr>
        </thead>
        <tbody>
          {displayRows.map(([player, stat]) => {
            const gamesPlayed = stat.GP || (Object.values(stat || {}).some((value) => Number(value) > 0) ? 1 : 0);
            return (
              <tr key={player} className="border-t">
                <td className="sticky left-0 z-10 bg-white px-3 py-2 font-medium">{player}</td>
                {currentGameView ? (
                  <><td className="px-3 py-2">{stat.AB || 0}</td><td className="px-3 py-2">{stat.R || 0}</td><td className="px-3 py-2">{stat.H || 0}</td><td className="px-3 py-2">{stat.RBI || 0}</td><td className="px-3 py-2">{stat.HR || 0}</td><td className="px-3 py-2">{stat.BB || 0}</td><td className="px-3 py-2">{stat.K || 0}</td><td className="px-3 py-2">{stat.LOB || 0}</td></>
                ) : (
                  <>{showGP && <td className="px-3 py-2">{gamesPlayed}</td>}<td className="px-3 py-2">{stat.PA || 0}</td><td className="px-3 py-2">{stat.AB || 0}</td><td className="px-3 py-2">{stat.R || 0}</td><td className="px-3 py-2">{stat.RBI || 0}</td><td className="px-3 py-2">{stat.H || 0}</td><td className="px-3 py-2">{stat.D2 || 0}</td><td className="px-3 py-2">{stat.D3 || 0}</td><td className="px-3 py-2">{stat.HR || 0}</td><td className="px-3 py-2">{stat.BB || 0}</td><td className="px-3 py-2">{stat.K || 0}</td><td className="px-3 py-2">{stat.LOB || 0}</td><td className="px-3 py-2">{average(stat.H || 0, stat.AB || 0)}</td><td className="px-3 py-2">{obp(stat)}</td><td className="px-3 py-2">{slg(stat)}</td><td className="px-3 py-2">{ops(stat)}</td><td className="px-3 py-2">{hrPerPa(stat)}</td><td className="px-3 py-2">{soPerPa(stat)}</td></>
                )}
              </tr>
            );
          })}
          {showAverageRow && (
            <tr className="border-t-2 bg-slate-100 font-black">
              <td className="sticky left-0 z-10 bg-slate-100 px-3 py-2">{summaryLabel}</td>
              {currentGameView ? (
                <><td className="px-3 py-2">{averageRow.AB}</td><td className="px-3 py-2">{averageRow.R}</td><td className="px-3 py-2">{averageRow.H}</td><td className="px-3 py-2">{averageRow.RBI}</td><td className="px-3 py-2">{averageRow.HR}</td><td className="px-3 py-2">{averageRow.BB}</td><td className="px-3 py-2">{averageRow.K}</td><td className="px-3 py-2">{averageRow.LOB}</td></>
              ) : (
                <>{showGP && <td className="px-3 py-2">{averageRow.GP}</td>}<td className="px-3 py-2">{averageRow.PA}</td><td className="px-3 py-2">{averageRow.AB}</td><td className="px-3 py-2">{averageRow.R}</td><td className="px-3 py-2">{averageRow.RBI}</td><td className="px-3 py-2">{averageRow.H}</td><td className="px-3 py-2">{averageRow.D2}</td><td className="px-3 py-2">{averageRow.D3}</td><td className="px-3 py-2">{averageRow.HR}</td><td className="px-3 py-2">{averageRow.BB}</td><td className="px-3 py-2">{averageRow.K}</td><td className="px-3 py-2">{averageRow.LOB}</td><td className="px-3 py-2">{average(averageRow.H, averageRow.AB)}</td><td className="px-3 py-2">{obp(averageRow)}</td><td className="px-3 py-2">{slg(averageRow)}</td><td className="px-3 py-2">{ops(averageRow)}</td><td className="px-3 py-2">{hrPerPa(averageRow)}</td><td className="px-3 py-2">{soPerPa(averageRow)}</td></>
              )}
            </tr>
          )}
          {rows.length === 0 && <tr><td className="px-3 py-3 text-slate-500" colSpan={colSpan}>No hitting stats.</td></tr>}
        </tbody>
      </table>
      {compact && rows.length > displayRows.length && <p className="p-3 text-xs text-slate-500">Showing first {displayRows.length} of {rows.length} hitters.</p>}
    </div>
  );
}

function PitchingStatsTable({ stats, compact = false, summaryLabel = "League Avg / Total", showGP = true }) {
  const rows = pitchingRowsFromStats(stats);
  const displayRows = compact ? rows.slice(0, 4) : rows;
  const averageRow = aggregatePitchingStats(stats);
  const showAverageRow = rows.length > 0;
  return (
    <div className="overflow-x-auto rounded-xl border bg-white">
      <table className="min-w-[860px] table-fixed text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            <th className="sticky left-0 z-10 w-44 bg-slate-50 px-3 py-2">Pitcher</th>
            {showGP && <th className="w-14 px-3 py-2">GP</th>}<th className="w-14 px-3 py-2">AB</th><th className="w-16 px-3 py-2">IP</th><th className="w-14 px-3 py-2">HA</th><th className="w-14 px-3 py-2">BB</th><th className="w-14 px-3 py-2">K</th><th className="w-16 px-3 py-2">HRA</th><th className="w-14 px-3 py-2">R</th><th className="w-16 px-3 py-2">UER</th><th className="w-14 px-3 py-2">ER</th><th className="w-16 px-3 py-2">ERA</th><th className="w-16 px-3 py-2">WHIP</th><th className="w-16 px-3 py-2">K:BB</th><th className="w-16 px-3 py-2">LOB%</th>
          </tr>
        </thead>
        <tbody>
          {displayRows.map(([player, stat]) => {
            const gamesPlayed = stat.GP || (Object.values(stat || {}).some((value) => Number(value) > 0) ? 1 : 0);
            return (
              <tr key={player} className="border-t">
                <td className="sticky left-0 z-10 bg-white px-3 py-2 font-medium">{player}</td>
                {showGP && <td className="px-3 py-2">{gamesPlayed}</td>}
                <td className="px-3 py-2">{stat.AB || 0}</td>
                <td className="px-3 py-2">{formatInningsPitched(stat.OUTS || 0)}</td>
                <td className="px-3 py-2">{stat.H || 0}</td>
                <td className="px-3 py-2">{stat.BB || 0}</td>
                <td className="px-3 py-2">{stat.K || 0}</td>
                <td className="px-3 py-2">{stat.HR || 0}</td>
                <td className="px-3 py-2">{stat.R || 0}</td>
                <td className="px-3 py-2">{stat.UER || 0}</td>
                <td className="px-3 py-2">{stat.ER ?? stat.R ?? 0}</td>
                <td className="px-3 py-2">{era(stat)}</td>
                <td className="px-3 py-2">{whip(stat)}</td>
                <td className="px-3 py-2">{kToBb(stat)}</td>
                <td className="px-3 py-2">{pitcherLobPercent(stat)}</td>
              </tr>
            );
          })}
          {showAverageRow && (
            <tr className="border-t-2 bg-slate-100 font-black">
              <td className="sticky left-0 z-10 bg-slate-100 px-3 py-2">{summaryLabel}</td>
              {showGP && <td className="px-3 py-2">{averageRow.GP}</td>}
              <td className="px-3 py-2">{averageRow.AB}</td>
              <td className="px-3 py-2">{formatInningsPitched(averageRow.OUTS || 0)}</td>
              <td className="px-3 py-2">{averageRow.H}</td>
              <td className="px-3 py-2">{averageRow.BB}</td>
              <td className="px-3 py-2">{averageRow.K}</td>
              <td className="px-3 py-2">{averageRow.HR}</td>
              <td className="px-3 py-2">{averageRow.R}</td>
              <td className="px-3 py-2">{averageRow.UER}</td>
              <td className="px-3 py-2">{averageRow.ER}</td>
              <td className="px-3 py-2">{era(averageRow)}</td>
              <td className="px-3 py-2">{whip(averageRow)}</td>
              <td className="px-3 py-2">{kToBb(averageRow)}</td>
              <td className="px-3 py-2">{pitcherLobPercent(averageRow)}</td>
            </tr>
          )}
          {rows.length === 0 && <tr><td className="px-3 py-3 text-slate-500" colSpan="15">No pitching stats.</td></tr>}
        </tbody>
      </table>
      {compact && rows.length > displayRows.length && <p className="p-3 text-xs text-slate-500">Showing first {displayRows.length} of {rows.length} pitchers.</p>}
    </div>
  );
}

function TeamStatsSection({ awayTeam, homeTeam, awayPlayers, homePlayers, battingStats, pitchingStats, compact = false, subIndex = {}, showGP = true, currentGameView = false }) {
  const awayBattingStats = statsForPlayers(battingStats, awayPlayers);
  const homeBattingStats = statsForPlayers(battingStats, homePlayers);
  const awayPitchingStats = statsForPlayers(pitchingStats, awayPlayers);
  const homePitchingStats = statsForPlayers(pitchingStats, homePlayers);
  const combinedBattingStats = { ...awayBattingStats, ...homeBattingStats };
  const combinedPitchingStats = { ...awayPitchingStats, ...homePitchingStats };

  return (
    <div className="space-y-4">
      <Card>
        <div className="p-5">
          <h2 className="mb-3 text-xl font-bold">Hitting Stats</h2>
          <div className="w-full max-w-full space-y-4 overflow-hidden">
            <div>
              <h3 className="mb-2 text-sm font-black uppercase text-slate-500">{awayTeam} Hitting</h3>
              <BattingStatsTable stats={awayBattingStats} compact={compact} subIndex={subIndex} summaryLabel="Team Avg / Total" showGP={showGP} currentGameView={currentGameView} />
            </div>
            <div>
              <h3 className="mb-2 text-sm font-black uppercase text-slate-500">{homeTeam} Hitting</h3>
              <BattingStatsTable stats={homeBattingStats} compact={compact} subIndex={subIndex} summaryLabel="Team Avg / Total" showGP={showGP} currentGameView={currentGameView} />
            </div>
          </div>
        </div>
      </Card>
      <Card>
        <div className="p-5">
          <h2 className="mb-3 text-xl font-bold">Pitching Stats</h2>
          <div className="space-y-4">
            <div>
              <h3 className="mb-2 text-sm font-black uppercase text-slate-500">{awayTeam} Pitching</h3>
              <PitchingStatsTable stats={awayPitchingStats} compact={compact} subIndex={subIndex} summaryLabel="Team Avg / Total" showGP={showGP} />
            </div>
            <div>
              <h3 className="mb-2 text-sm font-black uppercase text-slate-500">{homeTeam} Pitching</h3>
              <PitchingStatsTable stats={homePitchingStats} compact={compact} subIndex={subIndex} summaryLabel="Team Avg / Total" showGP={showGP} />
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

function LeagueAggregateStatsSection({ league, battingStats, pitchingStats, playerTeamIndex, selectedPlayer = "all", subIndex = {} }) {
  const filteredBattingStats = filterStatsByPlayer(battingStats, selectedPlayer);
  const filteredPitchingStats = filterStatsByPlayer(pitchingStats, selectedPlayer);

  return (
    <div className="space-y-4">
      <Card>
        <div className="p-5">
          <h2 className="mb-3 text-xl font-bold">{league?.name || "League"} Hitting Stats</h2>
          <p className="mb-3 text-sm text-slate-500">Official season/career totals exclude players marked as subs.</p>
          <BattingStatsTable stats={filteredBattingStats} subIndex={subIndex} summaryLabel="League Avg / Total" />
        </div>
      </Card>
      <Card>
        <div className="p-5">
          <h2 className="mb-3 text-xl font-bold">{league?.name || "League"} Pitching Stats</h2>
          <p className="mb-3 text-sm text-slate-500">Official season/career totals exclude players marked as subs.</p>
          <PitchingStatsTable stats={filteredPitchingStats} subIndex={subIndex} summaryLabel="League Avg / Total" />
        </div>
      </Card>
    </div>
  );
}

function SubStatsSection({ title = "Sub Stats", description = "Stats for players marked as subs.", battingStats = {}, pitchingStats = {}, subIndex = {}, selectedPlayer = "all", defaultOpen = false, showGP = true, currentGameView = false }) {
  const filteredBattingStats = filterStatsByPlayer(battingStats, selectedPlayer);
  const filteredPitchingStats = filterStatsByPlayer(pitchingStats, selectedPlayer);
  const hasStats = Object.keys(filteredBattingStats || {}).length > 0 || Object.keys(filteredPitchingStats || {}).length > 0;

  return (
    <Card>
      <details className="group" open={defaultOpen}>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5">
          <div>
            <h2 className="text-xl font-bold">{title}</h2>
            <p className="text-sm text-slate-500">{description}</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase text-slate-500 group-open:hidden">Open</span>
          <span className="hidden rounded-full bg-slate-900 px-3 py-1 text-xs font-bold uppercase text-white group-open:inline-block">Close</span>
        </summary>
        <div className="border-t p-5 pt-4">
          {hasStats ? (
            <div className="space-y-4">
              <div>
                <h3 className="mb-2 text-sm font-black uppercase text-slate-500">Sub Hitting</h3>
                <BattingStatsTable stats={filteredBattingStats} subIndex={subIndex} summaryLabel="Sub Avg / Total" showGP={showGP} currentGameView={currentGameView} />
              </div>
              <div>
                <h3 className="mb-2 text-sm font-black uppercase text-slate-500">Sub Pitching</h3>
                <PitchingStatsTable stats={filteredPitchingStats} subIndex={subIndex} summaryLabel="Sub Avg / Total" showGP={showGP} />
              </div>
            </div>
          ) : (
            <p className="rounded-xl border bg-slate-50 p-3 text-sm text-slate-500">No sub stats yet.</p>
          )}
        </div>
      </details>
    </Card>
  );
}

function LeadersSection({ battingStats, pitchingStats, legacyPoints = {}, subCounts = {}, playerTeamIndex, selectedLeaderStats, setSelectedLeaderStats }) {
  function toggleLeaderStat(statId) {
    setSelectedLeaderStats((prev) => (prev.includes(statId) ? prev.filter((item) => item !== statId) : [...prev, statId]));
  }

  const selectedOptions = leaderStatOptions.filter((option) => selectedLeaderStats.includes(option.id));

  return (
    <div className="space-y-4">
      <Card>
        <div className="p-5">
          <h2 className="mb-3 text-xl font-bold">Leaderboards Shown</h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {leaderStatOptions.map((option) => (
              <label key={option.id} className="flex items-center gap-2 rounded-xl border bg-slate-50 p-3 text-sm font-semibold">
                <input type="checkbox" checked={selectedLeaderStats.includes(option.id)} onChange={() => toggleLeaderStat(option.id)} />
                {option.label}
              </label>
            ))}
          </div>
        </div>
      </Card>

      {selectedOptions.length === 0 ? (
        <Card><div className="p-5 text-sm text-slate-500">Select at least one stat category to show leaders.</div></Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {selectedOptions.map((option) => {
            const rows = getLeaderRows(option, battingStats, pitchingStats, playerTeamIndex, 5, legacyPoints, subCounts);
            return (
              <Card key={option.id}>
                <div className="p-5">
                  <h2 className="mb-3 text-xl font-bold">{option.label}</h2>
                  <div className="overflow-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="text-xs uppercase text-slate-500"><tr><th className="py-2">#</th><th>Player</th><th>Team</th><th>Value</th></tr></thead>
                      <tbody>
                        {rows.map((row, index) => (
                          <tr key={`${option.id}-${row.player}`} className="border-t">
                            <td className="py-2 font-bold">{index + 1}</td>
                            <td className="font-semibold">{row.player}</td>
                            <td>{row.team || "—"}</td>
                            <td className="font-black">{option.format ? option.format(row.value) : row.value}</td>
                          </tr>
                        ))}
                        {rows.length === 0 && <tr><td className="py-3 text-slate-500" colSpan="4">No qualifying stats yet.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function LivePlayerStatsPanel({ battingTeamName, defensiveTeamName, currentBatter, currentPitcher, currentBatterStats, currentPitcherStats, battingTeamPlayers, defensiveTeamPlayers, battingStats, pitchingStats, subIndex = {}, currentBatterProfile = null, currentPitcherProfile = null }) {
  const battingTeamStats = statsForPlayers(battingStats, battingTeamPlayers);
  const defensivePitchingStats = statsForPlayers(pitchingStats, defensiveTeamPlayers);

  return (
    <Card>
      <div className="p-5">
        <h2 className="mb-3 text-xl font-bold">Player Stats</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-xl border bg-slate-50 p-3">
            <div className="flex items-center gap-3">
              <PlayerAvatar playerName={currentBatter} profile={currentBatterProfile} />
              <div>
                <div className="text-xs font-semibold uppercase text-slate-500">Current Batter</div>
                <div className="mt-1 text-sm font-black">{currentBatter}</div>
                <div className="mt-1 text-xs text-slate-600">{formatBattingLine(currentBatterStats)}</div>
              </div>
            </div>
          </div>
          <div className="rounded-xl border bg-slate-50 p-3">
            <div className="flex items-center gap-3">
              <PlayerAvatar playerName={currentPitcher} profile={currentPitcherProfile} />
              <div>
                <div className="text-xs font-semibold uppercase text-slate-500">Current Pitcher</div>
                <div className="mt-1 text-sm font-black">{currentPitcher}</div>
                <div className="mt-1 text-xs text-slate-600">{formatPitchingLine(currentPitcherStats)}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 space-y-4">
          <div>
            <h3 className="mb-2 text-sm font-black uppercase text-slate-500">{battingTeamName} Hitting</h3>
            <BattingStatsTable stats={battingTeamStats} compact subIndex={subIndex} showGP={false} currentGameView />
          </div>
          <div>
            <h3 className="mb-2 text-sm font-black uppercase text-slate-500">{defensiveTeamName} Pitching</h3>
            <PitchingStatsTable stats={defensivePitchingStats} compact subIndex={subIndex} showGP={false} />
          </div>
        </div>
      </div>
    </Card>
  );
}

function LeagueTeamEditor({ team, teamIndex, playersPerTeam, divisions = [], playerOptions = [], playerAssignments = {}, captainsEnabled = true, captainValueLocked = false, captainValueEnabled = true, rosterAssignmentLocked = false, onBlockedRosterAssignment, onTeamNameChange, onTeamDivisionChange, onLogoUpload, onPlayerChange, onCaptainChange, onCaptainValueChange, onMoveDefaultBatting, onMoveDefaultPitching }) {
  const battingOrder = cleanRoster(team.battingOrder || team.players || []);
  const pitchingOrder = cleanRoster(team.pitchingOrder || team.players || []);

  return (
    <div className="rounded-2xl border bg-slate-50 p-4">
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex-1">
          <label className="text-xs font-semibold uppercase text-slate-500">Team {teamIndex + 1} Name</label>
          <input
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm font-semibold"
            value={team.name}
            onChange={(event) => onTeamNameChange(teamIndex, event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          {divisions.length > 0 && (
            <>
              <label className="text-xs font-semibold uppercase text-slate-500">Division</label>
              <select className="rounded-xl border bg-white px-3 py-2 text-sm font-semibold" value={team.division || divisions[0]} onChange={(event) => onTeamDivisionChange(teamIndex, event.target.value)}>
                {divisions.map((division) => <option key={division} value={division}>{division}</option>)}
              </select>
            </>
          )}
          <label className="inline-flex cursor-pointer items-center justify-center rounded-xl border bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50">
            Upload Logo
            <input type="file" accept="image/*" className="hidden" onChange={(event) => onLogoUpload(teamIndex, event.target.files?.[0])} />
          </label>
        </div>
      </div>

      {team.logoUrl && (
        <div className="mb-3 flex items-center gap-3 rounded-xl border bg-white p-3">
          <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl border bg-white">
            <img src={team.logoUrl} alt={`${team.name} logo`} className="h-full w-full object-contain" />
          </div>
          <div className="text-sm font-semibold text-slate-600">Logo uploaded for {team.name}</div>
        </div>
      )}

      {captainsEnabled && (
        <div className="mb-3 rounded-xl border bg-white p-3">
          <div className={`grid gap-2 ${captainValueEnabled ? "md:grid-cols-[1fr_8rem]" : "md:grid-cols-1"} md:items-end`}>
            <div>
              <label className="text-xs font-semibold uppercase text-slate-500">Team Captain</label>
              <select className="mt-1 w-full rounded-xl border px-3 py-2 text-sm font-semibold" value={team.captain || ""} onChange={(event) => onCaptainChange(teamIndex, event.target.value)}>
                <option value="">No captain selected</option>
                {playerOptions.map((option) => {
                  const assignedToAnotherTeam = (playerAssignments[option] || []).some((assignment) => assignment.teamIndex !== teamIndex);
                  const assignedToThisTeam = (playerAssignments[option] || []).some((assignment) => assignment.teamIndex === teamIndex);
                  const disabled = assignedToAnotherTeam;
                  const label = assignedToAnotherTeam
                    ? `${option} — already on ${(playerAssignments[option] || []).find((assignment) => assignment.teamIndex !== teamIndex)?.teamName}`
                    : assignedToThisTeam ? `${option} — on this team` : option;
                  return <option key={option} value={option} disabled={disabled}>{label}</option>;
                })}
              </select>
            </div>
            {captainValueEnabled && (
              <div>
                <label className="text-xs font-semibold uppercase text-slate-500">Captain $</label>
                <input type="number" min="1" className="mt-1 w-full rounded-xl border px-3 py-2 text-sm font-semibold" value={team.captainValue ?? ""} disabled={captainValueLocked} onChange={(event) => onCaptainValueChange(teamIndex, event.target.value)} onBlur={(event) => onCaptainValueChange(teamIndex, normalizeCaptainValueInput(event.target.value, false))} placeholder="1" />
              </div>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-500">Captain stays on this team in every session. {captainValueEnabled ? "Captain $ is used for the active draft session and locks once that session draft starts." : "Captain $ values are hidden until draft is enabled for the active session."}</p>
        </div>
      )}

      {rosterAssignmentLocked && (
        <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-900">
          Draft is enabled, so only team captains can be assigned to teams. Other players must be added through the draft.
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        {team.players.slice(0, playersPerTeam).map((player, playerIndex) => (
          <div key={`${team.id}-player-${playerIndex}`}>
            <label className="text-xs font-semibold uppercase text-slate-500">Player {playerIndex + 1}</label>
            <select
              className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
              value={player}
              onChange={(event) => {
                const selectedPlayer = event.target.value;
                if (rosterAssignmentLocked && selectedPlayer && selectedPlayer !== team.captain) {
                  onBlockedRosterAssignment?.(selectedPlayer, team);
                  event.currentTarget.value = player || "";
                  return;
                }
                onPlayerChange(teamIndex, playerIndex, selectedPlayer);
              }}
            >
              <option value="">Select player</option>
              {team.captain && !playerOptions.includes(team.captain) && <option value={team.captain}>{team.captain} — Captain</option>}
              {playerOptions.map((option) => {
                const duplicateDisabled = isPlayerAssignedSomewhereElse(playerAssignments, option, teamIndex, playerIndex);
                const disabled = rosterAssignmentLocked ? false : duplicateDisabled;
                const assignedTo = (playerAssignments[option] || []).find((assignment) => assignment.teamIndex !== teamIndex || assignment.playerIndex !== playerIndex);
                const lockedLabel = rosterAssignmentLocked && option !== team.captain ? `${option} — draft only` : option;
                return <option key={option} value={option} disabled={disabled}>{disabled && assignedTo ? `${option} — already on ${assignedTo.teamName}` : captainsEnabled && option === team.captain ? `${option} — Captain` : lockedLabel}</option>;
              })}
              {player && !playerOptions.includes(player) && <option value={player}>{player}</option>}
            </select>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <div className="rounded-xl border bg-white p-3">
          <h4 className="mb-2 text-sm font-bold">Default Batting Order</h4>
          <p className="mb-2 text-xs text-slate-500">Change players above, then reorder here.</p>
          <div className="space-y-2">
            {battingOrder.map((player, index) => (
              <div key={`${team.id}-bat-${player}-${index}`} className="grid grid-cols-[2rem_1fr_auto] items-center gap-2 rounded-lg bg-slate-50 p-2">
                <div className="text-center text-xs font-bold text-slate-500">{index + 1}</div>
                <div className="truncate text-sm font-semibold">{player}</div>
                <div className="flex gap-1">
                  <button type="button" className="rounded-lg border bg-white px-2 py-1 text-xs font-bold disabled:opacity-40" onClick={() => onMoveDefaultBatting(teamIndex, index, -1)} disabled={index === 0}>↑</button>
                  <button type="button" className="rounded-lg border bg-white px-2 py-1 text-xs font-bold disabled:opacity-40" onClick={() => onMoveDefaultBatting(teamIndex, index, 1)} disabled={index === battingOrder.length - 1}>↓</button>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border bg-white p-3">
          <h4 className="mb-2 text-sm font-bold">Default Pitching Order</h4>
          <p className="mb-2 text-xs text-slate-500">Change players above, then reorder here.</p>
          <div className="space-y-2">
            {pitchingOrder.map((player, index) => (
              <div key={`${team.id}-pitch-${player}-${index}`} className="grid grid-cols-[2rem_1fr_auto] items-center gap-2 rounded-lg bg-slate-50 p-2">
                <div className="text-center text-xs font-bold text-slate-500">{index + 1}</div>
                <div className="truncate text-sm font-semibold">{player}</div>
                <div className="flex gap-1">
                  <button type="button" className="rounded-lg border bg-white px-2 py-1 text-xs font-bold disabled:opacity-40" onClick={() => onMoveDefaultPitching(teamIndex, index, -1)} disabled={index === 0}>↑</button>
                  <button type="button" className="rounded-lg border bg-white px-2 py-1 text-xs font-bold disabled:opacity-40" onClick={() => onMoveDefaultPitching(teamIndex, index, 1)} disabled={index === pitchingOrder.length - 1}>↓</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function WiffleScoringPrototype() {
  const storageHydratedRef = useRef(false);
  const setupSignatureInitializedRef = useRef(false);
  const [storageHydrated, setStorageHydrated] = useState(false);
  const [awayTeam, setAwayTeam] = useState("Away Team");
  const [homeTeam, setHomeTeam] = useState("Home Team");
  const [gameDate, setGameDate] = useState(todayInputValue());
  const [gameTime, setGameTime] = useState(currentTimeInputValue());
  const [gameLocation, setGameLocation] = useState("");
  const [gameSeasonYear, setGameSeasonYear] = useState(currentYearNumber());
  const [gameSessionId, setGameSessionId] = useState("");
  const [selectedFieldId, setSelectedFieldId] = useState("");
  const [gameInnings, setGameInnings] = useState(4);
  const [powerPlaysEnabled, setPowerPlaysEnabled] = useState(true);
  const [powerPlayLimitType, setPowerPlayLimitType] = useState("per_inning");
  const [powerPlayLimitAmount, setPowerPlayLimitAmount] = useState(1);
  const [whammysEnabled, setWhammysEnabled] = useState(true);
  const [pudwhackerEnabled, setPudwhackerEnabled] = useState(false);
  const [extraRunnerRules, setExtraRunnerRules] = useState([]);
  const [ghostRunnersCountAsRbi, setGhostRunnersCountAsRbi] = useState(true);
  const [runRuleEnabled, setRunRuleEnabled] = useState(false);
  const [runRuleRuns, setRunRuleRuns] = useState(8);
  const [runRuleBeforeFourthOnly, setRunRuleBeforeFourthOnly] = useState(false);
  const [walkRunRuleCountsAsHr, setWalkRunRuleCountsAsHr] = useState(true);
  const [useLeagueDefaultRules, setUseLeagueDefaultRules] = useState(true);
  const [teamPlayers, setTeamPlayers] = useState(emptyGameRosters);
  const [subPlayers, setSubPlayers] = useState({ away: {}, home: {} });
  const [subSlots, setSubSlots] = useState({ away: {}, home: {} });
  const [battingOrder, setBattingOrder] = useState(emptyGameRosters);
  const [pitchingOrder, setPitchingOrder] = useState(emptyGameRosters);
  const [extraPitchers, setExtraPitchers] = useState({ away: {}, home: {} });
  const [events, setEvents] = useState([]);
  const [previousGames, setPreviousGames] = useState([]);
  const [archivedFinalEventId, setArchivedFinalEventId] = useState(null);
  const [expandedGameId, setExpandedGameId] = useState(null);
  const [activeSavedGameId, setActiveSavedGameId] = useState(null);
  const [repeatBatter, setRepeatBatter] = useState(false);
  const [endHalf, setEndHalf] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [manualRuns, setManualRuns] = useState(0);
  const [manualRbi, setManualRbi] = useState(0);
  const [selectedModifier, setSelectedModifier] = useState(null);
  const [selectedBatterSide, setSelectedBatterSide] = useState("R");
  const [selectedPitcherSide, setSelectedPitcherSide] = useState("R");
  const [note, setNote] = useState("");
  const [showTests, setShowTests] = useState(false);
  const [activePage, setActivePage] = useState("setup");
  const [leagues, setLeagues] = useState(() => {
    const savedState = loadPersistedAppState();
    return Array.isArray(savedState?.leagues) && savedState.leagues.length > 0 ? removeUnsavedBlankLeaguePlayers(savedState.leagues) : makeDefaultLeagues();
  });
  const [selectedLeagueId, setSelectedLeagueId] = useState("default-league");
  const [setupLeagueId, setSetupLeagueId] = useState("custom");
  const [leagueGameMode, setLeagueGameMode] = useState("official");
  const [awayLeagueTeamId, setAwayLeagueTeamId] = useState("");
  const [homeLeagueTeamId, setHomeLeagueTeamId] = useState("");
  const [statsViewMode, setStatsViewMode] = useState("current");
  const [statsLeagueId, setStatsLeagueId] = useState("");
  const [statsSeasonYear, setStatsSeasonYear] = useState(currentYearNumber());
  const [statsSessionId, setStatsSessionId] = useState("all");
  const [statsPlayerFilter, setStatsPlayerFilter] = useState("all");
  const [statsVsHitterFilter, setStatsVsHitterFilter] = useState("all");
  const [statsVsPitcherFilter, setStatsVsPitcherFilter] = useState("all");
  const [statsVsScope, setStatsVsScope] = useState("season");
  const [leadersViewMode, setLeadersViewMode] = useState("season");
  const [leadersLeagueId, setLeadersLeagueId] = useState("");
  const [leadersSeasonYear, setLeadersSeasonYear] = useState(currentYearNumber());
  const [selectedLeaderStats, setSelectedLeaderStats] = useState(["AVG", "H", "HR", "RBI", "LP", "SUB", "P_K"]);
  const [fieldImportSourceLeagueId, setFieldImportSourceLeagueId] = useState("");
  const [selectedImportFieldIds, setSelectedImportFieldIds] = useState([]);
  const [setupAttempted, setSetupAttempted] = useState(false);
  const [pendingFieldRule, setPendingFieldRule] = useState(null);
  const [matchupStatScopeIndex, setMatchupStatScopeIndex] = useState(0);
  const [matchupStatCountdown, setMatchupStatCountdown] = useState(8);
  const [selectedLeagueTeamsSessionId, setSelectedLeagueTeamsSessionId] = useState("");
  const [useLeagueSchedule, setUseLeagueSchedule] = useState(false);
  const [selectedScheduledWeekId, setSelectedScheduledWeekId] = useState("");
  const [selectedScheduledGameId, setSelectedScheduledGameId] = useState("");
  const [copyScheduleTargetSessionId, setCopyScheduleTargetSessionId] = useState("");
  const [copyScheduleFirstWeekDate, setCopyScheduleFirstWeekDate] = useState(todayInputValue());
  const [copySeasonSourceId, setCopySeasonSourceId] = useState("");
  const [copySeasonTargetId, setCopySeasonTargetId] = useState("");
  const [copySeasonFirstWeekDate, setCopySeasonFirstWeekDate] = useState(todayInputValue());
  const [activeScheduleCopyTool, setActiveScheduleCopyTool] = useState("");
  const [pendingCopyWeekId, setPendingCopyWeekId] = useState("");
  const [copyWeekOneWeekLater, setCopyWeekOneWeekLater] = useState(true);
  const [yearPicker, setYearPicker] = useState(null);
  const [draftSessionId, setDraftSessionId] = useState("");
  const [draftSelectedPlayer, setDraftSelectedPlayer] = useState("");
  const [draftBidTeamId, setDraftBidTeamId] = useState("");
  const [draftBidAmount, setDraftBidAmount] = useState("1");
  const [draftTimerRemaining, setDraftTimerRemaining] = useState(60);
  const [draftTimerRunning, setDraftTimerRunning] = useState(false);
  const [draftAwardError, setDraftAwardError] = useState("");
  const [mockDraftMode, setMockDraftMode] = useState(false);
  const [mockDrafts, setMockDrafts] = useState({});
  const [draftStartedOverrides, setDraftStartedOverrides] = useState({});
  const [pendingRealDraftStart, setPendingRealDraftStart] = useState(false);
  const [pendingDraftAward, setPendingDraftAward] = useState(null);
  const [pendingDraftRestart, setPendingDraftRestart] = useState(false);
  const [pendingLeagueExitPage, setPendingLeagueExitPage] = useState(null);
  const [pendingLeagueSwitchId, setPendingLeagueSwitchId] = useState("");
  const [confirmCancelGameOpen, setConfirmCancelGameOpen] = useState(false);
  const [pendingPlayerRename, setPendingPlayerRename] = useState(null);
  const [blockedRosterAssignment, setBlockedRosterAssignment] = useState(null);
  const [pendingPlayerSaveConfirm, setPendingPlayerSaveConfirm] = useState(null);
  const [leagueDraft, setLeagueDraft] = useState(null);
  const [leagueDraftLeagueId, setLeagueDraftLeagueId] = useState("");
  const [gameStarted, setGameStarted] = useState(false);
  const [savedSetupSignature, setSavedSetupSignature] = useState("");
  const [pendingInningNotification, setPendingInningNotification] = useState(null);
  const [pendingStrikeoutResult, setPendingStrikeoutResult] = useState(null);
  const [setupEditingDuringGame, setSetupEditingDuringGame] = useState(false);
  const [pendingLeagueDelete, setPendingLeagueDelete] = useState(null);
  const [pendingNewLeague, setPendingNewLeague] = useState(false);
  const [freeAgentPlayers, setFreeAgentPlayers] = useState(() => {
    const savedState = loadPersistedAppState();
    return Array.isArray(savedState?.freeAgentPlayers) ? savedState.freeAgentPlayers.map(normalizeLeaguePlayer).filter((player) => String(player.name || "").trim()) : [];
  });
  const [playerDrafts, setPlayerDrafts] = useState(null);
  const [selectedPlayerDraftKey, setSelectedPlayerDraftKey] = useState("");
  const [pendingPlayerPageExit, setPendingPlayerPageExit] = useState(null);
  const [inlinePlayerCreationContext, setInlinePlayerCreationContext] = useState(null);
  const [inlinePlayerDraft, setInlinePlayerDraft] = useState(null);
  const [inlinePlayerCreationModalOpen, setInlinePlayerCreationModalOpen] = useState(false);

  const game = useMemo(() => calculateState(events, { extraRunnerRules, battingOrder, ghostRunnersCountAsRbi, gameInnings }), [events, extraRunnerRules, battingOrder, ghostRunnersCountAsRbi, gameInnings]);
  const matchupStatScopes = ["game", "season", "career", "head-to-head"];
  const matchupStatScope = matchupStatScopes[matchupStatScopeIndex % matchupStatScopes.length];
  const lineScore = useMemo(() => buildLineScore(events, game), [events, game]);
  const taggedHittingSplits = useMemo(() => buildTaggedHittingSplits(events), [events]);
  const pudwhackerSplits = useMemo(() => buildPudwhackerSplits(events), [events]);
  const testResults = useMemo(() => runSelfTests(), []);
  const battingTeam = game.half === "top" ? "away" : "home";
  const defensiveTeam = battingTeam === "away" ? "home" : "away";
  const battingTeamName = battingTeam === "away" ? awayTeam : homeTeam;
  const defensiveTeamName = defensiveTeam === "away" ? awayTeam : homeTeam;
  const defensiveExtraPitcher = extraPitchers[defensiveTeam]?.[game.inning] || "";
  const currentPitcher = getPitcherForInning(pitchingOrder[defensiveTeam], game.inning, defensiveExtraPitcher, gameInnings);
  const currentPitcherOptions = cleanRoster(teamPlayers[defensiveTeam]);
  const currentBattingOrder = cleanRoster(battingOrder[battingTeam]);
  const batterIndex = battingTeam === "away" ? game.awayBatterIndex : game.homeBatterIndex;
  const currentBatter = currentBattingOrder[batterIndex % currentBattingOrder.length];
  const lastEvent = events[events.length - 1];
  const allTestsPassed = testResults.every((item) => item.pass);
  const powerPlayUsed = !powerPlaysEnabled || isPowerPlayLimitReached(events, battingTeam, defensiveTeam, game.inning, game.half, powerPlayLimitType, powerPlayLimitAmount);
  const whammyUsed = !powerPlaysEnabled || !whammysEnabled || isWhammyUsedThisGame(events, defensiveTeam);
  const pudwhackerUsed = isPudwhackerUsedThisGame(events, battingTeam);
  const pudwhackerAvailable = isPudwhackerAvailable(events, battingTeam, game.inning, pudwhackerEnabled);
  const activeModifierInvalid = (selectedModifier === "power_play" && (!powerPlaysEnabled || powerPlayUsed)) || (selectedModifier === "whammy" && (!powerPlaysEnabled || !whammysEnabled || whammyUsed)) || (selectedModifier === "pudwhacker" && !pudwhackerAvailable);
  const currentBatterStats = game.stats[currentBatter] || emptyStats();
  const currentPitcherStats = game.pitchingStats[currentPitcher] || emptyPitchingStats();
  const allPlayerRecords = useMemo(() => collectGlobalPlayers(leagues, freeAgentPlayers), [leagues, freeAgentPlayers]);
  const playerPageRecords = playerDrafts || allPlayerRecords;
  const playerPageSourceSignature = JSON.stringify(canonicalizePlayerRecordsForDirtyCheck(allPlayerRecords));
  const playerPageDraftSignature = JSON.stringify(canonicalizePlayerRecordsForDirtyCheck(playerPageRecords));
  const playerPageHasUnsavedChanges = Boolean(activePage === "players" && playerDrafts && playerPageDraftSignature !== playerPageSourceSignature);
  const selectedPlayerDraft = playerPageRecords.find((player) => player.key === selectedPlayerDraftKey) || null;
  const selectedLeagueSaved = leagues.find((league) => league.id === selectedLeagueId) || leagues[0];
  const leagueDraftApplies = (activePage === "league" || activePage === "rules" || activePage === "fields") && leagueDraft && leagueDraftLeagueId === selectedLeagueSaved?.id;
  const selectedLeague = leagueDraftApplies ? leagueDraft : selectedLeagueSaved;
  const leagueHasUnsavedChanges = Boolean(leagueDraftApplies && JSON.stringify(leagueDraft) !== JSON.stringify(selectedLeagueSaved));
  const rulesHaveUnsavedChanges = Boolean(activePage === "rules" && leagueHasUnsavedChanges);
  const fieldsHaveUnsavedChanges = Boolean(activePage === "fields" && leagueHasUnsavedChanges);
  const isCustomGame = setupLeagueId === "custom";
  const isLeagueExhibitionGame = !isCustomGame && leagueGameMode === "exhibition";
  const isOfficialLeagueGame = !isCustomGame && !isLeagueExhibitionGame;
  const setupLeague = isCustomGame ? null : leagues.find((league) => league.id === setupLeagueId) || selectedLeague || leagues[0];
  const setupFieldOptions = setupLeague?.fields || [];
  const setupSeasons = (setupLeague?.years || []).map(normalizeSeasonRecord);
  const setupCurrentSeason = setupSeasons.find((season) => Number(season.year) === Number(setupLeague?.currentSeasonYear)) || setupSeasons[0] || null;
  const setupSessionOptions = setupCurrentSeason?.sessionsEnabled ? setupCurrentSeason.sessions : [];
  const leagueDefaultRules = setupLeague?.defaultGameRules || makeDefaultGameRules();
  const selectedLeagueDefaultRules = selectedLeague?.defaultGameRules || makeDefaultGameRules();
  const selectedLeagueRuleSections = normalizeLeagueRuleSections(selectedLeague?.leagueRules || []);
  const selectedLeaguePlayerOptions = getLeaguePlayerOptions(selectedLeague);
  const selectedLeagueSeasons = (selectedLeague?.years || []).map(normalizeSeasonRecord);
  const selectedLeagueRealDraftInProgress = selectedLeagueSeasons.some((season) => Object.values(season.drafts || {}).some((draft) => {
    const normalizedDraft = normalizeDraftSettings(draft, selectedLeague, draft?.sessionId || "");
    return hasDraftStarted(normalizedDraft) && !isDraftComplete(selectedLeague, normalizedDraft);
  }));
  const leagueSettingsLocked = activePage === "league" && selectedLeagueRealDraftInProgress;
  const selectedCurrentSeason = selectedLeagueSeasons.find((season) => Number(season.year) === Number(selectedLeague?.currentSeasonYear)) || selectedLeagueSeasons[0] || normalizeSeasonRecord(makeDefaultSeasonRecord(currentYearNumber()));
  const selectedCurrentSession = selectedCurrentSeason.sessions.find((session) => session.id === selectedCurrentSeason.currentSessionId) || selectedCurrentSeason.sessions[0] || null;
  const activeDraftSessionId = selectedCurrentSeason.sessionsEnabled ? (draftSessionId || selectedCurrentSession?.id || selectedCurrentSeason.sessions[0]?.id || "") : (selectedCurrentSession?.id || selectedCurrentSeason.sessions[0]?.id || "default-session");
  const activeDraftSession = selectedCurrentSeason.sessions.find((session) => session.id === activeDraftSessionId) || selectedCurrentSession || selectedCurrentSeason.sessions[0] || null;
  const activeDraftKey = `${selectedLeague?.id || "league"}-${selectedCurrentSeason?.id || "season"}-${activeDraftSessionId || "session"}`;
  const officialDraftSettings = normalizeDraftSettings(selectedCurrentSeason.drafts?.[activeDraftSessionId], selectedLeague, activeDraftSessionId);
  const leagueDraftEnabledForActiveSession = Boolean(officialDraftSettings.enabled);
  const draftStartedOverride = Boolean(draftStartedOverrides[activeDraftKey]);
  const activeDraftSettingsBase = mockDraftMode ? normalizeDraftSettings({ ...officialDraftSettings, ...(mockDrafts[activeDraftKey] || {}), enabled: true }, selectedLeague, activeDraftSessionId) : officialDraftSettings;
  const activeDraftSettings = draftStartedOverride ? normalizeDraftSettings({ ...activeDraftSettingsBase, enabled: true, started: true, completed: false }, selectedLeague, activeDraftSessionId) : activeDraftSettingsBase;
  const draftBoardEnabled = mockDraftMode || Boolean(activeDraftSettings.enabled) || Boolean(activeDraftSettings.started);
  const draftStarted = hasDraftStarted(activeDraftSettings);
  const draftCompleted = isDraftComplete(selectedLeague, activeDraftSettings);
  const draftCanUseAuction = Boolean(draftBoardEnabled && draftStarted && !draftCompleted);
  const teamsMissingCaptainValues = (selectedLeague.teams || []).filter((team) => team.captain && getCaptainDraftValue(activeDraftSettings, team) <= 0);
  const draftCaptainValuesReady = teamsMissingCaptainValues.length === 0;
  const draftPlayerOptions = selectedLeaguePlayerOptions.filter((player) => !getDraftedPlayerTeamId(activeDraftSettings, player));
  const draftCaptainNames = new Set((selectedLeague.teams || []).map((team) => String(team.captain || "").trim()).filter(Boolean));
  const draftAvailablePlayers = draftPlayerOptions.filter((player) => !draftCaptainNames.has(player));
  const draftLockedTeamIds = new Set(activeDraftSettings.lockedTeamIds || []);
  const draftEligibleTeams = (selectedLeague.teams || []).filter((team) => !draftLockedTeamIds.has(team.id));
  const draftMinimumSpend = getDraftMinimumSpend(activeDraftSettings);
  const normalizedDraftBidAmount = Number(draftBidAmount);
  const draftBidAmountNumber = Number.isFinite(normalizedDraftBidAmount) ? Math.max(0, normalizedDraftBidAmount) : 0;
  const currentDraftCarryoverError = draftBidTeamId ? getDraftCarryoverError(selectedLeague, activeDraftSettings, draftBidTeamId, draftBidAmountNumber) : "";
  const currentDraftRosterFullError = draftBidTeamId ? getDraftRosterFullError(selectedLeague, activeDraftSettings, draftBidTeamId) : "";
  const currentTeamMinimumBid = draftBidTeamId ? getTeamDraftMinimumBid(selectedLeague, activeDraftSettings, draftBidTeamId) : 1;
  const currentTeamMaximumBid = draftBidTeamId ? getTeamDraftMaximumBid(selectedLeague, activeDraftSettings, draftBidTeamId) : 0;
  const currentDraftMinimumBidError = draftSelectedPlayer && draftBidTeamId ? getDraftMinimumBidError(selectedLeague, activeDraftSettings, draftBidTeamId, draftBidAmountNumber) : "";
  const currentDraftMaximumBidError = draftSelectedPlayer && draftBidTeamId ? getDraftMaximumBidError(selectedLeague, activeDraftSettings, draftBidTeamId, draftBidAmountNumber) : "";
  const draftNominationLocked = Boolean(draftSelectedPlayer);
  const nominatedPlayerStats = draftSelectedPlayer ? buildLeagueAggregateStats({ league: selectedLeague, previousGames, scope: "career" }) : null;
  const nominatedBattingStats = draftSelectedPlayer ? getPlayerBattingStat(nominatedPlayerStats?.battingStats, draftSelectedPlayer) : emptyStats();
  const nominatedPitchingStats = draftSelectedPlayer ? getPlayerPitchingStat(nominatedPlayerStats?.pitchingStats, draftSelectedPlayer) : emptyPitchingStats();
  const currentWinningBid = getDraftCurrentBid(activeDraftSettings, draftSelectedPlayer) || getDraftBidHistory(activeDraftSettings, draftSelectedPlayer)[0] || null;
  const currentWinningTeam = currentWinningBid ? (selectedLeague.teams || []).find((team) => team.id === currentWinningBid.teamId) : null;
  const currentBidHistory = getDraftBidHistory(activeDraftSettings, draftSelectedPlayer);
  const draftNominatingTeamId = getDraftNominatingTeamId(selectedLeague, activeDraftSettings);
  const draftNominatingTeam = (selectedLeague.teams || []).find((team) => team.id === draftNominatingTeamId) || null;
  const openingBidRequiredFromNominatingTeam = Boolean(draftSelectedPlayer && !currentWinningBid && draftNominatingTeamId);
  const captainValueLockedForCurrentSeason = Object.values(selectedCurrentSeason.drafts || {}).some((draft) => hasDraftStarted(draft));
  const draftDivisionNames = makeDivisionNames(selectedLeague.divisionCount || 0, selectedLeague.divisions || []);
  const draftSummaryGroups = draftDivisionNames.length > 0
    ? [
        ...draftDivisionNames.map((division) => ({ division, teams: (selectedLeague.teams || []).filter((team) => team.division === division) })),
        { division: "Unassigned", teams: (selectedLeague.teams || []).filter((team) => !draftDivisionNames.includes(team.division || "")) },
      ].filter((group) => group.teams.length > 0)
    : [{ division: "League", teams: selectedLeague.teams || [] }];
  const sessionRosterMode = Boolean(selectedCurrentSeason.sessionsEnabled && !selectedCurrentSeason.keepRostersForSessions);
  const keepTeamIdentityForSessions = selectedCurrentSeason.keepTeamIdentityForSessions !== false;
  const leagueCaptainsEnabled = selectedLeague?.enableCaptains !== false;
  const teamsSelectedSessionId = selectedCurrentSeason.sessionsEnabled ? (selectedLeagueTeamsSessionId || selectedCurrentSession?.id || selectedCurrentSeason.sessions[0]?.id || "") : "";
  const activeLeagueTeamsSessionId = sessionRosterMode ? teamsSelectedSessionId : "";
  const visibleLeagueTeamsSessionId = selectedCurrentSeason.sessionsEnabled ? teamsSelectedSessionId : "";
  const selectedLeaguePlayerAssignments = getLeaguePlayerAssignments(selectedLeague, activeLeagueTeamsSessionId);
  const teamRosterLockedByDraftEnabled = Boolean(leagueDraftEnabledForActiveSession && !mockDraftMode);
  const selectedLeagueDuplicateAssignments = getLeagueDuplicateAssignments(selectedLeague, activeLeagueTeamsSessionId);
  const gameRulesLocked = useLeagueDefaultRules && !isCustomGame;
  const setupLeagueDefaultRulesKey = JSON.stringify(setupLeague?.defaultGameRules || {});
  const fieldImportSourceLeague = leagues.find((league) => league.id === fieldImportSourceLeagueId);
  const statsLeague = leagues.find((league) => league.id === statsLeagueId) || selectedLeague || leagues[0];
  const statsSeasonYears = leagueSeasonYears(statsLeague, previousGames);
  const selectedSeasonYear = statsSeasonYears.includes(Number(statsSeasonYear)) ? Number(statsSeasonYear) : statsSeasonYears[0] || currentYearNumber();
  const statsSeasonRecord = (statsLeague?.years || []).map(normalizeSeasonRecord).find((season) => Number(season.year) === Number(selectedSeasonYear)) || null;
  const statsSessionOptions = statsSeasonRecord?.sessionsEnabled ? statsSeasonRecord.sessions : [];
  const selectedStatsSessionId = statsSessionId === "all" || statsSessionOptions.some((session) => session.id === statsSessionId) ? statsSessionId : "all";
  const leagueAggregateStats = buildLeagueAggregateStats({
    league: statsLeague,
    previousGames,
    scope: statsViewMode === "career" ? "career" : "season",
    seasonYear: selectedSeasonYear,
    sessionId: statsViewMode === "season" || statsViewMode === "tournament" ? selectedStatsSessionId : "all",
    tournamentOnly: statsViewMode === "tournament",
  });
  const exhibitionAggregateStats = buildExhibitionAggregateStats(previousGames);
  const statsSourceForPlayerOptions = statsViewMode === "exhibition" ? exhibitionAggregateStats : leagueAggregateStats;
  const statsPlayerOptions = [...new Set([...leaguePlayerNamesFromStats(statsSourceForPlayerOptions.battingStats, statsSourceForPlayerOptions.pitchingStats), ...leaguePlayerNamesFromStats(statsSourceForPlayerOptions.subBattingStats, statsSourceForPlayerOptions.subPitchingStats)])].sort((a, b) => a.localeCompare(b));
  const statsVsPlayerOptions = statsVsScope === "exhibition" && statsLeagueId === "all"
    ? [...new Set([...leaguePlayerNamesFromStats(exhibitionAggregateStats.battingStats, exhibitionAggregateStats.pitchingStats)])].sort((a, b) => a.localeCompare(b))
    : [...new Set([...getLeaguePlayerOptions(statsLeague), ...leaguePlayerNamesFromStats(leagueAggregateStats.battingStats, leagueAggregateStats.pitchingStats)])].sort((a, b) => a.localeCompare(b));
  const playerVsStats = buildPlayerVsStats({
    league: statsVsScope === "exhibition" && statsLeagueId === "all" ? null : statsLeague,
    previousGames,
    scope: statsVsScope,
    seasonYear: selectedSeasonYear,
    hitter: statsVsHitterFilter,
    pitcher: statsVsPitcherFilter,
  });
  const leadersLeague = leagues.find((league) => league.id === leadersLeagueId) || selectedLeague || leagues[0];
  const leadersSeasonYears = leagueSeasonYears(leadersLeague, previousGames);
  const selectedLeadersSeasonYear = leadersSeasonYears.includes(Number(leadersSeasonYear)) ? Number(leadersSeasonYear) : leadersSeasonYears[0] || currentYearNumber();
  const leadersAggregateStats = buildLeagueAggregateStats({
    league: leadersLeague,
    previousGames,
    scope: leadersViewMode === "career" ? "career" : "season",
    seasonYear: selectedLeadersSeasonYear,
  });
  const matchupLeagueStats = setupLeague && !isCustomGame ? buildLeagueAggregateStats({
    league: setupLeague,
    previousGames,
    scope: matchupStatScope === "career" ? "career" : "season",
    seasonYear: gameSeasonYear,
  }) : { battingStats: {}, pitchingStats: {} };
  const currentBatterProfile = getLeaguePlayerProfile(setupLeague, currentBatter) || allPlayerRecords.find((player) => String(player.name || "").trim() === String(currentBatter || "").trim()) || getPlayerProfileFromLeagues(leagues, currentBatter);
  const currentPitcherProfile = getLeaguePlayerProfile(setupLeague, currentPitcher) || allPlayerRecords.find((player) => String(player.name || "").trim() === String(currentPitcher || "").trim()) || getPlayerProfileFromLeagues(leagues, currentPitcher);
  const batterBatsBoth = currentBatterProfile?.bats === "B";
  const pitcherThrowsBoth = currentPitcherProfile?.pitches === "B";
  const batterSideForPlay = batterBatsBoth ? selectedBatterSide : currentBatterProfile?.bats || "R";
  const pitcherSideForPlay = pitcherThrowsBoth ? selectedPitcherSide : currentPitcherProfile?.pitches || "R";
  const headToHeadStats = buildHeadToHeadStats(currentBatter, currentPitcher, previousGames, setupLeague, matchupStatScope === "season" ? "season" : "career", gameSeasonYear);
  const displayedBatterStats = matchupStatScope === "game" ? currentBatterStats : matchupStatScope === "head-to-head" ? headToHeadStats.batterStats : getPlayerBattingStat(matchupLeagueStats.battingStats, currentBatter);
  const displayedPitcherStats = matchupStatScope === "game" ? currentPitcherStats : matchupStatScope === "head-to-head" ? headToHeadStats.pitcherStats : getPlayerPitchingStat(matchupLeagueStats.pitchingStats, currentPitcher);
  const selectedField = setupLeague?.fields?.find((field) => field.id === selectedFieldId) || null;
  const knownSubPlayers = getKnownSubPlayers(previousGames, subPlayers);
  const currentSubIndex = Object.fromEntries(getSubPlayerNamesFromSubStatus(subPlayers).map((name) => [name, true]));
  const setupMainField = getMainField(setupFieldOptions);
  const activeFieldRules = selectedField?.rules || [];
  const setupScheduleSeason = setupCurrentSeason;
  const scheduledWeeksForSetup = !isCustomGame && setupScheduleSeason
    ? (setupScheduleSeason.scheduleWeeks || []).filter((week) => {
      if (!week.date || !week.fieldId) return false;
      if (setupScheduleSeason.sessionsEnabled) return week.sessionId === gameSessionId;
      return true;
    })
    : [];
  const selectedScheduledWeek = scheduledWeeksForSetup.find((week) => week.id === selectedScheduledWeekId) || null;
  const scheduledGamesForSetup = selectedScheduledWeek
    ? (selectedScheduledWeek.games || []).map((game) => ({ ...game, weekId: selectedScheduledWeek.id, weekName: selectedScheduledWeek.name, date: selectedScheduledWeek.date || "", fieldId: selectedScheduledWeek.fieldId || "" }))
    : [];
  const hasAnyUsableScheduledGamesForSetup = scheduledWeeksForSetup.some((week) => (week.games || []).length > 0);
  const selectedScheduledGame = scheduledGamesForSetup.find((scheduledGame) => scheduledGame.id === selectedScheduledGameId) || null;
  const setupRulesSignature = JSON.stringify({
    gameInnings,
    powerPlaysEnabled,
    powerPlayLimitType,
    powerPlayLimitAmount,
    whammysEnabled,
    pudwhackerEnabled,
    extraRunnerRules,
    ghostRunnersCountAsRbi,
    runRuleEnabled,
    runRuleRuns,
    runRuleBeforeFourthOnly,
    walkRunRuleCountsAsHr,
    useLeagueDefaultRules,
  });
  const setupPlayersSignature = JSON.stringify({ teamPlayers, subPlayers, subSlots });
  const setupBattingSignature = JSON.stringify({ battingOrder });
  const setupPitchingSignature = JSON.stringify({ pitchingOrder, extraPitchers });
  const currentSetupSignature = JSON.stringify({
    setupLeagueId,
    leagueGameMode,
    awayTeam,
    homeTeam,
    gameDate,
    gameTime,
    gameLocation,
    gameSeasonYear,
    gameSessionId,
    selectedFieldId,
    awayLeagueTeamId,
    homeLeagueTeamId,
    useLeagueSchedule,
    selectedScheduledWeekId,
    selectedScheduledGameId,
    setupRulesSignature,
    setupPlayersSignature,
    setupBattingSignature,
    setupPitchingSignature,
  });
  let savedSetupParts = {};
  try {
    savedSetupParts = savedSetupSignature ? JSON.parse(savedSetupSignature) : {};
  } catch (error) {
    savedSetupParts = {};
  }
  const unsavedSetupChanges = Boolean(savedSetupSignature && currentSetupSignature !== savedSetupSignature);
  const unsavedGameRules = Boolean(savedSetupParts.setupRulesSignature && savedSetupParts.setupRulesSignature !== setupRulesSignature);
  const unsavedTeamPlayers = Boolean(savedSetupParts.setupPlayersSignature && savedSetupParts.setupPlayersSignature !== setupPlayersSignature);
  const unsavedBattingOrder = Boolean(savedSetupParts.setupBattingSignature && savedSetupParts.setupBattingSignature !== setupBattingSignature);
  const unsavedPitchingOrder = Boolean(savedSetupParts.setupPitchingSignature && savedSetupParts.setupPitchingSignature !== setupPitchingSignature);
  const setupEditingLocked = Boolean(gameStarted && !setupEditingDuringGame);
  const setupCanResumeGame = Boolean(gameStarted && !unsavedSetupChanges);
  const finalGameAwaitingNewSetup = Boolean(gameStarted && game.status === "final");
  const hasLocalDraftChanges = Boolean(playerPageHasUnsavedChanges || leagueHasUnsavedChanges || unsavedSetupChanges || selectedPlayerDraft || inlinePlayerCreationModalOpen || pendingPlayerSaveConfirm || pendingPlayerPageExit || pendingLeagueExitPage || pendingLeagueSwitchId || pendingDraftAward || pendingDraftRestart || pendingRealDraftStart || pendingPlayerRename || confirmCancelGameOpen);

  const setupErrors = [];
  if (!setupLeagueId && !isCustomGame) setupErrors.push("Select a league or choose Custom Game.");
  if (!String(awayTeam || "").trim()) setupErrors.push("Enter or select an away team.");
  if (!String(homeTeam || "").trim()) setupErrors.push("Enter or select a home team.");
  if (isOfficialLeagueGame && !awayLeagueTeamId) setupErrors.push("Select an away team from the league schedule.");
  if (isOfficialLeagueGame && !homeLeagueTeamId) setupErrors.push("Select a home team from the league schedule.");
  if (isOfficialLeagueGame && awayLeagueTeamId && homeLeagueTeamId && awayLeagueTeamId === homeLeagueTeamId) setupErrors.push("Away and home teams must be different.");
  if (!gameDate) setupErrors.push("Select a game date.");
  if (!gameTime) setupErrors.push("Select a game time.");
  // Custom games can start without a location. Location remains optional.
  if (isOfficialLeagueGame && !selectedFieldId) setupErrors.push("Select a field.");
  if (isOfficialLeagueGame && setupCurrentSeason?.sessionsEnabled && !gameSessionId) setupErrors.push("Select a session.");
  if (isOfficialLeagueGame && !hasAnyUsableScheduledGamesForSetup) setupErrors.push("Create a schedule game first, or switch to League Exhibition.");
  if (isOfficialLeagueGame && hasAnyUsableScheduledGamesForSetup && !selectedScheduledWeekId) setupErrors.push("Select a scheduled week for this official league game.");
  if (isOfficialLeagueGame && selectedScheduledWeekId && !selectedScheduledGameId) setupErrors.push("Select a scheduled game for this official league game.");
  if (!isCustomGame && useLeagueSchedule && !isLeagueExhibitionGame && !selectedScheduledWeekId) setupErrors.push("Select a scheduled week or turn off Use League Schedule.");
  if (!isCustomGame && useLeagueSchedule && !isLeagueExhibitionGame && selectedScheduledWeekId && !selectedScheduledGameId) setupErrors.push("Select a scheduled game or turn off Use League Schedule.");
  if ((teamPlayers.away || []).map((player) => String(player || "").trim()).filter(Boolean).length < 1) setupErrors.push("Add at least one away player.");
  if ((teamPlayers.home || []).map((player) => String(player || "").trim()).filter(Boolean).length < 1) setupErrors.push("Add at least one home player.");
  if (unsavedSetupChanges) setupErrors.push("Save setup changes before starting the game.");
  const setupComplete = setupErrors.length === 0;

  function applyPersistedState(savedState) {
    if (!savedState) return;
    if (Array.isArray(savedState.leagues) && savedState.leagues.length > 0) setLeagues(removeUnsavedBlankLeaguePlayers(savedState.leagues));
    if (Array.isArray(savedState.freeAgentPlayers)) setFreeAgentPlayers(savedState.freeAgentPlayers.map(normalizeLeaguePlayer).filter((player) => String(player.name || "").trim()));
    if (savedState.awayTeam != null) setAwayTeam(savedState.awayTeam);
    if (savedState.homeTeam != null) setHomeTeam(savedState.homeTeam);
    if (savedState.gameDate != null) setGameDate(savedState.gameDate);
    if (savedState.gameTime != null) setGameTime(savedState.gameTime);
    if (savedState.gameLocation != null) setGameLocation(savedState.gameLocation);
    if (savedState.gameSeasonYear != null) setGameSeasonYear(savedState.gameSeasonYear);
    if (savedState.gameSessionId != null) setGameSessionId(savedState.gameSessionId);
    if (savedState.selectedFieldId != null) setSelectedFieldId(savedState.selectedFieldId);
    if (savedState.gameInnings != null) setGameInnings(Math.max(1, Number(savedState.gameInnings) || 4));
    if (savedState.powerPlaysEnabled != null) setPowerPlaysEnabled(savedState.powerPlaysEnabled);
    if (savedState.powerPlayLimitType != null) setPowerPlayLimitType(savedState.powerPlayLimitType);
    if (savedState.powerPlayLimitAmount != null) setPowerPlayLimitAmount(savedState.powerPlayLimitAmount);
    if (savedState.whammysEnabled != null) setWhammysEnabled(savedState.whammysEnabled);
    if (savedState.pudwhackerEnabled != null) setPudwhackerEnabled(savedState.pudwhackerEnabled);
    if (Array.isArray(savedState.extraRunnerRules)) setExtraRunnerRules(savedState.extraRunnerRules);
    if (savedState.ghostRunnersCountAsRbi != null) setGhostRunnersCountAsRbi(savedState.ghostRunnersCountAsRbi);
    if (savedState.runRuleEnabled != null) setRunRuleEnabled(savedState.runRuleEnabled);
    if (savedState.runRuleRuns != null) setRunRuleRuns(savedState.runRuleRuns);
    if (savedState.runRuleBeforeFourthOnly != null) setRunRuleBeforeFourthOnly(savedState.runRuleBeforeFourthOnly);
    if (savedState.walkRunRuleCountsAsHr != null) setWalkRunRuleCountsAsHr(savedState.walkRunRuleCountsAsHr);
    if (savedState.useLeagueDefaultRules != null) setUseLeagueDefaultRules(savedState.useLeagueDefaultRules);
    if (savedState.teamPlayers) setTeamPlayers(savedState.teamPlayers);
    if (savedState.subPlayers) setSubPlayers(savedState.subPlayers);
    if (savedState.subSlots) setSubSlots(savedState.subSlots);
    if (savedState.battingOrder) setBattingOrder(savedState.battingOrder);
    if (savedState.pitchingOrder) setPitchingOrder(savedState.pitchingOrder);
    if (savedState.extraPitchers) setExtraPitchers(savedState.extraPitchers);
    if (Array.isArray(savedState.events)) setEvents(savedState.events);
    if (Array.isArray(savedState.previousGames)) setPreviousGames(savedState.previousGames);
    if (savedState.archivedFinalEventId !== undefined) setArchivedFinalEventId(savedState.archivedFinalEventId);
    if (savedState.expandedGameId !== undefined) setExpandedGameId(savedState.expandedGameId);
    if (savedState.activeSavedGameId !== undefined) setActiveSavedGameId(savedState.activeSavedGameId);
    if (savedState.activePage != null) setActivePage(savedState.activePage);
    if (savedState.selectedLeagueId != null) setSelectedLeagueId(savedState.selectedLeagueId);
    if (savedState.setupLeagueId != null) setSetupLeagueId(savedState.setupLeagueId);
    if (savedState.leagueGameMode != null) setLeagueGameMode(savedState.leagueGameMode);
    if (savedState.awayLeagueTeamId != null) setAwayLeagueTeamId(savedState.awayLeagueTeamId);
    if (savedState.homeLeagueTeamId != null) setHomeLeagueTeamId(savedState.homeLeagueTeamId);
    if (savedState.statsViewMode != null) setStatsViewMode(savedState.statsViewMode);
    if (savedState.statsLeagueId != null) setStatsLeagueId(savedState.statsLeagueId);
    if (savedState.statsSeasonYear != null) setStatsSeasonYear(savedState.statsSeasonYear);
    if (savedState.statsSessionId != null) setStatsSessionId(savedState.statsSessionId);
    if (savedState.statsPlayerFilter != null) setStatsPlayerFilter(savedState.statsPlayerFilter);
    if (savedState.statsVsHitterFilter != null) setStatsVsHitterFilter(savedState.statsVsHitterFilter);
    if (savedState.statsVsPitcherFilter != null) setStatsVsPitcherFilter(savedState.statsVsPitcherFilter);
    if (savedState.statsVsScope != null) setStatsVsScope(savedState.statsVsScope);
    if (savedState.leadersViewMode != null) setLeadersViewMode(savedState.leadersViewMode);
    if (savedState.leadersLeagueId != null) setLeadersLeagueId(savedState.leadersLeagueId);
    if (savedState.leadersSeasonYear != null) setLeadersSeasonYear(savedState.leadersSeasonYear);
    if (Array.isArray(savedState.selectedLeaderStats)) setSelectedLeaderStats(savedState.selectedLeaderStats);
    if (savedState.fieldImportSourceLeagueId != null) setFieldImportSourceLeagueId(savedState.fieldImportSourceLeagueId);
    if (Array.isArray(savedState.selectedImportFieldIds)) setSelectedImportFieldIds(savedState.selectedImportFieldIds);
    if (savedState.setupAttempted != null) setSetupAttempted(savedState.setupAttempted);
    if (savedState.matchupStatScopeIndex != null) setMatchupStatScopeIndex(savedState.matchupStatScopeIndex);
    if (savedState.selectedLeagueTeamsSessionId != null) setSelectedLeagueTeamsSessionId(savedState.selectedLeagueTeamsSessionId);
    if (savedState.useLeagueSchedule != null) setUseLeagueSchedule(savedState.useLeagueSchedule);
    if (savedState.selectedScheduledWeekId != null) setSelectedScheduledWeekId(savedState.selectedScheduledWeekId);
    if (savedState.selectedScheduledGameId != null) setSelectedScheduledGameId(savedState.selectedScheduledGameId);
    if (savedState.copyScheduleTargetSessionId != null) setCopyScheduleTargetSessionId(savedState.copyScheduleTargetSessionId);
    if (savedState.copyScheduleFirstWeekDate != null) setCopyScheduleFirstWeekDate(savedState.copyScheduleFirstWeekDate);
    if (savedState.copySeasonSourceId != null) setCopySeasonSourceId(savedState.copySeasonSourceId);
    if (savedState.copySeasonTargetId != null) setCopySeasonTargetId(savedState.copySeasonTargetId);
    if (savedState.copySeasonFirstWeekDate != null) setCopySeasonFirstWeekDate(savedState.copySeasonFirstWeekDate);
    if (savedState.activeScheduleCopyTool != null) setActiveScheduleCopyTool(savedState.activeScheduleCopyTool);
    if (savedState.pendingCopyWeekId != null) setPendingCopyWeekId(savedState.pendingCopyWeekId);
    if (savedState.copyWeekOneWeekLater != null) setCopyWeekOneWeekLater(savedState.copyWeekOneWeekLater);
    if (savedState.draftSessionId != null) setDraftSessionId(savedState.draftSessionId);
    if (savedState.draftSelectedPlayer != null) setDraftSelectedPlayer(savedState.draftSelectedPlayer);
    if (savedState.draftBidTeamId != null) setDraftBidTeamId(savedState.draftBidTeamId);
    if (savedState.draftBidAmount != null) setDraftBidAmount(savedState.draftBidAmount);
    if (savedState.draftTimerRemaining != null) setDraftTimerRemaining(savedState.draftTimerRemaining);
    if (savedState.draftTimerRunning != null) setDraftTimerRunning(savedState.draftTimerRunning);
    if (savedState.draftAwardError != null) setDraftAwardError(savedState.draftAwardError);
    if (savedState.mockDraftMode != null) setMockDraftMode(savedState.mockDraftMode);
    if (savedState.mockDrafts) setMockDrafts(savedState.mockDrafts);
    if (savedState.draftStartedOverrides) setDraftStartedOverrides(savedState.draftStartedOverrides);
    if (savedState.gameStarted != null) setGameStarted(savedState.gameStarted);
    if (savedState.savedSetupSignature != null) setSavedSetupSignature(savedState.savedSetupSignature);
    if (savedState.setupEditingDuringGame != null) setSetupEditingDuringGame(savedState.setupEditingDuringGame);
    setPlayerDrafts(null);
    setLeagueDraft(null);
    setLeagueDraftLeagueId("");
  }

  useEffect(() => {
    const savedState = loadPersistedAppState();
    if (!savedState) {
      storageHydratedRef.current = true;
      setStorageHydrated(true);
      return;
    }

    applyPersistedState(savedState);

    storageHydratedRef.current = true;
    setStorageHydrated(true);
  }, []);

  useEffect(() => {
    if (!storageHydrated) return;
    savePersistedAppState({
      version: 1,
      savedAt: new Date().toISOString(),
      awayTeam,
      homeTeam,
      gameDate,
      gameTime,
      gameLocation,
      gameSeasonYear,
      gameSessionId,
      selectedFieldId,
      gameInnings,
      powerPlaysEnabled,
      powerPlayLimitType,
      powerPlayLimitAmount,
      whammysEnabled,
      pudwhackerEnabled,
      extraRunnerRules,
      ghostRunnersCountAsRbi,
      runRuleEnabled,
      runRuleRuns,
      runRuleBeforeFourthOnly,
      walkRunRuleCountsAsHr,
      useLeagueDefaultRules,
      teamPlayers,
      subPlayers,
      subSlots,
      battingOrder,
      pitchingOrder,
      extraPitchers,
      events,
      previousGames,
      archivedFinalEventId,
      expandedGameId,
      activeSavedGameId,
      activePage,
      leagues,
      freeAgentPlayers,
      selectedLeagueId,
      setupLeagueId,
      leagueGameMode,
      awayLeagueTeamId,
      homeLeagueTeamId,
      statsViewMode,
      statsLeagueId,
      statsSeasonYear,
      statsSessionId,
      statsPlayerFilter,
      statsVsHitterFilter,
      statsVsPitcherFilter,
      statsVsScope,
      leadersViewMode,
      leadersLeagueId,
      leadersSeasonYear,
      selectedLeaderStats,
      fieldImportSourceLeagueId,
      selectedImportFieldIds,
      setupAttempted,
      matchupStatScopeIndex,
      selectedLeagueTeamsSessionId,
      useLeagueSchedule,
      selectedScheduledWeekId,
      selectedScheduledGameId,
      copyScheduleTargetSessionId,
      copyScheduleFirstWeekDate,
      copySeasonSourceId,
      copySeasonTargetId,
      copySeasonFirstWeekDate,
      activeScheduleCopyTool,
      pendingCopyWeekId,
      copyWeekOneWeekLater,
      draftSessionId,
      draftSelectedPlayer,
      draftBidTeamId,
      draftBidAmount,
      draftTimerRemaining,
      draftTimerRunning,
      draftAwardError,
      mockDraftMode,
      mockDrafts,
      draftStartedOverrides,
      gameStarted,
      savedSetupSignature,
      setupEditingDuringGame,
    });
  }, [storageHydrated, awayTeam, homeTeam, gameDate, gameTime, gameLocation, gameSeasonYear, gameSessionId, selectedFieldId, gameInnings, powerPlaysEnabled, powerPlayLimitType, powerPlayLimitAmount, whammysEnabled, pudwhackerEnabled, extraRunnerRules, ghostRunnersCountAsRbi, runRuleEnabled, runRuleRuns, runRuleBeforeFourthOnly, walkRunRuleCountsAsHr, useLeagueDefaultRules, teamPlayers, subPlayers, subSlots, battingOrder, pitchingOrder, extraPitchers, events, previousGames, archivedFinalEventId, expandedGameId, activeSavedGameId, activePage, leagues, freeAgentPlayers, selectedLeagueId, setupLeagueId, leagueGameMode, awayLeagueTeamId, homeLeagueTeamId, statsViewMode, statsLeagueId, statsSeasonYear, statsSessionId, statsPlayerFilter, statsVsHitterFilter, statsVsPitcherFilter, statsVsScope, leadersViewMode, leadersLeagueId, leadersSeasonYear, selectedLeaderStats, fieldImportSourceLeagueId, selectedImportFieldIds, setupAttempted, matchupStatScopeIndex, selectedLeagueTeamsSessionId, useLeagueSchedule, selectedScheduledWeekId, selectedScheduledGameId, copyScheduleTargetSessionId, copyScheduleFirstWeekDate, copySeasonSourceId, copySeasonTargetId, copySeasonFirstWeekDate, activeScheduleCopyTool, pendingCopyWeekId, copyWeekOneWeekLater, draftSessionId, draftSelectedPlayer, draftBidTeamId, draftBidAmount, draftTimerRemaining, draftTimerRunning, draftAwardError, mockDraftMode, mockDrafts, draftStartedOverrides, gameStarted, savedSetupSignature, setupEditingDuringGame]);

  useEffect(() => {
    if (!storageHydrated || setupSignatureInitializedRef.current) return;
    if (!savedSetupSignature) setSavedSetupSignature(currentSetupSignature);
    setupSignatureInitializedRef.current = true;
  }, [storageHydrated, savedSetupSignature, currentSetupSignature]);

  useEffect(() => {
    if (!storageHydrated) return undefined;

    async function pollSharedState() {
      try {
        if (hasLocalDraftChanges) return;
        const response = await fetch(WIFFLE_SHARED_STATE_ENDPOINT, { cache: "no-store" });
        if (!response.ok) return;
        const sharedState = await response.json();
        if (!sharedState || typeof sharedState !== "object") return;

        const sharedSavedAt = getSavedAtTime(sharedState);
        const baseSavedAt = window.__WIFFLE_SYNC_BASE_SAVED_AT ? new Date(window.__WIFFLE_SYNC_BASE_SAVED_AT).getTime() : 0;
        if (sharedSavedAt <= baseSavedAt) return;

        window.localStorage.setItem(WIFFLE_LOCAL_STORAGE_KEY, JSON.stringify(sharedState));
        window.__WIFFLE_SYNC_BASE_SAVED_AT = sharedState.savedAt || "";
        applyPersistedState(sharedState);
      } catch (error) {
        // The shared API can be unavailable in static previews or while offline.
      }
    }

    function handleSharedStateUpdated(event) {
      if (!event.detail || hasLocalDraftChanges) return;
      applyPersistedState(event.detail);
    }

    window.addEventListener("wiffle:shared-state-updated", handleSharedStateUpdated);
    const timer = window.setInterval(pollSharedState, WIFFLE_SHARED_STATE_POLL_MS);
    return () => {
      window.removeEventListener("wiffle:shared-state-updated", handleSharedStateUpdated);
      window.clearInterval(timer);
    };
  }, [storageHydrated, hasLocalDraftChanges]);

  useEffect(() => {
    if ((activePage !== "league" && activePage !== "rules" && activePage !== "fields") || !selectedLeagueSaved) return;
    if (leagueDraftLeagueId === selectedLeagueSaved.id && leagueDraft) return;
    setLeagueDraft(cloneLeagueRecord(selectedLeagueSaved));
    setLeagueDraftLeagueId(selectedLeagueSaved.id);
  }, [activePage, selectedLeagueSaved?.id]);

  useEffect(() => {
    if (activePage !== "players") return;
    if (!playerDrafts) setPlayerDrafts(cloneLeagueRecord(allPlayerRecords));
  }, [activePage, allPlayerRecords, playerDrafts]);

  function saveSetupChanges() {
    setSavedSetupSignature(currentSetupSignature);
  }

  function resumeGameFromSetup() {
    if (unsavedSetupChanges) {
      window.alert("Save setup changes before resuming the game.");
      return;
    }
    setSetupEditingDuringGame(false);
    setActivePage("score");
  }

  function saveLeagueDraftChanges() {
    if (!leagueDraft || !leagueDraftLeagueId) return;
    const beforeLeague = leagues.find((league) => league.id === leagueDraftLeagueId) || selectedLeagueSaved || {};
    const savedDraft = cloneLeagueRecord(leagueDraft);
    const rulesChanged = JSON.stringify(beforeLeague.leagueRules || []) !== JSON.stringify(savedDraft.leagueRules || []);
    if (rulesChanged) {
      savedDraft.leagueRuleChangeLog = [
        makeLeagueRuleChangeLogEntry(beforeLeague, savedDraft),
        ...(beforeLeague.leagueRuleChangeLog || []),
      ];
    } else {
      savedDraft.leagueRuleChangeLog = beforeLeague.leagueRuleChangeLog || savedDraft.leagueRuleChangeLog || [];
    }
    setLeagues((prev) => prev.map((league) => (league.id === leagueDraftLeagueId ? savedDraft : league)));
    setLeagueDraft(cloneLeagueRecord(savedDraft));
  }

  function openLeagueRuleChangeLogWindow() {
    const logLeague = selectedLeagueSaved || selectedLeague;
    const logEntries = logLeague?.leagueRuleChangeLog || [];
    const rows = logEntries.map((entry, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${escapeHtml(entry.createdAtDisplay || entry.createdAt || "")}</td>
        <td>${escapeHtml(entry.summary || "Rules updated")}</td>
        <td>${escapeHtml(`${entry.beforeSectionCount ?? ""} → ${entry.afterSectionCount ?? ""}`)}</td>
        <td>${escapeHtml(`${entry.beforeRuleCount ?? ""} → ${entry.afterRuleCount ?? ""}`)}</td>
        <td>${escapeHtml((entry.sectionTitles || []).join(", "))}</td>
      </tr>
    `).join("");

    const logHtml = `
      <!doctype html>
      <html>
        <head>
          <title>${escapeHtml(logLeague?.name || "League")} Rule Change Log</title>
          <style>
            body{font-family:Arial,sans-serif;color:#111827;padding:24px;background:#f8fafc}
            h1{margin-bottom:4px}
            .sub{color:#64748b;margin-bottom:20px}
            table{width:100%;border-collapse:collapse;background:white;font-size:13px}
            th,td{border:1px solid #cbd5e1;padding:8px;text-align:left;vertical-align:top}
            th{background:#f1f5f9;text-transform:uppercase;font-size:11px;color:#475569}
            .empty{border:1px solid #cbd5e1;background:white;border-radius:14px;padding:18px;color:#64748b}
          </style>
        </head>
        <body>
          <h1>${escapeHtml(logLeague?.name || "League")} Rule Change Log</h1>
          <div class="sub">Saved commissioner rule changes with timestamps.</div>
          ${logEntries.length > 0 ? `<table><thead><tr><th>#</th><th>Timestamp</th><th>Change Summary</th><th>Sections</th><th>Rules</th><th>Sections After Save</th></tr></thead><tbody>${rows}</tbody></table>` : `<div class="empty">No rule changes have been saved yet.</div>`}
        </body>
      </html>
    `;

    const logWindow = window.open("about:blank", "_blank");
    if (logWindow) {
      logWindow.document.open();
      logWindow.document.write(logHtml);
      logWindow.document.close();
      logWindow.focus?.();
      return;
    }

    const blob = new Blob([logHtml], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function discardLeagueDraftChanges() {
    setLeagueDraft(null);
    setLeagueDraftLeagueId("");
  }

  function ensurePlayerDrafts() {
    const drafts = playerDrafts || cloneLeagueRecord(allPlayerRecords) || [];
    if (!playerDrafts) setPlayerDrafts(drafts);
    return drafts;
  }

  function updatePlayerDraft(playerKey, field, value) {
    setPlayerDrafts((current) => {
      const base = current || cloneLeagueRecord(allPlayerRecords) || [];
      return base.map((player) => (player.key === playerKey ? { ...player, [field]: value } : player));
    });
  }

  function togglePlayerDraftLeague(playerKey, leagueId, isChecked) {
    setPlayerDrafts((current) => {
      const base = current || cloneLeagueRecord(allPlayerRecords) || [];
      return base.map((player) => {
        if (player.key !== playerKey) return player;
        const leagueIds = isChecked ? [...new Set([...(player.leagueIds || []), leagueId])] : (player.leagueIds || []).filter((id) => id !== leagueId);
        return { ...player, leagueIds };
      });
    });
  }

  function addGlobalPlayerDraft() {
    const player = { id: newId(), key: `new-${newId()}`, name: "", phone: "", bats: "R", pitches: "R", photoUrl: "", heightFeet: "", heightInches: "", leagueIds: selectedLeague?.id ? [selectedLeague.id] : [], sourceIds: {}, sourceNames: {} };
    setPlayerDrafts((current) => [...(current || cloneLeagueRecord(allPlayerRecords) || []), player]);
    setSelectedPlayerDraftKey(player.key);
  }

  function removeGlobalPlayerDraft(playerKey) {
    setPlayerDrafts((current) => (current || cloneLeagueRecord(allPlayerRecords) || []).filter((player) => player.key !== playerKey));
    if (selectedPlayerDraftKey === playerKey) setSelectedPlayerDraftKey("");
  }

  async function updateGlobalPlayerPhoto(playerKey, file) {
    if (!file) return;
    try {
      const photoUrl = await resizeImageFileToDataUrl(file, { maxSize: 360, quality: 0.72 });
      updatePlayerDraft(playerKey, "photoUrl", photoUrl);
    } catch (error) {
      window.alert(error?.message || "Could not save this player photo. Try a smaller image.");
    }
  }

  function savePlayerPageChanges() {
    const drafts = playerDrafts || [];
    const nextLeagues = syncGlobalPlayerDraftsToLeagues(leagues, drafts);
    const nextFreeAgentPlayers = syncGlobalPlayerDraftsToFreeAgents(drafts);
    setLeagues(nextLeagues);
    setFreeAgentPlayers(nextFreeAgentPlayers);
    setPlayerDrafts(cloneLeagueRecord(collectGlobalPlayers(nextLeagues, nextFreeAgentPlayers)));
    setSelectedPlayerDraftKey("");
  }

  function requestPlayerPageSave(nextAction = "stay") {
    if (!playerPageHasUnsavedChanges) return;
    setPendingPlayerSaveConfirm(nextAction);
  }

  function confirmPlayerPageSave() {
    const nextAction = pendingPlayerSaveConfirm;
    savePlayerPageChanges();
    setPendingPlayerSaveConfirm(null);
    if (nextAction === "exit") {
      const nextPage = pendingPlayerPageExit;
      setPlayerDrafts(null);
      setSelectedPlayerDraftKey("");
      setPendingPlayerPageExit(null);
      if (nextPage) setActivePage(nextPage);
    }
  }

  function discardPlayerPageChanges() {
    setPlayerDrafts(null);
    setSelectedPlayerDraftKey("");
  }

  function startInlinePlayerCreation(teamKey, index, isSub = false) {
    setInlinePlayerCreationContext({ teamKey, index, isSub });
    setInlinePlayerDraft({
      id: newId(),
      key: `inline-${newId()}`,
      name: "",
      phone: "",
      bats: "R",
      pitches: "R",
      photoUrl: "",
      heightFeet: "",
      heightInches: "",
      leagueIds: [],
    });
    setInlinePlayerCreationModalOpen(true);
  }

  function closeInlinePlayerCreationModal() {
    setInlinePlayerCreationContext(null);
    setInlinePlayerDraft(null);
    setInlinePlayerCreationModalOpen(false);
  }

  function saveInlinePlayerCreation() {
    if (!inlinePlayerDraft || !inlinePlayerCreationContext) return;

    const cleanName = String(inlinePlayerDraft.name || "").trim();
    if (!cleanName) {
      window.alert("Player name is required.");
      return;
    }

    // Check for duplicate names
    const existingPlayer = allPlayerRecords.find(player =>
      String(player.name || "").trim().toLowerCase() === cleanName.toLowerCase()
    );
    if (existingPlayer) {
      window.alert(`A player with the name "${cleanName}" already exists. Please choose a different name.`);
      return;
    }

    const newPlayer = { ...inlinePlayerDraft, name: cleanName };
    setFreeAgentPlayers((prev) => syncGlobalPlayerDraftsToFreeAgents([...prev, newPlayer]));

    const { teamKey, index, isSub } = inlinePlayerCreationContext;
    renameTeamPlayer(teamKey, index, cleanName);
    if (isSub) {
      setSubSlots((prev) => ({ ...prev, [teamKey]: { ...(prev[teamKey] || {}), [index]: true } }));
      setSubPlayers((prev) => ({ ...prev, [teamKey]: { ...(prev[teamKey] || {}), [cleanName]: true } }));
    }

    setInlinePlayerCreationContext(null);
    setInlinePlayerDraft(null);
    setInlinePlayerCreationModalOpen(false);
  }

  function saveInlinePlayer() {
    saveInlinePlayerCreation();
  }

  function updateInlinePlayerDraft(field, value) {
    if (!inlinePlayerDraft) return;
    setInlinePlayerDraft({ ...inlinePlayerDraft, [field]: value });
  }

  async function updateInlinePlayerPhoto(file) {
    if (!file || !inlinePlayerDraft) return;
    try {
      const photoUrl = await resizeImageFileToDataUrl(file, { maxSize: 360, quality: 0.72 });
      setInlinePlayerDraft({ ...inlinePlayerDraft, photoUrl });
    } catch (error) {
      window.alert(error?.message || "Could not save this player photo. Try a smaller image.");
    }
  }

  function completePendingPlayerPageExit(action) {
    const nextPage = pendingPlayerPageExit;
    if (action === "save") {
      requestPlayerPageSave("exit");
      return;
    }
    if (action === "discard") discardPlayerPageChanges();
    setPendingPlayerPageExit(null);
    if (nextPage) setActivePage(nextPage);
  }

  function confirmLeagueDraftExit() {
    return !leagueHasUnsavedChanges;
  }

  function goToPage(page) {
    if (activePage === "players" && page !== activePage && playerPageHasUnsavedChanges) {
      setPendingPlayerPageExit(page);
      return;
    }
    const isLeavingPlayerPage = activePage === "players" && page !== activePage;
    const isLeagueDraftPage = (pageToCheck) => pageToCheck === "league" || pageToCheck === "rules" || pageToCheck === "fields";
    const isLeavingLeagueDraftPages = isLeagueDraftPage(activePage) && !isLeagueDraftPage(page);
    if (isLeavingLeagueDraftPages && leagueHasUnsavedChanges) {
      setPendingLeagueExitPage(page);
      setPendingLeagueSwitchId("");
      return;
    }
    if (isLeavingPlayerPage) {
      setPlayerDrafts(null);
      setSelectedPlayerDraftKey("");
    }
    if (isLeavingLeagueDraftPages) {
      setLeagueDraft(null);
      setLeagueDraftLeagueId("");
    }
    setActivePage(page);
  }

  function handleSelectedLeagueChange(leagueId) {
    if ((activePage === "league" || activePage === "rules" || activePage === "fields") && leagueId !== selectedLeagueId && leagueHasUnsavedChanges) {
      setPendingLeagueSwitchId(leagueId);
      setPendingLeagueExitPage(null);
      return;
    }
    if ((activePage === "league" || activePage === "rules" || activePage === "fields") && leagueId !== selectedLeagueId) {
      setLeagueDraft(null);
      setLeagueDraftLeagueId("");
    }
    setSelectedLeagueId(leagueId);
  }

  function completePendingLeagueExit(shouldSave) {
    const nextPage = pendingLeagueExitPage;
    const nextLeagueId = pendingLeagueSwitchId;
    if (shouldSave) saveLeagueDraftChanges();
    else discardLeagueDraftChanges();
    if (shouldSave && (nextPage || nextLeagueId)) {
      setLeagueDraft(null);
      setLeagueDraftLeagueId("");
    }
    setPendingLeagueExitPage(null);
    setPendingLeagueSwitchId("");
    if (nextLeagueId) setSelectedLeagueId(nextLeagueId);
    if (nextPage) setActivePage(nextPage);
  }

  function createLeague() {
    if (leagueSettingsLocked) return;
    setPendingNewLeague(true);
  }

  function commitCreateLeague() {
    if (activePage === "league" && leagueHasUnsavedChanges) saveLeagueDraftChanges();
    const year = currentYearNumber();
    const league = {
      id: newId(),
      name: `League ${leagues.length + 1}`,
      logoUrl: "",
      years: [makeDefaultSeasonRecord(year, makeDefaultAwards())],
      enableCaptains: true,
      currentSeasonYear: year,
      awardDefaults: makeDefaultAwardDefaults(),
      defaultGameRules: makeDefaultGameRules(),
      fields: makeDefaultFields(),
      leagueRules: [],
      leagueRuleChangeLog: [],
      players: [],
      teamCount: 8,
      playersPerTeam: 4,
      divisionCount: 2,
      divisions: makeDivisionNames(2),
      teams: makeLeagueTeams(8, 4, [], makeDivisionNames(2), []),
    };
    setLeagues((prev) => [...prev, league]);
    setSelectedLeagueId(league.id);
    setSetupLeagueId(league.id);
    setLeagueDraft(cloneLeagueRecord(league));
    setLeagueDraftLeagueId(league.id);
    setPendingNewLeague(false);
    setActivePage("league");
  }

  function deleteSelectedLeague() {
    const leagueToDelete = selectedLeagueSaved || selectedLeague;
    if (!leagueToDelete?.id) return;
    setPendingLeagueDelete(cloneLeagueRecord(leagueToDelete));
  }

  function commitDeleteSelectedLeague() {
    const leagueToDelete = pendingLeagueDelete;
    if (!leagueToDelete?.id) return;

    const remainingLeagues = leagues.filter((league) => league.id !== leagueToDelete.id);
    const fallbackLeagues = remainingLeagues.length > 0 ? remainingLeagues : makeDefaultLeagues();
    const nextLeague = fallbackLeagues[0];

    setLeagues(fallbackLeagues);
    setPreviousGames((prev) => (prev || []).filter((savedGame) => savedGame?.savedSetup?.setupLeagueId !== leagueToDelete.id));
    setSelectedLeagueId(nextLeague.id);
    setSetupLeagueId((currentId) => (currentId === leagueToDelete.id ? nextLeague.id : currentId));
    setStatsLeagueId((currentId) => (currentId === leagueToDelete.id ? nextLeague.id : currentId));
    setLeadersLeagueId((currentId) => (currentId === leagueToDelete.id ? nextLeague.id : currentId));
    setFieldImportSourceLeagueId((currentId) => (currentId === leagueToDelete.id ? "" : currentId));
    setLeagueDraft(null);
    setLeagueDraftLeagueId("");
    setPendingLeagueExitPage(null);
    setPendingLeagueSwitchId("");
    setPendingLeagueDelete(null);
    setAwayLeagueTeamId("");
    setHomeLeagueTeamId("");
    setSelectedScheduledWeekId("");
    setSelectedScheduledGameId("");
    setUseLeagueSchedule(false);
    setActiveSavedGameId(null);
    setExpandedGameId(null);
    if (setupLeagueId === leagueToDelete.id) {
      setAwayTeam("Away Team");
      setHomeTeam("Home Team");
      setTeamPlayers(defaultPlayers);
      setBattingOrder(defaultPlayers);
      setPitchingOrder(defaultPlayers);
      setSubPlayers({ away: {}, home: {} });
      setSubSlots({ away: {}, home: {} });
      setExtraPitchers({ away: {}, home: {} });
      setSelectedFieldId("");
      setGameLocation("");
    }
  }

  function applyLeagueTeamToGameSlot(slot, leagueTeamId) {
    const league = setupLeague;
    const rawTeam = league?.teams?.find((item) => item.id === leagueTeamId);
    if (!rawTeam) return;
    const useSessionRoster = Boolean(setupCurrentSeason?.sessionsEnabled && !setupCurrentSeason?.keepRostersForSessions && gameSessionId);
    const team = getTeamRosterForSession(rawTeam, useSessionRoster ? gameSessionId : "", setupCurrentSeason?.keepTeamIdentityForSessions !== false);

    const roster = cleanRoster(team.players || []);
    if (slot === "away") {
      setAwayLeagueTeamId(leagueTeamId);
      setAwayTeam(team.name || "Away Team");
    } else {
      setHomeLeagueTeamId(leagueTeamId);
      setHomeTeam(team.name || "Home Team");
    }

    setTeamPlayers((prev) => ({ ...prev, [slot]: roster }));
    setBattingOrder((prev) => ({ ...prev, [slot]: cleanRoster(team.battingOrder || roster) }));
    setPitchingOrder((prev) => ({ ...prev, [slot]: cleanRoster(team.pitchingOrder || roster) }));
    setSubPlayers((prev) => ({ ...prev, [slot]: {} }));
    setSubSlots((prev) => ({ ...prev, [slot]: {} }));
    setExtraPitchers((prev) => ({ ...prev, [slot]: {} }));
  }

  function applyScheduledGameToSetup(scheduledGameId) {
    const scheduledGame = scheduledGamesForSetup.find((item) => item.id === scheduledGameId);
    setSelectedScheduledGameId(scheduledGameId);
    if (!scheduledGame) return;
    if (scheduledGame.date) setGameDate(scheduledGame.date);
    if (scheduledGame.time) setGameTime(scheduledGame.time);
    if (scheduledGame.sessionId) setGameSessionId(scheduledGame.sessionId);
    if (scheduledGame.fieldId) applyFieldToGame(scheduledGame.fieldId);
    if (scheduledGame.awayTeamId) applyLeagueTeamToGameSlot("away", scheduledGame.awayTeamId);
    if (scheduledGame.homeTeamId) applyLeagueTeamToGameSlot("home", scheduledGame.homeTeamId);
  }

  function handleSetupLeagueChange(leagueId) {
    if (leagueId === "custom") {
      setSetupLeagueId("custom");
      setLeagueGameMode("official");
      setAwayLeagueTeamId("");
      setHomeLeagueTeamId("");
      setSelectedScheduledWeekId("");
      setSelectedScheduledGameId("");
      setUseLeagueSchedule(false);
      setSelectedFieldId("");
      return;
    }

    const league = leagues.find((item) => item.id === leagueId);
    setSetupLeagueId(leagueId);
    setLeagueGameMode("official");
    setAwayLeagueTeamId("");
    setHomeLeagueTeamId("");
    setSelectedScheduledWeekId("");
    setSelectedScheduledGameId("");
    setUseLeagueSchedule(false);
    const mainField = getMainField(league?.fields || []);
    setSelectedFieldId(mainField?.id || "");
    if (mainField) setGameLocation(mainField.name);
    if (league?.currentSeasonYear) setGameSeasonYear(Number(league.currentSeasonYear));
    const currentSeason = (league?.years || []).map(normalizeSeasonRecord).find((season) => Number(season.year) === Number(league?.currentSeasonYear));
    setGameSessionId(currentSeason?.currentSessionId || currentSeason?.sessions?.[0]?.id || "");
    if (useLeagueDefaultRules && league?.defaultGameRules) {
      const defaults = league.defaultGameRules;
      setGameInnings(Math.max(1, Number(defaults.gameInnings) || 4));
      setPowerPlaysEnabled(defaults.powerPlaysEnabled ?? true);
      setPowerPlayLimitType(defaults.powerPlayLimitType || "per_inning");
      setPowerPlayLimitAmount(defaults.powerPlayLimitAmount ?? 1);
      setWhammysEnabled(defaults.whammysEnabled ?? true);
      setPudwhackerEnabled(defaults.pudwhackerEnabled ?? false);
      setRunRuleEnabled(defaults.runRuleEnabled ?? false);
      setRunRuleRuns(defaults.runRuleRuns ?? 8);
      setRunRuleBeforeFourthOnly(defaults.runRuleBeforeFourthOnly ?? false);
      setWalkRunRuleCountsAsHr(defaults.walkRunRuleCountsAsHr ?? true);
      setExtraRunnerRules(defaults.extraRunnerRules || []);
      setGhostRunnersCountAsRbi(defaults.ghostRunnersCountAsRbi ?? true);
    }
    if (league) {
      setSelectedLeagueId(leagueId);
    }
  }

  function updateSelectedLeague(updater) {
    if (leagueSettingsLocked) return;
    const leagueId = selectedLeague?.id || leagues[0]?.id;
    if (!leagueId) return;
    if (activePage === "league" || activePage === "rules" || activePage === "fields") {
      setLeagueDraft((currentDraft) => {
        const baseDraft = currentDraft && leagueDraftLeagueId === leagueId ? currentDraft : cloneLeagueRecord(leagues.find((league) => league.id === leagueId) || selectedLeagueSaved);
        return cloneLeagueRecord(updater(baseDraft));
      });
      setLeagueDraftLeagueId(leagueId);
      return;
    }
    setLeagues((prev) => prev.map((league) => (league.id === leagueId ? updater(league) : league)));
  }

  function updateLeagueName(name) {
    updateSelectedLeague((league) => ({ ...league, name }));
  }

  function updateLeagueCurrentSeasonYear(year) {
    const safeYear = Number(year) || currentYearNumber();
    updateSelectedLeague((league) => {
      const hasYear = (league.years || []).some((yearEntry) => Number(yearEntry.year) === safeYear);
      return {
        ...league,
        currentSeasonYear: safeYear,
        years: hasYear ? league.years : [makeDefaultSeasonRecord(safeYear, league.awardDefaults || makeDefaultAwards()), ...(league.years || [])],
      };
    });
  }

  function updateLeagueDefaultGameRule(field, value) {
    updateSelectedLeague((league) => ({
      ...league,
      defaultGameRules: {
        ...makeDefaultGameRules(),
        ...(league.defaultGameRules || {}),
        [field]: value,
      },
    }));
  }

  function addLeagueRuleSection() {
    if (selectedLeagueRealDraftInProgress) return;
    updateSelectedLeague((league) => {
      const sections = normalizeLeagueRuleSections(league.leagueRules || []);
      return {
        ...league,
        leagueRules: [
          ...sections,
          makeDefaultLeagueRuleSection(sections.length, `Section ${sections.length + 1}`),
        ],
      };
    });
  }

  function updateLeagueRuleSection(sectionId, field, value) {
    if (selectedLeagueRealDraftInProgress) return;
    updateSelectedLeague((league) => ({
      ...league,
      leagueRules: normalizeLeagueRuleSections(league.leagueRules || []).map((section) => (section.id === sectionId ? { ...section, [field]: value } : section)),
    }));
  }

  function removeLeagueRuleSection(sectionId) {
    if (selectedLeagueRealDraftInProgress) return;
    updateSelectedLeague((league) => ({
      ...league,
      leagueRules: normalizeLeagueRuleSections(league.leagueRules || []).filter((section) => section.id !== sectionId),
    }));
  }

  function addLeagueRuleItem(sectionId) {
    if (selectedLeagueRealDraftInProgress) return;
    updateSelectedLeague((league) => ({
      ...league,
      leagueRules: normalizeLeagueRuleSections(league.leagueRules || []).map((section) => (
        section.id === sectionId
          ? { ...section, rules: [...(section.rules || []), makeDefaultLeagueRuleItem(section.title || "League")] }
          : section
      )),
    }));
  }

  function updateLeagueRuleItem(sectionId, ruleId, field, value) {
    if (selectedLeagueRealDraftInProgress) return;
    updateSelectedLeague((league) => ({
      ...league,
      leagueRules: normalizeLeagueRuleSections(league.leagueRules || []).map((section) => (
        section.id === sectionId
          ? { ...section, rules: (section.rules || []).map((rule) => (rule.id === ruleId ? { ...rule, [field]: value } : rule)) }
          : section
      )),
    }));
  }

  function removeLeagueRuleItem(sectionId, ruleId) {
    if (selectedLeagueRealDraftInProgress) return;
    updateSelectedLeague((league) => ({
      ...league,
      leagueRules: normalizeLeagueRuleSections(league.leagueRules || []).map((section) => (
        section.id === sectionId
          ? { ...section, rules: (section.rules || []).filter((rule) => rule.id !== ruleId) }
          : section
      )),
    }));
  }

  function moveLeagueRuleSection(sectionId, direction) {
    if (selectedLeagueRealDraftInProgress) return;
    updateSelectedLeague((league) => {
      const sections = normalizeLeagueRuleSections(league.leagueRules || []);
      const index = sections.findIndex((section) => section.id === sectionId);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= sections.length) return { ...league, leagueRules: sections };
      const nextSections = [...sections];
      const [moved] = nextSections.splice(index, 1);
      nextSections.splice(nextIndex, 0, moved);
      return { ...league, leagueRules: nextSections };
    });
  }

  function applyLeagueDefaultRules() {
    const defaults = leagueDefaultRules;
    setGameInnings(Math.max(1, Number(defaults.gameInnings) || 4));
    setPowerPlaysEnabled(defaults.powerPlaysEnabled ?? true);
    setPowerPlayLimitType(defaults.powerPlayLimitType || "per_inning");
    setPowerPlayLimitAmount(defaults.powerPlayLimitAmount ?? 1);
    setWhammysEnabled(defaults.whammysEnabled ?? true);
    setPudwhackerEnabled(defaults.pudwhackerEnabled ?? false);
    setRunRuleEnabled(defaults.runRuleEnabled ?? false);
    setRunRuleRuns(defaults.runRuleRuns ?? 8);
    setRunRuleBeforeFourthOnly(defaults.runRuleBeforeFourthOnly ?? false);
    setWalkRunRuleCountsAsHr(defaults.walkRunRuleCountsAsHr ?? true);
    setExtraRunnerRules(defaults.extraRunnerRules || []);
    setGhostRunnersCountAsRbi(defaults.ghostRunnersCountAsRbi ?? true);
  }

  function handleUseLeagueDefaultRules(isEnabled) {
    setUseLeagueDefaultRules(isEnabled);
    if (isEnabled && !isCustomGame) applyLeagueDefaultRules();
  }

  function addLeagueDefaultExtraRunnerRule() {
    const existingRules = selectedLeagueDefaultRules.extraRunnerRules || [];
    const firstExtraInning = getFirstExtraInning(selectedLeagueDefaultRules.gameInnings || 4);
    const nextStartInning = existingRules.length === 0
      ? firstExtraInning
      : Math.max(firstExtraInning, Math.max(...existingRules.map((rule) => Number(rule.startInning) || firstExtraInning)) + 1);
    updateLeagueDefaultGameRule("extraRunnerRules", [
      ...existingRules,
      { id: newId(), startInning: nextStartInning, bases: "second", sameRestOfGame: false },
    ]);
  }

  function updateLeagueDefaultExtraRunnerRule(ruleId, field, value) {
    const nextRules = (selectedLeagueDefaultRules.extraRunnerRules || [])
      .map((rule) => {
        if (rule.id !== ruleId) return rule;
        if (field === "startInning") {
          const firstExtraInning = getFirstExtraInning(selectedLeagueDefaultRules.gameInnings || 4);
          return { ...rule, startInning: Math.max(firstExtraInning, Number(value) || firstExtraInning) };
        }
        return { ...rule, [field]: value };
      })
      .sort((a, b) => Number(a.startInning) - Number(b.startInning));
    updateLeagueDefaultGameRule("extraRunnerRules", nextRules);
  }

  function removeLeagueDefaultExtraRunnerRule(ruleId) {
    updateLeagueDefaultGameRule(
      "extraRunnerRules",
      (selectedLeagueDefaultRules.extraRunnerRules || []).filter((rule) => rule.id !== ruleId),
    );
  }

  function updateLeagueTeamCount(count) {
    updateSelectedLeague((league) => {
      const teamCount = Math.max(1, Number(count) || 1);
      const divisions = makeDivisionNames(league.divisionCount || 0, league.divisions || []);
      const nextPlayers = league.players || [];
      return { ...league, teamCount, players: nextPlayers, teams: makeLeagueTeams(teamCount, league.playersPerTeam, league.teams, divisions, nextPlayers) };
    });
  }

  function updateLeaguePlayersPerTeam(count) {
    updateSelectedLeague((league) => {
      const playersPerTeam = Math.max(1, Number(count) || 1);
      const divisions = makeDivisionNames(league.divisionCount || 0, league.divisions || []);
      const nextPlayers = league.players || [];
      return { ...league, playersPerTeam, players: nextPlayers, teams: makeLeagueTeams(league.teamCount, playersPerTeam, league.teams, divisions, nextPlayers) };
    });
  }

  function updateLeagueDivisionsEnabled(isEnabled) {
    updateSelectedLeague((league) => {
      const divisionCount = isEnabled ? Math.max(2, Number(league.divisionCount) || 2) : 0;
      const divisions = makeDivisionNames(divisionCount, league.divisions || []);
      return {
        ...league,
        divisionCount,
        divisions,
        teams: makeLeagueTeams(league.teamCount, league.playersPerTeam, league.teams, divisions, league.players || []),
      };
    });
  }

  function updateLeagueDivisionCount(count) {
    updateSelectedLeague((league) => {
      const divisionCount = Math.max(2, Number(count) || 2);
      const divisions = makeDivisionNames(divisionCount, league.divisions || []);
      return {
        ...league,
        divisionCount,
        divisions,
        teams: makeLeagueTeams(league.teamCount, league.playersPerTeam, league.teams, divisions, league.players || []),
      };
    });
  }

  function updateLeagueDivisionName(index, name) {
    updateSelectedLeague((league) => {
      const oldDivision = league.divisions?.[index] || `Division ${index + 1}`;
      const divisions = makeDivisionNames(league.divisionCount || 0, league.divisions || []);
      divisions[index] = name || `Division ${index + 1}`;
      const teams = league.teams.map((team) => ({ ...team, division: team.division === oldDivision ? divisions[index] : team.division }));
      return { ...league, divisions, teams };
    });
  }

  function updateLeagueTeamName(teamIndex, name) {
    updateSelectedLeague((league) => {
      const useSessionIdentity = activeLeagueTeamsSessionId && selectedCurrentSeason?.keepTeamIdentityForSessions === false;
      const teams = league.teams.map((team, index) => {
        if (index !== teamIndex) return team;
        if (useSessionIdentity) {
          return {
            ...team,
            sessionRosters: {
              ...(team.sessionRosters || {}),
              [activeLeagueTeamsSessionId]: { ...(team.sessionRosters?.[activeLeagueTeamsSessionId] || {}), name },
            },
          };
        }
        return { ...team, name };
      });
      return { ...league, teams };
    });
  }

  function updateLeagueTeamDivision(teamIndex, division) {
    updateSelectedLeague((league) => {
      const teams = league.teams.map((team, index) => (index === teamIndex ? { ...team, division } : team));
      return { ...league, teams };
    });
  }

  function updateLeagueTeamCaptain(teamIndex, captain) {
    updateSelectedLeague((league) => {
      if (league.enableCaptains === false) return league;
      const cleanCaptain = String(captain || "").trim();
      const assignments = getLeaguePlayerAssignments(league, activeLeagueTeamsSessionId);
      if (cleanCaptain && (assignments[cleanCaptain] || []).some((assignment) => assignment.teamIndex !== teamIndex)) return league;
      const teams = league.teams.map((team, index) => {
        if (index !== teamIndex) return team;
        const nextTeam = { ...team, captain: cleanCaptain };
        const nextSessionRosters = { ...(nextTeam.sessionRosters || {}) };
        Object.keys(nextSessionRosters).forEach((sessionId) => {
          const roster = nextSessionRosters[sessionId] || {};
          const fixedRoster = ensureCaptainOnRoster(roster.players || nextTeam.players || [], roster.battingOrder || nextTeam.battingOrder || [], roster.pitchingOrder || nextTeam.pitchingOrder || [], cleanCaptain);
          nextSessionRosters[sessionId] = { ...roster, ...fixedRoster };
        });
        const fixedBaseRoster = ensureCaptainOnRoster(nextTeam.players || [], nextTeam.battingOrder || [], nextTeam.pitchingOrder || [], cleanCaptain);
        return { ...nextTeam, ...fixedBaseRoster, sessionRosters: nextSessionRosters };
      });
      return { ...league, teams };
    });
  }

  function updateLeagueDraftEnabledForSession(yearId, sessionId, isEnabled) {
    updateSelectedLeague((league) => ({
      ...league,
      years: (league.years || []).map((year) => {
        if (year.id !== yearId) return year;
        return setLeagueDraftEnabledForSessionRecord(year, sessionId, isEnabled, league);
      }),
    }));
  }

  function updateLeagueTeamCaptainValue(teamIndex, value) {
    if (!leagueDraftEnabledForActiveSession) return;
    const safeValue = normalizeCaptainValueInput(value, true);
    updateSelectedLeague((league) => {
      const targetTeamId = league.teams?.[teamIndex]?.id || "";
      const teams = (league.teams || []).map((team, index) => (
        index === teamIndex ? { ...team, captainValue: safeValue } : team
      ));

      const years = (league.years || []).map((year) => {
        const normalized = normalizeSeasonRecord(year);
        const drafts = { ...(normalized.drafts || {}) };

        Object.keys(drafts).forEach((sessionId) => {
          const normalizedDraft = normalizeDraftSettings(drafts[sessionId], { ...league, teams }, sessionId);
          if (!targetTeamId || hasDraftStarted(normalizedDraft)) {
            drafts[sessionId] = normalizedDraft;
            return;
          }
          drafts[sessionId] = {
            ...normalizedDraft,
            captainValues: {
              ...(normalizedDraft.captainValues || {}),
              [targetTeamId]: safeValue,
            },
          };
        });

        return { ...normalized, drafts };
      });

      return { ...league, teams, years };
    });
  }

  function updateLeagueCaptainsEnabled(isEnabled) {
    updateSelectedLeague((league) => ({
      ...league,
      enableCaptains: isEnabled,
      teams: isEnabled ? league.teams : (league.teams || []).map((team) => ({ ...team, captain: "" })),
    }));
  }

  async function updateLeagueLogo(file) {
    if (!file) return;
    try {
      const logoUrl = await resizeImageFileToDataUrl(file, { maxSize: 420, quality: 0.75 });
      updateSelectedLeague((league) => ({ ...league, logoUrl }));
    } catch (error) {
      window.alert(error?.message || "Could not save this league logo. Try a smaller image.");
    }
  }

  function clearLeagueLogo() {
    updateSelectedLeague((league) => ({ ...league, logoUrl: "" }));
  }

  async function updateLeagueTeamLogo(teamIndex, file) {
    if (!file) return;
    try {
      const logoUrl = await resizeImageFileToDataUrl(file, { maxSize: 360, quality: 0.72 });
      updateSelectedLeague((league) => {
        const useSessionIdentity = activeLeagueTeamsSessionId && selectedCurrentSeason?.keepTeamIdentityForSessions === false;
        const teams = league.teams.map((team, index) => {
          if (index !== teamIndex) return team;
          if (useSessionIdentity) {
            return {
              ...team,
              sessionRosters: {
                ...(team.sessionRosters || {}),
                [activeLeagueTeamsSessionId]: { ...(team.sessionRosters?.[activeLeagueTeamsSessionId] || {}), logoUrl },
              },
            };
          }
          return { ...team, logoUrl };
        });
        return { ...league, teams };
      });
    } catch (error) {
      window.alert(error?.message || "Could not save this team logo. Try a smaller image.");
    }
  }

  function addLeaguePlayerRecord() {
    updateSelectedLeague((league) => ({
      ...league,
      players: [...(league.players || []), { id: newId(), name: "", phone: "", bats: "R", pitches: "R" }],
    }));
  }

  async function updateLeaguePlayerPhoto(playerId, file) {
    if (!file) return;
    try {
      const photoUrl = await resizeImageFileToDataUrl(file, { maxSize: 360, quality: 0.72 });
      updateLeaguePlayerRecord(playerId, "photoUrl", photoUrl);
    } catch (error) {
      window.alert(error?.message || "Could not save this player photo. Try a smaller image.");
    }
  }

  function updateLeaguePlayerRecord(playerId, field, value) {
    updateSelectedLeague((league) => {
      const oldPlayer = (league.players || []).find((player) => player.id === playerId);
      const oldName = oldPlayer?.name || "";
      const players = (league.players || []).map((player) => (player.id === playerId ? { ...normalizeLeaguePlayer(player), [field]: value } : normalizeLeaguePlayer(player)));
      if (field !== "name") return { ...league, players };
      const newName = String(value || "").trim();
      const teams = (league.teams || []).map((team) => {
        const replaceName = (name) => (oldName && name === oldName ? newName : name);
        const cleanSessionRosters = Object.fromEntries(
          Object.entries(team.sessionRosters || {}).map(([sessionId, roster]) => [
            sessionId,
            {
              ...roster,
              captain: replaceName(roster?.captain || ""),
              players: (roster?.players || []).map(replaceName),
              battingOrder: (roster?.battingOrder || []).map(replaceName),
              pitchingOrder: (roster?.pitchingOrder || []).map(replaceName),
            },
          ]),
        );
        return {
          ...team,
          captain: replaceName(team.captain || ""),
          players: (team.players || []).map(replaceName),
          battingOrder: (team.battingOrder || []).map(replaceName),
          pitchingOrder: (team.pitchingOrder || []).map(replaceName),
          sessionRosters: cleanSessionRosters,
        };
      });
      return { ...league, players, teams };
    });
  }

  function removeLeaguePlayerRecord(playerId) {
    updateSelectedLeague((league) => {
      const removedPlayer = (league.players || []).find((player) => player.id === playerId);
      const removedName = removedPlayer?.name || "";
      return {
        ...league,
        players: (league.players || []).filter((player) => player.id !== playerId),
        teams: (league.teams || []).map((team) => {
          const cleanPlayers = (players = []) => (players || []).map((player) => (player === removedName ? "" : player));
          const cleanOrder = (players = []) => cleanRoster((players || []).filter((player) => player !== removedName));
          const sessionRosters = Object.fromEntries(
            Object.entries(team.sessionRosters || {}).map(([sessionId, roster]) => [
              sessionId,
              {
                ...roster,
                captain: roster?.captain === removedName ? "" : roster?.captain || "",
                players: cleanPlayers(roster?.players || []),
                battingOrder: cleanOrder(roster?.battingOrder || []),
                pitchingOrder: cleanOrder(roster?.pitchingOrder || []),
              },
            ]),
          );
          return {
            ...team,
            captain: team.captain === removedName ? "" : team.captain || "",
            players: cleanPlayers(team.players || []),
            battingOrder: cleanOrder(team.battingOrder || []),
            pitchingOrder: cleanOrder(team.pitchingOrder || []),
            sessionRosters,
          };
        }),
      };
    });
  }

  function updateLeaguePlayer(teamIndex, playerIndex, playerName) {
    updateSelectedLeague((league) => {
      const cleanPlayerName = String(playerName || "").trim();
      const team = league.teams?.[teamIndex];
      const draftEnabled = isLeagueDraftEnabledForSession(selectedCurrentSeason, activeDraftSessionId);
      if (draftEnabled && cleanPlayerName && cleanPlayerName !== String(team?.captain || "").trim()) {
        setBlockedRosterAssignment({ player: cleanPlayerName, teamName: team?.name || `Team ${teamIndex + 1}` });
        return league;
      }
      const assignments = getLeaguePlayerAssignments(league, activeLeagueTeamsSessionId);
      if (cleanPlayerName && isPlayerAssignedSomewhereElse(assignments, cleanPlayerName, teamIndex, playerIndex)) {
        return league;
      }

      const teams = league.teams.map((team, index) => {
        if (index !== teamIndex) return team;
        const baseView = getTeamRosterForSession(team, activeLeagueTeamsSessionId, keepTeamIdentityForSessions);
        const players = [...(baseView.players || [])];
        const oldName = players[playerIndex];
        players[playerIndex] = playerName;
        const cleanPlayers = cleanRoster(players);
        const battingOrder = cleanRoster((baseView.battingOrder || baseView.players || []).map((player) => (player === oldName ? playerName : player))).filter((player) => cleanPlayers.includes(player));
        const pitchingOrder = cleanRoster((baseView.pitchingOrder || baseView.players || []).map((player) => (player === oldName ? playerName : player))).filter((player) => cleanPlayers.includes(player));
        cleanPlayers.forEach((player) => {
          if (!battingOrder.includes(player)) battingOrder.push(player);
          if (!pitchingOrder.includes(player)) pitchingOrder.push(player);
        });

        if (activeLeagueTeamsSessionId) {
          return {
            ...team,
            sessionRosters: {
              ...(team.sessionRosters || {}),
              [activeLeagueTeamsSessionId]: { ...(team.sessionRosters?.[activeLeagueTeamsSessionId] || {}), players, battingOrder, pitchingOrder },
            },
          };
        }
        return { ...team, players, battingOrder, pitchingOrder };
      });
      return { ...league, teams };
    });
  }

  function moveLeagueTeamOrder(teamIndex, orderKey, index, direction) {
    updateSelectedLeague((league) => {
      const teams = league.teams.map((team, currentIndex) => {
        if (currentIndex !== teamIndex) return team;
        const baseView = getTeamRosterForSession(team, activeLeagueTeamsSessionId, keepTeamIdentityForSessions);
        const list = cleanRoster(baseView[orderKey] || baseView.players || []);
        const newIndex = index + direction;
        if (newIndex < 0 || newIndex >= list.length) return team;
        const [movedItem] = list.splice(index, 1);
        list.splice(newIndex, 0, movedItem);
        if (activeLeagueTeamsSessionId) {
          return {
            ...team,
            sessionRosters: {
              ...(team.sessionRosters || {}),
              [activeLeagueTeamsSessionId]: {
                ...(team.sessionRosters?.[activeLeagueTeamsSessionId] || {}),
                players: baseView.players || [],
                battingOrder: orderKey === "battingOrder" ? list : baseView.battingOrder || baseView.players || [],
                pitchingOrder: orderKey === "pitchingOrder" ? list : baseView.pitchingOrder || baseView.players || [],
              },
            },
          };
        }
        return { ...team, [orderKey]: list };
      });
      return { ...league, teams };
    });
  }

  function addLeagueYear() {
    updateSelectedLeague((league) => {
      const nextYear = getNextLeagueSeasonYear(league.years || []);
      return {
        ...league,
        years: [makeDefaultSeasonRecord(nextYear, league.awardDefaults || makeDefaultAwards()), ...(league.years || [])],
        currentSeasonYear: nextYear,
      };
    });
  }

  function openYearPicker(yearId, currentYear, title = "Select Year") {
    const baseYear = Number(currentYear) || currentYearNumber();
    const options = Array.from({ length: 31 }, (_, index) => baseYear - 15 + index);
    setYearPicker({ yearId, value: baseYear, title, options });
  }

  function approveYearPicker() {
    if (!yearPicker) return;
    updateLeagueYear(yearPicker.yearId, "year", yearPicker.value);
    setYearPicker(null);
  }

  function updateLeagueYear(yearId, field, value) {
    updateSelectedLeague((league) => ({
      ...league,
      years: (league.years || []).map((year) => {
        if (year.id !== yearId) return year;
        const normalized = normalizeSeasonRecord(year);
        let nextValue = value;
        if (field === "year") {
          nextValue = Number(value) || currentYearNumber();
          if (isDuplicateLeagueSeasonYear(league.years || [], nextValue, yearId)) return normalized;
        }
        if (field === "sessionCount") nextValue = normalized.sessionsEnabled ? Math.max(2, Number(value) || 2) : Math.max(1, Number(value) || 1);
        if (field === "sessionsEnabled" && value) nextValue = true;
        return normalizeSeasonRecord({ ...normalized, [field]: nextValue });
      }),
    }));
  }

  function updateLeagueSeasonSession(yearId, sessionId, field, value) {
    updateSelectedLeague((league) => ({
      ...league,
      years: (league.years || []).map((year) => {
        if (year.id !== yearId) return year;
        const normalized = normalizeSeasonRecord(year);
        const sessions = normalized.sessions.map((session) => (
          session.id === sessionId ? { ...session, [field]: value } : session
        ));
        return { ...normalized, sessions };
      }),
    }));
  }

  function addSeasonAward(yearId) {
    updateSelectedLeague((league) => ({
      ...league,
      years: (league.years || []).map((year) => {
        if (year.id !== yearId) return year;
        const normalized = normalizeSeasonRecord(year);
        return {
          ...normalized,
          awards: [
            ...normalized.awards,
            { id: newId(), category: "New Award", winner: "", legacyPoints: 1 },
          ],
        };
      }),
    }));
  }

  function updateSeasonAward(yearId, awardId, field, value) {
    updateSelectedLeague((league) => ({
      ...league,
      years: (league.years || []).map((year) => {
        if (year.id !== yearId) return year;
        const normalized = normalizeSeasonRecord(year);
        const awards = normalized.awards.map((award) => {
          if (award.id !== awardId) return award;
          const nextValue = field === "legacyPoints"
            ? Math.max(1, Math.min(3, Number(value) || 1))
            : value;
          return { ...award, [field]: nextValue };
        });
        return { ...normalized, awards };
      }),
    }));
  }

  function removeSeasonAward(yearId, awardId) {
    updateSelectedLeague((league) => ({
      ...league,
      years: (league.years || []).map((year) => {
        if (year.id !== yearId) return year;
        const normalized = normalizeSeasonRecord(year);
        return {
          ...normalized,
          awards: normalized.awards.filter((award) => award.id !== awardId),
        };
      }),
    }));
  }

  function saveSeasonAwardsAsDefaults(yearId) {
    updateSelectedLeague((league) => {
      const season = (league.years || []).map(normalizeSeasonRecord).find((year) => year.id === yearId);
      if (!season) return league;
      const awardDefaults = (season.awards || []).map((award) => ({ id: newId(), category: award.category || "New Award", legacyPoints: Math.max(1, Math.min(3, Number(award.legacyPoints) || 1)) }));
      return { ...league, awardDefaults };
    });
  }

  function updateLeagueCurrentSession(yearId, sessionId) {
    updateSelectedLeague((league) => ({
      ...league,
      years: (league.years || []).map((year) => (year.id === yearId ? { ...normalizeSeasonRecord(year), currentSessionId: sessionId } : year)),
    }));
  }

  function writeDraftState(sessionId, updater) {
    const safeSessionId = sessionId || activeDraftSessionId || selectedCurrentSeason?.sessions?.[0]?.id || "default-session";
    if (!safeSessionId) return;

    if (mockDraftMode) {
      setMockDrafts((prev) => {
        const currentDraft = normalizeDraftSettings(prev[activeDraftKey] || officialDraftSettings, selectedLeague, safeSessionId);
        const nextDraft = typeof updater === "function" ? updater(currentDraft, selectedLeague) : { ...currentDraft, ...updater };
        return { ...prev, [activeDraftKey]: normalizeDraftSettings(nextDraft, selectedLeague, safeSessionId) };
      });
      return;
    }

    const targetLeagueId = selectedLeague?.id;
    const targetSeasonId = selectedCurrentSeason?.id;
    if (!targetLeagueId || !targetSeasonId) return;

    setLeagues((prevLeagues) => prevLeagues.map((league) => {
      if (league.id !== targetLeagueId) return league;
      const nextYears = (league.years || []).map((year) => {
        const normalized = normalizeSeasonRecord(year);
        if (normalized.id !== targetSeasonId) return year;
        const currentDraft = normalizeDraftSettings(normalized.drafts?.[safeSessionId], league, safeSessionId);
        const nextDraft = typeof updater === "function" ? updater(currentDraft, league) : { ...currentDraft, ...updater };
        return { ...normalized, drafts: { ...(normalized.drafts || {}), [safeSessionId]: normalizeDraftSettings(nextDraft, league, safeSessionId) } };
      });
      return { ...league, years: nextYears };
    }));
  }

  function updateDraftSettings(sessionId, updater) {
    writeDraftState(sessionId, updater);
  }

  function updateDraftDataDirect(sessionId, updater) {
    writeDraftState(sessionId, updater);
  }

  function updateLeagueDirectlyForDraft(updater) {
    const targetLeagueId = selectedLeague?.id;
    if (!targetLeagueId) return;
    setLeagues((prevLeagues) => prevLeagues.map((league) => (league.id === targetLeagueId ? updater(league) : league)));
  }

  function seedDraftCaptains(sessionId = activeDraftSessionId) {
    updateSelectedLeague((league) => ({
      ...league,
      teams: (league.teams || []).map((team) => {
        const captain = String(team.captain || "").trim();
        if (!captain) return team;
        if (selectedCurrentSeason.sessionsEnabled) {
          const existingRoster = team.sessionRosters?.[sessionId] || {};
          const fixedRoster = ensureCaptainOnRoster(existingRoster.players || team.players || [], existingRoster.battingOrder || team.battingOrder || [], existingRoster.pitchingOrder || team.pitchingOrder || [], captain);
          return { ...team, sessionRosters: { ...(team.sessionRosters || {}), [sessionId]: { ...existingRoster, ...fixedRoster } } };
        }
        const fixedRoster = ensureCaptainOnRoster(team.players || [], team.battingOrder || [], team.pitchingOrder || [], captain);
        return { ...team, ...fixedRoster };
      }),
    }));
  }

  function moveDraftOrder(index, direction) {
    if (draftStarted) return;
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= activeDraftSettings.draftOrder.length) return;
    updateDraftSettings(activeDraftSessionId, (draft) => {
      const draftOrder = [...draft.draftOrder];
      const [moved] = draftOrder.splice(index, 1);
      draftOrder.splice(newIndex, 0, moved);
      return { ...draft, draftOrder };
    });
  }

  function updateDraftCap(value) {
    updateDraftSettings(activeDraftSessionId, { cap: Math.max(1, Number(value) || 1) });
  }

  function updateDraftTimerSeconds(value) {
    const seconds = Math.max(5, Number(value) || 60);
    updateDraftSettings(activeDraftSessionId, { timerSeconds: seconds });
    setDraftTimerRemaining(seconds);
  }

  function updateDraftMaxCarryover(value) {
    updateDraftSettings(activeDraftSessionId, { maxCarryover: Math.max(0, Number(value) || 0) });
  }

  function updateDraftCaptainValue(teamId, value) {
    if (draftStarted) return;
    const safeValue = normalizeCaptainValueInput(value, true);
    updateDraftSettings(activeDraftSessionId, (draft) => ({
      ...draft,
      captainValues: { ...(draft.captainValues || {}), [teamId]: safeValue },
    }));
    if (mockDraftMode) return;
    updateSelectedLeague((league) => ({
      ...league,
      teams: (league.teams || []).map((team) => (team.id === teamId ? { ...team, captainValue: safeValue } : team)),
    }));
  }

  function cancelDraftBid() {
    updateDraftSettings(activeDraftSessionId, (draft) => ({ ...draft, currentBid: null }));
    setDraftSelectedPlayer("");
    setDraftBidTeamId("");
    setDraftBidAmount("1");
    setDraftAwardError("");
    setDraftTimerRunning(false);
    setDraftTimerRemaining(activeDraftSettings.timerSeconds || 60);
  }

  function validateDraftBid(teamId, amount) {
    const safeAmount = Math.max(1, Number(amount) || 1);
    if (!draftSelectedPlayer || !teamId) return "Select a player and team before placing a bid.";
    if (!currentWinningBid && draftNominatingTeamId && teamId !== draftNominatingTeamId) return `${draftNominatingTeam?.name || "The team whose turn it is"} must make the first bid on this player.`;
    const minimumBidError = getDraftMinimumBidError(selectedLeague, activeDraftSettings, teamId, safeAmount);
    if (minimumBidError) return minimumBidError;
    const maximumBidError = getDraftMaximumBidError(selectedLeague, activeDraftSettings, teamId, safeAmount);
    if (maximumBidError) return maximumBidError;
    const rosterFullError = getDraftRosterFullError(selectedLeague, activeDraftSettings, teamId);
    if (rosterFullError) return rosterFullError;
    if (getTeamDraftSpend(activeDraftSettings, teamId) + safeAmount > Number(activeDraftSettings.cap || 0)) return "This bid would exceed the selected team cap.";
    const carryoverError = getDraftCarryoverError(selectedLeague, activeDraftSettings, teamId, safeAmount);
    if (carryoverError) return carryoverError;
    if (currentWinningBid && safeAmount <= Number(currentWinningBid.amount || 0)) return `Bid must be higher than the current winning bid of $${currentWinningBid.amount}.`;
    return "";
  }

  function placeDraftBid() {
    const selectedTeamId = String(draftBidTeamId || "").trim();
    const safeAmount = Math.max(1, Number(draftBidAmount) || 1);
    if (!draftSelectedPlayer || !selectedTeamId) {
      setDraftAwardError("Select a player and the team placing the bid before placing a bid.");
      return;
    }
    if (!draftEligibleTeams.some((team) => team.id === selectedTeamId)) {
      setDraftAwardError("Select a valid eligible team before placing a bid.");
      return;
    }
    const validationError = validateDraftBid(selectedTeamId, safeAmount);
    if (validationError) {
      setDraftAwardError(validationError);
      return;
    }
    const bid = {
      id: newId(),
      player: draftSelectedPlayer,
      teamId: selectedTeamId,
      amount: safeAmount,
      createdAt: new Date().toLocaleTimeString(),
    };
    updateDraftDataDirect(activeDraftSessionId, (draft) => ({
      ...draft,
      enabled: true,
      started: true,
      completed: false,
      currentBid: bid,
      bidHistory: [...(draft.bidHistory || []), bid],
    }));
    setDraftAwardError("");
    setDraftBidAmount(String(safeAmount + 1));
  }

  function commitStartDraft() {
    updateDraftDataDirect(activeDraftSessionId, (draft) => ({ ...draft, enabled: true, started: true, completed: false }));
    setDraftStartedOverrides((prev) => ({ ...prev, [activeDraftKey]: true }));
    setPendingRealDraftStart(false);
    setDraftSelectedPlayer("");
    setDraftBidTeamId("");
    setDraftBidAmount("1");
    setDraftAwardError("");
  }

  function startDraft() {
    if (!mockDraftMode && !leagueDraftEnabledForActiveSession) {
      setDraftAwardError("Enable draft for this session in League settings before starting the real draft.");
      return;
    }
    if (!draftCaptainValuesReady) {
      setDraftAwardError(`Captain $ values are required before the draft can start: ${teamsMissingCaptainValues.map((team) => team.name).join(", ")}.`);
      return;
    }
    if (!mockDraftMode) {
      setPendingRealDraftStart(true);
      return;
    }
    commitStartDraft();
  }

  function restartDraft() {
    setPendingDraftRestart(true);
  }

  function commitRestartDraft() {
    const draftedNames = new Set(Object.values(activeDraftSettings.draftedPlayers || {}).flat());
    const resetDraft = makeResetDraftSettings(selectedLeague, activeDraftSessionId, activeDraftSettings);

    if (mockDraftMode) {
      setMockDrafts((prev) => ({
        ...prev,
        [activeDraftKey]: normalizeDraftSettings({ ...resetDraft, enabled: true, started: false, completed: false, draftedPlayers: {}, playerValues: {}, currentBid: null, bidHistory: [] }, selectedLeague, activeDraftSessionId),
      }));
    } else {
      const targetLeagueId = selectedLeague?.id;
      const targetSeasonId = selectedCurrentSeason?.id;
      setLeagues((prevLeagues) => prevLeagues.map((league) => {
        if (league.id !== targetLeagueId) return league;
        const nextYears = (league.years || []).map((year) => {
          const normalized = normalizeSeasonRecord(year);
          if (normalized.id !== targetSeasonId) return year;
          return {
            ...normalized,
            drafts: {
              ...(normalized.drafts || {}),
              [activeDraftSessionId]: normalizeDraftSettings({ ...resetDraft, enabled: true, started: false, completed: false, draftedPlayers: {}, playerValues: {}, currentBid: null, bidHistory: [] }, league, activeDraftSessionId),
            },
          };
        });

        const nextTeams = (league.teams || []).map((team) => {
          if (draftedNames.size === 0) return team;
          const cleanPlayers = (players = []) => (players || []).filter((player) => !draftedNames.has(player));
          const cleanOrders = (players = []) => cleanRoster(cleanPlayers(players));
          if (selectedCurrentSeason.sessionsEnabled) {
            const sessionRoster = team.sessionRosters?.[activeDraftSessionId] || {};
            return {
              ...team,
              sessionRosters: {
                ...(team.sessionRosters || {}),
                [activeDraftSessionId]: {
                  ...sessionRoster,
                  players: cleanPlayers(sessionRoster.players || team.players || []),
                  battingOrder: cleanOrders(sessionRoster.battingOrder || team.battingOrder || []),
                  pitchingOrder: cleanOrders(sessionRoster.pitchingOrder || team.pitchingOrder || []),
                },
              },
            };
          }
          return {
            ...team,
            players: cleanPlayers(team.players || []),
            battingOrder: cleanOrders(team.battingOrder || []),
            pitchingOrder: cleanOrders(team.pitchingOrder || []),
          };
        });

        return { ...league, years: nextYears, teams: nextTeams };
      }));
    }

    setDraftSelectedPlayer("");
    setDraftBidTeamId("");
    setDraftBidAmount("1");
    setDraftAwardError("");
    setDraftTimerRunning(false);
    setDraftTimerRemaining(activeDraftSettings.timerSeconds || 60);
    setDraftStartedOverrides((prev) => ({ ...prev, [activeDraftKey]: false }));
    setPendingDraftRestart(false);
  }

  function cancelLatestBid() {
    if (!currentWinningBid) return;
    updateDraftSettings(activeDraftSessionId, (draft) => {
      const nextBidHistory = [...(draft.bidHistory || [])];
      const lastBid = nextBidHistory[nextBidHistory.length - 1];
      if (!lastBid || lastBid.id !== currentWinningBid.id) return draft;
      nextBidHistory.pop();
      const previousBidForPlayer = [...nextBidHistory].reverse().find((bid) => bid.player === draftSelectedPlayer) || null;
      return { ...draft, bidHistory: nextBidHistory, currentBid: previousBidForPlayer };
    });
    setDraftAwardError("");
  }

  function selectDraftPlayerForBid(player) {
    const cleanPlayer = String(player || "").trim();
    if (draftSelectedPlayer && cleanPlayer && cleanPlayer !== draftSelectedPlayer) {
      window.alert("The current player must be awarded or the bid must be cancelled before a new player can be selected.");
      return;
    }
    setDraftSelectedPlayer(cleanPlayer);
    setDraftBidTeamId(cleanPlayer ? draftNominatingTeamId : "");
    setDraftAwardError("");
    setDraftBidAmount(String(cleanPlayer && draftNominatingTeamId ? Math.max(1, getTeamDraftMinimumBid(selectedLeague, activeDraftSettings, draftNominatingTeamId)) : 1));
    updateDraftSettings(activeDraftSessionId, (draft) => ({ ...draft, currentBid: null }));
  }

  function awardDraftPlayer(playerName, teamId, amount) {
    const cleanPlayer = String(playerName || "").trim();
    const latestBid = getDraftCurrentBid(activeDraftSettings, cleanPlayer) || getDraftBidHistory(activeDraftSettings, cleanPlayer)[0] || null;
    const winningTeamId = latestBid?.teamId || teamId || draftBidTeamId;
    const winningAmount = latestBid?.amount || amount || draftBidAmount;

    if (!cleanPlayer || !winningTeamId) {
      setDraftAwardError("Place a bid from a specific team before awarding this player.");
      return;
    }

    const safeAmount = Math.max(1, Number(winningAmount) || 1);
    const minimumBidError = getDraftMinimumBidError(selectedLeague, activeDraftSettings, winningTeamId, safeAmount);
    const maximumBidError = getDraftMaximumBidError(selectedLeague, activeDraftSettings, winningTeamId, safeAmount);
    const rosterFullError = getDraftRosterFullError(selectedLeague, activeDraftSettings, winningTeamId);
    const carryoverError = getDraftCarryoverError(selectedLeague, activeDraftSettings, winningTeamId, safeAmount);
    const currentSpend = getTeamDraftSpend(activeDraftSettings, winningTeamId);

    if (minimumBidError) {
      setDraftAwardError(minimumBidError);
      return;
    }
    if (maximumBidError) {
      setDraftAwardError(maximumBidError);
      return;
    }
    if (rosterFullError) {
      setDraftAwardError(rosterFullError);
      return;
    }
    if (currentSpend + safeAmount > Number(activeDraftSettings.cap || 0)) {
      setDraftAwardError("This bid would exceed the selected team cap.");
      return;
    }
    if (carryoverError) {
      setDraftAwardError(carryoverError);
      return;
    }

    const winningTeam = (selectedLeague.teams || []).find((team) => team.id === winningTeamId);
    setPendingDraftAward({ playerName: cleanPlayer, teamId: winningTeamId, teamName: winningTeam?.name || "selected team", amount: safeAmount });
    setDraftAwardError("");
  }

  function commitDraftAward() {
    const cleanPlayer = String(pendingDraftAward?.playerName || "").trim();
    const winningTeamId = pendingDraftAward?.teamId || "";
    const safeAmount = Math.max(1, Number(pendingDraftAward?.amount) || 1);
    if (!cleanPlayer || !winningTeamId) {
      setPendingDraftAward(null);
      setDraftAwardError("Place a bid from a specific team before awarding this player.");
      return;
    }

    if (mockDraftMode) {
      updateDraftDataDirect(activeDraftSessionId, (draft) => {
        const draftedPlayers = Object.fromEntries(
          Object.entries(draft.draftedPlayers || {}).map(([id, players]) => [id, (players || []).filter((player) => player !== cleanPlayer)]),
        );
        draftedPlayers[winningTeamId] = [...new Set([...(draftedPlayers[winningTeamId] || []), cleanPlayer])];
        const nextDraft = {
          ...draft,
          enabled: true,
          playerValues: { ...(draft.playerValues || {}), [cleanPlayer]: safeAmount },
          draftedPlayers,
          started: true,
          currentBid: null,
        };
        return { ...nextDraft, nominationIndex: getNextDraftNominationIndex(selectedLeague, nextDraft), completed: isDraftComplete(selectedLeague, nextDraft) };
      });
      setDraftSelectedPlayer("");
      setDraftBidTeamId("");
      setDraftBidAmount("1");
      setDraftTimerRunning(false);
      setDraftTimerRemaining(activeDraftSettings.timerSeconds || 60);
      setPendingDraftAward(null);
      return;
    }

    updateLeagueDirectlyForDraft((league) => {
      const nextYears = (league.years || []).map((year) => {
        const normalized = normalizeSeasonRecord(year);
        if (normalized.id !== selectedCurrentSeason.id) return year;

        const currentDraft = normalizeDraftSettings(normalized.drafts?.[activeDraftSessionId], league, activeDraftSessionId);
        const draftedPlayers = Object.fromEntries(
          Object.entries(currentDraft.draftedPlayers || {}).map(([id, players]) => [id, (players || []).filter((player) => player !== cleanPlayer)]),
        );
        draftedPlayers[winningTeamId] = [...new Set([...(draftedPlayers[winningTeamId] || []), cleanPlayer])];

        const nextDraftBase = {
          ...currentDraft,
          enabled: true,
          playerValues: { ...(currentDraft.playerValues || {}), [cleanPlayer]: safeAmount },
          draftedPlayers,
          started: true,
          currentBid: null,
        };
        const nextDraft = normalizeDraftSettings(
          { ...nextDraftBase, nominationIndex: getNextDraftNominationIndex(league, nextDraftBase), completed: isDraftComplete(league, nextDraftBase) },
          league,
          activeDraftSessionId,
        );

        return { ...normalized, drafts: { ...(normalized.drafts || {}), [activeDraftSessionId]: nextDraft } };
      });

      const nextTeams = (league.teams || []).map((team) => {
        if (team.id !== winningTeamId) return team;

        const captain = String(team.captain || "").trim();
        const baseView = getTeamRosterForSession(
          team,
          selectedCurrentSeason.sessionsEnabled ? activeDraftSessionId : "",
          selectedCurrentSeason.keepTeamIdentityForSessions !== false,
        );
        const players = cleanRoster([...new Set([captain, ...(baseView.players || []), cleanPlayer].filter(Boolean))]);
        const battingOrder = cleanRoster([...new Set([...(baseView.battingOrder || []), cleanPlayer].filter(Boolean))]);
        const pitchingOrder = cleanRoster([...new Set([...(baseView.pitchingOrder || []), cleanPlayer].filter(Boolean))]);

        if (selectedCurrentSeason.sessionsEnabled) {
          return {
            ...team,
            sessionRosters: {
              ...(team.sessionRosters || {}),
              [activeDraftSessionId]: {
                ...(team.sessionRosters?.[activeDraftSessionId] || {}),
                players,
                battingOrder,
                pitchingOrder,
              },
            },
          };
        }

        return { ...team, players, battingOrder, pitchingOrder };
      });

      return { ...league, years: nextYears, teams: nextTeams };
    });

    setDraftSelectedPlayer("");
    setDraftBidTeamId("");
    setDraftBidAmount("1");
    setDraftTimerRunning(false);
    setDraftTimerRemaining(activeDraftSettings.timerSeconds || 60);
    setPendingDraftAward(null);
  }

  function toggleDraftTeamLock(teamId, isLocked) {
    updateDraftSettings(activeDraftSessionId, (draft) => ({
      ...draft,
      lockedTeamIds: isLocked ? [...new Set([...(draft.lockedTeamIds || []), teamId])] : (draft.lockedTeamIds || []).filter((id) => id !== teamId),
    }));
  }

  function addScheduleWeek(yearId) {
    updateSelectedLeague((league) => ({
      ...league,
      years: (league.years || []).map((year) => {
        if (year.id !== yearId) return year;
        const normalized = normalizeSeasonRecord(year);
        const activeSessionId = normalized.sessionsEnabled ? normalized.currentSessionId || normalized.sessions?.[0]?.id || "" : "";
        const visibleWeekCount = (normalized.scheduleWeeks || []).filter((week) => !normalized.sessionsEnabled || week.sessionId === activeSessionId).length;
        const mainField = getMainField(league.fields || []);
        return {
          ...normalized,
          scheduleWeeks: [
            ...(normalized.scheduleWeeks || []),
            { ...makeDefaultScheduleWeek(visibleWeekCount + 1, activeSessionId), fieldId: mainField?.id || "" },
          ],
        };
      }),
    }));
  }

  function updateScheduleWeek(yearId, weekId, field, value) {
    updateSelectedLeague((league) => ({
      ...league,
      years: (league.years || []).map((year) => {
        if (year.id !== yearId) return year;
        const normalized = normalizeSeasonRecord(year);
        return { ...normalized, scheduleWeeks: (normalized.scheduleWeeks || []).map((week) => (week.id === weekId ? { ...week, [field]: value } : week)) };
      }),
    }));
  }

  function cloneScheduleGamesForNewPeriod(games = [], targetSessionId = "") {
    return (games || []).map((game, index) => ({
      id: newId(),
      name: game.name || `Game ${index + 1}`,
      time: game.time || defaultScheduleTimeValue(),
      sessionId: targetSessionId,
      awayTeamId: "",
      homeTeamId: "",
      completedGameId: "",
    }));
  }

  function copyScheduleWeek(yearId, sourceWeekId, oneWeekLater = true) {
    updateSelectedLeague((league) => ({
      ...league,
      years: (league.years || []).map((year) => {
        if (year.id !== yearId) return year;
        const normalized = normalizeSeasonRecord(year);
        const sourceWeek = (normalized.scheduleWeeks || []).find((week) => week.id === sourceWeekId);
        if (!sourceWeek) return year;
        const activeSessionId = normalized.sessionsEnabled ? sourceWeek.sessionId || normalized.currentSessionId || normalized.sessions?.[0]?.id || "" : "";
        const visibleWeekCount = (normalized.scheduleWeeks || []).filter((week) => !normalized.sessionsEnabled || week.sessionId === activeSessionId).length;
        const copiedGames = cloneScheduleGamesForNewPeriod(
          (sourceWeek.games || []).filter((game) => !normalized.sessionsEnabled || game.sessionId === activeSessionId),
          activeSessionId,
        );
        return {
          ...normalized,
          scheduleWeeks: [
            ...(normalized.scheduleWeeks || []),
            {
              id: newId(),
              name: `Week ${visibleWeekCount + 1}`,
              date: oneWeekLater && sourceWeek.date ? addDaysToDateValue(sourceWeek.date, 7) : "",
              fieldId: "",
              sessionId: activeSessionId,
              isTournament: Boolean(sourceWeek.isTournament),
              games: copiedGames,
            },
          ],
        };
      }),
    }));
    setPendingCopyWeekId("");
    setCopyWeekOneWeekLater(true);
  }

  function copyCurrentSessionScheduleToSession(yearId, targetSessionId, firstWeekDate) {
    if (!targetSessionId || !firstWeekDate) return;
    updateSelectedLeague((league) => ({
      ...league,
      years: (league.years || []).map((year) => {
        if (year.id !== yearId) return year;
        const normalized = normalizeSeasonRecord(year);
        if (!normalized.sessionsEnabled) return normalized;
        const sourceSessionId = normalized.currentSessionId || normalized.sessions?.[0]?.id || "";
        if (!sourceSessionId || sourceSessionId === targetSessionId) return normalized;
        const sourceWeeks = (normalized.scheduleWeeks || []).filter((week) => week.sessionId === sourceSessionId);
        if (sourceWeeks.length === 0) return normalized;
        const firstSourceDate = sourceWeeks.find((week) => week.date)?.date || "";
        const copiedWeeks = sourceWeeks.map((week, weekIndex) => {
          const offset = firstSourceDate && week.date ? dateDiffInDays(firstSourceDate, week.date) : weekIndex * 7;
          return {
            id: newId(),
            name: week.name || `Week ${weekIndex + 1}`,
            date: addDaysToDateValue(firstWeekDate, offset ?? weekIndex * 7),
            fieldId: "",
            sessionId: targetSessionId,
            isTournament: Boolean(week.isTournament),
            games: cloneScheduleGamesForNewPeriod(week.games || [], targetSessionId),
          };
        });
        return {
          ...normalized,
          currentSessionId: targetSessionId,
          scheduleWeeks: [
            ...(normalized.scheduleWeeks || []).filter((week) => week.sessionId !== targetSessionId),
            ...copiedWeeks,
          ],
        };
      }),
    }));
  }

  function copySeasonScheduleToExistingSeason(sourceYearId, targetYearId, firstWeekDate) {
    if (!sourceYearId || !targetYearId || !firstWeekDate || sourceYearId === targetYearId) return;
    updateSelectedLeague((league) => ({
      ...league,
      years: (league.years || []).map((year) => {
        const targetSeason = normalizeSeasonRecord(year);
        if (targetSeason.id !== targetYearId) return year;
        const sourceSeason = (league.years || []).map(normalizeSeasonRecord).find((item) => item.id === sourceYearId);
        if (!sourceSeason) return year;
        const sessionIdMap = {};
        const targetSessions = sourceSeason.sessionsEnabled
          ? (sourceSeason.sessions || []).map((session, index) => {
            const existingTargetSession = targetSeason.sessions?.[index] || {};
            const targetSessionId = existingTargetSession.id || newId();
            sessionIdMap[session.id] = targetSessionId;
            return { id: targetSessionId, name: existingTargetSession.name || session.name || `Session ${index + 1}`, rosterNotes: existingTargetSession.rosterNotes || "" };
          })
          : targetSeason.sessions;
        const weeksBySession = {};
        (sourceSeason.scheduleWeeks || []).forEach((week) => {
          const key = sourceSeason.sessionsEnabled ? week.sessionId || "default" : "default";
          if (!weeksBySession[key]) weeksBySession[key] = [];
          weeksBySession[key].push(week);
        });
        const copiedScheduleWeeks = Object.entries(weeksBySession).flatMap(([sourceSessionId, weeks]) => {
          const sortedWeeks = [...weeks];
          const firstSourceDate = sortedWeeks.find((week) => week.date)?.date || "";
          const targetSessionId = sourceSeason.sessionsEnabled ? sessionIdMap[sourceSessionId] || targetSessions?.[0]?.id || "" : "";
          return sortedWeeks.map((week, weekIndex) => {
            const offset = firstSourceDate && week.date ? dateDiffInDays(firstSourceDate, week.date) : weekIndex * 7;
            return {
              id: newId(),
              name: week.name || `Week ${weekIndex + 1}`,
              date: addDaysToDateValue(firstWeekDate, offset ?? weekIndex * 7),
              fieldId: "",
              sessionId: targetSessionId,
              isTournament: Boolean(week.isTournament),
              games: cloneScheduleGamesForNewPeriod(week.games || [], targetSessionId),
            };
          });
        });
        return normalizeSeasonRecord({
          ...targetSeason,
          notes: targetSeason.notes || `Schedule copied from ${sourceSeason.year}; starts ${firstWeekDate}`,
          sessionsEnabled: sourceSeason.sessionsEnabled,
          sessionCount: sourceSeason.sessionsEnabled ? Math.max(2, sourceSeason.sessionCount || targetSessions.length || 2) : 1,
          currentSessionId: sourceSeason.sessionsEnabled ? targetSessions?.[0]?.id || "" : "",
          keepRostersForSessions: targetSeason.keepRostersForSessions,
          keepTeamIdentityForSessions: targetSeason.keepTeamIdentityForSessions,
          sessions: targetSessions,
          scheduleWeeks: copiedScheduleWeeks,
        });
      }),
      currentSeasonYear: Number((league.years || []).find((year) => year.id === targetYearId)?.year) || league.currentSeasonYear,
    }));
  }

  function addScheduledGame(yearId, weekId) {
    updateSelectedLeague((league) => ({
      ...league,
      years: (league.years || []).map((year) => {
        if (year.id !== yearId) return year;
        const normalized = normalizeSeasonRecord(year);
        const activeSessionId = normalized.sessionsEnabled ? normalized.currentSessionId || normalized.sessions?.[0]?.id || "" : "";
        return {
          ...normalized,
          scheduleWeeks: (normalized.scheduleWeeks || []).map((week) => {
            if (week.id !== weekId) return week;
            const visibleGameCount = (week.games || []).filter((game) => !normalized.sessionsEnabled || game.sessionId === activeSessionId).length;
            return { ...week, games: [...(week.games || []), makeDefaultScheduledGame(league, normalized, visibleGameCount, activeSessionId)] };
          }),
        };
      }),
    }));
  }

  function updateScheduledGame(yearId, weekId, gameId, field, value) {
    updateSelectedLeague((league) => ({
      ...league,
      years: (league.years || []).map((year) => {
        if (year.id !== yearId) return year;
        const normalized = normalizeSeasonRecord(year);
        return {
          ...normalized,
          scheduleWeeks: (normalized.scheduleWeeks || []).map((week) => (week.id === weekId ? { ...week, games: (week.games || []).map((game) => (game.id === gameId ? { ...game, [field]: value } : game)) } : week)),
        };
      }),
    }));
  }

  function removeScheduledGame(yearId, weekId, gameId) {
    updateSelectedLeague((league) => ({
      ...league,
      years: (league.years || []).map((year) => {
        if (year.id !== yearId) return year;
        const normalized = normalizeSeasonRecord(year);
        return { ...normalized, scheduleWeeks: (normalized.scheduleWeeks || []).map((week) => (week.id === weekId ? { ...week, games: (week.games || []).filter((game) => game.id !== gameId) } : week)) };
      }),
    }));
  }

  function removeScheduleWeek(yearId, weekId) {
    updateSelectedLeague((league) => ({
      ...league,
      years: (league.years || []).map((year) => {
        if (year.id !== yearId) return year;
        const normalized = normalizeSeasonRecord(year);
        return { ...normalized, scheduleWeeks: (normalized.scheduleWeeks || []).filter((week) => week.id !== weekId) };
      }),
    }));
  }

  function addLeagueField() {
    updateSelectedLeague((league) => ({
      ...league,
      fields: [...(league.fields || []), { id: newId(), name: `Field ${(league.fields || []).length + 1}`, address: "", notes: "", rules: [], isMain: (league.fields || []).length === 0 }],
    }));
  }

  function updateLeagueField(fieldId, field, value) {
    updateSelectedLeague((league) => ({
      ...league,
      fields: (league.fields || []).map((item) => (item.id === fieldId ? { ...item, [field]: value } : item)),
    }));
  }

  function setLeagueMainField(fieldId) {
    updateSelectedLeague((league) => ({
      ...league,
      fields: (league.fields || []).map((field) => ({ ...field, isMain: field.id === fieldId })),
    }));
    if (selectedLeague?.id === setupLeague?.id) {
      setSelectedFieldId(fieldId);
      const field = selectedLeague?.fields?.find((item) => item.id === fieldId);
      if (field) setGameLocation(field.name);
    }
  }

  function addFieldRule(fieldId) {
    updateSelectedLeague((league) => ({
      ...league,
      fields: (league.fields || []).map((field) =>
        field.id === fieldId
          ? { ...field, rules: [...(field.rules || []), { id: newId(), name: `Field Rule ${(field.rules || []).length + 1}`, description: "", actions: [], countBonusRunsAsRbi: false, runs: 1, outs: 1 }] }
          : field,
      ),
    }));
  }

  function updateFieldRule(fieldId, ruleId, property, value) {
    updateSelectedLeague((league) => ({
      ...league,
      fields: (league.fields || []).map((field) =>
        field.id === fieldId
          ? { ...field, rules: (field.rules || []).map((rule) => (rule.id === ruleId ? { ...rule, [property]: property === "runs" ? Number(value) || 0 : value } : rule)) }
          : field,
      ),
    }));
  }

  function removeFieldRule(fieldId, ruleId) {
    updateSelectedLeague((league) => ({
      ...league,
      fields: (league.fields || []).map((field) =>
        field.id === fieldId ? { ...field, rules: (field.rules || []).filter((rule) => rule.id !== ruleId) } : field,
      ),
    }));
  }

  function removeLeagueField(fieldId) {
    updateSelectedLeague((league) => {
      const remainingFields = (league.fields || []).filter((field) => field.id !== fieldId);
      const hasMain = remainingFields.some((field) => field.isMain);
      return {
        ...league,
        fields: remainingFields.map((field, index) => ({ ...field, isMain: hasMain ? field.isMain : index === 0 })),
      };
    });
    if (selectedFieldId === fieldId) setSelectedFieldId("");
  }

  function toggleImportField(fieldId, isSelected) {
    setSelectedImportFieldIds((prev) => (isSelected ? [...new Set([...prev, fieldId])] : prev.filter((id) => id !== fieldId)));
  }

  function addSelectedFieldsFromLeague() {
    if (!selectedLeague || !fieldImportSourceLeague) return;
    const fieldsToAdd = (fieldImportSourceLeague.fields || [])
      .filter((field) => selectedImportFieldIds.includes(field.id))
      .map((field) => ({ ...field, id: newId(), isMain: false, rules: (field.rules || []).map((rule) => ({ ...rule, id: newId() })) }));
    if (fieldsToAdd.length === 0) return;
    updateSelectedLeague((league) => ({
      ...league,
      fields: [...(league.fields || []), ...fieldsToAdd].map((field, index) => ({ ...field, isMain: (league.fields || []).some((existingField) => existingField.isMain) ? field.isMain : index === 0 })),
    }));
    setSelectedImportFieldIds([]);
  }

  function applyFieldToGame(fieldId) {
    setSelectedFieldId(fieldId || "");
    const field = setupLeague?.fields?.find((item) => item.id === fieldId);
    setGameLocation(field ? field.name : "");
  }

  useEffect(() => {
    if (!setupLeagueId || isCustomGame || isLeagueExhibitionGame || !setupLeague) return;
    if (!selectedFieldId && setupMainField) {
      setSelectedFieldId(setupMainField.id);
      setGameLocation(setupMainField.name);
    }
  }, [setupLeagueId, isCustomGame, isLeagueExhibitionGame, setupLeague, selectedFieldId, setupMainField]);

  useEffect(() => {
    if (!isCustomGame && useLeagueDefaultRules) applyLeagueDefaultRules();
  }, [setupLeagueId, useLeagueDefaultRules, setupLeagueDefaultRulesKey]);

  useEffect(() => {
    if (activePage !== "score" || !gameStarted) {
      setMatchupStatCountdown(8);
      return undefined;
    }

    const timer = window.setInterval(() => {
      setMatchupStatCountdown((seconds) => {
        if (seconds <= 0) {
          setMatchupStatScopeIndex((index) => (index + 1) % 4);
          return 8;
        }
        return seconds - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [activePage, gameStarted]);

  useEffect(() => {
    setSelectedBatterSide(currentBatterProfile?.bats === "L" ? "L" : "R");
  }, [currentBatter, currentBatterProfile?.bats]);

  useEffect(() => {
    if (activePage !== "draft" || !draftTimerRunning) return undefined;
    const timer = window.setInterval(() => {
      setDraftTimerRemaining((seconds) => {
        if (seconds <= 1) {
          setDraftTimerRunning(false);
          return 0;
        }
        return seconds - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [activePage, draftTimerRunning]);

  useEffect(() => {
    if (statsViewMode === "player_vs" && statsVsPlayerOptions.length > 0) {
      if (statsVsHitterFilter === "all" || !statsVsPlayerOptions.includes(statsVsHitterFilter)) {
        setStatsVsHitterFilter(statsVsPlayerOptions[0]);
      }
      if (statsVsPitcherFilter === "all" || !statsVsPlayerOptions.includes(statsVsPitcherFilter)) {
        setStatsVsPitcherFilter(statsVsPlayerOptions[0]);
      }
    }
  }, [statsViewMode, statsVsPlayerOptions, statsVsHitterFilter, statsVsPitcherFilter]);

  function moveInList(setter, teamKey, index, direction) {
    setter((prev) => {
      const list = [...prev[teamKey]];
      const newIndex = index + direction;
      if (newIndex < 0 || newIndex >= list.length) return prev;
      const [movedItem] = list.splice(index, 1);
      list.splice(newIndex, 0, movedItem);
      return { ...prev, [teamKey]: list };
    });
  }

  function applyTeamPlayerRename(teamKey, index, name) {
    setTeamPlayers((prev) => {
      const oldName = prev[teamKey][index];
      const nextPlayers = [...prev[teamKey]];
      nextPlayers[index] = name;

      const trimmedName = String(name || "").trim();
      const isSubSlot = Boolean(subSlots?.[teamKey]?.[index]);
      if (trimmedName && isPlayerAlreadyInGame(prev, trimmedName, teamKey, index)) return prev;
      if (isSubSlot && isSubAlreadyOnTeam(prev[teamKey], subSlots[teamKey], trimmedName, index)) return prev;
      if (isSubSlot && isSubAlreadyInGame(prev, subSlots, trimmedName, teamKey, index)) return prev;
      if (!trimmedName) {
        if (oldName && isSubSlot) {
          setSubPlayers((subPrev) => {
            const nextTeamSubs = { ...(subPrev[teamKey] || {}) };
            delete nextTeamSubs[oldName];
            return { ...subPrev, [teamKey]: nextTeamSubs };
          });
        }
        return { ...prev, [teamKey]: nextPlayers };
      }

      function replaceInOrder(orderList) {
        if (oldName && orderList.includes(oldName)) {
          return orderList.map((player) => (player === oldName ? trimmedName : player));
        }
        const nextOrder = [...orderList];
        if (nextOrder[index]) nextOrder[index] = trimmedName;
        if (!nextOrder.includes(trimmedName)) nextOrder.push(trimmedName);
        return cleanRoster(nextOrder);
      }

      setBattingOrder((orderPrev) => ({ ...orderPrev, [teamKey]: replaceInOrder(orderPrev[teamKey]) }));
      setPitchingOrder((orderPrev) => ({ ...orderPrev, [teamKey]: replaceInOrder(orderPrev[teamKey]) }));
      setExtraPitchers((extraPrev) => {
        const nextTeamExtra = { ...(extraPrev[teamKey] || {}) };
        Object.keys(nextTeamExtra).forEach((inning) => {
          if (nextTeamExtra[inning] === oldName) nextTeamExtra[inning] = trimmedName;
        });
        return { ...extraPrev, [teamKey]: nextTeamExtra };
      });
      setSubPlayers((subPrev) => {
        const nextTeamSubs = { ...(subPrev[teamKey] || {}) };
        if (oldName && Object.prototype.hasOwnProperty.call(nextTeamSubs, oldName)) {
          nextTeamSubs[trimmedName] = nextTeamSubs[oldName];
          delete nextTeamSubs[oldName];
        } else if (isSubSlot) {
          nextTeamSubs[trimmedName] = true;
        }
        return { ...subPrev, [teamKey]: nextTeamSubs };
      });

      return { ...prev, [teamKey]: nextPlayers };
    });
  }

  function renameTeamPlayer(teamKey, index, name) {
    const oldName = String(teamPlayers?.[teamKey]?.[index] || "").trim();
    const newName = String(name || "").trim();
    const playerNameIsPlaceholder = /^away player [0-9]+$/i.test(oldName) || /^home player [0-9]+$/i.test(oldName);
    const hasStartedScoring = Boolean(gameStarted && (activePage === "score" || events.length > 0 || activeSavedGameId));
    if (hasStartedScoring && oldName && newName && oldName !== newName && !playerNameIsPlaceholder) {
      setPendingPlayerRename({ teamKey, index, oldName, newName: name });
      return;
    }
    applyTeamPlayerRename(teamKey, index, name);
  }

  function approvePendingPlayerRename() {
    if (!pendingPlayerRename) return;
    applyTeamPlayerRename(pendingPlayerRename.teamKey, pendingPlayerRename.index, pendingPlayerRename.newName);
    setPendingPlayerRename(null);
  }

  function addTeamPlayer(teamKey) {
    setTeamPlayers((prev) => {
      return { ...prev, [teamKey]: [...(prev[teamKey] || []), ""] };
    });
  }

  function removeTeamPlayer(teamKey, index) {
    setTeamPlayers((prev) => {
      const removedPlayer = prev[teamKey][index];
      const nextPlayers = cleanRoster(prev[teamKey].filter((_, playerIndex) => playerIndex !== index));
      setBattingOrder((orderPrev) => ({ ...orderPrev, [teamKey]: cleanRoster(orderPrev[teamKey].filter((player) => player !== removedPlayer)) }));
      setPitchingOrder((orderPrev) => ({ ...orderPrev, [teamKey]: cleanRoster(orderPrev[teamKey].filter((player) => player !== removedPlayer)) }));
      setExtraPitchers((extraPrev) => {
        const nextTeamExtra = { ...(extraPrev[teamKey] || {}) };
        Object.keys(nextTeamExtra).forEach((inning) => {
          if (nextTeamExtra[inning] === removedPlayer) delete nextTeamExtra[inning];
        });
        return { ...extraPrev, [teamKey]: nextTeamExtra };
      });
      setSubPlayers((subPrev) => {
        const nextTeamSubs = { ...(subPrev[teamKey] || {}) };
        delete nextTeamSubs[removedPlayer];
        return { ...subPrev, [teamKey]: nextTeamSubs };
      });
      return { ...prev, [teamKey]: nextPlayers };
    });
  }

  function toggleSubPlayer(teamKey, index, player, isSub) {
    setSubSlots((prev) => {
      const nextTeamSlots = { ...(prev[teamKey] || {}) };
      if (isSub) nextTeamSlots[index] = true;
      else delete nextTeamSlots[index];
      return { ...prev, [teamKey]: nextTeamSlots };
    });

    if (isSub) {
      renameTeamPlayer(teamKey, index, "");
      return;
    }

    setSubPlayers((prev) => {
      const nextTeamSubs = { ...(prev[teamKey] || {}) };
      if (player) delete nextTeamSubs[player];
      return { ...prev, [teamKey]: nextTeamSubs };
    });
  }

  function selectSubPlayer(teamKey, index, value) {
    if (!value) {
      renameTeamPlayer(teamKey, index, "");
      return;
    }
    if (isSubAlreadyOnTeam(teamPlayers[teamKey], subSlots[teamKey], value, index)) return;
    if (isSubAlreadyInGame(teamPlayers, subSlots, value, teamKey, index)) return;
    renameTeamPlayer(teamKey, index, value);
    setSubSlots((prev) => ({ ...prev, [teamKey]: { ...(prev[teamKey] || {}), [index]: true } }));
    setSubPlayers((prev) => ({ ...prev, [teamKey]: { ...(prev[teamKey] || {}), [value]: true } }));
  }

  function moveBatter(teamKey, index, direction) {
    moveInList(setBattingOrder, teamKey, index, direction);
  }

  function movePitcher(teamKey, index, direction) {
    moveInList(setPitchingOrder, teamKey, index, direction);
  }

  function setExtraPitcher(teamKey, inning, pitcher) {
    setExtraPitchers((prev) => ({ ...prev, [teamKey]: { ...(prev[teamKey] || {}), [inning]: pitcher } }));
  }

  function addExtraRunnerRule() {
    const firstExtraInning = getFirstExtraInning(gameInnings);
    setExtraRunnerRules((prev) => [
      ...prev,
      { id: newId(), startInning: prev.length === 0 ? firstExtraInning : Math.max(firstExtraInning, Math.max(...prev.map((rule) => Number(rule.startInning) || firstExtraInning)) + 1), bases: "second", sameRestOfGame: false },
    ]);
  }

  function updateExtraRunnerRule(ruleId, field, value) {
    setExtraRunnerRules((prev) =>
      prev
        .map((rule) =>
          rule.id === ruleId
            ? { ...rule, [field]: field === "startInning" ? Math.max(getFirstExtraInning(gameInnings), Number(value) || getFirstExtraInning(gameInnings)) : value }
            : rule,
        )
        .sort((a, b) => Number(a.startInning) - Number(b.startInning)),
    );
  }

  function removeExtraRunnerRule(ruleId) {
    setExtraRunnerRules((prev) => prev.filter((rule) => rule.id !== ruleId));
  }

  function maybeShowEndOfInningNotification(nextEvents, completedGame, completedInning, completedHalf) {
    const nextGame = calculateState(nextEvents, { extraRunnerRules, battingOrder, ghostRunnersCountAsRbi, gameInnings });
    if (nextGame.status === "final") return;

    const advancedToNextHalf = nextGame.inning !== completedInning || nextGame.half !== completedHalf;
    if (!advancedToNextHalf) return;

    setPendingInningNotification({
      inning: completedInning,
      half: completedHalf,
      nextInning: nextGame.inning,
      nextHalf: nextGame.half,
      awayTeam,
      homeTeam,
      awayScore: nextGame.awayScore,
      homeScore: nextGame.homeScore,
    });
  }

  function addPlay(result) {
    if (result.type === "strikeout" && !result.strikeoutType) {
      setPendingStrikeoutResult(result);
      return;
    }

    const isSacFly = result.type === "sac_fly";
    const isDoublePlay = result.type === "double_play";
    const isTriplePlay = result.type === "triple_play";
    const normalOutcome = isSacFly ? getSacFlyOutcome(game.bases) : isDoublePlay ? getDoublePlayOutcome(game.bases) : isTriplePlay ? getTriplePlayOutcome(game.bases) : calculateAutoAdvance(game.bases, currentBatter, result);
    const inningRunsBefore = getInningRunsBeforePlay(lineScore, battingTeam, game.inning);
    const walkWouldTriggerRunRule = result.type === "walk" && shouldRunRuleEndHalf({
      runRuleEnabled,
      runRuleRuns,
      inningRunsBefore,
      playRuns: normalOutcome.runs,
      inning: game.inning,
      runRuleBeforeFourthOnly,
      gameInnings,
    });
    const useRunRuleWalkHr = !manualMode && walkRunRuleCountsAsHr && walkWouldTriggerRunRule;
    const scoringResult = useRunRuleWalkHr
      ? { label: "Run Rule Walk HR", type: "run_rule_walk_hr", bases: 4, atBat: 1, hit: 1, homeRun: 1 }
      : result;
    const autoOutcome = useRunRuleWalkHr ? getRunRuleWalkHomeRunOutcome(game.bases, currentBatter) : normalOutcome;
    const runs = manualMode ? manualRuns : autoOutcome.runs;
    const ghostRunsScoredWithoutRbi = !game.ghostRunnersCountAsRbi && Array.isArray(autoOutcome.scored)
      ? autoOutcome.scored.filter((runnerName) => game.ghostRunners.includes(runnerName)).length
      : 0;
    const rbi = manualMode ? manualRbi : Math.max(0, autoOutcome.rbi - ghostRunsScoredWithoutRbi);
    const basesAfter = isSacFly || isDoublePlay || isTriplePlay ? autoOutcome.basesAfter : scoringResult.out ? cloneBases(game.bases) : autoOutcome.basesAfter;
    const scored = manualMode ? [] : autoOutcome.scored;
    const runRuleEndsHalf = shouldRunRuleEndHalf({ runRuleEnabled, runRuleRuns, inningRunsBefore, playRuns: runs, inning: game.inning, runRuleBeforeFourthOnly, gameInnings });

    const event = {
      id: newId(),
      type: "play",
      team: battingTeam,
      inning: game.inning,
      half: game.half,
      batter: currentBatter,
      pitcher: currentPitcher,
      defensiveTeam,
      result: scoringResult.strikeoutType ? `${scoringResult.label} (${scoringResult.strikeoutType === "looking" ? "Looking" : "Swinging"})` : scoringResult.label,
      strikeoutType: scoringResult.strikeoutType || "",
      modifier: activeModifierInvalid ? null : selectedModifier,
      runs,
      rbi,
      outs: scoringResult.outs ?? (scoringResult.out ? 1 : 0),
      atBat: scoringResult.atBat || 0,
      hit: scoringResult.hit || 0,
      walk: scoringResult.walk || 0,
      strikeout: scoringResult.strikeout || 0,
      homeRun: scoringResult.homeRun || 0,
      double: scoringResult.type === "double" ? 1 : 0,
      triple: scoringResult.type === "triple" ? 1 : 0,
      earnedRuns: runs,
      unearnedRuns: 0,
      repeatBatter: Boolean(scoringResult.forceRepeatBatter || repeatBatter),
      endHalf: endHalf || runRuleEndsHalf,
      basesBefore: cloneBases(game.bases),
      basesAfter,
      scored,
      autoDescription: runRuleEndsHalf ? `${autoOutcome.description} Run rule reached.` : autoOutcome.description,
      manualMode,
      ghostRunsScoredWithoutRbi,
      ghostRunnersCountAsRbi: game.ghostRunnersCountAsRbi,
      runRuleApplied: runRuleEndsHalf,
      runRuleWalkHr: useRunRuleWalkHr,
      note: note || (runRuleEndsHalf ? `Run rule reached at ${runRuleRuns} run(s).` : ""),
      batterSide: batterSideForPlay,
      batterBats: currentBatterProfile?.bats || "R",
      pitcherThrows: pitcherSideForPlay,
      createdAt: new Date().toLocaleTimeString(),
    };

    const nextEvents = [...events, event];
    setEvents(nextEvents);
    if (event.endHalf || game.outs + (event.outs || 0) >= 3) {
      maybeShowEndOfInningNotification(nextEvents, game, game.inning, game.half);
    }
    setManualRuns(0);
    setManualRbi(0);
    setSelectedModifier(null);
    setRepeatBatter(false);
    setEndHalf(false);
    setNote("");
  }

  function confirmStrikeoutType(strikeoutType) {
    if (!pendingStrikeoutResult) return;
    const label = strikeoutType === "looking" ? "Strikeout Looking" : "Strikeout Swinging";
    const result = { ...pendingStrikeoutResult, label, strikeoutType };
    setPendingStrikeoutResult(null);
    addPlay(result);
  }

  function addTeamAdjustment(team, amount) {
    const event = { id: newId(), type: "score_adjustment", team, inning: game.inning, half: game.half, runs: amount, note: note || (amount > 0 ? "Bonus run" : "Run removed"), createdAt: new Date().toLocaleTimeString() };
    setEvents((prev) => [...prev, event]);
    setNote("");
  }

  function addFieldRuleNote(rule, noteText) {
    const event = { id: newId(), type: "field_rule", ruleName: rule.name, actions: getFieldRuleActions(rule), team: battingTeam, inning: game.inning, half: game.half, batter: currentBatter, note: noteText || `${rule.name}: ${fieldRuleActionSummary(rule)}`, createdAt: new Date().toLocaleTimeString() };
    setEvents((prev) => [...prev, event]);
  }

  function applyFieldRule(rule) {
    if (!rule || game.status === "final") return;
    const actions = getFieldRuleActions(rule);
    const runs = Number(rule.runs) || 0;
    const resultAction = fieldRulePrimaryResultAction(rule);
    const hasBatAgain = actions.includes("bat_again");
    const noteParts = [];

    if (resultAction) {
      const result = resultAction === "automatic_out"
        ? { label: rule.name || "Field Rule Out", type: "field_rule_out", bases: 0, atBat: 1, outs: Math.max(1, Number(rule.outs) || 1) }
        : resultButtons.find((button) => button.type === resultAction);
      if (result) addPlay({ ...result, label: rule.name || result.label, forceRepeatBatter: hasBatAgain });
      noteParts.push(resultAction === "automatic_out" ? `${Math.max(1, Number(rule.outs) || 1)} automatic out${Math.max(1, Number(rule.outs) || 1) === 1 ? "" : "s"}` : `result set to ${resultAction.replace("_", " ")}`);
    }

    if (actions.includes("extra_run_batting") && runs !== 0) {
      addTeamAdjustment(battingTeam, runs);
      if (rule.countBonusRunsAsRbi) {
        setEvents((prev) => [...prev, { id: newId(), type: "rbi_adjustment", team: battingTeam, inning: game.inning, half: game.half, batter: currentBatter, rbi: runs, note: `${rule.name || "Field Rule"}: ${runs} bonus RBI`, createdAt: new Date().toLocaleTimeString() }]);
      }
      noteParts.push(`${runs > 0 ? "+" : ""}${runs} bonus run for batting team${rule.countBonusRunsAsRbi ? " with RBI" : " with no RBI"}`);
    }

    if (actions.includes("extra_run_defense") && runs !== 0) {
      addTeamAdjustment(defensiveTeam, runs);
      noteParts.push(`${runs > 0 ? "+" : ""}${runs} bonus run for other team`);
    }

    if (hasBatAgain) {
      noteParts.push("batter bats again");
    }

    if (hasBatAgain && !resultAction) {
      setRepeatBatter(true);
    }

    addFieldRuleNote(rule, `${rule.name || "Field Rule"}: ${noteParts.join(" + ") || "applied"}`);
  }

  function undoLast() {
    setEvents((prev) => {
      if (prev.length === 0) return prev;
      const nextEvents = prev.slice(0, -1);
      if (activeSavedGameId) {
        const snapshot = makeGameArchiveEntry(nextEvents, activeSavedGameId);
        setPreviousGames((previous) => previous.map((savedGame) => (savedGame.id === activeSavedGameId ? snapshot : savedGame)));
      }
      return nextEvents;
    });
    setArchivedFinalEventId(null);
    setSelectedModifier(null);
    setRepeatBatter(false);
    setEndHalf(false);
    setManualMode(false);
    setManualRuns(0);
    setManualRbi(0);
    setNote("");
  }

  function clearCurrentGame() {
    setEvents([]);
    setManualRuns(0);
    setManualRbi(0);
    setSelectedModifier(null);
    setRepeatBatter(false);
    setEndHalf(false);
    setNote("");
    setSetupAttempted(false);
    setAwayLeagueTeamId("");
    setHomeLeagueTeamId("");
    if (!isCustomGame) {
      setAwayTeam("Away Team");
      setHomeTeam("Home Team");
      const resetRosters = isLeagueExhibitionGame ? emptyGameRosters : defaultPlayers;
      setTeamPlayers(resetRosters);
      setBattingOrder(resetRosters);
      setPitchingOrder(resetRosters);
      setSubPlayers({ away: {}, home: {} });
      setSubSlots({ away: {}, home: {} });
      setExtraPitchers({ away: {}, home: {} });
    }
    setGameDate(todayInputValue());
    setGameTime(currentTimeInputValue());
    const mainField = getMainField(setupLeague?.fields || []);
    if (!isCustomGame && mainField) {
      setSelectedFieldId(mainField.id);
      setGameLocation(mainField.name);
    }
  }

  function resetGame() {
    clearCurrentGame();
  }

  function cancelCurrentGame() {
    setEvents([]);
    setArchivedFinalEventId(null);
    setActiveSavedGameId(null);
    setManualRuns(0);
    setManualRbi(0);
    setSelectedModifier(null);
    setRepeatBatter(false);
    setEndHalf(false);
    setManualMode(false);
    setNote("");
    setPendingFieldRule(null);
    setConfirmCancelGameOpen(false);
    setGameStarted(false);
    setSetupEditingDuringGame(false);
    setActivePage("setup");
  }

  function makeGameArchiveEntry(eventsToArchive = events, existingId = null) {
    const currentGame = calculateState(eventsToArchive, { extraRunnerRules, battingOrder, ghostRunnersCountAsRbi, gameInnings });
    const currentLineScore = buildLineScore(eventsToArchive, currentGame);
    const currentTaggedSplits = buildTaggedHittingSplits(eventsToArchive);
    return {
      id: existingId || newId(),
      savedAt: new Date().toLocaleString(),
      awayTeam,
      homeTeam,
      gameDate,
      gameTime,
      gameLocation,
      awayScore: currentGame.awayScore,
      homeScore: currentGame.homeScore,
      winner: currentGame.winner || getWinner(currentGame),
      status: currentGame.status,
      finalReason: currentGame.finalReason,
      innings: currentLineScore.inningNumbers.length,
      eventCount: eventsToArchive.length,
      stats: JSON.parse(JSON.stringify(currentGame.stats || {})),
      pitchingStats: JSON.parse(JSON.stringify(currentGame.pitchingStats || {})),
      taggedHittingSplits: JSON.parse(JSON.stringify(currentTaggedSplits || [])),
      pudwhackerSplits: JSON.parse(JSON.stringify(buildPudwhackerSplits(eventsToArchive) || [])),
      events: JSON.parse(JSON.stringify(eventsToArchive || [])),
      lineScore: JSON.parse(JSON.stringify(currentLineScore || {})),
      isTournament: selectedScheduledWeek?.isTournament || false,
      teamPlayers: JSON.parse(JSON.stringify(teamPlayers || defaultPlayers)),
      savedSetup: JSON.parse(JSON.stringify({
        awayTeam,
        homeTeam,
        setupLeagueId: isCustomGame ? "custom" : setupLeague?.id || setupLeagueId,
        isLeagueExhibition: Boolean(isLeagueExhibitionGame),
        gameSeasonYear: isCustomGame ? gameSeasonYear : setupLeague?.currentSeasonYear || gameSeasonYear,
        gameSessionId,
        useLeagueSchedule,
        selectedScheduledWeekId,
        selectedScheduledGameId,
        isTournament: selectedScheduledWeek?.isTournament || false,
        selectedFieldId,
        gameInnings,
        awayLeagueTeamId,
        homeLeagueTeamId,
        gameDate,
        gameTime,
        gameLocation,
        powerPlaysEnabled,
        powerPlayLimitType,
        powerPlayLimitAmount,
        whammysEnabled,
        pudwhackerEnabled,
        extraRunnerRules,
        ghostRunnersCountAsRbi,
        runRuleEnabled,
        runRuleRuns,
        runRuleBeforeFourthOnly,
        walkRunRuleCountsAsHr,
        useLeagueDefaultRules,
        teamPlayers,
        subPlayers,
        subSlots,
        battingOrder,
        pitchingOrder,
        extraPitchers,
      })),
    };
  }

  function saveCurrentGame() {
    const snapshot = makeGameArchiveEntry(events, activeSavedGameId);
    setPreviousGames((prev) => {
      if (activeSavedGameId && prev.some((savedGame) => savedGame.id === activeSavedGameId)) {
        return prev.map((savedGame) => (savedGame.id === activeSavedGameId ? snapshot : savedGame));
      }
      return [snapshot, ...prev];
    });
    setActiveSavedGameId(snapshot.id);
    return snapshot;
  }

  function loadSavedGame(savedGame) {
    const setup = savedGame.savedSetup || {};
    setAwayTeam(setup.awayTeam || savedGame.awayTeam || "Away Team");
    setHomeTeam(setup.homeTeam || savedGame.homeTeam || "Home Team");
    setGameDate(setup.gameDate || savedGame.gameDate || "");
    setGameTime(setup.gameTime || savedGame.gameTime || "");
    setGameLocation(setup.gameLocation || savedGame.gameLocation || "");
    setGameSeasonYear(setup.gameSeasonYear || currentYearNumber());
    setGameSessionId(setup.gameSessionId || "");
    setUseLeagueSchedule(setup.useLeagueSchedule || false);
    setSelectedScheduledWeekId(setup.selectedScheduledWeekId || "");
    setSelectedScheduledGameId(setup.selectedScheduledGameId || "");
    setSelectedFieldId(setup.selectedFieldId || "");
    setGameInnings(Math.max(1, Number(setup.gameInnings) || 4));
    setSetupLeagueId(setup.setupLeagueId || "custom");
    setLeagueGameMode(setup.isLeagueExhibition ? "exhibition" : "official");
    setAwayLeagueTeamId(setup.awayLeagueTeamId || "");
    setHomeLeagueTeamId(setup.homeLeagueTeamId || "");
    setPowerPlaysEnabled(setup.powerPlaysEnabled ?? true);
    setPowerPlayLimitType(setup.powerPlayLimitType || "per_inning");
    setPowerPlayLimitAmount(setup.powerPlayLimitAmount ?? 1);
    setWhammysEnabled(setup.whammysEnabled ?? true);
    setPudwhackerEnabled(setup.pudwhackerEnabled ?? false);
    setExtraRunnerRules(setup.extraRunnerRules || []);
    setGhostRunnersCountAsRbi(setup.ghostRunnersCountAsRbi ?? true);
    setRunRuleEnabled(setup.runRuleEnabled ?? false);
    setRunRuleRuns(setup.runRuleRuns ?? 8);
    setRunRuleBeforeFourthOnly(setup.runRuleBeforeFourthOnly ?? false);
    setWalkRunRuleCountsAsHr(setup.walkRunRuleCountsAsHr ?? true);
    setUseLeagueDefaultRules(setup.useLeagueDefaultRules ?? true);
    setTeamPlayers(setup.teamPlayers || savedGame.teamPlayers || defaultPlayers);
    setSubPlayers(setup.subPlayers || { away: {}, home: {} });
    setSubSlots(setup.subSlots || { away: {}, home: {} });
    setBattingOrder(setup.battingOrder || savedGame.teamPlayers || defaultPlayers);
    setPitchingOrder(setup.pitchingOrder || savedGame.teamPlayers || defaultPlayers);
    setExtraPitchers(setup.extraPitchers || { away: {}, home: {} });
    setEvents(savedGame.events || []);
    setActiveSavedGameId(savedGame.id);
    setGameStarted(true);
    setSetupEditingDuringGame(false);
    const lastEventId = savedGame.events?.[savedGame.events.length - 1]?.id || null;
    setArchivedFinalEventId(savedGame.status === "final" ? lastEventId : null);
    setSelectedModifier(null);
    setRepeatBatter(false);
    setEndHalf(false);
    setManualMode(false);
    setManualRuns(0);
    setManualRbi(0);
    setNote("");
    setActivePage("score");
  }

  function startNewGame() {
    const lastEventId = events[events.length - 1]?.id || null;
    if (events.length > 0 && !(game.status === "final" && archivedFinalEventId === lastEventId)) {
      saveCurrentGame();
    }
    clearCurrentGame();
    setGameStarted(false);
    setSetupEditingDuringGame(false);
    setSavedSetupSignature("");
    setupSignatureInitializedRef.current = false;
    setArchivedFinalEventId(null);
    setActiveSavedGameId(null);
    setActivePage("setup");
  }

  useEffect(() => {
    const lastEventId = events[events.length - 1]?.id || null;
    if (game.status === "final" && events.length > 0 && lastEventId && archivedFinalEventId !== lastEventId) {
      const snapshot = makeGameArchiveEntry(events, activeSavedGameId);
      setPreviousGames((prev) => {
        if (activeSavedGameId && prev.some((savedGame) => savedGame.id === activeSavedGameId)) {
          return prev.map((savedGame) => (savedGame.id === activeSavedGameId ? snapshot : savedGame));
        }
        return [snapshot, ...prev];
      });
      setActiveSavedGameId(snapshot.id);
      setArchivedFinalEventId(lastEventId);
    }
  }, [game.status, events.length, archivedFinalEventId, activeSavedGameId]);

  function startGameFromSetup() {
    setSetupAttempted(true);
    if (!setupComplete) return;
    setGameStarted(true);
    setSetupEditingDuringGame(false);
    setActivePage("score");
  }

  function goToScorePage() {
    if ((activePage === "league" || activePage === "rules" || activePage === "fields") && !confirmLeagueDraftExit()) return;
    setSetupAttempted(true);
    if (gameStarted || events.length > 0 || activeSavedGameId || game.status === "final") setActivePage("score");
    else goToPage("setup");
  }

  function openFieldRuleConfirm(rule) {
    if (!rule || game.status === "final") return;
    setPendingFieldRule(rule);
  }

  function approvePendingFieldRule() {
    if (!pendingFieldRule) return;
    applyFieldRule(pendingFieldRule);
    setPendingFieldRule(null);
  }

  function endHalfInning() {
    const event = { id: newId(), type: "end_half", inning: game.inning, half: game.half, createdAt: new Date().toLocaleTimeString() };
    const nextEvents = [...events, event];
    setEvents(nextEvents);
    maybeShowEndOfInningNotification(nextEvents, game, game.inning, game.half);
  }

  function finalizeGame() {
    setEvents((prev) => [...prev, { id: newId(), type: "finalize", inning: game.inning, half: game.half, createdAt: new Date().toLocaleTimeString() }]);
  }

  function exportCsv() {
    const rows = [];
    rows.push(makeCsvRow(["Game Summary"]));
    rows.push(makeCsvRow(["Date", gameDate]));
    rows.push(makeCsvRow(["Time", gameTime]));
    rows.push(makeCsvRow(["Location", gameLocation]));
    rows.push(makeCsvRow(["Away Team", awayTeam]));
    rows.push(makeCsvRow(["Home Team", homeTeam]));
    rows.push(makeCsvRow(["Score", `${awayTeam} ${game.awayScore}, ${homeTeam} ${game.homeScore}`]));
    rows.push("");

    rows.push(makeCsvRow(["Line Score"]));
    rows.push(makeCsvRow(["Team", ...lineScore.inningNumbers, "R", "H"]));
    rows.push(makeCsvRow([awayTeam, ...lineScore.awayRunsByInning, lineScore.awayRunsTotal, lineScore.awayHits]));
    rows.push(makeCsvRow([homeTeam, ...lineScore.homeRunsByInning, lineScore.homeRunsTotal, lineScore.homeHits]));
    rows.push("");

    rows.push(makeCsvRow(["Team Players"]));
    rows.push(makeCsvRow(["Team", "Player", "Sub"]));
    ["away", "home"].forEach((teamKey) => {
      teamPlayers[teamKey].forEach((player) => rows.push(makeCsvRow([teamKey === "away" ? awayTeam : homeTeam, player, subPlayers[teamKey]?.[player] ? "Yes" : "No"])));
    });
    rows.push("");

    rows.push(makeCsvRow(["Batting Stats"]));
    rows.push(makeCsvRow(["Player", "GP", "PA", "AB", "Runs", "RBI", "Hits", "2B", "3B", "HR", "BB", "SO", "LOB", "AVG", "OBP", "SLG", "OPS", "HR-PA", "SO-PA"]));
    Object.entries(game.stats).forEach(([player, stat]) => rows.push(makeCsvRow([player, stat.GP || 1, stat.PA || 0, stat.AB || 0, stat.R || 0, stat.RBI || 0, stat.H || 0, stat.D2 || 0, stat.D3 || 0, stat.HR || 0, stat.BB || 0, stat.K || 0, stat.LOB || 0, average(stat.H || 0, stat.AB || 0), obp(stat), slg(stat), ops(stat), hrPerPa(stat), soPerPa(stat)])));
    rows.push("");

    rows.push(makeCsvRow(["Pitching Stats"]));
    rows.push(makeCsvRow(["Pitcher", "GP", "IP", "HA", "BB", "HRA", "R", "UER", "ER", "ERA", "WHIP", "K:BB", "LOB%"]));
    Object.entries(game.pitchingStats).forEach(([player, stat]) => rows.push(makeCsvRow([player, stat.GP || 1, formatInningsPitched(stat.OUTS || 0), stat.H || 0, stat.BB || 0, stat.HR || 0, stat.R || 0, stat.UER || 0, stat.ER ?? stat.R ?? 0, era(stat), whip(stat), kToBb(stat), pitcherLobPercent(stat)])));
    rows.push("");

    rows.push(makeCsvRow(["Power Play / Whammy Splits"]));
    rows.push(makeCsvRow(["Player", "Sub", "PA", "AB", "H", "AVG", "BB", "K", "R", "HR", "RBI", "Whammy"]));
    taggedHittingSplits.forEach((stat) => rows.push(makeCsvRow([stat.player, currentSubIndex[stat.player] ? "Yes" : "No", stat.PA, stat.AB, stat.H, average(stat.H, stat.AB), stat.BB, stat.K, stat.R, stat.HR, stat.RBI, stat.WHAMMY])));
    rows.push("");

    rows.push(makeCsvRow(["Pudwhacker Splits"]));
    rows.push(makeCsvRow(["Player", "Sub", "PA", "AB", "H", "AVG", "BB", "K", "R", "HR", "RBI", "Pudwhacker"]));
    pudwhackerSplits.forEach((stat) => rows.push(makeCsvRow([stat.player, currentSubIndex[stat.player] ? "Yes" : "No", stat.PA, stat.AB, stat.H, average(stat.H, stat.AB), stat.BB, stat.K, stat.R, stat.HR, stat.RBI, stat.PUDWHACKER])));
    rows.push("");

    rows.push(makeCsvRow(["Event Log"]));
    rows.push(makeCsvRow(["#", "Type", "Inning", "Team", "Batter", "Pitcher", "Result", "Tag", "Runs", "RBI", "Outs", "Note", "Time"]));
    events.forEach((event, index) => {
      rows.push(makeCsvRow([index + 1, event.type, event.inning ? `${event.half === "top" ? "Top" : "Bottom"} ${event.inning}` : "", event.team || "", event.batter || "", event.pitcher || "", event.result || "", modifierLabel(event.modifier), event.runs ?? "", event.rbi ?? "", event.outs ?? "", event.note || "", event.createdAt || ""]));
    });

    const safeName = `${awayTeam}-vs-${homeTeam}`.replace(/[^a-z0-9-_]+/gi, "-").replace(/-+/g, "-");
    downloadTextFile(`${safeName || "wiffle-game"}-results.csv`, rows.join("\n"), "text/csv;charset=utf-8");
  }

  function printPdfReport() {
    const teamDisplay = (teamKey) => (teamKey === "away" ? awayTeam : homeTeam);
    const playerRows = ["away", "home"].flatMap((teamKey) => teamPlayers[teamKey].map((player) => `<tr><td>${escapeHtml(teamDisplay(teamKey))}</td><td>${escapeHtml(player)}</td><td>${subPlayers[teamKey]?.[player] ? "Yes" : "No"}</td></tr>`)).join("");
    const battingRows = Object.entries(game.stats).map(([player, stat]) => `<tr><td>${escapeHtml(player)}</td><td>${stat.GP || 1}</td><td>${stat.PA || 0}</td><td>${stat.AB || 0}</td><td>${stat.R || 0}</td><td>${stat.RBI || 0}</td><td>${stat.H || 0}</td><td>${stat.D2 || 0}</td><td>${stat.D3 || 0}</td><td>${stat.HR || 0}</td><td>${stat.BB || 0}</td><td>${stat.K || 0}</td><td>${stat.LOB || 0}</td><td>${average(stat.H || 0, stat.AB || 0)}</td><td>${obp(stat)}</td><td>${slg(stat)}</td><td>${ops(stat)}</td><td>${hrPerPa(stat)}</td><td>${soPerPa(stat)}</td></tr>`).join("");
    const pitchingRows = Object.entries(game.pitchingStats).map(([player, stat]) => `<tr><td>${escapeHtml(player)}</td><td>${stat.GP || 1}</td><td>${formatInningsPitched(stat.OUTS || 0)}</td><td>${stat.H || 0}</td><td>${stat.BB || 0}</td><td>${stat.HR || 0}</td><td>${stat.R || 0}</td><td>${stat.UER || 0}</td><td>${stat.ER ?? stat.R ?? 0}</td><td>${era(stat)}</td><td>${whip(stat)}</td><td>${kToBb(stat)}</td><td>${pitcherLobPercent(stat)}</td></tr>`).join("");
    const splitRows = taggedHittingSplits.map((stat) => `<tr><td>${escapeHtml(stat.player)}</td><td>${stat.PA}</td><td>${stat.AB}</td><td>${stat.H}</td><td>${average(stat.H, stat.AB)}</td><td>${stat.BB}</td><td>${stat.K}</td><td>${stat.R}</td><td>${stat.HR}</td><td>${stat.RBI}</td><td>${stat.WHAMMY}</td></tr>`).join("");
    const pudwhackerRows = pudwhackerSplits.map((stat) => `<tr><td>${escapeHtml(stat.player)}</td><td>${stat.PA}</td><td>${stat.AB}</td><td>${stat.H}</td><td>${average(stat.H, stat.AB)}</td><td>${stat.BB}</td><td>${stat.K}</td><td>${stat.R}</td><td>${stat.HR}</td><td>${stat.RBI}</td><td>${stat.PUDWHACKER}</td></tr>`).join("");
    const eventRows = events.map((event, index) => `<tr><td>${index + 1}</td><td>${escapeHtml(event.type)}</td><td>${event.inning ? `${event.half === "top" ? "Top" : "Bottom"} ${event.inning}` : ""}</td><td>${escapeHtml(event.batter || "")}</td><td>${escapeHtml(event.pitcher || "")}</td><td>${escapeHtml(event.result || "")}</td><td>${escapeHtml(modifierLabel(event.modifier))}</td><td>${event.runs ?? ""}</td><td>${event.rbi ?? ""}</td><td>${event.outs ?? ""}</td><td>${escapeHtml(event.note || "")}</td></tr>`).join("");

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <html><head><title>Wiffle Game Report</title><style>
      body{font-family:Arial,sans-serif;color:#111827;padding:24px} table{width:100%;border-collapse:collapse;margin:12px 0 24px;font-size:12px} th,td{border:1px solid #d1d5db;padding:6px;text-align:left} th{background:#f3f4f6}.score{font-size:28px;font-weight:800;margin:8px 0 16px}
      </style></head><body>
      <h1>Wiffle Game Report</h1>
      <div>${escapeHtml(gameDate || "No date")} ${escapeHtml(gameTime || "")} · ${escapeHtml(gameLocation || "No location")}</div>
      <div class="score">${escapeHtml(awayTeam)} ${game.awayScore} — ${escapeHtml(homeTeam)} ${game.homeScore}</div>
      <h2>Line Score</h2><table><thead><tr><th>Team</th>${lineScore.inningNumbers.map((inning) => `<th>${inning}</th>`).join("")}<th>R</th><th>H</th></tr></thead><tbody><tr><td>${escapeHtml(awayTeam)}</td>${lineScore.awayRunsByInning.map((run) => `<td>${run}</td>`).join("")}<td>${lineScore.awayRunsTotal}</td><td>${lineScore.awayHits}</td></tr><tr><td>${escapeHtml(homeTeam)}</td>${lineScore.homeRunsByInning.map((run) => `<td>${run}</td>`).join("")}<td>${lineScore.homeRunsTotal}</td><td>${lineScore.homeHits}</td></tr></tbody></table>
      <h2>Team Players</h2><table><thead><tr><th>Team</th><th>Player</th><th>Sub</th></tr></thead><tbody>${playerRows}</tbody></table>
      <h2>Batting Stats</h2><table><thead><tr><th>Player</th><th>GP</th><th>PA</th><th>AB</th><th>Runs</th><th>RBI</th><th>Hits</th><th>2B</th><th>3B</th><th>HR</th><th>BB</th><th>SO</th><th>LOB</th><th>AVG</th><th>OBP</th><th>SLG</th><th>OPS</th><th>HR-PA</th><th>SO-PA</th></tr></thead><tbody>${battingRows}</tbody></table>
      <h2>Pitching Stats</h2><table><thead><tr><th>Pitcher</th><th>GP</th><th>IP</th><th>HA</th><th>BB</th><th>HRA</th><th>R</th><th>UER</th><th>ER</th><th>ERA</th><th>WHIP</th><th>K:BB</th><th>LOB%</th></tr></thead><tbody>${pitchingRows}</tbody></table>
      <h2>Power Play / Whammy Splits</h2><table><thead><tr><th>Player</th><th>PA</th><th>AB</th><th>H</th><th>AVG</th><th>BB</th><th>K</th><th>R</th><th>HR</th><th>RBI</th><th>Whammy</th></tr></thead><tbody>${splitRows}</tbody></table>
      <h2>Pudwhacker Splits</h2><table><thead><tr><th>Player</th><th>PA</th><th>AB</th><th>H</th><th>AVG</th><th>BB</th><th>K</th><th>R</th><th>HR</th><th>RBI</th><th>Pudwhacker</th></tr></thead><tbody>${pudwhackerRows}</tbody></table>
      <h2>Event Log</h2><table><thead><tr><th>#</th><th>Type</th><th>Inning</th><th>Batter</th><th>Pitcher</th><th>Result</th><th>Tag</th><th>Runs</th><th>RBI</th><th>Outs</th><th>Note</th></tr></thead><tbody>${eventRows}</tbody></table>
      <script>window.onload=()=>window.print();</script>
      </body></html>
    `);
    printWindow.document.close();
  }

  const previewOutcome = calculateAutoAdvance(game.bases, currentBatter, resultButtons[0]);

  return (
    <div className="min-h-screen bg-slate-100 p-2 text-slate-900 sm:p-4">
      <div className="mx-auto max-w-7xl space-y-3 sm:space-y-4">
        <Card>
          <div className="p-3 sm:p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h1 className="text-xl font-bold sm:text-2xl">Wiffle Scoring Prototype</h1>
                <p className="hidden text-sm text-slate-500 sm:block">Live scoring, line score, named baserunners, pitching order, and starter stats.</p>
              </div>
              <div className="mobile-nav flex w-full max-w-full items-center gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
                <Button variant={activePage === "score" ? "primary" : "outline"} onClick={goToScorePage} disabled={!gameStarted && events.length === 0 && !activeSavedGameId}>Score Game</Button>
                <Button variant={activePage === "setup" ? "primary" : "outline"} onClick={() => goToPage("setup")}>Setup</Button>
                <Button variant={activePage === "league" ? "primary" : "outline"} onClick={() => goToPage("league")}>League</Button>
                <Button variant={activePage === "players" ? "primary" : "outline"} onClick={() => goToPage("players")}>Players</Button>
                <Button variant={activePage === "fields" ? "primary" : "outline"} onClick={() => goToPage("fields")}>Fields</Button>
                <Button variant={activePage === "schedule" ? "primary" : "outline"} onClick={() => goToPage("schedule")}>Schedule</Button>
                <Button variant={activePage === "draft" ? "primary" : "outline"} onClick={() => goToPage("draft")}>Draft</Button>
                <Button variant={activePage === "standings" ? "primary" : "outline"} onClick={() => goToPage("standings")}>Standings</Button>
                <Button variant={activePage === "leaders" ? "primary" : "outline"} onClick={() => goToPage("leaders")}>Leaders</Button>
                <Button variant={activePage === "stats" ? "primary" : "outline"} onClick={() => goToPage("stats")}>Stats & Log</Button>
                <Button variant={activePage === "history" ? "primary" : "outline"} onClick={() => goToPage("history")}>Previous Games</Button>
                <Button variant={activePage === "rules" ? "primary" : "outline"} onClick={() => goToPage("rules")}>Rule Book</Button>
                <span className="shrink-0 rounded-full bg-slate-900 px-3 py-1 text-xs font-bold uppercase text-white">{game.status}</span>
              </div>
              {!gameStarted && events.length === 0 && !activeSavedGameId && (
                <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  <div className="font-bold">Score Game is locked until Start Game is selected.</div>
                  <div className="mt-1">{setupComplete ? "Go to Setup and click Start Game." : `Missing: ${setupErrors.join(" ")}`}</div>
                </div>
              )}
            </div>
          </div>
        </Card>

        {activePage === "setup" && (
          <div className="space-y-4">
            {finalGameAwaitingNewSetup ? (
              <Card>
                <div className="p-6 text-center">
                  <div className="text-xs font-black uppercase tracking-[0.3em] text-slate-500">Game Complete</div>
                  <h2 className="mt-2 text-3xl font-black">Set up a new game?</h2>
                  <p className="mx-auto mt-2 max-w-2xl text-sm font-semibold text-slate-600">
                    The previous game is final and has been saved to Previous Games. Start a new setup to clear the final game from the Score Game page and choose new teams, rules, rosters, and orders.
                  </p>
                  <div className="mt-5 flex justify-center">
                    <Button variant="primary" onClick={startNewGame}>Set Up New Game</Button>
                  </div>
                </div>
              </Card>
            ) : (
              <>
                <Card>
                  <div className="p-5">
                    <h2 className="mb-3 text-xl font-bold">Game Setup</h2>
                <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <label className="text-xs font-semibold uppercase text-slate-500">League</label>
                    <select
                      className="mt-1 w-full rounded-xl border px-3 py-2"
                      value={isCustomGame ? "custom" : setupLeague?.id || "custom"}
                      onChange={(event) => handleSetupLeagueChange(event.target.value)}
                    >
                      <option value="custom">Custom Game</option>
                      {leagues.map((league) => <option key={league.id} value={league.id}>{league.name}</option>)}
                    </select>
                  </div>
                  {!isCustomGame && (
                    <div className="lg:col-span-2 rounded-xl border bg-slate-50 p-3">
                      <div className="mb-2 text-sm font-black">League Game Type</div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <label className="flex items-start gap-2 rounded-xl border bg-white p-3 text-sm font-semibold">
                          <input type="radio" name="league-game-mode" checked={leagueGameMode !== "exhibition"} onChange={() => { setLeagueGameMode("official"); setUseLeagueSchedule(true); }} />
                          <span><span className="block font-black">Official scheduled league game</span><span className="block text-xs font-normal text-slate-500">Requires a scheduled game and counts toward official stats and standings.</span></span>
                        </label>
                        <label className="flex items-start gap-2 rounded-xl border bg-white p-3 text-sm font-semibold">
                          <input type="radio" name="league-game-mode" checked={leagueGameMode === "exhibition"} onChange={() => { setLeagueGameMode("exhibition"); setUseLeagueSchedule(false); setSelectedScheduledWeekId(""); setSelectedScheduledGameId(""); setGameSessionId(""); setAwayLeagueTeamId(""); setHomeLeagueTeamId(""); setAwayTeam("Away Team"); setHomeTeam("Home Team"); setTeamPlayers(emptyGameRosters); setBattingOrder(emptyGameRosters); setPitchingOrder(emptyGameRosters); setSubPlayers({ away: {}, home: {} }); setSubSlots({ away: {}, home: {} }); setExtraPitchers({ away: {}, home: {} }); setSelectedFieldId(""); setGameLocation(""); }} />
                          <span><span className="block font-black">League exhibition game</span><span className="block text-xs font-normal text-slate-500">Use league players and rules, customize rosters, and save stats only under Exhibition.</span></span>
                        </label>
                      </div>
                      {isOfficialLeagueGame && !hasAnyUsableScheduledGamesForSetup && <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">No scheduled games are available for this league/session. Create a schedule game first, or switch to League Exhibition.</p>}
                      {isLeagueExhibitionGame && <p className="mt-3 rounded-xl border border-purple-200 bg-purple-50 p-3 text-sm font-semibold text-purple-800">League Exhibition is on. This game will not affect official league stats or standings.</p>}
                    </div>
                  )}
                  {!isCustomGame && !isLeagueExhibitionGame && setupCurrentSeason?.sessionsEnabled && (
                    <div>
                      <label className="text-xs font-semibold uppercase text-slate-500">Session</label>
                      <select className="mt-1 w-full rounded-xl border px-3 py-2" value={gameSessionId || setupCurrentSeason.currentSessionId || setupSessionOptions[0]?.id || ""} onChange={(event) => { setGameSessionId(event.target.value); setAwayLeagueTeamId(""); setHomeLeagueTeamId(""); setAwayTeam("Away Team"); setHomeTeam("Home Team"); setTeamPlayers(defaultPlayers); setBattingOrder(defaultPlayers); setPitchingOrder(defaultPlayers); }}>
                        {setupSessionOptions.map((session) => <option key={session.id} value={session.id}>{session.name}</option>)}
                      </select>
                      <p className="mt-1 text-xs text-slate-500">This is required when sessions are enabled for the selected season.</p>
                    </div>
                  )}
                  <div>
                    <label className="text-xs font-semibold uppercase text-slate-500">Away Team</label>
                    {(isCustomGame || isLeagueExhibitionGame) ? (
                      <input className="mt-1 w-full rounded-xl border px-3 py-2" value={awayTeam} onChange={(event) => { setAwayTeam(event.target.value); if (isLeagueExhibitionGame) setAwayLeagueTeamId(""); }} placeholder="Away team name" />
                    ) : (
                      <select
                        className="mt-1 w-full rounded-xl border px-3 py-2"
                        value={awayLeagueTeamId}
                        onChange={(event) => applyLeagueTeamToGameSlot("away", event.target.value)}
                      >
                        <option value="">Select away team</option>
                        {(setupLeague?.teams || []).map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
                      </select>
                    )}
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase text-slate-500">Home Team</label>
                    {(isCustomGame || isLeagueExhibitionGame) ? (
                      <input className="mt-1 w-full rounded-xl border px-3 py-2" value={homeTeam} onChange={(event) => { setHomeTeam(event.target.value); if (isLeagueExhibitionGame) setHomeLeagueTeamId(""); }} placeholder="Home team name" />
                    ) : (
                      <select
                        className="mt-1 w-full rounded-xl border px-3 py-2"
                        value={homeLeagueTeamId}
                        onChange={(event) => applyLeagueTeamToGameSlot("home", event.target.value)}
                      >
                        <option value="">Select home team</option>
                        {(setupLeague?.teams || []).map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
                      </select>
                    )}
                  </div>
                </div>
                {!isCustomGame && isOfficialLeagueGame && hasAnyUsableScheduledGamesForSetup && (
                  <div className="mb-4 rounded-xl border bg-slate-50 p-3">
                    <label className="flex items-center gap-2 text-sm font-semibold">
                      <input type="checkbox" checked={useLeagueSchedule} onChange={(event) => { setUseLeagueSchedule(event.target.checked); if (!event.target.checked) { setSelectedScheduledWeekId(""); setSelectedScheduledGameId(""); } }} />
                      Use League Schedule
                    </label>
                    {useLeagueSchedule && (
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <div>
                          <label className="text-xs font-semibold uppercase text-slate-500">Scheduled Week</label>
                          <select className="mt-1 w-full rounded-xl border px-3 py-2 text-sm font-semibold" value={selectedScheduledWeekId} onChange={(event) => { setSelectedScheduledWeekId(event.target.value); setSelectedScheduledGameId(""); }}>
                            <option value="">Select scheduled week</option>
                            {scheduledWeeksForSetup.map((week) => {
                              const field = setupLeague?.fields?.find((item) => item.id === week.fieldId)?.name || "No field";
                              return <option key={week.id} value={week.id}>{week.name} · {week.date || "No date"} · {field}</option>;
                            })}
                          </select>
                          {selectedScheduledWeek && <p className="mt-1 text-xs text-slate-500">Date: {selectedScheduledWeek.date || "No date"}</p>}
                        </div>
                        <div>
                          <label className="text-xs font-semibold uppercase text-slate-500">Scheduled Game</label>
                          <select className="mt-1 w-full rounded-xl border px-3 py-2 text-sm font-semibold" value={selectedScheduledGameId} disabled={!selectedScheduledWeekId} onChange={(event) => applyScheduledGameToSetup(event.target.value)}>
                            <option value="">Select scheduled game</option>
                            {scheduledGamesForSetup.map((scheduledGame) => {
                              const away = setupLeague?.teams?.find((team) => team.id === scheduledGame.awayTeamId)?.name || "Away";
                              const home = setupLeague?.teams?.find((team) => team.id === scheduledGame.homeTeamId)?.name || "Home";
                              return <option key={scheduledGame.id} value={scheduledGame.id}>{scheduledGame.name} · {away} vs {home} · {scheduledGame.time || "No time"}</option>;
                            })}
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <p className="mb-4 text-xs text-slate-500">{isCustomGame ? "Custom Game lets you type team names and players manually below." : isLeagueExhibitionGame ? "League Exhibition lets you use league players and rules without affecting official league stats or standings." : "Official league games must be selected from the schedule and will count toward standings and official stats."}</p>
                {setupAttempted && !setupComplete && (
                  <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    <div className="font-bold">Complete setup before starting the game:</div>
                    <ul className="mt-2 list-disc pl-5">
                      {setupErrors.map((error) => <li key={error}>{error}</li>)}
                    </ul>
                  </div>
                )}
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <label className="text-xs font-semibold uppercase text-slate-500">Date</label>
                    <input type="date" className="mt-1 w-full rounded-xl border px-3 py-2" value={gameDate} onChange={(event) => setGameDate(event.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase text-slate-500">Time</label>
                    <input type="time" className="mt-1 w-full rounded-xl border px-3 py-2" value={gameTime} onChange={(event) => setGameTime(event.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase text-slate-500">Field / Location</label>
                    {isCustomGame ? (
                      <input className="mt-1 w-full rounded-xl border px-3 py-2" value={gameLocation} onChange={(event) => setGameLocation(event.target.value)} placeholder="Optional field, park, or address" />
                    ) : (
                      <select className="mt-1 w-full rounded-xl border px-3 py-2" value={selectedFieldId} onChange={(event) => { if (event.target.value) applyFieldToGame(event.target.value); else { setSelectedFieldId(""); setGameLocation(""); } }}>
                        <option value="">Select field</option>
                        {setupFieldOptions.map((field) => <option key={field.id} value={field.id}>{field.name}</option>)}
                      </select>
                    )}
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap justify-end gap-2">
                  {gameStarted && (
                    <Button variant={setupEditingDuringGame ? "secondary" : "outline"} onClick={() => setSetupEditingDuringGame((value) => !value)}>
                      {setupEditingDuringGame ? "View Setup Summary" : "Edit Teams/Rules"}
                    </Button>
                  )}
                  {unsavedSetupChanges && <Button variant="outline" onClick={saveSetupChanges}>Save Setup Changes</Button>}
                  {gameStarted ? (
                    <Button variant="primary" onClick={resumeGameFromSetup} disabled={!setupCanResumeGame}>Resume Game</Button>
                  ) : (
                    <Button variant="primary" onClick={startGameFromSetup} disabled={unsavedSetupChanges}>Start Game</Button>
                  )}
                </div>
                {gameStarted && unsavedSetupChanges && <p className="mt-2 text-right text-xs font-bold text-amber-700">Save setup changes before resuming the game.</p>}
              </div>
            </Card>
            {setupEditingLocked && (
              <Card>
                <div className="p-5">
                  <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h2 className="text-xl font-bold">Game Setup Summary</h2>
                      <p className="text-sm text-slate-500">Game rules, rosters, batting order, and pitching order are locked while the game is active.</p>
                    </div>
                    <Button variant="outline" onClick={() => setSetupEditingDuringGame(true)}>Edit Teams/Rules</Button>
                  </div>
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-2xl border bg-slate-50 p-4">
                      <h3 className="mb-2 text-sm font-black uppercase text-slate-500">Game Rules</h3>
                      <div className="space-y-1 text-sm font-semibold text-slate-700">
                        <div>Innings: {gameInnings}</div>
                        <div>Power Plays: {powerPlaysEnabled ? `${powerPlayLimitAmount} ${powerPlayLimitType === "per_game" ? "per game" : "per inning"}` : "Off"}</div>
                        <div>Whammys: {powerPlaysEnabled && whammysEnabled ? "On" : "Off"}</div>
                        <div>Pudwhacker: {pudwhackerEnabled ? "On" : "Off"}</div>
                        <div>Run Rule: {runRuleEnabled ? `${runRuleRuns} run(s)${runRuleBeforeFourthOnly ? ` before the ${gameInnings}${getOrdinalSuffix(gameInnings)} inning` : ""}` : "Off"}</div>
                        <div>Extra Inning Rules: {extraRunnerRules.length > 0 ? `${extraRunnerRules.length} configured` : "None"}</div>
                      </div>
                    </div>
                    <div className="rounded-2xl border bg-slate-50 p-4">
                      <h3 className="mb-2 text-sm font-black uppercase text-slate-500">Teams</h3>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <div className="font-black">{awayTeam}</div>
                          <div className="mt-1 text-xs font-bold uppercase text-slate-500">Players</div>
                          <ol className="mt-1 list-decimal pl-5 text-sm text-slate-700">{cleanRoster(teamPlayers.away).map((player) => <li key={`summary-away-player-${player}`}>{formatPlayerName(player, subPlayers.away)}</li>)}</ol>
                        </div>
                        <div>
                          <div className="font-black">{homeTeam}</div>
                          <div className="mt-1 text-xs font-bold uppercase text-slate-500">Players</div>
                          <ol className="mt-1 list-decimal pl-5 text-sm text-slate-700">{cleanRoster(teamPlayers.home).map((player) => <li key={`summary-home-player-${player}`}>{formatPlayerName(player, subPlayers.home)}</li>)}</ol>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-2xl border bg-slate-50 p-4">
                      <h3 className="mb-2 text-sm font-black uppercase text-slate-500">Batting Order</h3>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <ol className="list-decimal pl-5 text-sm text-slate-700">{cleanRoster(battingOrder.away).map((player) => <li key={`summary-away-bat-${player}`}>{formatPlayerName(player, subPlayers.away)}</li>)}</ol>
                        <ol className="list-decimal pl-5 text-sm text-slate-700">{cleanRoster(battingOrder.home).map((player) => <li key={`summary-home-bat-${player}`}>{formatPlayerName(player, subPlayers.home)}</li>)}</ol>
                      </div>
                    </div>
                    <div className="rounded-2xl border bg-slate-50 p-4">
                      <h3 className="mb-2 text-sm font-black uppercase text-slate-500">Pitching Order</h3>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <ol className="list-decimal pl-5 text-sm text-slate-700">{cleanRoster(pitchingOrder.away).map((player) => <li key={`summary-away-pitch-${player}`}>{formatPlayerName(player, subPlayers.away)}</li>)}</ol>
                        <ol className="list-decimal pl-5 text-sm text-slate-700">{cleanRoster(pitchingOrder.home).map((player) => <li key={`summary-home-pitch-${player}`}>{formatPlayerName(player, subPlayers.home)}</li>)}</ol>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            )}
            {!setupEditingLocked && (
            <>
            {gameStarted && setupEditingDuringGame && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">
                Editing active game setup. Save all changes before resuming the game.
              </div>
            )}
            <Card>
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5">
                  <div>
                    <h2 className="text-xl font-bold">Game Rules</h2>
                    <p className="text-sm text-slate-500">Power Plays, Whammys, Pudwhacker, run rule, and extra-inning ghost runners.</p>
                    {unsavedGameRules && <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-900">Unsaved game rule changes. Save Game Rules before starting the game.</p>}
                    {!isCustomGame && (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${useLeagueDefaultRules ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>
                          {useLeagueDefaultRules ? "Using League Defaults" : "Custom Game Rules"}
                        </span>
                        <label className="flex items-center gap-2 rounded-full border bg-white px-3 py-1 text-xs font-semibold text-slate-600" onClick={(event) => event.stopPropagation()}>
                          <input type="checkbox" checked={useLeagueDefaultRules} onChange={(event) => handleUseLeagueDefaultRules(event.target.checked)} />
                          Use league default game rules
                        </label>
                      </div>
                    )}
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase text-slate-500 group-open:hidden">Open</span>
                  <span className="hidden rounded-full bg-slate-900 px-3 py-1 text-xs font-bold uppercase text-white group-open:inline-block">Close</span>
                </summary>

                <div className="border-t p-5 pt-4">
                  {unsavedGameRules && <div className="mb-4 flex justify-end"><Button variant="primary" onClick={saveSetupChanges}>Save Game Rules</Button></div>}
                  {!isCustomGame && (
                    <div className="mb-4 rounded-xl border bg-slate-50 p-3">
                      <label className="flex items-center gap-2 text-sm font-semibold">
                        <input type="checkbox" checked={useLeagueDefaultRules} onChange={(event) => handleUseLeagueDefaultRules(event.target.checked)} />
                        Use league default game rules
                      </label>
                      <p className="mt-1 text-xs text-slate-500">Uncheck this to customize rules only for this game. This same option is visible above even when Game Rules is closed.</p>
                    </div>
                  )}
                  <div className="mb-3 rounded-xl border bg-slate-50 p-3">
                    <label className="text-xs font-semibold uppercase text-slate-500">Game Length</label>
                    <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
                      <span className="text-sm font-semibold text-slate-700">Innings per game</span>
                      <input type="number" min="1" max="12" className="w-28 rounded-xl border px-3 py-2 text-sm font-semibold" value={gameInnings} disabled={gameRulesLocked} onChange={(event) => setGameInnings(Math.max(1, Number(event.target.value) || 1))} />
                    </div>
                    <p className="mt-1 text-xs text-slate-500">This controls when the game can become final and when extra-inning rules begin.</p>
                  </div>
                  <div className="grid gap-3 lg:grid-cols-3">
                    <div className="rounded-xl border bg-slate-50 p-3">
                      <label className="flex items-center gap-2 text-sm font-semibold">
                        <input type="checkbox" checked={powerPlaysEnabled} disabled={gameRulesLocked} onChange={(event) => { setPowerPlaysEnabled(event.target.checked); if (!event.target.checked) { setSelectedModifier(null); setWhammysEnabled(false); } }} />
                        Enable Power Plays
                      </label>
                      <p className="mt-1 text-xs text-slate-500">Turn this off to hide and disable Power Play controls for this game.</p>
                      {powerPlaysEnabled && (
                        <div className="mt-3 space-y-3">
                          <RuleLimitEditor
                            title="Power Play Limit"
                            limitType={powerPlayLimitType}
                            setLimitType={setPowerPlayLimitType}
                            limitAmount={powerPlayLimitAmount}
                            setLimitAmount={setPowerPlayLimitAmount}
                            disabled={gameRulesLocked}
                          />
                          <label className="flex items-center gap-2 rounded-lg border bg-white p-3 text-sm font-semibold">
                            <input type="checkbox" checked={whammysEnabled} disabled={gameRulesLocked} onChange={(event) => { setWhammysEnabled(event.target.checked); if (!event.target.checked && selectedModifier === "whammy") setSelectedModifier(null); }} />
                            Enable Whammys
                          </label>
                          {whammysEnabled && <p className="text-xs text-slate-500">Whammy can only be used once per game which will take the place of 1 power play. A Whammy walk does not block the Power Play.</p>}
                        </div>
                      )}
                    </div>

                    <div className="rounded-xl border bg-slate-50 p-3">
                      <label className="flex items-center gap-2 text-sm font-semibold">
                        <input type="checkbox" checked={pudwhackerEnabled} disabled={gameRulesLocked} onChange={(event) => { setPudwhackerEnabled(event.target.checked); if (!event.target.checked && selectedModifier === "pudwhacker") setSelectedModifier(null); }} />
                        Enable Pudwhacker
                      </label>
                      <p className="mt-1 text-xs text-slate-500">Adds a Pudwhacker button to Current Matchup and tracks those plate appearances in a separate stat section. Pudwhacker can only be used once per game and only before the final inning.</p>
                    </div>

                    <div className="rounded-xl border bg-slate-50 p-3">
                      <label className="flex items-center gap-2 text-sm font-semibold">
                        <input type="checkbox" checked={runRuleEnabled} disabled={gameRulesLocked} onChange={(event) => setRunRuleEnabled(event.target.checked)} />
                        Enable inning run rule
                      </label>
                      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
                        <label className="text-xs font-semibold uppercase text-slate-500">Runs per half-inning</label>
                        <input
                          type="number"
                          min="1"
                          className="w-28 rounded-xl border px-3 py-2 text-sm font-semibold"
                          value={runRuleRuns}
                          disabled={!runRuleEnabled || gameRulesLocked}
                          onChange={(event) => setRunRuleRuns(Math.max(1, Number(event.target.value) || 1))}
                        />
                      </div>
                      <label className="mt-3 flex items-center gap-2 text-sm font-semibold">
                        <input type="checkbox" checked={runRuleBeforeFourthOnly} disabled={!runRuleEnabled || gameRulesLocked} onChange={(event) => setRunRuleBeforeFourthOnly(event.target.checked)} />
                        {`Run rule only applies before the ${gameInnings}${getOrdinalSuffix(gameInnings)} inning`}
                      </label>
                      <label className="mt-3 flex items-center gap-2 text-sm font-semibold">
                        <input type="checkbox" checked={walkRunRuleCountsAsHr} disabled={!runRuleEnabled || gameRulesLocked} onChange={(event) => setWalkRunRuleCountsAsHr(event.target.checked)} />
                        Walk that triggers run rule counts as HR
                      </label>
                      <p className="mt-1 text-xs text-slate-500">When enabled, a walk that reaches the run-rule number scores like a home run and ends the half-inning.</p>
                    </div>
                  </div>

                  <div className="mt-5 rounded-2xl border bg-white p-4">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <div>
                        <h3 className="text-lg font-bold">Extra Inning Ghost Runners</h3>
                        <p className="text-sm text-slate-500">Choose what bases are occupied to start extra innings. For a {gameInnings}-inning game, extra-inning rules can start in the {getFirstExtraInning(gameInnings)}{getOrdinalSuffix(getFirstExtraInning(gameInnings))} inning or later. Use “Same rest of game” to keep that setup for later innings until another rule overrides it.</p>
                      </div>
                      <Button variant="outline" onClick={addExtraRunnerRule} disabled={gameRulesLocked}>+ Add Rule</Button>
                    </div>

                    {extraRunnerRules.length === 0 ? (
                      <p className="rounded-xl border bg-slate-50 p-3 text-sm text-slate-500">No extra-inning runner rules yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {extraRunnerRules.map((rule) => (
                          <div key={rule.id} className="grid gap-2 rounded-xl border bg-slate-50 p-3 sm:grid-cols-[1fr_1.5fr_auto] sm:items-end">
                            <div>
                              <label className="text-xs font-semibold uppercase text-slate-500">Starting inning</label>
                              <input
                                type="number"
                                min={getFirstExtraInning(gameInnings)}
                                className="mt-1 w-full rounded-xl border px-3 py-2 text-sm font-semibold"
                                value={rule.startInning}
                                disabled={gameRulesLocked}
                                onChange={(event) => updateExtraRunnerRule(rule.id, "startInning", event.target.value)}
                              />
                            </div>
                            <div>
                              <label className="text-xs font-semibold uppercase text-slate-500">Bases to start inning</label>
                              <select
                                className="mt-1 w-full rounded-xl border px-3 py-2 text-sm font-semibold"
                                value={rule.bases}
                                disabled={gameRulesLocked}
                                onChange={(event) => updateExtraRunnerRule(rule.id, "bases", event.target.value)}
                              >
                                {extraBaseOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                              </select>
                            </div>
                            <div className="flex flex-col gap-2">
                              <label className="flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-xs font-semibold text-slate-600">
                                <input
                                  type="checkbox"
                                  checked={Boolean(rule.sameRestOfGame)}
                                  disabled={gameRulesLocked}
                                  onChange={(event) => updateExtraRunnerRule(rule.id, "sameRestOfGame", event.target.checked)}
                                />
                                Same rest of game
                              </label>

                              <Button variant="outline" onClick={() => removeExtraRunnerRule(rule.id)} disabled={gameRulesLocked}>Remove</Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="mt-3 rounded-xl border bg-slate-50 p-3">
                      <label className="flex items-center gap-2 text-sm font-semibold">
                        <input type="checkbox" checked={ghostRunnersCountAsRbi} disabled={gameRulesLocked} onChange={(event) => setGhostRunnersCountAsRbi(event.target.checked)} />
                        Ghost runners count as RBI
                      </label>
                      <p className="mt-1 text-xs text-slate-500">This applies to all extra-inning ghost-runner rules. If unchecked, those ghost runners can score runs without adding RBI to the batter.</p>
                    </div>
                    <p className="mt-3 text-xs text-slate-500">Runner names are pulled from the batting order: runner on 2nd uses the previous batter; bases loaded uses the previous three batters.</p>
                  </div>
                </div>
              </details>
            </Card>

            <Card>
              <div className="p-5">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-xl font-bold">Team Players</h2>
                  {unsavedTeamPlayers && <Button variant="primary" onClick={saveSetupChanges}>Save Team Players</Button>}
                </div>
                {unsavedTeamPlayers && <p className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-900">Unsaved team player changes. Save Team Players before starting the game.</p>}
                <div className="grid gap-3 md:grid-cols-2">
                  <TeamPlayerEditor teamKey="away" teamName={awayTeam} players={teamPlayers.away} subStatus={subPlayers.away} subSlots={subSlots.away} teamPlayersBySide={teamPlayers} subSlotsBySide={subSlots} knownSubPlayers={knownSubPlayers} leaguePlayerOptions={isLeagueExhibitionGame ? getLeaguePlayerOptions(setupLeague) : []} namesLocked={!isCustomGame && !isLeagueExhibitionGame} onRenamePlayer={renameTeamPlayer} onAddPlayer={addTeamPlayer} onRemovePlayer={removeTeamPlayer} onToggleSub={toggleSubPlayer} onSelectSubPlayer={selectSubPlayer} allPlayerRecords={allPlayerRecords} onStartInlinePlayerCreation={startInlinePlayerCreation} />
                  <TeamPlayerEditor teamKey="home" teamName={homeTeam} players={teamPlayers.home} subStatus={subPlayers.home} subSlots={subSlots.home} teamPlayersBySide={teamPlayers} subSlotsBySide={subSlots} knownSubPlayers={knownSubPlayers} leaguePlayerOptions={isLeagueExhibitionGame ? getLeaguePlayerOptions(setupLeague) : []} namesLocked={!isCustomGame && !isLeagueExhibitionGame} onRenamePlayer={renameTeamPlayer} onAddPlayer={addTeamPlayer} onRemovePlayer={removeTeamPlayer} onToggleSub={toggleSubPlayer} onSelectSubPlayer={selectSubPlayer} allPlayerRecords={allPlayerRecords} onStartInlinePlayerCreation={startInlinePlayerCreation} />
                </div>

                <p className="mt-3 text-xs text-slate-500">Add or rename players here. Batting and pitching orders below update automatically, so you only reorder them.</p>
              </div>
            </Card>

            {inlinePlayerCreationModalOpen && (
              <div className="fixed inset-0 z-50 bg-black bg-opacity-50">
                <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-lg font-bold">Add New Player</h3>
                    <button type="button" className="text-slate-400 hover:text-slate-600" onClick={closeInlinePlayerCreationModal}>×</button>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700">Name *</label>
                      <input
                        type="text"
                        className="mt-1 w-full rounded-lg border px-3 py-2"
                        value={inlinePlayerDraft?.name || ""}
                        onChange={(e) => updateInlinePlayerDraft("name", e.target.value)}
                        placeholder="Enter player name"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-slate-700">Bats</label>
                        <select
                          className="mt-1 w-full rounded-lg border px-3 py-2"
                          value={inlinePlayerDraft?.bats || "R"}
                          onChange={(e) => updateInlinePlayerDraft("bats", e.target.value)}
                        >
                          <option value="R">Right</option>
                          <option value="L">Left</option>
                          <option value="B">Both</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-700">Throws</label>
                        <select
                          className="mt-1 w-full rounded-lg border px-3 py-2"
                          value={inlinePlayerDraft?.pitches || "R"}
                          onChange={(e) => updateInlinePlayerDraft("pitches", e.target.value)}
                        >
                          <option value="R">Right</option>
                          <option value="L">Left</option>
                          <option value="B">Both</option>
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-slate-700">Height (feet)</label>
                        <input
                          type="number"
                          className="mt-1 w-full rounded-lg border px-3 py-2"
                          value={inlinePlayerDraft?.heightFeet || ""}
                          onChange={(e) => updateInlinePlayerDraft("heightFeet", e.target.value)}
                          placeholder="5"
                          min="1"
                          max="8"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-700">Height (inches)</label>
                        <input
                          type="number"
                          className="mt-1 w-full rounded-lg border px-3 py-2"
                          value={inlinePlayerDraft?.heightInches || ""}
                          onChange={(e) => updateInlinePlayerDraft("heightInches", e.target.value)}
                          placeholder="10"
                          min="0"
                          max="11"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700">Phone</label>
                      <input
                        type="tel"
                        className="mt-1 w-full rounded-lg border px-3 py-2"
                        value={inlinePlayerDraft?.phone || ""}
                        onChange={(e) => updateInlinePlayerDraft("phone", e.target.value)}
                        placeholder="(555) 123-4567"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700">Photo</label>
                      <input
                        type="file"
                        accept="image/*"
                        className="mt-1 w-full rounded-lg border px-3 py-2"
                        onChange={(e) => updateInlinePlayerPhoto(e.target.files[0])}
                      />
                      {inlinePlayerDraft?.photoUrl && (
                        <div className="mt-2">
                          <img src={inlinePlayerDraft.photoUrl} alt="Player photo" className="h-16 w-16 rounded-lg object-cover" />
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="mt-6 flex justify-end gap-3">
                    <Button variant="outline" onClick={closeInlinePlayerCreationModal}>Cancel</Button>
                    <Button variant="primary" onClick={saveInlinePlayer}>Save Player</Button>
                  </div>
                </div>
              </div>
            )}

            <Card>
              <div className="p-5">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-xl font-bold">Batting Order</h2>
                  {unsavedBattingOrder && <Button variant="primary" onClick={saveSetupChanges}>Save Batting Order</Button>}
                </div>
                {unsavedBattingOrder && <p className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-900">Unsaved batting order changes. Save Batting Order before starting the game.</p>}
                <div className="grid gap-3 md:grid-cols-2">
                  <ReorderOnlyEditor teamKey="away" teamName={awayTeam} title="Batting Order" description="Reorder only. Edit names in Team Players." players={battingOrder.away} subStatus={subPlayers.away} onMovePlayer={moveBatter} />
                  <ReorderOnlyEditor teamKey="home" teamName={homeTeam} title="Batting Order" description="Reorder only. Edit names in Team Players." players={battingOrder.home} subStatus={subPlayers.home} onMovePlayer={moveBatter} />
                </div>
              </div>
            </Card>

            <Card>
              <div className="p-5">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-xl font-bold">Pitching Order</h2>
                  {unsavedPitchingOrder && <Button variant="primary" onClick={saveSetupChanges}>Save Pitching Order</Button>}
                </div>
                {unsavedPitchingOrder && <p className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-900">Unsaved pitching order changes. Save Pitching Order before starting the game.</p>}
                <div className="grid gap-3 md:grid-cols-2">
                  <ReorderOnlyEditor teamKey="away" teamName={awayTeam} title="Pitching Order" description="One pitcher per inning. Extras are selected live after the 4th." players={pitchingOrder.away} subStatus={subPlayers.away} onMovePlayer={movePitcher} />
                  <ReorderOnlyEditor teamKey="home" teamName={homeTeam} title="Pitching Order" description="One pitcher per inning. Extras are selected live after the 4th." players={pitchingOrder.home} subStatus={subPlayers.home} onMovePlayer={movePitcher} />
                </div>
                <p className="mt-3 text-xs text-slate-500">Rule: the final away pitcher is skipped if the home team is leading after the top of the final inning, because the bottom half is not played.</p>
              </div>
            </Card>
            </>
            )}
            </>
            )}
          </div>
        )}

        {activePage === "score" && gameStarted && (
          <div className="space-y-4">
            {game.status === "final" && (
              <div className="animate-pulse rounded-2xl border-4 border-slate-900 bg-white p-4 text-center shadow-lg sm:rounded-3xl sm:p-6">
                <div className="text-sm font-black uppercase tracking-[0.35em] text-slate-500">Final</div>
                <div className="mt-2 text-3xl font-black sm:text-4xl md:text-6xl">
                  {game.winner === "away" ? awayTeam : game.winner === "home" ? homeTeam : "Tie Game"} {game.winner ? "Wins!" : ""}
                </div>
                <div className="mt-2 text-xl font-black sm:text-2xl md:text-3xl">{awayTeam} {game.awayScore} — {homeTeam} {game.homeScore}</div>
                {game.finalReason && <div className="mt-2 text-sm font-semibold text-slate-500">{game.finalReason}</div>}
                <div className="mt-4 flex justify-center gap-2">
                  <Button variant="danger" onClick={undoLast} disabled={events.length === 0}>↶ Undo Last Play</Button>
                </div>
                <p className="mt-2 text-xs text-slate-500">Undo will reopen the game as live and remove the final play/out/event.</p>
              </div>
            )}
            <Card>
              <div className="p-3 sm:p-4">
                <div className="grid w-full min-w-0 grid-cols-2 gap-2 lg:grid-cols-[1fr_auto_1fr] lg:items-center">
                  <div className="order-1 min-w-0 rounded-xl bg-slate-50 p-3 text-center shadow-sm sm:rounded-2xl sm:p-4 lg:order-none">
                    <div className="truncate text-xs font-semibold text-slate-500 sm:text-sm">{awayTeam}</div>
                    <div className="text-4xl font-black tracking-tight sm:text-5xl md:text-6xl">{game.awayScore}</div>
                  </div>
                  <div className="order-3 col-span-2 grid min-w-0 grid-cols-3 gap-2 rounded-xl bg-slate-900 p-2 text-center text-white shadow-sm sm:rounded-2xl sm:p-3 lg:order-none lg:col-span-1 lg:min-w-80">
                    <div><div className="text-[10px] uppercase text-slate-300">Inning</div><div className="text-base font-black sm:text-lg">{game.half === "top" ? "Top" : "Bot"} {game.inning}</div></div>
                    <div><div className="text-[10px] uppercase text-slate-300">Outs</div><div className="text-base font-black sm:text-lg">{game.outs}</div></div>
                    <div><div className="text-[10px] uppercase text-slate-300">Status</div><div className="text-base font-black uppercase sm:text-lg">{game.status}</div></div>
                  </div>
                  <div className="order-2 min-w-0 rounded-xl bg-slate-50 p-3 text-center shadow-sm sm:rounded-2xl sm:p-4 lg:order-none">
                    <div className="truncate text-xs font-semibold text-slate-500 sm:text-sm">{homeTeam}</div>
                    <div className="text-4xl font-black tracking-tight sm:text-5xl md:text-6xl">{game.homeScore}</div>
                  </div>
                </div>
              </div>
            </Card>

            <div className="grid w-full min-w-0 gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
              <div className="min-w-0 space-y-4">
                {game.status !== "final" && (
                <Card>
                  <div className="p-4 sm:p-5">
                    <div className="mb-4 grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.75fr)] lg:items-start">
                      <div className="min-w-0">
                        <div className="text-xs font-semibold uppercase text-slate-500">Current Matchup</div>
                        <div className="mt-2 grid grid-cols-[auto_1fr] items-center gap-3 sm:flex sm:flex-wrap sm:gap-4">
                          <div className="scale-90 sm:scale-100">
                            <PlayerAvatar playerName={currentBatter} profile={currentBatterProfile} size="lg" />
                          </div>
                          <div className="min-w-0">
                            <div className="break-words text-2xl font-black leading-tight sm:text-4xl md:text-5xl">{currentBatter}</div>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-base font-semibold text-slate-500 sm:text-xl">
                              <span>vs.</span>
                              <PlayerAvatar playerName={currentPitcher} profile={currentPitcherProfile} size="sm" />
                              <span className="min-w-0 break-words">{currentPitcher}</span>
                            </div>
                          </div>
                        </div>
                        <div className="mt-2 text-xs text-slate-500 sm:text-sm">Batter #{(batterIndex % currentBattingOrder.length) + 1} · {battingTeamName} batting · {defensiveTeamName} pitching</div>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-600">
                          <span className="rounded-full bg-slate-100 px-3 py-1">Bats: {handednessLabel(currentBatterProfile?.bats || "R")}</span>
                          <span className="rounded-full bg-slate-100 px-3 py-1">Pitcher throws: {handednessLabel(currentPitcherProfile?.pitches || "R")}</span>
                          {batterBatsBoth && game.status !== "final" && (
                            <label className="flex items-center gap-2 rounded-full border bg-white px-3 py-1">
                              Batter using
                              <select className="rounded-lg border px-2 py-1 text-xs" value={selectedBatterSide} onChange={(event) => setSelectedBatterSide(event.target.value)}>
                                <option value="R">Right</option>
                                <option value="L">Left</option>
                              </select>
                            </label>
                          )}
                          {pitcherThrowsBoth && game.status !== "final" && (
                            <label className="flex items-center gap-2 rounded-full border bg-white px-3 py-1">
                              Pitcher using
                              <select className="rounded-lg border px-2 py-1 text-xs" value={selectedPitcherSide} onChange={(event) => setSelectedPitcherSide(event.target.value)}>
                                <option value="R">Right</option>
                                <option value="L">Left</option>
                              </select>
                            </label>
                          )}
                        </div>



                        <div className="mt-3 grid gap-2 sm:mt-4 sm:grid-cols-2">
                          <div className="rounded-xl border bg-slate-50 p-3">
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-xs font-semibold uppercase text-slate-500">Batter {statScopeLabel(matchupStatScope)} Stats</div>
                              <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-black uppercase text-slate-500">{matchupStatCountdown}s</span>
                            </div>
                            <div className="mt-1 text-sm font-bold">{currentBatter}</div>
                            <div className="mt-1 text-xs text-slate-600">{formatBattingLine(displayedBatterStats)}</div>
                          </div>
                          <div className="rounded-xl border bg-slate-50 p-3">
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-xs font-semibold uppercase text-slate-500">Pitcher {statScopeLabel(matchupStatScope)} Stats</div>
                              <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-black uppercase text-slate-500">{matchupStatCountdown}s</span>
                            </div>
                            <div className="mt-1 text-sm font-bold">{currentPitcher}</div>
                            <div className="mt-1 text-xs text-slate-600">{formatPitchingLine(displayedPitcherStats)}</div>
                          </div>
                        </div>

                        {game.status !== "final" && game.inning > gameInnings && (
                          <div className="mt-4 rounded-xl border bg-amber-50 p-3">
                            <label className="text-xs font-semibold uppercase text-amber-700">Extra Innings Pitcher</label>
                            <select className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" value={defensiveExtraPitcher || currentPitcher} onChange={(event) => setExtraPitcher(defensiveTeam, game.inning, event.target.value)}>
                              {currentPitcherOptions.map((player) => <option key={player} value={player}>{formatPlayerName(player, subPlayers[defensiveTeam])}</option>)}
                            </select>
                            <p className="mt-1 text-xs text-amber-700">Appears only after the 4th. This controls the pitcher for the current extra inning.</p>
                          </div>
                        )}
                      </div>
                      <BaseDiamond bases={game.bases} />
                    </div>

                    {game.status !== "final" && activeFieldRules.length > 0 && (
                      <div className="mt-4 rounded-2xl border bg-amber-50 p-3">
                        <div className="mb-2 text-sm font-bold text-amber-900">Field Rules{selectedField ? ` · ${selectedField.name}` : ""}</div>
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {activeFieldRules.map((rule) => (
                            <Button key={rule.id} variant="outline" onClick={() => openFieldRuleConfirm(rule)}>{rule.name || "Field Rule"}</Button>
                          ))}
                        </div>
                      </div>
                    )}

                    {game.status !== "final" ? (
                      <div className="mt-4 space-y-3">
                        <label className="inline-flex items-center gap-2 rounded-xl border bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
                          <input type="checkbox" checked={repeatBatter} onChange={(event) => setRepeatBatter(event.target.checked)} />
                          Batter bats again
                        </label>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {resultButtons.map((result) => {
                          const outcome = calculateAutoAdvance(game.bases, currentBatter, result);
                          const subtitle = result.out ? "+1 out" : `${outcome.runs} run${outcome.runs === 1 ? "" : "s"}`;
                          return <Button key={result.type} variant="secondary" onClick={() => addPlay(result)}><span className="leading-tight">{result.label}</span><span className="hidden text-xs opacity-70 min-[390px]:inline">{subtitle}</span></Button>;
                        })}
                        {game.bases.third && game.outs < 2 && (
                          <Button variant="secondary" onClick={() => addPlay({ label: "Sac Fly", type: "sac_fly", bases: 0, atBat: 0, out: 1, sacFly: 1 })}>
                            <span>Sac Fly</span>
                            <span className="text-xs opacity-70">+1 RBI, +1 out</span>
                          </Button>
                        )}
                        {(game.bases.first || game.bases.second || game.bases.third) && game.outs < 2 && (
                          <Button variant="secondary" onClick={() => addPlay({ label: "Double Play", type: "double_play", bases: 0, atBat: 1, outs: 2 })}>
                            <span>Double Play</span>
                            <span className="text-xs opacity-70">2 outs</span>
                          </Button>
                        )}
                        {countBaseRunners(game.bases) >= 2 && game.outs === 0 && (
                          <Button variant="secondary" onClick={() => addPlay({ label: "Triple Play", type: "triple_play", bases: 0, atBat: 1, outs: 3 })}>
                            <span>Triple Play</span>
                            <span className="text-xs opacity-70">3 outs</span>
                          </Button>
                        )}
                        </div>

                        {game.status !== "final" && (powerPlaysEnabled || pudwhackerEnabled) && (
                          <div className="mt-4 grid gap-2 sm:grid-cols-3">
                            {powerPlaysEnabled && (
                              <Button variant={selectedModifier === "power_play" ? "primary" : "outline"} disabled={powerPlayUsed} onClick={() => setSelectedModifier(selectedModifier === "power_play" ? null : "power_play")}>Power Play {powerPlayUsed ? "Used" : ""}</Button>
                            )}
                            {powerPlaysEnabled && whammysEnabled && (
                              <Button variant={selectedModifier === "whammy" ? "danger" : "outline"} disabled={whammyUsed} onClick={() => setSelectedModifier(selectedModifier === "whammy" ? null : "whammy")}>
                                Whammy {whammyUsed ? "Used" : ""}
                              </Button>
                            )}
                            {pudwhackerEnabled && (
                              <Button variant={selectedModifier === "pudwhacker" ? "primary" : "outline"} disabled={!pudwhackerAvailable} onClick={() => setSelectedModifier(selectedModifier === "pudwhacker" ? null : "pudwhacker")}>
                                Pudwhacker {pudwhackerUsed ? "Used" : game.inning > gameInnings - 1 ? "Unavailable" : ""}
                              </Button>
                            )}
                          </div>
                        )}
                        {selectedModifier && !activeModifierInvalid && <p className="mt-2 text-xs font-semibold text-slate-600">Next play tagged as: {modifierLabel(selectedModifier)}</p>}
                      </div>
                    ) : (
                      <div className="mt-4 rounded-2xl border bg-slate-50 p-4 text-sm font-semibold text-slate-500">
                        <p>This game is final. Scoring actions are locked until you undo the last play/event.</p>
                        <div className="mt-3">
                          <Button variant="danger" onClick={undoLast} disabled={events.length === 0}>↶ Undo Last Play</Button>
                        </div>
                      </div>
                    )}

                    {game.status !== "final" && (
                    <>
                    <details className="group mt-5 rounded-2xl border bg-white">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4">
                        <div>
                          <h2 className="text-lg font-bold">Manual Scoring Controls</h2>
                          <p className="text-xs text-slate-500">Open for manual overrides, score adjustments, notes, undo, reset, and final game actions.</p>
                        </div>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase text-slate-500 group-open:hidden">Open</span>
                        <span className="hidden rounded-full bg-slate-900 px-3 py-1 text-xs font-bold uppercase text-white group-open:inline-block">Close</span>
                      </summary>
                      <div className="border-t p-4 pt-4">
                      <div className="grid gap-3 lg:grid-cols-2">
                        <div className="rounded-xl border bg-slate-50 p-3">
                          <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={manualMode} onChange={(event) => setManualMode(event.target.checked)} /> Manual runs/RBI override</label>
                          <p className="mt-1 text-xs text-slate-500">Manual runs can be negative for weird rule corrections. RBI should usually stay 0 or higher.</p>
                        </div>
                      </div>

                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <NumberControl label="Manual Runs" value={manualRuns} setValue={setManualRuns} allowNegative />
                        <NumberControl label="Manual RBI" value={manualRbi} setValue={setManualRbi} />
                      </div>

                      <div className="mt-3">
                        <label className="text-xs font-semibold uppercase text-slate-500">Note / Reason</label>
                        <input className="mt-1 w-full rounded-xl border px-3 py-2" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional note for weird plays, bonus runs, corrections, etc." />
                      </div>

                      <div className="mt-4 rounded-xl border bg-slate-50 p-3">
                        <div className="mb-2 text-sm font-bold">Team Score Adjustments</div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <div className="rounded-lg bg-white p-2"><div className="mb-2 text-xs font-semibold uppercase text-slate-500">{awayTeam}</div><div className="grid grid-cols-2 gap-2"><Button variant="outline" onClick={() => addTeamAdjustment("away", 1)}>+1 Run</Button><Button variant="outline" onClick={() => addTeamAdjustment("away", -1)}>−1 Run</Button></div></div>
                          <div className="rounded-lg bg-white p-2"><div className="mb-2 text-xs font-semibold uppercase text-slate-500">{homeTeam}</div><div className="grid grid-cols-2 gap-2"><Button variant="outline" onClick={() => addTeamAdjustment("home", 1)}>+1 Run</Button><Button variant="outline" onClick={() => addTeamAdjustment("home", -1)}>−1 Run</Button></div></div>
                        </div>
                        <p className="mt-2 text-xs text-slate-500">These adjustments can take a team below 0 and do not affect player stats.</p>
                      </div>

                      </div>
                    </details>

                    <div className="mt-4 rounded-2xl border bg-white p-4">
                      <div className="mb-3">
                        <h2 className="text-lg font-bold">Game Controls</h2>
                        <p className="text-xs text-slate-500">Use these during live scoring without opening Manual Scoring Controls.</p>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
                        <Button variant="outline" onClick={endHalfInning}>End Half</Button>
                        <Button variant="danger" onClick={undoLast}>↶ Undo</Button>
                        <Button variant="outline" onClick={resetGame}>Reset</Button>
                        <Button variant="danger" onClick={() => setConfirmCancelGameOpen(true)}>Cancel Game</Button>
                        <Button variant="primary" onClick={finalizeGame} disabled={game.status === "final"}>🏆 Finalize</Button>
                      </div>
                    </div>
                    </>
                    )}
                    {pendingFieldRule && (
                      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
                        <div className="w-full max-w-lg rounded-3xl bg-white p-5 shadow-xl">
                          <div className="text-xs font-black uppercase tracking-wide text-amber-600">Confirm Field Rule</div>
                          <h2 className="mt-1 text-2xl font-black">{pendingFieldRule.name || "Field Rule"}</h2>
                          {pendingFieldRule.description && <p className="mt-2 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">{pendingFieldRule.description}</p>}
                          <div className="mt-3 rounded-xl border bg-amber-50 p-3 text-sm text-amber-900">
                            <div className="mb-2 font-black uppercase tracking-wide">Rule Result</div>
                            <ul className="space-y-2">
                              {getFieldRuleResultItems(pendingFieldRule).map((item) => (
                                <li key={item} className="flex gap-2 rounded-lg bg-white/70 p-2 font-semibold">
                                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-200 text-xs font-black text-amber-900">✓</span>
                                  <span>{item}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div className="mt-5 flex flex-wrap justify-end gap-2">
                            <Button variant="outline" onClick={() => setPendingFieldRule(null)}>Cancel</Button>
                            <Button variant="primary" onClick={approvePendingFieldRule}>Approve Rule</Button>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button variant="outline" onClick={saveCurrentGame}>Save Game</Button>
                    </div>
                  </div>
                </Card>
                )}

                <LineScore awayTeam={awayTeam} homeTeam={homeTeam} game={game} lineScore={lineScore} />
              </div>

              <div className="min-w-0 space-y-4">
                <Card>
                  <div className="p-5">
                    <h2 className="mb-3 text-xl font-bold">📋 Last Play</h2>
                    {lastEvent ? (
                      <div className="rounded-xl bg-slate-50 p-3 text-sm">
                        {lastEvent.type === "play" && (
                          <div>
                            <p><strong>{lastEvent.batter}</strong> vs. <strong>{lastEvent.pitcher || "Pitcher not set"}</strong> — {lastEvent.result}, {lastEvent.runs} run(s), {lastEvent.rbi} RBI, {lastEvent.outs} out(s).</p>
                            {lastEvent.strikeoutType && <p className="mt-1 text-xs font-semibold text-slate-600">Strikeout: {lastEvent.strikeoutType === "looking" ? "Looking" : "Swinging"}</p>}
                            {lastEvent.batterSide && <p className="mt-1 text-xs text-slate-500">Batter side: {handednessLabel(lastEvent.batterSide)} · Pitcher throws: {handednessLabel(lastEvent.pitcherThrows || "R")}</p>}
                            {lastEvent.modifier && <p className="mt-1 text-xs font-semibold text-slate-600">Tag: {modifierLabel(lastEvent.modifier)}</p>}
                            <p className="mt-1 text-xs text-slate-500">{lastEvent.half === "top" ? "Top" : "Bottom"} {lastEvent.inning}</p>
                            {lastEvent.scored && lastEvent.scored.length > 0 && <p className="mt-1 text-slate-600">Scored: {lastEvent.scored.join(", ")}</p>}
                            {lastEvent.autoDescription && <p className="mt-1 text-slate-500">{lastEvent.autoDescription}</p>}
                          </div>
                        )}
                        {lastEvent.type === "score_adjustment" && <p><strong>{lastEvent.team === "away" ? awayTeam : homeTeam}</strong> adjustment: {lastEvent.runs > 0 ? "+" : ""}{lastEvent.runs} run. {lastEvent.note}</p>}
                        {lastEvent.type === "end_half" && <p>Half-inning ended manually.</p>}
                        {lastEvent.type === "field_rule" && <p><strong>{lastEvent.ruleName}</strong>: {lastEvent.note}</p>}
                        {lastEvent.type === "rbi_adjustment" && <p><strong>{lastEvent.batter}</strong>: +{lastEvent.rbi} RBI. {lastEvent.note}</p>}
                        {lastEvent.type === "finalize" && <p>Game finalized.</p>}
                        <p className="mt-2 text-xs text-slate-500">{lastEvent.createdAt}</p>
                      </div>
                    ) : <p className="text-sm text-slate-500">No plays entered yet.</p>}
                  </div>
                </Card>

                <LivePlayerStatsPanel
                  battingTeamName={battingTeamName}
                  defensiveTeamName={defensiveTeamName}
                  currentBatter={currentBatter}
                  currentPitcher={currentPitcher}
                  currentBatterStats={currentBatterStats}
                  currentPitcherStats={currentPitcherStats}
                  currentBatterProfile={currentBatterProfile}
                  currentPitcherProfile={currentPitcherProfile}
                  battingTeamPlayers={teamPlayers[battingTeam]}
                  defensiveTeamPlayers={teamPlayers[defensiveTeam]}
                  battingStats={game.stats}
                  pitchingStats={game.pitchingStats}
                  subIndex={currentSubIndex}
                  showGP={false}
                />
              </div>
            </div>
          </div>
        )}

        {activePage === "stats" && (
          <div className="space-y-4">
            <Card>
              <div className="p-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h2 className="text-xl font-bold">Stats View</h2>
                    <p className="text-sm text-slate-500">View the current game, a selected league season, or career stats across all saved league seasons.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant={statsViewMode === "current" ? "primary" : "outline"} onClick={() => setStatsViewMode("current")}>Current Game</Button>
                    <Button variant={statsViewMode === "season" ? "primary" : "outline"} onClick={() => setStatsViewMode("season")}>Season Stats</Button>
                    <Button variant={statsViewMode === "career" ? "primary" : "outline"} onClick={() => setStatsViewMode("career")}>Career Stats</Button>
                    <Button variant={statsViewMode === "exhibition" ? "primary" : "outline"} onClick={() => setStatsViewMode("exhibition")}>Exhibition Stats</Button>
                    <Button variant={statsViewMode === "tournament" ? "primary" : "outline"} onClick={() => setStatsViewMode("tournament")}>Tournament Stats</Button>
                    <Button variant={statsViewMode === "player_vs" ? "primary" : "outline"} onClick={() => setStatsViewMode("player_vs")}>Head to Head</Button>
                  </div>
                </div>

                {statsViewMode !== "current" && statsViewMode !== "exhibition" && statsViewMode !== "player_vs" && (
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div>
                      <label className="text-xs font-semibold uppercase text-slate-500">League</label>
                      <select
                        className="mt-1 w-full rounded-xl border px-3 py-2 text-sm font-semibold"
                        value={statsLeague?.id || ""}
                        onChange={(event) => setStatsLeagueId(event.target.value)}
                      >
                        {leagues.map((league) => <option key={league.id} value={league.id}>{league.name}</option>)}
                      </select>
                    </div>
                    {(statsViewMode === "season" || statsViewMode === "tournament") && (
                      <>
                        <div>
                          <label className="text-xs font-semibold uppercase text-slate-500">Season</label>
                          <select
                            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm font-semibold"
                            value={selectedSeasonYear}
                            onChange={(event) => { setStatsSeasonYear(Number(event.target.value)); setStatsSessionId("all"); }}
                          >
                            {statsSeasonYears.map((year) => <option key={year} value={year}>{year}</option>)}
                            {statsSeasonYears.length === 0 && <option value={currentYearNumber()}>{currentYearNumber()}</option>}
                          </select>
                        </div>
                        {statsSessionOptions.length > 0 && (
                          <div>
                            <label className="text-xs font-semibold uppercase text-slate-500">Session View</label>
                            <select
                              className="mt-1 w-full rounded-xl border px-3 py-2 text-sm font-semibold"
                              value={selectedStatsSessionId}
                              onChange={(event) => setStatsSessionId(event.target.value)}
                            >
                              <option value="all">Total Season</option>
                              {statsSessionOptions.map((session) => <option key={session.id} value={session.id}>{session.name}</option>)}
                            </select>
                          </div>
                        )}
                      </>
                    )}
                    <div>
                      <label className="text-xs font-semibold uppercase text-slate-500">Player Filter</label>
                      <select
                        className="mt-1 w-full rounded-xl border px-3 py-2 text-sm font-semibold"
                        value={statsPlayerFilter}
                        onChange={(event) => setStatsPlayerFilter(event.target.value)}
                      >
                        <option value="all">All Players</option>
                        {statsPlayerOptions.map((player) => <option key={player} value={player}>{player}</option>)}
                      </select>
                    </div>
                  </div>
                )}

                {statsViewMode === "exhibition" && (
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div>
                      <label className="text-xs font-semibold uppercase text-slate-500">Player Filter</label>
                      <select
                        className="mt-1 w-full rounded-xl border px-3 py-2 text-sm font-semibold"
                        value={statsPlayerFilter}
                        onChange={(event) => setStatsPlayerFilter(event.target.value)}
                      >
                        <option value="all">All Players</option>
                        {statsPlayerOptions.map((player) => <option key={player} value={player}>{player}</option>)}
                      </select>
                    </div>
                  </div>
                )}

                {statsViewMode === "player_vs" && (
                  <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <label className="text-xs font-semibold uppercase text-slate-500">League</label>
                      <select className="mt-1 w-full rounded-xl border px-3 py-2 text-sm font-semibold" value={statsVsScope === "exhibition" ? (statsLeagueId || "all") : (statsLeague?.id || "")} onChange={(event) => setStatsLeagueId(event.target.value)}>
                        {statsVsScope === "exhibition" && <option value="all">All Leagues</option>}
                        {leagues.map((league) => <option key={league.id} value={league.id}>{league.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase text-slate-500">Scope</label>
                      <select className="mt-1 w-full rounded-xl border px-3 py-2 text-sm font-semibold" value={statsVsScope} onChange={(event) => setStatsVsScope(event.target.value)}>
                        <option value="season">Season</option>
                        <option value="career">Career</option>
                        <option value="exhibition">Exhibition</option>
                      </select>
                    </div>
                    {statsVsScope === "season" && (
                      <div>
                        <label className="text-xs font-semibold uppercase text-slate-500">Season</label>
                        <select className="mt-1 w-full rounded-xl border px-3 py-2 text-sm font-semibold" value={selectedSeasonYear} onChange={(event) => setStatsSeasonYear(Number(event.target.value))}>
                          {statsSeasonYears.map((year) => <option key={year} value={year}>{year}</option>)}
                          {statsSeasonYears.length === 0 && <option value={currentYearNumber()}>{currentYearNumber()}</option>}
                        </select>
                      </div>
                    )}
                    <div>
                      <label className="text-xs font-semibold uppercase text-slate-500">Hitter</label>
                      <select className="mt-1 w-full rounded-xl border px-3 py-2 text-sm font-semibold" value={statsVsHitterFilter} onChange={(event) => setStatsVsHitterFilter(event.target.value)}>
                        {statsVsPlayerOptions.map((player) => <option key={`vs-hitter-${player}`} value={player}>{player}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase text-slate-500">Pitcher</label>
                      <select className="mt-1 w-full rounded-xl border px-3 py-2 text-sm font-semibold" value={statsVsPitcherFilter} onChange={(event) => setStatsVsPitcherFilter(event.target.value)}>
                        {statsVsPlayerOptions.map((player) => <option key={`vs-pitcher-${player}`} value={player}>{player}</option>)}
                      </select>
                    </div>
                  </div>
                )}
              </div>
            </Card>

            {statsViewMode === "current" ? (
              <>
                <TeamStatsSection
                  awayTeam={awayTeam}
                  homeTeam={homeTeam}
                  awayPlayers={teamPlayers.away}
                  homePlayers={teamPlayers.home}
                  battingStats={game.stats}
                  pitchingStats={game.pitchingStats}
                  subIndex={currentSubIndex}
                  showGP={false}
                  currentGameView
                />
                <SubStatsSection
                  title="Current Game Sub Stats"
                  description="These stats count in this game only and are tracked separately from official league season/career totals."
                  battingStats={filterStatsBySubIndex(game.stats, currentSubIndex, true)}
                  pitchingStats={filterStatsBySubIndex(game.pitchingStats, currentSubIndex, true)}
                  subIndex={currentSubIndex}
                  showGP={false}
                  currentGameView
                />
              </>
            ) : statsViewMode === "player_vs" ? (
              <>
                <Card>
                  <div className="p-5">
                    <h2 className="mb-3 text-xl font-bold">Hitter vs Pitcher Stats</h2>
                    <p className="mb-3 text-sm text-slate-500">Shows official league plate appearances matching the selected hitter and pitcher filters. Sub appearances and league exhibition games are excluded, unless viewing exhibition games from all leagues.</p>
                    <div className="mb-3 rounded-xl border bg-slate-50 p-3 text-sm font-semibold text-slate-600">
                      {statsVsHitterFilter} vs {statsVsPitcherFilter} · {statsVsScope === "career" ? "Career" : statsVsScope === "exhibition" ? `${statsLeagueId === "all" ? "All Leagues" : statsLeague?.name || "Unknown League"} Exhibition` : selectedSeasonYear}
                    </div>
                    <BattingStatsTable stats={playerVsStats.hittingStats} summaryLabel="Filtered Hitting Total" showGP={false} />
                  </div>
                </Card>
                <Card>
                  <div className="p-5">
                    <h2 className="mb-3 text-xl font-bold">Pitching vs Hitters</h2>
                    <p className="mb-3 text-sm text-slate-500">Pitching totals from the same filtered matchup set.</p>
                    <PitchingStatsTable stats={playerVsStats.pitchingStats} summaryLabel="Filtered Pitching Total" showGP={false} />
                  </div>
                </Card>
              </>
            ) : statsViewMode === "exhibition" ? (
              <>
                <Card>
                  <div className="p-5">
                    <h2 className="mb-3 text-xl font-bold">Exhibition Hitting Stats</h2>
                    <p className="mb-3 text-sm text-slate-500">Stats from custom games and non-league games are stored here separately from official league season and career totals.</p>
                    <BattingStatsTable stats={filterStatsByPlayer(exhibitionAggregateStats.battingStats, statsPlayerFilter)} summaryLabel="Exhibition Avg / Total" />
                  </div>
                </Card>
                <Card>
                  <div className="p-5">
                    <h2 className="mb-3 text-xl font-bold">Exhibition Pitching Stats</h2>
                    <p className="mb-3 text-sm text-slate-500">These pitching totals come from finalized custom or non-league games only.</p>
                    <PitchingStatsTable stats={filterStatsByPlayer(exhibitionAggregateStats.pitchingStats, statsPlayerFilter)} summaryLabel="Exhibition Avg / Total" />
                  </div>
                </Card>
                <SubStatsSection
                  title="Exhibition Sub Stats"
                  description="Sub stats from custom or non-league games are tracked separately from regular exhibition player totals."
                  battingStats={exhibitionAggregateStats.subBattingStats}
                  pitchingStats={exhibitionAggregateStats.subPitchingStats}
                  subIndex={exhibitionAggregateStats.subIndex}
                  selectedPlayer={statsPlayerFilter}
                />
              </>
            ) : (
              <>
                <LeagueAggregateStatsSection
                  league={{ ...statsLeague, name: statsViewMode === "tournament" ? `${statsLeague?.name || "League"} Tournament` : statsLeague?.name }}
                  battingStats={leagueAggregateStats.battingStats}
                  pitchingStats={leagueAggregateStats.pitchingStats}
                  playerTeamIndex={leagueAggregateStats.playerTeamIndex}
                  subIndex={{}}
                  selectedPlayer={statsPlayerFilter}
                />
                <SubStatsSection
                  title={statsViewMode === "career" ? "Career Sub Stats" : statsViewMode === "tournament" ? "Tournament Sub Stats" : "Season Sub Stats"}
                  description="Sub stats are saved and tracked here, but they do not count toward official season or career player totals."
                  battingStats={leagueAggregateStats.subBattingStats}
                  pitchingStats={leagueAggregateStats.subPitchingStats}
                  subIndex={leagueAggregateStats.subIndex}
                  selectedPlayer={statsPlayerFilter}
                />
              </>
            )}

            <Card>
              <div className="p-5">
                <h2 className="mb-3 text-xl font-bold">Power Play / Whammy Hitting Splits</h2>
                <p className="mb-3 text-sm text-slate-500">Power Play and Whammy plate appearances are combined here. Whammy count is tracked separately.</p>
                <div className="overflow-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="text-xs uppercase text-slate-500"><tr><th className="py-2">Player</th><th>Sub</th><th>PA</th><th>AB</th><th>H</th><th>AVG</th><th>BB</th><th>K</th><th>R</th><th>HR</th><th>RBI</th><th>Whammy</th></tr></thead>
                    <tbody>
                      {taggedHittingSplits.map((stat) => <tr key={stat.player} className="border-t"><td className="py-2 font-medium">{stat.player}</td><td>{currentSubIndex[stat.player] ? "Yes" : "No"}</td><td>{stat.PA}</td><td>{stat.AB}</td><td>{stat.H}</td><td>{average(stat.H, stat.AB)}</td><td>{stat.BB}</td><td>{stat.K}</td><td>{stat.R}</td><td>{stat.HR}</td><td>{stat.RBI}</td><td>{stat.WHAMMY}</td></tr>)}
                      {taggedHittingSplits.length === 0 && <tr><td className="py-3 text-slate-500" colSpan="12">No Power Play or Whammy plate appearances yet.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </Card>

            <Card>
              <div className="p-5">
                <h2 className="mb-3 text-xl font-bold">Pudwhacker Hitting Splits</h2>
                <p className="mb-3 text-sm text-slate-500">Pudwhacker plate appearances are tracked separately from Power Play / Whammy splits.</p>
                <div className="overflow-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="text-xs uppercase text-slate-500"><tr><th className="py-2">Player</th><th>Sub</th><th>PA</th><th>AB</th><th>H</th><th>AVG</th><th>BB</th><th>K</th><th>R</th><th>HR</th><th>RBI</th><th>Pudwhacker</th></tr></thead>
                    <tbody>
                      {pudwhackerSplits.map((stat) => <tr key={stat.player} className="border-t"><td className="py-2 font-medium">{stat.player}</td><td>{currentSubIndex[stat.player] ? "Yes" : "No"}</td><td>{stat.PA}</td><td>{stat.AB}</td><td>{stat.H}</td><td>{average(stat.H, stat.AB)}</td><td>{stat.BB}</td><td>{stat.K}</td><td>{stat.R}</td><td>{stat.HR}</td><td>{stat.RBI}</td><td>{stat.PUDWHACKER}</td></tr>)}
                      {pudwhackerSplits.length === 0 && <tr><td className="py-3 text-slate-500" colSpan="12">No Pudwhacker plate appearances yet.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </Card>

            <Card>
              <div className="p-5">
                <h2 className="mb-3 text-xl font-bold">Share / Export Results</h2>
                <p className="mb-3 text-sm text-slate-500">Export an Excel-friendly CSV or open a printable report that can be saved as a PDF from your browser print dialog.</p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="primary" onClick={exportCsv}>Export Excel CSV</Button>
                  <Button variant="outline" onClick={printPdfReport}>Print / Save PDF</Button>
                  <Button variant="outline" onClick={saveCurrentGame}>Save Current Game</Button>
                  <Button variant="secondary" onClick={startNewGame}>Start New Game</Button>
                </div>
              </div>
            </Card>

            {statsViewMode !== "exhibition" && (
            <Card>
              <div className="p-5">
                <h2 className="mb-3 text-xl font-bold">Event Log</h2>
                <div className="max-h-[36rem] space-y-2 overflow-auto pr-1">
                  {[...events].reverse().map((event, index) => (
                    <div key={event.id} className="rounded-xl border bg-white p-3 text-sm">
                      <div className="flex justify-between gap-2"><strong>{events.length - index}. {event.type.split("_").join(" ")}</strong><span className="text-xs text-slate-500">{event.createdAt}</span></div>
                      {(event.type === "play" || event.type === "score_adjustment") && event.inning && <p className="text-xs text-slate-500">{event.half === "top" ? "Top" : "Bottom"} {event.inning}</p>}
                      {event.type === "play" && <div><p>{event.batter} vs. {event.pitcher || "Pitcher not set"}: {event.result} | Runs {event.runs} | RBI {event.rbi} | Outs {event.outs}</p>{event.strikeoutType && <p className="text-slate-500">Strikeout: {event.strikeoutType === "looking" ? "Looking" : "Swinging"}</p>}{event.modifier && <p className="text-slate-500">Tag: {modifierLabel(event.modifier)}</p>}{event.scored && event.scored.length > 0 && <p className="text-slate-500">Scored: {event.scored.join(", ")}</p>}</div>}
                      {event.type === "score_adjustment" && <p>{event.team}: {event.runs > 0 ? "+" : ""}{event.runs} run | {event.note}</p>}
                      {event.type === "field_rule" && <p>{event.ruleName}: {event.note}</p>}
                      {event.type === "rbi_adjustment" && <p>{event.batter}: +{event.rbi} RBI | {event.note}</p>}
                      {event.note && event.type === "play" && <p className="text-slate-500">Note: {event.note}</p>}
                    </div>
                  ))}
                  {events.length === 0 && <p className="text-sm text-slate-500">No events yet.</p>}
                </div>
              </div>
            </Card>
            )}

            <Card>
              <div className="p-5">
                <div className="mb-3 flex items-center justify-between gap-2"><h2 className="text-xl font-bold">Self Tests</h2><Button variant="outline" onClick={() => setShowTests((value) => !value)}>{showTests ? "Hide Tests" : "Show Tests"}</Button></div>
                {showTests ? (
                  <div className="space-y-2">
                    <span className={`inline-block rounded-full px-3 py-1 text-xs font-bold uppercase ${allTestsPassed ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>{allTestsPassed ? "All Passed" : "Some Failed"}</span>
                    {testResults.map((testResult) => <div key={testResult.name} className="rounded-xl border bg-white p-3 text-sm"><div className="font-semibold">{testResult.pass ? "✅" : "❌"} {testResult.name}</div><div className="text-slate-500">{testResult.message}</div></div>)}
                  </div>
                ) : <p className="text-sm text-slate-500">Open this when you want to verify the prototype logic.</p>}
              </div>
            </Card>
          </div>
        )}

        {activePage === "leaders" && (
          <div className="space-y-4">
            <Card>
              <div className="p-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h2 className="text-xl font-bold">Leaders</h2>
                    <p className="text-sm text-slate-500">Show season or career leaders for the selected league. Add or remove stat categories below.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant={leadersViewMode === "season" ? "primary" : "outline"} onClick={() => setLeadersViewMode("season")}>Season Leaders</Button>
                    <Button variant={leadersViewMode === "career" ? "primary" : "outline"} onClick={() => setLeadersViewMode("career")}>Career Leaders</Button>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="text-xs font-semibold uppercase text-slate-500">League</label>
                    <select
                      className="mt-1 w-full rounded-xl border px-3 py-2 text-sm font-semibold"
                      value={leadersLeague?.id || ""}
                      onChange={(event) => setLeadersLeagueId(event.target.value)}
                    >
                      {leagues.map((league) => <option key={league.id} value={league.id}>{league.name}</option>)}
                    </select>
                  </div>
                  {leadersViewMode === "season" && (
                    <div>
                      <label className="text-xs font-semibold uppercase text-slate-500">Season</label>
                      <select
                        className="mt-1 w-full rounded-xl border px-3 py-2 text-sm font-semibold"
                        value={selectedLeadersSeasonYear}
                        onChange={(event) => setLeadersSeasonYear(Number(event.target.value))}
                      >
                        {leadersSeasonYears.map((year) => <option key={year} value={year}>{year}</option>)}
                        {leadersSeasonYears.length === 0 && <option value={currentYearNumber()}>{currentYearNumber()}</option>}
                      </select>
                    </div>
                  )}
                </div>
              </div>
            </Card>

            <LeadersSection
              league={leadersLeague}
              battingStats={leadersAggregateStats.battingStats}
              pitchingStats={leadersAggregateStats.pitchingStats}
              legacyPoints={leadersAggregateStats.legacyPoints}
              subCounts={leadersAggregateStats.subCounts}
              playerTeamIndex={leadersAggregateStats.playerTeamIndex}
              selectedLeaderStats={selectedLeaderStats}
              setSelectedLeaderStats={setSelectedLeaderStats}
            />
          </div>
        )}

        {activePage === "schedule" && selectedLeague && (
          <div className="space-y-4">
            <Card>
              <div className="p-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h2 className="text-xl font-bold">Schedule</h2>
                    <p className="text-sm text-slate-500">Add weeks to a season or selected session and schedule games by team.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <select className="rounded-xl border px-3 py-2 text-sm font-semibold" value={selectedLeague.id} onChange={(event) => handleSelectedLeagueChange(event.target.value)}>
                      {leagues.map((league) => <option key={league.id} value={league.id}>{league.name}</option>)}
                    </select>
                    <Button variant="primary" onClick={() => addScheduleWeek(selectedCurrentSeason.id)}>+ Add Week</Button>
                  </div>
                </div>
              </div>
            </Card>

            <Card>
              <div className="p-5">
                <div className="mb-4 grid gap-3 md:grid-cols-3">
                  <div>
                    <label className="text-xs font-semibold uppercase text-slate-500">Season</label>
                    <select className="mt-1 w-full rounded-xl border px-3 py-2 text-sm font-semibold" value={selectedCurrentSeason.id} onChange={(event) => updateLeagueCurrentSeasonYear((selectedLeagueSeasons.find((season) => season.id === event.target.value) || selectedCurrentSeason).year)}>
                      {selectedLeagueSeasons.map((season) => <option key={season.id} value={season.id}>{season.year}</option>)}
                    </select>
                  </div>
                  {selectedCurrentSeason.sessionsEnabled && (
                    <div>
                      <label className="text-xs font-semibold uppercase text-slate-500">Schedule Session</label>
                      <select className="mt-1 w-full rounded-xl border px-3 py-2 text-sm font-semibold" value={selectedCurrentSeason.currentSessionId || selectedCurrentSeason.sessions[0]?.id || ""} onChange={(event) => updateLeagueCurrentSession(selectedCurrentSeason.id, event.target.value)}>
                        {selectedCurrentSeason.sessions.map((session) => <option key={session.id} value={session.id}>{session.name}</option>)}
                      </select>
                    </div>
                  )}
                </div>

                <div className="mb-4 grid gap-3 lg:grid-cols-2">
                  {selectedCurrentSeason.sessionsEnabled && (
                    <div className="rounded-xl border bg-slate-50 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="text-sm font-bold">Copy Session Schedule</div>
                          <p className="text-xs text-slate-500">Copy the selected session schedule into another existing session.</p>
                        </div>
                        <Button variant="outline" onClick={() => setActiveScheduleCopyTool(activeScheduleCopyTool === "session" ? "" : "session")}>{activeScheduleCopyTool === "session" ? "Close" : "Select"}</Button>
                      </div>
                      {activeScheduleCopyTool === "session" && (
                        <div className="mt-3 border-t pt-3">
                          <p className="mb-3 text-xs text-slate-500">Target session schedule is replaced. Teams and fields are cleared.</p>
                          <div className="grid gap-2 md:grid-cols-[1fr_10rem_auto] md:items-end">
                            <div>
                              <label className="text-xs font-semibold uppercase text-slate-500">Copy To Session</label>
                              <select className="mt-1 w-full rounded-xl border px-3 py-2 text-sm font-semibold" value={copyScheduleTargetSessionId} onChange={(event) => setCopyScheduleTargetSessionId(event.target.value)}>
                                <option value="">Select target session</option>
                                {selectedCurrentSeason.sessions
                                  .filter((session) => session.id !== (selectedCurrentSeason.currentSessionId || selectedCurrentSeason.sessions[0]?.id || ""))
                                  .map((session) => <option key={session.id} value={session.id}>{session.name}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="text-xs font-semibold uppercase text-slate-500">First Week Date</label>
                              <input type="date" className="mt-1 w-full rounded-xl border px-3 py-2 text-sm font-semibold" value={copyScheduleFirstWeekDate} onChange={(event) => setCopyScheduleFirstWeekDate(event.target.value)} />
                            </div>
                            <Button variant="outline" disabled={!copyScheduleTargetSessionId || !copyScheduleFirstWeekDate} onClick={() => copyCurrentSessionScheduleToSession(selectedCurrentSeason.id, copyScheduleTargetSessionId, copyScheduleFirstWeekDate)}>Copy to Session</Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="rounded-xl border bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-sm font-bold">Copy Season Schedule</div>
                        <p className="text-xs text-slate-500">Copy one existing season schedule into another existing season.</p>
                      </div>
                      <Button variant="outline" onClick={() => setActiveScheduleCopyTool(activeScheduleCopyTool === "season" ? "" : "season")}>{activeScheduleCopyTool === "season" ? "Close" : "Select"}</Button>
                    </div>
                    {activeScheduleCopyTool === "season" && (
                      <div className="mt-3 border-t pt-3">
                        <p className="mb-3 text-xs text-slate-500">Target season schedule is replaced. Week dates start on the selected year/month/day and keep the same spacing as the copied season. Teams and fields are cleared.</p>
                        <div className="grid gap-2 md:grid-cols-[1fr_1fr_10rem_auto] md:items-end">
                          <div>
                            <label className="text-xs font-semibold uppercase text-slate-500">Copy From Season</label>
                            <select className="mt-1 w-full rounded-xl border px-3 py-2 text-sm font-semibold" value={copySeasonSourceId || selectedCurrentSeason.id} onChange={(event) => { setCopySeasonSourceId(event.target.value); if (copySeasonTargetId === event.target.value) setCopySeasonTargetId(""); }}>
                              {selectedLeagueSeasons.map((season) => <option key={season.id} value={season.id}>{season.year}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="text-xs font-semibold uppercase text-slate-500">Copy To Season</label>
                            <select className="mt-1 w-full rounded-xl border px-3 py-2 text-sm font-semibold" value={copySeasonTargetId} onChange={(event) => setCopySeasonTargetId(event.target.value)}>
                              <option value="">Select target season</option>
                              {selectedLeagueSeasons
                                .filter((season) => season.id !== (copySeasonSourceId || selectedCurrentSeason.id))
                                .map((season) => <option key={season.id} value={season.id}>{season.year}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="text-xs font-semibold uppercase text-slate-500">New Start Date</label>
                            <input type="date" className="mt-1 w-full rounded-xl border px-3 py-2 text-sm font-semibold" value={copySeasonFirstWeekDate} onChange={(event) => setCopySeasonFirstWeekDate(event.target.value)} />
                          </div>
                          <Button variant="outline" disabled={!copySeasonTargetId || !copySeasonFirstWeekDate || (copySeasonSourceId || selectedCurrentSeason.id) === copySeasonTargetId} onClick={() => copySeasonScheduleToExistingSeason(copySeasonSourceId || selectedCurrentSeason.id, copySeasonTargetId, copySeasonFirstWeekDate)}>Copy Season</Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  {(selectedCurrentSeason.scheduleWeeks || []).filter((week) => !selectedCurrentSeason.sessionsEnabled || week.sessionId === (selectedCurrentSeason.currentSessionId || selectedCurrentSeason.sessions[0]?.id || "")).map((week, weekIndex) => (
                    <div key={week.id} className="rounded-2xl border bg-slate-50 p-4">
                      <div className="mb-3 grid gap-3 md:grid-cols-[1fr_10rem_1fr_auto] md:items-end">
                        <div>
                          <label className="text-xs font-semibold uppercase text-slate-500">Week Name</label>
                          <input className="mt-1 w-full rounded-xl border px-3 py-2 text-sm font-semibold" value={week.name || `Week ${weekIndex + 1}`} onChange={(event) => updateScheduleWeek(selectedCurrentSeason.id, week.id, "name", event.target.value)} />
                          <label className="mt-2 flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-xs font-semibold text-slate-600">
                            <input type="checkbox" checked={Boolean(week.isTournament)} onChange={(event) => updateScheduleWeek(selectedCurrentSeason.id, week.id, "isTournament", event.target.checked)} />
                            Tournament week
                          </label>
                        </div>
                        <div>
                          <label className="text-xs font-semibold uppercase text-slate-500">Week Date *</label>
                          <input type="date" className={`mt-1 w-full rounded-xl border px-3 py-2 text-sm ${week.date ? "" : "border-red-400 bg-red-50"}`} value={week.date || ""} onChange={(event) => updateScheduleWeek(selectedCurrentSeason.id, week.id, "date", event.target.value)} />
                        </div>
                        <div>
                          <label className="text-xs font-semibold uppercase text-slate-500">Week Field *</label>
                          <select className={`mt-1 w-full rounded-xl border px-3 py-2 text-sm ${week.fieldId ? "" : "border-red-400 bg-red-50"}`} value={week.fieldId || ""} onChange={(event) => updateScheduleWeek(selectedCurrentSeason.id, week.id, "fieldId", event.target.value)}>
                            <option value="">Select field</option>
                            {(selectedLeague.fields || []).map((field) => <option key={field.id} value={field.id}>{field.name}</option>)}
                          </select>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" onClick={() => addScheduledGame(selectedCurrentSeason.id, week.id)} disabled={!week.date || !week.fieldId}>+ Add Game</Button>
                          <Button variant="outline" onClick={() => { setPendingCopyWeekId(pendingCopyWeekId === week.id ? "" : week.id); setCopyWeekOneWeekLater(true); }}>Copy Week</Button>
                          <Button variant="outline" onClick={() => removeScheduleWeek(selectedCurrentSeason.id, week.id)}>Remove Week</Button>
                        </div>
                        {(!week.date || !week.fieldId) && <p className="text-xs font-semibold text-red-600 md:col-span-4">Week date and field are required before games can be added or used in setup.</p>}
                        {pendingCopyWeekId === week.id && (
                          <div className="rounded-xl border bg-white p-3 md:col-span-4">
                            <div className="mb-2 text-sm font-bold">Copy {week.name || `Week ${weekIndex + 1}`}</div>
                            <p className="mb-3 text-xs text-slate-500">Copies game names and times only. Teams and field are cleared.</p>
                            <label className="flex items-center gap-2 text-sm font-semibold">
                              <input type="checkbox" checked={copyWeekOneWeekLater} onChange={(event) => setCopyWeekOneWeekLater(event.target.checked)} />
                              Set copied week date one week later
                            </label>
                            <p className="mt-1 text-xs text-slate-500">{copyWeekOneWeekLater && week.date ? `New week date will be ${addDaysToDateValue(week.date, 7)}.` : "New week date will be blank."}</p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <Button variant="primary" onClick={() => copyScheduleWeek(selectedCurrentSeason.id, week.id, copyWeekOneWeekLater)}>Copy Week</Button>
                              <Button variant="outline" onClick={() => setPendingCopyWeekId("")}>Cancel</Button>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        {(week.games || [])
                          .filter((scheduledGame) => !selectedCurrentSeason.sessionsEnabled || scheduledGame.sessionId === (selectedCurrentSeason.currentSessionId || selectedCurrentSeason.sessions[0]?.id || ""))
                          .map((scheduledGame, gameIndex) => (
                            <div key={scheduledGame.id} className="grid gap-2 rounded-xl border bg-white p-3 md:grid-cols-[1fr_8rem_1fr_1fr_auto] md:items-end">
                              <div>
                                <label className="text-xs font-semibold uppercase text-slate-500">Game Name</label>
                                <input className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" value={scheduledGame.name || `Game ${gameIndex + 1}`} onChange={(event) => updateScheduledGame(selectedCurrentSeason.id, week.id, scheduledGame.id, "name", event.target.value)} />
                              </div>
                              <div>
                                <label className="text-xs font-semibold uppercase text-slate-500">Time</label>
                                <input type="time" step="300" className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" value={scheduledGame.time || defaultScheduleTimeValue()} onChange={(event) => updateScheduledGame(selectedCurrentSeason.id, week.id, scheduledGame.id, "time", event.target.value)} />
                              </div>
                              <div>
                                <label className="text-xs font-semibold uppercase text-slate-500">Away</label>
                                <select className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" value={scheduledGame.awayTeamId || ""} onChange={(event) => updateScheduledGame(selectedCurrentSeason.id, week.id, scheduledGame.id, "awayTeamId", event.target.value)}>
                                  <option value="">Select away</option>
                                  {(selectedLeague.teams || []).map((team) => {
                                    const disabled = scheduledGame.homeTeamId === team.id;
                                    const label = disabled ? `${team.name} — selected as home` : team.name;
                                    return <option key={team.id} value={team.id} disabled={disabled}>{label}</option>;
                                  })}
                                </select>
                              </div>
                              <div>
                                <label className="text-xs font-semibold uppercase text-slate-500">Home</label>
                                <select className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" value={scheduledGame.homeTeamId || ""} onChange={(event) => updateScheduledGame(selectedCurrentSeason.id, week.id, scheduledGame.id, "homeTeamId", event.target.value)}>
                                  <option value="">Select home</option>
                                  {(selectedLeague.teams || []).map((team) => {
                                    const disabled = scheduledGame.awayTeamId === team.id;
                                    const label = disabled ? `${team.name} — selected as away` : team.name;
                                    return <option key={team.id} value={team.id} disabled={disabled}>{label}</option>;
                                  })}
                                </select>
                              </div>
                              <Button variant="outline" onClick={() => removeScheduledGame(selectedCurrentSeason.id, week.id, scheduledGame.id)}>Remove</Button>
                            </div>
                          ))}
                        {((week.games || []).filter((scheduledGame) => !selectedCurrentSeason.sessionsEnabled || scheduledGame.sessionId === (selectedCurrentSeason.currentSessionId || selectedCurrentSeason.sessions[0]?.id || "")).length === 0) && <p className="rounded-xl border bg-white p-3 text-sm text-slate-500">No games scheduled for this {selectedCurrentSeason.sessionsEnabled ? "session" : "week"} yet.</p>}
                      </div>
                    </div>
                  ))}
                  {(!selectedCurrentSeason.scheduleWeeks || selectedCurrentSeason.scheduleWeeks.length === 0) && <p className="rounded-xl border bg-slate-50 p-3 text-sm text-slate-500">No schedule weeks yet. Add a week to start scheduling games.</p>}
                </div>
              </div>
            </Card>
          </div>
        )}

        {activePage === "draft" && selectedLeague && (
          <div className="space-y-4">
            <Card>
              <div className="p-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h2 className="text-xl font-bold">Draft</h2>
                    <p className="text-sm text-slate-500">Run an auction-style draft for league players by session. Captains are automatically kept on their teams. Mock Draft lets you simulate without changing league rosters.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <select className="rounded-xl border px-3 py-2 text-sm font-semibold" value={selectedLeague.id} onChange={(event) => setSelectedLeagueId(event.target.value)}>
                      {leagues.map((league) => <option key={league.id} value={league.id}>{league.name}</option>)}
                    </select>
                    {!draftStarted && (
                      <label className="flex items-center gap-2 rounded-xl border bg-slate-50 px-3 py-2 text-sm font-semibold">
                        <input type="checkbox" checked={mockDraftMode} onChange={(event) => { setMockDraftMode(event.target.checked); setDraftSelectedPlayer(""); setDraftBidTeamId(""); setDraftBidAmount("1"); setDraftAwardError(""); }} />
                        Mock Draft
                      </label>
                    )}
                    <Button variant="outline" onClick={restartDraft}>{mockDraftMode ? "Reset Mock" : "Reset Draft"}</Button>
                  </div>
                </div>
              </div>
            </Card>

            <Card>
              <div className="p-5">
                {mockDraftMode && <div className="mb-3 inline-flex rounded-full bg-purple-100 px-3 py-1 text-xs font-black uppercase text-purple-800">Mock Draft</div>}
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-3 py-1 text-xs font-black uppercase ${mockDraftMode ? "bg-purple-100 text-purple-800" : "bg-slate-100 text-slate-600"}`}>
                    {mockDraftMode ? "Mock Draft Mode" : "Official Draft Mode"}
                  </span>
                  {mockDraftMode && <span className="rounded-full bg-purple-50 px-3 py-1 text-xs font-semibold text-purple-700">Mock picks will not update league rosters.</span>}
                  {mockDraftMode && <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-black uppercase text-purple-800">Official draft setting locked</span>}
                </div>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-bold">Draft Settings</h2>
                    <p className="text-sm text-slate-500">Select session, cap, carryover rules, edit draft order, and start the draft when ready.</p>
                  </div>
                  {!draftStarted && <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-black uppercase text-blue-800">Draft Setup Mode</span>}
                  {draftStarted && !draftCompleted && <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-black uppercase text-green-800">Draft Started</span>}
                  {draftCompleted && <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-black uppercase text-white">Draft Completed</span>}
                </div>
                <div className="grid gap-3 lg:grid-cols-5 lg:items-end">
                  <div>
                    <label className="text-xs font-semibold uppercase text-slate-500">Draft Session</label>
                    <select className="mt-1 w-full rounded-xl border px-3 py-2 text-sm font-semibold" value={activeDraftSessionId} disabled={draftStarted || draftNominationLocked} onChange={(event) => { setDraftSessionId(event.target.value); setDraftSelectedPlayer(""); setDraftBidTeamId(""); setDraftAwardError(""); }}>
                      {selectedCurrentSeason.sessions.map((session) => <option key={session.id} value={session.id}>{session.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase text-slate-500">Team Cap $</label>
                    <input type="number" min="1" className="mt-1 w-full rounded-xl border px-3 py-2 text-sm font-semibold" value={activeDraftSettings.cap} disabled={draftStarted || draftNominationLocked} onChange={(event) => updateDraftCap(event.target.value)} />
                  </div>
                  <div className="rounded-xl border bg-slate-50 p-3">
                    <label className="flex items-center gap-2 text-sm font-semibold">
                      <input type="checkbox" checked={Boolean(activeDraftSettings.maxCarryoverEnabled)} disabled={draftStarted || draftNominationLocked} onChange={(event) => updateDraftSettings(activeDraftSessionId, { maxCarryoverEnabled: event.target.checked })} />
                      Enable Max Carryover $
                    </label>
                    {activeDraftSettings.maxCarryoverEnabled && (
                      <div className="mt-2">
                        <label className="text-xs font-semibold uppercase text-slate-500">Max Carryover $</label>
                        <input type="number" min="0" className="mt-1 w-full rounded-xl border px-3 py-2 text-sm font-semibold" value={activeDraftSettings.maxCarryover} disabled={draftStarted || draftNominationLocked} onChange={(event) => updateDraftMaxCarryover(event.target.value)} />
                        <p className="mt-1 text-xs text-slate-500">{`Minimum spend: $${draftMinimumSpend}`}</p>
                      </div>
                    )}
                  </div>
                </div>
                {!mockDraftMode && !leagueDraftEnabledForActiveSession && <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900"><div className="font-black">Draft is not enabled for this session.</div><p className="mt-1">Go to League → Season and enable draft for this session before starting a real draft.</p><div className="mt-3"><Button variant="outline" onClick={() => goToPage("league")}>Open League Settings</Button></div></div>}
                {!draftBoardEnabled && mockDraftMode && <p className="mt-3 rounded-xl border bg-purple-50 p-3 text-sm font-semibold text-purple-800">Mock Draft is enabled. You can start a mock draft without enabling the official session draft.</p>}
                {!draftCaptainValuesReady && <p className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">Captain $ values are required before the draft can start: {teamsMissingCaptainValues.map((team) => team.name).join(", ")}.</p>}
                {draftStarted && <p className="mt-3 rounded-xl border bg-slate-50 p-3 text-sm font-semibold text-slate-600">Draft has started. Captain $ values are locked for this session.</p>}
              </div>
            </Card>

            <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
              <Card>
                <div className="p-5">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-bold">Auction Board</h2>
                      {mockDraftMode && <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-black uppercase text-purple-800">Mock Draft</span>}
                    </div>
                    {!draftBoardEnabled && <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black uppercase text-amber-800">Draft Disabled</span>}
                  </div>

                  {!draftStarted ? (
                    <div className="rounded-2xl border bg-slate-50 p-5 text-center">
                      <div className="text-lg font-black">Start the draft to open the auction board.</div>
                      <p className="mt-2 text-sm text-slate-500">Auction controls stay hidden until the draft is started. Real drafts will prompt you that results are final.</p>
                      <div className="mt-4 flex justify-center">
                        <Button variant="primary" disabled={!mockDraftMode && !leagueDraftEnabledForActiveSession} onClick={startDraft}>{mockDraftMode ? "Start Mock Draft" : "Start Draft"}</Button>
                      </div>
                    </div>
                  ) : draftCompleted ? (
                    <div className="rounded-2xl border bg-slate-50 p-5">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="text-xs font-black uppercase tracking-wide text-slate-500">Draft Results</div>
                          <h3 className="text-2xl font-black">{activeDraftSession?.name || "Session"} Results</h3>
                          <p className="text-sm text-slate-500">The auction board is hidden because this draft is complete.</p>
                        </div>
                        <Button variant="danger" onClick={restartDraft}>Restart Draft</Button>
                      </div>
                      <div className="space-y-3">
                        {draftSummaryGroups.map(({ division, teams }) => (
                          <div key={`auction-results-${division}`}>
                            <h4 className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">{division}</h4>
                            <div className="grid gap-2">
                              {teams.map((team) => {
                                const spend = getTeamDraftSpend(activeDraftSettings, team.id);
                                const remaining = Math.max(0, Number(activeDraftSettings.cap || 0) - spend);
                                const draftedPlayers = activeDraftSettings.draftedPlayers?.[team.id] || [];
                                return (
                                  <div key={`auction-result-${team.id}`} className="rounded-xl border bg-white p-3">
                                    <div className="flex justify-between gap-3">
                                      <div className="font-black">{team.name}{team.division ? ` · ${team.division}` : ""}</div>
                                      <div className="text-sm font-black">{`Spent $${spend} · Left $${remaining}`}</div>
                                    </div>
                                    <div className="mt-2 text-sm text-slate-600">
                                      {team.captain && <div>{activeDraftSettings.enabled ? `Captain: ${team.captain} ($${getCaptainDraftValue(activeDraftSettings, team)})` : `Captain: ${team.captain}`}</div>}
                                      {draftedPlayers.length > 0 ? draftedPlayers.map((player) => (
                                        <div key={`auction-result-${team.id}-${player}`} className="flex justify-between gap-2 border-t pt-1">
                                          <span>{player}</span>
                                          <span className="font-bold">{`$${activeDraftSettings.playerValues?.[player] || 0}`}</span>
                                        </div>
                                      )) : <div className="text-slate-500">No drafted players.</div>}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="mb-4 rounded-2xl border border-blue-200 bg-blue-50 p-4">
                        <div className="text-xs font-black uppercase tracking-wide text-blue-700">Draft Turn</div>
                        <div className="mt-1 text-2xl font-black text-blue-950">
                          {draftNominatingTeam ? `${draftNominatingTeam.name} is up next` : "No eligible teams remaining"}
                        </div>
                        <p className="mt-1 text-sm font-semibold text-blue-800">
                          {draftSelectedPlayer
                            ? currentWinningBid
                              ? "Bidding is open. Any eligible team may now place the next higher bid."
                              : `${draftNominatingTeam?.name || "The current team"} must place the opening bid for this player.`
                            : "Select the player this team is nominating, enter the opening bid, then place the first bid."}
                        </p>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        <div>
                          <label className="text-xs font-semibold uppercase text-slate-500">Player Up For Bid</label>
                          <select className="mt-1 w-full rounded-xl border px-3 py-2 text-sm font-semibold" value={draftSelectedPlayer} disabled={!draftCanUseAuction} onChange={(event) => selectDraftPlayerForBid(event.target.value)}>
                            <option value="">Select player</option>
                            {draftAvailablePlayers.map((player) => <option key={player} value={player}>{player}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs font-semibold uppercase text-slate-500">Bid Placed By Team</label>
                          <select className="mt-1 w-full rounded-xl border px-3 py-2 text-sm font-semibold" value={draftBidTeamId} disabled={!draftCanUseAuction || !draftSelectedPlayer || openingBidRequiredFromNominatingTeam} onChange={(event) => { setDraftBidTeamId(event.target.value); setDraftAwardError(""); }}>
                            <option value="">Select team</option>
                            {draftEligibleTeams.map((team) => (
                              <option key={team.id} value={team.id}>{`${team.name} · $${getTeamDraftSpend(activeDraftSettings, team.id)}/$${activeDraftSettings.cap} · Min $${getTeamDraftMinimumBid(selectedLeague, activeDraftSettings, team.id)} · Max $${getTeamDraftMaximumBid(selectedLeague, activeDraftSettings, team.id)}`}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {draftSelectedPlayer && (
                        <div className="mt-4 rounded-2xl border bg-slate-50 p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <div className="text-xs font-black uppercase tracking-wide text-slate-500">Up For Bid</div>
                              <div className="text-3xl font-black">{draftSelectedPlayer}</div>
                            </div>
                            <Button variant="outline" onClick={cancelDraftBid}>Cancel Bid</Button>
                          </div>
                          <div className="mt-3 grid gap-3 md:grid-cols-2">
                            <div className="rounded-xl border bg-white p-3">
                              <div className="text-xs font-bold uppercase text-slate-500">Career Hitting</div>
                              <div className="mt-1 text-sm font-semibold">{formatBattingLine(nominatedBattingStats)}</div>
                            </div>
                            <div className="rounded-xl border bg-white p-3">
                              <div className="text-xs font-bold uppercase text-slate-500">Career Pitching</div>
                              <div className="mt-1 text-sm font-semibold">{formatPitchingLine(nominatedPitchingStats)}</div>
                            </div>
                          </div>
                          <div className="mt-3 grid gap-3 md:grid-cols-[1fr_0.8fr]">
                            <div className="rounded-xl border bg-white p-3">
                              <div className="text-xs font-bold uppercase text-slate-500">Current Winning Bid</div>
                              {currentWinningBid && currentWinningTeam ? (
                                <div className="mt-1">
                                  <div className="text-2xl font-black">{currentWinningTeam.name}</div>
                                  <div className="text-sm font-semibold text-slate-600">{`$${currentWinningBid.amount}`}</div>
                                  <div className="mt-3 rounded-lg border bg-slate-50 p-2">
                                    <div className="mb-1 text-[10px] font-black uppercase tracking-wide text-slate-500">Current Roster</div>
                                    <div className="space-y-1 text-xs font-semibold text-slate-700">
                                      {currentWinningTeam.captain && <div>{`Captain: ${currentWinningTeam.captain} ($${getCaptainDraftValue(activeDraftSettings, currentWinningTeam)})`}</div>}
                                      {(activeDraftSettings.draftedPlayers?.[currentWinningTeam.id] || []).length > 0 ? (activeDraftSettings.draftedPlayers?.[currentWinningTeam.id] || []).map((player) => (
                                        <div key={`winning-roster-${currentWinningTeam.id}-${player}`} className="flex justify-between gap-2 border-t pt-1">
                                          <span>{player}</span>
                                          <span>{`$${activeDraftSettings.playerValues?.[player] || 0}`}</span>
                                        </div>
                                      )) : <div className="text-slate-500">No drafted players yet.</div>}
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div className="mt-1 text-sm font-semibold text-slate-500">No bids placed yet.</div>
                              )}
                            </div>
                            <div className="rounded-xl border bg-white p-3">
                              <div className="mb-2 flex items-center justify-between gap-2">
                                <div className="text-xs font-bold uppercase text-slate-500">Bid History</div>
                                <Button variant="outline" disabled={!currentWinningBid} onClick={cancelLatestBid}>Cancel Latest Bid</Button>
                              </div>
                              <div className="max-h-28 space-y-1 overflow-auto pr-1 text-xs">
                                {currentBidHistory.length > 0 ? currentBidHistory.map((bid) => {
                                  const bidTeam = (selectedLeague.teams || []).find((team) => team.id === bid.teamId);
                                  return (
                                    <div key={bid.id} className="flex justify-between gap-2 rounded-lg bg-slate-50 px-2 py-1">
                                      <button
                                        type="button"
                                        className="truncate text-left font-bold text-slate-900 underline decoration-dotted underline-offset-2 hover:text-green-700"
                                        onClick={() => { setDraftBidTeamId(bid.teamId); setDraftAwardError(""); }}
                                        title="Use this team for the next bid"
                                      >
                                        {bidTeam?.name || "Unknown Team"}
                                      </button>
                                      <span className="font-black">{`$${bid.amount}`}</span>
                                    </div>
                                  );
                                }) : <div className="text-slate-500">No bid history yet.</div>}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
                        <div>
                          <label className="text-xs font-semibold uppercase text-slate-500">Bid Amount $</label>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <input
                              type="number"
                              min="1"
                              step="1"
                              className="w-28 rounded-xl border px-3 py-2 text-center text-sm font-black"
                              value={draftBidAmount}
                              disabled={!draftSelectedPlayer}
                              onChange={(event) => setDraftBidAmount(event.target.value)}
                              onBlur={() => setDraftBidAmount(String(Math.max(currentTeamMinimumBid || 1, Number(draftBidAmount) || currentTeamMinimumBid || 1)))}
                            />
                            <Button variant="outline" disabled={!draftSelectedPlayer} onClick={() => setDraftBidAmount((amount) => String(Math.max(1, Number(amount) || 0) + 1))}>+ $1</Button>
                            <Button variant="outline" disabled={!draftSelectedPlayer} onClick={() => setDraftBidAmount((amount) => String(Math.max(1, Number(amount) || 0) + 5))}>+ $5</Button>
                            <Button variant="outline" disabled={!draftSelectedPlayer} onClick={() => setDraftBidAmount((amount) => String(Math.max(1, Number(amount) || 0) + 10))}>+ $10</Button>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={!draftCanUseAuction || !draftCaptainValuesReady || !draftSelectedPlayer || !String(draftBidTeamId || "").trim() || draftBidAmountNumber < 1 || draftBidAmountNumber < currentTeamMinimumBid || draftBidAmountNumber > currentTeamMaximumBid || getTeamDraftSpend(activeDraftSettings, draftBidTeamId) + draftBidAmountNumber > Number(activeDraftSettings.cap || 0) || Boolean(currentDraftMinimumBidError) || Boolean(currentDraftMaximumBidError) || Boolean(currentDraftCarryoverError) || Boolean(currentDraftRosterFullError)}
                            onClick={placeDraftBid}
                            className="inline-flex min-w-40 items-center justify-center rounded-2xl bg-green-600 px-5 py-3 text-base font-black uppercase tracking-wide text-white shadow-md transition hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            💰 Place Bid
                          </button>
                          <button
                            type="button"
                            disabled={!draftStarted || draftCompleted || !draftCaptainValuesReady || !draftSelectedPlayer || !currentWinningBid}
                            onClick={() => awardDraftPlayer(draftSelectedPlayer, currentWinningBid?.teamId, currentWinningBid?.amount)}
                            className="inline-flex min-w-44 items-center justify-center rounded-2xl bg-slate-900 px-5 py-3 text-base font-black uppercase tracking-wide text-white shadow-md ring-2 ring-slate-300 transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            🏆 Award Player
                          </button>
                        </div>
                      </div>
                      {draftSelectedPlayer && draftBidTeamId && <p className="mt-2 text-xs font-semibold text-slate-500">{`Bid range for selected team: $${currentTeamMinimumBid} minimum / $${currentTeamMaximumBid} maximum`}</p>}
                      {draftSelectedPlayer && openingBidRequiredFromNominatingTeam && <p className="mt-2 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm font-bold text-blue-800">Opening bid is locked to {draftNominatingTeam?.name || "the current draft-order team"}. After the first bid, other teams can bid.</p>}
                      {currentDraftMinimumBidError && <p className="mt-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{currentDraftMinimumBidError}</p>}
                      {!draftSelectedPlayer && <p className="mt-2 text-xs font-semibold text-slate-500">Select a player before entering or changing the bid.</p>}
                      {draftBidTeamId && getTeamDraftSpend(activeDraftSettings, draftBidTeamId) + draftBidAmountNumber > Number(activeDraftSettings.cap || 0) && <p className="mt-2 text-xs font-semibold text-red-600">This bid would exceed the selected team cap.</p>}
                      {currentDraftMaximumBidError && <p className="mt-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{currentDraftMaximumBidError}</p>}
                      {currentDraftRosterFullError && <p className="mt-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{currentDraftRosterFullError}</p>}
                      {currentDraftCarryoverError && <p className="mt-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{currentDraftCarryoverError}</p>}
                      {draftAwardError && <p className="mt-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{draftAwardError}</p>}

                      <div className="mt-5 overflow-auto rounded-xl border">
                        <table className="w-full text-left text-sm">
                          <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-3 py-2">Player</th><th className="px-3 py-2">Action</th></tr></thead>
                          <tbody>
                            {draftAvailablePlayers.map((player) => (
                              <tr key={player} className="border-t">
                                <td className="px-3 py-2 font-semibold">{player}</td>
                                <td className="px-3 py-2">
                                  <Button variant="outline" disabled={!draftCanUseAuction} onClick={() => selectDraftPlayerForBid(player)}>Select</Button>
                                </td>
                              </tr>
                            ))}
                            {draftAvailablePlayers.length === 0 && (
                              <tr><td className="px-3 py-3 text-slate-500" colSpan="2">No available non-captain players left.</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>
              </Card>

              {(mockDraftMode || leagueDraftEnabledForActiveSession) && (
              <div className="space-y-4">
                <Card>
                  <div className="p-5">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-xl font-bold">Draft Order</h2>
                          {mockDraftMode && <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-black uppercase text-purple-800">Mock Draft</span>}
                          {!draftStarted && <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-black uppercase text-blue-800">Setup Mode</span>}
                        </div>
                        {!draftStarted && <p className="mt-1 text-xs font-semibold text-slate-500">Use the arrows to edit draft order before starting the draft.</p>}
                      </div>
                      {!draftBoardEnabled && <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black uppercase text-amber-800">Draft Disabled</span>}
                    </div>
                    <div className="space-y-2">
                      {activeDraftSettings.draftOrder.map((teamId, index) => {
                        const team = (selectedLeague.teams || []).find((item) => item.id === teamId);
                        if (!team) return null;
                        return (
                          <div key={teamId} className={`grid grid-cols-[2rem_1fr_auto] items-center gap-2 rounded-xl border p-2 ${teamId === draftNominatingTeamId && draftStarted && !draftCompleted ? "border-blue-300 bg-blue-50 ring-2 ring-blue-100" : "bg-slate-50"}`}>
                            <div className="text-center text-sm font-black text-slate-500">{index + 1}</div>
                            <div className="font-semibold">
                              <div className="flex flex-wrap items-center gap-2">
                                <span>{team.name}</span>
                                {team.division && <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-black uppercase text-slate-500">{team.division}</span>}
                                {teamId === draftNominatingTeamId && draftStarted && !draftCompleted && <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-black uppercase text-white">Up Next</span>}
                              </div>
                              <div className="mt-1 flex flex-wrap gap-2 text-xs font-bold text-slate-600">
                                {team.captain ? <span>{`Captain: ${team.captain}`}</span> : <span className="text-slate-400">No captain</span>}
                                {team.captain && <span>{`Captain Value: $${getCaptainDraftValue(activeDraftSettings, team)}`}</span>}
                              </div>
                            </div>
                            {!draftStarted && (
                              <div className="flex gap-1"><Button variant="outline" disabled={draftNominationLocked || index === 0} onClick={() => moveDraftOrder(index, -1)}>↑</Button><Button variant="outline" disabled={draftNominationLocked || index === activeDraftSettings.draftOrder.length - 1} onClick={() => moveDraftOrder(index, 1)}>↓</Button></div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </Card>
              </div>
              )}
            </div>

            {(mockDraftMode || leagueDraftEnabledForActiveSession) && (
            <Card>
              <div className="p-5">
                <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-bold">Draft Summary</h2>
                      {mockDraftMode && <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-black uppercase text-purple-800">Mock Draft</span>}
                    </div>
                    <p className="text-sm text-slate-500">Easy-read roster and budget view for {activeDraftSession?.name || "this session"}.</p>
                  </div>
                  <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black uppercase text-slate-500">
                    {mockDraftMode ? "Mock Draft" : activeDraftSettings.enabled ? "Draft Enabled" : "Draft Disabled"}
                  </div>
                </div>
                <div className="space-y-5">
                  {draftSummaryGroups.map(({ division, teams }) => (
                    <div key={`draft-summary-${division}`}>
                      <h3 className="mb-2 text-sm font-black uppercase tracking-wide text-slate-500">{division}</h3>
                      <div className="grid gap-3 lg:grid-cols-2">
                        {teams.map((team) => {
                          const spend = getTeamDraftSpend(activeDraftSettings, team.id);
                          const remaining = Math.max(0, Number(activeDraftSettings.cap || 0) - spend);
                          const draftedPlayers = activeDraftSettings.draftedPlayers?.[team.id] || [];
                          const rosterCount = getTeamDraftedTotalCount(selectedLeague, activeDraftSettings, team.id);
                          const rosterTarget = getTeamTotalRosterTargetCount(selectedLeague, team.id);
                          const locked = draftLockedTeamIds.has(team.id);
                          const carryoverOk = !activeDraftSettings.maxCarryoverEnabled || spend >= draftMinimumSpend;
                          return (
                            <div key={`final-draft-${team.id}`} className="rounded-2xl border bg-slate-50 p-4">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <div className="text-lg font-black">{team.name}</div>
                                  <div className="mt-1 text-xs font-semibold uppercase text-slate-500">{team.division || "No Division"} · Roster {rosterCount}/{rosterTarget}</div>
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                  <div className={`rounded-full px-3 py-1 text-xs font-black uppercase ${locked ? "bg-slate-900 text-white" : carryoverOk ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>
                                    {locked ? "Locked" : carryoverOk ? "On Budget" : "Below Minimum"}
                                  </div>
                                  <label className="flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-xs font-semibold">
                                    <input type="checkbox" checked={locked} onChange={(event) => toggleDraftTeamLock(team.id, event.target.checked)} />
                                    Lock team after session
                                  </label>
                                </div>
                              </div>

                              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                                <div className="rounded-xl border bg-white p-3">
                                  <div className="text-xs font-bold uppercase text-slate-500">Spent</div>
                                  <div className="text-2xl font-black">{`$${spend}`}</div>
                                </div>
                                <div className="rounded-xl border bg-white p-3">
                                  <div className="text-xs font-bold uppercase text-slate-500">Remaining</div>
                                  <div className="text-2xl font-black">{`$${remaining}`}</div>
                                </div>
                                <div className="rounded-xl border bg-white p-3">
                                  <div className="text-xs font-bold uppercase text-slate-500">Cap</div>
                                  <div className="text-2xl font-black">{`$${activeDraftSettings.cap}`}</div>
                                </div>
                              </div>

                              {activeDraftSettings.maxCarryoverEnabled && (
                                <div className="mt-3 rounded-xl border bg-white p-3 text-sm">
                                  <div className="font-bold">{`Max Carryover: $${activeDraftSettings.maxCarryover}`}</div>
                                  <div className="text-xs text-slate-500">{`Minimum spend required: $${draftMinimumSpend} · Current carryover: $${remaining}`}</div>
                                </div>
                              )}

                              <div className="mt-3 rounded-xl border bg-white p-3">
                                <div className="mb-2 text-xs font-black uppercase text-slate-500">Roster</div>
                                <div className="space-y-1 text-sm">
                                  {team.captain ? <div className="font-semibold">{activeDraftSettings.enabled ? `Captain: ${team.captain} ($${getCaptainDraftValue(activeDraftSettings, team)})` : `Captain: ${team.captain}`}</div> : <div className="text-slate-500">No captain assigned.</div>}
                                  {draftedPlayers.length > 0 ? draftedPlayers.map((player) => (
                                    <div key={`${team.id}-${player}`} className="flex justify-between gap-2 border-t pt-1">
                                      <span>{player}</span>
                                      <span className="font-bold">{`$${activeDraftSettings.playerValues?.[player] || 0}`}</span>
                                    </div>
                                  )) : <div className="text-slate-500">No drafted players yet.</div>}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
            )}
          </div>
        )}

        {activePage === "standings" && (
          <div className="space-y-4">
            <Card>
              <div className="p-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2 className="text-xl font-bold">Standings</h2>
                    <p className="text-sm text-slate-500">Select a league to view standings. Custom Game does not have standings.</p>
                  </div>
                  <select
                    className="rounded-xl border px-3 py-2 text-sm font-semibold"
                    value={selectedLeague?.id || ""}
                    onChange={(event) => setSelectedLeagueId(event.target.value)}
                  >
                    {leagues.map((league) => <option key={league.id} value={league.id}>{league.name}</option>)}
                  </select>
                </div>
              </div>
            </Card>
            {selectedLeague ? (
              <StandingsTable league={selectedLeague} previousGames={previousGames} />
            ) : (
              <Card><div className="p-5 text-sm text-slate-500">Create a league first to view standings.</div></Card>
            )}
          </div>
        )}

        {activePage === "rules" && selectedLeague && (
          <div className="space-y-4">
            <Card>
              <div className="p-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h2 className="text-xl font-bold">Official League Rules</h2>
                    <p className="text-sm text-slate-500">Build a commissioner-maintained rules manual by section. Use the table of contents to jump between gameplay rules, league setup rules, roster rules, playoffs, or anything else your league needs.</p>
                    {rulesHaveUnsavedChanges && <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-900">Unsaved rule changes — click Save Rules before leaving to apply them.</p>}
                    {selectedLeagueRealDraftInProgress && <p className="mt-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-800">League rules can not be changed during an active draft.</p>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <select className="rounded-xl border px-3 py-2 text-sm font-semibold" value={selectedLeague.id} onChange={(event) => handleSelectedLeagueChange(event.target.value)}>
                      {leagues.map((league) => <option key={league.id} value={league.id}>{league.name}</option>)}
                    </select>
                    {rulesHaveUnsavedChanges && <Button variant="primary" onClick={saveLeagueDraftChanges}>Save Rules</Button>}
                    {rulesHaveUnsavedChanges && <Button variant="outline" onClick={discardLeagueDraftChanges}>Discard Rules</Button>}
                    <Button variant="outline" onClick={openLeagueRuleChangeLogWindow}>View Change Log</Button>
                    <button
                      type="button"
                      onClick={addLeagueRuleSection}
                      disabled={selectedLeagueRealDraftInProgress}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      + Add Section
                    </button>
                  </div>
                </div>
              </div>
            </Card>

            <fieldset disabled={selectedLeagueRealDraftInProgress} aria-disabled={selectedLeagueRealDraftInProgress} className={selectedLeagueRealDraftInProgress ? "pointer-events-none select-none opacity-50" : ""}>
              <div className="grid gap-4 lg:grid-cols-[18rem_1fr] lg:items-start">
                <Card>
                  <div className="sticky top-4 p-5">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <div>
                        <h2 className="text-lg font-black">Table of Contents</h2>
                        <p className="text-xs text-slate-500">{selectedLeague.name}</p>
                      </div>
                    </div>
                    {selectedLeagueRuleSections.length > 0 ? (
                      <div className="space-y-2">
                        {selectedLeagueRuleSections.map((section, index) => (
                          <a key={`toc-${section.id}`} href={`#${makeRuleAnchor(section)}`} className="block rounded-xl border bg-slate-50 p-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100">
                            <span className="block text-[10px] font-black uppercase tracking-wide text-slate-400">Section {index + 1}</span>
                            <span className="block truncate">{section.title || `Section ${index + 1}`}</span>
                            <span className="mt-1 block text-xs font-normal text-slate-500">{(section.rules || []).length} rule{(section.rules || []).length === 1 ? "" : "s"}</span>
                          </a>
                        ))}
                      </div>
                    ) : (
                      <p className="rounded-xl border bg-slate-50 p-3 text-sm text-slate-500">No sections yet. Add a section to start building the rules manual.</p>
                    )}
                    <div className="mt-4 rounded-xl border bg-blue-50 p-3 text-xs text-blue-900">
                      <div className="font-black uppercase tracking-wide">Suggested sections</div>
                      <div className="mt-1">Gameplay Rules, League Setup, Rosters & Draft, Schedule, Tournament/Playoffs, Commissioner Decisions.</div>
                    </div>
                  </div>
                </Card>

                <div className="space-y-4">
                  {selectedLeagueRuleSections.map((section, sectionIndex) => (
                    <Card key={section.id}>
                      <div id={makeRuleAnchor(section)} className="scroll-mt-6 p-5">
                        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div className="flex-1">
                            <div className="text-xs font-black uppercase tracking-wide text-slate-500">Section {sectionIndex + 1}</div>
                            <input
                              className="mt-1 w-full rounded-xl border px-3 py-2 text-xl font-black"
                              value={section.title || ""}
                              onChange={(event) => updateLeagueRuleSection(section.id, "title", event.target.value)}
                              placeholder="Example: Gameplay Rules"
                            />
                            <textarea
                              className="mt-2 w-full rounded-xl border px-3 py-2 text-sm"
                              rows="2"
                              value={section.description || ""}
                              onChange={(event) => updateLeagueRuleSection(section.id, "description", event.target.value)}
                              placeholder="Optional section description, purpose, or commissioner guidance."
                            />
                          </div>
                          <div className="flex flex-wrap gap-2 lg:justify-end">
                            <button type="button" className="rounded-xl border bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-40" disabled={sectionIndex === 0} onClick={() => moveLeagueRuleSection(section.id, -1)}>↑ Move</button>
                            <button type="button" className="rounded-xl border bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-40" disabled={sectionIndex === selectedLeagueRuleSections.length - 1} onClick={() => moveLeagueRuleSection(section.id, 1)}>↓ Move</button>
                            <button type="button" className="rounded-xl border bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50" onClick={() => addLeagueRuleItem(section.id)}>+ Add Rule</button>
                            <button type="button" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100" onClick={() => removeLeagueRuleSection(section.id)}>Remove Section</button>
                          </div>
                        </div>

                        <div className="space-y-3">
                          {(section.rules || []).map((rule, ruleIndex) => (
                            <div key={rule.id} className="rounded-2xl border bg-slate-50 p-4">
                              <div className="mb-3 flex items-center justify-between gap-3">
                                <div className="text-sm font-black text-slate-500">{sectionIndex + 1}.{ruleIndex + 1}</div>
                                <button
                                  type="button"
                                  onClick={() => removeLeagueRuleItem(section.id, rule.id)}
                                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
                                >
                                  Remove Rule
                                </button>
                              </div>
                              <div>
                                <label className="text-xs font-semibold uppercase text-slate-500">Rule Heading</label>
                                <input className="mt-1 w-full rounded-xl border px-3 py-2 text-sm font-semibold" value={rule.title || ""} onChange={(event) => updateLeagueRuleItem(section.id, rule.id, "title", event.target.value)} placeholder="Example: Mercy Rule" />
                              </div>
                              <div className="mt-3">
                                <label className="text-xs font-semibold uppercase text-slate-500">Official Rule Text</label>
                                <textarea className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" rows="4" value={rule.text || ""} onChange={(event) => updateLeagueRuleItem(section.id, rule.id, "text", event.target.value)} placeholder="Write the official rule exactly how the commissioner wants it documented." />
                              </div>
                              <div className="mt-3">
                                <label className="text-xs font-semibold uppercase text-slate-500">Commissioner Note / Clarification</label>
                                <input className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" value={rule.note || ""} onChange={(event) => updateLeagueRuleItem(section.id, rule.id, "note", event.target.value)} placeholder="Optional note, clarification, penalty, or example" />
                              </div>
                            </div>
                          ))}
                          {(!section.rules || section.rules.length === 0) && (
                            <div className="rounded-xl border bg-slate-50 p-5 text-center text-sm text-slate-500">
                              No rules in this section yet. Click Add Rule to add the first official rule under {section.title || "this section"}.
                            </div>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}

                  {selectedLeagueRuleSections.length === 0 && (
                    <Card>
                      <div className="p-8 text-center">
                        <h2 className="text-2xl font-black">Create your league rules manual</h2>
                        <p className="mx-auto mt-2 max-w-2xl text-sm text-slate-500">Start by adding sections such as Gameplay Rules and League Setup. Each section becomes part of the table of contents and can contain as many official rules as needed.</p>
                        <div className="mt-4">
                          <button
                            type="button"
                            onClick={addLeagueRuleSection}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
                          >
                            + Add First Section
                          </button>
                        </div>
                      </div>
                    </Card>
                  )}
                </div>
              </div>
            </fieldset>
          </div>
        )}

        {activePage === "fields" && selectedLeague && (
          <div className="space-y-4">
            <Card>
              <div className="p-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h2 className="text-xl font-bold">Fields</h2>
                    <p className="text-sm text-slate-500">Manage fields for each league. Fields can be copied from this league to another league.</p>
                    {fieldsHaveUnsavedChanges && <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-900">Unsaved field changes — click Save Fields before leaving to apply them.</p>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <select className="rounded-xl border px-3 py-2 text-sm font-semibold" value={selectedLeague.id} onChange={(event) => setSelectedLeagueId(event.target.value)}>
                      {leagues.map((league) => <option key={league.id} value={league.id}>{league.name}</option>)}
                    </select>
                    {fieldsHaveUnsavedChanges && <Button variant="primary" onClick={saveLeagueDraftChanges}>Save Fields</Button>}
                    {fieldsHaveUnsavedChanges && <Button variant="outline" onClick={discardLeagueDraftChanges}>Discard Fields</Button>}
                    <Button variant="primary" onClick={addLeagueField}>+ Add Field</Button>
                  </div>
                </div>
              </div>
            </Card>

            <Card>
              <div className="p-5">
                <h2 className="mb-3 text-xl font-bold">Add Fields From Another League</h2>
                <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
                  <div>
                    <label className="text-xs font-semibold uppercase text-slate-500">Source League</label>
                    <select className="mt-1 w-full rounded-xl border px-3 py-2" value={fieldImportSourceLeagueId} onChange={(event) => { setFieldImportSourceLeagueId(event.target.value); setSelectedImportFieldIds([]); }}>
                      <option value="">Select source league</option>
                      {leagues.filter((league) => league.id !== selectedLeague.id).map((league) => <option key={league.id} value={league.id}>{league.name}</option>)}
                    </select>
                  </div>
                  <Button variant="outline" disabled={selectedImportFieldIds.length === 0} onClick={addSelectedFieldsFromLeague}>Add Selected Fields</Button>
                </div>
                {fieldImportSourceLeague && (
                  <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {(fieldImportSourceLeague.fields || []).map((field) => (
                      <label key={field.id} className="flex items-start gap-2 rounded-xl border bg-slate-50 p-3 text-sm">
                        <input type="checkbox" checked={selectedImportFieldIds.includes(field.id)} onChange={(event) => toggleImportField(field.id, event.target.checked)} />
                        <span>
                          <span className="block font-bold">{field.name}</span>
                          {field.address && <span className="block text-xs text-slate-500">{field.address}</span>}
                          {field.notes && <span className="block text-xs text-slate-500">{field.notes}</span>}
                        </span>
                      </label>
                    ))}
                    {(!fieldImportSourceLeague.fields || fieldImportSourceLeague.fields.length === 0) && <p className="rounded-xl border bg-slate-50 p-3 text-sm text-slate-500">That league has no fields to import.</p>}
                  </div>
                )}
              </div>
            </Card>

            <Card>
              <div className="p-5">
                <h2 className="mb-3 text-xl font-bold">{selectedLeague.name} Fields</h2>
                <div className="space-y-3">
                  {(selectedLeague.fields || []).map((field) => (
                    <div key={field.id} className="grid gap-3 rounded-xl border bg-slate-50 p-3 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end">
                      <div>
                        <label className="text-xs font-semibold uppercase text-slate-500">Field Name</label>
                        <input className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" value={field.name} onChange={(event) => updateLeagueField(field.id, "name", event.target.value)} />
                        <label className="mt-2 flex items-center gap-2 text-xs font-semibold text-slate-600">
                          <input type="checkbox" checked={Boolean(field.isMain)} onChange={() => setLeagueMainField(field.id)} />
                          Main Field
                        </label>
                      </div>
                      <div>
                        <label className="text-xs font-semibold uppercase text-slate-500">Address</label>
                        <input className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" value={field.address || ""} onChange={(event) => updateLeagueField(field.id, "address", event.target.value)} placeholder="Optional" />
                      </div>
                      <div>
                        <label className="text-xs font-semibold uppercase text-slate-500">Notes</label>
                        <input className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" value={field.notes || ""} onChange={(event) => updateLeagueField(field.id, "notes", event.target.value)} placeholder="Optional" />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Button variant="outline" onClick={() => addFieldRule(field.id)}>+ Rule</Button>
                        <Button variant="outline" onClick={() => removeLeagueField(field.id)}>Remove</Button>
                      </div>
                      <div className="md:col-span-4">
                        <div className="mt-2 rounded-xl border bg-white p-3">
                          <div className="mb-2 text-sm font-bold">Field Rules</div>
                          <div className="space-y-2">
                            {(field.rules || []).map((rule) => (
                              <div key={rule.id} className="rounded-lg border bg-slate-50 p-3">
                                <div className={`grid gap-2 ${fieldRuleHasRunAction(rule) && fieldRuleHasAutomaticOut(rule) ? "md:grid-cols-[1fr_8rem_8rem_auto]" : fieldRuleHasRunAction(rule) || fieldRuleHasAutomaticOut(rule) ? "md:grid-cols-[1fr_8rem_auto]" : "md:grid-cols-[1fr_auto]"} md:items-end`}>
                                  <div>
                                    <label className="text-xs font-semibold uppercase text-slate-500">Rule Name</label>
                                    <input className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" value={rule.name || ""} onChange={(event) => updateFieldRule(field.id, rule.id, "name", event.target.value)} />
                                  </div>
                                  {fieldRuleHasRunAction(rule) && (
                                    <div>
                                      <label className="text-xs font-semibold uppercase text-slate-500">Bonus Runs</label>
                                      <input type="number" className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" value={rule.runs ?? 1} onChange={(event) => updateFieldRule(field.id, rule.id, "runs", event.target.value)} />
                                    </div>
                                  )}
                                  {fieldRuleHasAutomaticOut(rule) && (
                                    <div>
                                      <label className="text-xs font-semibold uppercase text-slate-500">Outs</label>
                                      <input type="number" min="1" max="3" className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" value={rule.outs ?? 1} onChange={(event) => updateFieldRule(field.id, rule.id, "outs", Math.max(1, Math.min(3, Number(event.target.value) || 1)))} />
                                    </div>
                                  )}
                                  <Button variant="outline" onClick={() => removeFieldRule(field.id, rule.id)}>Remove</Button>
                                </div>

                                <div className="mt-3">
                                  <label className="text-xs font-semibold uppercase text-slate-500">Rule Description</label>
                                  <textarea className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" rows="2" value={rule.description || ""} onChange={(event) => updateFieldRule(field.id, rule.id, "description", event.target.value)} placeholder="Explain when this rule applies or what the scorer should check before approving." />
                                </div>

                                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                                  {fieldRuleActionOptions.map((option) => {
                                    const actions = getFieldRuleActions(rule);
                                    const checked = actions.includes(option.value);
                                    return (
                                      <label key={option.value} className="flex items-center gap-2 rounded-xl border bg-white p-2 text-xs font-semibold text-slate-600">
                                        <input
                                          type="checkbox"
                                          checked={checked}
                                          onChange={(event) => updateFieldRule(field.id, rule.id, "actions", toggleFieldRuleAction(actions, option.value, event.target.checked))}
                                        />
                                        {option.label}
                                      </label>
                                    );
                                  })}
                                </div>

                                {fieldRuleHasRunAction(rule) && (
                                  <label className="mt-3 flex items-center gap-2 rounded-xl border bg-white p-2 text-xs font-semibold text-slate-600">
                                    <input
                                      type="checkbox"
                                      checked={Boolean(rule.countBonusRunsAsRbi)}
                                      onChange={(event) => updateFieldRule(field.id, rule.id, "countBonusRunsAsRbi", event.target.checked)}
                                    />
                                    Bonus runs count as RBI for current batter
                                  </label>
                                )}
                                <p className="mt-2 text-xs text-slate-500">Selected: {fieldRuleActionSummary(rule) || "No actions selected"}</p>
                              </div>
                            ))}
                            {(!field.rules || field.rules.length === 0) && <p className="text-sm text-slate-500">No field rules yet. Add a rule to show it as a shortcut on the Score Game page when this field is selected.</p>}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {(!selectedLeague.fields || selectedLeague.fields.length === 0) && <p className="rounded-xl border bg-slate-50 p-3 text-sm text-slate-500">No fields yet. Add one to make it available in Game Setup.</p>}
                </div>
              </div>
            </Card>
          </div>
        )}

        {activePage === "players" && (
          <div className="space-y-4">
            <Card>
              <div className="p-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h2 className="text-xl font-bold">Players</h2>
                    <p className="text-sm text-slate-500">Manage the shared player list. Click a player to edit details, height, photos, handedness, and which leagues they belong to.</p>
                    {playerPageHasUnsavedChanges && <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-900">Unsaved player changes — save before leaving this page.</p>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {playerPageHasUnsavedChanges && <Button variant="primary" onClick={() => requestPlayerPageSave("stay")}>Save Players</Button>}
                    {playerPageHasUnsavedChanges && <Button variant="outline" onClick={discardPlayerPageChanges}>Discard Changes</Button>}
                    <Button variant="primary" onClick={addGlobalPlayerDraft}>+ Add Player</Button>
                  </div>
                </div>
              </div>
            </Card>

            <Card>
              <div className="p-5">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="text-xl font-bold">Player List</h2>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black uppercase text-slate-500">{playerPageRecords.length} Players</span>
                </div>
                <div className="overflow-hidden rounded-2xl border bg-white">
                  <div className="grid grid-cols-[1fr_7rem_1fr] gap-2 border-b bg-slate-50 px-3 py-2 text-xs font-black uppercase text-slate-500 md:grid-cols-[1fr_7rem_7rem_7rem_1.5fr]">
                    <div>Name</div>
                    <div>Height</div>
                    <div className="hidden md:block">Throws</div>
                    <div className="hidden md:block">Hits</div>
                    <div>Leagues</div>
                  </div>
                  <div className="divide-y">
                    {playerPageRecords.map((player, index) => {
                      const heightLabel = player.heightFeet || player.heightInches ? `${player.heightFeet || 0}' ${player.heightInches || 0}\"` : "—";
                      const leagueNames = (player.leagueIds || []).map((leagueId) => leagues.find((league) => league.id === leagueId)?.name).filter(Boolean).join(", ") || "No leagues";
                      return (
                        <button key={player.key || player.id || index} type="button" className="grid w-full grid-cols-[1fr_7rem_1fr] gap-2 px-3 py-3 text-left text-sm transition hover:bg-slate-50 md:grid-cols-[1fr_7rem_7rem_7rem_1.5fr]" onClick={() => { ensurePlayerDrafts(); setSelectedPlayerDraftKey(player.key); }}>
                          <div className="flex min-w-0 items-center gap-3 font-bold">
                            <PlayerAvatar playerName={player.name || `Player ${index + 1}`} profile={player} size="sm" />
                            <span className="truncate">{player.name || `Player ${index + 1}`}</span>
                          </div>
                          <div className="self-center font-semibold text-slate-600">{heightLabel}</div>
                          <div className="hidden self-center font-semibold text-slate-600 md:block">{handednessLabel(player.pitches || "R")}</div>
                          <div className="hidden self-center font-semibold text-slate-600 md:block">{handednessLabel(player.bats || "R")}</div>
                          <div className="self-center truncate text-xs font-semibold text-slate-500">{leagueNames}</div>
                        </button>
                      );
                    })}
                    {playerPageRecords.length === 0 && <div className="p-5 text-sm text-slate-500">No players yet. Add a player to start building your league database.</div>}
                  </div>
                </div>
              </div>
            </Card>

            {selectedPlayerDraft && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
                <div className="max-h-[92vh] w-full max-w-2xl overflow-auto rounded-3xl bg-white p-5 shadow-xl">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-black uppercase tracking-wide text-slate-500">Edit Player</div>
                      <h2 className="mt-1 text-2xl font-black">{selectedPlayerDraft.name || "New Player"}</h2>
                    </div>
                    <Button variant="outline" onClick={() => setSelectedPlayerDraftKey("")}>Close</Button>
                  </div>

                  <div className="grid gap-4 md:grid-cols-[9rem_1fr]">
                    <div className="rounded-2xl border bg-slate-50 p-3 text-center">
                      <div className="flex justify-center"><PlayerAvatar playerName={selectedPlayerDraft.name || "Player"} profile={selectedPlayerDraft} size="lg" /></div>
                      <label className="mt-3 inline-flex cursor-pointer items-center justify-center rounded-xl border bg-white px-3 py-2 text-xs font-bold hover:bg-slate-50">
                        Upload Photo
                        <input type="file" accept="image/*" className="hidden" onChange={(event) => updateGlobalPlayerPhoto(selectedPlayerDraft.key, event.target.files?.[0])} />
                      </label>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <label className="text-xs font-semibold uppercase text-slate-500">Name</label>
                        <input className="mt-1 w-full rounded-xl border px-3 py-2 text-sm font-semibold" value={selectedPlayerDraft.name || ""} onChange={(event) => updatePlayerDraft(selectedPlayerDraft.key, "name", event.target.value)} placeholder="Player name" />
                      </div>
                      <div>
                        <label className="text-xs font-semibold uppercase text-slate-500">Phone Number</label>
                        <input className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" value={selectedPlayerDraft.phone || ""} onChange={(event) => updatePlayerDraft(selectedPlayerDraft.key, "phone", event.target.value)} placeholder="Optional phone number" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs font-semibold uppercase text-slate-500">Height Feet</label>
                          <input type="number" min="0" className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" value={selectedPlayerDraft.heightFeet ?? ""} onChange={(event) => updatePlayerDraft(selectedPlayerDraft.key, "heightFeet", event.target.value)} placeholder="Ft" />
                        </div>
                        <div>
                          <label className="text-xs font-semibold uppercase text-slate-500">Height Inches</label>
                          <input type="number" min="0" max="11" className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" value={selectedPlayerDraft.heightInches ?? ""} onChange={(event) => updatePlayerDraft(selectedPlayerDraft.key, "heightInches", event.target.value)} placeholder="In" />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-semibold uppercase text-slate-500">Bats</label>
                        <select className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" value={selectedPlayerDraft.bats || "R"} onChange={(event) => updatePlayerDraft(selectedPlayerDraft.key, "bats", event.target.value)}>
                          <option value="R">Right</option>
                          <option value="L">Left</option>
                          <option value="B">Both</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-semibold uppercase text-slate-500">Pitches</label>
                        <select className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" value={selectedPlayerDraft.pitches || "R"} onChange={(event) => updatePlayerDraft(selectedPlayerDraft.key, "pitches", event.target.value)}>
                          <option value="R">Right</option>
                          <option value="L">Left</option>
                          <option value="B">Both</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 rounded-2xl border bg-slate-50 p-4">
                    <h3 className="mb-2 text-sm font-black uppercase text-slate-500">Leagues This Player Is In</h3>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {leagues.map((league) => (
                        <label key={`player-league-${league.id}`} className="flex items-center gap-2 rounded-xl border bg-white p-3 text-sm font-semibold">
                          <input type="checkbox" checked={(selectedPlayerDraft.leagueIds || []).includes(league.id)} onChange={(event) => togglePlayerDraftLeague(selectedPlayerDraft.key, league.id, event.target.checked)} />
                          {league.name}
                        </label>
                      ))}
                    </div>
                    <p className="mt-2 text-xs text-slate-500">Removing a player from a league will also remove that player from team rosters, batting orders, pitching orders, and captain slots for that league when you save.</p>
                  </div>

                  <div className="mt-5 flex flex-wrap justify-between gap-2">
                    <Button variant="danger" onClick={() => removeGlobalPlayerDraft(selectedPlayerDraft.key)}>Delete Player</Button>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" onClick={() => setSelectedPlayerDraftKey("")}>Done Editing</Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activePage === "league" && selectedLeague && (
          <div className="space-y-4">
            <Card>
              <div className="p-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-center gap-3">
                    {selectedLeague.logoUrl && (
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border bg-white">
                        <img src={selectedLeague.logoUrl} alt={`${selectedLeague.name} logo`} className="h-full w-full object-contain" />
                      </div>
                    )}
                    <div>
                      <h2 className="text-xl font-bold">League</h2>
                      <p className="text-sm text-slate-500">Create leagues, manage setup, default rules, teams, players, and history.</p>
                    {leagueHasUnsavedChanges && <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-900">Unsaved league changes — click Save Changes before leaving to apply them.</p>}
                    {leagueSettingsLocked && <p className="mt-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-800">League settings can not be changed during an active draft.</p>}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <select className="rounded-xl border px-3 py-2 text-sm font-semibold" value={selectedLeague.id} onChange={(event) => handleSelectedLeagueChange(event.target.value)}>
                      {leagues.map((league) => <option key={league.id} value={league.id}>{league.name}</option>)}
                    </select>
                    {leagueHasUnsavedChanges && <Button variant="primary" onClick={saveLeagueDraftChanges}>Save Changes</Button>}
                    {leagueHasUnsavedChanges && <Button variant="outline" onClick={discardLeagueDraftChanges}>Discard Changes</Button>}
                    <Button variant="primary" onClick={createLeague} disabled={leagueSettingsLocked}>+ New League</Button>
                    <Button variant="danger" onClick={deleteSelectedLeague} disabled={leagueSettingsLocked}>Delete League</Button>
                  </div>
                </div>
              </div>
            </Card>

            {leagueSettingsLocked && (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800">
                League settings can not be changed during an active draft. League Setup, Season, Teams, Players, Default Game Rules, and history settings are locked until the draft is completed or restarted.
              </div>
            )}
            <fieldset disabled={leagueSettingsLocked} aria-disabled={leagueSettingsLocked} className={leagueSettingsLocked ? "pointer-events-none select-none opacity-50" : ""}>
            <Card>
              <details className="group" open>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5">
                  <div>
                    <h2 className="text-xl font-bold">League Setup</h2>
                    <p className="text-sm text-slate-500">League name, current season, teams, divisions, and roster size.</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase text-slate-500 group-open:hidden">Open</span>
                  <span className="hidden rounded-full bg-slate-900 px-3 py-1 text-xs font-bold uppercase text-white group-open:inline-block">Close</span>
                </summary>
                <div className="border-t p-5 pt-4">
                  <div className="mb-4 rounded-2xl border bg-slate-50 p-4">
                    <label className="text-xs font-semibold uppercase text-slate-500">League Logo</label>
                    <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center">
                      <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl border bg-white">
                        {selectedLeague.logoUrl ? (
                          <img src={selectedLeague.logoUrl} alt={`${selectedLeague.name || "League"} logo`} className="h-full w-full object-contain" />
                        ) : (
                          <span className="text-xs font-semibold text-slate-400">No Logo</span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <label className="inline-flex cursor-pointer items-center justify-center rounded-xl border bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50">
                          Upload League Logo
                          <input type="file" accept="image/*" className="hidden" onChange={(event) => updateLeagueLogo(event.target.files?.[0])} />
                        </label>
                        {selectedLeague.logoUrl && <Button variant="outline" onClick={clearLeagueLogo}>Remove Logo</Button>}
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-5">
                    <div>
                      <label className="text-xs font-semibold uppercase text-slate-500">League Name</label>
                      <input className="mt-1 w-full rounded-xl border px-3 py-2" value={selectedLeague.name} onChange={(event) => updateLeagueName(event.target.value)} />
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase text-slate-500">Current Season</label>
                      <input type="number" className="mt-1 w-full rounded-xl border px-3 py-2" value={selectedLeague.currentSeasonYear || currentYearNumber()} onChange={(event) => updateLeagueCurrentSeasonYear(event.target.value)} />
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase text-slate-500">Number of Teams</label>
                      <input type="number" min="1" className="mt-1 w-full rounded-xl border px-3 py-2" value={selectedLeague.teamCount} onChange={(event) => updateLeagueTeamCount(event.target.value)} />
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase text-slate-500">Players per Team</label>
                      <input type="number" min="1" className="mt-1 w-full rounded-xl border px-3 py-2" value={selectedLeague.playersPerTeam} onChange={(event) => updateLeaguePlayersPerTeam(event.target.value)} />
                    </div>
                    <div className="rounded-xl border bg-slate-50 p-3">
                      <label className="flex items-center gap-2 text-sm font-semibold">
                        <input type="checkbox" checked={(selectedLeague.divisionCount || 0) > 0} onChange={(event) => updateLeagueDivisionsEnabled(event.target.checked)} />
                        Enable Divisions
                      </label>
                      {(selectedLeague.divisionCount || 0) > 0 && (
                        <div className="mt-3">
                          <label className="text-xs font-semibold uppercase text-slate-500">Number of Divisions</label>
                          <input type="number" min="2" className="mt-1 w-full rounded-xl border px-3 py-2" value={Math.max(2, selectedLeague.divisionCount || 2)} onChange={(event) => updateLeagueDivisionCount(event.target.value)} />
                        </div>
                      )}
                    </div>
                  </div>

                  {(selectedLeague.divisionCount || 0) > 0 && (
                    <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                      {makeDivisionNames(selectedLeague.divisionCount || 0, selectedLeague.divisions || []).map((division, index) => (
                        <div key={`division-${index}`}>
                          <label className="text-xs font-semibold uppercase text-slate-500">Division {index + 1} Name</label>
                          <input className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" value={division} onChange={(event) => updateLeagueDivisionName(index, event.target.value)} />
                        </div>
                      ))}
                    </div>
                  )}
                  {(selectedLeague.divisionCount || 0) === 0 && <p className="mt-4 rounded-xl border bg-slate-50 p-3 text-sm text-slate-500">Divisions are turned off for this league.</p>}
                </div>
              </details>
            </Card>

            <Card>
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5">
                  <div>
                    <h2 className="text-xl font-bold">Season</h2>
                    <p className="text-sm text-slate-500">Manage seasons, sessions, roster carryover, awards, and legacy points.</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase text-slate-500 group-open:hidden">Open</span>
                  <span className="hidden rounded-full bg-slate-900 px-3 py-1 text-xs font-bold uppercase text-white group-open:inline-block">Close</span>
                </summary>
                <div className="border-t p-5 pt-4">
                  <div className="space-y-4">
                    {(selectedLeague.years || []).map(normalizeSeasonRecord).map((season) => (
                      <div key={season.id} className="rounded-2xl border bg-slate-50 p-4">
                        <div className="grid gap-3 md:grid-cols-[8rem_1fr_12rem] md:items-end">
                          <div>
                            <label className="text-xs font-semibold uppercase text-slate-500">Season Year</label>
                            <button type="button" className="mt-1 w-full rounded-xl border bg-white px-3 py-2 text-left text-sm font-semibold hover:bg-slate-50" onClick={() => openYearPicker(season.id, season.year, "Select Season Year")}>{season.year}</button>
                          </div>
                          <div>
                            <label className="text-xs font-semibold uppercase text-slate-500">Season Notes</label>
                            <input className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" value={season.notes || ""} onChange={(event) => updateLeagueYear(season.id, "notes", event.target.value)} placeholder="Champion, major changes, season notes, etc." />
                          </div>
                          <div>
                            <label className="text-xs font-semibold uppercase text-slate-500">Current Session</label>
                            <select className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" value={season.currentSessionId || season.sessions[0]?.id || ""} disabled={!season.sessionsEnabled} onChange={(event) => updateLeagueCurrentSession(season.id, event.target.value)}>
                              {season.sessions.map((session) => <option key={session.id} value={session.id}>{session.name}</option>)}
                            </select>
                          </div>
                        </div>

                        <div className="mt-4 rounded-xl border bg-white p-3">
                          <div className="grid gap-3 md:grid-cols-3 md:items-center">
                            <label className="flex items-center gap-2 text-sm font-semibold">
                              <input type="checkbox" checked={Boolean(season.sessionsEnabled)} onChange={(event) => updateLeagueYear(season.id, "sessionsEnabled", event.target.checked)} />
                              Use sessions within this season
                            </label>
                            {season.sessionsEnabled && (
                              <div>
                                <label className="text-xs font-semibold uppercase text-slate-500">Number of Sessions</label>
                                <input type="number" min="2" className="mt-1 w-full rounded-xl border px-3 py-2 text-sm font-semibold" value={Math.max(2, season.sessionCount || 2)} onChange={(event) => updateLeagueYear(season.id, "sessionCount", event.target.value)} />
                              </div>
                            )}
                            {season.sessionsEnabled && (
                              <>
                                <label className="flex items-center gap-2 text-sm font-semibold">
                                  <input type="checkbox" checked={Boolean(season.keepRostersForSessions)} onChange={(event) => updateLeagueYear(season.id, "keepRostersForSessions", event.target.checked)} />
                                  Keep rosters from session to session
                                </label>
                                <label className="flex items-center gap-2 text-sm font-semibold">
                                  <input type="checkbox" checked={season.keepTeamIdentityForSessions !== false} onChange={(event) => updateLeagueYear(season.id, "keepTeamIdentityForSessions", event.target.checked)} />
                                  Keep team names and logos from session to session
                                </label>
                              </>
                            )}
                          </div>
                          {season.sessionsEnabled && (
                            <div className="mt-3 space-y-2">
                              {season.sessions.map((session, index) => (
                                <div key={session.id} className="grid gap-2 rounded-xl border bg-slate-50 p-3 md:grid-cols-[10rem_1fr]">
                                  <div>
                                    <label className="text-xs font-semibold uppercase text-slate-500">Session {index + 1}</label>
                                    <input className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" value={session.name} onChange={(event) => updateLeagueSeasonSession(season.id, session.id, "name", event.target.value)} />
                                  </div>
                                  <div>
                                    <label className="text-xs font-semibold uppercase text-slate-500">Roster Notes</label>
                                    <input className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" value={session.rosterNotes || ""} onChange={(event) => updateLeagueSeasonSession(season.id, session.id, "rosterNotes", event.target.value)} placeholder="Optional roster changes for this session" />
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                          {!season.sessionsEnabled && <p className="mt-2 text-xs text-slate-500">Sessions are off. This season uses one roster setup for the full season.</p>}
                        </div>

                        <div className="mt-4 rounded-xl border bg-white p-3">
                          <h3 className="text-lg font-bold">Draft Availability</h3>
                          <p className="text-sm text-slate-500">Enable draft here before using a real draft on the Draft page. When enabled, non-captain roster assignment is locked and players must be added through the draft.</p>
                          <div className="mt-3 space-y-2">
                            {(season.sessionsEnabled ? season.sessions : [{ id: season.currentSessionId || season.sessions?.[0]?.id || "default-session", name: "Season Draft" }]).map((session) => {
                              const sessionDraft = normalizeDraftSettings(season.drafts?.[session.id], selectedLeague, session.id);
                              const sessionDraftStarted = hasDraftStarted(sessionDraft);
                              return (
                                <label key={`draft-enabled-${season.id}-${session.id}`} className="flex items-center justify-between gap-3 rounded-xl border bg-slate-50 p-3 text-sm font-semibold">
                                  <span>
                                    <span className="block font-black">{session.name}</span>
                                    <span className="block text-xs font-normal text-slate-500">{sessionDraftStarted ? "Draft started — setting locked." : "Enable this session for real draft use."}</span>
                                  </span>
                                  <input
                                    type="checkbox"
                                    checked={Boolean(sessionDraft.enabled)}
                                    disabled={sessionDraftStarted}
                                    onChange={(event) => updateLeagueDraftEnabledForSession(season.id, session.id, event.target.checked)}
                                  />
                                </label>
                              );
                            })}
                          </div>
                        </div>

                        <div className="mt-4 rounded-xl border bg-white p-3">
                          <div className="mb-3 flex items-center justify-between gap-2">
                            <div>
                              <h3 className="text-lg font-bold">Final Award Winners</h3>
                              <p className="text-sm text-slate-500">Legacy Points from awards are counted in the Legacy Points leaderboard only.</p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Button variant="outline" onClick={() => saveSeasonAwardsAsDefaults(season.id)}>Save Defaults</Button>
                              <Button variant="outline" onClick={() => addSeasonAward(season.id)}>+ Add Category</Button>
                            </div>
                          </div>
                          <div className="space-y-2">
                            {(season.awards || []).map((award) => (
                              <div key={award.id} className="grid gap-2 rounded-xl border bg-slate-50 p-3 md:grid-cols-[1fr_1fr_8rem_auto] md:items-end">
                                <div>
                                  <label className="text-xs font-semibold uppercase text-slate-500">Award Category</label>
                                  <input className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" value={award.category || ""} onChange={(event) => updateSeasonAward(season.id, award.id, "category", event.target.value)} />
                                </div>
                                <div>
                                  <label className="text-xs font-semibold uppercase text-slate-500">Winner</label>
                                  <select className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" value={award.winner || ""} onChange={(event) => updateSeasonAward(season.id, award.id, "winner", event.target.value)}>
                                    <option value="">Select winner</option>
                                    {selectedLeaguePlayerOptions.map((player) => <option key={player} value={player}>{player}</option>)}
                                  </select>
                                </div>
                                <div>
                                  <label className="text-xs font-semibold uppercase text-slate-500">Legacy Pts</label>
                                  <select className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" value={award.legacyPoints || 1} onChange={(event) => updateSeasonAward(season.id, award.id, "legacyPoints", event.target.value)}>
                                    <option value="1">1</option>
                                    <option value="2">2</option>
                                    <option value="3">3</option>
                                  </select>
                                </div>
                                <Button variant="outline" onClick={() => removeSeasonAward(season.id, award.id)}>Remove</Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </details>
            </Card>
            <Card>
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5">
                  <div>
                    <h2 className="text-xl font-bold">Teams</h2>
                    <p className="text-sm text-slate-500">Assign database players to teams and set default batting/pitching orders.</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase text-slate-500 group-open:hidden">Open</span>
                  <span className="hidden rounded-full bg-slate-900 px-3 py-1 text-xs font-bold uppercase text-white group-open:inline-block">Close</span>
                </summary>
                <div className="border-t p-5 pt-4">
                  <div className="mb-4 rounded-xl border bg-slate-50 p-3">
                    <label className="flex items-center gap-2 text-sm font-semibold">
                      <input type="checkbox" checked={leagueCaptainsEnabled} onChange={(event) => updateLeagueCaptainsEnabled(event.target.checked)} />
                      Enable Team Captains
                    </label>
                    <p className="mt-1 text-xs text-slate-500">When enabled, each team can choose one captain who stays on that team across sessions.</p>
                  </div>
                  {selectedCurrentSeason.sessionsEnabled && (
                    <div className="mb-4 rounded-xl border bg-slate-50 p-3">
                      <label className="text-xs font-semibold uppercase text-slate-500">Viewing Teams For Session</label>
                      <select className="mt-1 w-full rounded-xl border px-3 py-2 text-sm font-semibold" value={visibleLeagueTeamsSessionId} onChange={(event) => setSelectedLeagueTeamsSessionId(event.target.value)}>
                        {selectedCurrentSeason.sessions.map((session) => <option key={session.id} value={session.id}>{session.name}</option>)}
                      </select>
                      <p className="mt-1 text-xs text-slate-500">
                        {sessionRosterMode
                          ? `Because this season does not keep rosters from session to session, roster edits are saved to the selected session. Team names/logos ${keepTeamIdentityForSessions ? "stay the same across sessions" : "can also change by session"}.`
                          : "This season keeps rosters from session to session, so this selector is for viewing/confirming the active session only."}
                        {leagueCaptainsEnabled ? " Captains stay with their team every session." : " Team captains are disabled."}
                      </p>
                    </div>
                  )}
                  {selectedLeagueDuplicateAssignments.length > 0 && (
                    <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                      <div className="font-bold">Duplicate roster assignments found for the current season.</div>
                      <ul className="mt-2 list-disc pl-5">
                        {selectedLeagueDuplicateAssignments.map(({ player, assignments }) => (
                          <li key={player}>{player}: {assignments.map((assignment) => assignment.teamName).join(", ")}</li>
                        ))}
                      </ul>
                      <p className="mt-2 text-xs">Select a different player in one of the highlighted teams. New selections are blocked from creating duplicates.</p>
                    </div>
                  )}
                  <div className="grid gap-4 xl:grid-cols-2">
                    {selectedLeague.teams.map((team, teamIndex) => (
                      <LeagueTeamEditor
                        key={team.id}
                        team={getTeamRosterForSession(team, activeLeagueTeamsSessionId, keepTeamIdentityForSessions)}
                        teamIndex={teamIndex}
                        playersPerTeam={selectedLeague.playersPerTeam}
                        divisions={makeDivisionNames(selectedLeague.divisionCount || 0, selectedLeague.divisions || [])}
                        playerOptions={selectedLeaguePlayerOptions}
                        playerAssignments={selectedLeaguePlayerAssignments}
                        captainsEnabled={leagueCaptainsEnabled}
                        captainValueLocked={captainValueLockedForCurrentSeason}
                        captainValueEnabled={leagueDraftEnabledForActiveSession}
                        rosterAssignmentLocked={teamRosterLockedByDraftEnabled}
                        onBlockedRosterAssignment={(playerName, team) => setBlockedRosterAssignment({ player: playerName, teamName: team?.name || `Team ${teamIndex + 1}` })}
                        onTeamNameChange={updateLeagueTeamName}
                        onTeamDivisionChange={updateLeagueTeamDivision}
                        onLogoUpload={updateLeagueTeamLogo}
                        onPlayerChange={updateLeaguePlayer}
                        onCaptainChange={updateLeagueTeamCaptain}
                        onCaptainValueChange={updateLeagueTeamCaptainValue}
                        onMoveDefaultBatting={(teamIndex, index, direction) => moveLeagueTeamOrder(teamIndex, "battingOrder", index, direction)}
                        onMoveDefaultPitching={(teamIndex, index, direction) => moveLeagueTeamOrder(teamIndex, "pitchingOrder", index, direction)}
                      />
                    ))}
                  </div>
                </div>
              </details>
            </Card>


            <Card>
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5">
                  <div>
                    <h2 className="text-xl font-bold">Default Game Rules</h2>
                    <p className="text-sm text-slate-500">These settings can be used as the default rules for every new game in this league.</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase text-slate-500 group-open:hidden">Open</span>
                  <span className="hidden rounded-full bg-slate-900 px-3 py-1 text-xs font-bold uppercase text-white group-open:inline-block">Close</span>
                </summary>
                <div className="border-t p-5 pt-4">
                  <div className="mb-3 rounded-xl border bg-slate-50 p-3">
                    <label className="text-xs font-semibold uppercase text-slate-500">Default Game Length</label>
                    <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
                      <span className="text-sm font-semibold text-slate-700">Innings per game</span>
                      <input type="number" min="1" max="12" className="w-28 rounded-xl border px-3 py-2 text-sm font-semibold" value={selectedLeagueDefaultRules.gameInnings || 4} onChange={(event) => updateLeagueDefaultGameRule("gameInnings", Math.max(1, Number(event.target.value) || 1))} />
                    </div>
                    <p className="mt-1 text-xs text-slate-500">New games using league defaults will use this inning length.</p>
                  </div>
                  <div className="grid gap-3 lg:grid-cols-3">
                    <div className="rounded-xl border bg-slate-50 p-3">
                      <label className="flex items-center gap-2 text-sm font-semibold">
                        <input type="checkbox" checked={selectedLeagueDefaultRules.powerPlaysEnabled} onChange={(event) => updateLeagueDefaultGameRule("powerPlaysEnabled", event.target.checked)} />
                        Enable Power Plays
                      </label>
                      <p className="mt-1 text-xs text-slate-500">This controls whether Power Play and Whammy options are available by default.</p>
                      {selectedLeagueDefaultRules.powerPlaysEnabled && (
                        <div className="mt-3 space-y-3">
                          <RuleLimitEditor title="Power Play Limit" limitType={selectedLeagueDefaultRules.powerPlayLimitType} setLimitType={(value) => updateLeagueDefaultGameRule("powerPlayLimitType", value)} limitAmount={selectedLeagueDefaultRules.powerPlayLimitAmount} setLimitAmount={(value) => updateLeagueDefaultGameRule("powerPlayLimitAmount", value)} />
                          <label className="flex items-center gap-2 rounded-lg border bg-white p-3 text-sm font-semibold">
                            <input type="checkbox" checked={selectedLeagueDefaultRules.whammysEnabled} onChange={(event) => updateLeagueDefaultGameRule("whammysEnabled", event.target.checked)} />
                            Enable Whammys
                          </label>
                          <p className="text-xs text-slate-500">Whammy can only be used once per game which will take the place of 1 power play. A Whammy walk does not block the Power Play.</p>
                        </div>
                      )}
                    </div>

                    <div className="rounded-xl border bg-slate-50 p-3">
                      <label className="flex items-center gap-2 text-sm font-semibold">
                        <input type="checkbox" checked={selectedLeagueDefaultRules.pudwhackerEnabled} onChange={(event) => updateLeagueDefaultGameRule("pudwhackerEnabled", event.target.checked)} />
                        Enable Pudwhacker
                      </label>
                      <p className="mt-1 text-xs text-slate-500">Pudwhacker remains once per game and only before the final inning.</p>
                    </div>

                    <div className="rounded-xl border bg-slate-50 p-3">
                      <label className="flex items-center gap-2 text-sm font-semibold">
                        <input type="checkbox" checked={selectedLeagueDefaultRules.runRuleEnabled} onChange={(event) => updateLeagueDefaultGameRule("runRuleEnabled", event.target.checked)} />
                        Enable inning run rule
                      </label>
                      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
                        <label className="text-xs font-semibold uppercase text-slate-500">Runs per half-inning</label>
                        <input type="number" min="1" className="w-28 rounded-xl border px-3 py-2 text-sm font-semibold" value={selectedLeagueDefaultRules.runRuleRuns} disabled={!selectedLeagueDefaultRules.runRuleEnabled} onChange={(event) => updateLeagueDefaultGameRule("runRuleRuns", Math.max(1, Number(event.target.value) || 1))} />
                      </div>
                      <label className="mt-3 flex items-center gap-2 text-sm font-semibold">
                        <input type="checkbox" checked={selectedLeagueDefaultRules.runRuleBeforeFourthOnly} disabled={!selectedLeagueDefaultRules.runRuleEnabled} onChange={(event) => updateLeagueDefaultGameRule("runRuleBeforeFourthOnly", event.target.checked)} />
                        {`Run rule only applies before the ${selectedLeagueDefaultRules.gameInnings || 4}${getOrdinalSuffix(selectedLeagueDefaultRules.gameInnings || 4)} inning`}
                      </label>
                      <label className="mt-3 flex items-center gap-2 text-sm font-semibold">
                        <input type="checkbox" checked={selectedLeagueDefaultRules.walkRunRuleCountsAsHr} disabled={!selectedLeagueDefaultRules.runRuleEnabled} onChange={(event) => updateLeagueDefaultGameRule("walkRunRuleCountsAsHr", event.target.checked)} />
                        Walk that triggers run rule counts as HR
                      </label>
                    </div>
                  </div>

                  <div className="mt-5 rounded-2xl border bg-white p-4">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <div>
                        <h3 className="text-lg font-bold">Default Extra Inning Ghost Runners</h3>
                        <p className="text-sm text-slate-500">These ghost-runner rules apply when a game uses league default game rules. For a {selectedLeagueDefaultRules.gameInnings || 4}-inning game, rules can start in the {getFirstExtraInning(selectedLeagueDefaultRules.gameInnings || 4)}{getOrdinalSuffix(getFirstExtraInning(selectedLeagueDefaultRules.gameInnings || 4))} inning or later.</p>
                      </div>
                      <Button variant="outline" onClick={addLeagueDefaultExtraRunnerRule}>+ Add Rule</Button>
                    </div>

                    {(selectedLeagueDefaultRules.extraRunnerRules || []).length === 0 ? (
                      <p className="rounded-xl border bg-slate-50 p-3 text-sm text-slate-500">No default extra-inning runner rules yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {(selectedLeagueDefaultRules.extraRunnerRules || []).map((rule) => (
                          <div key={rule.id} className="grid gap-2 rounded-xl border bg-slate-50 p-3 sm:grid-cols-[1fr_1.5fr_auto] sm:items-end">
                            <div>
                              <label className="text-xs font-semibold uppercase text-slate-500">Starting inning</label>
                              <input type="number" min={getFirstExtraInning(selectedLeagueDefaultRules.gameInnings || 4)} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm font-semibold" value={rule.startInning} onChange={(event) => updateLeagueDefaultExtraRunnerRule(rule.id, "startInning", event.target.value)} />
                            </div>
                            <div>
                              <label className="text-xs font-semibold uppercase text-slate-500">Bases to start inning</label>
                              <select className="mt-1 w-full rounded-xl border px-3 py-2 text-sm font-semibold" value={rule.bases} onChange={(event) => updateLeagueDefaultExtraRunnerRule(rule.id, "bases", event.target.value)}>
                                {extraBaseOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                              </select>
                            </div>
                            <div className="flex flex-col gap-2">
                              <label className="flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-xs font-semibold text-slate-600">
                                <input type="checkbox" checked={Boolean(rule.sameRestOfGame)} onChange={(event) => updateLeagueDefaultExtraRunnerRule(rule.id, "sameRestOfGame", event.target.checked)} />
                                Same rest of game
                              </label>
                              <Button variant="outline" onClick={() => removeLeagueDefaultExtraRunnerRule(rule.id)}>Remove</Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="mt-3 rounded-xl border bg-slate-50 p-3">
                      <label className="flex items-center gap-2 text-sm font-semibold">
                        <input type="checkbox" checked={selectedLeagueDefaultRules.ghostRunnersCountAsRbi} onChange={(event) => updateLeagueDefaultGameRule("ghostRunnersCountAsRbi", event.target.checked)} />
                        Ghost runners count as RBI by default
                      </label>
                    </div>
                  </div>
                </div>
              </details>
            </Card>

            <Card>
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5">
                  <div>
                    <h2 className="text-xl font-bold">Year-by-Year History</h2>
                    <p className="text-sm text-slate-500">Track league seasons by year.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={(event) => { event.preventDefault(); addLeagueYear(); }}>+ Add Year</Button>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase text-slate-500 group-open:hidden">Open</span>
                    <span className="hidden rounded-full bg-slate-900 px-3 py-1 text-xs font-bold uppercase text-white group-open:inline-block">Close</span>
                  </div>
                </summary>
                <div className="border-t p-5 pt-4">
                  <div className="space-y-2">
                    {selectedLeague.years.map((yearEntry) => (
                      <div key={yearEntry.id} className="grid gap-2 rounded-xl border bg-slate-50 p-3 md:grid-cols-[8rem_1fr]">
                        <div>
                          <label className="text-xs font-semibold uppercase text-slate-500">Year</label>
                          <button type="button" className="mt-1 w-full rounded-xl border bg-white px-3 py-2 text-left text-sm font-semibold hover:bg-slate-50" onClick={() => openYearPicker(yearEntry.id, yearEntry.year, "Select History Year")}>{yearEntry.year}</button>
                        </div>
                        <div>
                          <label className="text-xs font-semibold uppercase text-slate-500">Notes / History</label>
                          <input className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" value={yearEntry.notes} onChange={(event) => updateLeagueYear(yearEntry.id, "notes", event.target.value)} placeholder="Champion, runner-up, notes, major rule changes, etc." />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </details>
            </Card>
            </fieldset>
          </div>
        )}

        {pendingPlayerPageExit && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
            <div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-xl">
              <div className="text-xs font-black uppercase tracking-wide text-amber-600">Unsaved Player Changes</div>
              <h2 className="mt-1 text-2xl font-black">Save player changes before leaving?</h2>
              <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">
                You have unsaved player changes. Save Players will apply them to all selected leagues. Lose Changes will discard them.
              </p>
              <div className="mt-5 flex flex-wrap justify-end gap-2">
                <Button variant="outline" onClick={() => setPendingPlayerPageExit(null)}>Cancel</Button>
                <Button variant="danger" onClick={() => completePendingPlayerPageExit("discard")}>Lose Changes</Button>
                <Button variant="primary" onClick={() => completePendingPlayerPageExit("save")}>Save Players</Button>
              </div>
            </div>
          </div>
        )}

        {pendingPlayerSaveConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
            <div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-xl">
              <div className="text-xs font-black uppercase tracking-wide text-blue-600">Save Player Changes</div>
              <h2 className="mt-1 text-2xl font-black">Save all player changes?</h2>
              <p className="mt-2 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm font-semibold text-blue-800">
                This will save every unsaved player edit on the Players page, including names, photos, handedness, height, phone numbers, league assignments, added players, and removed players.
              </p>
              <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">
                League assignment changes will also update team rosters, batting orders, pitching orders, and captain slots for affected leagues.
              </p>
              <div className="mt-5 flex flex-wrap justify-end gap-2">
                <Button variant="outline" onClick={() => setPendingPlayerSaveConfirm(null)}>Cancel</Button>
                <Button variant="primary" onClick={confirmPlayerPageSave}>Yes, Save All Players</Button>
              </div>
            </div>
          </div>
        )}

        {pendingNewLeague && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
            <div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-xl">
              <div className="text-xs font-black uppercase tracking-wide text-blue-600">Create League</div>
              <h2 className="mt-1 text-2xl font-black">Create a new league?</h2>
              <p className="mt-2 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm font-semibold text-blue-800">
                This will create a new blank league and switch you to it. You can rename it, set teams, add players, and configure rules after it is created.
              </p>
              {leagueHasUnsavedChanges && (
                <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">
                  Your current unsaved league changes will be saved before the new league is created.
                </p>
              )}
              <div className="mt-5 flex flex-wrap justify-end gap-2">
                <Button variant="outline" onClick={() => setPendingNewLeague(false)}>Cancel</Button>
                <Button variant="primary" onClick={commitCreateLeague}>Yes, Create League</Button>
              </div>
            </div>
          </div>
        )}

        {pendingLeagueDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
            <div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-xl">
              <div className="text-xs font-black uppercase tracking-wide text-red-600">Delete League</div>
              <h2 className="mt-1 text-2xl font-black">Delete {pendingLeagueDelete.name || "this league"}?</h2>
              <p className="mt-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
                This will permanently delete the league, teams, rules, schedules, fields, all compiled stats, previous games, and league history connected to this league. This cannot be undone.
              </p>
              <div className="mt-5 flex flex-wrap justify-end gap-2">
                <Button variant="outline" onClick={() => setPendingLeagueDelete(null)}>Cancel</Button>
                <Button variant="danger" onClick={commitDeleteSelectedLeague}>Yes, Delete League</Button>
              </div>
            </div>
          </div>
        )}

        {(pendingLeagueExitPage || pendingLeagueSwitchId) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
            <div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-xl">
              <div className="text-xs font-black uppercase tracking-wide text-amber-600">Unsaved League Changes</div>
              <h2 className="mt-1 text-2xl font-black">Save changes before leaving?</h2>
              <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">
                You have unsaved league settings. Save Changes will apply them before continuing. Lose Changes will discard them.
              </p>
              <div className="mt-5 flex flex-wrap justify-end gap-2">
                <Button variant="outline" onClick={() => { setPendingLeagueExitPage(null); setPendingLeagueSwitchId(""); }}>Cancel</Button>
                <Button variant="danger" onClick={() => completePendingLeagueExit(false)}>Lose Changes</Button>
                <Button variant="primary" onClick={() => completePendingLeagueExit(true)}>Save Changes</Button>
              </div>
            </div>
          </div>
        )}

        {pendingRealDraftStart && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
            <div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-xl">
              <div className="text-xs font-black uppercase tracking-wide text-red-600">Start Real Draft</div>
              <h2 className="mt-1 text-2xl font-black">Draft results will be final</h2>
              <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">
                Starting this real draft means awarded players will update the league roster for {activeDraftSession?.name || "this session"}.
              </p>
              <div className="mt-5 flex flex-wrap justify-end gap-2">
                <Button variant="outline" onClick={() => setPendingRealDraftStart(false)}>Cancel</Button>
                <Button variant="primary" onClick={commitStartDraft}>Start Real Draft</Button>
              </div>
            </div>
          </div>
        )}

        {pendingDraftRestart && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
            <div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-xl">
              <div className="text-xs font-black uppercase tracking-wide text-red-600">{mockDraftMode ? "Reset Mock Draft" : "Reset Draft"}</div>
              <h2 className="mt-1 text-2xl font-black">Confirm that all draft results will be reset?</h2>
              <p className="mt-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
                {mockDraftMode ? `Resetting this mock draft will clear all mock draft results for ${activeDraftSession?.name || "this session"}. No official rosters will be changed.` : `Resetting this draft will clear all draft results for ${activeDraftSession?.name || "this session"}. Real draft roster picks from this draft will be removed from team rosters.`}
              </p>
              <div className="mt-5 flex flex-wrap justify-end gap-2">
                <Button variant="outline" onClick={() => setPendingDraftRestart(false)}>Cancel</Button>
                <Button variant="danger" onClick={commitRestartDraft}>{mockDraftMode ? "Reset Mock Draft" : "Reset Draft"}</Button>
              </div>
            </div>
          </div>
        )}

        {pendingDraftAward && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
            <div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-xl">
              <div className="text-xs font-black uppercase tracking-wide text-green-700">Award Player</div>
              <h2 className="mt-1 text-2xl font-black">Confirm draft pick</h2>
              <div className="mt-3 space-y-2 rounded-xl border bg-slate-50 p-3 text-sm font-semibold text-slate-700">
                <div>Player: <span className="font-black text-slate-900">{pendingDraftAward.playerName}</span></div>
                <div>Team: <span className="font-black text-slate-900">{pendingDraftAward.teamName}</span></div>
                <div>Amount: <span className="font-black text-slate-900">${pendingDraftAward.amount}</span></div>
              </div>
              <div className="mt-5 flex flex-wrap justify-end gap-2">
                <Button variant="outline" onClick={() => setPendingDraftAward(null)}>Cancel</Button>
                <Button variant="primary" onClick={commitDraftAward}>Award Player</Button>
              </div>
            </div>
          </div>
        )}

        {blockedRosterAssignment && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
            <div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-xl">
              <div className="text-xs font-black uppercase tracking-wide text-amber-600">Draft Enabled</div>
              <h2 className="mt-1 text-2xl font-black">Player must be drafted</h2>
              <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">
                {blockedRosterAssignment.player ? `${blockedRosterAssignment.player} cannot be manually added to ${blockedRosterAssignment.teamName || "this team"} while draft is enabled.` : "Players cannot be manually entered while draft is enabled."} Only team captains can be assigned manually. Other players must be added through the draft.
              </p>
              <div className="mt-5 flex flex-wrap justify-end gap-2">
                <Button variant="primary" onClick={() => setBlockedRosterAssignment(null)}>OK</Button>
              </div>
            </div>
          </div>
        )}

        {pendingPlayerRename && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
            <div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-xl">
              <div className="text-xs font-black uppercase tracking-wide text-amber-600">Change Player Name</div>
              <h2 className="mt-1 text-2xl font-black">Confirm player change?</h2>
              <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">
                If {pendingPlayerRename.oldName} is changed to {String(pendingPlayerRename.newName || "").trim() || "a blank name"}, any stats already recorded stay with {pendingPlayerRename.oldName}. New stats from this point forward will be recorded for {String(pendingPlayerRename.newName || "").trim() || "the new player name"}.
              </p>
              <div className="mt-5 flex flex-wrap justify-end gap-2">
                <Button variant="outline" onClick={() => setPendingPlayerRename(null)}>Keep Existing Name</Button>
                <Button variant="primary" onClick={approvePendingPlayerRename}>Change Name</Button>
              </div>
            </div>
          </div>
        )}

        {confirmCancelGameOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
            <div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-xl">
              <div className="text-xs font-black uppercase tracking-wide text-red-600">Cancel Game</div>
              <h2 className="mt-1 text-2xl font-black">Are you sure?</h2>
              <p className="mt-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
                This will cancel the current game. No stats, events, or score results from this game will be recorded.
              </p>
              <div className="mt-5 flex flex-wrap justify-end gap-2">
                <Button variant="outline" onClick={() => setConfirmCancelGameOpen(false)}>Keep Game</Button>
                <Button variant="danger" onClick={cancelCurrentGame}>Yes, Cancel Game</Button>
              </div>
            </div>
          </div>
        )}

        {pendingStrikeoutResult && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
            <div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-xl">
              <div className="text-xs font-black uppercase tracking-wide text-slate-500">Confirm Strikeout</div>
              <h2 className="mt-1 text-2xl font-black">Was the strikeout swinging or looking?</h2>
              <p className="mt-2 rounded-xl border bg-slate-50 p-3 text-sm font-semibold text-slate-700">
                Batter: {currentBatter} vs. Pitcher: {currentPitcher}
              </p>
              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                <Button variant="primary" onClick={() => confirmStrikeoutType("swinging")}>Swinging</Button>
                <Button variant="outline" onClick={() => confirmStrikeoutType("looking")}>Looking</Button>
              </div>
              <div className="mt-3 flex justify-end">
                <Button variant="outline" onClick={() => setPendingStrikeoutResult(null)}>Cancel</Button>
              </div>
            </div>
          </div>
        )}

        {pendingInningNotification && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
            <div className="w-full max-w-md rounded-3xl bg-white p-5 text-center shadow-xl">
              <div className="text-xs font-black uppercase tracking-wide text-slate-500">End of Half-Inning</div>
              <h2 className="mt-1 text-3xl font-black">{pendingInningNotification.half === "top" ? "Top" : "Bottom"} {pendingInningNotification.inning} Complete</h2>
              <div className="mt-4 rounded-2xl border bg-slate-50 p-4">
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                  <div>
                    <div className="truncate text-sm font-bold text-slate-500">{pendingInningNotification.awayTeam}</div>
                    <div className="text-4xl font-black">{pendingInningNotification.awayScore}</div>
                  </div>
                  <div className="text-xl font-black text-slate-400">—</div>
                  <div>
                    <div className="truncate text-sm font-bold text-slate-500">{pendingInningNotification.homeTeam}</div>
                    <div className="text-4xl font-black">{pendingInningNotification.homeScore}</div>
                  </div>
                </div>
              </div>
              <p className="mt-3 text-sm font-semibold text-slate-600">Press OK to start {pendingInningNotification.nextHalf === "top" ? "Top" : "Bottom"} {pendingInningNotification.nextInning}.</p>
              <div className="mt-5 flex justify-center">
                <Button variant="primary" onClick={() => setPendingInningNotification(null)}>OK</Button>
              </div>
            </div>
          </div>
        )}

        {yearPicker && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
            <div className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-xl">
              <div className="text-xs font-black uppercase tracking-wide text-slate-500">Year Picker</div>
              <h2 className="mt-1 text-2xl font-black">{yearPicker.title || "Select Year"}</h2>
              <p className="mt-2 text-sm text-slate-500">Choose from nearby years, or type a specific year below.</p>
              <div className="mt-4 grid gap-3">
                <div>
                  <label className="text-xs font-semibold uppercase text-slate-500">Quick Select Year</label>
                  <select className="mt-1 w-full rounded-xl border px-3 py-2 text-sm font-semibold" value={yearPicker.value} onChange={(event) => setYearPicker((prev) => ({ ...prev, value: Number(event.target.value) }))}>
                    {yearPicker.options.map((year) => <option key={year} value={year} disabled={isDuplicateLeagueSeasonYear(selectedLeague.years || [], year, yearPicker.yearId)}>{year}{isDuplicateLeagueSeasonYear(selectedLeague.years || [], year, yearPicker.yearId) ? " — already exists" : ""}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase text-slate-500">Or Type Year</label>
                  <input type="number" className="mt-1 w-full rounded-xl border px-3 py-2 text-sm font-semibold" value={yearPicker.value} onChange={(event) => setYearPicker((prev) => ({ ...prev, value: Number(event.target.value) || currentYearNumber() }))} />
                </div>
                {isDuplicateLeagueSeasonYear(selectedLeague.years || [], yearPicker.value, yearPicker.yearId) && (
                  <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">That season year already exists. Choose a different year.</p>
                )}
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <Button variant="outline" onClick={() => setYearPicker(null)}>Cancel</Button>
                <Button variant="primary" disabled={isDuplicateLeagueSeasonYear(selectedLeague.years || [], yearPicker.value, yearPicker.yearId)} onClick={approveYearPicker}>Apply Year</Button>
              </div>
            </div>
          </div>
        )}

        {activePage === "history" && (
          <div className="space-y-4">
            <Card>
              <div className="p-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2 className="text-xl font-bold">Previous Games</h2>
                    <p className="text-sm text-slate-500">Final games are saved automatically. You can also save a live game and resume it later during the current browser session.</p>
                  </div>
                  <Button variant="primary" onClick={startNewGame}>Start New Game</Button>
                </div>
              </div>
            </Card>

            {previousGames.length === 0 ? (
              <Card>
                <div className="p-5 text-sm text-slate-500">No saved games yet. Finish a game, save a live game, or press Start New Game to archive the current game here.</div>
              </Card>
            ) : (
              previousGames.map((savedGame) => (
                <Card key={savedGame.id}>
                  <div className="p-5">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="text-xs font-semibold uppercase text-slate-500">{savedGame.gameDate || "No date"} {savedGame.gameTime || ""} · {savedGame.gameLocation || "No location"}</div>
                        <div className="mt-1 text-2xl font-black">{savedGame.awayTeam} {savedGame.awayScore} — {savedGame.homeTeam} {savedGame.homeScore}</div>
                        <div className="mt-1 text-sm text-slate-500">Saved {savedGame.savedAt} · {savedGame.eventCount} events · {savedGame.innings} inning(s)</div>
                      </div>
                      <div className="flex flex-col gap-2 rounded-2xl bg-slate-100 px-4 py-3 text-center">
                        <div>
                          <div className="text-xs font-semibold uppercase text-slate-500">{savedGame.status === "final" ? "Winner" : "Status"}</div>
                          <div className="text-lg font-black">{savedGame.status === "final" ? (savedGame.winner === "away" ? savedGame.awayTeam : savedGame.winner === "home" ? savedGame.homeTeam : "Tie") : "Saved Live"}</div>
                        </div>
                        <Button variant="primary" onClick={() => loadSavedGame(savedGame)}>{savedGame.status === "final" ? "View Game" : "Resume Game"}</Button>
                      </div>
                    </div>

                    <div className="mt-3">
                      <button type="button" className="text-sm font-bold text-slate-900 underline" onClick={() => setExpandedGameId(expandedGameId === savedGame.id ? null : savedGame.id)}>
                        {expandedGameId === savedGame.id ? "Hide details" : "View more details"}
                      </button>
                    </div>

                    {expandedGameId === savedGame.id && (
                      <div className="mt-4 space-y-4 rounded-2xl border bg-white p-4">
                        <SavedLineScore savedGame={savedGame} />
                        <TeamStatsSection
                          awayTeam={savedGame.awayTeam}
                          homeTeam={savedGame.homeTeam}
                          awayPlayers={savedGame.teamPlayers?.away || []}
                          homePlayers={savedGame.teamPlayers?.home || []}
                          battingStats={savedGame.stats}
                          pitchingStats={savedGame.pitchingStats}
                          subIndex={buildSubIndexFromSavedGames([savedGame], "career")}
                        />
                        <div>
                          <h3 className="mb-2 text-lg font-bold">Power Play / Whammy Splits</h3>
                          <div className="overflow-auto">
                            <table className="w-full text-left text-sm">
                              <thead className="text-xs uppercase text-slate-500"><tr><th className="py-2">Player</th><th>Sub</th><th>PA</th><th>AB</th><th>H</th><th>AVG</th><th>BB</th><th>K</th><th>R</th><th>HR</th><th>RBI</th><th>Whammy</th></tr></thead>
                              <tbody>
                                {(savedGame.taggedHittingSplits || []).map((stat) => {
                                  const savedSubIndex = buildSubIndexFromSavedGames([savedGame], "career");
                                  return (
                                    <tr key={stat.player} className="border-t">
                                      <td className="py-2 font-medium">{stat.player}</td>
                                      <td>{savedSubIndex[stat.player] ? "Yes" : "No"}</td>
                                      <td>{stat.PA}</td>
                                      <td>{stat.AB}</td>
                                      <td>{stat.H}</td>
                                      <td>{average(stat.H, stat.AB)}</td>
                                      <td>{stat.BB}</td>
                                      <td>{stat.K}</td>
                                      <td>{stat.R}</td>
                                      <td>{stat.HR}</td>
                                      <td>{stat.RBI}</td>
                                      <td>{stat.WHAMMY}</td>
                                    </tr>
                                  );
                                })}
                                {(!savedGame.taggedHittingSplits || savedGame.taggedHittingSplits.length === 0) && <tr><td className="py-3 text-slate-500" colSpan="12">No Power Play or Whammy stats.</td></tr>}
                              </tbody>
                            </table>
                          </div>
                        </div>
                        <div>
                          <h3 className="mb-2 text-lg font-bold">Pudwhacker Splits</h3>
                          <div className="overflow-auto">
                            <table className="w-full text-left text-sm">
                              <thead className="text-xs uppercase text-slate-500"><tr><th className="py-2">Player</th><th>Sub</th><th>PA</th><th>AB</th><th>H</th><th>AVG</th><th>BB</th><th>K</th><th>R</th><th>HR</th><th>RBI</th><th>Pudwhacker</th></tr></thead>
                              <tbody>
                                {(savedGame.pudwhackerSplits || []).map((stat) => {
                                  const savedSubIndex = buildSubIndexFromSavedGames([savedGame], "career");
                                  return (
                                    <tr key={stat.player} className="border-t">
                                      <td className="py-2 font-medium">{stat.player}</td>
                                      <td>{savedSubIndex[stat.player] ? "Yes" : "No"}</td>
                                      <td>{stat.PA}</td>
                                      <td>{stat.AB}</td>
                                      <td>{stat.H}</td>
                                      <td>{average(stat.H, stat.AB)}</td>
                                      <td>{stat.BB}</td>
                                      <td>{stat.K}</td>
                                      <td>{stat.R}</td>
                                      <td>{stat.HR}</td>
                                      <td>{stat.RBI}</td>
                                      <td>{stat.PUDWHACKER}</td>
                                    </tr>
                                  );
                                })}
                                {(!savedGame.pudwhackerSplits || savedGame.pudwhackerSplits.length === 0) && <tr><td className="py-3 text-slate-500" colSpan="12">No Pudwhacker stats.</td></tr>}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
