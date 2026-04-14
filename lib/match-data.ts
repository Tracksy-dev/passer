export const actionTypeColors: Record<ActionType, string> = {
  serve: "#22C55E", // Green
  spike: "#EF4444", // Red
  block: "#3B82F6", // Blue
  dig: "#A855F7", // Purple
  error: "#F97316", // Orange
  unknown: "#9CA3AF", // Gray
}
// Action types for volleyball points
type ActionType =
  | "serve"
  | "spike"
  | "block"
  | "dig"
  | "error"
  | "unknown";
