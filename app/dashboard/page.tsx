import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Search, Calendar } from "lucide-react";
import { SiteHeader } from "@/components/ui/site-header";
import { SiteFooter } from "@/components/ui/site-footer";

const matches = [
  {
    id: 1,
    title: "DkIT VC vs St. Mary's College",
    date: "2023-11-01",
    description:
      "DkIT VC won 3-0 (25-17, 25-18, 25-17). Strong performance with 95% AI confidence in scoring analysis.",
  },
  {
    id: 2,
    title: "DkIT VC vs Trinity College Dublin",
    date: "2023-11-02",
    description:
      "Close match ending 3-2 (25-23, 23-25, 25-21, 20-25, 15-13). Point-by-point replay available.",
  },
  {
    id: 3,
    title: "DkIT VC vs UCD",
    date: "2023-11-03",
    description:
      "Dominant 3-0 victory (25-15, 25-18, 25-16). Full set breakdowns and highlight reels available.",
  },
  {
    id: 4,
    title: "DkIT VC vs DCU",
    date: "2023-11-05",
    description:
      "Hard-fought 3-1 win (25-20, 22-25, 25-19, 25-17). 92% AI confidence in analysis.",
  },
  {
    id: 5,
    title: "DkIT VC vs IT Carlow",
    date: "2023-11-07",
    description:
      "Competitive 3-2 victory (23-25, 25-22, 25-23, 21-25, 15-12). Rally-by-rally breakdown available.",
  },
  {
    id: 6,
    title: "DkIT VC vs Maynooth University",
    date: "2023-11-10",
    description:
      "Convincing 3-0 win (25-18, 25-20, 25-16). Complete scoring timeline with action types.",
  },
];

export default function DashboardPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader showNav={true} />

      {/* Main Content */}
      <main className="flex-1 bg-gray-50 px-6 py-8">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Search and Filter Section */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="grid md:grid-cols-2 gap-6">
              {/* Search */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-900">
                  Search matches
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="Search by opponent or match details..."
                    className="h-11 pl-10 bg-gray-50 border-gray-200"
                  />
                </div>
              </div>

              {/* Date Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-900">
                  Filter by date
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="Pick a date"
                    className="h-11 pl-10 bg-gray-50 border-gray-200"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Match Cards Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {matches.map((match) => (
              <Card
                key={match.id}
                className="p-6 shadow-sm border-gray-200 flex flex-col"
              >
                <div className="flex-1 space-y-3">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {match.title}
                  </h3>
                  <p className="text-sm text-gray-600">Date: {match.date}</p>
                  <p className="text-sm text-gray-700 leading-relaxed">
                    {match.description}
                  </p>
                </div>
                <Button className="w-full h-11 mt-4 bg-[#0047AB] hover:bg-[#003580] text-white font-medium">
                  View Report
                </Button>
              </Card>
            ))}
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
