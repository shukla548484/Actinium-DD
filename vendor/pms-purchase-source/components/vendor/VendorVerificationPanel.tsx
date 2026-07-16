"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CheckCircle2, ShieldCheck, XCircle } from "lucide-react";
import {
  VENDOR_VERIFICATION_STATUS,
  canVerifyVendorRegistration,
  vendorVerificationLabel,
} from "@/lib/vendor-verification";
import type { VendorOnboardingData } from "@/lib/vendor-registration";

type VendorRecord = {
  id: string;
  name: string;
  primaryEmail: string;
  registrationComplete?: boolean;
  verificationStatus?: string;
  verificationNotes?: string | null;
  verifiedAt?: string | null;
  onboardingData?: VendorOnboardingData | null;
  companyRegistrationNumber?: string | null;
  preferredCurrency?: string | null;
  vatNumber?: string | null;
  productDescription?: string | null;
  phone?: string | null;
  country?: string;
  vendorPorts?: Array<{ port: { name: string; country: string } }>;
};

type Props = {
  vendor: VendorRecord;
  accessLevel: number | null;
  onVerified?: () => void;
};

export function VendorVerificationPanel({ vendor, accessLevel, onVerified }: Props) {
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const canVerify = canVerifyVendorRegistration(accessLevel);
  const status = vendor.verificationStatus ?? VENDOR_VERIFICATION_STATUS.PENDING;
  const onboarding = (vendor.onboardingData ?? {}) as VendorOnboardingData;

  const handleAction = async (action: "confirm" | "reject") => {
    if (!canVerify) {
      toast.error("Only purchasers (32–33) or administrators (50, 99, 100) can verify vendors");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/vendors/${vendor.id}/verify`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, notes: notes.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Verification failed");
      toast.success(data.message || "Updated");
      onVerified?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  if (!vendor.registrationComplete) return null;

  return (
    <Card className="mb-6 border-amber-200 bg-amber-50/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <ShieldCheck className="h-5 w-5" />
          Registration verification
        </CardTitle>
        <CardDescription>
          Review registration data before the vendor can use quotes, orders, and payments.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">Status:</span>
          <Badge
            variant={
              status === VENDOR_VERIFICATION_STATUS.VERIFIED
                ? "default"
                : status === VENDOR_VERIFICATION_STATUS.REJECTED
                  ? "destructive"
                  : "secondary"
            }
          >
            {vendorVerificationLabel(status)}
          </Badge>
          {vendor.verifiedAt ? (
            <span className="text-xs text-muted-foreground">
              Verified {new Date(vendor.verifiedAt).toLocaleString()}
            </span>
          ) : null}
        </div>

        {status === VENDOR_VERIFICATION_STATUS.PENDING && (
          <div className="grid gap-3 sm:grid-cols-2 text-sm">
            <div>
              <p className="text-muted-foreground">Registration no.</p>
              <p className="font-medium">{vendor.companyRegistrationNumber || "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Currency</p>
              <p className="font-medium">{vendor.preferredCurrency || "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Contacts</p>
              <p className="font-medium">{onboarding.contacts?.length ?? 0}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Documents</p>
              <p className="font-medium">{onboarding.documents?.length ?? 0}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-muted-foreground">Bank</p>
              <p className="font-medium">{onboarding.banking?.bankName || "—"}</p>
            </div>
          </div>
        )}

        {vendor.verificationNotes ? (
          <p className="text-sm text-muted-foreground">
            Notes: {vendor.verificationNotes}
          </p>
        ) : null}

        {canVerify && status === VENDOR_VERIFICATION_STATUS.PENDING ? (
          <div className="space-y-3 border-t pt-4">
            <Textarea
              rows={2}
              placeholder="Verification notes (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <Button disabled={loading} onClick={() => void handleAction("confirm")}>
                <CheckCircle2 className="h-4 w-4 mr-1" />
                Confirm verification
              </Button>
              <Button
                variant="outline"
                disabled={loading}
                onClick={() => void handleAction("reject")}
              >
                <XCircle className="h-4 w-4 mr-1" />
                Reject
              </Button>
            </div>
          </div>
        ) : !canVerify && status === VENDOR_VERIFICATION_STATUS.PENDING ? (
          <p className="text-sm text-muted-foreground">
            Pending review by a purchaser (access level 32 or 33) or administrator (50, 99, 100).
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
