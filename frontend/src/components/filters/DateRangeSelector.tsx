"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type DateRangeOption = "7d" | "30d" | "60d" | "90d";

interface DateRangeSelectorProps {
  value: DateRangeOption;
  onChange: (value: DateRangeOption) => void;
}

export function getDateRange(range: DateRangeOption): {
  timeframeStart: string;
  timeframeEnd: string;
} {
  const days = { "7d": 7, "30d": 30, "60d": 60, "90d": 90 }[range];

  const start = new Date();
  start.setUTCDate(start.getUTCDate() - days);
  start.setUTCHours(0, 0, 0, 0);

  const end = new Date();
  end.setUTCHours(23, 59, 59, 999);

  return {
    timeframeStart: start.toISOString(), // e.g. "2026-02-02T00:00:00.000Z"
    timeframeEnd: end.toISOString(),     // e.g. "2026-03-04T23:59:59.999Z"
  };
}

export function DateRangeSelector({ value, onChange }: DateRangeSelectorProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">Period:</span>
      <Select value={value} onValueChange={(v) => onChange(v as DateRangeOption)}>
        <SelectTrigger className="w-[140px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="7d">Last 7 days</SelectItem>
          <SelectItem value="30d">Last 30 days</SelectItem>
          <SelectItem value="60d">Last 60 days</SelectItem>
          <SelectItem value="90d">Last 90 days</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
