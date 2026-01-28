import { actionTypeColors, type ActionType } from "@/lib/match-data";

const actionTypes: { type: ActionType; label: string }[] = [
  { type: "serve", label: "Serve" },
  { type: "spike", label: "Spike" },
  { type: "block", label: "Block" },
  { type: "dig", label: "Dig" },
  { type: "error", label: "Error" },
  { type: "unknown", label: "Unknown" },
];

export function ActionLegend() {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">
        Action Types Legend
      </h3>
      <div className="grid grid-cols-2 gap-4">
        {actionTypes.map(({ type, label }) => (
          <div key={type} className="flex items-center gap-3">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: actionTypeColors[type] }}
            />
            <span className="text-sm text-gray-700">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
