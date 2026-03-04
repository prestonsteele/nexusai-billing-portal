"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CUSTOMERS, type CustomerType } from "@/lib/orb";

interface CustomerSelectorProps {
  value: CustomerType;
  onChange: (value: CustomerType) => void;
}

const CUSTOMER_LABELS: Record<CustomerType, string> = {
  PLG: "Acme Startup (PLG)",
  ENTERPRISE: "Global Corp (Enterprise)",
};

export function CustomerSelector({ value, onChange }: CustomerSelectorProps) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as CustomerType)}>
      <SelectTrigger className="w-[250px]">
        <SelectValue placeholder="Select customer" />
      </SelectTrigger>
      <SelectContent>
        {(Object.keys(CUSTOMERS) as CustomerType[]).map((key) => (
          <SelectItem key={key} value={key}>
            {CUSTOMER_LABELS[key]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
