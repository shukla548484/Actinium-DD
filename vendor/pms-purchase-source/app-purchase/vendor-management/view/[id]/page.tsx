"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageReadyGate } from "@/components/page-ready/PageReadyGate";
import { usePageBootstrap } from "@/hooks/use-page-bootstrap";
import { ArrowLeft, Store, Edit, Mail, Phone, MapPin, Star, AlertTriangle, CheckCircle, XCircle, Globe } from "lucide-react";
import { toast } from "sonner";
import { Vendor } from "@/lib/types/vendor";
import { SERVICE_TYPE_LABELS } from "@/lib/types/vendor";
import { VendorVerificationPanel } from "@/components/vendor/VendorVerificationPanel";

export default function ViewVendorPage() {
  const router = useRouter();
  const params = useParams();
  const vendorId = params?.id as string;
  const { ready, markSuccess } = usePageBootstrap();
  
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [accessLevel, setAccessLevel] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const loadVendor = async () => {
    if (!vendorId) {
      toast.error("Vendor ID is required");
      router.push("/purchase/vendor-management");
      return;
    }

    try {
      setLoading(true);
      const [vendorRes, userRes] = await Promise.all([
        fetch(`/api/vendors/${vendorId}`, { credentials: "include" }),
        fetch("/api/auth/me", { credentials: "include" }),
      ]);

      if (!vendorRes.ok) {
        if (vendorRes.status === 404) {
          toast.error("Vendor not found");
          router.push("/purchase/vendor-management");
          return;
        }
        const error = await vendorRes.json();
        throw new Error(error.error || "Failed to fetch vendor");
      }

      const data = await vendorRes.json();
      setVendor(data);

      if (userRes.ok) {
        const userData = await userRes.json();
        setAccessLevel(userData.user?.designationAccessLevel ?? userData.designationAccessLevel ?? null);
      }
    } catch (error: any) {
      console.error("Error fetching vendor:", error);
      toast.error(error.message || "Failed to load vendor details");
      router.push("/purchase/vendor-management");
    } finally {
      setLoading(false);
      markSuccess();
    }
  };

  useEffect(() => {
    void loadVendor();
  }, [vendorId, router, markSuccess]);

  const handleEdit = () => {
    router.push(`/purchase/vendor-management/edit/${vendorId}`);
  };
  if (!vendor) {
    return (
      <div className="space-y-4">
        <main className="mx-auto py-4" style={{ width: "90%", maxWidth: "90vw" }}>
          <Card>
            <CardContent className="p-8">
              <div className="text-center space-y-4">
                <AlertTriangle className="h-16 w-16 text-destructive mx-auto" />
                <h1 className="text-2xl font-bold text-foreground">Vendor Not Found</h1>
                <p className="text-foreground">The vendor you're looking for doesn't exist or has been removed.</p>
                <Button onClick={() => router.push("/purchase/vendor-management")}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Vendor Management
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <PageReadyGate ready={ready && !loading} loadingText="Loading vendor details...">
    <div className="space-y-4">
      <main className="mx-auto py-4" style={{ width: "90%", maxWidth: "90vw" }}>
        {/* Header */}
        <div className="mb-6">
          <Button
            variant="outline"
            onClick={() => router.push("/purchase/vendor-management")}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Vendor Management
          </Button>
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">{vendor.name}</h1>
              <p className="text-foreground">Vendor Details and Information</p>
            </div>
            <Button onClick={handleEdit}>
              <Edit className="h-4 w-4 mr-2" />
              Edit Vendor
            </Button>
          </div>
        </div>

        <VendorVerificationPanel
          vendor={vendor as any}
          accessLevel={accessLevel}
          onVerified={() => void loadVendor()}
        />

        {/* Status Badges */}
        <div className="mb-6 flex gap-2">
          {vendor.isActive ? (
            <Badge variant="default" className="flex items-center gap-1">
              <CheckCircle className="h-3 w-3" />
              Active
            </Badge>
          ) : (
            <Badge variant="secondary" className="flex items-center gap-1">
              <XCircle className="h-3 w-3" />
              Inactive
            </Badge>
          )}
          {vendor.isBlacklisted && (
            <Badge variant="destructive" className="flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Blacklisted
            </Badge>
          )}
          {vendor.rating && (
            <Badge variant="outline" className="flex items-center gap-1">
              <Star className="h-3 w-3 fill-yellow-400 text-warning" />
              {vendor.rating}/5
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Store className="h-5 w-5" />
                Basic Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground">Company Name</label>
                <p className="text-sm text-foreground mt-1">{vendor.name}</p>
              </div>
              
              {vendor.vendorId && (
                <div>
                  <label className="text-sm font-medium text-foreground">Vendor ID</label>
                  <p className="text-sm text-foreground mt-1 font-mono">{vendor.vendorId}</p>
                </div>
              )}

              {vendor.contactPerson && (
                <div>
                  <label className="text-sm font-medium text-foreground">Contact Person</label>
                  <p className="text-sm text-foreground mt-1">{vendor.contactPerson}</p>
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-foreground">Primary Email</label>
                <div className="flex items-center gap-2 mt-1">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm text-foreground">{vendor.primaryEmail}</p>
                </div>
              </div>

              {vendor.secondaryEmail && (
                <div>
                  <label className="text-sm font-medium text-foreground">Secondary Email</label>
                  <div className="flex items-center gap-2 mt-1">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm text-foreground">{vendor.secondaryEmail}</p>
                  </div>
                </div>
              )}

              {vendor.commonEmail && (
                <div>
                  <label className="text-sm font-medium text-foreground">Common Email</label>
                  <div className="flex items-center gap-2 mt-1">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm text-foreground">{vendor.commonEmail}</p>
                  </div>
                </div>
              )}

              {vendor.additionalEmail && (
                <div>
                  <label className="text-sm font-medium text-foreground">Additional Email</label>
                  <div className="flex items-center gap-2 mt-1">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm text-foreground">{vendor.additionalEmail}</p>
                  </div>
                </div>
              )}

              {vendor.phone && (
                <div>
                  <label className="text-sm font-medium text-foreground">Phone</label>
                  <div className="flex items-center gap-2 mt-1">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm text-foreground">{vendor.phone}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Location & Service Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Location & Services
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {vendor.country && (
                <div>
                  <label className="text-sm font-medium text-foreground">Country</label>
                  <div className="flex items-center gap-2 mt-1">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm text-foreground">{vendor.country}</p>
                  </div>
                </div>
              )}

              {vendor.city && (
                <div>
                  <label className="text-sm font-medium text-foreground">City</label>
                  <p className="text-sm text-foreground mt-1">{vendor.city}</p>
                </div>
              )}

              {vendor.address && (
                <div>
                  <label className="text-sm font-medium text-foreground">Address</label>
                  <p className="text-sm text-foreground mt-1">{vendor.address}</p>
                </div>
              )}

              {vendor.serviceTypes && vendor.serviceTypes.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-foreground">Service Types</label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {vendor.serviceTypes.map((type, index) => (
                      <Badge key={index} variant="outline">
                        {SERVICE_TYPE_LABELS[type as keyof typeof SERVICE_TYPE_LABELS] || type}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {vendor.serviceCountries && vendor.serviceCountries.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-foreground">Service Countries</label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {vendor.serviceCountries.map((country, index) => (
                      <Badge key={index} variant="secondary">
                        {country}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Additional Information */}
          {(vendor.isBlacklisted || vendor.blacklistReason || vendor.rating) && (
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Additional Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {vendor.rating && (
                  <div>
                    <label className="text-sm font-medium text-foreground">Rating</label>
                    <div className="flex items-center gap-2 mt-1">
                      <Star className="h-4 w-4 fill-yellow-400 text-warning" />
                      <p className="text-sm text-foreground">{vendor.rating} / 5</p>
                    </div>
                  </div>
                )}

                {vendor.isBlacklisted && vendor.blacklistReason && (
                  <div>
                    <label className="text-sm font-medium text-foreground">Blacklist Reason</label>
                    <div className="mt-1 p-3 bg-destructive border border-border rounded-md">
                      <p className="text-sm text-destructive">{vendor.blacklistReason}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Quotes History */}
          {vendor.quotes && vendor.quotes.length > 0 && (
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Recent Quotes</CardTitle>
                <CardDescription>Last 10 quotes submitted by this vendor</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {vendor.quotes.map((quote: any) => (
                    <div
                      key={quote.id}
                      className="p-3 border rounded-md hover:bg-muted transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">
                            {quote.requisition?.requisitionNumber || "N/A"}
                          </p>
                          <p className="text-xs text-foreground mt-1">
                            {quote.requisition?.heading || "No heading"}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">
                            {new Date(quote.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
    </PageReadyGate>
  );
}








