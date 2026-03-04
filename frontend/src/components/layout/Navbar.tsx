"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { CustomerSelector } from "@/components/filters/CustomerSelector";
import { type CustomerType } from "@/lib/orb";
import { Zap } from "lucide-react";

interface NavbarProps {
  customer: CustomerType;
  onCustomerChange: (customer: CustomerType) => void;
}

const navItems = [
  { href: "/", label: "Dashboard" },
  { href: "/usage", label: "Usage" },
  { href: "/credits", label: "Credits" },
  { href: "/invoices", label: "Invoices" },
  { href: "/manage", label: "Manage" },
];

export function Navbar({ customer, onCustomerChange }: NavbarProps) {
  const pathname = usePathname();

  return (
    <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2 font-bold text-xl">
              <Zap className="h-6 w-6 text-primary" />
              <span>NexusAI</span>
            </Link>
            <div className="hidden md:flex items-center gap-6">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "text-sm font-medium transition-colors hover:text-primary",
                    pathname === item.href
                      ? "text-foreground"
                      : "text-muted-foreground"
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <CustomerSelector value={customer} onChange={onCustomerChange} />
          </div>
        </div>
      </div>
    </nav>
  );
}
