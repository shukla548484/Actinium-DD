"use client";
import { usePageBootstrap } from "@/hooks/use-page-bootstrap";
import { PageReadyGate } from "@/components/page-ready/PageReadyGate";

import { useState, useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RequisitionTable } from "@/components/RequisitionTable";
import { 
  FileText, 
  Plus,
} from "lucide-react";
import {
  Requisition,
  RequisitionFilters,
  canCreateRequisition,
} from "@/lib/types/requisition";
import { toast } from "sonner";
import { useRequisitionsPaginated } from "@/hooks/useRequisitionsPaginated";
import { requisitionsListQueryKey } from "@/lib/requisitions-list-query";

// Mock current user - In real app, this would come from session/auth
// NOTE: This is a mock page - in production, fetch real user from API
const MOCK_CURRENT_USER = {
  id: "current-user-id",
  firstName: "John",
  lastName: "Doe",
  designation: "Chief Engineer",
  designationAccessLevel: 25, // Use database field directly
  email: "john.doe@example.com"
};

export function DraftRequisitionsContent() {
  const { ready, markSuccess } = usePageBootstrap();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [filters, setFilters] = useState<RequisitionFilters>({});

  const userAccessLevel = MOCK_CURRENT_USER.designationAccessLevel;
  const canUserCreate = canCreateRequisition(userAccessLevel);

  const listFilters = useMemo(
    () => ({
      vesselIds: filters.vesselId ? [filters.vesselId] : [],
      page,
      limit,
      draftsOnly: true as const,
      searchTerm: filters.search,
      selectedTypes: filters.requisitionType ? [filters.requisitionType] : undefined,
      selectedStatuses: filters.status ? [filters.status] : undefined,
      dateFrom: filters.dateFrom ? new Date(filters.dateFrom) : undefined,
      dateTo: filters.dateTo ? new Date(filters.dateTo) : undefined,
    }),
    [page, limit, filters]
  );

  const {
    data: listData,
    isFetching,
    isError,
  } = useRequisitionsPaginated(listFilters);

  const drafts = listData?.requisitions ?? [];
  const total = listData?.total ?? 0;
  const totalPages = listData?.totalPages ?? 0;
  const isTableLoading = isFetching && !listData;

  useEffect(() => {
    if (!isFetching) markSuccess();
  }, [isFetching, markSuccess]);

  useEffect(() => {
    if (isError) toast.error("Failed to fetch draft requisitions");
  }, [isError]);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  const handleFiltersChange = (newFilters: RequisitionFilters) => {
    setFilters(newFilters);
    setPage(1);
  };

  const handleEditDraft = (draft: Requisition) => {
    window.location.href = `/purchase/draft-requisitions/${draft.id}/edit`;
  };

  const handleViewDraft = (draft: Requisition) => {
    window.location.href = `/purchase/requisitions/${draft.id}/view`;
  };

  const handleDeleteDraft = async (draft: Requisition) => {
    try {
      const response = await fetch(`/api/requisitions/${draft.id}?deletedById=${MOCK_CURRENT_USER.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success("Draft deleted successfully");
        await queryClient.invalidateQueries({ queryKey: requisitionsListQueryKey(listFilters) });
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || "Failed to delete draft");
      }
    } catch (error) {
      console.error("Error deleting draft:", error);
      toast.error("Failed to delete draft");
    }
  };

  return (<PageReadyGate ready={ready}>
    <div className="space-y-4">
      <main className="mx-auto py-4" style={{ width: "98%", maxWidth: "98vw" }}>
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">Draft Requisitions</h1>
              <p className="text-foreground">
                Manage your saved draft requisitions. Edit, finalize, or delete drafts as needed.
              </p>
            </div>
            {canUserCreate && (
              <Button 
                onClick={() => {
                  window.location.href = "/purchase/create-requisition";
                }} 
                size="lg"
                className="flex items-center gap-2"
              >
                <Plus className="h-5 w-5" />
                New Draft
              </Button>
            )}
          </div>
        </div>

        {/* Drafts Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Draft Requisitions
            </CardTitle>
            <CardDescription>
              All requisitions saved as drafts. You can edit, finalize, or delete them.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RequisitionTable
              requisitions={drafts}
              total={total}
              page={page}
              limit={limit}
              totalPages={totalPages}
              onPageChange={handlePageChange}
              onEdit={handleEditDraft}
              onDelete={handleDeleteDraft}
              onView={handleViewDraft}
              onFiltersChange={handleFiltersChange}
              isLoading={isTableLoading}
              currentUser={{
                id: MOCK_CURRENT_USER.id,
                designation: MOCK_CURRENT_USER.designation,
              }}
              showDraftsOnly={true}
            />
          </CardContent>
        </Card>

        {/* Empty State */}
        {!isTableLoading && drafts.length === 0 && (
          <Card className="mt-8">
            <CardContent className="p-12">
              <div className="text-center space-y-4">
                <div className="flex justify-center">
                  <FileText className="h-16 w-16 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-semibold text-foreground">No Draft Requisitions</h3>
                <p className="text-foreground max-w-md mx-auto">
                  You haven't saved any draft requisitions yet. Create a new requisition and save it as a draft to get started.
                </p>
                {canUserCreate && (
                  <Button 
                    onClick={() => {
                      window.location.href = "/purchase/create-requisition";
                    }}
                    className="mt-4"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create First Draft
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
    </PageReadyGate>
  );
}
