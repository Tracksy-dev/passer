export function PasserIcon({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const sizeClasses = {
    sm: "w-16 h-16",
    md: "w-24 h-24",
    lg: "w-32 h-32",
  };

  const iconSizes = {
    sm: "w-8 h-8",
    md: "w-12 h-12",
    lg: "w-16 h-16",
  };

  return (
    <div
      className={`${sizeClasses[size]} rounded-2xl bg-gradient-to-br from-[#4169B8] via-[#5F7FBF] to-[#E8A550] flex items-center justify-center shadow-lg`}
    >
      <svg
        viewBox="0 0 24 24"
        className={iconSizes[size]}
        fill="none"
        stroke="white"
        strokeWidth="2"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 3v18M3 12h18" />
      </svg>
    </div>
  );
}
