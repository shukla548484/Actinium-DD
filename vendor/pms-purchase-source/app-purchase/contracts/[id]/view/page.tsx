"use client";
import { usePageBootstrap } from "@/hooks/use-page-bootstrap";
import { PageReadyGate } from "@/components/page-ready/PageReadyGate";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FileText,
  Edit,
  Calendar,
  DollarSign,
  Building2,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Package,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter, useParams } from "next/navigation";
import { format } from "date-fns";
import Link from "next/link";
import { TablePagination } from "@/components/ui/table-pagination";

interface Contract {
  id: string;
  contractNumber: string;
  contractType: string;
  title: string;
  description: string;
  vendor: {
    id: string;
    name: string;
    vendorId: string;
    primaryEmail: string;
    phone: string;
    country: string;
  };
  startDate: string;
  endDate: string;
  renewalDate: string | null;
  contractValue: number;
  currency: string;
  termsAndConditions: string | null;
  status: string;
  isGlobal: boolean;
  applicableVesselIds: string[];
  notes: string | null;
  createdAt: string;
  createdBy: {
    id: string;
    firstName: string;
    lastName: string;
  };
  approvedBy: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
  contractItems: Array<{
    id: string;
    itemName: string;
    description: string | null;
    unit: string;
    unitPrice: number;
    currency: string;
    minQuantity: number | null;
    maxQuantity: number | null;
    leadTime: number | null;
    notes: string | null;
  }>;
  _count: {
    requisitions: number;
    purchaseOrders: number;
  };
}

export default function ViewContractPage() {
  const { ready, markSuccess } = usePageBootstrap();
  const router = useRouter();
  const params = useParams();
  const contractId = params.id as string;
  const [contract, setContract] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);
  const [itemsPage, setItemsPage] = useState(1);
  const [itemsPageSize] = useState(15);

  useEffect(() => {
    loadContract();
    markSuccess();
  }, [contractId, markSuccess]);

  const loadContract = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/contracts/${contractId}`, {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setContract(data.contract);
      } else {
        toast.error("Failed to load contract");
        router.push("/purchase/contracts");
      }
    } catch (error) {
      console.error("Error loading contract:", error);
      toast.error("Error loading contract");
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; className: string }> = {
      DRAFT: { label: "Draft", className: "bg-muted text-foreground" },
      ACTIVE: { label: "Active", className: "bg-success text-success" },
      EXPIRED: { label: "Expired", className: "bg-destructive text-destructive" },
      TERMINATED: { label: "Terminated", className: "bg-muted text-foreground" },
      PENDING_RENEWAL: { label: "Pending Renewal", className: "bg-warning text-warning" },
      SUSPENDED: { label: "Suspended", className: "bg-warning text-warning" },
    };

    const config = statusConfig[status] || { label: status, className: "bg-muted text-foreground" };
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  const formatCurrency = (amount: number, currency: string = "USD") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 2,
    }).format(amount);
  };
  const contractItems = contract?.contractItems || [];
  const paginatedContractItems = contractItems.slice(
    (itemsPage - 1) * itemsPageSize,
    itemsPage * itemsPageSize
  );

  useEffect(() => {
    setItemsPage(1);
  }, [contract?.id, contract?.contractItems?.length]);

  if (!contract) return null;

  return (<PageReadyGate ready={ready}>
    <div className="space-y-4">
      <main className="mx-auto py-4" style={{ width: "90%", maxWidth: "90vw" }}>
        <div className="mb-6 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link href="/purchase/contracts">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-foreground">{contract.title}</h1>
              <p className="text-foreground mt-1">Contract #{contract.contractNumber}</p>
            </div>
          </div>
          <div className="flex gap-2">
            {getStatusBadge(contract.status)}
            <Link href={`/purchase/contracts/${contractId}/edit`}>
              <Button>
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
            </Link>
          </div>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="items">Contract Items ({contract.contractItems.length})</TabsTrigger>
            <TabsTrigger value="usage">
              Usage ({contract._count.requisitions + contract._count.purchaseOrders})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Basic Information */}
              <Card>
                <CardHeader>
                  <CardTitle>Basic Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Contract Number</p>
                    <p className="font-medium">{contract.contractNumber}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Contract Type</p>
                    <p className="font-medium">{contract.contractType}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <div className="mt-1">{getStatusBadge(contract.status)}</div>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Description</p>
                    <p className="font-medium">{contract.description || "No description"}</p>
                  </div>
                </CardContent>
              </Card>

              {/* Vendor Information */}
              <Card>
                <CardHeader>
                  <CardTitle>Vendor Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Vendor Name</p>
                    <p className="font-medium">{contract.vendor.name}</p>
                    <p className="text-xs text-muted-foreground">{contract.vendor.vendorId}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-medium">{contract.vendor.primaryEmail}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Phone</p>
                    <p className="font-medium">{contract.vendor.phone || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Country</p>
                    <p className="font-medium">{contract.vendor.country}</p>
                  </div>
                </CardContent>
              </Card>

              {/* Dates */}
              <Card>
                <CardHeader>
                  <CardTitle>Dates</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Start Date</p>
                    <p className="font-medium">{format(new Date(contract.startDate), "MMM dd, yyyy")}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">End Date</p>
                    <p className="font-medium">{format(new Date(contract.endDate), "MMM dd, yyyy")}</p>
                  </div>
                  {contract.renewalDate && (
                    <div>
                      <p className="text-sm text-muted-foreground">Renewal Date</p>
                      <p className="font-medium">{format(new Date(contract.renewalDate), "MMM dd, yyyy")}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Financial */}
              <Card>
                <CardHeader>
                  <CardTitle>Financial</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Contract Value</p>
                    <p className="font-medium text-lg">
                      {formatCurrency(contract.contractValue, contract.currency)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Currency</p>
                    <p className="font-medium">{contract.currency}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Scope</p>
                    <p className="font-medium">{contract.isGlobal ? "Global (All Vessels)" : "Specific Vessels"}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Terms & Conditions */}
            {contract.termsAndConditions && (
              <Card>
                <CardHeader>
                  <CardTitle>Terms & Conditions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="prose max-w-none">
                    <p className="whitespace-pre-wrap">{contract.termsAndConditions}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Notes */}
            {contract.notes && (
              <Card>
                <CardHeader>
                  <CardTitle>Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-wrap">{contract.notes}</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="items">
            <Card>
              <CardHeader>
                <CardTitle>Contract Items</CardTitle>
                <CardDescription>{contract.contractItems.length} items in this contract</CardDescription>
              </CardHeader>
              <CardContent>
                {contract.contractItems.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">No items in this contract</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2">Item Name</th>
                          <th className="text-left p-2">Description</th>
                          <th className="text-left p-2">Unit</th>
                          <th className="text-right p-2">Unit Price</th>
                          <th className="text-left p-2">Min Qty</th>
                          <th className="text-left p-2">Max Qty</th>
                          <th className="text-left p-2">Lead Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedContractItems.map((item) => (
                          <tr key={item.id} className="border-b">
                            <td className="p-2 font-medium">{item.itemName}</td>
                            <td className="p-2 text-sm text-foreground">{item.description || "-"}</td>
                            <td className="p-2">{item.unit}</td>
                            <td className="p-2 text-right">
                              {formatCurrency(item.unitPrice, item.currency)}
                            </td>
                            <td className="p-2">{item.minQuantity || "-"}</td>
                            <td className="p-2">{item.maxQuantity || "-"}</td>
                            <td className="p-2">{item.leadTime ? `${item.leadTime} days` : "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {contractItems.length > 0 && (
                  <TablePagination
                    page={itemsPage}
                    pageSize={itemsPageSize}
                    total={contractItems.length}
                    onPageChange={setItemsPage}
                    itemLabel="items"
                    className="mt-4"
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="usage">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Requisitions</CardTitle>
                  <CardDescription>{contract._count.requisitions} requisitions using this contract</CardDescription>
                </CardHeader>
                <CardContent>
                  <Link href={`/purchase/view-requisitions?contractId=${contractId}`}>
                    <Button variant="outline">View Requisitions</Button>
                  </Link>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Purchase Orders</CardTitle>
                  <CardDescription>{contract._count.purchaseOrders} purchase orders using this contract</CardDescription>
                </CardHeader>
                <CardContent>
                  <Link href={`/purchase/view-pos?contractId=${contractId}`}>
                    <Button variant="outline">View Purchase Orders</Button>
                  </Link>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
        </PageReadyGate>
  );
}







