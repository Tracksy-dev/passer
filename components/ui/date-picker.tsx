"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Calendar as CalendarIcon, ChevronDown, X } from "lucide-react";
import { DayPicker } from "react-day-picker";
import { cn } from "@/lib/utils";

interface DatePickerProps {
  value: string;
  onChange: (date: string) => void;
  placeholder?: string;
  className?: string;
  showIcon?: boolean;
  required?: boolean;
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  className = "",
  showIcon = false,
  required = false,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [month, setMonth] = React.useState<Date>(new Date());
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const [dropdownPos, setDropdownPos] = React.useState({ top: 0, left: 0 });

  const parseIsoDate = React.useCallback((iso: string): Date | undefined => {
    if (!iso) return undefined;
    const [yearStr, monthStr, dayStr] = iso.split("-");
    const year = Number(yearStr);
    const monthNum = Number(monthStr);
    const day = Number(dayStr);
    if (!year || !monthNum || !day) return undefined;
    return new Date(year, monthNum - 1, day);
  }, []);

  const toIsoDate = React.useCallback((date: Date): string => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }, []);

  const selectedDate = React.useMemo(
    () => parseIsoDate(value),
    [parseIsoDate, value],
  );

  React.useEffect(() => {
    if (selectedDate) {
      setMonth(selectedDate);
    }
  }, [selectedDate]);

  React.useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const formatDisplayDate = (dateString: string) => {
    if (!dateString) return "";
    const date = parseIsoDate(dateString);
    if (!date) return "";
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const handleSelect = (date: Date | undefined) => {
    if (!date) return;
    onChange(toIsoDate(date));
    setOpen(false);
  };

  const handleClear = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    onChange("");
    setOpen(false);
  };

  const displayValue = value ? formatDisplayDate(value) : "";

  return (
    <div className={cn("relative", className)}>
      {showIcon && (
        <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#4a6e97] pointer-events-none z-10" />
      )}

      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          if (!open && triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            setDropdownPos({
              top: rect.bottom + window.scrollY + 8,
              left: rect.left + window.scrollX,
            });
          }
          setOpen((prev) => !prev);
        }}
        className={cn(
          "h-11 w-full rounded-lg border border-[#c7daf4] bg-white/78 pr-10 text-left text-sm shadow-sm backdrop-blur-md transition-colors",
          "hover:border-[#69a3e6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1B7CFF]/30",
          showIcon ? "pl-10" : "pl-3.5",
          displayValue ? "text-[#153f74]" : "text-[#6a86a8]",
        )}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        {displayValue || placeholder}
      </button>

      {value && !required ? (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-8 top-1/2 -translate-y-1/2 rounded-full p-1 text-[#6a86a8] hover:bg-[#e8f2ff] hover:text-[#1d4e8f]"
          aria-label="Clear date"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      ) : null}

      <ChevronDown
        className={cn(
          "absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6a86a8] transition-transform",
          open && "rotate-180",
        )}
      />

      {open ? createPortal(
        <div
          style={{ position: "absolute", top: dropdownPos.top, left: dropdownPos.left }}
          className="z-[9999] w-[21rem] max-w-[calc(100vw-2rem)] rounded-2xl border border-[#9fc1e8] bg-white p-3 shadow-[0_24px_50px_-28px_rgba(0,71,171,0.95)]"
        >
          <DayPicker
            mode="single"
            required={required}
            month={month}
            onMonthChange={setMonth}
            selected={selectedDate}
            onSelect={handleSelect}
            showOutsideDays
            weekStartsOn={1}
            classNames={{
              root: "w-full",
              months: "w-full",
              month: "space-y-3",
              caption: "relative flex items-center justify-center px-8",
              caption_label:
                "text-sm font-semibold tracking-tight text-[#153f74]",
              nav: "absolute inset-y-0 left-0 right-0 flex items-center justify-between pointer-events-none",
              button_previous:
                "h-8 w-8 rounded-lg border border-[#b8d0ef] bg-white/90 text-[#1f4f88] hover:bg-[#e8f2ff] pointer-events-auto",
              button_next:
                "h-8 w-8 rounded-lg border border-[#b8d0ef] bg-white/90 text-[#1f4f88] hover:bg-[#e8f2ff] pointer-events-auto",
              month_grid: "w-full border-collapse",
              weekdays: "grid grid-cols-7",
              weekday:
                "text-center text-[11px] font-semibold uppercase tracking-[0.08em] text-[#7693b7]",
              week: "mt-1 grid grid-cols-7",
              day: "p-0.5",
              today: "[&>button]:border [&>button]:border-[#69a3e6]",
              outside: "text-[#aec3dc]",
              selected:
                "[&>button]:bg-[linear-gradient(120deg,#0047AB,#1B7CFF)] [&>button]:text-white [&>button]:shadow-[0_12px_22px_-18px_rgba(0,71,171,0.95)]",
              day_button:
                "h-9 w-full rounded-lg text-sm font-medium text-[#1f4f88] transition-colors hover:bg-[#e8f2ff]",
              disabled: "opacity-30",
              hidden: "invisible",
            }}
          />

          <div className="mt-3 flex items-center justify-between border-t border-[#dce8f8] pt-3">
            <button
              type="button"
              onClick={() => {
                const today = new Date();
                onChange(toIsoDate(today));
                setMonth(today);
                setOpen(false);
              }}
              className="text-xs font-medium text-[#0b4a97] hover:underline"
            >
              Select today
            </button>
            {!required ? (
              <button
                type="button"
                onClick={(event) => handleClear(event)}
                className="text-xs font-medium text-[#6a86a8] hover:text-[#1f4f88]"
              >
                Clear
              </button>
            ) : (
              <span className="text-xs text-[#8aa4c4]">Required</span>
            )}
          </div>
        </div>,
        document.body,
      ) : null}
    </div>
  );
}
