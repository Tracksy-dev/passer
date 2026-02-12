import { actionTypeColors } from "@/lib/match-data";

type LegendItem = {
  keyLabel?: string; // keyboard key to show (eg. "1")
  label: string;
  color?: string;
};

export function ActionLegend({ items }: { items?: LegendItem[] }) {
  const defaults: LegendItem[] = [
    { label: "Serve", color: actionTypeColors.serve },
    { label: "Spike", color: actionTypeColors.spike },
    { label: "Block", color: actionTypeColors.block },
    { label: "Dig", color: actionTypeColors.dig },
    { label: "Error", color: actionTypeColors.error },
    { label: "Unknown", color: actionTypeColors.unknown },
  ];

  const showItems = items ?? defaults;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h4 className="text-sm font-semibold text-gray-900 mb-3">Hotkeys</h4>
      <div className="grid grid-cols-2 gap-3">
        {showItems.map((it, i) => (
          <div key={`${it.label}-${i}`} className="flex items-center gap-3">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: it.color ?? "#9CA3AF" }}
            />
            <div className="flex items-baseline gap-2">
              <span className="text-sm text-gray-700">{it.label}</span>
              {it.keyLabel && (
                <span className="text-xs text-gray-500">— {it.keyLabel}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
