"use client";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { PoBudgetChangeContent } from "./PoBudgetChangeContent";
import {
  PO_BUDGET_CHANGE_APPROVER_LEVELS,
  PO_BUDGET_CHANGE_REQUESTOR_LEVELS,
} from "@/lib/purchase/po-budget-change-access";

const ALLOWED_LEVELS = [
  ...PO_BUDGET_CHANGE_REQUESTOR_LEVELS,
  ...PO_BUDGET_CHANGE_APPROVER_LEVELS,
  50,
  99,
  100,
];

export default function PoBudgetChangePage() {
  return (
    <ProtectedRoute allowedAccessLevels={ALLOWED_LEVELS}>
      <PoBudgetChangeContent />
    </ProtectedRoute>
  );
}
