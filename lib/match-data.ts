// Action types for volleyball points
export type ActionType = "serve" | "spike" | "block" | "dig" | "error" | "unknown"

// Point data structure
export interface Point {
  id: string
  homeScore: number
  awayScore: number
  scoringTeam: "home" | "away"
  actionType: ActionType
  timestamp: number // Video timestamp in seconds
  note?: string | null
}

// Set data structure
export interface SetData {
  setNumber: number
  homeScore: number
  awayScore: number
  winner: "home" | "away"
  rallies: number
  points: Point[]
}

// Match data structure
export interface MatchData {
  id: string
  homeTeam: string
  awayTeam: string
  date: string
  homeWins: number
  awayWins: number
  winner: "home" | "away"
  sets: SetData[]
  analysisConfidence: number
}

// Action type colors
export const actionTypeColors: Record<ActionType, string> = {
  serve: "#22C55E", // Green
  spike: "#EF4444", // Red
  block: "#3B82F6", // Blue
  dig: "#A855F7", // Purple
  error: "#F97316", // Orange
  unknown: "#9CA3AF", // Gray
}

export type HighlightActionType = "spike" | "set" | "block" | "pass" | "ace" | "save" | "other";

export const highlightActionColors: Record<HighlightActionType, string> = {
  spike: "#EF4444",
  set:   "#8B5CF6",
  block: "#3B82F6",
  pass:  "#22C55E",
  ace:   "#F59E0B",
  save:  "#06B6D4",
  other: "#6B7280",
};




