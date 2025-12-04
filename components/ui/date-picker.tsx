"use client";

import * as React from "react";
import { Calendar as CalendarIcon } from "lucide-react";
import { Input } from "@/components/ui/input";

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
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleContainerClick = () => {
    inputRef.current?.showPicker();
  };

  const formatDisplayDate = (dateString: string) => {
    if (!dateString) return "";
    const date = new Date(dateString + "T00:00:00");
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <div className={`relative ${className}`} onClick={handleContainerClick}>
      {showIcon && (
        <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none z-10" />
      )}
      <div className="relative">
        <Input
          ref={inputRef}
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          className={`h-11 bg-gray-50 border-gray-200 cursor-pointer hover:border-[#0047AB] focus:border-[#0047AB] transition-colors
            ${showIcon ? "pl-10" : ""}
            text-transparent
            [&::-webkit-calendar-picker-indicator]:absolute
            [&::-webkit-calendar-picker-indicator]:inset-0
            [&::-webkit-calendar-picker-indicator]:w-full
            [&::-webkit-calendar-picker-indicator]:h-full
            [&::-webkit-calendar-picker-indicator]:opacity-0
            [&::-webkit-calendar-picker-indicator]:cursor-pointer
            [&::-webkit-inner-spin-button]:hidden
            [&::-webkit-clear-button]:hidden
          `}
        />
        {!value && (
          <span
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none"
            style={{ left: showIcon ? "2.5rem" : "0.75rem" }}
          >
            {placeholder}
          </span>
        )}
        {value && (
          <span
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-900 pointer-events-none"
            style={{ left: showIcon ? "2.5rem" : "0.75rem" }}
          >
            {formatDisplayDate(value)}
          </span>
        )}
      </div>
    </div>
  );
}
