"use client";

import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { InvoiceWorkbenchRow } from "@/lib/purchase/invoice-workbench";
import {
  CheckCircle2,
  Download,
  Edit,
  Eye,
  FileUp,
  Mail,
  MessageSquare,
  MoreHorizontal,
  RefreshCw,
  Scale,
  Ship,
  Upload,
  XCircle,
} from "lucide-react";

type Props = {
  row: InvoiceWorkbenchRow;
  onUploadInvoice: () => void;
  onEditInvoice: () => void;
  onReloadEditInvoice: () => void;
  onReuploadDn: () => void;
  onRequestBudgetChange?: () => void;
  canRequestBudgetChange?: boolean;
  onViewDownload?: () => void;
  onViewDetails?: () => void;
  onApproveReject?: () => void;
  onEmailSupplier?: () => void;
  onEmailVessel?: () => void;
  onViewVendorReply?: () => void;
};

export function InvoiceWorkbenchActionsMenu({
  row,
  onUploadInvoice,
  onEditInvoice,
  onReloadEditInvoice,
  onReuploadDn,
  onRequestBudgetChange,
  canRequestBudgetChange = false,
  onViewDownload,
  onViewDetails,
  onApproveReject,
  onEmailSupplier,
  onEmailVessel,
  onViewVendorReply,
}: Props) {
  const { actions } = row;
  const unreadCount = row.unreadVendorReplyCount ?? 0;
  const hasAnyAction =
    actions.canUploadInvoice ||
    actions.canEdit ||
    actions.canReloadEdit ||
    actions.reloadEditBlockedReason ||
    actions.canReuploadDn ||
    actions.canViewDownload ||
    actions.canViewDetails ||
    actions.canApproveReject ||
    actions.approveRejectBlockedReason ||
    actions.canEmailSupplier ||
    actions.canEmailVessel ||
    actions.canViewPlatformMessages ||
    (canRequestBudgetChange && Boolean(row.invoice) && onRequestBudgetChange);

  if (!hasAnyAction) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="relative inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Row actions"
        >
          <MoreHorizontal className="h-4 w-4" />
          {unreadCount > 0 ? (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-4 min-w-4 px-0.5 text-[9px] font-semibold"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          ) : null}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {actions.canViewDownload && onViewDownload ? (
          <DropdownMenuItem onClick={onViewDownload}>
            <Download className="h-4 w-4 mr-2" />
            View / download invoice
          </DropdownMenuItem>
        ) : null}
        {actions.canViewDetails && onViewDetails ? (
          <DropdownMenuItem onClick={onViewDetails}>
            <Eye className="h-4 w-4 mr-2" />
            View invoice details
          </DropdownMenuItem>
        ) : null}
        {actions.canApproveReject && onApproveReject ? (
          <DropdownMenuItem onClick={onApproveReject}>
            <CheckCircle2 className="h-4 w-4 mr-2 text-success" />
            Approve / reject invoice
          </DropdownMenuItem>
        ) : null}
        {!actions.canApproveReject && actions.approveRejectBlockedReason ? (
          <DropdownMenuItem disabled className="text-xs whitespace-normal">
            <XCircle className="h-4 w-4 mr-2 shrink-0" />
            {actions.approveRejectBlockedReason}
          </DropdownMenuItem>
        ) : null}

        {(actions.canViewDownload ||
          actions.canViewDetails ||
          actions.canApproveReject ||
          actions.approveRejectBlockedReason) &&
        (actions.canEmailSupplier ||
          actions.canEmailVessel ||
          actions.canViewPlatformMessages) ? (
          <DropdownMenuSeparator />
        ) : null}

        {actions.canEmailSupplier && onEmailSupplier ? (
          <DropdownMenuItem onClick={onEmailSupplier}>
            <Mail className="h-4 w-4 mr-2" />
            Email to supplier
          </DropdownMenuItem>
        ) : null}
        {actions.canEmailVessel && onEmailVessel ? (
          <DropdownMenuItem onClick={onEmailVessel}>
            <Ship className="h-4 w-4 mr-2" />
            Email to vessel
          </DropdownMenuItem>
        ) : null}
        {actions.canViewPlatformMessages && onViewVendorReply ? (
          <DropdownMenuItem onClick={onViewVendorReply} className="relative">
            <MessageSquare className="h-4 w-4 mr-2" />
            View vendor reply
            {unreadCount > 0 ? (
              <Badge
                variant="destructive"
                className="ml-auto h-5 min-w-5 px-1 text-[10px]"
              >
                {unreadCount > 99 ? "99+" : unreadCount}
              </Badge>
            ) : null}
          </DropdownMenuItem>
        ) : null}

        {(actions.canEdit ||
          actions.canReuploadDn ||
          actions.canUploadInvoice ||
          actions.canReloadEdit ||
          actions.reloadEditBlockedReason) &&
        (actions.canViewDownload ||
          actions.canViewDetails ||
          actions.canEmailSupplier) ? (
          <DropdownMenuSeparator />
        ) : null}

        {actions.canEdit && (
          <DropdownMenuItem onClick={onEditInvoice}>
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </DropdownMenuItem>
        )}
        {actions.canReuploadDn && (
          <DropdownMenuItem onClick={onReuploadDn}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Reupload DN
          </DropdownMenuItem>
        )}
        {actions.canUploadInvoice && (
          <DropdownMenuItem onClick={onUploadInvoice}>
            <Upload className="h-4 w-4 mr-2" />
            Upload invoice
          </DropdownMenuItem>
        )}
        {actions.canReloadEdit && (
          <DropdownMenuItem onClick={onReloadEditInvoice}>
            <FileUp className="h-4 w-4 mr-2" />
            Reload / edit invoice
          </DropdownMenuItem>
        )}
        {!actions.canReloadEdit && actions.reloadEditBlockedReason && (
          <DropdownMenuItem disabled className="text-xs whitespace-normal">
            {actions.reloadEditBlockedReason}
          </DropdownMenuItem>
        )}
        {canRequestBudgetChange && row.invoice && onRequestBudgetChange ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onRequestBudgetChange}>
              <Scale className="h-4 w-4 mr-2" />
              Change budget type
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
