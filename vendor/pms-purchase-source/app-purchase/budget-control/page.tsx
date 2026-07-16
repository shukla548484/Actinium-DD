"use client";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { PurchaseBudgetControlView } from "@/components/purchase/PurchaseBudgetControlView";

export default function BudgetControlPage() {
  return (
    <ProtectedRoute requiredAccessLevel={28}>
      <PurchaseBudgetControlView />
    </ProtectedRoute>
  );
}
