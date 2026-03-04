"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface CostDataPoint {
  name: string;
  value: number;
  color?: string;
}

interface CostBreakdownChartProps {
  data: CostDataPoint[];
  title?: string;
}

const COLORS = [
  "#8884d8",
  "#82ca9d",
  "#ffc658",
  "#ff7300",
  "#00C49F",
  "#FFBB28",
  "#FF8042",
  "#0088FE",
];

export function CostBreakdownChart({ data }: CostBreakdownChartProps) {
  const formatCurrency = (value: number) => {
    return `$${value.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  return (
    <div style={{ background: "#FBF8F0", borderRadius: "8px", padding: "8px 4px 4px" }}>
    <ResponsiveContainer width="100%" height={300}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis
          type="number"
          tickFormatter={formatCurrency}
          tick={{ fontSize: 12 }}
          className="text-muted-foreground"
        />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fontSize: 12 }}
          className="text-muted-foreground"
          width={90}
        />
        <Tooltip
          formatter={(value) => [formatCurrency(Number(value)), "Cost"]}
          contentStyle={{
            backgroundColor: "#130F0B",
            borderColor: "#E4E1D8",
            borderRadius: "8px",
            boxShadow: "0 4px 12px rgba(19,15,11,0.2)",
            padding: "8px 12px",
          }}
          labelStyle={{ color: "rgba(251,248,240,0.9)", fontWeight: "500", marginBottom: "4px" }}
          itemStyle={{ color: "#FBF8F0" }}
        />
        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
          {data.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={entry.color || COLORS[index % COLORS.length]}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
    </div>
  );
}
