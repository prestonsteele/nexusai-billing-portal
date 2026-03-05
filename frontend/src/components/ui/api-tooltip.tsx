"use client";

import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface ApiTooltipProps {
  method: "GET" | "POST" | "DELETE" | "PATCH";
  endpoint: string;
  description: string;
  details?: string;
  align?: "left" | "right";
}

const METHOD_COLORS: Record<string, string> = {
  GET: "bg-blue-100 text-blue-700",
  POST: "bg-green-100 text-green-700",
  DELETE: "bg-red-100 text-red-700",
  PATCH: "bg-yellow-100 text-yellow-700",
};

export function ApiTooltip({
  method,
  endpoint,
  description,
  details,
  align = "left",
}: ApiTooltipProps) {
  return (
    <div className="group relative inline-flex items-center">
      <Info className="h-3.5 w-3.5 cursor-help text-muted-foreground/50 transition-colors group-hover:text-muted-foreground" />
      <div
        className={cn(
          "pointer-events-none invisible absolute top-6 z-50 w-80 rounded-lg border border-white/10 bg-[#130F0B] p-4 opacity-0 shadow-xl transition-opacity group-hover:visible group-hover:opacity-100",
          align === "right" ? "right-0" : "left-0"
        )}
      >
        <div className="mb-2.5 flex items-center gap-2 font-mono text-xs">
          <span
            className={cn(
              "rounded px-1.5 py-0.5 text-[10px] font-bold",
              METHOD_COLORS[method]
            )}
          >
            {method}
          </span>
          <span className="truncate text-[#FBF8F0]/60">{endpoint}</span>
        </div>
        <p className="text-xs leading-relaxed text-[#FBF8F0]/90">{description}</p>
        {details && (
          <p className="mt-2 border-t border-white/10 pt-2 text-xs leading-relaxed text-[#FBF8F0]/55">
            {details}
          </p>
        )}
      </div>
    </div>
  );
}
