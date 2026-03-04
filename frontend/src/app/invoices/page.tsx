"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format, parseISO } from "date-fns";
import { Download, FileText, ExternalLink } from "lucide-react";

interface Invoice {
  id: string;
  invoice_number: string;
  status: string;
  total: string;
  subtotal: string;
  amount_due: string;
  created_at: string;
  due_date: string | null;
  invoice_pdf: string | null;
  currency: string;
  customer: {
    id: string;
    external_customer_id: string;
    name: string;
  };
  line_items: {
    id: string;
    name: string;
    quantity: number;
    subtotal: string;
    amount: string;
    credits_applied: string;
    start_date: string;
    end_date: string;
    grouping?: string;
    price?: {
      name: string;
      billable_metric?: {
        name: string;
      };
    };
    sub_line_items?: {
      name: string;
      quantity: number;
      amount: string;
      grouping?: {
        key: string;
        value: string;
      };
    }[];
  }[];
  credit_notes?: {
    id: string;
    credit_note_number: string;
    total: string;
    reason: string;
  }[];
}

export default function InvoicesPage() {
  const { customerId } = useApp();
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  // Fetch invoices
  useEffect(() => {
    async function fetchInvoices() {
      setLoading(true);
      try {
        const res = await fetch(`/api/customer/${customerId}/invoices`);
        const data = await res.json();
        setInvoices(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Failed to fetch invoices:", error);
      }
      setLoading(false);
    }

    fetchInvoices();
  }, [customerId]);

  // Fetch invoice details
  const fetchInvoiceDetails = async (invoiceId: string) => {
    try {
      const res = await fetch(`/api/invoices/${invoiceId}`);
      const data = await res.json();
      setSelectedInvoice(data);
    } catch (error) {
      console.error("Failed to fetch invoice details:", error);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return <Badge className="bg-green-100 text-green-800">Paid</Badge>;
      case "issued":
        return <Badge className="bg-yellow-100 text-yellow-800">Unpaid</Badge>;
      case "draft":
        return <Badge className="bg-gray-100 text-gray-800">Draft</Badge>;
      case "void":
        return <Badge className="bg-red-100 text-red-800">Void</Badge>;
      case "synced":
        return <Badge className="bg-purple-100 text-purple-800">Synced</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatCurrency = (amount: string, currency: string = "USD") => {
    const num = parseFloat(amount);
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(num);
  };

  // Summary calculations
  const totalPaid = invoices
    .filter((inv) => inv.status === "paid")
    .reduce((sum, inv) => sum + parseFloat(inv.total || "0"), 0);

  const totalOutstanding = invoices
    .filter((inv) => inv.status === "issued")
    .reduce((sum, inv) => sum + parseFloat(inv.amount_due || "0"), 0);

  const draftCount = invoices.filter((inv) => inv.status === "draft").length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Invoices</h1>
        <p className="text-muted-foreground">
          View and download your billing invoices
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Invoices
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{invoices.length}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Paid
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(totalPaid.toString())}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Unpaid
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold text-yellow-600">
                {formatCurrency(totalOutstanding.toString())}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Draft
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold text-gray-500">
                {draftCount}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Invoice List */}
        <Card>
          <CardHeader>
            <CardTitle>Invoice History</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[400px] w-full" />
            ) : invoices.length > 0 ? (
              <div className="space-y-2">
                {invoices.map((invoice) => (
                  <div
                    key={invoice.id}
                    className={`flex items-center justify-between p-4 rounded-lg border cursor-pointer transition-colors hover:bg-muted/50 ${
                      selectedInvoice?.id === invoice.id
                        ? "bg-muted border-primary"
                        : ""
                    }`}
                    onClick={() => fetchInvoiceDetails(invoice.id)}
                  >
                    <div className="flex items-center gap-4">
                      <FileText className="h-8 w-8 text-muted-foreground" />
                      <div>
                        <div className="font-medium">
                          {invoice.invoice_number || `INV-${invoice.id.slice(0, 8)}`}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {format(parseISO(invoice.created_at), "MMM d, yyyy")}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="font-medium">
                          {formatCurrency(invoice.total, invoice.currency)}
                        </div>
                        {getStatusBadge(invoice.status)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex h-[400px] items-center justify-center text-muted-foreground">
                No invoices found
              </div>
            )}
          </CardContent>
        </Card>

        {/* Invoice Detail */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Invoice Details</CardTitle>
            {selectedInvoice?.invoice_pdf && (
              <Button size="sm" variant="outline" asChild>
                <a
                  href={selectedInvoice.invoice_pdf}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download PDF
                </a>
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {selectedInvoice ? (
              <div className="space-y-6">
                {/* Invoice Header */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-muted-foreground">
                      Invoice Number
                    </div>
                    <div className="font-medium">
                      {selectedInvoice.invoice_number ||
                        `INV-${selectedInvoice.id.slice(0, 8)}`}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Status</div>
                    <div>{getStatusBadge(selectedInvoice.status)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">
                      Issue Date
                    </div>
                    <div className="font-medium">
                      {format(
                        parseISO(selectedInvoice.created_at),
                        "MMM d, yyyy"
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Due Date</div>
                    <div className="font-medium">
                      {selectedInvoice.due_date
                        ? format(
                            parseISO(selectedInvoice.due_date),
                            "MMM d, yyyy"
                          )
                        : "N/A"}
                    </div>
                  </div>
                </div>

                {/* Line Items */}
                {selectedInvoice.line_items &&
                  selectedInvoice.line_items.length > 0 && (
                    <div>
                      <div className="text-sm font-medium mb-2">Line Items</div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Description</TableHead>
                            <TableHead className="text-right">Usage</TableHead>
                            <TableHead className="text-right">Subtotal</TableHead>
                            <TableHead className="text-right">Credits</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedInvoice.line_items.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell className="max-w-[180px]">
                                <div className="font-medium truncate">
                                  {item.name}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {format(parseISO(item.start_date), "MMM d")} -{" "}
                                  {format(parseISO(item.end_date), "MMM d, yyyy")}
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                {item.quantity.toLocaleString()}
                              </TableCell>
                              <TableCell className="text-right text-muted-foreground">
                                {formatCurrency(
                                  item.subtotal,
                                  selectedInvoice.currency
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                {parseFloat(item.credits_applied || "0") > 0 ? (
                                  <span className="text-green-600">
                                    -{formatCurrency(
                                      item.credits_applied,
                                      selectedInvoice.currency
                                    )}
                                  </span>
                                ) : (
                                  "-"
                                )}
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                {formatCurrency(
                                  item.amount,
                                  selectedInvoice.currency
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                {/* Totals */}
                <div className="border-t pt-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>
                      {formatCurrency(
                        selectedInvoice.subtotal,
                        selectedInvoice.currency
                      )}
                    </span>
                  </div>
                  {(() => {
                    const totalCredits = selectedInvoice.line_items?.reduce(
                      (sum, item) => sum + parseFloat(item.credits_applied || "0"),
                      0
                    ) || 0;
                    return totalCredits > 0 ? (
                      <div className="flex justify-between text-green-600">
                        <span>Credits Applied</span>
                        <span>
                          -{formatCurrency(
                            totalCredits.toString(),
                            selectedInvoice.currency
                          )}
                        </span>
                      </div>
                    ) : null;
                  })()}
                  <div className="flex justify-between font-bold text-lg">
                    <span>Total</span>
                    <span>
                      {formatCurrency(
                        selectedInvoice.total,
                        selectedInvoice.currency
                      )}
                    </span>
                  </div>
                  {parseFloat(selectedInvoice.amount_due) > 0 && (
                    <div className="flex justify-between text-orange-600">
                      <span>Amount Due</span>
                      <span>
                        {formatCurrency(
                          selectedInvoice.amount_due,
                          selectedInvoice.currency
                        )}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex h-[400px] items-center justify-center text-muted-foreground">
                Select an invoice to view details
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
