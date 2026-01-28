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

// Generate mock points for a set
function generateMockPoints(homeScore: number, awayScore: number): Point[] {
  const points: Point[] = []
  let currentHome = 0
  let currentAway = 0
  let pointId = 0

  const actionTypes: ActionType[] = ["serve", "spike", "block", "dig", "error", "unknown"]

  // Start with 0-0
  points.push({
    id: `point-${pointId++}`,
    homeScore: 0,
    awayScore: 0,
    scoringTeam: "home",
    actionType: actionTypes[Math.floor(Math.random() * actionTypes.length)],
    timestamp: 0,
  })

  while (currentHome < homeScore || currentAway < awayScore) {
    const homeNeedsPoints = currentHome < homeScore
    const awayNeedsPoints = currentAway < awayScore

    let scoringTeam: "home" | "away"

    if (homeNeedsPoints && awayNeedsPoints) {
      // Randomly decide who scores, weighted towards eventual winner
      const homeRemaining = homeScore - currentHome
      const awayRemaining = awayScore - currentAway
      const homeProb = homeRemaining / (homeRemaining + awayRemaining)
      scoringTeam = Math.random() < homeProb ? "home" : "away"
    } else if (homeNeedsPoints) {
      scoringTeam = "home"
    } else {
      scoringTeam = "away"
    }

    if (scoringTeam === "home") {
      currentHome++
    } else {
      currentAway++
    }

    points.push({
      id: `point-${pointId++}`,
      homeScore: currentHome,
      awayScore: currentAway,
      scoringTeam,
      actionType: actionTypes[Math.floor(Math.random() * actionTypes.length)],
      timestamp: pointId * 30 + Math.floor(Math.random() * 20),
    })
  }

  return points
}

// Mock match data
export const mockMatches: MatchData[] = [
  {
    id: "1",
    homeTeam: "DkIT VC",
    awayTeam: "St. Mary's College",
    date: "2023-11-01",
    homeWins: 3,
    awayWins: 0,
    winner: "home",
    analysisConfidence: 95,
    sets: [
      {
        setNumber: 1,
        homeScore: 25,
        awayScore: 17,
        winner: "home",
        rallies: 42,
        points: generateMockPoints(25, 17),
      },
      {
        setNumber: 2,
        homeScore: 25,
        awayScore: 18,
        winner: "home",
        rallies: 43,
        points: generateMockPoints(25, 18),
      },
      {
        setNumber: 3,
        homeScore: 25,
        awayScore: 17,
        winner: "home",
        rallies: 42,
        points: generateMockPoints(25, 17),
      },
    ],
  },
  {
    id: "2",
    homeTeam: "DkIT VC",
    awayTeam: "Trinity College Dublin",
    date: "2023-11-02",
    homeWins: 3,
    awayWins: 2,
    winner: "home",
    analysisConfidence: 91,
    sets: [
      {
        setNumber: 1,
        homeScore: 25,
        awayScore: 23,
        winner: "home",
        rallies: 48,
        points: generateMockPoints(25, 23),
      },
      {
        setNumber: 2,
        homeScore: 23,
        awayScore: 25,
        winner: "away",
        rallies: 48,
        points: generateMockPoints(23, 25),
      },
      {
        setNumber: 3,
        homeScore: 25,
        awayScore: 21,
        winner: "home",
        rallies: 46,
        points: generateMockPoints(25, 21),
      },
      {
        setNumber: 4,
        homeScore: 20,
        awayScore: 25,
        winner: "away",
        rallies: 45,
        points: generateMockPoints(20, 25),
      },
      {
        setNumber: 5,
        homeScore: 15,
        awayScore: 13,
        winner: "home",
        rallies: 28,
        points: generateMockPoints(15, 13),
      },
    ],
  },
  {
    id: "3",
    homeTeam: "DkIT VC",
    awayTeam: "UCD",
    date: "2023-11-03",
    homeWins: 3,
    awayWins: 0,
    winner: "home",
    analysisConfidence: 97,
    sets: [
      {
        setNumber: 1,
        homeScore: 25,
        awayScore: 15,
        winner: "home",
        rallies: 40,
        points: generateMockPoints(25, 15),
      },
      {
        setNumber: 2,
        homeScore: 25,
        awayScore: 18,
        winner: "home",
        rallies: 43,
        points: generateMockPoints(25, 18),
      },
      {
        setNumber: 3,
        homeScore: 25,
        awayScore: 16,
        winner: "home",
        rallies: 41,
        points: generateMockPoints(25, 16),
      },
    ],
  },
]

export function getMatchById(id: string): MatchData | undefined {
  return mockMatches.find((match) => match.id === id)
}

export function getSetData(matchId: string, setNumber: number): { match: MatchData; set: SetData } | undefined {
  const match = getMatchById(matchId)
  if (!match) return undefined
  const set = match.sets.find((s) => s.setNumber === setNumber)
  if (!set) return undefined
  return { match, set }
}
