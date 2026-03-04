"use client";

import { useState, useEffect, createContext, useContext, type ReactNode } from "react";
import { Navbar } from "./Navbar";
import { CUSTOMERS, type CustomerType } from "@/lib/orb";

interface AppContextType {
  customer: CustomerType;
  customerId: string;
  setCustomer: (customer: CustomerType) => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within AppShell");
  }
  return context;
}

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [customer, setCustomer] = useState<CustomerType>("PLG");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Load saved customer preference
    const saved = localStorage.getItem("selectedCustomer") as CustomerType;
    if (saved && (saved === "PLG" || saved === "ENTERPRISE")) {
      setCustomer(saved);
    }
  }, []);

  const handleCustomerChange = (newCustomer: CustomerType) => {
    setCustomer(newCustomer);
    localStorage.setItem("selectedCustomer", newCustomer);
  };

  if (!mounted) {
    return null;
  }

  return (
    <AppContext.Provider
      value={{
        customer,
        customerId: CUSTOMERS[customer],
        setCustomer: handleCustomerChange,
      }}
    >
      <div className="min-h-screen bg-background">
        <Navbar customer={customer} onCustomerChange={handleCustomerChange} />
        <main className="container mx-auto px-4 py-8">{children}</main>
      </div>
    </AppContext.Provider>
  );
}
