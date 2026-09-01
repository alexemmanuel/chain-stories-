
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Feather, Plus, ArrowLeft, ScrollText, Lock, Unlock, CheckCircle2,
  Sparkles, RefreshCw, Film, Tv, Archive, Trash2, MessageCircle,
  X, Play, Download, ThumbsUp, Clock, Users, Star, ChevronRight,
  Settings, HelpCircle, Eye, Award, User, Check, Heart, AlertCircle,
  Volume2, VolumeX, ExternalLink, Music, Copy
} from "lucide-react";

// ---------- constants ----------

const LINE_LIMIT = 180;

const GENRES = [
  { id: "mystery", label: "Mystery", accent: "#7C3AED" },
  { id: "romance", label: "Romance", accent: "#E11D48" },
  { id: "horror", label: "Horror", accent: "#DC2626" },
  { id: "action", label: "Action", accent: "#EA580C" },
  { id: "adventure", label: "Adventure", accent: "#16A34A" },
  { id: "absurd", label: "Absurd", accent: "#EAB308" },
  { id: "scifi", label: "Sci-fi", accent: "#06B6D4" },
  { id: "fable", label: "Fable", accent: "#EC4899" },
  { id: "comedy", label: "Comedy", accent: "#D946EF" },
];

// Ambient music config per genre — generated live via Web Audio, not a licensed audio file.
const GENRE_MUSIC = {
  mystery: { scale: [0, 3, 5, 7, 10], base: 196, wave: "triangle", tempo: 2200, gain: 0.05, style: "drone" },
  romance: { scale: [0, 4, 7, 11, 12], base: 261.63, wave: "sine", tempo: 1900, gain: 0.06, style: "pad" },
  horror: { scale: [0, 1, 6, 7], base: 98, wave: "sawtooth", tempo: 3000, gain: 0.045, style: "drone" },
  action: { scale: [0, 3, 5, 7, 10], base: 220, wave: "square", tempo: 420, gain: 0.032, style: "pulse" },
  adventure: { scale: [0, 2, 4, 7, 9], base: 293.66, wave: "triangle", tempo: 700, gain: 0.05, style: "arpeggio" },
  absurd: { scale: [0, 2, 3, 6, 8, 10], base: 329.63, wave: "square", tempo: 380, gain: 0.035, style: "pluck" },
  scifi: { scale: [0, 2, 5, 7, 10], base: 174.61, wave: "sine", tempo: 2600, gain: 0.05, style: "pad" },
  fable: { scale: [0, 2, 4, 7, 9, 12], base: 392, wave: "triangle", tempo: 900, gain: 0.045, style: "pluck" },
  comedy: { scale: [0, 2, 4, 5, 7, 9, 11], base: 349.23, wave: "square", tempo: 320, gain: 0.032, style: "pluck" },
};


const TWIST_WORDS = [
  "lantern", "debt", "a stranger's coat", "static", "the third floor",
  "an unopened letter", "salt", "a borrowed name", "the low tide",
  "a missing button", "smoke", "the wrong train", "a cracked mirror",
  "an old promise", "the last light", "a stray dog", "copper coins",
  "the attic stairs", "a forged signature", "the north wind",
  "a locked drawer", "the red door", "midnight rain", "a silver key",
];

const BANNED = ["fuck", "shit", "bitch", "cunt", "nigger", "faggot", "retard"];

const ARCHIVE_DAYS = 30;
const ARCHIVE_VISIBLE_HOURS = 48;
const MIN_LINES_TO_ARCHIVE = 5;
/** Votes on delete / archive / unarchive / kick / confidence / title expire after this many hours. */
const VOTE_EXPIRE_HOURS = 72;
/** Non-admin writers may start at most this many votes on a single story. Admins: unlimited. */
const VOTE_INIT_LIMIT_PER_STORY = 5;
/** Throttle: min ms between vote-start attempts (same action). */
const VOTE_START_THROTTLE_MS = 1000;
/** After a successful vote start, block another start for this long. */
const VOTE_START_COOLDOWN_MS = 1500;
/** Fade-toast (e.g. 5/5): max visible bursts before 20s mute of that toast. */
const TOAST_BURST_LIMIT = 2;
const TOAST_SUPPRESS_MS = 20 * 1000;
/**
 * Anti-spam: ONLY repeated taps on the same blocked action after a warning/limit message.
 * Normal use (scrolling, reading, navigating, successful taps) never counts.
 */
const SPAM_DENIED_WINDOW_MS = 30 * 1000;
const SPAM_DENIED_THRESHOLD = 8; // same denied action within window → guilt
const SPAM_SUSPEND_BASE_MS = 30 * 60 * 1000; // 30 min
const SPAM_SUSPEND_STEP_MS = 15 * 60 * 1000; // +15 min per further guilt
const SPAM_GUILT_TO_24H = 5;
const SPAM_BAN_24H_MS = 24 * 60 * 60 * 1000;
const SPAM_WARN_MS = 30 * 1000; // red warning when approaching suspension
const SPAM_STORAGE_KEY = "chn-spam-guard-v2"; // v2: clears old device-wide pointer bans
/** Max admins per chain. Starter is always first admin. */
const MAX_ADMINS = 5;
/** Title edits allowed per rolling 24h window. */
const TITLE_CHANGES_PER_DAY = 3;
const TITLE_CHANGE_WINDOW_MS = 24 * 60 * 60 * 1000;

const MOVIE_MIN_MINUTES = 60;
const MOVIE_MAX_MINUTES = 240;
const SERIES_EP_MIN = 30;
const SERIES_EP_MAX = 50;
const SERIES_EP_PER_SEASON_MIN = 5;
const SERIES_EP_PER_SEASON_MAX = 100;
const SERIES_SEASONS_MIN = 1;
const SERIES_SEASONS_MAX = 50;

function genreMeta(id) {
  return GENRES.find((g) => g.id === id) || GENRES[0];
}

function containsBanned(text) {
  const low = text.toLowerCase();
  return BANNED.some((w) => low.includes(w));
}

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function daysSince(ts) {
  return (Date.now() - ts) / (1000 * 60 * 60 * 24);
}

function hoursSince(ts) {
  return (Date.now() - ts) / (1000 * 60 * 60);
}

function estimateRuntimeMinutes(lineCount) {
  const secsPerLine = 10;
  return Math.round((lineCount * secsPerLine) / 60);
}

function targetMinutes(chain) {
  if (!chain?.target) return 90;
  if (chain.target.format === "series") {
    const ep = chain.target.episodeMinutes || 40;
    const eps = chain.target.episodesPerSeason || 8;
    const seasons = chain.target.seasons || 1;
    return ep * eps * seasons;
  }
  return chain.target.movieMinutes || 90;
}

function runtimeReached(chain) {
  const lines = chain?.lines?.length || 0;
  const est = estimateRuntimeMinutes(lines);
  const target = targetMinutes(chain);
  // The End unlocks at ~85% of target runtime
  return est >= target * 0.85;
}

/** Progress toward target runtime, capped at 100. */
function runtimeProgressPercent(chain) {
  const target = Math.max(1, targetMinutes(chain));
  const est = estimateRuntimeMinutes(chain?.lines?.length || 0);
  return Math.min(100, Math.round((est / target) * 100));
}

function uniqueParticipants(chain) {
  const map = new Map();
  for (const l of chain?.lines || []) {
    if (l.authorId && !map.has(l.authorId)) {
      map.set(l.authorId, l.authorName || "Writer");
    }
  }
  if (chain?.createdById && !map.has(chain.createdById)) {
    map.set(chain.createdById, chain.createdBy || "Creator");
  }
  return [...map.entries()].map(([id, name]) => ({ id, name }));
}

function makeInviteCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}


const FREE_BG_THEMES = [
  {
    id: "white",
    label: "White",
    paper: "#FFFFFF",
    paper2: "#F4F4F5",
    card: "#FFFFFF",
    ink: "#0F0F10",
    inkSoft: "#71717A",
    border: "rgba(15, 15, 16, 0.10)",
  },
  {
    id: "black",
    label: "Black",
    paper: "#000000",
    paper2: "#16181C",
    card: "#16181C",
    ink: "#E7E9EA",
    inkSoft: "#71767A",
    border: "rgba(231, 233, 234, 0.16)",
  },
  {
    id: "sand",
    label: "Sand",
    paper: "#E6D5B8",
    paper2: "#D4C0A0",
    card: "#EAD9BC",
    ink: "#3D2E1F",
    inkSoft: "#6B5640",
    border: "rgba(61, 46, 31, 0.18)",
    btn: "#8B5E3C",
    btnInk: "#F3E6D0",
    btnSecondary: "#C4A882",
    btnSecondaryInk: "#2A1F14",
    danger: "#A33B2B",
    dangerInk: "#F3E6D0",
    dark: false,
    monoChrome: false,
  },
];

function luminance(hex) {
  const h = (hex || "#FFFFFF").replace("#", "");
  if (h.length < 6) return 1;
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function parseHexRgb(hex) {
  const h = (hex || "#FFFFFF").replace("#", "");
  if (h.length < 6) return [255, 255, 255];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function toHexRgb(r, g, b) {
  return (
    "#" +
    [r, g, b]
      .map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, "0"))
      .join("")
  );
}

/** Mix two hex colors; t=0 → a, t=1 → b */
function mixHex(a, b, t) {
  const A = parseHexRgb(a);
  const B = parseHexRgb(b);
  return toHexRgb(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
}

/** True if hex is near pure white or pure black. */
function isNearMono(hex) {
  const L = luminance(hex || "#808080");
  return L > 0.88 || L < 0.1;
}

/**
 * Pull a color away from pure black/white.
 * Used for every non–white/black theme so chrome never looks pure mono.
 */
function avoidPureMono(hex, paper) {
  const L = luminance(hex || "#808080");
  const base = paper && !isNearMono(paper) ? paper : "#8B7355";
  if (L > 0.88) return mixHex(hex, base, 0.48);
  if (L < 0.1) return mixHex(hex, base, 0.48);
  return hex;
}

/**
 * Custom theme picker: only block pure white / pure black (not nearby hues).
 * Pure white → warm parchment; pure black → deep indigo charcoal.
 * Any other hex is returned unchanged so Apply never looks “random.”
 */
function sanitizeCustomHex(hex) {
  let paper = (hex || "").trim();
  if (!paper.startsWith("#")) paper = `#${paper}`;
  if (!/^#[0-9A-Fa-f]{6}$/.test(paper)) return null;
  const L = luminance(paper);
  if (L >= 0.97) return "#F5E6D3"; // pure white blocked
  if (L <= 0.03) return "#1E1B4B"; // pure black blocked
  return paper.toUpperCase();
}

function isPureMonoHex(hex) {
  let h = (hex || "").trim();
  if (!h.startsWith("#")) h = `#${h}`;
  if (!/^#[0-9A-Fa-f]{6}$/.test(h)) return false;
  const L = luminance(h);
  return L >= 0.97 || L <= 0.03;
}

/**
 * Build a full UI theme from any base paper color so cards/panels/text
 * feel designed for that color (not stuck on permanent white/gray).
 * Custom/sand-style themes never use pure black or pure white for UI chrome.
 */
function themeFromCustom(hex) {
  const paper = sanitizeCustomHex(hex) || "#C4A574";
  const dark = luminance(paper) < 0.45;

  // Surfaces derived from the chosen hue (same family, different depth)
  const paper2 = avoidPureMono(
    dark ? mixHex(paper, "#0A0A0A", 0.28) : mixHex(paper, "#1A1510", 0.14),
    paper
  );
  const card = avoidPureMono(
    dark ? mixHex(paper, "#E8E0F0", 0.12) : mixHex(paper, "#1A1510", 0.07),
    paper
  );

  // Text ink: rotate among warm, cool, and green families so custom themes
  // are not stuck on purple/gray — green is allowed when contrast is solid.
  const [pr0, pg0, pb0] = parseHexRgb(paper);
  const paperHueBias = pr0 > pb0 + 20 ? "warm" : pb0 > pr0 + 20 ? "cool" : pg0 >= pr0 && pg0 >= pb0 ? "green" : "neutral";
  const inkSeedsDark = {
    warm: "#FDE68A",
    cool: "#C4B5FD",
    green: "#86EFAC",
    neutral: "#E9D5FF",
  };
  const inkSeedsLight = {
    warm: "#7C2D12",
    cool: "#4C1D95",
    green: "#14532D",
    neutral: "#1C1410",
  };
  const seed = dark ? inkSeedsDark[paperHueBias] : inkSeedsLight[paperHueBias];
  let ink = avoidPureMono(mixHex(seed, paper, 0.18), paper);
  if (Math.abs(luminance(ink) - luminance(paper)) < 0.32) {
    // Prefer green as a readable fallback before other hues
    const fallback = dark ? "#86EFAC" : "#166534";
    ink = avoidPureMono(mixHex(fallback, paper, 0.2), paper);
    if (Math.abs(luminance(ink) - luminance(paper)) < 0.32) {
      ink = avoidPureMono(mixHex(dark ? "#EDE4FF" : "#2A1810", paper, 0.12), paper);
    }
  }
  const inkSoft = avoidPureMono(mixHex(ink, paper, 0.4), paper);

  const [ir, ig, ib] = parseHexRgb(ink);
  const border = `rgba(${ir},${ig},${ib},0.18)`;

  // Primary CTA: rich midtone from paper + accent shift (never pure B/W)
  const accentSeed = dark ? "#A78BFA" : "#9F1239";
  let btn = avoidPureMono(mixHex(paper, accentSeed, dark ? 0.45 : 0.4), paper);
  if (Math.abs(luminance(btn) - luminance(paper)) < 0.25) {
    btn = avoidPureMono(mixHex(btn, dark ? "#E9D5FF" : "#4A044E", 0.5), paper);
  }
  const btnInk = luminance(btn) < 0.5
    ? avoidPureMono(mixHex("#F5F0FF", paper, 0.12), paper)
    : avoidPureMono(mixHex("#1A1020", paper, 0.15), paper);

  const btnSecondary = avoidPureMono(mixHex(paper, ink, 0.22), paper);
  const btnSecondaryInk = ink;

  // Danger (Revoke, Delete): warm red family, never pure white label ink.
  // If the background itself is red, red-on-red fails — use solid black + white text.
  const [pr, pg, pb] = parseHexRgb(paper);
  const paperIsRed = pr > pg + 40 && pr > pb + 40;
  let danger;
  let dangerInk;
  if (paperIsRed) {
    danger = "#0F0F10";
    dangerInk = "#FFFFFF";
  } else {
    danger = avoidPureMono(mixHex("#DC2626", paper, 0.12), paper);
    dangerInk = avoidPureMono(mixHex("#FFF1F2", paper, 0.2), paper);
    if (Math.abs(luminance(danger) - luminance(paper)) < 0.28) {
      danger = avoidPureMono(mixHex("#9F1239", paper, 0.25), paper);
    }
  }

  return {
    id: "custom",
    label: "Custom",
    paper,
    paper2,
    card,
    ink,
    inkSoft,
    border,
    btn,
    btnInk,
    btnSecondary,
    btnSecondaryInk,
    danger,
    dangerInk,
    dark,
    monoChrome: false,
  };
}

function resolveTheme(profile, chain) {
  // Personal theme only — lock/unlock must never change app colors.
  // Story bg swatches store preferences on the chain but do not override the user's theme.
  if (profile?.themeId === "custom" && profile?.themeCustom) {
    return themeFromCustom(profile.themeCustom);
  }
  const id = profile?.themeId || "white";
  const base = FREE_BG_THEMES.find((t) => t.id === id) || FREE_BG_THEMES[0];
  return enrichTheme(base);
}

function enrichTheme(theme) {
  if (!theme) return theme;
  const id = theme.id || "white";
  const dark = theme.dark != null
    ? theme.dark
    : id === "black" || luminance(theme.paper) < 0.45;

  // Pure white / pure black modes — only these may use B/W chrome
  if (id === "white") {
    return {
      ...theme,
      btn: "#0F0F10",
      btnInk: "#FFFFFF",
      btnSecondary: "#E4E4E7",
      btnSecondaryInk: "#3F3F46",
      danger: "#DC2626",
      dangerInk: "#FFFFFF",
      dark: false,
      monoChrome: true,
    };
  }
  if (id === "black") {
    return {
      ...theme,
      btn: "#FFFFFF",
      btnInk: "#000000",
      btnSecondary: "#3F3F46",
      btnSecondaryInk: "#FAFAFA",
      danger: "#DC2626",
      dangerInk: "#FFFFFF",
      dark: true,
      monoChrome: true,
    };
  }
  // Sand and any other preset: treat like custom (no pure B/W chrome)
  if (id === "sand" || !theme.monoChrome) {
    if (theme.btn && theme.btnInk && theme.btnSecondary) {
      return { ...theme, dark, monoChrome: false };
    }
    return themeFromCustom(theme.paper);
  }

  return {
    ...theme,
    btn: theme.btn || (dark ? "#FFFFFF" : "#0F0F10"),
    btnInk: theme.btnInk || (dark ? "#000000" : "#FFFFFF"),
    btnSecondary: theme.btnSecondary || (dark ? "#3F3F46" : "#E4E4E7"),
    btnSecondaryInk: theme.btnSecondaryInk || (dark ? "#FAFAFA" : "#3F3F46"),
    danger: theme.danger || "#DC2626",
    dangerInk: theme.dangerInk || "#FFFFFF",
    dark,
    monoChrome: !!theme.monoChrome,
  };
}

function themeToStyle(theme) {
  if (!theme) return {};
  const t = enrichTheme(theme);
  return {
    ["--paper"]: t.paper,
    ["--paper-2"]: t.paper2,
    ["--paper-card"]: t.card,
    ["--ink"]: t.ink,
    ["--ink-soft"]: t.inkSoft,
    ["--border"]: t.border,
    ["--btn"]: t.btn,
    ["--btn-ink"]: t.btnInk,
    ["--btn-secondary"]: t.btnSecondary,
    ["--btn-secondary-ink"]: t.btnSecondaryInk,
    ["--danger"]: t.danger || "#DC2626",
    ["--danger-ink"]: t.dangerInk || "#FFFFFF",
    ["--border-strong"]: t.border,
    background: t.paper,
    color: t.ink,
  };
}

/** Push theme CSS vars onto documentElement so fixed modals inherit the full theme. */
function applyThemeToDocument(theme) {
  if (typeof document === "undefined") return;
  const t = enrichTheme(theme);
  const root = document.documentElement;
  const map = {
    "--paper": t.paper,
    "--paper-2": t.paper2,
    "--paper-card": t.card,
    "--ink": t.ink,
    "--ink-soft": t.inkSoft,
    "--border": t.border,
    "--btn": t.btn,
    "--btn-ink": t.btnInk,
    "--btn-secondary": t.btnSecondary || t.paper2,
    "--btn-secondary-ink": t.btnSecondaryInk || t.ink,
    "--danger": t.danger || "#DC2626",
    "--danger-ink": t.dangerInk || "#FFFFFF",
    "--border-strong": t.border,
  };
  Object.entries(map).forEach(([k, v]) => root.style.setProperty(k, v));
  root.style.backgroundColor = t.paper;
  root.style.color = t.ink;
  if (document.body) {
    document.body.style.backgroundColor = t.paper;
    document.body.style.color = t.ink;
  }
}


function isStoryStarter(chain, profileId) {
  return !!profileId && chain?.createdById === profileId;
}

/**
 * Locked story access:
 * - Unlocked → open to all
 * - Story starter → always
 * - Story invite code → yes (expires when the story ends — community codes are separate)
 * - Active community member who shares a community with the starter → yes (even after The End)
 * - Removed from community by community starter → need a story invite again (if story still open)
 */
async function canOpenChain(chain, profile) {
  if (!chain?.locked) return true;
  if (!profile?.id) return false;
  if (isStoryStarter(chain, profile.id)) return true;
  // Explicit invite list always works
  if ((chain.invitedIds || []).includes(profile.id)) return true;
  // Story invite CODE expires when the story ends (does not affect community membership)
  if (!chain.finished && !chain.inviteExpired) {
    if (chain.inviteCode && (profile.redeemedInvites || []).includes(chain.inviteCode)) return true;
  }
  // Community members keep access after the story ends so they can see it finished
  const idx = (await getJSON("communities-index", true)) || [];
  for (const summary of idx) {
    if (summary.dissolved) continue;
    const full = await getJSON(`community:${summary.id}`, true);
    if (!full || full.dissolved) continue;
    const members = full.memberIds || [];
    if (members.includes(profile.id) && chain.createdById && members.includes(chain.createdById)) {
      return true;
    }
  }
  return false;
}

function ensureAdmins(chain) {
  if (!chain) return [];
  if (Array.isArray(chain.admins) && chain.admins.length) return chain.admins;
  if (chain.createdById) {
    return [{ id: chain.createdById, name: chain.createdBy || "Creator", since: chain.createdAt || Date.now() }];
  }
  return [];
}

function isAdmin(chain, profileId) {
  return !!profileId && ensureAdmins(chain).some((a) => a.id === profileId);
}

function isKicked(chain, profileId) {
  return !!profileId && (chain?.kickedIds || []).includes(profileId);
}

/**
 * Admin election portal:
 * - Open while ballots < ceil(participants/2) and admins < MAX_ADMINS
 * - Closes when ≥50% of participants have cast a ballot
 * - Reopens when participant count grows to ≥ 1.5× the count at close (another ~50%)
 */
function adminPortalShouldBeOpen(chain) {
  const parts = uniqueParticipants(chain).filter((p) => !isKicked(chain, p.id));
  if (ensureAdmins(chain).length >= MAX_ADMINS) return false;
  const election = chain?.adminElection;
  if (election?.open) {
    const voterCount = (election.ballots || []).length;
    return voterCount < Math.ceil(Math.max(1, parts.length) / 2);
  }
  const closedCount = election?.closedAtParticipantCount;
  if (!closedCount) return true; // never run → open
  return parts.length >= Math.ceil(closedCount * 1.5);
}

function titleChangesInWindow(chain, now = Date.now()) {
  const log = chain?.titleChangeLog || [];
  return log.filter((ts) => now - ts < TITLE_CHANGE_WINDOW_MS).length;
}

function canEditTitle(chain) {
  if (!chain) return false;
  // Permanent only after conversion (watch / reel / MP4), not merely The End
  if (chain.titleLocked) return false;
  return titleChangesInWindow(chain) < TITLE_CHANGES_PER_DAY;
}

/** Local heuristic "AI" title suggestion from genre, theme, twist, and sample lines. */
function generateTitleSuggestion(chain) {
  const genre = (chain?.genre || "drama").replace(/_/g, " ");
  const theme = (chain?.theme || "").trim();
  const twist = chain?.twist || "";
  const lines = (chain?.lines || []).map((l) => l.text).filter(Boolean);
  const sample = lines.slice(0, 3).join(" ");
  const words = (theme || sample || twist || genre)
    .split(/\s+/)
    .map((w) => w.replace(/[^a-zA-Z0-9']/g, ""))
    .filter((w) => w.length > 2)
    .slice(0, 4);
  const caps = words.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  if (caps.length >= 2) return caps.slice(0, 3).join(" ");
  if (caps.length === 1) return `The ${caps[0]}`;
  const seeds = [
    `Echoes of ${genre}`,
    `The Last ${genre}`,
    `Beyond the ${twist || "Horizon"}`,
    `Untitled ${genre}`,
  ];
  return seeds[Math.floor(Math.random() * seeds.length)].slice(0, 60);
}

/** Vote types: "delete" | "archive" | "unarchive". Majority of participants wins; votes expire after VOTE_EXPIRE_HOURS. */
function isVoteExpired(vote) {
  if (!vote?.startedAt) return true;
  return hoursSince(vote.startedAt) > VOTE_EXPIRE_HOURS;
}

function voteYesCount(vote) {
  return (vote?.votes || []).filter((v) => v.choice === "yes").length;
}

function voteNoCount(vote) {
  return (vote?.votes || []).filter((v) => v.choice === "no").length;
}

function youVoted(vote, profileId) {
  return (vote?.votes || []).some((v) => v.authorId === profileId);
}

function yourVoteChoice(vote, profileId) {
  return (vote?.votes || []).find((v) => v.authorId === profileId)?.choice || null;
}

/** Majority of *participants* must vote yes (more yes than no, and yes > half of participants rounded down, i.e. ceil(n/2)). */
function majorityReached(vote, participantCount) {
  if (!vote || participantCount <= 0) return false;
  const yes = voteYesCount(vote);
  const need = Math.ceil(participantCount / 2);
  return yes >= need;
}

function cleanExpiredVotes(chain) {
  if (!chain) return chain;
  let changed = false;
  const next = { ...chain };
  if (next.deletePetition && isVoteExpired(next.deletePetition)) {
    next.deletePetition = null;
    changed = true;
  }
  if (next.archiveVote && isVoteExpired(next.archiveVote)) {
    next.archiveVote = null;
    changed = true;
  }
  if (next.unarchiveVote && isVoteExpired(next.unarchiveVote)) {
    next.unarchiveVote = null;
    changed = true;
  }
  if (next.kickVote && isVoteExpired(next.kickVote)) {
    next.kickVote = null;
    changed = true;
  }
  if (next.confidenceVote && isVoteExpired(next.confidenceVote)) {
    next.confidenceVote = null;
    changed = true;
  }
  if (next.titleVote && isVoteExpired(next.titleVote)) {
    next.titleVote = null;
    changed = true;
  }
  if (!Array.isArray(next.admins) || next.admins.length === 0) {
    if (next.createdById) {
      next.admins = [
        { id: next.createdById, name: next.createdBy || "Creator", since: next.createdAt || Date.now() },
      ];
      changed = true;
    }
  }
  return changed ? next : chain;
}

/** True if this writer still needs to act on an open, non-expired vote on this chain. */
function needsAttentionOnChain(chain, profileId) {
  if (!chain || !profileId) return false;
  const parts = uniqueParticipants(chain);
  if (!parts.some((p) => p.id === profileId)) return false;
  const check = (vote) =>
    vote && !isVoteExpired(vote) && !youVoted(vote, profileId);
  const adminOnly = (vote) =>
    isAdmin(chain, profileId) && vote && !isVoteExpired(vote) && !youVoted(vote, profileId);
  return (
    check(chain.deletePetition) ||
    check(chain.archiveVote) ||
    check(chain.unarchiveVote) ||
    check(chain.titleVote) ||
    adminOnly(chain.kickVote) ||
    adminOnly(chain.confidenceVote)
  );
}

// ---------- ambient music (Web Audio, generated live — no audio files) ----------


function freqFromScale(base, scale, degree) {
  const octave = Math.floor(degree / scale.length);
  const semis = scale[((degree % scale.length) + scale.length) % scale.length] + 12 * octave;
  return base * Math.pow(2, semis / 12);
}

function useAmbientMusic(genre, enabled, volume = 1) {
  const ctxRef = useRef(null);
  const masterRef = useRef(null);
  const userVolRef = useRef(null);
  const timeoutRef = useRef(null);
  const enabledRef = useRef(enabled);
  const volumeRef = useRef(Math.max(0, Math.min(1, volume)));

  useEffect(() => {
    enabledRef.current = enabled;
    if (masterRef.current && ctxRef.current) {
      const now = ctxRef.current.currentTime;
      masterRef.current.gain.cancelScheduledValues(now);
      masterRef.current.gain.setTargetAtTime(enabled ? 1 : 0, now, 0.5);
    }
  }, [enabled]);

  useEffect(() => {
    volumeRef.current = Math.max(0, Math.min(1, volume));
    if (userVolRef.current && ctxRef.current) {
      const now = ctxRef.current.currentTime;
      userVolRef.current.gain.cancelScheduledValues(now);
      userVolRef.current.gain.setTargetAtTime(volumeRef.current, now, 0.08);
    }
  }, [volume]);

  useEffect(() => {
    if (!genre) return undefined;
    const cfg = GENRE_MUSIC[genre] || GENRE_MUSIC.fable;
    let ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return undefined;
      ctx = new AC();
    } catch (e) {
      return undefined;
    }
    ctxRef.current = ctx;

    const master = ctx.createGain();
    master.gain.value = enabledRef.current ? 1 : 0;
    const userVol = ctx.createGain();
    userVol.gain.value = volumeRef.current;
    const overallGain = ctx.createGain();
    overallGain.gain.value = cfg.gain;
    master.connect(userVol);
    userVol.connect(overallGain);
    overallGain.connect(ctx.destination);
    masterRef.current = master;
    userVolRef.current = userVol;

    const playNote = (freq, dur, wave, peak) => {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      osc.type = wave;
      osc.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(peak, now + Math.min(0.5, dur * 0.35));
      g.gain.linearRampToValueAtTime(0, now + dur);
      osc.connect(g);
      g.connect(master);
      osc.start(now);
      osc.stop(now + dur + 0.05);
    };

    let step = 0;
    const schedule = () => {
      if (!ctxRef.current) return;
      if (ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }
      const degree = cfg.style === "drone" ? (step % 2 === 0 ? 0 : 2) : step;
      const durSec = (cfg.style === "drone" || cfg.style === "pad" ? cfg.tempo * 1.6 : cfg.tempo * 0.85) / 1000;
      const freq = freqFromScale(cfg.base, cfg.scale, degree);
      playNote(freq, durSec, cfg.wave, 1);
      if (cfg.style === "pad" && step % 2 === 0) {
        playNote(freqFromScale(cfg.base, cfg.scale, degree + 2), durSec, cfg.wave, 0.55);
      }
      if (cfg.style === "pulse" && step % 4 === 3) {
        playNote(freqFromScale(cfg.base, cfg.scale, degree + 4), durSec * 0.6, cfg.wave, 0.5);
      }
      step += 1;
      timeoutRef.current = setTimeout(schedule, cfg.tempo);
    };
    timeoutRef.current = setTimeout(schedule, 300);

    return () => {
      clearTimeout(timeoutRef.current);
      try {
        master.disconnect();
        userVol.disconnect();
        overallGain.disconnect();
      } catch (e) {}
      try {
        ctx.close();
      } catch (e) {}
      ctxRef.current = null;
      masterRef.current = null;
      userVolRef.current = null;
    };
  }, [genre]);
}

// AI Story Analyst
async function analyzeLineWithClaude(text, genre, twist, theme) {
  // Standalone / GitHub Pages: use local heuristic only (no API keys in the browser).
  return analyzeLineLocally(text, genre, twist);
}

function analyzeLineLocally(text, genre, twist) {
  const len = text.length;
  let score = 6;
  if (len > 40 && len < 140) score += 1;
  if (text.includes(",") || text.includes("—") || text.includes(";")) score += 1;
  if (/(suddenly|then|and then)/i.test(text)) score -= 1;
  if (twist && text.toLowerCase().includes(String(twist).toLowerCase().split(" ")[0])) score += 1;
  const g = (genre || "").toLowerCase();
  if (g === "horror" && /(shadow|blood|door|whisper|dark)/i.test(text)) score += 1;
  if (g === "romance" && /(heart|touch|eyes|hand|soft)/i.test(text)) score += 1;
  if (g === "mystery" && /(clue|letter|key|missing|question)/i.test(text)) score += 1;
  if (g === "action" && /(ran|strike|gun|chase|jump)/i.test(text)) score += 1;
  score = Math.max(1, Math.min(10, score + Math.floor(Math.random() * 3) - 1));
  const verdicts = [
    "Fits the tone; keep the mystery close.",
    "Strong image — genre-aligned.",
    "A little on-the-nose; trust the reader more.",
    "Good momentum. The twist word would land well here.",
    "Clean and cinematic.",
    "Sharp beat — leaves room for the next writer.",
  ];
  return {
    score,
    verdict: verdicts[Math.floor(Math.random() * verdicts.length)],
    source: "local",
  };
}


// ---------- storage (GitHub Pages / browser — replaces Claude storage) ----------
const storage = {
  async get(key, _shared) {
    try {
      const value = localStorage.getItem(key);
      if (value == null) return null;
      return { value };
    } catch (e) {
      return null;
    }
  },
  async set(key, value, _shared) {
    localStorage.setItem(key, value);
  },
  async delete(key, _shared) {
    localStorage.removeItem(key);
  },
};

// ---------- storage helpers ----------

async function getJSON(key, shared) {
  try {
    const res = await storage.get(key, shared);
    if (!res) return null;
    return JSON.parse(res.value);
  } catch (e) {
    return null;
  }
}

async function setJSON(key, value, shared) {
  try {
    await storage.set(key, JSON.stringify(value), shared);
    return true;
  } catch (e) {
    return false;
  }
}

// Same as setJSON but surfaces the real underlying error instead of swallowing it,
// for the one call site (chain creation) where we need to show the person what broke.
async function setJSONDiag(key, value, shared) {
  try {
    await storage.set(key, JSON.stringify(value), shared);
    return { ok: true };
  } catch (e) {
    const msg =
      (e && (e.message || e.error || e.reason)) ||
      (typeof e === "string" ? e : "") ||
      "Unknown storage error";
    return { ok: false, error: String(msg).slice(0, 200) };
  }
}

// ---------- anti-spam / suspension (device-local) ----------

function loadSpamGuard() {
  const blank = {
    guiltCount: 0,
    suspendedUntil: 0,
    postBanWatch: false,
    warnedLifetime: false,
    deniedLog: [], // { t, kind } — only blocked taps after a limit/warning
    lastVoteStartAt: 0,
    lastVoteStartSuccessAt: 0,
    toasts: {},
  };
  try {
    // Drop legacy v1 device-wide pointer bans
    try {
      localStorage.removeItem("chn-spam-guard-v1");
    } catch {
      /* ignore */
    }
    const raw = localStorage.getItem(SPAM_STORAGE_KEY);
    if (!raw) return { ...blank };
    const d = JSON.parse(raw);
    return {
      ...blank,
      guiltCount: d.guiltCount || 0,
      suspendedUntil: d.suspendedUntil || 0,
      postBanWatch: !!d.postBanWatch,
      warnedLifetime: !!d.warnedLifetime,
      deniedLog: Array.isArray(d.deniedLog) ? d.deniedLog : [],
      lastVoteStartAt: d.lastVoteStartAt || 0,
      lastVoteStartSuccessAt: d.lastVoteStartSuccessAt || 0,
      toasts: d.toasts && typeof d.toasts === "object" ? d.toasts : {},
    };
  } catch {
    return { ...blank };
  }
}

function saveSpamGuard(state) {
  try {
    localStorage.setItem(SPAM_STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore quota */
  }
}

function getSuspensionRemainingMs() {
  const s = loadSpamGuard();
  const left = (s.suspendedUntil || 0) - Date.now();
  return left > 0 ? left : 0;
}

function formatDuration(ms) {
  const sec = Math.ceil(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.ceil(sec / 60);
  if (min < 60) return `${min} min`;
  const hrs = Math.floor(min / 60);
  const rem = min % 60;
  return rem ? `${hrs}h ${rem}m` : `${hrs}h`;
}

/** Apply a guilt strike and set suspension. Returns suspendedUntil timestamp. */
function applySpamGuilt(reason) {
  const s = loadSpamGuard();
  const now = Date.now();
  let guilt = (s.guiltCount || 0) + 1;
  let until = 0;

  if (s.postBanWatch) {
    // Returned from a prior ban and spammed again → immediate 24h
    until = now + SPAM_BAN_24H_MS;
    guilt = Math.max(guilt, SPAM_GUILT_TO_24H);
  } else if (guilt >= SPAM_GUILT_TO_24H) {
    until = now + SPAM_BAN_24H_MS;
  } else {
    // 30 min base, then +15 min per guilt beyond the first
    until = now + SPAM_SUSPEND_BASE_MS + Math.max(0, guilt - 1) * SPAM_SUSPEND_STEP_MS;
  }

  s.guiltCount = guilt;
  s.suspendedUntil = until;
  s.postBanWatch = false;
  s.deniedLog = [];
  s.lastGuiltReason = reason || "denied-spam";
  s.lastGuiltAt = now;
  saveSpamGuard(s);
  return until;
}

/**
 * Call ONLY when the user taps an action that is already blocked
 * (limit reached, cooldown, max communities, etc.) after a warning/instruction.
 * Scrolling, reading, navigation, and successful actions never call this.
 * Returns { ok, suspended, remainingMs, warning }.
 */
function recordDeniedAction(kind) {
  const now = Date.now();
  const s = loadSpamGuard();
  const key = String(kind || "denied");

  if (s.suspendedUntil && s.suspendedUntil <= now) {
    s.suspendedUntil = 0;
    s.postBanWatch = true;
    saveSpamGuard(s);
  }
  if (s.suspendedUntil && s.suspendedUntil > now) {
    return {
      ok: false,
      suspended: true,
      remainingMs: s.suspendedUntil - now,
      warning: false,
    };
  }

  // Only count repeats of the *same* blocked action
  s.deniedLog = (s.deniedLog || []).filter(
    (e) => now - (e.t || 0) < SPAM_DENIED_WINDOW_MS && e.kind === key
  );
  s.deniedLog.push({ t: now, kind: key });

  if (s.deniedLog.length >= SPAM_DENIED_THRESHOLD) {
    const until = applySpamGuilt(key);
    return {
      ok: false,
      suspended: true,
      remainingMs: until - now,
      warning: false,
    };
  }

  // Soft warning when close to suspension on this same blocked action
  let warning = false;
  if (
    !s.warnedLifetime &&
    (s.guiltCount || 0) === 0 &&
    s.deniedLog.length >= Math.max(1, SPAM_DENIED_THRESHOLD - 2)
  ) {
    s.warnedLifetime = true;
    warning = true;
  }

  saveSpamGuard(s);
  return { ok: true, suspended: false, remainingMs: 0, warning };
}

/** @deprecated use recordDeniedAction — kept so old call sites fail closed to no-op for success paths */
function recordSpamAction(_kind) {
  // Intentionally does not count successful / general activity
  const s = loadSpamGuard();
  const now = Date.now();
  if (s.suspendedUntil && s.suspendedUntil > now) {
    return {
      ok: false,
      suspended: true,
      remainingMs: s.suspendedUntil - now,
      throttled: false,
      warning: false,
    };
  }
  return { ok: true, suspended: false, remainingMs: 0, throttled: false, warning: false };
}

/** Vote-start throttle + success cooldown. Returns null if allowed, or reason string. */
function checkVoteStartGate() {
  const now = Date.now();
  const s = loadSpamGuard();
  if (s.suspendedUntil && s.suspendedUntil > now) {
    return "suspended";
  }
  if (s.lastVoteStartAt && now - s.lastVoteStartAt < VOTE_START_THROTTLE_MS) {
    return "throttle";
  }
  if (s.lastVoteStartSuccessAt && now - s.lastVoteStartSuccessAt < VOTE_START_COOLDOWN_MS) {
    return "cooldown";
  }
  return null;
}

function markVoteStartAttempt() {
  const s = loadSpamGuard();
  s.lastVoteStartAt = Date.now();
  saveSpamGuard(s);
}

function markVoteStartSuccess() {
  const s = loadSpamGuard();
  s.lastVoteStartSuccessAt = Date.now();
  s.lastVoteStartAt = Date.now();
  saveSpamGuard(s);
}

/**
 * Fade-toast gate: after TOAST_BURST_LIMIT shows, suppress that key for TOAST_SUPPRESS_MS.
 * Underlying action still runs; only the popup is muted.
 * Returns true if the toast may show.
 */
function canShowFadeToast(key) {
  const now = Date.now();
  const s = loadSpamGuard();
  const t = s.toasts[key] || { count: 0, suppressedUntil: 0, windowResetAt: 0 };

  if (t.suppressedUntil && t.suppressedUntil > now) {
    return false;
  }
  if (t.suppressedUntil && t.suppressedUntil <= now) {
    t.count = 0;
    t.suppressedUntil = 0;
  }
  // Reset burst window after suppress period or long idle
  if (t.windowResetAt && now > t.windowResetAt && !t.suppressedUntil) {
    t.count = 0;
  }

  t.count = (t.count || 0) + 1;
  t.windowResetAt = now + TOAST_SUPPRESS_MS;

  if (t.count > TOAST_BURST_LIMIT) {
    t.suppressedUntil = now + TOAST_SUPPRESS_MS;
    t.count = TOAST_BURST_LIMIT;
    s.toasts[key] = t;
    saveSpamGuard(s);
    return false;
  }

  s.toasts[key] = t;
  saveSpamGuard(s);
  return true;
}

// ---------- shared writer registry ----------

async function syncWriterToRegistry(profile) {
  if (!profile?.id) return;
  const registry = (await getJSON("writers-registry", true)) || {};
  registry[profile.id] = {
    id: profile.id,
    name: profile.name,
    visibility: profile.visibility || 0,
    premium: !!profile.premium,
    linesWritten: profile.linesWritten || 0,
    watches: profile.watches || 0,
    likes: profile.likes || 0,
    updatedAt: Date.now(),
  };
  await setJSON("writers-registry", registry, true);
}

async function isNameTaken(name, excludeId) {
  const registry = (await getJSON("writers-registry", true)) || {};
  const lower = (name || "").trim().toLowerCase();
  if (!lower) return false;
  return Object.values(registry).some(
    (w) => w.id !== excludeId && (w.name || "").trim().toLowerCase() === lower
  );
}

// Names: lowercase letters only — no digits, symbols, underscores, or spaces.
function sanitizeUsername(raw) {
  return raw.toLowerCase().replace(/[^a-z]/g, "");
}

// One-time cleanup for profiles created before the lowercase-only rule existed.
async function migrateProfileName(profile) {
  const clean = sanitizeUsername(profile.name || "").slice(0, 24);
  if (clean && clean === profile.name) return profile; // already compliant

  let base = clean || "writer";
  let candidate = base;
  let suffix = 0;
  while (await isNameTaken(candidate, profile.id)) {
    suffix += 1;
    candidate = `${base}${suffix}`.slice(0, 24);
  }
  const migrated = { ...profile, name: candidate };
  await setJSON("writer-profile", migrated, false);
  await syncWriterToRegistry(migrated);
  return migrated;
}

async function saveProfile(profile, onUpdateProfile) {
  await setJSON("writer-profile", profile, false);
  onUpdateProfile?.(profile);
  await syncWriterToRegistry(profile);
}

const COMMUNITY_MIN_ACTIVE = 20;
const COMMUNITY_DISSOLVE_DAYS = 30;

async function listCommunities() {
  return (await getJSON("communities-index", true)) || [];
}

async function saveCommunity(community) {
  await setJSON(`community:${community.id}`, community, true);
  const idx = (await listCommunities()).filter((c) => c.id !== community.id);
  idx.unshift({
    id: community.id,
    name: community.name,
    createdBy: community.createdBy,
    createdById: community.createdById,
    createdAt: community.createdAt,
    memberCount: (community.memberIds || []).length,
    dissolved: !!community.dissolved,
    inviteCode: community.inviteCode,
  });
  await setJSON("communities-index", idx, true);
}

/** Permanently remove a community (starter delete). */
async function purgeCommunity(communityId) {
  if (!communityId) return;
  try {
    await storage.delete(`community:${communityId}`, true);
  } catch (e) {
    /* ignore */
  }
  const idx = (await listCommunities()).filter((c) => c.id !== communityId);
  await setJSON("communities-index", idx, true);
}

function communityActiveCount(community) {
  const cutoff = Date.now() - COMMUNITY_DISSOLVE_DAYS * 24 * 60 * 60 * 1000;
  const activeAt = community?.activeAt || {};
  return (community?.memberIds || []).filter((id) => (activeAt[id] || 0) >= cutoff).length;
}

async function maintainCommunities() {
  const idx = await listCommunities();
  const next = [];
  for (const summary of idx) {
    let full = await getJSON(`community:${summary.id}`, true);
    if (!full) continue;
    if (full.dissolved) {
      next.push({ ...summary, dissolved: true });
      continue;
    }
    if (
      daysSince(full.createdAt || Date.now()) >= COMMUNITY_DISSOLVE_DAYS &&
      communityActiveCount(full) < COMMUNITY_MIN_ACTIVE
    ) {
      full = { ...full, dissolved: true, dissolvedAt: Date.now() };
      await setJSON(`community:${full.id}`, full, true);
      next.push({ ...summary, dissolved: true, memberCount: (full.memberIds || []).length });
      continue;
    }
    next.push({
      ...summary,
      memberCount: (full.memberIds || []).length,
      dissolved: false,
      inviteCode: full.inviteCode,
    });
  }
  await setJSON("communities-index", next, true);
  return next;
}

// ---------- fonts / base styles ----------

function GlobalStyle() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

      html, body, #root {
        background: var(--paper, #FFFFFF);
        color: var(--ink, #0F0F10);
        min-height: 100%;
      }
      /* Theme tokens live on documentElement (applyThemeToDocument). Do not redeclare them here. */
      .chn-root {
        --seal: #1D9BF0;
        --gold: #1D9BF0;
        font-family: Inter, system-ui, -apple-system, sans-serif;
        color: var(--ink);
        background: var(--paper);
        min-height: 100vh;
        width: 100%;
        box-sizing: border-box;
      }
      .chn-root input::placeholder,
      .chn-root textarea::placeholder {
        color: var(--ink-soft);
        opacity: 0.85;
      }
      .chn-root input,
      .chn-root textarea,
      input,
      textarea {
        color: var(--ink);
        background: var(--paper-2);
        border-color: var(--border);
      }
      .chn-btn-primary {
        background: var(--btn) !important;
        color: var(--btn-ink) !important;
        border: 2px solid var(--btn) !important;
        font-weight: 600 !important;
      }
      .chn-btn-secondary {
        background: var(--btn-secondary) !important;
        color: var(--btn-secondary-ink) !important;
        border: 2px solid var(--btn-secondary) !important;
        font-weight: 600 !important;
      }
      .chn-btn-danger {
        background: var(--danger) !important;
        color: var(--danger-ink) !important;
        border: 2px solid var(--danger) !important;
        font-weight: 600 !important;
      }
      .chn-btn-ghost {
        background: transparent !important;
        color: var(--ink) !important;
        border: 1px solid var(--border) !important;
      }
      .chn-modal-panel {
        background: var(--paper-card) !important;
        color: var(--ink) !important;
        border: 1px solid var(--border) !important;
      }
      .chn-shell {
        width: 100%;
        max-width: 960px;
        margin: 0 auto;
        padding: 28px 20px 48px;
        min-height: 100vh;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
      }
      @media (min-width: 640px) {
        .chn-shell {
          padding: 36px 32px 64px;
        }
      }
      @media (min-width: 1024px) {
        .chn-shell {
          max-width: 1040px;
          padding: 40px 40px 72px;
        }
      }
      .chn-display {
        font-family: Inter, system-ui, sans-serif;
        font-weight: 700;
        letter-spacing: -0.03em;
      }
      .chn-type {
        font-family: Inter, system-ui, sans-serif;
        font-weight: 600;
        letter-spacing: 0.06em;
        text-transform: uppercase;
      }
      .chn-fold {
        position: relative;
        background: var(--paper-card);
        border-radius: 16px;
        box-shadow: none;
        border: 1px solid var(--border);
      }
      .chn-fold::after {
        display: none !important;
        content: none !important;
      }
      .chn-scrollbar::-webkit-scrollbar { width: 6px; }
      .chn-scrollbar::-webkit-scrollbar-thumb {
        background: rgba(15,15,16,0.12);
        border-radius: 999px;
      }
      /* Range inputs — full width, blue track (no Tailwind needed) */
      input[type="range"] {
        -webkit-appearance: none;
        appearance: none;
        width: 100%;
        height: 6px;
        border-radius: 999px;
        background: #E4E4E7;
        outline: none;
        margin: 8px 0;
        display: block;
        box-sizing: border-box;
      }
      input[type="range"]::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background: #1D9BF0;
        cursor: pointer;
        border: none;
        box-shadow: 0 1px 3px rgba(0,0,0,0.15);
      }
      input[type="range"]::-moz-range-thumb {
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background: #1D9BF0;
        cursor: pointer;
        border: none;
      }
      input[type="range"]::-moz-range-track {
        height: 6px;
        border-radius: 999px;
        background: #E4E4E7;
      }
      .chn-btn {
        font-family: Inter, system-ui, sans-serif;
        font-weight: 600;
        letter-spacing: -0.01em;
        transition: transform 0.12s ease, background 0.15s ease, border-color 0.15s ease;
      }
      .chn-btn:active { transform: scale(0.97); }
      button.chn-fold:hover {
        border-color: var(--border-strong);
        box-shadow: 0 4px 16px -4px rgba(15, 15, 16, 0.08);
      }
      @keyframes chnRise {
        from { opacity: 0; transform: translateY(6px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .chn-rise { animation: chnRise 0.28s ease-out both; }
      @keyframes chnFadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      .chn-fade { animation: chnFadeIn 0.3s ease-out both; }
      @keyframes chnMarquee {
        0% { transform: translateX(100%); }
        100% { transform: translateX(-100%); }
      }
      .chn-marquee-track {
        overflow: hidden;
        width: 100%;
      }
      .chn-marquee-text {
        display: inline-block;
        white-space: nowrap;
        padding-left: 100%;
        animation: chnMarquee 14s linear infinite;
        font-weight: 700;
        font-size: 16px;
        letter-spacing: 0.02em;
      }
      .cinema-mode {
        background: #000000 !important;
        color: #F4F4F5 !important;
        background-image: none !important;
      }
      .cinema-mode .chn-fold {
        background: #111113;
        border-color: rgba(244, 244, 245, 0.12);
      }
      .cinema-mode .chn-fold::after {
        display: none !important;
      }
    `}</style>
  );
}

// ---------- Help knowledge (shared by Help modal + Guide chat) ----------

const HELP_SECTIONS = [
  {
    title: "Stories & lines",
    keys: ["line", "write", "turn", "practice", "solo", "consecutive", "180", "twist", "banned"],
    body: "Write one line at a time (max 180 characters). In multi-writer mode you cannot write two lines in a row. Practice/solo mode allows consecutive lines. Banned words are blocked. Twist words are optional prompts.",
  },
  {
    title: "The End & conversion",
    keys: ["the end", "finish", "runtime", "conversion", "watch", "mp4", "reel"],
    body: "The End unlocks at about 85% of target runtime. After The End you can polish the title (including AI suggest). Starting Watch, MP4, or Offline reel locks the title permanently.",
  },
  {
    title: "Titles",
    keys: ["title", "rename", "ai suggest", "revoke", "3/3"],
    body: "Anyone can edit a title before conversion, up to 3 times per 24 hours. Changes can be revoked by a writer majority vote. After conversion the title is permanent.",
  },
  {
    title: "Locks & invites",
    keys: ["lock", "unlock", "invite", "padlock", "code", "premium lock"],
    body: "Only the story starter (Premium) can lock or unlock. Locked stories stay on the timeline with a padlock. Story invites expire at The End; community members keep access and can see the finished story.",
  },
  {
    title: "Premium vs Free",
    keys: ["premium", "free", "subscribe", "subscription", "benefit", "plan", "upgrade"],
    body: "Free: write on open stories, join communities with a code, like stories, use White/Black/Sand themes, ambient music, Watch mode, and vote on multi-writer actions. Premium adds: lock/unlock stories and invite codes, create communities, custom theme colors (hex/picker), offline HTML reel download, and the CS badge on boards. Premium is a demo toggle on the Board — no real payment in this build.",
  },
  {
    title: "Communities",
    keys: ["community", "communities", "members", "dissolve", "join community", "create community"],
    body: "Only Premium subscribers can create a community. Anyone (Free or Premium) can join with a community code. Members get direct access to each other's stories (including locked) without a story invite and can see each other's names. The community starter can remove a member — that person needs story invites again for locked stories — and can delete the community (trash icon, then Yes/No). Under 20 active members after 30 days the community dissolves permanently.",
  },
  {
    title: "Admins",
    keys: ["admin", "election", "kick", "nominate", "portal"],
    body: "Max 5 admins; the starter is the first. The election portal closes when 50% of writers have voted and reopens when the cast grows by about another 50%. Admins start kick votes; only admins vote; kicks are not automatic. The starter cannot be kicked from the story. A confidence vote (admins only) can strip the starter of admin role only.",
  },
  {
    title: "Votes & archives",
    keys: ["vote", "votes", "delete", "archive", "unarchive", "cancel", "initiate", "majority", "72"],
    body: "Multi-writer actions use anonymous majority votes. Nobody — including the starter or admins — can cancel a vote once it is started. Each non-admin writer may initiate up to 5 votes on a given story; admins have unlimited initiations. Votes expire after 72 hours. Archives: inactive 30+ days with 5+ lines; leave the main timeline after 48 hours in archive status. Under-5-line inactive chains are deleted, not archived.",
  },
  {
    title: "Boards & likes",
    keys: ["board", "visibility", "likes", "heart", "credits", "leaderboard"],
    body: "Visibility is earned from lines on non-deleted chains. Story likes (heart on each card) credit writers whose lines are part of that story. The Likes board ranks those totals and does not affect visibility ranking. Credits/cash-out are illustrative. Premium is a demo toggle on the Board.",
  },
  {
    title: "Movie & series formats",
    keys: ["movie", "series", "episode", "season", "runtime", "minutes"],
    body: "When you start a chain you choose Movie or Series. Movies target 1–4 hours of estimated runtime. Series let you set episode length, episodes per season, and number of seasons. The target helps writers know when the production is long enough to finish.",
  },
  {
    title: "Music",
    keys: ["music", "sound", "audio", "ambient", "playlist", "spotify", "volume"],
    body: "Tap the music icon next to Settings for Ambient (browser-synthesized tones per genre) or a link to your own Spotify / YouTube Music / Apple Music playlist. Ambient mutes with one tap; use the volume bar to lower music without changing phone volume.",
  },
  {
    title: "Guide vs Help",
    keys: ["guide", "help", "chat", "assistant"],
    body: "Guide is the chat assistant for quick questions — it reads these Help rules and answers from them. Help (this screen) is the full rules reference.",
  },
  {
    title: "Spam protection & suspension",
    keys: ["spam", "suspend", "ban", "throttle", "warning", "stop spamming"],
    body: "Spam rules only apply when you keep tapping the same button after the app already told you that action is blocked (limit reached, cooldown, or not allowed yet). Scrolling, reading, and normal use never count. After several denied taps on that same action, a warning may appear; continued taps can suspend this device (30 minutes first, then longer; five strikes or spam after a ban ends can mean 24 hours). While suspended, a notice shows the time left.",
  },
];

/** Extra Q&A not duplicated as full Help sections */
const BOT_EXTRA = [
  {
    keys: ["video", "mp4", "generate video", "trailer", "download video"],
    answer:
      "Video generation (MP4 / cinematic reel) is a demo feature. Real encoding needs a backend. After The End, Generate MP4 / Trailer shows a progress simulation. Premium unlocks the offline HTML reel that works in the browser.",
  },
  {
    keys: ["username", "name taken", "change my name", "unique name"],
    answer:
      "Writer names must be unique and use only lowercase letters — no spaces, numbers, or symbols. If a name is taken, pick another.",
  },
  {
    keys: ["ai", "analyst", "score"],
    answer:
      "The AI Story Analyst scores each line 1–10 for craft and genre fit. On this standalone site it uses a local heuristic; a live model would need a backend API key.",
  },
];

function tokenizeQuery(text) {
  return (text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s#]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1);
}

function scoreKnowledgeMatch(query, keys, body) {
  const q = (query || "").toLowerCase().trim();
  const tokens = tokenizeQuery(q);
  if (!tokens.length) return 0;
  let score = 0;
  const keyBlob = (keys || []).join(" ").toLowerCase();
  const bodyLow = (body || "").toLowerCase();
  for (const k of keys || []) {
    const kk = k.toLowerCase();
    if (q.includes(kk)) score += 8 + Math.min(kk.length, 12);
  }
  for (const t of tokens) {
    if (keyBlob.includes(t)) score += 3;
    if (bodyLow.includes(t)) score += 1;
  }
  // multi-word phrase hits in body
  if (tokens.length >= 2) {
    const phrase = tokens.slice(0, 4).join(" ");
    if (bodyLow.includes(phrase)) score += 6;
  }
  return score;
}

function botReply(userText) {
  const q = (userText || "").trim();
  if (!q) {
    return "Ask about Premium vs Free, communities, votes, locks, titles, archives, or any rule in Help.";
  }
  const corpus = [
    ...HELP_SECTIONS.map((s) => ({
      keys: s.keys,
      answer: `${s.title}: ${s.body}`,
      title: s.title,
    })),
    ...BOT_EXTRA.map((s) => ({ keys: s.keys, answer: s.answer, title: "Guide" })),
  ];
  let best = null;
  let bestScore = 0;
  for (const item of corpus) {
    const sc = scoreKnowledgeMatch(q, item.keys, item.answer);
    if (sc > bestScore) {
      bestScore = sc;
      best = item;
    }
  }
  // Need a real signal — avoid always returning the same weak match
  if (best && bestScore >= 4) {
    return best.answer;
  }
  // Suggest closest section titles for low-confidence
  const ranked = corpus
    .map((item) => ({ item, sc: scoreKnowledgeMatch(q, item.keys, item.answer) }))
    .filter((x) => x.sc > 0)
    .sort((a, b) => b.sc - a.sc)
    .slice(0, 3);
  if (ranked.length) {
    return (
      "I’m not fully sure. Closest Help topics: " +
      ranked.map((r) => r.item.title || "Guide").join(", ") +
      ". Try rephrasing, or open Help for the full rules."
    );
  }
  return "I couldn’t match that to a Help rule. Try keywords like Premium, community, vote, lock, title, archive, or open the Help screen.";
}

function AIChatBot({ onClose }) {
  const [messages, setMessages] = useState([
    {
      role: "bot",
      text: "Hello — I’m the Story Guide. I answer from the Help rules: Premium vs Free, communities, votes, locks, titles, archives, and more. Ask a specific question.",
    },
  ]);
  const [input, setInput] = useState("");
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = () => {
    const t = input.trim();
    if (!t) return;
    setMessages((m) => [...m, { role: "user", text: t }, { role: "bot", text: botReply(t) }]);
    setInput("");
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        background: "rgba(15,15,16,0.5)",
      }}
      onClick={onClose}
    >
      <div
        className="chn-rise"
        style={{
          width: "100%",
          maxWidth: 420,
          height: "min(80vh, 560px)",
          borderRadius: 16,
          display: "flex",
          flexDirection: "column",
          background: "var(--paper-card)",
          border: "1px solid var(--border)",
          overflow: "hidden",
          boxSizing: "border-box",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 16px",
            borderBottom: "1px solid rgba(15,15,16,0.10)",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <MessageCircle size={18} color="#1D9BF0" />
            <span className="chn-display" style={{ fontSize: 17, fontWeight: 700 }}>
              Story Guide
            </span>
          </div>
          <button
            onClick={onClose}
            type="button"
            style={{
              color: "var(--ink-soft)",
              background: "transparent",
              border: "none",
              padding: 4,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Messages */}
        <div
          className="chn-scrollbar"
          style={{
            flex: 1,
            overflowY: "auto",
            padding: 16,
            display: "flex",
            flexDirection: "column",
            gap: 12,
            minHeight: 0,
          }}
        >
          {messages.map((m, i) => (
            <div
              key={i}
              style={{
                fontSize: 14,
                maxWidth: "90%",
                alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                textAlign: m.role === "user" ? "right" : "left",
              }}
            >
              <div
                style={{
                  display: "inline-block",
                  padding: "10px 14px",
                  borderRadius: 12,
                  background: m.role === "user" ? "var(--btn)" : "var(--paper-2)",
                  color: m.role === "user" ? "var(--btn-ink)" : "var(--ink)",
                  lineHeight: 1.45,
                  textAlign: "left",
                }}
              >
                {m.text}
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>

        {/* Footer input */}
        <div
          style={{
            padding: 12,
            borderTop: "1px solid rgba(15,15,16,0.10)",
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexShrink: 0,
            background: "var(--paper-card)",
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Ask about video, archives, formats…"
            style={{
              flex: 1,
              minWidth: 0,
              padding: "10px 14px",
              borderRadius: 999,
              outline: "none",
              fontSize: 14,
              background: "var(--paper-2)",
              border: "1px solid var(--border)",
              color: "var(--ink)",
              boxSizing: "border-box",
            }}
          />
          <button
            onClick={send}
            type="button"
            className="chn-btn"
            style={{
              padding: "10px 18px",
              borderRadius: 999,
              fontSize: 14,
              fontWeight: 600,
              background: "#1D9BF0",
              color: "var(--btn-ink)",
              border: "none",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- profile gate ----------

function ProfileGate({ onDone }) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [invalidChar, setInvalidChar] = useState(false);

  const submit = async () => {
    const trimmed = name.trim().slice(0, 24);
    if (!trimmed) return;
    setError("");
    setSaving(true);
    if (await isNameTaken(trimmed)) {
      setSaving(false);
      setError("That name is already taken. Try another, or add an initial.");
      return;
    }
    const profile = {
      id: uid(),
      name: trimmed,
      linesWritten: 0,
      activeDays: 1,
      watches: 0,
      likes: 0,
      visibility: 0,
      credits: 50,
      premium: false,
      createdAt: Date.now(),
    };
    await setJSON("writer-profile", profile, false);
    await syncWriterToRegistry(profile);
    setSaving(false);
    onDone(profile);
  };

  return (
    <div className="chn-root min-h-screen flex items-center justify-center p-6">
      <GlobalStyle />
      <div className="chn-fold chn-rise max-w-sm w-full p-8 rounded-2xl">
        <Feather size={28} color="#1D9BF0" strokeWidth={1.5} />
        <h1 className="chn-display text-3xl mt-4 mb-2" style={{ color: "var(--ink)" }}>
          Sign the corner
        </h1>
        <p className="text-sm mb-5" style={{ color: "var(--ink-soft)" }}>
          Every strip of paper gets an author. Pick the name you'll write under —
          lowercase letters only, no spaces, numbers, or symbols. It must be unique, and you can change it later.
        </p>
        <input
          value={name}
          onChange={(e) => {
            const raw = e.target.value;
            setInvalidChar(/[^a-zA-Z]/.test(raw));
            setName(sanitizeUsername(raw));
            if (error) setError("");
          }}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="e.g. rmwrites"
          maxLength={24}
          className="w-full px-3 py-2 mb-1 rounded-2xl outline-none"
          style={{
            background: "var(--paper-2)",
            border: `1px solid ${error || invalidChar ? "#1D9BF0" : "rgba(15,15,16,0.14)"}`,
            fontFamily: 'Inter, system-ui, sans-serif',
          }}
          autoFocus
        />
        {invalidChar ? (
          <p className="text-xs mb-4 flex items-center gap-1" style={{ color: "#1D9BF0" }}>
            <AlertCircle size={13} /> Only lowercase letters (a–z) are allowed — no spaces, numbers, or symbols.
          </p>
        ) : error ? (
          <p className="text-xs mb-4 flex items-center gap-1" style={{ color: "#1D9BF0" }}>
            <AlertCircle size={13} /> {error}
          </p>
        ) : (
          <div className="mb-4" />
        )}
        <button
          onClick={submit}
          disabled={!name.trim() || saving}
          className="chn-btn w-full py-2.5 rounded-2xl text-sm tracking-wide disabled:opacity-40"
          style={{ background: "var(--btn)", color: "var(--btn-ink)" }}
        >
          {saving ? "Dipping the pen…" : "Begin"}
        </button>
      </div>
    </div>
  );
}

// ---------- New Chain Modal ----------

function NewChainModal({ onClose, onCreate }) {
  const [title, setTitle] = useState("");
  const [genre, setGenre] = useState(GENRES[0].id);
  const [theme, setTheme] = useState("");
  const [solo, setSolo] = useState(false);
  const [format, setFormat] = useState("movie");
  const [movieMinutes, setMovieMinutes] = useState(90);
  const [epMinutes, setEpMinutes] = useState(40);
  const [epsPerSeason, setEpsPerSeason] = useState(8);
  const [seasons, setSeasons] = useState(1);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(1);
  const [createError, setCreateError] = useState("");

  const submit = async () => {
    setCreateError("");
    const t = title.trim().slice(0, 60) || "An Untitled Chain";
    setBusy(true);
    const target = {
      format,
      movieMinutes: format === "movie" ? movieMinutes : null,
      episodeMinutes: format === "series" ? epMinutes : null,
      episodesPerSeason: format === "series" ? epsPerSeason : null,
      seasons: format === "series" ? seasons : null,
    };
    const result = await onCreate({ title: t, genre, theme: theme.trim().slice(0, 60), solo, target });
    setBusy(false);
    if (result && result.ok === false) {
      setCreateError(result.message || "Something went wrong creating the chain. Try again.");
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: "rgba(0,0,0,0.55)",
      }}
      onClick={onClose}
    >
      <div
        className="chn-rise chn-scrollbar"
        style={{
          width: "100%",
          maxWidth: 400,
          maxHeight: "90vh",
          overflowY: "auto",
          padding: "28px 24px",
          borderRadius: 16,
          background: "var(--paper-card)",
          border: "1px solid var(--border)",
          boxSizing: "border-box",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="chn-display" style={{ fontSize: "1.5rem", margin: "0 0 6px 0", color: "var(--ink)" }}>
          Start a new chain
        </h2>
        <p style={{ fontSize: 14, color: "var(--ink-soft)", margin: "0 0 22px 0", lineHeight: 1.45 }}>
          You write the first line. Everyone after you adds exactly one more.
        </p>

        {step === 1 && (
          <>
            <label style={{ display: "block", fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "#1D9BF0", marginBottom: 6 }}>
              Title
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="The Lighthouse Keeper's Debt"
              maxLength={60}
              style={{
                width: "100%",
                padding: "10px 12px",
                marginBottom: 16,
                borderRadius: 16,
                outline: "none",
                background: "var(--paper-2)",
                border: "1px solid var(--border)",
                color: "var(--ink)",
                fontSize: 15,
                boxSizing: "border-box",
              }}
            />

            <label style={{ display: "block", fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "#1D9BF0", marginBottom: 8 }}>
              Genre
            </label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
              {GENRES.map((g) => {
                const selected = genre === g.id;
                // Selected chips use theme primary tokens so custom/sand never force pure white text;
                // free genre accent only tints the fill when selected on mono themes.
                return (
                  <button
                    key={g.id}
                    onClick={() => setGenre(g.id)}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 16,
                      fontSize: 14,
                      cursor: "pointer",
                      background: selected ? "var(--btn)" : "var(--paper-2)",
                      color: selected ? "var(--btn-ink)" : "var(--ink)",
                      border: `1.5px solid ${selected ? "var(--btn)" : "var(--border)"}`,
                      fontWeight: selected ? 600 : 500,
                      boxShadow: selected ? `inset 0 0 0 2px ${g.accent}` : "none",
                    }}
                  >
                    {g.label}
                  </button>
                );
              })}
            </div>

            <label style={{ display: "block", fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "#1D9BF0", marginBottom: 6 }}>
              Theme / sub-genre <span style={{ color: "var(--ink-soft)", textTransform: "none", letterSpacing: 0 }}>(optional)</span>
            </label>
            <p style={{ fontSize: 12, color: "var(--ink-soft)", margin: "0 0 8px 0" }}>
              A tone to write toward — tragedy, dark comedy, redemption arc… shown to every writer as inspiration.
            </p>
            <input
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              placeholder="e.g. quiet tragedy"
              maxLength={60}
              style={{
                width: "100%",
                padding: "10px 12px",
                marginBottom: 16,
                borderRadius: 16,
                outline: "none",
                background: "var(--paper-2)",
                border: "1px solid var(--border)",
                color: "var(--ink)",
                fontSize: 15,
                boxSizing: "border-box",
              }}
            />

            <button
              onClick={() => setSolo((s) => !s)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 14,
                marginBottom: 24,
                color: "var(--ink-soft)",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: 0,
                textAlign: "left",
              }}
            >
              {solo ? <Unlock size={15} /> : <Lock size={15} />}
              <span>
                {solo
                  ? "Practice mode — you may write consecutive lines"
                  : "Chain rule — the same writer can't go twice in a row"}
              </span>
            </button>

            <div style={{ display: "flex", gap: 12 }}>
              <button
                onClick={onClose}
                className="chn-btn"
                style={{
                  flex: 1,
                  padding: "10px 12px",
                  borderRadius: 16,
                  fontSize: 14,
                  border: "1px solid var(--border)",
                  background: "transparent",
                  color: "var(--ink)",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => setStep(2)}
                className="chn-btn"
                style={{
                  flex: 1,
                  padding: "10px 12px",
                  borderRadius: 16,
                  fontSize: 14,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                  background: "#1D9BF0",
                  color: "var(--btn-ink)",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Next — Format <ChevronRight size={16} />
              </button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <label
              style={{
                display: "block",
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "#1D9BF0",
                marginBottom: 10,
              }}
            >
              Production format
            </label>
            <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
              <button
                type="button"
                onClick={() => setFormat("movie")}
                style={{
                  flex: 1,
                  padding: "16px 8px",
                  borderRadius: 12,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  cursor: "pointer",
                  background: format === "movie" ? "var(--btn)" : "var(--paper-card)",
                  color: format === "movie" ? "var(--btn-ink)" : "var(--ink)",
                  border: `1px solid ${format === "movie" ? "var(--btn)" : "var(--border)"}`,
                }}
              >
                <Film size={22} color={format === "movie" ? "var(--btn-ink)" : "var(--ink)"} />
                <span style={{ fontSize: 14, fontWeight: 700, color: format === "movie" ? "var(--btn-ink)" : "var(--ink)" }}>
                  Movie
                </span>
              </button>
              <button
                type="button"
                onClick={() => setFormat("series")}
                style={{
                  flex: 1,
                  padding: "16px 8px",
                  borderRadius: 12,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  cursor: "pointer",
                  background: format === "series" ? "var(--btn)" : "var(--paper-card)",
                  color: format === "series" ? "var(--btn-ink)" : "var(--ink)",
                  border: `1px solid ${format === "series" ? "var(--btn)" : "var(--border)"}`,
                }}
              >
                <Tv size={22} color={format === "series" ? "var(--btn-ink)" : "var(--ink)"} />
                <span style={{ fontSize: 14, fontWeight: 700, color: format === "series" ? "var(--btn-ink)" : "var(--ink)" }}>
                  Series
                </span>
              </button>
            </div>

            {format === "movie" && (
              <div style={{ marginBottom: 20 }}>
                <label
                  style={{
                    display: "block",
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "#1D9BF0",
                    marginBottom: 4,
                  }}
                >
                  Target runtime (minutes)
                </label>
                <p style={{ fontSize: 12, color: "var(--ink-soft)", margin: "0 0 8px 0" }}>
                  Min {MOVIE_MIN_MINUTES} min (1 hr) · Max {MOVIE_MAX_MINUTES} min (4 hrs)
                </p>
                <input
                  type="range"
                  min={MOVIE_MIN_MINUTES}
                  max={MOVIE_MAX_MINUTES}
                  step={15}
                  value={movieMinutes}
                  onChange={(e) => setMovieMinutes(Number(e.target.value))}
                  style={{ width: "100%", accentColor: "#1D9BF0" }}
                />
                <div
                  style={{
                    textAlign: "center",
                    fontSize: 22,
                    fontWeight: 700,
                    marginTop: 12,
                    color: "var(--ink)",
                    letterSpacing: "-0.02em",
                  }}
                >
                  {Math.floor(movieMinutes / 60)}h {movieMinutes % 60}m
                </div>
              </div>
            )}

            {format === "series" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 20, marginBottom: 20 }}>
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: 11,
                      fontWeight: 600,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: "#1D9BF0",
                      marginBottom: 4,
                    }}
                  >
                    Episode length (minutes)
                  </label>
                  <p style={{ fontSize: 12, color: "var(--ink-soft)", margin: "0 0 8px 0" }}>
                    {SERIES_EP_MIN}–{SERIES_EP_MAX} min
                  </p>
                  <input
                    type="range"
                    min={SERIES_EP_MIN}
                    max={SERIES_EP_MAX}
                    value={epMinutes}
                    onChange={(e) => setEpMinutes(Number(e.target.value))}
                    style={{ width: "100%", accentColor: "#1D9BF0" }}
                  />
                  <div style={{ textAlign: "center", fontSize: 14, marginTop: 8, color: "var(--ink)" }}>
                    {epMinutes} min / episode
                  </div>
                </div>
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: 11,
                      fontWeight: 600,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: "#1D9BF0",
                      marginBottom: 4,
                    }}
                  >
                    Episodes per season
                  </label>
                  <p style={{ fontSize: 12, color: "var(--ink-soft)", margin: "0 0 8px 0" }}>
                    {SERIES_EP_PER_SEASON_MIN}–{SERIES_EP_PER_SEASON_MAX}
                  </p>
                  <input
                    type="range"
                    min={SERIES_EP_PER_SEASON_MIN}
                    max={SERIES_EP_PER_SEASON_MAX}
                    value={epsPerSeason}
                    onChange={(e) => setEpsPerSeason(Number(e.target.value))}
                    style={{ width: "100%", accentColor: "#1D9BF0" }}
                  />
                  <div style={{ textAlign: "center", fontSize: 14, marginTop: 8, color: "var(--ink)" }}>
                    {epsPerSeason} episodes
                  </div>
                </div>
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: 11,
                      fontWeight: 600,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: "#1D9BF0",
                      marginBottom: 4,
                    }}
                  >
                    Number of seasons
                  </label>
                  <p style={{ fontSize: 12, color: "var(--ink-soft)", margin: "0 0 8px 0" }}>
                    {SERIES_SEASONS_MIN}–{SERIES_SEASONS_MAX}
                  </p>
                  <input
                    type="range"
                    min={SERIES_SEASONS_MIN}
                    max={SERIES_SEASONS_MAX}
                    value={seasons}
                    onChange={(e) => setSeasons(Number(e.target.value))}
                    style={{ width: "100%", accentColor: "#1D9BF0" }}
                  />
                  <div style={{ textAlign: "center", fontSize: 14, marginTop: 8, color: "var(--ink)" }}>
                    {seasons} season{seasons > 1 ? "s" : ""}
                  </div>
                </div>
                <p style={{ fontSize: 12, textAlign: "center", color: "var(--ink-soft)", margin: 0 }}>
                  Total target ≈ {seasons * epsPerSeason * epMinutes} minutes of story
                </p>
              </div>
            )}

            {createError && (
              <p
                style={{
                  fontSize: 12,
                  marginBottom: 12,
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  color: "#1D9BF0",
                }}
              >
                <AlertCircle size={13} /> {createError}
              </p>
            )}

            <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="chn-btn"
                style={{
                  flex: 1,
                  padding: "12px 16px",
                  borderRadius: 999,
                  fontSize: 14,
                  fontWeight: 600,
                  border: "1px solid var(--border)",
                  background: "transparent",
                  color: "var(--ink)",
                  cursor: "pointer",
                }}
              >
                Back
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={busy}
                className="chn-btn"
                style={{
                  flex: 1,
                  padding: "12px 16px",
                  borderRadius: 999,
                  fontSize: 14,
                  fontWeight: 600,
                  background: "#1D9BF0",
                  color: "var(--btn-ink)",
                  border: "none",
                  cursor: busy ? "wait" : "pointer",
                  opacity: busy ? 0.7 : 1,
                }}
              >
                {busy ? "Creating…" : createError ? "Try again" : "Create chain"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ---------- Watch Mode ----------

function WatchMode({ chain, profile, onClose, onLike }) {
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [liked, setLiked] = useState(false);
  const lines = chain.lines || [];
  const timerRef = useRef(null);

  useEffect(() => {
    if (!playing || idx >= lines.length) return;
    timerRef.current = setTimeout(() => {
      setIdx((i) => Math.min(i + 1, lines.length));
    }, 4200);
    return () => clearTimeout(timerRef.current);
  }, [playing, idx, lines.length]);

  const progress = lines.length ? (idx / lines.length) * 100 : 0;
  const done = idx >= lines.length;

  return (
    <div className="fixed inset-0 z-50 cinema-mode flex flex-col" style={{ background: "#000000" }}>
      <div className="flex items-center justify-between px-4 py-3">
        <button onClick={onClose} className="flex items-center gap-1.5 text-sm" style={{ color: "#A1A1AA" }}>
          <ArrowLeft size={16} /> Exit watch
        </button>
        <span className="chn-type text-xs tracking-widest uppercase" style={{ color: "#A1A1AA" }}>
          {chain.title}
        </span>
        <button
          onClick={() => {
            setLiked((v) => !v);
            onLike?.(liked ? -1 : 1);
          }}
          className="flex items-center gap-1 text-sm"
          style={{ color: liked ? "#1D9BF0" : "#A1A1AA" }}
        >
          <ThumbsUp size={16} fill={liked ? "#1D9BF0" : "none"} /> {liked ? "Liked" : "Like"}
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center px-8">
        {done ? (
          <div className="text-center chn-fade">
            <p className="chn-display text-4xl mb-2" style={{ color: "#F4F4F5" }}>— The End —</p>
            <p className="text-sm" style={{ color: "#A1A1AA" }}>
              {lines.length} lines · {chain.createdBy}
            </p>
          </div>
        ) : (
          <div className="max-w-2xl text-center chn-fade" key={idx}>
            <p className="text-2xl md:text-3xl leading-relaxed" style={{ color: "#F4F4F5", fontFamily: 'Inter, system-ui, sans-serif' }}>
              {lines[idx]?.text}
            </p>
            <p
              style={{
                marginTop: 24,
                fontSize: 12,
                color: "#1D9BF0",
                fontWeight: 500,
                letterSpacing: "normal",
                textTransform: "none",
              }}
            >
              — {lines[idx]?.authorName}
            </p>
          </div>
        )}
      </div>

      <div className="px-6 pb-6">
        <div className="h-1 rounded-full mb-3" style={{ background: "rgba(232,228,217,0.15)" }}>
          <div
            className="h-1 rounded-full transition-all"
            style={{ width: `${progress}%`, background: "#B08D57" }}
          />
        </div>
        <div className="flex items-center justify-between">
          <button
            onClick={() => setPlaying((p) => !p)}
            className="text-sm px-3 py-1.5 rounded-2xl"
            style={{ border: "1px solid rgba(244,244,245,0.14)", color: "#F4F4F5" }}
          >
            {playing ? "Pause" : "Play"}
          </button>
          <span className="text-xs" style={{ color: "#A1A1AA" }}>
            {Math.min(idx + 1, lines.length)} / {lines.length}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setIdx((i) => Math.max(0, i - 1))}
              className="text-sm px-3 py-1.5 rounded-2xl"
              style={{ border: "1px solid rgba(244,244,245,0.14)", color: "#F4F4F5" }}
            >
              Prev
            </button>
            <button
              onClick={() => setIdx((i) => Math.min(lines.length, i + 1))}
              className="text-sm px-3 py-1.5 rounded-2xl"
              style={{ border: "1px solid rgba(244,244,245,0.14)", color: "#F4F4F5" }}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- Video generation demo modal ----------

function VideoGenModal({ chain, onClose }) {
  const [phase, setPhase] = useState("idle");
  const [log, setLog] = useState("");

  const start = () => {
    setPhase("working");
    setLog("Connecting to local renderer (localhost:8000)…");
    setTimeout(() => setLog("Storyboard extracted. Encoding frames…"), 900);
    setTimeout(() => setLog("Muxing audio bed and titles…"), 2200);
    setTimeout(() => {
      setPhase("done");
      setLog(
        "Demo complete. No real MP4 was written because no backend is running. " +
          "Deploy a renderer that accepts POST /render with the chain JSON and returns an MP4 URL, " +
          "then point the app at that host instead of localhost:8000."
      );
    }, 3800);
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: "rgba(15,15,16,0.5)",
      }}
      onClick={onClose}
    >
      <div
        className="chn-fold chn-rise"
        style={{
          width: "100%",
          maxWidth: 420,
          padding: 24,
          borderRadius: 16,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="chn-display text-xl mb-2">Generate MP4 reel</h3>
        <p className="text-sm mb-4" style={{ color: "var(--ink-soft)" }}>
          Experimental. Requires a user-deployed backend. This UI only simulates the request.
        </p>
        {phase === "idle" && (
          <button
            onClick={start}
            className="chn-btn w-full py-2.5 rounded-2xl text-sm mb-3"
            style={{ background: "var(--btn)", color: "var(--btn-ink)" }}
          >
            Start generation
          </button>
        )}
        {phase === "working" && (
          <div className="flex items-center gap-2 text-sm mb-3" style={{ color: "var(--ink-soft)" }}>
            <RefreshCw className="animate-spin" size={16} /> {log}
          </div>
        )}
        {(phase === "done" || phase === "error") && (
          <p className="text-sm mb-4" style={{ color: phase === "done" ? "#2E5A3C" : "#1D9BF0" }}>
            {log}
          </p>
        )}
        <button
          onClick={onClose}
          className="chn-btn w-full py-2 rounded-2xl text-sm"
          style={{ border: "1px solid var(--border)" }}
        >
          Close
        </button>
      </div>
    </div>
  );
}

// ---------- Offline HTML reel download ----------

function downloadHtmlReel(chain) {
  const lines = (chain.lines || [])
    .map(
      (l, i) =>
        `<div class="line" data-i="${i}" style="display:none"><p>${escapeHtml(l.text)}</p><cite>— ${escapeHtml(l.authorName)}</cite></div>`
    )
    .join("\n");
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${escapeHtml(chain.title)} — Chain Stories Reel</title>
<style>
  body{margin:0;background:#000000;color:#F4F4F5;font-family:Georgia,serif;display:flex;align-items:center;justify-content:center;min-height:100vh}
  .wrap{max-width:640px;padding:2rem;text-align:center}
  cite{display:block;margin-top:1.5rem;font-family:monospace;font-size:12px;color:#1D9BF0}
  h1{font-size:1.2rem;opacity:.6;margin-bottom:2rem}
</style></head><body>
<div class="wrap"><h1>${escapeHtml(chain.title)}</h1><div id="stage"></div></div>
<script>
const lines = ${JSON.stringify((chain.lines || []).map((l) => ({ text: l.text, authorName: l.authorName })))};
let i = 0;
const stage = document.getElementById("stage");
function show() {
  if (i >= lines.length) {
    stage.innerHTML = "<p style='font-size:2rem'>— The End —</p>";
    return;
  }
  const l = lines[i];
  stage.innerHTML = "<p style='font-size:1.6rem;line-height:1.5'>" + l.text.replace(/</g,"&lt;") + "</p><cite>— " + l.authorName.replace(/</g,"&lt;") + "</cite>";
  i++;
  setTimeout(show, 4000);
}
show();
</script></body></html>`;
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(chain.title || "chain").replace(/[^a-z0-9]/gi, "_").slice(0, 40)}_reel.html`;
  a.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ---------- Lobby ----------

function Lobby({ profile, onOpenChain, onUpdateProfile, onOpenArchives, onOpenHelp }) {
  const [chains, setChains] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [tab, setTab] = useState("active");
  const [showChat, setShowChat] = useState(false);
  const [showLeader, setShowLeader] = useState(false);
  const [showCommunities, setShowCommunities] = useState(false);
  const [inviteInput, setInviteInput] = useState("");
  const [inviteMsg, setInviteMsg] = useState("");
  const [lockPrompt, setLockPrompt] = useState(null);
  const [showLikesBoard, setShowLikesBoard] = useState(false);
  const [showEditName, setShowEditName] = useState(false);
  const [likedIds, setLikedIds] = useState(() => new Set());

  const runMaintenance = useCallback(async () => {
    const idx = (await getJSON("chains-index", true)) || [];
    const now = Date.now();
    const next = [];
    for (const summary of idx) {
      let full = await getJSON(`chain:${summary.id}`, true);
      if (!full) continue;

      // Permanently skip deleted chains
      if (full.deleted) {
        try {
          await storage.delete?.(`chain:${summary.id}`, true);
        } catch (_) {}
        continue;
      }

      // Expire stale votes (delete / archive / unarchive)
      const cleaned = cleanExpiredVotes(full);
      if (cleaned !== full) {
        full = cleaned;
        await setJSON(`chain:${summary.id}`, full, true);
      }

      const lastActivity = full.updatedAt || full.createdAt || summary.updatedAt || now;
      const ageDays = daysSince(lastActivity);
      const lineCount = (full.lines || []).length;

      if (ageDays > ARCHIVE_DAYS) {
        if (lineCount < MIN_LINES_TO_ARCHIVE) {
          try {
            await storage.delete?.(`chain:${summary.id}`, true);
          } catch (_) {}
          continue;
        }
        if (!full.archivedAt) {
          full.archivedAt = now;
          full.archived = true;
          await setJSON(`chain:${summary.id}`, full, true);
        }
        const archivedHours = hoursSince(full.archivedAt);
        if (archivedHours > ARCHIVE_VISIBLE_HOURS) {
          summary.archived = true;
          summary.archivedAt = full.archivedAt;
        } else {
          summary.archived = true;
          summary.archivedAt = full.archivedAt;
          summary.stillOnTimeline = true;
        }
      }
      // Manual archive (user vote) always off timeline once archived
      if (full.archived && full.archiveSource === "vote") {
        summary.archived = true;
        summary.archivedAt = full.archivedAt;
        summary.stillOnTimeline = false;
      }
      next.push({
        ...summary,
        lineCount,
        finished: full.finished,
        archived: !!full.archived,
        archivedAt: full.archivedAt || null,
        locked: !!full.locked,
        likes: full.likes || 0,
        format: full.target?.format || "movie",
        lastLine: full.lines?.[full.lines.length - 1]?.text || "",
        lastAuthor: full.lines?.[full.lines.length - 1]?.authorName || "",
        updatedAt: full.updatedAt || lastActivity,
        needsAttention: needsAttentionOnChain(full, profile.id),
        hasOpenVote:
          (!!full.deletePetition && !isVoteExpired(full.deletePetition)) ||
          (!!full.archiveVote && !isVoteExpired(full.archiveVote)) ||
          (!!full.unarchiveVote && !isVoteExpired(full.unarchiveVote)),
      });
    }
    await setJSON("chains-index", next, true);
    return next;
  }, [profile.id]);

  const refresh = useCallback(async () => {
    await maintainCommunities();
    const maintained = await runMaintenance();
    // Locked stories stay on the timeline with a padlock
    setChains(maintained || []);
    if (profile?.id && maintained?.length) {
      const next = new Set();
      await Promise.all(
        maintained.map(async (c) => {
          const liked = await getJSON(`liked:${profile.id}:${c.id}`, false);
          if (liked) next.add(c.id);
        })
      );
      setLikedIds(next);
    }
  }, [runMaintenance, profile?.id]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, [refresh]);

  const createChain = async ({ title, genre, theme, solo, target }) => {
    const id = uid();
    const chain = {
      id,
      title,
      genre,
      theme: theme || "",
      solo,
      finished: false,
      archived: false,
      archiveSource: null,
      deletePetition: null,
      archiveVote: null,
      unarchiveVote: null,
      locked: false,
      inviteCode: null,
      invitedIds: [],
      admins: [{ id: profile.id, name: profile.name, since: Date.now() }],
      kickedIds: [],
      adminElection: null,
      kickVote: null,
      confidenceVote: null,
      titleChangeLog: [],
      titleVote: null,
      twist: TWIST_WORDS[Math.floor(Math.random() * TWIST_WORDS.length)],
      lines: [],
      createdBy: profile.name,
      createdById: profile.id,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      target: target || { format: "movie", movieMinutes: 90 },
      likes: 0,
      watches: 0,
    };

    const written = await setJSONDiag(`chain:${id}`, chain, true);
    if (!written.ok) {
      return { ok: false, message: `Couldn't save the new chain — storage error: ${written.error}` };
    }

    // Storage can lag a moment before a write is readable. Verify before navigating
    // so we never send someone into a chain room for a chain that isn't there yet.
    let verified = null;
    for (let attempt = 0; attempt < 5 && !verified; attempt++) {
      verified = await getJSON(`chain:${id}`, true);
      if (!verified) await new Promise((r) => setTimeout(r, 400));
    }
    if (!verified) {
      return { ok: false, message: "The chain saved but isn't showing up yet. Wait a moment and try opening it from the timeline." };
    }

    const idx = (await getJSON("chains-index", true)) || [];
    const summary = {
      id,
      title,
      genre,
      theme: theme || "",
      solo,
      finished: false,
      archived: false,
      lineCount: 0,
      lastLine: "",
      lastAuthor: "",
      updatedAt: Date.now(),
      format: target?.format || "movie",
    };
    await setJSON("chains-index", [summary, ...idx], true);
    setShowNew(false);
    onOpenChain(id);
    return { ok: true };
  };


  const likeChain = async (e, chainId) => {
    e.stopPropagation();
    e.preventDefault();
    const full = await getJSON(`chain:${chainId}`, true);
    if (!full) return;
    const likedKey = `liked:${profile.id}:${chainId}`;
    const already = await getJSON(likedKey, false);
    const delta = already ? -1 : 1;
    const updated = {
      ...full,
      likes: Math.max(0, (full.likes || 0) + delta),
      updatedAt: Date.now(),
    };
    await setJSON(`chain:${chainId}`, updated, true);
    if (already) {
      await storage.delete?.(likedKey, false);
      try {
        localStorage.removeItem(likedKey);
      } catch (_) {}
      setLikedIds((prev) => {
        const n = new Set(prev);
        n.delete(chainId);
        return n;
      });
    } else {
      await setJSON(likedKey, { ts: Date.now() }, false);
      setLikedIds((prev) => {
        const n = new Set(prev);
        n.add(chainId);
        return n;
      });
    }
    const idx = (await getJSON("chains-index", true)) || [];
    await setJSON(
      "chains-index",
      idx.map((c) => (c.id === chainId ? { ...c, likes: updated.likes } : c)),
      true
    );
    const registry = (await getJSON("writers-registry", true)) || {};
    const authorIds = [...new Set((full.lines || []).map((l) => l.authorId).filter(Boolean))];
    for (const aid of authorIds) {
      if (!registry[aid]) continue;
      registry[aid] = {
        ...registry[aid],
        likes: Math.max(0, (registry[aid].likes || 0) + delta),
      };
    }
    await setJSON("writers-registry", registry, true);
    if (authorIds.includes(profile.id)) {
      const p = { ...profile, likes: Math.max(0, (profile.likes || 0) + delta) };
      await saveProfile(p, onUpdateProfile);
    }
    refresh();
  };

  const activeChains = (chains || []).filter((c) => !c.archived || c.stillOnTimeline);
  const archivedChains = (chains || []).filter((c) => c.archived);
  const attentionCount = (chains || []).filter((c) => c.needsAttention).length;
  const attentionOnTimeline = activeChains.some((c) => c.needsAttention);
  const attentionOnArchives = archivedChains.some((c) => c.needsAttention);

  return (
    <div className="chn-root min-h-screen">
      <GlobalStyle />
      <div className="chn-shell">
        {/* Top meta row — tagline left, author right (inline layout) */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#1D9BF0" }}>
            <ScrollText size={16} strokeWidth={1.5} />
            <span className="chn-type" style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase" }}>
              One line at a time
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              onClick={() => setShowLikesBoard(true)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                padding: "4px 10px",
                borderRadius: 999,
                border: "1px solid rgba(29,155,240,0.3)",
                color: "#1D9BF0",
                background: "transparent",
                fontSize: 14,
                cursor: "pointer",
              }}
              title="Likes board"
            >
              <Heart size={14} fill="#1D9BF0" /> {profile.likes || 0}
            </button>

            <button
              onClick={() => setShowEditName(true)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                border: "none",
                background: "transparent",
                color: "var(--ink-soft)",
                cursor: "pointer",
                padding: 0,
                position: "relative",
              }}
              title={attentionCount > 0 ? `Votes need your attention (${attentionCount})` : "Profile"}
            >
              <span style={{ textAlign: "right", lineHeight: 1.2 }}>
                <span style={{ display: "block", fontSize: 11 }}>writing as</span>
                <span className="chn-display" style={{ fontSize: 16, color: "var(--ink)" }}>
                  {profile.name}
                  {profile.premium && (
                    <span
                      style={{
                        marginLeft: 6,
                        fontSize: 10,
                        padding: "2px 6px",
                        borderRadius: 3,
                        background: "#B08D57",
                        color: "var(--ink)",
                      }}
                    >
                      CS
                    </span>
                  )}
                </span>
              </span>
              <span
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background: "var(--btn)",
                  color: "var(--btn-ink)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  position: "relative",
                }}
              >
                <User size={15} />
                {attentionCount > 0 && (
                  <span
                    style={{
                      position: "absolute",
                      top: -2,
                      right: -2,
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      background: "#DC2626",
                      border: "2px solid var(--btn)",
                      boxSizing: "border-box",
                    }}
                    title={`${attentionCount} vote(s) need your attention`}
                  />
                )}
              </span>
            </button>
          </div>
        </div>

        {/* Title */}
        <h1 className="chn-display" style={{ fontSize: "clamp(2rem, 5vw, 2.75rem)", margin: "0 0 1.5rem 0", lineHeight: 1.1 }}>
          Chain Stories
        </h1>

        {/* Actions */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 24 }}>
          <button
            onClick={() => setShowNew(true)}
            className="chn-btn chn-btn-primary"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 18px",
              borderRadius: 999,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            <Plus size={16} /> New chain
          </button>
          <button
            onClick={() => setShowChat(true)}
            className="chn-btn chn-btn-ghost"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "10px 18px",
              borderRadius: 999,
              fontSize: 14,
              cursor: "pointer",
            }}
            title="Ask the Story Guide"
          >
            <MessageCircle size={16} /> Guide
          </button>
          <button
            onClick={() => setShowLeader(true)}
            className="chn-btn chn-btn-ghost"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "10px 18px",
              borderRadius: 999,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            <Award size={16} /> Board
          </button>
          <button
            onClick={() => setShowCommunities(true)}
            className="chn-btn chn-btn-ghost"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "10px 18px",
              borderRadius: 999,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            <Users size={16} /> Communities
          </button>
          <button
            onClick={() => onOpenHelp?.()}
            className="chn-btn chn-btn-ghost"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "10px 14px",
              borderRadius: 999,
              fontSize: 14,
              cursor: "pointer",
            }}
            title="Help & rules"
          >
            <HelpCircle size={16} />
          </button>
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            marginBottom: 16,
            alignItems: "center",
          }}
        >
          <input
            value={inviteInput}
            onChange={(e) => {
              setInviteInput(e.target.value.toUpperCase().slice(0, 12));
              setInviteMsg("");
            }}
            placeholder="Invite code"
            style={{
              flex: "1 1 140px",
              minWidth: 120,
              padding: "8px 12px",
              borderRadius: 999,
              border: "1px solid var(--border)",
              background: "var(--paper-2)",
              color: "var(--ink)",
              fontSize: 13,
              outline: "none",
            }}
          />
          <button
            type="button"
            className="chn-btn chn-btn-primary"
            onClick={async () => {
              const code = inviteInput.trim().toUpperCase();
              if (!code) return;
              const idx = (await getJSON("chains-index", true)) || [];
              let matched = null;
              for (const s of idx) {
                const full = await getJSON(`chain:${s.id}`, true);
                if (full?.locked && full.inviteCode === code) {
                  if (full.finished || full.inviteExpired) {
                    setInviteMsg("That story invite has expired — the story already ended. Community access is unchanged.");
                    return;
                  }
                  matched = full;
                  break;
                }
              }
              if (!matched) {
                setInviteMsg("No locked story matches that code.");
                return;
              }
              const next = {
                ...profile,
                redeemedInvites: [...new Set([...(profile.redeemedInvites || []), code])],
              };
              await saveProfile(next, onUpdateProfile);
              setInviteMsg(`Access granted to “${matched.title}”.`);
              setInviteInput("");
              onOpenChain(matched.id);
            }}
            style={{
              padding: "8px 14px",
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Redeem invite
          </button>
          {inviteMsg && (
            <span style={{ fontSize: 12, color: "#1D9BF0", width: "100%" }}>{inviteMsg}</span>
          )}
        </div>

        <div
          style={{
            display: "flex",
            gap: 16,
            marginBottom: 12,
            borderBottom: "1px solid var(--border)",
            fontSize: 14,
          }}
        >
          <button
            onClick={() => setTab("active")}
            style={{
              padding: "0 4px 8px",
              border: "none",
              background: "transparent",
              cursor: "pointer",
              color: tab === "active" ? "var(--ink)" : "var(--ink-soft)",
              borderBottom: tab === "active" ? "2px solid #1D9BF0" : "2px solid transparent",
              marginBottom: -1,
              fontFamily: "inherit",
              fontSize: 14,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            Timeline
            {attentionOnTimeline && (
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "#DC2626",
                  flexShrink: 0,
                }}
                title="A vote needs your attention"
              />
            )}
          </button>
          <button
            onClick={() => setTab("archives")}
            style={{
              padding: "0 4px 8px",
              border: "none",
              background: "transparent",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 4,
              color: tab === "archives" ? "var(--ink)" : "var(--ink-soft)",
              borderBottom: tab === "archives" ? "2px solid #1D9BF0" : "2px solid transparent",
              marginBottom: -1,
              fontFamily: "inherit",
              fontSize: 14,
            }}
          >
            <Archive size={14} /> Archives only
            {attentionOnArchives && (
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "#DC2626",
                  flexShrink: 0,
                  marginLeft: 2,
                }}
                title="A vote needs your attention"
              />
            )}
          </button>
        </div>
        {tab === "archives" && (
          <p style={{ fontSize: 13, lineHeight: 1.55, color: "var(--ink-soft)", margin: "0 0 16px 0" }}>
            Separate archive shelf: chains inactive 30+ days. They leave the main timeline after 48 hours in archive status.
          </p>
        )}

        {chains === null && (
          <p className="text-sm" style={{ color: "var(--ink-soft)" }}>Unrolling the shelf…</p>
        )}

        {tab === "active" && chains && activeChains.length === 0 && (
          <div
            style={{
              width: "100%",
              padding: "28px 22px",
              borderRadius: 16,
              background: "var(--paper-card)",
              border: "1px solid var(--border)",
              boxSizing: "border-box",
              textAlign: "left",
            }}
          >
            <p
              className="chn-display"
              style={{ fontSize: 20, fontWeight: 700, margin: "0 0 8px 0", color: "var(--ink)", textAlign: "left" }}
            >
              No chains on the timeline
            </p>
            <p style={{ fontSize: 14, lineHeight: 1.5, color: "var(--ink-soft)", margin: 0, textAlign: "left" }}>
              Be the first to leave a line for someone else to find. Chains inactive 30+ days move to Archives (or are deleted if under 5 lines).
            </p>
          </div>
        )}

        {tab === "archives" && chains && archivedChains.length === 0 && (
          <div
            style={{
              width: "100%",
              padding: "28px 22px",
              borderRadius: 16,
              background: "var(--paper-card)",
              border: "1px solid var(--border)",
              boxSizing: "border-box",
              textAlign: "left",
            }}
          >
            <p
              className="chn-display"
              style={{ fontSize: 20, fontWeight: 700, margin: "0 0 8px 0", color: "var(--ink)", textAlign: "left" }}
            >
              Archive is empty
            </p>
            <p style={{ fontSize: 14, lineHeight: 1.5, color: "var(--ink-soft)", margin: 0, textAlign: "left" }}>
              After 30 days of inactivity, chains with 5+ lines land here.
            </p>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
          {(tab === "active" ? activeChains : archivedChains).map((c, i) => {
            const g = genreMeta(c.genre);
            return (
              <button
                key={c.id}
                onClick={async () => {
                  if (!c.locked) {
                    onOpenChain(c.id);
                    return;
                  }
                  const full = (await getJSON(`chain:${c.id}`, true)) || c;
                  if (await canOpenChain(full, profile)) {
                    onOpenChain(c.id);
                    return;
                  }
                  setLockPrompt({ id: c.id, title: c.title || "Locked story" });
                }}
                className="chn-fold chn-rise"
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "18px 18px 16px",
                  borderRadius: 16,
                  display: "block",
                  cursor: "pointer",
                  background: "var(--paper-card)",
                  border: "1px solid var(--border)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    marginBottom: 10,
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      padding: "4px 10px",
                      borderRadius: 8,
                      background: g.accent,
                      color: "var(--btn-ink)",
                      flexShrink: 0,
                    }}
                  >
                    {g.label}
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      color: "var(--ink-soft)",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      flexShrink: 0,
                    }}
                  >
                    {c.needsAttention && (
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: "#DC2626",
                          flexShrink: 0,
                        }}
                        title="Vote needs your attention"
                      />
                    )}
                    {c.locked && <Lock size={12} color="#1D9BF0" />}
                    {c.format === "series" ? <Tv size={12} /> : <Film size={12} />}
                    {c.finished ? "Finished" : `${c.lineCount} line${c.lineCount === 1 ? "" : "s"}`}
                    {c.solo ? " · practice" : ""}
                    {c.archived ? " · archived" : ""}
                  </span>
                </div>
                <h3
                  className="chn-display"
                  style={{
                    fontSize: 20,
                    margin: "0 0 6px 0",
                    color: "var(--ink)",
                    lineHeight: 1.25,
                    textAlign: "left",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  {c.locked && <Lock size={18} color="#1D9BF0" style={{ flexShrink: 0 }} />}
                  <span style={{ minWidth: 0, flex: 1 }}>{c.title}</span>
                  <button
                    type="button"
                    onClick={(e) => likeChain(e, c.id)}
                    className="chn-btn"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "4px 10px",
                      borderRadius: 999,
                      border: "1px solid var(--border)",
                      background: "var(--paper-card)",
                      fontSize: 12,
                      color: "#1D9BF0",
                      cursor: "pointer",
                      flexShrink: 0,
                    }}
                    title={likedIds.has(c.id) ? "Unlike this story" : "Like this story"}
                  >
                    <Heart size={14} color="#1D9BF0" fill={likedIds.has(c.id) ? "#1D9BF0" : "none"} />
                    {c.likes || 0}
                  </button>
                </h3>
                {c.lastLine ? (
                  <p
                    style={{
                      fontSize: 14,
                      fontStyle: "italic",
                      color: "var(--ink-soft)",
                      margin: 0,
                      textAlign: "left",
                      lineHeight: 1.4,
                    }}
                  >
                    "…{c.lastLine.slice(0, 80)}{c.lastLine.length > 80 ? "…" : ""}"{" "}
                    <span style={{ fontStyle: "normal" }}>— {c.lastAuthor}, {timeAgo(c.updatedAt)}</span>
                  </p>
                ) : (
                  <p
                    style={{
                      fontSize: 14,
                      fontStyle: "italic",
                      color: "var(--ink-soft)",
                      margin: 0,
                      textAlign: "left",
                    }}
                  >
                    Waiting for its first line.
                  </p>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {showNew && <NewChainModal onClose={() => setShowNew(false)} onCreate={createChain} />}
      {showChat && <AIChatBot onClose={() => setShowChat(false)} />}
      {showEditName && (
        <EditNameModal
          profile={profile}
          onClose={() => setShowEditName(false)}
          onUpdateProfile={onUpdateProfile}
        />
      )}
      {showLeader && (
        <LeaderboardModal profile={profile} onClose={() => setShowLeader(false)} />
      )}
      {showLikesBoard && (
        <LikesBoardModal profile={profile} onClose={() => setShowLikesBoard(false)} />
      )}
      {showCommunities && (
        <CommunitiesModal
          profile={profile}
          onClose={() => setShowCommunities(false)}
          onUpdateProfile={onUpdateProfile}
        />
      )}
      {lockPrompt && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 50,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            background: "rgba(0,0,0,0.55)",
          }}
          onClick={() => setLockPrompt(null)}
        >
          <div
            className="chn-rise"
            style={{
              width: "100%",
              maxWidth: 380,
              padding: 24,
              borderRadius: 16,
              background: "var(--paper-card)",
              border: "1px solid var(--border)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <Lock size={18} color="#1D9BF0" />
              <h3 className="chn-display" style={{ fontSize: 18, margin: 0 }}>
                Locked story
              </h3>
            </div>
            <p style={{ fontSize: 14, color: "var(--ink-soft)", margin: "0 0 12px 0", lineHeight: 1.45 }}>
              “{lockPrompt.title}” stays on the timeline with a padlock. Open it if you share a community
              with the starter, or redeem a story invite. If a community starter removed you, you need an
              invite for locked stories again.
            </p>
            <button
              type="button"
              onClick={() => setLockPrompt(null)}
              className="chn-btn"
              style={{
                width: "100%",
                padding: "12px 16px",
                borderRadius: 999,
                border: "none",
                background: "var(--btn)",
                color: "var(--btn-ink)",
                fontWeight: 600,
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CommunitiesModal({ profile, onClose, onUpdateProfile }) {
  const [list, setList] = useState(null);
  const [selected, setSelected] = useState(null);
  const [name, setName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [registry, setRegistry] = useState({});
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const reload = useCallback(async () => {
    await maintainCommunities();
    setList(await listCommunities());
    setRegistry((await getJSON("writers-registry", true)) || {});
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const memberLabel = (id, community) => {
    if (id === profile.id) return `${profile.name} (you)`;
    const stored = community?.memberNames?.[id];
    if (stored) {
      return id === community.createdById ? `${stored} (starter)` : stored;
    }
    if (id === community?.createdById) return `${community.createdBy || "starter"} (starter)`;
    const fromReg = registry[id]?.name;
    if (fromReg) return fromReg;
    return "Member";
  };

  const loadDetail = async (id) => {
    const full = await getJSON(`community:${id}`, true);
    setSelected(full);
  };

  const create = async () => {
    if (!profile.premium) {
      setMsg("Only Premium can create a community (demo toggle on the Board).");
      return;
    }
    const n = name.trim().slice(0, 40);
    if (!n) return;
    setBusy(true);
    const id = uid();
    const community = {
      id,
      name: n,
      createdBy: profile.name,
      createdById: profile.id,
      createdAt: Date.now(),
      memberIds: [profile.id],
      memberNames: { [profile.id]: profile.name },
      activeAt: { [profile.id]: Date.now() },
      inviteCode: makeInviteCode(),
      dissolved: false,
    };
    await saveCommunity(community);
    setName("");
    setBusy(false);
    setShowCreate(false);
    setMsg(`Created “${n}”. Code: ${community.inviteCode}`);
    setSelected(community);
    reload();
  };

  const join = async () => {
    const code = joinCode.trim().toUpperCase();
    if (!code) return;
    setBusy(true);
    const idx = await listCommunities();
    const summary = idx.find((c) => !c.dissolved && c.inviteCode === code);
    if (!summary) {
      setBusy(false);
      setMsg("No active community matches that code.");
      return;
    }
    const full = await getJSON(`community:${summary.id}`, true);
    if (!full || full.dissolved) {
      setBusy(false);
      setMsg("That community has dissolved.");
      return;
    }
    if ((full.memberIds || []).includes(profile.id)) {
      setBusy(false);
      setMsg("You're already a member.");
      return;
    }
    const updated = {
      ...full,
      memberIds: [...(full.memberIds || []), profile.id],
      memberNames: { ...(full.memberNames || {}), [profile.id]: profile.name },
      activeAt: { ...(full.activeAt || {}), [profile.id]: Date.now() },
    };
    await saveCommunity(updated);
    setJoinCode("");
    setBusy(false);
    setMsg(`Joined “${full.name}”. Direct access to members' locked stories enabled.`);
    setSelected(updated);
    reload();
  };

  const removeMember = async (memberId) => {
    if (!selected || selected.createdById !== profile.id) return;
    if (memberId === selected.createdById) return;
    const memberNames = { ...(selected.memberNames || {}) };
    delete memberNames[memberId];
    const updated = {
      ...selected,
      memberIds: (selected.memberIds || []).filter((id) => id !== memberId),
      memberNames,
    };
    const activeAt = { ...(updated.activeAt || {}) };
    delete activeAt[memberId];
    updated.activeAt = activeAt;
    await saveCommunity(updated);
    setSelected(updated);
    setMsg("Member removed. They need story invites for locked stories again.");
    reload();
  };

  const dissolveCommunity = async (communityId) => {
    const id = communityId || selected?.id;
    if (!id || busy) return;
    const full = selected?.id === id ? selected : await getJSON(`community:${id}`, true);
    if (!full || full.createdById !== profile.id) return;
    setBusy(true);
    const name = full.name || "Community";
    await purgeCommunity(id);
    if (selected?.id === id) setSelected(null);
    setConfirmDeleteId(null);
    setBusy(false);
    setMsg(`“${name}” deleted.`);
    reload();
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        background: "rgba(0,0,0,0.55)",
      }}
      onClick={onClose}
    >
      <div
        className="chn-rise"
        style={{
          width: "100%",
          maxWidth: 420,
          maxHeight: "85vh",
          overflowY: "auto",
          padding: 24,
          borderRadius: 16,
          background: "var(--paper-card)",
          border: "1px solid var(--border)",
          boxSizing: "border-box",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h3 className="chn-display" style={{ fontSize: 20, margin: 0 }}>
              Communities
            </h3>
            <button
              type="button"
              onClick={() => {
                if (!profile.premium) {
                  setMsg("Only Premium can create a community (demo toggle on the Board).");
                  return;
                }
                setShowCreate((v) => !v);
                setMsg("");
              }}
              title="Create community"
              style={{
                position: "relative",
                border: "none",
                background: "transparent",
                cursor: "pointer",
                padding: 4,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--ink)",
              }}
            >
              <User size={20} strokeWidth={1.75} />
              <span
                style={{
                  position: "absolute",
                  top: -2,
                  right: -4,
                  width: 14,
                  height: 14,
                  borderRadius: "50%",
                  background: "#1D9BF0",
                  color: "var(--btn-ink)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  lineHeight: 1,
                }}
              >
                <Plus size={10} strokeWidth={3} />
              </span>
            </button>
          </div>
          <button type="button" onClick={onClose} style={{ border: "none", background: "transparent", cursor: "pointer" }}>
            <X size={18} color="#71717A" />
          </button>
        </div>
        <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: "0 0 14px 0", lineHeight: 1.5 }}>
          Only Premium can create a community. Anyone can join with a code. Members get direct access to each other&apos;s stories (including locked) without a story invite and can see each other&apos;s names.
        </p>
        {showCreate ? (
          <div
            style={{
              display: "flex",
              gap: 8,
              marginBottom: 12,
              alignItems: "stretch",
            }}
          >
            <input
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 40))}
              onKeyDown={(e) => e.key === "Enter" && create()}
              placeholder="Community name"
              autoFocus
              style={{
                flex: 1,
                minWidth: 0,
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid var(--border)",
                background: "var(--paper-2)",
                color: "var(--ink)",
                fontSize: 14,
                outline: "none",
                boxSizing: "border-box",
              }}
            />
            <button
              type="button"
              onClick={create}
              disabled={busy || !name.trim()}
              className="chn-btn chn-btn-primary"
              style={{
                padding: "10px 16px",
                borderRadius: 12,
                fontSize: 13,
                flexShrink: 0,
                cursor: !name.trim() || busy ? "not-allowed" : "pointer",
                opacity: !name.trim() || busy ? 0.5 : 1,
              }}
            >
              Save
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "stretch" }}>
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 12))}
              placeholder="Code"
              style={{
                flex: 1,
                minWidth: 0,
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid var(--border)",
                background: "var(--paper-2)",
                color: "var(--ink)",
                fontSize: 14,
                outline: "none",
                boxSizing: "border-box",
              }}
            />
            <button
              type="button"
              onClick={join}
              disabled={busy || !joinCode.trim()}
              className="chn-btn chn-btn-primary"
              style={{
                padding: "10px 16px",
                borderRadius: 12,
                fontSize: 13,
                flexShrink: 0,
                cursor: busy || !joinCode.trim() ? "not-allowed" : "pointer",
                opacity: busy || !joinCode.trim() ? 0.5 : 1,
              }}
            >
              Join
            </button>
          </div>
        )}
        {msg && <p style={{ fontSize: 13, color: "#1D9BF0", margin: "0 0 12px 0" }}>{msg}</p>}
        {(list || []).filter((c) => !c.dissolved).map((c) => {
          const isStarter = c.createdById === profile.id;
          const confirming = confirmDeleteId === c.id;
          return (
            <div
              key={c.id}
              style={{
                borderBottom: "1px solid rgba(15,15,16,0.08)",
                padding: "10px 0",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => {
                    if (confirming) return;
                    loadDetail(c.id);
                  }}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    textAlign: "left",
                    padding: 0,
                    border: "none",
                    background: "transparent",
                    cursor: confirming ? "default" : "pointer",
                  }}
                >
                  <div style={{ fontWeight: 600, color: c.dissolved ? "var(--ink-soft)" : "var(--ink)" }}>
                    {c.name}
                    {c.dissolved ? " · dissolved" : ""}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>
                    by {c.createdBy} · {c.memberCount || 0} members
                    {!c.dissolved && c.inviteCode ? ` · ${c.inviteCode}` : ""}
                  </div>
                </button>
                {isStarter && !c.dissolved && !confirming && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmDeleteId(c.id);
                      setMsg("");
                    }}
                    title="Delete community"
                    aria-label="Delete community"
                    style={{
                      flexShrink: 0,
                      width: 36,
                      height: 36,
                      borderRadius: 999,
                      border: "1px solid rgba(220,38,38,0.35)",
                      background: "transparent",
                      color: "#DC2626",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      padding: 0,
                    }}
                  >
                    <Trash2 size={16} strokeWidth={2} />
                  </button>
                )}
              </div>
              {confirming && (
                <div style={{ marginTop: 10 }}>
                  <p
                    style={{
                      fontSize: 13,
                      color: "var(--danger)",
                      margin: "0 0 12px 0",
                      lineHeight: 1.45,
                      fontWeight: 600,
                    }}
                  >
                    Deleting this community cannot be undone. Members lose community access to each other&apos;s locked stories. Are you sure?
                  </p>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => dissolveCommunity(c.id)}
                      disabled={busy}
                      className="chn-btn chn-btn-danger"
                      style={{
                        flex: 1,
                        padding: "12px 16px",
                        borderRadius: 999,
                        fontSize: 14,
                        fontWeight: 600,
                        cursor: busy ? "not-allowed" : "pointer",
                        opacity: busy ? 0.5 : 1,
                      }}
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(null)}
                      disabled={busy}
                      className="chn-btn"
                      style={{
                        flex: 1,
                        padding: "12px 16px",
                        borderRadius: 999,
                        fontSize: 14,
                        fontWeight: 600,
                        background: "transparent",
                        color: "var(--ink)",
                        border: "1px solid var(--border)",
                        cursor: "pointer",
                      }}
                    >
                      No
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {selected && !selected.dissolved && (
          <div style={{ marginTop: 16, padding: 12, borderRadius: 12, background: "var(--paper-2)" }}>
                        <div style={{ fontWeight: 700, marginBottom: 8 }}>{selected.name} · members</div>
            {(selected.memberIds || []).map((id) => {
              const isOwner = id === selected.createdById;
              const label = memberLabel(id, selected);
              return (
                <div
                  key={id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: 13,
                    marginBottom: 6,
                  }}
                >
                  <span>{label}</span>
                  {selected.createdById === profile.id && !isOwner && (
                    <button
                      type="button"
                      onClick={() => removeMember(id)}
                      style={{
                        fontSize: 11,
                        padding: "4px 8px",
                        borderRadius: 8,
                        border: "1px solid rgba(220,38,38,0.35)",
                        background: "transparent",
                        color: "#DC2626",
                        cursor: "pointer",
                      }}
                    >
                      Remove
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <button
          type="button"
          onClick={onClose}
          className="chn-btn"
          style={{
            width: "100%",
            marginTop: 16,
            padding: "12px 16px",
            borderRadius: 999,
            border: "1px solid var(--border)",
            background: "transparent",
            fontWeight: 600,
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
}

function LikesBoardModal({ profile, onClose }) {
  const [rows, setRows] = useState(null);

  const refresh = useCallback(async () => {
    const registry = (await getJSON("writers-registry", true)) || {};
    const others = Object.values(registry).filter((w) => w.id !== profile.id);
    const merged = [
      { id: profile.id, name: profile.name, likes: profile.likes || 0, premium: !!profile.premium, you: true },
      ...others.map((w) => ({ ...w, you: false })),
    ];
    merged.sort((a, b) => (b.likes || 0) - (a.likes || 0));
    setRows(merged);
  }, [profile.id, profile.name, profile.likes, profile.premium]);

  useEffect(() => { refresh(); }, [refresh]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        background: "rgba(0,0,0,0.55)",
      }}
      onClick={onClose}
    >
      <div
        className="chn-rise"
        style={{
          width: "100%",
          maxWidth: 400,
          padding: 24,
          borderRadius: 16,
          background: "var(--paper-card)",
          border: "1px solid var(--border)",
          boxSizing: "border-box",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <Heart size={18} color="#1D9BF0" fill="#1D9BF0" />
          <h3 className="chn-display" style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>
            Likes board
          </h3>
        </div>
        <p style={{ fontSize: 13, lineHeight: 1.5, color: "var(--ink-soft)", margin: "0 0 16px 0" }}>
          Total likes from stories a writer helped write that others liked. Separate from visibility — likes here don't affect Board ranking.
        </p>

        {rows === null && (
          <p style={{ fontSize: 14, color: "var(--ink-soft)", margin: "0 0 16px 0" }}>Loading…</p>
        )}

        {rows && rows.length === 1 && (
          <p style={{ fontSize: 14, lineHeight: 1.5, color: "var(--ink-soft)", margin: "0 0 16px 0" }}>
          </p>
        )}

        {rows && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
            {rows.map((r, i) => (
              <div
                key={r.id || i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontSize: 14,
                  gap: 12,
                }}
              >
                <span style={{ color: "var(--ink)" }}>
                  {i + 1}. {r.name}
                  {r.premium && (
                    <span
                      style={{
                        marginLeft: 6,
                        fontSize: 10,
                        padding: "2px 6px",
                        borderRadius: 6,
                        background: "#1D9BF0",
                        color: "var(--btn-ink)",
                        fontWeight: 600,
                      }}
                    >
                      CS
                    </span>
                  )}
                  {r.you && (
                    <span style={{ marginLeft: 6, fontSize: 12, color: "#1D9BF0" }}>(you)</span>
                  )}
                </span>
                <span style={{ color: "#1D9BF0", display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                  <Heart size={12} fill="#1D9BF0" /> {r.likes || 0}
                </span>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={onClose}
          type="button"
          className="chn-btn"
          style={{
            width: "100%",
            padding: "12px 16px",
            borderRadius: 999,
            fontSize: 14,
            fontWeight: 600,
            background: "transparent",
            color: "var(--ink)",
            border: "1px solid var(--border)",
            cursor: "pointer",
            boxSizing: "border-box",
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
}

function LeaderboardModal({ profile, onClose, onTogglePremium }) {
  const [rows, setRows] = useState(null);

  const refresh = useCallback(async () => {
    const registry = (await getJSON("writers-registry", true)) || {};
    const others = Object.values(registry).filter((w) => w.id !== profile.id);
    const merged = [
      { id: profile.id, name: profile.name, visibility: profile.visibility || 0, premium: !!profile.premium, you: true },
      ...others.map((w) => ({ ...w, you: false })),
    ];
    merged.sort((a, b) => b.visibility - a.visibility);
    setRows(merged);
  }, [profile.id, profile.name, profile.visibility, profile.premium]);

  useEffect(() => { refresh(); }, [refresh]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        background: "rgba(0,0,0,0.55)",
      }}
      onClick={onClose}
    >
      <div
        className="chn-rise"
        style={{
          width: "100%",
          maxWidth: 400,
          padding: 24,
          borderRadius: 16,
          background: "var(--paper-card)",
          border: "1px solid var(--border)",
          boxSizing: "border-box",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3
          className="chn-display"
          style={{ fontSize: 20, fontWeight: 700, margin: "0 0 8px 0", color: "var(--ink)" }}
        >
          Visibility board
        </h3>
        <p style={{ fontSize: 13, lineHeight: 1.5, color: "var(--ink-soft)", margin: "0 0 16px 0" }}>
          Ranked by real visibility scores from everyone who has used this artifact — earned from lines written. Only lines that still exist on non-deleted chains count.
        </p>

        {rows === null && (
          <p style={{ fontSize: 14, color: "var(--ink-soft)", margin: "0 0 16px 0" }}>Loading…</p>
        )}

        {rows && rows.length === 1 && (
          <p style={{ fontSize: 14, lineHeight: 1.5, color: "var(--ink-soft)", margin: "0 0 16px 0" }}>
          </p>
        )}

        {rows && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
            {rows.map((r, i) => (
              <div
                key={r.id || i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontSize: 14,
                  gap: 12,
                }}
              >
                <span style={{ color: "var(--ink)" }}>
                  {i + 1}. {r.name}
                  {r.premium && (
                    <span
                      style={{
                        marginLeft: 6,
                        fontSize: 10,
                        padding: "2px 6px",
                        borderRadius: 6,
                        background: "#1D9BF0",
                        color: "var(--btn-ink)",
                        fontWeight: 600,
                      }}
                    >
                      CS
                    </span>
                  )}
                  {r.you && (
                    <span style={{ marginLeft: 6, fontSize: 12, color: "#1D9BF0" }}>(you)</span>
                  )}
                </span>
                <span style={{ color: "var(--ink-soft)", flexShrink: 0 }}>{r.visibility}</span>
              </div>
            ))}
          </div>
        )}

        <div style={{ fontSize: 12, color: "var(--ink-soft)", marginBottom: 12 }}>
          Your credits: {profile.credits ?? 50} · Lines: {profile.linesWritten ?? 0}
        </div>

        <button
          onClick={onClose}
          type="button"
          className="chn-btn"
          style={{
            width: "100%",
            padding: "12px 16px",
            borderRadius: 999,
            fontSize: 14,
            fontWeight: 600,
            background: "transparent",
            color: "var(--ink)",
            border: "1px solid var(--border)",
            cursor: "pointer",
            boxSizing: "border-box",
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
}

function EditNameModal({ profile, onClose, onUpdateProfile }) {
  const [name, setName] = useState(profile.name);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [invalidChar, setInvalidChar] = useState(false);
  const [themeId, setThemeId] = useState(profile.themeId || "white");
  const [themeCustom, setThemeCustom] = useState(profile.themeCustom || "#1D9BF0");
  const [hexDraft, setHexDraft] = useState(profile.themeCustom || "#1D9BF0");
  const [premium, setPremium] = useState(!!profile.premium);
  const [hoverTheme, setHoverTheme] = useState(null);

  /** Closing without Save restores the last saved profile theme. */
  const handleClose = () => {
    if (!saved) {
      applyThemeToDocument(resolveTheme(profile, null));
    }
    onClose?.();
  };

  const previewTheme = (() => {
    if (themeId === "custom" && themeCustom) return themeFromCustom(themeCustom);
    const base = FREE_BG_THEMES.find((t) => t.id === themeId) || FREE_BG_THEMES[0];
    return enrichTheme(base);
  })();

  /** Preview only — updates local state + document CSS vars. Does NOT save profile. */
  const previewThemeOnly = (nextThemeId, nextCustom) => {
    if (!premium && nextThemeId === "custom") {
      setError("Premium is required for custom colors.");
      return;
    }
    setThemeId(nextThemeId);
    if (nextCustom != null) {
      setThemeCustom(nextCustom);
      setHexDraft(nextCustom);
    }
    const draftProfile = {
      ...profile,
      premium,
      themeId: nextThemeId,
      themeCustom: nextThemeId === "custom" ? nextCustom || themeCustom : null,
    };
    applyThemeToDocument(resolveTheme(draftProfile, null));
  };

  const submit = async () => {
    const trimmed = name.trim().slice(0, 24);
    if (!trimmed) return;
    setError("");
    setSaving(true);
    if (trimmed !== profile.name && (await isNameTaken(trimmed, profile.id))) {
      setSaving(false);
      setError("That name is already taken. Try another, or add an initial.");
      return;
    }
    let finalThemeId = themeId;
    let finalCustom = themeId === "custom" ? sanitizeCustomHex(themeCustom) : null;
    if (themeId === "custom" && !finalCustom) {
      setSaving(false);
      setError("Use a hex color like #1D9BF0");
      return;
    }
    if (themeId === "custom" && isPureMonoHex(themeCustom)) {
      finalCustom = sanitizeCustomHex(themeCustom);
      setThemeCustom(finalCustom);
      setHexDraft(finalCustom);
      setError("Pure white/black blocked — saved a usable tint instead.");
    }
    const next = {
      ...profile,
      name: trimmed,
      premium,
      themeId: finalThemeId,
      themeCustom: finalCustom,
    };
    // Non-premium may only use the three free themes — free themes stay available when Premium is on
    if (!premium && !FREE_BG_THEMES.some((t) => t.id === themeId)) {
      next.themeId = "white";
      next.themeCustom = null;
    }
    await saveProfile(next, onUpdateProfile);
    setSaving(false);
    setSaved(true);
    setTimeout(onClose, 400);
  };

  /**
   * Apply = preview the currently selected swatch / hex.
   * Does not save. Close without Save restores the previous theme.
   */
  const applyPreview = () => {
    if (themeId === "custom") {
      let h = (hexDraft || themeCustom || "").trim();
      if (!h.startsWith("#")) h = `#${h}`;
      if (!/^#[0-9A-Fa-f]{6}$/.test(h)) {
        setError("Use a hex color like #1D9BF0");
        return;
      }
      if (isPureMonoHex(h)) {
        h = sanitizeCustomHex(h);
        setError("Pure white/black blocked — previewing a usable tint. Save to keep it.");
      } else {
        h = h.toUpperCase();
        setError("");
      }
      previewThemeOnly("custom", h);
      return;
    }
    setError("");
    previewThemeOnly(themeId, null);
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: "rgba(0,0,0,0.55)",
      }}
      onClick={handleClose}
    >
      <div
        className="chn-fold chn-rise"
        style={{
          width: "100%",
          maxWidth: 440,
          padding: 24,
          borderRadius: 16,
          maxHeight: "85vh",
          overflowY: "auto",
          background: "var(--paper-card)",
          color: "var(--ink)",
          border: "1px solid var(--border)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <User size={22} color="#1D9BF0" strokeWidth={1.75} />
          </div>
          <button
            onClick={handleClose}
            style={{ color: "var(--ink-soft)", background: "transparent", border: "none", cursor: "pointer", padding: 4 }}
          >
            <X size={18} />
          </button>
        </div>

        <input
          value={name}
          onChange={(e) => {
            const raw = e.target.value;
            setInvalidChar(/[^a-zA-Z]/.test(raw));
            setName(sanitizeUsername(raw));
            if (error) setError("");
          }}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="e.g. rmwrites"
          maxLength={24}
          style={{
            width: "100%",
            padding: "10px 12px",
            marginTop: 0,
            marginBottom: 8,
            borderRadius: 16,
            outline: "none",
            boxSizing: "border-box",
            background: "var(--paper-2)",
            border: `1px solid ${error || invalidChar ? "#1D9BF0" : "var(--border)"}`,
            fontFamily: "Inter, system-ui, sans-serif",
            fontSize: 15,
            color: "var(--ink)",
          }}
        />
        {invalidChar ? (
          <p style={{ fontSize: 12, marginBottom: 12, display: "flex", alignItems: "center", gap: 4, color: "#1D9BF0" }}>
            <AlertCircle size={13} /> Only lowercase letters (a–z).
          </p>
        ) : error ? (
          <p style={{ fontSize: 12, marginBottom: 12, display: "flex", alignItems: "center", gap: 4, color: "#1D9BF0" }}>
            <AlertCircle size={13} /> {error}
          </p>
        ) : (
          <div style={{ marginBottom: 12 }} />
        )}

        <div
          style={{
            marginBottom: 16,
            padding: 14,
            borderRadius: 12,
            background: "var(--paper-2)",
            border: "1px solid var(--border)",
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Premium</div>
          <button
            type="button"
            onClick={async () => {
              const nextPrem = !premium;
              setPremium(nextPrem);
              const next = {
                ...profile,
                premium: nextPrem,
                themeId,
                themeCustom: themeId === "custom" && nextPrem ? themeCustom : themeId === "custom" ? null : profile.themeCustom,
              };
              if (!nextPrem && themeId === "custom") {
                setThemeId("white");
                next.themeId = "white";
                next.themeCustom = null;
              }
              await saveProfile(next, onUpdateProfile);
            }}
            className="chn-btn"
            style={{
              width: "100%",
              padding: "10px 14px",
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 600,
              border: "none",
              background: premium ? "#71717A" : "#1D9BF0",
              color: "var(--btn-ink)",
              cursor: "pointer",
            }}
          >
            {premium ? "Premium on (tap to turn off)" : "Unlock Premium $4.99/mo (demo)"}
          </button>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 10, alignItems: "center" }}>
            {FREE_BG_THEMES.map((t) => {
              const selected = themeId === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    // Select only — preview happens when user taps Apply
                    setThemeId(t.id);
                    setError("");
                  }}
                  onMouseEnter={() => setHoverTheme(t.label)}
                  onMouseLeave={() => setHoverTheme(null)}
                  onTouchStart={() => setHoverTheme(t.label)}
                  onTouchEnd={() => setTimeout(() => setHoverTheme(null), 900)}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    border: selected ? "2px solid #1D9BF0" : "1px solid var(--border)",
                    background: t.paper,
                    cursor: "pointer",
                    boxShadow: t.id === "white" ? "inset 0 0 0 1px rgba(15,15,16,0.08)" : "none",
                  }}
                  title={t.label}
                  aria-label={t.label}
                />
              );
            })}
            {premium && (
              <label
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  border: themeId === "custom" ? "2px solid #1D9BF0" : "1px solid var(--border)",
                  background: "var(--paper-card)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                  position: "relative",
                  boxShadow: "inset 0 0 0 1px rgba(15,15,16,0.08)",
                }}
                title="Custom"
                onMouseEnter={() => setHoverTheme("Custom")}
                onMouseLeave={() => setHoverTheme(null)}
              >
                <Plus size={18} color="var(--ink)" strokeWidth={2.25} />
                <input
                  type="color"
                  value={/^#[0-9A-Fa-f]{6}$/.test(themeCustom || "") ? themeCustom : "#1D9BF0"}
                  onChange={(e) => {
                    // Select only — does not change the app until Apply
                    const v = (e.target.value || "").toUpperCase();
                    setThemeId("custom");
                    setThemeCustom(v);
                    setHexDraft(v);
                    setError("");
                  }}
                  style={{
                    opacity: 0,
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    cursor: "pointer",
                  }}
                />
              </label>
            )}
          </div>
          {hoverTheme && (
            <p style={{ fontSize: 12, color: "var(--ink-soft)", margin: "0 0 8px 0" }}>{hoverTheme}</p>
          )}
          {premium && (
            <div style={{ marginTop: 8, marginBottom: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: "var(--ink-soft)" }}>Custom hex</div>
              <input
                value={hexDraft}
                onChange={(e) => {
                  setHexDraft(e.target.value);
                  setThemeId("custom");
                }}
                onKeyDown={(e) => e.key === "Enter" && applyPreview()}
                placeholder="#1D9BF0"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                  background: "var(--paper-2)",
                  color: "var(--ink)",
                  fontSize: 14,
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>
          )}
          <button
            type="button"
            onClick={applyPreview}
            className="chn-btn chn-btn-primary"
            style={{
              width: "100%",
              marginTop: 8,
              marginBottom: 12,
              padding: "10px 14px",
              borderRadius: 12,
              fontWeight: 600,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Apply
          </button>
        </div>

        <button
          onClick={submit}
          disabled={!name.trim() || saving}
          className="chn-btn chn-btn-primary"
          style={{
            width: "100%",
            padding: "10px 12px",
            borderRadius: 16,
            fontSize: 14,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            border: "none",
            cursor: !name.trim() || saving ? "not-allowed" : "pointer",
            opacity: !name.trim() || saving ? 0.4 : 1,
            background: saved ? "#2E5A3C" : undefined,
            color: saved ? "var(--btn-ink)" : undefined,
          }}
        >
          {saved ? "Saved" : saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}


function MusicMenuModal({ profile, chain, onClose, onUpdateProfile, musicOn, toggleMusic, musicVolume = 0.7, onVolumeChange }) {
  const [source, setSource] = useState(profile.musicSource === "external" ? "external" : "ambient");
  const [url, setUrl] = useState(profile.musicPlaylistUrl || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [vol, setVol] = useState(typeof musicVolume === "number" ? musicVolume : 0.7);

  const looksLikeUrl = (v) => /^https?:\/\/.+\..+/i.test(v.trim());

  const save = async () => {
    setError("");
    if (source === "external") {
      const trimmed = url.trim();
      if (trimmed && !looksLikeUrl(trimmed)) {
        setError("That doesn't look like a link — paste the full playlist URL.");
        return;
      }
    }
    setSaving(true);
    const next = {
      ...profile,
      musicSource: source,
      musicPlaylistUrl: source === "external" ? url.trim() : profile.musicPlaylistUrl || "",
    };
    await saveProfile(next, onUpdateProfile);
    setSaving(false);
    onClose();
  };

  const openPlaylist = () => {
    const trimmed = (profile.musicPlaylistUrl || "").trim();
    if (trimmed && looksLikeUrl(trimmed)) {
      window.open(trimmed, "_blank", "noopener,noreferrer");
    }
  };

  const g = chain ? genreMeta(chain.genre) : null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: "rgba(0,0,0,0.55)",
      }}
      onClick={onClose}
    >
      <div
        className="chn-rise"
        style={{
          width: "100%",
          maxWidth: 440,
          padding: 24,
          borderRadius: 16,
          background: "var(--paper-card)",
          color: "var(--ink)",
          border: "1px solid var(--border)",
          boxSizing: "border-box",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header: title + close on one row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 6,
          }}
        >
          <h3
            className="chn-display"
            style={{
              margin: 0,
              fontSize: 20,
              fontWeight: 700,
              color: "var(--ink)",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Music size={18} color="#1D9BF0" /> Background music
          </h3>
          <button
            type="button"
            onClick={onClose}
            style={{
              color: "var(--ink-soft)",
              background: "transparent",
              border: "none",
              padding: 4,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
            }}
          >
            <X size={18} />
          </button>
        </div>

        <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: "0 0 16px 0", lineHeight: 1.45 }}>
          Choose what plays while you write{g ? ` on this ${g.label.toLowerCase()} chain` : ""}.
        </p>

        {/* Source options */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
          <button
            type="button"
            onClick={() => setSource("ambient")}
            style={{
              width: "100%",
              textAlign: "left",
              padding: 14,
              borderRadius: 12,
              display: "flex",
              alignItems: "flex-start",
              gap: 12,
              cursor: "pointer",
              border: `1px solid ${source === "ambient" ? "#1D9BF0" : "rgba(15,15,16,0.14)"}`,
              background: source === "ambient" ? "rgba(29,155,240,0.08)" : "var(--paper-card)",
              boxSizing: "border-box",
            }}
          >
            <span
              style={{
                marginTop: 2,
                width: 16,
                height: 16,
                borderRadius: "50%",
                flexShrink: 0,
                border: `2px solid ${source === "ambient" ? "#1D9BF0" : "#A1A1AA"}`,
                background: source === "ambient" ? "#1D9BF0" : "transparent",
                boxSizing: "border-box",
              }}
            />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 14, fontWeight: 600, color: "var(--ink)", marginBottom: 2 }}>
                Ambient (generated)
              </span>
              <span style={{ display: "block", fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.45 }}>
                Original instrumental tones synthesized live per genre, right in the browser. No account needed.
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSource("external")}
            style={{
              width: "100%",
              textAlign: "left",
              padding: 14,
              borderRadius: 12,
              display: "flex",
              alignItems: "flex-start",
              gap: 12,
              cursor: "pointer",
              border: `1px solid ${source === "external" ? "#1D9BF0" : "rgba(15,15,16,0.14)"}`,
              background: source === "external" ? "rgba(29,155,240,0.08)" : "var(--paper-card)",
              boxSizing: "border-box",
            }}
          >
            <span
              style={{
                marginTop: 2,
                width: 16,
                height: 16,
                borderRadius: "50%",
                flexShrink: 0,
                border: `2px solid ${source === "external" ? "#1D9BF0" : "#A1A1AA"}`,
                background: source === "external" ? "#1D9BF0" : "transparent",
                boxSizing: "border-box",
              }}
            />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 14, fontWeight: 600, color: "var(--ink)", marginBottom: 2 }}>
                My playlist (real songs)
              </span>
              <span style={{ display: "block", fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.45 }}>
                Link your own Spotify, YouTube Music, or Apple Music playlist. It opens in a new tab and plays through your own account — this app can&apos;t stream licensed songs itself.
              </span>
            </span>
          </button>
        </div>

        {source === "ambient" && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 16,
              padding: "8px 4px",
            }}
          >
            <button
              type="button"
              onClick={toggleMusic}
              className="chn-btn"
              title={musicOn ? "Mute" : "Unmute"}
              style={{
                width: 40,
                height: 40,
                borderRadius: 999,
                padding: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "1px solid var(--border)",
                background: "var(--paper-2)",
                color: "var(--ink)",
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              {musicOn ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={vol}
              onChange={(e) => {
                const v = Number(e.target.value);
                setVol(v);
                onVolumeChange?.(v);
              }}
              style={{ flex: 1, margin: 0 }}
              aria-label="Music volume"
            />
          </div>
        )}

        {source === "external" && (
          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                display: "block",
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "#1D9BF0",
                marginBottom: 6,
              }}
            >
              Playlist link
            </label>
            <input
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                if (error) setError("");
              }}
              placeholder="https://open.spotify.com/playlist/…"
              style={{
                width: "100%",
                padding: "10px 12px",
                marginBottom: 6,
                borderRadius: 16,
                outline: "none",
                fontSize: 14,
                background: "var(--paper-2)",
                border: `1px solid ${error ? "#1D9BF0" : "rgba(15,15,16,0.14)"}`,
                color: "var(--ink)",
                boxSizing: "border-box",
              }}
            />
            {error ? (
              <p style={{ fontSize: 12, margin: "0 0 8px 0", display: "flex", alignItems: "center", gap: 4, color: "#1D9BF0" }}>
                <AlertCircle size={13} /> {error}
              </p>
            ) : (
              <p style={{ fontSize: 12, margin: "0 0 8px 0", color: "var(--ink-soft)", lineHeight: 1.4 }}>
                Paste a link to a playlist you already have — the app just opens it for you.
              </p>
            )}
            {profile.musicPlaylistUrl && looksLikeUrl(profile.musicPlaylistUrl) && (
              <button
                type="button"
                onClick={openPlaylist}
                className="chn-btn"
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: 999,
                  fontSize: 14,
                  marginTop: 4,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  background: "var(--btn)",
                  color: "var(--btn-ink)",
                  border: "none",
                  cursor: "pointer",
                  boxSizing: "border-box",
                }}
              >
                <ExternalLink size={14} /> Open my playlist
              </button>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="chn-btn"
          style={{
            width: "100%",
            padding: "12px 16px",
            borderRadius: 999,
            fontSize: 14,
            fontWeight: 600,
            background: "#1D9BF0",
            color: "var(--btn-ink)",
            border: "none",
            cursor: saving ? "wait" : "pointer",
            opacity: saving ? 0.7 : 1,
            boxSizing: "border-box",
          }}
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

// ---------- story room ----------

function ChainRoom({ profile, chainId, onBack, onUpdateProfile, onOpenHelp }) {
  const [chain, setChain] = useState(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [unfolded, setUnfolded] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [aiScore, setAiScore] = useState(null);
  const [watching, setWatching] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showMusicMenu, setShowMusicMenu] = useState(false);
  const bottomRef = useRef(null);

  const musicOn = profile.musicOn !== false;
  const musicSource = profile.musicSource === "external" ? "external" : "ambient";
  const musicVolume = typeof profile.musicVolume === "number" ? profile.musicVolume : 0.7;
  useAmbientMusic(chain?.genre, musicOn && musicSource === "ambient", musicVolume);

  useEffect(() => {
    applyThemeToDocument(resolveTheme(profile, chain));
  }, [profile, chain]);
  const toggleMusic = async () => {
    const next = { ...profile, musicOn: !musicOn };
    await saveProfile(next, onUpdateProfile);
  };
  const setMusicVolume = async (vol) => {
    const v = Math.max(0, Math.min(1, Number(vol)));
    const next = { ...profile, musicVolume: v };
    await saveProfile(next, onUpdateProfile);
  };

  const refresh = useCallback(async () => {
    let c = await getJSON(`chain:${chainId}`, true);
    if (!c) return;
    const cleaned = cleanExpiredVotes(c);
    if (cleaned !== c) {
      await setJSON(`chain:${chainId}`, cleaned, true);
      c = cleaned;
    }
    if (c.locked && !(await canOpenChain(c, profile))) {
      setAccessDenied(true);
      setChain(null);
      return;
    }
    setAccessDenied(false);
    setChain(c);
  }, [chainId, profile]);

  useEffect(() => {
    setLoadFailed(false);
    refresh();
    const t = setInterval(refresh, 3500);
    // If nothing has loaded within 8s, stop the endless spinner and offer a way out.
    const timeout = setTimeout(() => {
      setChain((current) => {
        if (!current) setLoadFailed(true);
        return current;
      });
    }, 8000);
    return () => {
      clearInterval(t);
      clearTimeout(timeout);
    };
  }, [refresh]);

  useEffect(() => {
    if (unfolded) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chain?.lines?.length, unfolded]);

  const updateIndexSummary = async (updated) => {
    const idx = (await getJSON("chains-index", true)) || [];
    const next = idx.map((c) =>
      c.id === updated.id
        ? {
            ...c,
            title: updated.title != null ? updated.title : c.title,
            lineCount: (updated.lines || []).length,
            lastLine: updated.lines?.[updated.lines.length - 1]?.text || c.lastLine || "",
            lastAuthor: updated.lines?.[updated.lines.length - 1]?.authorName || c.lastAuthor || "",
            finished: updated.finished,
            archived: !!updated.archived,
            archivedAt: updated.archivedAt || null,
            locked: !!updated.locked,
            stillOnTimeline:
              !!updated.archived &&
              updated.archiveSource !== "vote" &&
              hoursSince(updated.archivedAt || 0) <= ARCHIVE_VISIBLE_HOURS,
            updatedAt: Date.now(),
            format: updated.target?.format || c.format,
          }
        : c
    );
    await setJSON("chains-index", next, true);
  };

  const removeFromIndex = async (id) => {
    const idx = (await getJSON("chains-index", true)) || [];
    await setJSON(
      "chains-index",
      idx.filter((c) => c.id !== id),
      true
    );
  };

  // Permanently delete + reverse visibility points that came from this chain's lines
  const permanentlyDeleteChain = async (id, latest) => {
    // Reverse visibility / linesWritten contributed by this chain
    if (latest?.lines?.length) {
      const contrib = {};
      for (const l of latest.lines) {
        if (l.authorId) {
          contrib[l.authorId] = (contrib[l.authorId] || 0) + 1;
        }
      }

      const registry = (await getJSON("writers-registry", true)) || {};
      let registryChanged = false;
      for (const [authorId, count] of Object.entries(contrib)) {
        if (registry[authorId]) {
          registry[authorId].linesWritten = Math.max(0, (registry[authorId].linesWritten || 0) - count);
          registry[authorId].visibility = Math.max(0, (registry[authorId].visibility || 0) - count);
          registry[authorId].updatedAt = Date.now();
          registryChanged = true;
        }
      }
      if (registryChanged) {
        await setJSON("writers-registry", registry, true);
      }

      // Update the current user's local profile if they contributed
      if (contrib[profile.id]) {
        const count = contrib[profile.id];
        const nextProfile = {
          ...profile,
          linesWritten: Math.max(0, (profile.linesWritten || 0) - count),
          visibility: Math.max(0, (profile.visibility || 0) - count),
        };
        await saveProfile(nextProfile, onUpdateProfile);
      }
    }

    // Remove from the shared index (timeline / board)
    await removeFromIndex(id);

    // Try real storage delete
    let deleted = false;
    try {
      if (storage?.delete) {
        await storage.delete(`chain:${id}`, true);
        deleted = true;
      }
    } catch (_) {}

    // Fallback: mark as deleted so maintenance never resurrects it
    if (!deleted) {
      await setJSON(
        `chain:${id}`,
        { ...(latest || {}), deleted: true, updatedAt: Date.now() },
        true
      );
    }
  };

  const lastAuthorId = chain?.lines?.[chain.lines.length - 1]?.authorId;
  const yourTurn = chain?.solo ? true : lastAuthorId !== profile.id;
  // Manual archive (vote) locks writing immediately; auto-archive locks after 48h on timeline
  const isArchivedLocked =
    !!chain?.archived &&
    (chain.archiveSource === "vote" || hoursSince(chain.archivedAt || 0) > ARCHIVE_VISIBLE_HOURS);
  const canFinish = chain ? runtimeReached(chain) : false;
  const participants = chain
    ? uniqueParticipants(chain).filter((p) => !isKicked(chain, p.id))
    : [];
  const isMultiWriter = participants.length > 1;
  const admins = chain ? ensureAdmins(chain) : [];
  const youAreAdmin = chain ? isAdmin(chain, profile.id) : false;
  const youAreKicked = chain ? isKicked(chain, profile.id) : false;
  const petition = chain?.deletePetition && !isVoteExpired(chain.deletePetition) ? chain.deletePetition : null;
  const archiveVote = chain?.archiveVote && !isVoteExpired(chain.archiveVote) ? chain.archiveVote : null;
  const unarchiveVote = chain?.unarchiveVote && !isVoteExpired(chain.unarchiveVote) ? chain.unarchiveVote : null;
  const titleVote = chain?.titleVote && !isVoteExpired(chain.titleVote) ? chain.titleVote : null;
  const kickVote = chain?.kickVote && !isVoteExpired(chain.kickVote) ? chain.kickVote : null;
  const confidenceVote =
    chain?.confidenceVote && !isVoteExpired(chain.confidenceVote) ? chain.confidenceVote : null;
  const youVotedDelete = youVoted(petition, profile.id);
  const youVotedArchive = youVoted(archiveVote, profile.id);
  const youVotedUnarchive = youVoted(unarchiveVote, profile.id);
  const youVotedTitle = youVoted(titleVote, profile.id);
  const youVotedKick = youVoted(kickVote, profile.id);
  const youVotedConfidence = youVoted(confidenceVote, profile.id);
  const attentionHere = needsAttentionOnChain(chain, profile.id);
  const portalOpen = chain ? adminPortalShouldBeOpen(chain) : false;

  const submitLine = async () => {
    setError("");
    setAiScore(null);
    if (youAreKicked) {
      setError("You've been removed from this story and can't add lines.");
      return;
    }
    const text = draft.trim();
    if (!text) return;
    if (text.length > LINE_LIMIT) {
      setError(`Keep it to ${LINE_LIMIT} characters — one line, not a paragraph.`);
      return;
    }
    if (containsBanned(text)) {
      setError("That word isn't welcome on this page.");
      return;
    }
    if (!chain.solo && lastAuthorId === profile.id) {
      setError("You wrote the last line — pass the pen to someone else.");
      return;
    }
    if (isArchivedLocked) {
      setError("This chain is fully archived and no longer accepts new lines.");
      return;
    }
    setBusy(true);

    const analysis = await analyzeLineWithClaude(text, chain.genre, chain.twist, chain.theme);
    setAiScore(analysis);
    await new Promise((r) => setTimeout(r, 400));

    const latest = (await getJSON(`chain:${chainId}`, true)) || chain;
    if (!chain.solo && latest.lines[latest.lines.length - 1]?.authorId === profile.id) {
      setError("Someone needs to go before you again — you're still last.");
      setBusy(false);
      return;
    }
    const newLine = {
      id: uid(),
      authorId: profile.id,
      authorName: profile.name,
      text,
      ts: Date.now(),
      aiScore: analysis.score,
      aiSource: analysis.source,
    };
    const updated = {
      ...latest,
      lines: [...latest.lines, newLine],
      twist: TWIST_WORDS[Math.floor(Math.random() * TWIST_WORDS.length)],
      updatedAt: Date.now(),
    };
    await setJSON(`chain:${chainId}`, updated, true);
    await updateIndexSummary(updated);
    setChain(updated);
    setDraft("");
    setBusy(false);

    const p = {
      ...profile,
      linesWritten: (profile.linesWritten || 0) + 1,
      visibility: (profile.visibility || 0) + 1,
    };
    await saveProfile(p, onUpdateProfile);
  };

  const markFinished = async () => {
    if (!runtimeReached(chain)) {
      setError(
        `Target runtime not reached yet (~${estimateRuntimeMinutes(chain.lines?.length || 0)} min of ~${targetMinutes(chain)} min — ${runtimeProgressPercent(chain)}%). Keep writing.`
      );
      return;
    }
    const latest = (await getJSON(`chain:${chainId}`, true)) || chain;
    // Ending the story expires the invite link automatically
    const updated = {
      ...latest,
      finished: true,
      inviteExpired: true,
      inviteCode: null,
      updatedAt: Date.now(),
    };
    await setJSON(`chain:${chainId}`, updated, true);
    await updateIndexSummary(updated);
    setChain(updated);
  };

  const applyArchive = async (latest) => {
    const updated = {
      ...latest,
      archived: true,
      archivedAt: Date.now(),
      archiveSource: "vote",
      archiveVote: null,
      unarchiveVote: null,
      updatedAt: Date.now(),
    };
    await setJSON(`chain:${chainId}`, updated, true);
    await updateIndexSummary(updated);
    setChain(updated);
  };

  const applyUnarchive = async (latest) => {
    const updated = {
      ...latest,
      archived: false,
      archivedAt: null,
      archiveSource: null,
      unarchiveVote: null,
      archiveVote: null,
      updatedAt: Date.now(),
    };
    await setJSON(`chain:${chainId}`, updated, true);
    await updateIndexSummary(updated);
    setChain(updated);
  };

  /** Generic majority vote cast. type: "delete" | "archive" | "unarchive". choice: "yes" | "no". */
  const castVote = async (type, choice) => {
    // Only suspension check here — successful votes are not spam
    if (getSuspensionRemainingMs() > 0) return "suspended";

    const latest = cleanExpiredVotes((await getJSON(`chain:${chainId}`, true)) || chain);
    const parts = uniqueParticipants(latest);
    const field = type === "delete" ? "deletePetition" : type === "archive" ? "archiveVote" : "unarchiveVote";

    // Solo: act immediately
    if (parts.length <= 1) {
      if (type === "delete") {
        await permanentlyDeleteChain(chainId, latest);
        onBack();
        return;
      }
      if (type === "archive") {
        await applyArchive(latest);
        return;
      }
      if (type === "unarchive") {
        await applyUnarchive(latest);
        return;
      }
    }

    let vote = latest[field];
    if (vote && isVoteExpired(vote)) vote = null;

    // Starting a new vote (no open vote) — cannot be cancelled by anyone once started
    if (!vote) {
      if (choice !== "yes") return; // only "yes" starts a vote
      const gate = checkVoteStartGate();
      if (gate === "suspended") return "suspended";
      if (gate === "throttle" || gate === "cooldown") return "throttle";
      markVoteStartAttempt();

      const initiations = { ...(latest.voteInitiations || {}) };
      const used = initiations[profile.id] || 0;
      const adminStarter = isAdmin(latest, profile.id);
      if (!adminStarter && used >= VOTE_INIT_LIMIT_PER_STORY) {
        // Silent counter — UI shows only a brief "5/5" flash (handled by caller)
        return "limit";
      }
      initiations[profile.id] = used + 1;
      vote = {
        startedBy: profile.id,
        startedByName: profile.name,
        startedAt: Date.now(),
        // votes are anonymous in the UI (no names shown on ballots)
        votes: [{ authorId: profile.id, choice: "yes", ts: Date.now() }],
      };
      latest.voteInitiations = initiations;
      markVoteStartSuccess();
    } else {
      if (youVoted(vote, profile.id)) return; // already voted — no cancel/change
      vote = {
        ...vote,
        votes: [...(vote.votes || []), { authorId: profile.id, choice, ts: Date.now() }],
      };
    }

    // Resolve if majority yes
    if (majorityReached(vote, parts.length)) {
      if (type === "delete") {
        await permanentlyDeleteChain(chainId, { ...latest, [field]: null });
        onBack();
        return;
      }
      if (type === "archive") {
        await applyArchive({ ...latest, [field]: null });
        return;
      }
      if (type === "unarchive") {
        await applyUnarchive({ ...latest, [field]: null });
        return;
      }
    }

    // Resolve if majority no (enough nos that yes can no longer win)
    const noCount = voteNoCount(vote);
    const yesCount = voteYesCount(vote);
    const need = Math.ceil(parts.length / 2);
    if (noCount >= need || (yesCount + (parts.length - vote.votes.length) < need && noCount > yesCount)) {
      // Vote fails — clear it
      const updated = { ...latest, [field]: null, updatedAt: Date.now() };
      await setJSON(`chain:${chainId}`, updated, true);
      setChain(updated);
      return;
    }

    const updated = { ...latest, [field]: vote, updatedAt: Date.now() };
    await setJSON(`chain:${chainId}`, updated, true);
    setChain(updated);
  };

  const startDeleteVote = () => castVote("delete", "yes");
  const voteDelete = (choice) => castVote("delete", choice);
  const startArchiveVote = () => castVote("archive", "yes");
  const voteArchive = (choice) => castVote("archive", choice);
  const startUnarchiveVote = () => castVote("unarchive", "yes");
  const voteUnarchive = (choice) => castVote("unarchive", choice);
  // castVote returns "limit" when non-admin has used all silent initiations

  /** Only the story starter (Premium) may lock or unlock. */
  const toggleLock = async () => {
    if (!profile.premium) return;
    if (!isStoryStarter(chain, profile.id)) return;
    const latest = (await getJSON(`chain:${chainId}`, true)) || chain;
    const locking = !latest.locked;
    const updated = {
      ...latest,
      locked: locking,
      inviteCode: locking ? latest.inviteCode || makeInviteCode() : latest.inviteCode,
      updatedAt: Date.now(),
    };
    await setJSON(`chain:${chainId}`, updated, true);
    await updateIndexSummary(updated);
    setChain(updated);
  };

  /** Locked-story background — admins only. Pure white/black custom picks are blocked. */
  const setStoryBg = async (themeId, customHex) => {
    if (!isAdmin(chain, profile.id)) return;
    if (!chain.locked) return;
    const latest = (await getJSON(`chain:${chainId}`, true)) || chain;
    const safeCustom = customHex ? sanitizeCustomHex(customHex) : null;
    const updated = {
      ...latest,
      bgThemeId: safeCustom ? null : themeId,
      bgCustom: safeCustom || null,
      updatedAt: Date.now(),
    };
    await setJSON(`chain:${chainId}`, updated, true);
    setChain(updated);
  };

  /** Apply a title change (rate-limited; blocked after finished). Anyone may propose. */
  const applyTitleChange = async (newTitle, { fromAI = false } = {}) => {
    const t = (newTitle || "").trim().slice(0, 60);
    if (!t) return { ok: false, message: "Title can't be empty." };
    const latest = (await getJSON(`chain:${chainId}`, true)) || chain;
    if (latest.titleLocked) {
      return { ok: false, message: "Title is permanent after conversion (Watch / reel / MP4)." };
    }
    // Typing in the field does not count. Only Save of a *different* title uses 1 of 3.
    if ((latest.title || "").trim() === t) {
      return { ok: true, fromAI, unchanged: true };
    }
    if (!canEditTitle(latest)) {
      return {
        ok: false,
        message: `Title can only change ${TITLE_CHANGES_PER_DAY} times per 24 hours. Try again later.`,
      };
    }
    const updated = {
      ...latest,
      title: t,
      titleChangeLog: [...(latest.titleChangeLog || []), Date.now()],
      titleVote: null,
      updatedAt: Date.now(),
    };
    await setJSON(`chain:${chainId}`, updated, true);
    await updateIndexSummary(updated);
    setChain(updated);
    return { ok: true, fromAI };
  };

  /** Start or cast a revoke-title vote (writers). On majority yes → restore previousTitle. */
  const castTitleVote = async (choice, proposedPrevious = null) => {
    const latest = (await getJSON(`chain:${chainId}`, true)) || chain;
    if (latest.finished) return;
    let vote = latest.titleVote && !isVoteExpired(latest.titleVote) ? { ...latest.titleVote } : null;
    if (!vote) {
      if (choice !== "yes") return;
      vote = {
        type: "title",
        previousTitle: proposedPrevious || latest.title,
        startedBy: profile.id,
        startedAt: Date.now(),
        votes: [{ authorId: profile.id, choice: "yes", ts: Date.now() }],
      };
    } else {
      if (youVoted(vote, profile.id)) return;
      vote = {
        ...vote,
        votes: [...(vote.votes || []), { authorId: profile.id, choice, ts: Date.now() }],
      };
    }
    const parts = uniqueParticipants(latest).filter((p) => !isKicked(latest, p.id));
    if (majorityReached(vote, parts.length)) {
      const updated = {
        ...latest,
        title: vote.previousTitle || latest.title,
        titleVote: null,
        updatedAt: Date.now(),
      };
      await setJSON(`chain:${chainId}`, updated, true);
      await updateIndexSummary(updated);
      setChain(updated);
      return;
    }
    const need = Math.ceil(parts.length / 2);
    if (voteNoCount(vote) >= need) {
      const updated = { ...latest, titleVote: null, updatedAt: Date.now() };
      await setJSON(`chain:${chainId}`, updated, true);
      setChain(updated);
      return;
    }
    const updated = { ...latest, titleVote: vote, updatedAt: Date.now() };
    await setJSON(`chain:${chainId}`, updated, true);
    setChain(updated);
  };

  /** Nominate / ballot for admin election. */
  const castAdminBallot = async (nomineeId, nomineeName) => {
    if (!chain || isKicked(chain, profile.id)) return;
    if (!adminPortalShouldBeOpen(chain)) return;
    if (ensureAdmins(chain).length >= MAX_ADMINS) return;
    const latest = (await getJSON(`chain:${chainId}`, true)) || chain;
    const parts = uniqueParticipants(latest).filter((p) => !isKicked(latest, p.id));
    let election = latest.adminElection?.open
      ? { ...latest.adminElection, ballots: [...(latest.adminElection.ballots || [])] }
      : {
          open: true,
          openedAt: Date.now(),
          ballots: [],
          nominations: [],
        };
    if ((election.ballots || []).some((b) => b.authorId === profile.id)) return;
    election.ballots = [
      ...(election.ballots || []),
      { authorId: profile.id, nomineeId, nomineeName, ts: Date.now() },
    ];
    const threshold = Math.ceil(Math.max(1, parts.length) / 2);
    let admins = ensureAdmins(latest);
    // Close portal at 50% participation; tally top nominees into open admin seats
    if (election.ballots.length >= threshold) {
      const counts = {};
      for (const b of election.ballots) {
        if (!b.nomineeId) continue;
        if (admins.some((a) => a.id === b.nomineeId)) continue;
        counts[b.nomineeId] = counts[b.nomineeId] || { id: b.nomineeId, name: b.nomineeName, n: 0 };
        counts[b.nomineeId].n += 1;
      }
      const ranked = Object.values(counts).sort((a, b) => b.n - a.n);
      const seats = MAX_ADMINS - admins.length;
      for (const r of ranked.slice(0, Math.max(0, seats))) {
        admins = [...admins, { id: r.id, name: r.name || "Writer", since: Date.now() }];
      }
      election = {
        open: false,
        closedAt: Date.now(),
        closedAtParticipantCount: parts.length,
        ballots: election.ballots,
        lastResults: ranked.slice(0, seats),
      };
    }
    const updated = { ...latest, admins, adminElection: election, updatedAt: Date.now() };
    await setJSON(`chain:${chainId}`, updated, true);
    setChain(updated);
  };

  /**
   * Kick vote — admin-only initiation and voting. Not automatic.
   * Starter cannot be kicked from the story (use confidence to strip admin role only).
   */
  const castKickVote = async (choice, targetId = null, targetName = null) => {
    if (!isAdmin(chain, profile.id)) return;
    const latest = (await getJSON(`chain:${chainId}`, true)) || chain;
    if (targetId && isStoryStarter(latest, targetId)) {
      setError("The starter can't be kicked from the story. Use a confidence vote to strip admin only.");
      return;
    }
    let vote = latest.kickVote && !isVoteExpired(latest.kickVote) ? { ...latest.kickVote } : null;
    if (!vote) {
      if (choice !== "yes" || !targetId) return;
      if (isAdmin(latest, targetId) && isStoryStarter(latest, targetId)) return;
      vote = {
        type: "kick",
        targetId,
        targetName: targetName || "Writer",
        startedBy: profile.id,
        startedAt: Date.now(),
        votes: [{ authorId: profile.id, choice: "yes", ts: Date.now() }],
      };
    } else {
      if (youVoted(vote, profile.id)) return;
      vote = {
        ...vote,
        votes: [...(vote.votes || []), { authorId: profile.id, choice, ts: Date.now() }],
      };
    }
    const adminCount = Math.max(1, ensureAdmins(latest).length);
    const need = Math.ceil(adminCount / 2);
    if (voteYesCount(vote) >= need) {
      const kickedIds = [...new Set([...(latest.kickedIds || []), vote.targetId])];
      // If target was admin (non-starter), also remove admin seat
      let adminsNext = ensureAdmins(latest).filter((a) => a.id !== vote.targetId);
      const updated = {
        ...latest,
        kickedIds,
        admins: adminsNext,
        kickVote: null,
        updatedAt: Date.now(),
      };
      await setJSON(`chain:${chainId}`, updated, true);
      setChain(updated);
      return;
    }
    if (voteNoCount(vote) >= need) {
      const updated = { ...latest, kickVote: null, updatedAt: Date.now() };
      await setJSON(`chain:${chainId}`, updated, true);
      setChain(updated);
      return;
    }
    const updated = { ...latest, kickVote: vote, updatedAt: Date.now() };
    await setJSON(`chain:${chainId}`, updated, true);
    setChain(updated);
  };

  /**
   * Confidence vote — admin-only. Strips starter of admin role only (stays in story).
   * For inactive / rude / unusual behaviour toward other writers.
   */
  const castConfidenceVote = async (choice) => {
    if (!isAdmin(chain, profile.id)) return;
    const latest = (await getJSON(`chain:${chainId}`, true)) || chain;
    const starterId = latest.createdById;
    if (!starterId) return;
    let vote =
      latest.confidenceVote && !isVoteExpired(latest.confidenceVote)
        ? { ...latest.confidenceVote }
        : null;
    if (!vote) {
      if (choice !== "yes") return;
      vote = {
        type: "confidence",
        targetId: starterId,
        targetName: latest.createdBy || "Starter",
        startedBy: profile.id,
        startedAt: Date.now(),
        votes: [{ authorId: profile.id, choice: "yes", ts: Date.now() }],
      };
    } else {
      if (youVoted(vote, profile.id)) return;
      vote = {
        ...vote,
        votes: [...(vote.votes || []), { authorId: profile.id, choice, ts: Date.now() }],
      };
    }
    // Only other admins count (exclude target if they are admin)
    const votersPool = ensureAdmins(latest).filter((a) => a.id !== starterId);
    const pool = Math.max(1, votersPool.length);
    const need = Math.ceil(pool / 2);
    const yes = (vote.votes || []).filter(
      (v) => v.choice === "yes" && v.authorId !== starterId
    ).length;
    const no = (vote.votes || []).filter(
      (v) => v.choice === "no" && v.authorId !== starterId
    ).length;
    if (yes >= need) {
      let adminsNext = ensureAdmins(latest).filter((a) => a.id !== starterId);
      // Ensure at least one admin remains if others exist; if starter was sole admin, keep them
      if (adminsNext.length === 0) {
        adminsNext = ensureAdmins(latest); // safety: don't leave zero admins
      }
      const updated = {
        ...latest,
        admins: adminsNext,
        confidenceVote: null,
        updatedAt: Date.now(),
      };
      await setJSON(`chain:${chainId}`, updated, true);
      setChain(updated);
      return;
    }
    if (no >= need) {
      const updated = { ...latest, confidenceVote: null, updatedAt: Date.now() };
      await setJSON(`chain:${chainId}`, updated, true);
      setChain(updated);
      return;
    }
    const updated = { ...latest, confidenceVote: vote, updatedAt: Date.now() };
    await setJSON(`chain:${chainId}`, updated, true);
    setChain(updated);
  };

  if (!chain) {
    return (
      <div className="chn-root min-h-screen flex items-center justify-center p-6">
        <GlobalStyle />
        <div className="chn-fold chn-rise max-w-sm w-full p-8 rounded-2xl text-center">
          {accessDenied ? (
            <>
              <Lock size={28} color="#1D9BF0" style={{ margin: "0 auto 12px" }} />
              <p className="chn-display text-xl mb-2">Invite only</p>
              <p className="text-sm mb-5" style={{ color: "var(--ink-soft)" }}>
                This story is locked. Community members who still share a community with the starter can
                open it directly. Otherwise redeem a story invite on the lobby.
              </p>
              <button
                onClick={onBack}
                className="chn-btn w-full py-2.5 rounded-2xl text-sm"
                style={{ background: "var(--btn)", color: "var(--btn-ink)" }}
              >
                Back to lobby
              </button>
            </>
          ) : loadFailed ? (
            <>
              <p className="chn-display text-xl mb-2">Couldn't find that chain</p>
              <p className="text-sm mb-5" style={{ color: "var(--ink-soft)" }}>
                It may have been deleted, or it's taking longer than expected to load.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setLoadFailed(false);
                    refresh();
                  }}
                  className="chn-btn flex-1 py-2.5 rounded-2xl text-sm"
                  style={{ border: "1px solid var(--border)" }}
                >
                  Try again
                </button>
                <button
                  onClick={onBack}
                  className="chn-btn flex-1 py-2.5 rounded-2xl text-sm"
                  style={{ background: "var(--btn)", color: "var(--btn-ink)" }}
                >
                  Back to lobby
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="chn-display text-xl mb-4" style={{ color: "var(--ink)" }}>Finding that chain…</p>
              <button
                onClick={onBack}
                className="chn-btn text-sm"
                style={{ color: "var(--ink-soft)" }}
              >
                <ArrowLeft size={14} className="inline mr-1" /> Back to lobby
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  const g = genreMeta(chain.genre);
  const lines = chain.lines || [];
  const visibleLines = unfolded ? lines : lines.slice(-1);
  const estMin = estimateRuntimeMinutes(lines.length);
  const tgtMin = targetMinutes(chain);
  const runtimePct = Math.min(100, Math.round((estMin / Math.max(1, tgtMin)) * 100));
  const targetLabel =
    chain.target?.format === "series"
      ? `Series · ${chain.target.seasons} season(s) · ${chain.target.episodesPerSeason} ep · ${chain.target.episodeMinutes}m`
      : `Movie · target ${chain.target?.movieMinutes || 90} min`;

  return (
    <div className="chn-root" style={{ minHeight: "100vh" }}>
      <GlobalStyle />
      <div className="chn-shell">
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            marginBottom: 20,
          }}
        >
          <button
            type="button"
            onClick={onBack}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 14,
              color: "var(--ink-soft)",
              background: "transparent",
              border: "none",
              padding: "4px 0",
              cursor: "pointer",
            }}
          >
            <ArrowLeft size={16} /> All chains
          </button>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 4,
              marginLeft: "auto",
            }}
          >
            <button
              type="button"
              onClick={() => setShowMusicMenu(true)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 36,
                height: 36,
                borderRadius: 8,
                border: "none",
                background: "transparent",
                cursor: "pointer",
                color: musicSource === "external" ? "#1D9BF0" : musicOn ? "#1D9BF0" : "#71717A",
              }}
              title="Music settings"
            >
              {musicSource === "external" ? (
                <Music size={16} />
              ) : musicOn ? (
                <Volume2 size={16} />
              ) : (
                <VolumeX size={16} />
              )}
            </button>
            <button
              type="button"
              onClick={() => setShowSettings(true)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                fontSize: 13,
                padding: "6px 8px",
                borderRadius: 8,
                border: "none",
                background: "transparent",
                color: "var(--ink-soft)",
                cursor: "pointer",
                position: "relative",
              }}
              title="Story settings — archive, unarchive, delete votes"
            >
              <Settings size={15} /> Settings
              {attentionHere && (
                <span
                  style={{
                    position: "absolute",
                    top: 2,
                    right: 2,
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: "#DC2626",
                  }}
                />
              )}
            </button>
            <button
              type="button"
              onClick={() => setShowChat(true)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                fontSize: 13,
                padding: "6px 8px",
                borderRadius: 8,
                border: "none",
                background: "transparent",
                color: "var(--ink-soft)",
                cursor: "pointer",
              }}
            >
              <MessageCircle size={15} /> Guide
            </button>
            <button
              type="button"
              onClick={() => onOpenHelp?.()}
              className="chn-btn"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
                padding: "8px 10px",
                borderRadius: 999,
                border: "1px solid var(--border)",
                background: "transparent",
                color: "var(--ink)",
                fontSize: 13,
                cursor: "pointer",
              }}
              title="Help & rules"
            >
              <HelpCircle size={16} color="var(--ink)" strokeWidth={2} />
            </button>
            <button
              type="button"
              onClick={() => setUnfolded((u) => !u)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                fontSize: 13,
                padding: "6px 8px",
                borderRadius: 8,
                border: "none",
                background: "transparent",
                color: "#1D9BF0",
                cursor: "pointer",
              }}
            >
              {unfolded ? <Lock size={15} /> : <Unlock size={15} />}
              {unfolded ? "Fold it back up" : `Unfold all ${lines.length}`}
            </button>
          </div>
        </div>

        {(petition || archiveVote || unarchiveVote) && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
            {petition && (
              <div
                className="chn-fold p-4 rounded-2xl flex flex-wrap items-center justify-between gap-3"
                style={{ borderColor: "rgba(220,38,38,0.35)" }}
              >
                <div className="text-sm">
                  <span className="font-medium" style={{ color: "#DC2626" }}>
                    Delete vote open
                  </span>
                  <span style={{ color: "var(--ink-soft)" }}>
                    {" "}
                    — Yes {voteYesCount(petition)} · No {voteNoCount(petition)} · need {Math.ceil(participants.length / 2)} yes · expires in {Math.max(0, Math.ceil(VOTE_EXPIRE_HOURS - hoursSince(petition.startedAt)))}h
                    {youVotedDelete ? " · you voted" : ""}
                  </span>
                </div>
                {!youVotedDelete && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => voteDelete("yes")}
                      className="chn-btn px-3 py-1.5 rounded-2xl text-xs"
                      style={{ background: "var(--danger)", color: "var(--danger-ink)" }}
                    >
                      Yes, delete
                    </button>
                    <button
                      onClick={() => voteDelete("no")}
                      className="chn-btn px-3 py-1.5 rounded-2xl text-xs"
                      style={{ border: "1px solid var(--border)" }}
                    >
                      No
                    </button>
                  </div>
                )}
              </div>
            )}
            {archiveVote && (
              <div
                className="chn-fold p-4 rounded-2xl flex flex-wrap items-center justify-between gap-3"
                style={{ borderColor: "rgba(29,155,240,0.35)" }}
              >
                <div className="text-sm">
                  <span className="font-medium" style={{ color: "#1D9BF0" }}>
                    Archive vote open
                  </span>
                  <span style={{ color: "var(--ink-soft)" }}>
                    {" "}
                    — Yes {voteYesCount(archiveVote)} · No {voteNoCount(archiveVote)} · need {Math.ceil(participants.length / 2)} yes · expires in {Math.max(0, Math.ceil(VOTE_EXPIRE_HOURS - hoursSince(archiveVote.startedAt)))}h
                    {youVotedArchive ? " · you voted" : ""}
                  </span>
                </div>
                {!youVotedArchive && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => voteArchive("yes")}
                      className="chn-btn px-3 py-1.5 rounded-2xl text-xs"
                      style={{ background: "#1D9BF0", color: "#F0F9FF" }}
                    >
                      Yes, archive
                    </button>
                    <button
                      onClick={() => voteArchive("no")}
                      className="chn-btn px-3 py-1.5 rounded-2xl text-xs"
                      style={{ border: "1px solid var(--border)" }}
                    >
                      No
                    </button>
                  </div>
                )}
              </div>
            )}
            {unarchiveVote && (
              <div
                className="chn-fold p-4 rounded-2xl flex flex-wrap items-center justify-between gap-3"
                style={{ borderColor: "rgba(22,163,74,0.35)" }}
              >
                <div className="text-sm">
                  <span className="font-medium" style={{ color: "#16A34A" }}>
                    Unarchive vote open
                  </span>
                  <span style={{ color: "var(--ink-soft)" }}>
                    {" "}
                    — Yes {voteYesCount(unarchiveVote)} · No {voteNoCount(unarchiveVote)} · need {Math.ceil(participants.length / 2)} yes · expires in {Math.max(0, Math.ceil(VOTE_EXPIRE_HOURS - hoursSince(unarchiveVote.startedAt)))}h
                    {youVotedUnarchive ? " · you voted" : ""}
                  </span>
                </div>
                {!youVotedUnarchive && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => voteUnarchive("yes")}
                      className="chn-btn px-3 py-1.5 rounded-2xl text-xs"
                      style={{ background: "#16A34A", color: "#DCFCE7" }}
                    >
                      Yes, unarchive
                    </button>
                    <button
                      onClick={() => voteUnarchive("no")}
                      className="chn-btn px-3 py-1.5 rounded-2xl text-xs"
                      style={{ border: "1px solid var(--border)" }}
                    >
                      No
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div style={{ marginBottom: 24 }}>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 8,
              marginBottom: 10,
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                padding: "4px 10px",
                borderRadius: 8,
                background: g.accent,
                color: "var(--btn-ink)",
                flexShrink: 0,
              }}
            >
              {g.label}
              {chain.solo ? " · practice" : ""}
            </span>
            <span
              style={{
                fontSize: 12,
                padding: "4px 10px",
                borderRadius: 8,
                background: "rgba(15,15,16,0.08)",
                color: "var(--ink-soft)",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                flexShrink: 0,
              }}
            >
              {chain.target?.format === "series" ? <Tv size={12} /> : <Film size={12} />}
              {targetLabel}
            </span>
            {chain.theme && (
              <span
                style={{
                  fontSize: 12,
                  fontStyle: "italic",
                  padding: "4px 10px",
                  borderRadius: 8,
                  background: "rgba(176,141,87,0.18)",
                  color: "#1D9BF0",
                  flexShrink: 0,
                }}
              >
                {chain.theme}
              </span>
            )}
            {chain.archived && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "4px 10px",
                  borderRadius: 8,
                  background: "#71717A",
                  color: "var(--btn-ink)",
                  flexShrink: 0,
                }}
              >
                Archived
              </span>
            )}
          </div>
          <h1
            className="chn-display"
            style={{ fontSize: "clamp(1.75rem, 5vw, 2rem)", margin: "4px 0 0 0", lineHeight: 1.2 }}
          >
            {chain.title}
          </h1>
          <p style={{ fontSize: 12, marginTop: 6, color: "var(--ink-soft)", lineHeight: 1.4 }}>
            started by {chain.createdBy} · {lines.length} line{lines.length === 1 ? "" : "s"}
            {estMin > 0 ? ` · ~${estMin}/${tgtMin} min (${runtimePct}%)` : ` · target ${tgtMin} min`}
            {chain.finished ? " · The End" : ""}
          </p>
          {!chain.finished && (
            <div
              style={{
                marginTop: 10,
                height: 6,
                borderRadius: 999,
                background: "rgba(15,15,16,0.10)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${runtimePct}%`,
                  borderRadius: 999,
                  background: canFinish ? "#2E5A3C" : "#B08D57",
                  transition: "width 0.2s ease",
                }}
              />
            </div>
          )}
        </div>

        <div
          className="chn-scrollbar space-y-2 mb-6"
          style={{ maxHeight: unfolded ? "48vh" : "none", overflowY: unfolded ? "auto" : "visible" }}
        >
          {lines.length === 0 && (
            <div
              className="chn-fold chn-rise"
              style={{
                padding: 24,
                borderRadius: 16,
                textAlign: "center",
                background: "var(--paper-card)",
                border: "1px solid var(--border)",
                marginBottom: 16,
              }}
            >
              <p className="chn-display" style={{ fontSize: 18, margin: "0 0 6px 0", color: "var(--ink)" }}>
                The page is blank
              </p>
              <p style={{ fontSize: 14, color: "var(--ink-soft)", margin: 0 }}>
                Write the very first line below.
              </p>
            </div>
          )}
          {visibleLines.map((l, i) => (
            <div
              key={l.id}
              className="chn-fold chn-rise"
              style={{
                padding: 16,
                borderRadius: 16,
                background: "var(--paper-card)",
                border: "1px solid var(--border)",
              }}
            >
              <p style={{ fontSize: 17, lineHeight: 1.45, margin: 0, paddingRight: 8 }}>{l.text}</p>
              <p
                style={{
                  marginTop: 8,
                  fontSize: 12,
                  color: "#1D9BF0",
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: 8,
                  fontWeight: 500,
                  letterSpacing: "normal",
                  textTransform: "none",
                }}
              >
                <span>
                  — {l.authorName}, {timeAgo(l.ts)}
                </span>
                {l.aiScore != null && (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      padding: "2px 8px",
                      borderRadius: 999,
                      background: "#FEF3C7",
                      color: "#92400E",
                      whiteSpace: "nowrap",
                      letterSpacing: "normal",
                      textTransform: "none",
                    }}
                  >
                    AI {l.aiScore}/10 · {l.aiSource === "claude" ? "live" : "local"}
                  </span>
                )}
              </p>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {youAreKicked && (
          <div
            style={{
              margin: "12px 0",
              padding: 12,
              borderRadius: 12,
              background: "rgba(220,38,38,0.08)",
              border: "1px solid rgba(220,38,38,0.25)",
              fontSize: 13,
              color: "#DC2626",
            }}
          >
            You were removed from this story by admin vote. You can still read it, but you cannot add lines.
          </div>
        )}
        {!chain.finished && !isArchivedLocked && !youAreKicked && (
          <div className="chn-fold" style={{ padding: 20, borderRadius: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12, fontSize: 12, color: "#B08D57" }}>
              <Sparkles size={13} />
              <span>optional twist — weave in "{chain.twist}" if it strikes you</span>
            </div>

            {!yourTurn && (
              <p style={{ fontSize: 14, marginBottom: 12, color: "#1D9BF0" }}>
                You wrote the last line. Wait for another writer, or open Practice mode next time.
              </p>
            )}

            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              disabled={!yourTurn || busy}
              placeholder={lines.length === 0 ? "Once, in a town no map remembered…" : "Add exactly one line…"}
              maxLength={LINE_LIMIT}
              rows={3}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 16,
                outline: "none",
                resize: "none",
                boxSizing: "border-box",
                background: "var(--paper-2)",
                border: "1px solid var(--border)",
                color: "var(--ink)",
                fontSize: 15,
                fontFamily: "inherit",
                opacity: !yourTurn || busy ? 0.5 : 1,
              }}
            />
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 8,
                marginTop: 4,
                marginBottom: 12,
              }}
            >
              <span style={{ fontSize: 12, color: error ? "#1D9BF0" : "var(--ink-soft)", flexShrink: 0 }}>
                {error || `${draft.length}/${LINE_LIMIT}`}
              </span>
              {aiScore && (
                <span
                  style={{
                    fontSize: 12,
                    color: "#B08D57",
                    textAlign: "right",
                    maxWidth: "100%",
                    lineHeight: 1.4,
                  }}
                >
                  AI {aiScore.score}/10 — {aiScore.verdict}{" "}
                  <span style={{ opacity: 0.7 }}>
                    ({aiScore.source === "claude" ? "live" : "local fallback"})
                  </span>
                </span>
              )}
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              <button
                onClick={submitLine}
                disabled={!yourTurn || busy || !draft.trim()}
                className="chn-btn chn-btn-primary"
                style={{
                  flex: "1 1 140px",
                  padding: "10px 14px",
                  borderRadius: 16,
                  fontSize: 14,
                  cursor: !yourTurn || busy || !draft.trim() ? "not-allowed" : "pointer",
                  opacity: !yourTurn || busy || !draft.trim() ? 0.4 : 1,
                }}
              >
                {busy ? "Setting ink…" : "Add this line"}
              </button>
              <button
                onClick={markFinished}
                disabled={!canFinish}
                className="chn-btn"
                style={{
                  padding: "10px 14px",
                  borderRadius: 16,
                  fontSize: 14,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  border: "1px solid var(--border)",
                  color: canFinish ? "#2E5A3C" : "#71717A",
                  background: canFinish ? "rgba(46,90,60,0.08)" : "transparent",
                  cursor: canFinish ? "pointer" : "not-allowed",
                  opacity: canFinish ? 1 : 0.4,
                }}
                title={
                  canFinish
                    ? "Mark this chain as finished"
                    : `Need ~85% of target (~${tgtMin} min). Now ~${estMin} min (${runtimeProgressPercent(chain)}%).`
                }
              >
                <CheckCircle2 size={15} /> The End
              </button>
            </div>
            <p style={{ fontSize: 12, color: "var(--ink-soft)", margin: "8px 0 0 0", lineHeight: 1.4 }}>
              “The End” unlocks at ~85% of target runtime ({tgtMin} min). Progress: {runtimeProgressPercent(chain)}%.
            </p>
            {!canFinish && (
              <p style={{ fontSize: 12, marginTop: 8, color: "var(--ink-soft)" }}>
              </p>
            )}
          </div>
        )}

        {isArchivedLocked && !chain.finished && (
          <div
            className="chn-fold"
            style={{
              padding: 20,
              borderRadius: 16,
              textAlign: "center",
              background: "var(--paper-card)",
              border: "1px solid var(--border)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
              <Archive size={20} color="#71717A" />
            </div>
            <p style={{ fontSize: 14, color: "var(--ink-soft)", margin: 0, lineHeight: 1.5 }}>
              This production is fully archived (30+ days inactive). New lines are closed. You can still read and watch it.
            </p>
          </div>
        )}

        {chain.finished && (
          <div className="text-center py-6 space-y-4">
            <p className="chn-display text-2xl">— The End —</p>
            {!chain.titleLocked && (
              <div
                style={{
                  maxWidth: 360,
                  margin: "0 auto 12px",
                  padding: 14,
                  borderRadius: 12,
                  background: "rgba(29,155,240,0.08)",
                  border: "1px solid var(--border)",
                  textAlign: "left",
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
                  Polish title before conversion
                </div>
                <p style={{ fontSize: 12, color: "var(--ink-soft)", margin: "0 0 8px", lineHeight: 1.45 }}>
                  Current: <strong>{chain.title}</strong>. AI can suggest a name before you convert to a
                  movie/series experience. After Watch / MP4 / Offline reel the title becomes permanent.
                </p>
                <button
                  type="button"
                  onClick={async () => {
                    const suggestion = generateTitleSuggestion(chain);
                    await applyTitleChange(suggestion, { fromAI: true });
                  }}
                  className="chn-btn"
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 999,
                    border: "none",
                    background: "#1D9BF0",
                    color: "var(--btn-ink)",
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  <Sparkles size={14} style={{ display: "inline", marginRight: 6, verticalAlign: "middle" }} />
                  AI auto-generate title
                </button>
              </div>
            )}
            {chain.titleLocked && (
              <p className="text-xs" style={{ color: "var(--ink-soft)" }}>
                Title locked: {chain.title}
              </p>
            )}
            <div className="flex flex-wrap justify-center gap-3">
              <button
                onClick={async () => {
                  if (!chain.titleLocked) {
                    const latest = (await getJSON(`chain:${chainId}`, true)) || chain;
                    const updated = { ...latest, titleLocked: true, updatedAt: Date.now() };
                    await setJSON(`chain:${chainId}`, updated, true);
                    setChain(updated);
                  }
                  setWatching(true);
                }}
                className="chn-btn px-4 py-2.5 rounded-2xl text-sm flex items-center gap-1.5"
                style={{ background: "var(--btn)", color: "var(--btn-ink)" }}
              >
                <Play size={15} /> Watch
              </button>
              <button
                onClick={async () => {
                  if (!chain.titleLocked) {
                    const latest = (await getJSON(`chain:${chainId}`, true)) || chain;
                    const updated = { ...latest, titleLocked: true, updatedAt: Date.now() };
                    await setJSON(`chain:${chainId}`, updated, true);
                    setChain(updated);
                  }
                  setShowVideo(true);
                }}
                className="chn-btn px-4 py-2.5 rounded-2xl text-sm flex items-center gap-1.5"
                style={{ border: "1px solid var(--border)" }}
              >
                <Film size={15} /> Generate MP4
              </button>
              <button
                onClick={async () => {
                  if (!profile.premium) {
                    alert("Offline HTML reel download is a Premium feature (demo toggle available on the Board).");
                    return;
                  }
                  if (!chain.titleLocked) {
                    const latest = (await getJSON(`chain:${chainId}`, true)) || chain;
                    const updated = { ...latest, titleLocked: true, updatedAt: Date.now() };
                    await setJSON(`chain:${chainId}`, updated, true);
                    setChain(updated);
                    downloadHtmlReel(updated);
                  } else {
                    downloadHtmlReel(chain);
                  }
                }}
                className="chn-btn px-4 py-2.5 rounded-2xl text-sm flex items-center gap-1.5"
                style={{ border: "1px solid var(--border)" }}
              >
                <Download size={15} /> Offline reel
              </button>
            </div>
            <p className="text-xs" style={{ color: "var(--ink-soft)" }}>
              MP4 generation needs a backend you deploy. Offline reel works instantly for Premium (demo).
            </p>
          </div>
        )}
      </div>

      {watching && (
        <WatchMode
          chain={chain}
          profile={profile}
          onClose={() => setWatching(false)}
          onLike={async (delta = 1) => {
            const d = delta >= 0 ? 1 : -1;
            const updated = { ...chain, likes: Math.max(0, (chain.likes || 0) + d) };
            await setJSON(`chain:${chainId}`, updated, true);
            setChain(updated);
            const p = { ...profile, likes: Math.max(0, (profile.likes || 0) + d) };
            await saveProfile(p, onUpdateProfile);
          }}
        />
      )}
      {showVideo && <VideoGenModal chain={chain} onClose={() => setShowVideo(false)} />}
      {showChat && <AIChatBot onClose={() => setShowChat(false)} />}
      {showMusicMenu && (
        <MusicMenuModal
          profile={profile}
          chain={chain}
          onClose={() => setShowMusicMenu(false)}
          onUpdateProfile={onUpdateProfile}
          musicOn={musicOn}
          toggleMusic={toggleMusic}
          musicVolume={musicVolume}
          onVolumeChange={setMusicVolume}
        />
      )}
      {showSettings && (
        <StorySettingsModal
          chain={chain}
          profile={profile}
          participants={participants}
          isMultiWriter={isMultiWriter}
          petition={petition}
          archiveVote={archiveVote}
          unarchiveVote={unarchiveVote}
          titleVote={titleVote}
          kickVote={kickVote}
          confidenceVote={confidenceVote}
          youVotedDelete={youVotedDelete}
          youVotedArchive={youVotedArchive}
          youVotedUnarchive={youVotedUnarchive}
          youVotedTitle={youVotedTitle}
          youVotedKick={youVotedKick}
          youVotedConfidence={youVotedConfidence}
          youAreAdmin={youAreAdmin}
          portalOpen={portalOpen}
          onClose={() => setShowSettings(false)}
          onStartDelete={startDeleteVote}
          onVoteDelete={voteDelete}
          onStartArchive={startArchiveVote}
          onVoteArchive={voteArchive}
          onStartUnarchive={startUnarchiveVote}
          onVoteUnarchive={voteUnarchive}
          onToggleLock={toggleLock}
          onSetStoryBg={setStoryBg}
          onApplyTitle={applyTitleChange}
          onTitleVote={castTitleVote}
          onAdminBallot={castAdminBallot}
          onKickVote={castKickVote}
          onConfidenceVote={castConfidenceVote}
        />
      )}
    </div>
  );
}

function VotePanel({
  title,
  icon,
  description,
  vote,
  participants,
  youVoted,
  onStart,
  onVote,
  accent = "#1D9BF0",
  startLabel,
  requireConfirm = false,
  confirmMessage = "",
}) {
  const [confirming, setConfirming] = useState(false);
  const need = Math.ceil(Math.max(1, participants.length) / 2);
  const yes = vote ? voteYesCount(vote) : 0;
  const no = vote ? voteNoCount(vote) : 0;
  const hoursLeft = vote
    ? Math.max(0, Math.ceil(VOTE_EXPIRE_HOURS - hoursSince(vote.startedAt)))
    : 0;

  return (
    <div
      style={{
        padding: 16,
        borderRadius: 12,
        marginBottom: 16,
        background: `${accent}14`,
        border: `1px solid ${accent}30`,
        boxSizing: "border-box",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        {icon}
        <span style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>{title}</span>
      </div>
      <p style={{ fontSize: 13, lineHeight: 1.5, color: "var(--ink-soft)", margin: "0 0 14px 0" }}>
        {description}
      </p>
      {!vote ? (
        confirming && requireConfirm ? (
          <div>
            <p
              style={{
                fontSize: 13,
                color: "var(--danger)",
                margin: "0 0 12px 0",
                lineHeight: 1.45,
                fontWeight: 600,
              }}
            >
              {confirmMessage ||
                "This cannot be undone. Are you sure you want to delete this story?"}
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => {
                  setConfirming(false);
                  onStart?.();
                }}
                className="chn-btn"
                style={{
                  flex: 1,
                  padding: "12px 16px",
                  borderRadius: 999,
                  fontSize: 14,
                  fontWeight: 600,
                  background: accent,
                  color: "var(--btn-ink)",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Yes
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="chn-btn"
                style={{
                  flex: 1,
                  padding: "12px 16px",
                  borderRadius: 999,
                  fontSize: 14,
                  fontWeight: 600,
                  background: "transparent",
                  color: "var(--ink)",
                  border: "1px solid var(--border)",
                  cursor: "pointer",
                }}
              >
                No
              </button>
            </div>
          </div>
        ) : (
        <button
          type="button"
          onClick={() => {
            if (requireConfirm) setConfirming(true);
            else onStart?.();
          }}
          className="chn-btn"
          style={{
            width: "100%",
            padding: "12px 16px",
            borderRadius: 999,
            fontSize: 14,
            fontWeight: 600,
            background: accent,
            color: "var(--btn-ink)",
            border: "none",
            cursor: "pointer",
            boxSizing: "border-box",
          }}
        >
          {startLabel}
        </button>
        )
      ) : (
        <>
          <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: "0 0 10px 0" }}>
            Anonymous vote · Yes {yes} · No {no} · need {need} yes · {hoursLeft}h left
            {youVoted ? " · you already voted" : ""}
          </p>
          <p style={{ fontSize: 12, color: "var(--ink-soft)", margin: "0 0 12px 0" }}>
            Votes cannot be cancelled once started. Votes expire after {VOTE_EXPIRE_HOURS} hours.
          </p>
          {!youVoted && (
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => onVote("yes")}
                className="chn-btn"
                style={{
                  flex: 1,
                  padding: "12px 16px",
                  borderRadius: 999,
                  fontSize: 14,
                  fontWeight: 600,
                  background: accent,
                  color: "var(--btn-ink)",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Yes
              </button>
              <button
                type="button"
                onClick={() => onVote("no")}
                className="chn-btn"
                style={{
                  flex: 1,
                  padding: "12px 16px",
                  borderRadius: 999,
                  fontSize: 14,
                  fontWeight: 600,
                  background: "transparent",
                  color: "var(--ink)",
                  border: "1px solid var(--border)",
                  cursor: "pointer",
                }}
              >
                No
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StorySettingsModal({
  chain,
  profile,
  participants,
  isMultiWriter,
  petition,
  archiveVote,
  unarchiveVote,
  titleVote,
  kickVote,
  confidenceVote,
  youVotedDelete,
  youVotedArchive,
  youVotedUnarchive,
  youVotedTitle,
  youVotedKick,
  youVotedConfidence,
  youAreAdmin,
  portalOpen,
  onClose,
  onStartDelete,
  onVoteDelete,
  onStartArchive,
  onVoteArchive,
  onStartUnarchive,
  onVoteUnarchive,
  onToggleLock,
  onSetStoryBg,
  onApplyTitle,
  onTitleVote,
  onAdminBallot,
  onKickVote,
  onConfidenceVote,
}) {
  const isArchived = !!chain.archived;
  const [voteLimitFlash, setVoteLimitFlash] = useState(false);
  const voteLimitTimer = useRef(null);
  const [copiedInvite, setCopiedInvite] = useState(false);

  const flashVoteLimit = () => {
    // After 2 bursts, suppress this toast for 20s (action still blocked by limit logic)
    if (!canShowFadeToast("vote-limit-5-5")) return;
    setVoteLimitFlash(true);
    if (voteLimitTimer.current) clearTimeout(voteLimitTimer.current);
    voteLimitTimer.current = setTimeout(() => setVoteLimitFlash(false), 5500);
  };

  useEffect(() => () => {
    if (voteLimitTimer.current) clearTimeout(voteLimitTimer.current);
  }, []);

  const wrapStart = (fn, kind = "vote") => async () => {
    const result = await fn?.();
    if (result === "limit") {
      flashVoteLimit();
      const d = recordDeniedAction(`vote-limit:${kind}`);
      if (d.warning) {
        setVoteLimitFlash(true);
      }
      if (d.suspended) {
        window.location.reload();
      }
    }
    if (result === "throttle" || result === "cooldown") {
      const d = recordDeniedAction(`vote-throttle:${kind}`);
      if (d.suspended) window.location.reload();
    }
  };
  const canLock = !!profile?.premium && isStoryStarter(chain, profile.id);
  const [titleDraft, setTitleDraft] = useState(chain.title || "");
  const [titleMsg, setTitleMsg] = useState("");
  const admins = ensureAdmins(chain);
  const changesUsed = titleChangesInWindow(chain);
  const titleEditable = canEditTitle(chain);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        background: "rgba(0,0,0,0.55)",
      }}
      onClick={onClose}
    >
      <div
        className="chn-rise"
        style={{
          width: "100%",
          maxWidth: 400,
          maxHeight: "85vh",
          overflowY: "auto",
          padding: 24,
          borderRadius: 16,
          background: "var(--paper-card)",
          border: "1px solid var(--border)",
          boxSizing: "border-box",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 16,
            gap: 12,
          }}
        >
          <h3
            className="chn-display"
            style={{ fontSize: 20, fontWeight: 700, margin: 0, color: "var(--ink)" }}
          >
            Story settings
          </h3>
          <button
            type="button"
            onClick={onClose}
            style={{
              color: "var(--ink-soft)",
              background: "transparent",
              border: "none",
              padding: 4,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
            }}
          >
            <X size={18} />
          </button>
        </div>

        <p style={{ fontSize: 15, color: "var(--ink-soft)", margin: "0 0 4px 0" }}>{chain.title}</p>
        <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: "0 0 16px 0" }}>
          Format: {chain.target?.format || "movie"} · Participants: {participants.length}
          {isArchived ? " · Archived" : ""}
          {chain.locked ? " · Locked" : ""}
        </p>

        {/* Lock: one padlock + code + copy; lock slides code in */}
        <div
          style={{
            marginBottom: 20,
            padding: 12,
            borderRadius: 12,
            background: "var(--paper-2)",
            border: "1px solid var(--border)",
            minHeight: 56,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <div
            style={{
              flex: 1,
              minWidth: 0,
              display: "flex",
              alignItems: "center",
              gap: 8,
              overflow: "hidden",
              opacity: chain.locked && chain.inviteCode && !chain.finished && !chain.inviteExpired ? 1 : 0,
              maxWidth: chain.locked && chain.inviteCode && !chain.finished && !chain.inviteExpired ? 480 : 0,
              transform: chain.locked && chain.inviteCode && !chain.finished && !chain.inviteExpired ? "translateX(0)" : "translateX(-10px)",
              transition: "opacity 0.28s ease, transform 0.28s ease, max-width 0.28s ease",
              pointerEvents: chain.locked && chain.inviteCode && !chain.finished && !chain.inviteExpired ? "auto" : "none",
            }}
          >
            {chain.locked && chain.inviteCode && !chain.finished && !chain.inviteExpired ? (
              <>
                <strong
                  style={{
                    fontSize: 15,
                    fontFamily: "ui-monospace, monospace",
                    letterSpacing: "0.08em",
                    color: "var(--ink)",
                    wordBreak: "break-all",
                  }}
                >
                  {chain.inviteCode}
                </strong>
                <button
                  type="button"
                  title="Copy"
                  aria-label="Copy invite code"
                  onClick={async () => {
                    const code = String(chain.inviteCode || "");
                    try {
                      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(code);
                      else {
                        const ta = document.createElement("textarea");
                        ta.value = code;
                        ta.style.position = "fixed";
                        ta.style.left = "-9999px";
                        document.body.appendChild(ta);
                        ta.select();
                        document.execCommand("copy");
                        document.body.removeChild(ta);
                      }
                      setCopiedInvite(true);
                      setTimeout(() => setCopiedInvite(false), 1500);
                    } catch (_) {}
                  }}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 34,
                    height: 34,
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    background: "var(--paper-card)",
                    color: "var(--ink)",
                    cursor: "pointer",
                    flexShrink: 0,
                    padding: 0,
                  }}
                >
                  <Copy size={15} strokeWidth={2.25} />
                </button>
                {copiedInvite && (
                  <span style={{ fontSize: 12, color: "#1D9BF0", fontWeight: 600, flexShrink: 0 }}>Copied</span>
                )}
              </>
            ) : null}
            {chain.locked && (chain.finished || chain.inviteExpired) ? (
              <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>Invite expired</span>
            ) : null}
          </div>
          {canLock ? (
            <button
              type="button"
              onClick={() => onToggleLock?.()}
              title={chain.locked ? "Unlock" : "Lock (invite only)"}
              aria-label={chain.locked ? "Unlock story" : "Lock story"}
              style={{
                flexShrink: 0,
                width: 44,
                height: 44,
                borderRadius: 999,
                border: "1px solid var(--border)",
                background: "var(--paper-card)",
                color: "var(--ink)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
              }}
            >
              {chain.locked ? <Lock size={20} strokeWidth={2.25} /> : <Unlock size={20} strokeWidth={2.25} />}
            </button>
          ) : (
            <span style={{ fontSize: 12, color: "var(--ink-soft)", flexShrink: 0 }}>
              {chain.locked ? <Lock size={18} /> : "Premium"}
            </span>
          )}
        </div>

        {/* Title edit — before The End only; 3/day; revoke by vote */}
        <div
          style={{
            marginBottom: 20,
            padding: 14,
            borderRadius: 12,
            background: "var(--paper-2)",
            border: "1px solid var(--border)",
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>Title</div>
          <p style={{ fontSize: 12, color: "var(--ink-soft)", margin: "0 0 10px 0", lineHeight: 1.45 }}>
            {changesUsed}/{TITLE_CHANGES_PER_DAY}
          </p>
          {chain.titleLocked ? (
            <p style={{ fontSize: 13, margin: 0 }}>
              <strong>{chain.title}</strong> · permanent
            </p>
          ) : (
            <>
              <input
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value.slice(0, 60))}
                disabled={!titleEditable}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                  background: titleEditable ? "var(--paper-card)" : "var(--paper-2)",
                  fontSize: 14,
                  outline: "none",
                  boxSizing: "border-box",
                  marginBottom: 8,
                }}
              />
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                <button
                  type="button"
                  disabled={!titleEditable || !titleDraft.trim()}
                  onClick={async () => {
                    const res = await onApplyTitle?.(titleDraft);
                    if (res?.unchanged) setTitleMsg("Same title — no change used.");
                    else setTitleMsg(res?.ok ? "Title updated." : res?.message || "Could not update.");
                  }}
                  className="chn-btn chn-btn-primary"
                  style={{
                    padding: "8px 14px",
                    borderRadius: 999,
                    fontSize: 12,
                    cursor: titleEditable ? "pointer" : "not-allowed",
                    opacity: titleEditable ? 1 : 0.5,
                  }}
                >
                  Save
                </button>
                <button
                  type="button"
                  disabled={!titleEditable}
                  onClick={() => {
                    const suggestion = generateTitleSuggestion(chain);
                    setTitleDraft(suggestion);
                    setTitleMsg(`AI suggested: ${suggestion} — tap Save to apply (uses 1 change).`);
                  }}
                  className="chn-btn chn-btn-secondary"
                  style={{
                    padding: "8px 14px",
                    borderRadius: 999,
                    fontSize: 12,
                    cursor: titleEditable ? "pointer" : "not-allowed",
                    opacity: titleEditable ? 1 : 0.5,
                  }}
                >
                  AI suggest
                </button>
                {!titleVote && (
                  <button
                    type="button"
                    onClick={() => onTitleVote?.("yes", chain.title)}
                    className="chn-btn chn-btn-danger"
                    style={{
                      padding: "8px 14px",
                      borderRadius: 999,
                      fontSize: 12,
                      cursor: "pointer",
                    }}
                  >
                    Revoke
                  </button>
                )}
              </div>
              {titleVote && (
                <div style={{ marginTop: 10, fontSize: 12, color: "var(--ink-soft)" }}>
                  Title revoke vote · yes {voteYesCount(titleVote)} · no {voteNoCount(titleVote)}
                  {!youVotedTitle && (
                    <span style={{ marginLeft: 8 }}>
                      <button type="button" onClick={() => onTitleVote?.("yes")} style={{ marginRight: 6, cursor: "pointer" }}>
                        Yes
                      </button>
                      <button type="button" onClick={() => onTitleVote?.("no")} style={{ cursor: "pointer" }}>
                        No
                      </button>
                    </span>
                  )}
                  {youVotedTitle ? " · you voted" : ""}
                </div>
              )}
              {titleMsg && <p style={{ fontSize: 12, color: "#1D9BF0", margin: "8px 0 0" }}>{titleMsg}</p>}
            </>
          )}
        </div>

        {/* Admins portal */}
        <div
          style={{
            marginBottom: 20,
            padding: 14,
            borderRadius: 12,
            background: "rgba(29,155,240,0.06)",
            border: "1px solid var(--border)",
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>
            Admins ({admins.length}/{MAX_ADMINS})
          </div>
          <p style={{ fontSize: 12, color: "var(--ink-soft)", margin: "0 0 10px 0", lineHeight: 1.45 }}>
            Portal closes after 50% of writers vote, reopens when the cast grows by ~50% again.
          </p>
          <div style={{ fontSize: 13, marginBottom: 8 }}>
            {admins.map((a) => (
              <div key={a.id} style={{ marginBottom: 4 }}>
                {a.name}
                {a.id === chain.createdById ? " · starter" : ""}
                {a.id === profile.id ? " · you" : ""}
              </div>
            ))}
          </div>
          {portalOpen && admins.length < MAX_ADMINS ? (
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: "#1D9BF0" }}>
                Admin election open — nominate a writer
              </div>
              {participants
                .filter((p) => !admins.some((a) => a.id === p.id))
                .map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onAdminBallot?.(p.id, p.name)}
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      padding: "8px 10px",
                      marginBottom: 4,
                      borderRadius: 8,
                      border: "1px solid var(--border)",
                      background: "var(--paper-card)",
                      cursor: "pointer",
                      fontSize: 13,
                    }}
                  >
                    Nominate {p.name}
                  </button>
                ))}
              {chain.adminElection?.open && (
                <p style={{ fontSize: 12, color: "var(--ink-soft)", margin: "8px 0 0" }}>
                  Ballots {(chain.adminElection.ballots || []).length} /{" "}
                  {Math.ceil(Math.max(1, participants.length) / 2)} to close
                </p>
              )}
            </div>
          ) : (
            <p style={{ fontSize: 12, color: "var(--ink-soft)", margin: 0 }}>
              {admins.length >= MAX_ADMINS
                ? "Admin seats are full."
                : "Admin portal is closed until the writer count grows enough to reopen."}
            </p>
          )}

          {/* Kick vote */}
          {youAreAdmin && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(15,15,16,0.08)" }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Kick (admins only)</div>
              {kickVote ? (
                <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>
                  Kick {kickVote.targetName}? yes {voteYesCount(kickVote)} · no {voteNoCount(kickVote)} · need{" "}
                  {Math.ceil(Math.max(1, admins.length) / 2)}
                  {!youVotedKick && (
                    <span style={{ marginLeft: 8 }}>
                      <button type="button" onClick={() => onKickVote?.("yes")} style={{ marginRight: 6, cursor: "pointer" }}>
                        Yes
                      </button>
                      <button type="button" onClick={() => onKickVote?.("no")} style={{ cursor: "pointer" }}>
                        No
                      </button>
                    </span>
                  )}
                  {youVotedKick ? " · you voted" : ""}
                </div>
              ) : (
                participants
                  .filter((p) => p.id !== chain.createdById && p.id !== profile.id && !(chain.kickedIds || []).includes(p.id))
                  .map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => onKickVote?.("yes", p.id, p.name)}
                      style={{
                        display: "block",
                        width: "100%",
                        textAlign: "left",
                        padding: "6px 8px",
                        marginBottom: 4,
                        borderRadius: 8,
                        border: "1px solid rgba(220,38,38,0.3)",
                        background: "transparent",
                        color: "#DC2626",
                        fontSize: 12,
                        cursor: "pointer",
                      }}
                    >
                      Start kick vote: {p.name}
                    </button>
                  ))
              )}
            </div>
          )}

          {/* Confidence vote vs starter admin role */}
          {youAreAdmin && admins.some((a) => a.id === chain.createdById) && profile.id !== chain.createdById && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(15,15,16,0.08)" }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                Confidence (strip starter admin only)
              </div>
              <p style={{ fontSize: 11, color: "var(--ink-soft)", margin: "0 0 8px" }}>
                Strips starter admin only. Starter stays in the story.
              </p>
              {confidenceVote ? (
                <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>
                  yes {voteYesCount(confidenceVote)} · no {voteNoCount(confidenceVote)}
                  {!youVotedConfidence && (
                    <span style={{ marginLeft: 8 }}>
                      <button type="button" onClick={() => onConfidenceVote?.("yes")} style={{ marginRight: 6, cursor: "pointer" }}>
                        Yes
                      </button>
                      <button type="button" onClick={() => onConfidenceVote?.("no")} style={{ cursor: "pointer" }}>
                        No
                      </button>
                    </span>
                  )}
                  {youVotedConfidence ? " · you voted" : ""}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => onConfidenceVote?.("yes")}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 999,
                    border: "1px solid var(--border)",
                    background: "transparent",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Start confidence vote
                </button>
              )}
            </div>
          )}
        </div>

        <div style={{ marginBottom: 20 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#1D9BF0",
              marginBottom: 10,
            }}
          >
            Writers on this chain
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {participants.map((p) => (
              <div
                key={p.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 14,
                  color: "var(--ink)",
                }}
              >
                <Users size={14} color="#71717A" />
                <span>
                  {p.name}
                  {p.id === profile.id && (
                    <span style={{ marginLeft: 6, fontSize: 12, color: "#1D9BF0" }}>(you)</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>

        <p style={{ fontSize: 12, color: "var(--ink-soft)", margin: "0 0 14px 0", lineHeight: 1.45 }}>
          Multi-writer actions use anonymous majority votes (highest side wins). Votes cannot be cancelled once started. Votes expire after {VOTE_EXPIRE_HOURS} hours.
        </p>
        {voteLimitFlash && (
          <p
            style={{
              fontSize: 15,
              color: "var(--danger)",
              margin: "0 0 14px 0",
              fontWeight: 700,
              lineHeight: 1.4,
              letterSpacing: "0.04em",
              transition: "opacity 0.4s ease",
            }}
          >
            5/5
          </p>
        )}

        {/* Archive / Unarchive */}
        {!isArchived ? (
          <VotePanel
            title="Archive this chain"
            icon={<Archive size={16} color="#1D9BF0" />}
            description={
              isMultiWriter
                ? "Hide it from the timeline without deleting. Majority yes moves it to Archives. New lines close once archived."
                : "Only you have written here. Archive moves it off the timeline immediately without deleting."
            }
            vote={archiveVote}
            participants={participants}
            youVoted={youVotedArchive}
            onStart={wrapStart(onStartArchive)}
            onVote={onVoteArchive}
            accent="#1D9BF0"
            startLabel={isMultiWriter ? "Start archive vote" : "Archive"}
          />
        ) : (
          <VotePanel
            title="Unarchive this chain"
            icon={<Unlock size={16} color="#16A34A" />}
            description={
              isMultiWriter
                ? "Bring it back to the timeline. Majority yes restores it and re-opens writing (if not finished)."
                : "Only you have written here. Unarchive returns it to the timeline immediately."
            }
            vote={unarchiveVote}
            participants={participants}
            youVoted={youVotedUnarchive}
            onStart={wrapStart(onStartUnarchive)}
            onVote={onVoteUnarchive}
            accent="#16A34A"
            startLabel={isMultiWriter ? "Start unarchive vote" : "Unarchive"}
          />
        )}

        {/* Delete */}
        <VotePanel
          title="Delete this chain"
          icon={<Trash2 size={16} color="#DC2626" />}
          description={
            isMultiWriter
              ? "Permanent removal. Majority yes deletes the chain and clears visibility points from its lines."
              : "Only you have written here. Delete removes it immediately and clears your visibility points from its lines."
          }
          vote={petition}
          participants={participants}
          youVoted={youVotedDelete}
          onStart={wrapStart(onStartDelete)}
          onVote={onVoteDelete}
          accent="#DC2626"
          startLabel={isMultiWriter ? "Start delete vote" : "Delete"}
          requireConfirm
          confirmMessage={
            isMultiWriter
              ? "Deleting a story cannot be undone. Start a delete vote only if you are sure!"
              : "Deleting this story cannot be undone. Are you sure?"
          }
        />

        <button
          type="button"
          onClick={onClose}
          className="chn-btn"
          style={{
            width: "100%",
            padding: "12px 16px",
            borderRadius: 999,
            fontSize: 14,
            fontWeight: 600,
            background: "transparent",
            color: "var(--ink)",
            border: "1px solid var(--border)",
            cursor: "pointer",
            boxSizing: "border-box",
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
}

// ---------- main app ----------


function HelpModal({ onClose }) {
  const sections = HELP_SECTIONS;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        background: "rgba(0,0,0,0.55)",
      }}
      onClick={onClose}
    >
      <div
        className="chn-rise"
        style={{
          width: "100%",
          maxWidth: 440,
          maxHeight: "85vh",
          overflowY: "auto",
          padding: 24,
          borderRadius: 16,
          background: "var(--paper-card)",
          border: "1px solid var(--border)",
          boxSizing: "border-box",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h3 className="chn-display" style={{ fontSize: 20, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
            <HelpCircle size={20} color="#1D9BF0" /> Help
          </h3>
          <button type="button" onClick={onClose} style={{ border: "none", background: "transparent", cursor: "pointer" }}>
            <X size={18} color="#71717A" />
          </button>
        </div>
        <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: "0 0 16px", lineHeight: 1.45 }}>
          Full rules and how each part of Chain Stories works. For quick Q&amp;A, use Guide (chat).
        </p>
        {sections.map((sec) => (
          <div key={sec.title} style={{ marginBottom: 16 }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "#1D9BF0",
                marginBottom: 6,
              }}
            >
              {sec.title}
            </div>
            <p style={{ fontSize: 14, color: "var(--ink)", margin: 0, lineHeight: 1.5 }}>{sec.body}</p>
          </div>
        ))}
        <button
          type="button"
          onClick={onClose}
          className="chn-btn"
          style={{
            width: "100%",
            marginTop: 8,
            padding: "12px 16px",
            borderRadius: 999,
            border: "none",
            background: "var(--btn)",
            color: "var(--btn-ink)",
            fontWeight: 600,
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
}


export default function App() {
  const [profile, setProfile] = useState(null);
  const [view, setView] = useState("lobby"); // lobby | chain
  const [activeChainId, setActiveChainId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showHelp, setShowHelp] = useState(false);
  const [suspendLeft, setSuspendLeft] = useState(() => getSuspensionRemainingMs());
  const [spamWarn, setSpamWarn] = useState(false);
  const spamWarnTimer = useRef(null);

  useEffect(() => {
    (async () => {
      let p = await getJSON("writer-profile", false);
      if (p) {
        p = await migrateProfileName(p);
        setProfile(p);
      }
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (profile) applyThemeToDocument(resolveTheme(profile));
  }, [profile]);

  // Suspension countdown only — no global click sampling (normal use is never spam)
  useEffect(() => {
    const tick = () => setSuspendLeft(getSuspensionRemainingMs());
    tick();
    const id = setInterval(tick, 1000);
    return () => {
      clearInterval(id);
      if (spamWarnTimer.current) clearTimeout(spamWarnTimer.current);
    };
  }, []);

  if (loading) {
    return (
      <div className="chn-root min-h-screen flex items-center justify-center">
        <GlobalStyle />
        <p style={{ color: "var(--ink-soft)" }}>Loading…</p>
      </div>
    );
  }

  if (suspendLeft > 0) {
    const msg = `Suspended — check back in ${formatDuration(suspendLeft)} · Suspended — check back in ${formatDuration(suspendLeft)} · `;
    return (
      <div
        className="chn-root min-h-screen flex flex-col items-center justify-center p-6"
        style={{ background: "var(--paper)" }}
      >
        <GlobalStyle />
        <div className="chn-marquee-track" style={{ width: "100%", maxWidth: 480, marginBottom: 24 }}>
          <div className="chn-marquee-text" style={{ color: "var(--danger)" }}>
            {msg}
            {msg}
          </div>
        </div>
        <p style={{ fontSize: 14, color: "var(--ink-soft)", textAlign: "center", maxWidth: 320, lineHeight: 1.5, margin: 0 }}>
          This device is paused for repeatedly tapping a blocked action after a limit warning.
        </p>
      </div>
    );
  }

  if (!profile) {
    return <ProfileGate onDone={setProfile} />;
  }

  const spamWarnBanner = spamWarn ? (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 200,
        padding: "14px 16px",
        background: "var(--danger)",
        color: "#FFFFFF",
        fontWeight: 700,
        fontSize: 14,
        lineHeight: 1.4,
        textAlign: "center",
        boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
      }}
    >
      Stop spamming! Continuous behaviour will attract a time based ban
    </div>
  ) : null;

  if (view === "chain" && activeChainId) {
    return (
      <>
        {spamWarnBanner}
        <ChainRoom
          profile={profile}
          chainId={activeChainId}
          onBack={() => {
            setView("lobby");
            setActiveChainId(null);
          }}
          onUpdateProfile={setProfile}
          onOpenHelp={() => setShowHelp(true)}
        />
        {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
      </>
    );
  }

  return (
    <>
      {spamWarnBanner}
      <Lobby
        profile={profile}
        onOpenChain={(id) => {
          setActiveChainId(id);
          setView("chain");
        }}
        onUpdateProfile={setProfile}
        onOpenHelp={() => setShowHelp(true)}
      />
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
    </>
  );
}
