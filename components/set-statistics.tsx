interface SetStatisticsProps {
  totalRallies: number;
  homeTeam: string;
  awayTeam: string;
  homePoints: number;
  awayPoints: number;
  analysisConfidence: number;
}

export function SetStatistics({
  totalRallies,
  homeTeam,
  awayTeam,
  homePoints,
  awayPoints,
  analysisConfidence,
}: SetStatisticsProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">
        Set Statistics
      </h3>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Total Rallies:</span>
          <span className="text-sm font-medium text-gray-900">
            {totalRallies}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">{homeTeam} Points:</span>
          <span className="text-sm font-medium text-[#0047AB]">
            {homePoints}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">{awayTeam} Points:</span>
          <span className="text-sm font-medium text-[#F5A623]">
            {awayPoints}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Analysis Confidence:</span>
          <span className="text-sm font-medium text-[#22C55E]">
            {analysisConfidence}%
          </span>
        </div>
      </div>
    </div>
  );
}
