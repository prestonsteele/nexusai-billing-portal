"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { format, parseISO } from "date-fns";

interface UsageDataPoint {
  date: string;
  [key: string]: string | number;
}

interface UsageChartProps {
  data: UsageDataPoint[];
  dataKeys: string[];
  colors?: string[];
  title?: string;
  yAxisLabel?: string;
  units?: Record<string, string>; // Map of metric name to unit label
}

const DEFAULT_COLORS = [
  "#8884d8",
  "#82ca9d",
  "#ffc658",
  "#ff7300",
  "#00C49F",
  "#FFBB28",
  "#FF8042",
  "#0088FE",
];

export function UsageChart({
  data,
  dataKeys,
  colors = DEFAULT_COLORS,
  yAxisLabel = "Usage",
  units = {},
}: UsageChartProps) {
  // Sanitize key for use in SVG gradient IDs (remove spaces and special chars)
  const sanitizeId = (key: string) => key.replace(/[^a-zA-Z0-9]/g, "_");

  const formatXAxis = (tickItem: string) => {
    try {
      return format(parseISO(tickItem), "MMM d");
    } catch {
      return tickItem;
    }
  };

  const formatTooltipLabel = (label: unknown) => {
    try {
      return format(parseISO(String(label)), "MMM d, yyyy");
    } catch {
      return String(label);
    }
  };

  const formatYAxis = (value: number) => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K`;
    }
    return value.toString();
  };

  // Custom tooltip formatter that includes units
  const formatTooltipValue = (value: number | undefined, name: string | undefined) => {
    const formattedValue = Number(value || 0).toLocaleString();
    const unit = name ? (units[name] || "") : "";
    return [`${formattedValue} ${unit}`.trim(), name || ""];
  };

  return (
    <div style={{ background: "#FBF8F0", borderRadius: "8px", padding: "8px 4px 4px" }}>
    <ResponsiveContainer width="100%" height={350}>
      <AreaChart
        data={data}
        margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
      >
        <defs>
          {dataKeys.map((key, index) => (
            <linearGradient
              key={key}
              id={`color${sanitizeId(key)}`}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop
                offset="5%"
                stopColor={colors[index % colors.length]}
                stopOpacity={0.3}
              />
              <stop
                offset="95%"
                stopColor={colors[index % colors.length]}
                stopOpacity={0.05}
              />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis
          dataKey="date"
          tickFormatter={formatXAxis}
          tick={{ fontSize: 12 }}
          className="text-muted-foreground"
        />
        <YAxis
          tickFormatter={formatYAxis}
          tick={{ fontSize: 12 }}
          className="text-muted-foreground"
          label={{
            value: yAxisLabel,
            angle: -90,
            position: "insideLeft",
            style: { textAnchor: "middle", fontSize: 12 },
          }}
        />
        <Tooltip
          labelFormatter={formatTooltipLabel}
          formatter={formatTooltipValue}
          contentStyle={{
            backgroundColor: "#130F0B",
            borderColor: "#E4E1D8",
            borderRadius: "8px",
            boxShadow: "0 4px 12px rgba(19,15,11,0.2)",
            padding: "8px 12px",
          }}
          labelStyle={{
            color: "rgba(251,248,240,0.9)",
            fontWeight: "500",
            marginBottom: "4px",
          }}
          itemStyle={{
            color: "#FBF8F0",
          }}
        />
        {dataKeys.length > 1 && <Legend />}
        {dataKeys.map((key, index) => (
          <Area
            key={key}
            type="linear"
            dataKey={key}
            stroke={colors[index % colors.length]}
            fillOpacity={1}
            fill={`url(#color${sanitizeId(key)})`}
            stackId={dataKeys.length > 1 ? "1" : undefined}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
    </div>
  );
}
