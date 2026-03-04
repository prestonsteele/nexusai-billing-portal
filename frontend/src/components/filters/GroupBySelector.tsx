"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GROUPING_KEYS, type GroupingKey } from "@/lib/orb";

interface GroupBySelectorProps {
  value: GroupingKey | "none";
  onChange: (value: GroupingKey | "none") => void;
  availableKeys?: GroupingKey[];
  label?: string;
}

const KEY_LABELS: Record<GroupingKey, string> = {
  region: "Region",
  agent_type: "Agent Type",
  model: "Model",
  storage_tier: "Storage Tier",
  instance_type: "Instance Type",
  department: "Department",
};

export function GroupBySelector({
  value,
  onChange,
  availableKeys,
  label = "Group by",
}: GroupBySelectorProps) {
  const keys = availableKeys || (Object.keys(GROUPING_KEYS) as GroupingKey[]);

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">{label}:</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Select grouping" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">None</SelectItem>
          {keys.map((key) => (
            <SelectItem key={key} value={key}>
              {KEY_LABELS[key]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
