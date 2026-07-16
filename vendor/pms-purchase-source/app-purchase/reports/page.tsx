"use client";
import { usePageBootstrap } from "@/hooks/use-page-bootstrap";
import { PageReadyGate } from "@/components/page-ready/PageReadyGate";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FileText,
  Download,
  BarChart3,
  TrendingUp,
  Ship,
} from "lucide-react";
import { toast } from "sonner";
import { useVessels } from "@/hooks/useStaticData";

export default function PurchaseReportsPage() {
  const { ready, markSuccess } = usePageBootstrap();
  
  // Use optimized hooks for static data with caching
  const { data: vessels = [], isLoading: vesselsLoading } = useVessels({ limit: 100, isActive: true });
  
  const [selectedPeriod, setSelectedPeriod] = useState<string>("month");
  const [selectedVessel, setSelectedVessel] = useState<string>("all");

  // Initialize page once static data is loaded
  useEffect(() => {
    if (!vesselsLoading) {
      markSuccess();
    }
  }, [vesselsLoading, markSuccess]);

  const handleGenerateReport = async (reportType: string) => {
    try {
      const response = await fetch("/api/purchase/reports/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          reportType,
          period: selectedPeriod,
          vesselId: selectedVessel !== "all" ? selectedVessel : null,
        }),
      });

      if (response.ok) {
        toast.success("Report generated successfully");
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to generate report");
      }
    } catch (error) {
      toast.error("Failed to generate report");
    }
  };

  return (<PageReadyGate ready={ready}>
    <div className="space-y-4">
      <main className="mx-auto py-4" style={{ width: "90%", maxWidth: "90vw" }}>
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Purchase Reports</h1>
            <p className="text-foreground mt-1">Generate and view purchase reports</p>
          </div>
          <div className="flex gap-2">
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="month">This Month</SelectItem>
                <SelectItem value="quarter">This Quarter</SelectItem>
                <SelectItem value="year">This Year</SelectItem>
                <SelectItem value="all">All Time</SelectItem>
              </SelectContent>
            </Select>
            <Select value={selectedVessel} onValueChange={setSelectedVessel}>
              <SelectTrigger className="w-64" width="vessel">
                <SelectValue placeholder="Select vessel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Vessels</SelectItem>
                {vessels.map((vessel) => (
                  <SelectItem key={vessel.id} value={vessel.id}>
                    {vessel.name} ({vessel.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Requisition Report</CardTitle>
              <CardDescription>Summary of all requisitions</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => handleGenerateReport("REQUISITION")}
                className="w-full"
              >
                <FileText className="h-4 w-4 mr-2" />
                Generate Report
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Purchase Order Report</CardTitle>
              <CardDescription>All purchase orders summary</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => handleGenerateReport("PURCHASE_ORDER")}
                className="w-full"
              >
                <FileText className="h-4 w-4 mr-2" />
                Generate Report
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Vendor Performance</CardTitle>
              <CardDescription>Vendor performance analysis</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => handleGenerateReport("VENDOR_PERFORMANCE")}
                className="w-full"
              >
                <BarChart3 className="h-4 w-4 mr-2" />
                Generate Report
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Spending Analysis</CardTitle>
              <CardDescription>Detailed spending breakdown</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => handleGenerateReport("SPENDING_ANALYSIS")}
                className="w-full"
              >
                <TrendingUp className="h-4 w-4 mr-2" />
                Generate Report
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
        </PageReadyGate>
  );
}




