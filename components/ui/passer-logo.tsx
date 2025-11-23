export function PasserLogo({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={`${className} bg-white rounded-full flex items-center justify-center`}
      >
        <svg
          viewBox="0 0 24 24"
          className="w-4 h-4"
          fill="none"
          stroke="#0047AB"
          strokeWidth="2.5"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 3v18M3 12h18" />
        </svg>
      </div>
      <span className="text-white font-semibold text-lg">Passer</span>
    </div>
  );
}
