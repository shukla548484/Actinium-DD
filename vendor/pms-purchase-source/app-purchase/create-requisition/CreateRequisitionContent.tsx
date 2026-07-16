"use client";
import { usePageBootstrap } from "@/hooks/use-page-bootstrap";
import { PageReadyGate } from "@/components/page-ready/PageReadyGate";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RequisitionForm, type RequisitionFormData } from "@/components/RequisitionForm";
import { RequisitionQuantityInput } from "@/components/requisition/RequisitionQuantityInput";
import { isMainEngineMachinery } from "@/lib/spares-inventory/is-main-engine-machinery";
import { 
  Plus, 
  FileText, 
  AlertTriangle, 
  Shield,
  Building2,
  Ship,
  User,
  Download,
  X,
  Check,
  ChevronsUpDown,
  Search,
  Paperclip,
  Loader2,
  Settings
} from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  CreateRequisitionData, 
  GenerationStatus,
  RequisitionType,
  REQUISITION_TYPE_LABELS,
  REQUISITION_PURPOSE,
  REQUISITION_PURPOSE_LABELS,
  RequisitionPurpose,
  canCreateRequisition,
  canOfficeCreateRequisition,
} from "@/lib/types/requisition";
import { budgetScopeForRequisitionPurpose } from "@/lib/purchase-budget-scope";
import { chemicalSubcategoriesForApi } from "@/lib/chemical-requisition-subcategories";
import { isLocalDeploymentClient } from "@/lib/vessel-sync/local-deployment-client";
import { MultiSelectDropdown } from "@/components/ui/multi-select-dropdown";
import { toast } from "sonner";
import { useVessels } from "@/hooks/useStaticData";

// Helper function to get requisition type descriptions
const getRequisitionTypeDescription = (type: RequisitionType): string => {
  const descriptions: Record<RequisitionType, string> = {
    [RequisitionType.STR]: "General store items, consumables, and regular supplies for vessel operations.",
    [RequisitionType.SPR]: "Spare parts and replacement components for machinery and equipment.",
    [RequisitionType.GLY]: "Galley equipment, utensils, cleaning items, and galley-related supplies.",
    [RequisitionType.PNT]: "Marine paints, coatings, thinners, and hardeners for vessel maintenance and painting.",
    [RequisitionType.REP]: "Repair services and maintenance work requests for equipment and systems.",
    [RequisitionType.SER]: "Technical services, inspections, and professional service requests.",
    [RequisitionType.CTM]: "Customs, immigration, and port authority related requests.",
    [RequisitionType.PRO]: "Provisions and supplies for crew welfare and vessel operations.",
    [RequisitionType.BNK]: "Fuel bunker requests for main engines and auxiliary systems.",
    [RequisitionType.LUB]: "Lubricating oils, hydraulic fluids, and other specialized oils.",
    [RequisitionType.FCL]: "Flag state and classification society inspection and certification requests.",
    [RequisitionType.OTR]: "Other specialized requisitions that don't fit standard categories.",
    [RequisitionType.CHE]:
      "Cleaning and maintenance chemicals — deck, engine room, tank cleaning, cargo hold, and BWTS chemicals.",
  };
  return descriptions[type];
};

export function CreateRequisitionContent() {
  // Don't block page rendering - stop loader immediately
  const { ready, markSuccess } = usePageBootstrap();
  
  // Use optimized hooks for static data with caching
  const { data: vessels = [], isLoading: vesselsLoading } = useVessels({ limit: 100, isActive: true });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedVessel, setSelectedVessel] = useState<string>("");
  const [selectedType, setSelectedType] = useState<RequisitionType | "">("");
  const [selectedSubCategoryCodes, setSelectedSubCategoryCodes] = useState<string[]>([]);
  const [selectedStoreLocationId, setSelectedStoreLocationId] = useState<string>("");
  const [storeLocationOptions, setStoreLocationOptions] = useState<
    Array<{ id: string; name: string; code: string }>
  >([]);
  const [storeLocationsLoading, setStoreLocationsLoading] = useState(false);
  const [subCategoryOptions, setSubCategoryOptions] = useState<
    Array<{ code: string; name: string; defaultBudgetCategoryCode: string | null }>
  >([]);
  const [subCategoriesLoading, setSubCategoriesLoading] = useState(false);
  const [subCategoriesLoadError, setSubCategoriesLoadError] = useState<string | null>(null);
  const [lubeOilSuppliers, setLubeOilSuppliers] = useState<
    Array<{ id: string; code: string; name: string }>
  >([]);
  const [lubeSuppliersLoading, setLubeSuppliersLoading] = useState(false);
  const [selectedLubeOilSupplierId, setSelectedLubeOilSupplierId] = useState("");
  const subCategoriesFetchGen = useRef(0);
  const budgetResolveFetchGen = useRef(0);
  const [requisitionPurpose, setRequisitionPurpose] = useState<RequisitionPurpose>(REQUISITION_PURPOSE.ROUTINE_MAINTENANCE);
  const [requisitionUrgency, setRequisitionUrgency] = useState<"NORMAL" | "URGENT" | "CRITICAL">("NORMAL");
  const [autoGeneratedNumber, setAutoGeneratedNumber] = useState<string>("");
  const [manualReqNumber, setManualReqNumber] = useState<string>("");
  const [itemsSnapshotByType, setItemsSnapshotByType] = useState<
    Partial<Record<RequisitionType, RequisitionFormData["items"]>>
  >({});
  const [accessDenied, setAccessDenied] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userAccessLevel, setUserAccessLevel] = useState<number | undefined>(undefined);
  const [isOffline, setIsOffline] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  
  // Basic information state
  const [heading, setHeading] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [portOfSupply, setPortOfSupply] = useState<string>("");
  const [portAgentDetails, setPortAgentDetails] = useState<string>("");
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [downloadingSubcategorySheet, setDownloadingSubcategorySheet] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const updateOnline = () => setIsOffline(!navigator.onLine);
    updateOnline();
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    const mql = window.matchMedia("(display-mode: standalone)");
    const updateStandalone = () => setIsStandalone(Boolean(mql.matches));
    updateStandalone();
    mql.addEventListener?.("change", updateStandalone);
    return () => {
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
      mql.removeEventListener?.("change", updateStandalone);
    };
  }, []);
  
  // Contract and Budget fields
  const [selectedContractId, setSelectedContractId] = useState<string>("");
  const [budgetCode, setBudgetCode] = useState<string>("");
  const [budgetCodeLabel, setBudgetCodeLabel] = useState<string>("");
  const [budgetCodeSource, setBudgetCodeSource] = useState<"mapping" | "subcategory" | "explicit" | "none" | "">("");
  const [loadingBudgetCode, setLoadingBudgetCode] = useState(false);
  const [glCode, setGlCode] = useState<string>("");
  const [costCenter, setCostCenter] = useState<string>("");
  const [contracts, setContracts] = useState<Array<{ id: string; contractNumber: string; title: string; vendor: { name: string } }>>([]);
  
  // Spare requisition machinery selection (requisition-level, not item-level)
  const [spareMachineryId, setSpareMachineryId] = useState<string>("");
  const [spareUseManualMachinery, setSpareUseManualMachinery] = useState<boolean>(false);
  const [spareManualMachineryName, setSpareManualMachineryName] = useState<string>("");
  const [spareMachinery, setSpareMachinery] = useState<any[]>([]);
  const [spareMachineryComboboxOpen, setSpareMachineryComboboxOpen] = useState<boolean>(false);

  const spareIsMainEngine = useMemo(() => {
    if (spareUseManualMachinery || !spareMachineryId) return false;
    const selected = spareMachinery.find((m) => m.id === spareMachineryId);
    return selected ? isMainEngineMachinery(selected) : false;
  }, [spareMachineryId, spareMachinery, spareUseManualMachinery]);
  
  // Drawing attachments (saved in DB immediately; linked to requisition on create)
  const [drawingAttachments, setDrawingAttachments] = useState<Array<{ id: string; fileName: string; fileSize: number }>>([]);
  const [commonDrawingNumber, setCommonDrawingNumber] = useState("");
  const [uploadingDrawing, setUploadingDrawing] = useState(false);
  const drawingFileInputRef = useRef<HTMLInputElement>(null);
  
  // Manual entry floating form state
  const [showManualEntryForm, setShowManualEntryForm] = useState<boolean>(false);
  const [manualEntryItems, setManualEntryItems] = useState<Array<{
    partNumber: string;
    partName: string;
    itemNumber: string;
    drawingNumber: string;
    quantity: number;
    unit: string;
    currentRob: number;
    remarks: string;
  }>>([
    { partNumber: "", partName: "", itemNumber: "", drawingNumber: "", quantity: 0, unit: "PCS", currentRob: 0, remarks: "" },
    { partNumber: "", partName: "", itemNumber: "", drawingNumber: "", quantity: 0, unit: "PCS", currentRob: 0, remarks: "" },
    { partNumber: "", partName: "", itemNumber: "", drawingNumber: "", quantity: 0, unit: "PCS", currentRob: 0, remarks: "" },
    { partNumber: "", partName: "", itemNumber: "", drawingNumber: "", quantity: 0, unit: "PCS", currentRob: 0, remarks: "" },
    { partNumber: "", partName: "", itemNumber: "", drawingNumber: "", quantity: 0, unit: "PCS", currentRob: 0, remarks: "" },
  ]);

  // Fetch current user from API with timeout
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const { fetchJsonWithTimeout } = await import('@/lib/utils/fetch-with-timeout');
        const data = await fetchJsonWithTimeout<{ user: any }>("/api/profile/basic", {
          timeout: 8000,
          credentials: "include"
        });
        const user = data.user;
        setCurrentUser(user);
        // Always use designationAccessLevel from database
        const accessLevel = user.designationAccessLevel;
        setUserAccessLevel(accessLevel);
      } catch (error: any) {
        console.error("Error fetching user:", error);
        if (error.message?.includes('timeout')) {
          toast.error("Failed to load user data. Please refresh the page.");
        }
      }
    };
    fetchUser();
  }, []);

  // Auto-select first vessel for vessel-level users (access level 6-25)
  useEffect(() => {
    if (
      vessels.length > 0 &&
      !selectedVessel &&
      userAccessLevel !== undefined &&
      userAccessLevel >= 6 &&
      userAccessLevel <= 25
    ) {
      setSelectedVessel(vessels[0].id);
    }
  }, [vessels, selectedVessel, userAccessLevel]);

  const canUserCreate = useMemo(
    () =>
      canCreateRequisition(userAccessLevel) || canOfficeCreateRequisition(userAccessLevel),
    [userAccessLevel]
  );


  useEffect(() => {
    if (selectedType !== RequisitionType.STR || !selectedVessel) {
      setStoreLocationOptions([]);
      setSelectedStoreLocationId("");
      return;
    }
    let cancelled = false;
    const load = async () => {
      setStoreLocationsLoading(true);
      try {
        const res = await fetch(
          `/api/spare-parts/store-locations?vesselId=${encodeURIComponent(selectedVessel)}`,
          { credentials: "include" }
        );
        if (!res.ok) throw new Error("Failed to load store locations");
        const data = await res.json();
        if (cancelled) return;
        const list = Array.isArray(data) ? data : data.storeLocations ?? [];
        setStoreLocationOptions(
          list.map((loc: { id: string; name: string; code: string }) => ({
            id: loc.id,
            name: loc.name,
            code: loc.code,
          }))
        );
      } catch {
        if (!cancelled) setStoreLocationOptions([]);
      } finally {
        if (!cancelled) setStoreLocationsLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [selectedType, selectedVessel]);

  // Auto-resolve budget code from DB mapping when type or purpose changes
  useEffect(() => {
    if (!selectedType) {
      setBudgetCode("");
      setBudgetCodeLabel("");
      setBudgetCodeSource("");
      setLoadingBudgetCode(false);
      return;
    }

    const gen = ++budgetResolveFetchGen.current;
    const resolveBudget = async () => {
      setLoadingBudgetCode(true);
      try {
        const purpose = requisitionPurpose || REQUISITION_PURPOSE.ROUTINE_MAINTENANCE;
        const params = new URLSearchParams({
          requisitionType: selectedType,
          requisitionPurpose: purpose,
          budgetScope: budgetScopeForRequisitionPurpose(purpose),
        });
        if (selectedType !== RequisitionType.CTM && selectedType !== RequisitionType.LUB && selectedSubCategoryCodes[0]) {
          params.set("subCategoryCode", selectedSubCategoryCodes[0]);
        }
        const { fetchJsonWithTimeout } = await import("@/lib/utils/fetch-with-timeout");
        const data = await fetchJsonWithTimeout<{
          budgetCode?: string;
          source?: string;
          budgetCategoryName?: string;
          level1Code?: string;
          level1Name?: string;
        }>(`/api/purchase/budget-categories/resolve?${params}`, {
          credentials: "include",
          timeout: 15000,
        });
        if (gen !== budgetResolveFetchGen.current) return;
        setBudgetCode(data.budgetCode || "");
        setBudgetCodeSource(data.source || "none");
        if (data.budgetCode && data.budgetCategoryName) {
          const group =
            data.level1Code && data.level1Name
              ? `${data.level1Code} ${data.level1Name} → `
              : "";
          setBudgetCodeLabel(`${group}${data.budgetCode} ${data.budgetCategoryName}`);
        } else {
          setBudgetCodeLabel("");
        }
      } catch {
        if (gen !== budgetResolveFetchGen.current) return;
        setBudgetCode("");
        setBudgetCodeLabel("");
        setBudgetCodeSource("none");
      } finally {
        if (gen === budgetResolveFetchGen.current) setLoadingBudgetCode(false);
      }
    };

    resolveBudget();
  }, [selectedType, requisitionPurpose, selectedSubCategoryCodes]);

  // Generate requisition number when vessel and type are selected
  useEffect(() => {
    const fetchNextRequisitionNumber = async () => {
      if (selectedVessel && selectedType && userAccessLevel !== undefined) {
        try {
          console.log('[Create Requisition] Fetching next requisition number...', {
            vesselId: selectedVessel,
            type: selectedType,
          });

          const { fetchJsonWithTimeout } = await import('@/lib/utils/fetch-with-timeout');
          const data = await fetchJsonWithTimeout<{ requisitionNumber: string }>(
            `/api/requisitions/next-number?vesselId=${selectedVessel}&requisitionType=${selectedType}`,
            {
              timeout: 5000,
              credentials: 'include',
            }
          );
          console.log('[Create Requisition] Next number received:', data.requisitionNumber);
          setAutoGeneratedNumber(data.requisitionNumber);
        } catch (error: any) {
          console.error('[Create Requisition] Error fetching next number:', error);
          // Fallback to preview format on error or timeout
          const vessel = vessels.find((vessel: { id: string; code: string }) => vessel.id === selectedVessel);
          if (vessel) {
            const isCrew = userAccessLevel >= 6 && userAccessLevel <= 25;
            const prefix = isCrew
              ? isLocalDeploymentClient()
                ? "V"
                : "T"
              : "O";
            const year = new Date().getFullYear().toString().slice(-2);
            const number = `${prefix}.${vessel.code}.${selectedType}.${year}.0001`;
            setAutoGeneratedNumber(number);
          }
        }
      } else {
        setAutoGeneratedNumber("");
      }
    };

    fetchNextRequisitionNumber();
  }, [selectedVessel, selectedType, vessels, userAccessLevel]);

  // Load initial data - wait for user to be loaded first
  useEffect(() => {
    if (dataLoaded || !currentUser) return; // Wait for user to load, prevent multiple API calls

    const loadData = async () => {
      try {
        // Check access first - now using real user data
        if (userAccessLevel === undefined) {
          // Still loading user
          return;
        }

        if (!canUserCreate) {
          setAccessDenied(true);
          markSuccess();
          setDataLoaded(true);
          return;
        }

        // Stop loading immediately - don't wait for contracts
        markSuccess();
        setDataLoaded(true);

        // Vessels are now loaded via useVessels hook
        if (vessels.length === 0 && !vesselsLoading) {
          toast.warning("No vessels available. Please contact your administrator to assign vessels to your account.", { duration: 5000 });
        }
        
        // Fetch contracts in background with timeout
        try {
          const { fetchJsonWithTimeout } = await import('@/lib/utils/fetch-with-timeout');
          const contractsData = await fetchJsonWithTimeout<{ contracts: any[] }>("/api/contracts?status=ACTIVE&limit=100", {
            timeout: 8000,
            credentials: "include"
          });
          setContracts(contractsData.contracts || []);
        } catch (error: any) {
          console.warn("Failed to load contracts:", error);
          // Non-blocking - contracts are optional
        }
      } catch (error) {
        console.error("Error loading data:", error);
        toast.error("Failed to load page data");
        markSuccess();
        setDataLoaded(true);
      }
    };

    loadData();
  }, [canUserCreate, dataLoaded, currentUser, userAccessLevel, vessels, vesselsLoading, markSuccess]); // Wait for user and access level

  // Fetch machinery when vessel is selected and type is SPR
  useEffect(() => {
    const fetchMachinery = async () => {
      if (selectedVessel && selectedType === RequisitionType.SPR) {
        try {
          const { fetchJsonWithTimeout } = await import('@/lib/utils/fetch-with-timeout');
          const data = await fetchJsonWithTimeout<{ data: any[] }>(`/api/machinery?vesselId=${selectedVessel}&limit=1000`, {
            timeout: 8000,
            credentials: 'include'
          });
          setSpareMachinery(data.data || data || []);
        } catch (error) {
          console.error('Error fetching machinery:', error);
          setSpareMachinery([]);
        }
      } else {
        setSpareMachinery([]);
        setSpareMachineryId("");
        setSpareUseManualMachinery(false);
        setSpareManualMachineryName("");
      }
    };
    fetchMachinery();
  }, [selectedVessel, selectedType]);

  useEffect(() => {
    setSelectedSubCategoryCodes([]);
    setSelectedLubeOilSupplierId("");
  }, [selectedType]);

  useEffect(() => {
    if (selectedType !== RequisitionType.LUB) {
      setLubeOilSuppliers([]);
      setSelectedLubeOilSupplierId("");
      return;
    }
    let cancelled = false;
    (async () => {
      setLubeSuppliersLoading(true);
      try {
        const res = await fetch("/api/lube-oil-suppliers", { credentials: "include" });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(data.error || "Failed to load suppliers");
        setLubeOilSuppliers(data.suppliers || []);
      } catch {
        if (!cancelled) setLubeOilSuppliers([]);
      } finally {
        if (!cancelled) setLubeSuppliersLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedType]);

  useEffect(() => {
    if (!selectedType || selectedType === RequisitionType.CTM || selectedType === RequisitionType.LUB) {
      setSubCategoryOptions([]);
      setSubCategoriesLoading(false);
      setSubCategoriesLoadError(null);
      return;
    }
    const gen = ++subCategoriesFetchGen.current;
    setSubCategoriesLoadError(null);
    (async () => {
      setSubCategoriesLoading(true);
      try {
        const { fetchJsonWithTimeout } = await import("@/lib/utils/fetch-with-timeout");
        const data = await fetchJsonWithTimeout<{ subcategories?: Array<{ code: string; name: string; defaultBudgetCategoryCode: string | null }> }>(
          `/api/purchase/requisition-subcategories?requisitionType=${encodeURIComponent(selectedType)}`,
          { credentials: "include", timeout: 15000 }
        );
        if (gen !== subCategoriesFetchGen.current) return;
        setSubCategoryOptions(Array.isArray(data.subcategories) ? data.subcategories : []);
      } catch (err: unknown) {
        if (gen !== subCategoriesFetchGen.current) return;
        console.warn(`[subcategories] Failed for type ${selectedType}:`, err);
        if (selectedType === RequisitionType.CHE) {
          setSubCategoryOptions(
            chemicalSubcategoriesForApi().map((row) => ({
              code: row.code,
              name: row.name,
              defaultBudgetCategoryCode: row.defaultBudgetCategoryCode,
            }))
          );
          setSubCategoriesLoadError(null);
          return;
        }
        setSubCategoryOptions([]);
        const msg =
          err instanceof Error && err.message.includes("timed out")
            ? "Sub-categories request timed out. Try again or check your connection."
            : "Could not load sub-categories. Try selecting the type again.";
        setSubCategoriesLoadError(msg);
        toast.error(msg);
      } finally {
        if (gen === subCategoriesFetchGen.current) setSubCategoriesLoading(false);
      }
    })();
  }, [selectedType]);

  const handleDownloadTemplate = async () => {
    if (!selectedVessel || !selectedType) {
      toast.error("Please select both vessel and requisition type first");
      return;
    }

    setDownloadingTemplate(true);
    try {
      const response = await fetch('/api/requisitions/template', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          vesselId: selectedVessel,
          requisitionType: selectedType,
          heading: heading || undefined,
          description: description || undefined,
          portOfSupply: portOfSupply || undefined,
        }),
      });

      if (response.ok) {
        // Check if response is actually a blob (Excel file) or JSON error
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')) {
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `Quote_Request_Template_${selectedType}_${new Date().toISOString().split('T')[0]}.xlsx`;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
          toast.success("Template downloaded successfully");
        } else {
          // Response is JSON error
          const error = await response.json().catch(() => ({ error: 'Failed to download template' }));
          toast.error(error.error || error.details || 'Failed to download template');
        }
      } else {
        const error = await response.json().catch(() => ({ error: 'Failed to download template' }));
        console.error('Template download error:', error);
        toast.error(error.error || error.details || 'Failed to download template');
      }
    } catch (error: any) {
      console.error('Error downloading template:', error);
      toast.error('Failed to download template: ' + (error.message || 'Unknown error'));
    } finally {
      setDownloadingTemplate(false);
    }
  };

  const handleDownloadSubcategoryBudgetTemplate = async () => {
    setDownloadingSubcategorySheet(true);
    try {
      const response = await fetch("/api/purchase/requisition-subcategories/template", {
        credentials: "include",
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "Failed to download" }));
        toast.error(err.error || "Failed to download sub-category sheet");
        return;
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `requisition-subcategories-budget-template.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success("Sub-categories & budget template downloaded");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Download failed");
    } finally {
      setDownloadingSubcategorySheet(false);
    }
  };

  const handleDrawingUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setUploadingDrawing(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      const res = await fetch("/api/requisitions/drawing-attachments", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Failed to upload drawing");
        return;
      }
      const { attachment } = await res.json();
      setDrawingAttachments((prev) => [...prev, { id: attachment.id, fileName: attachment.fileName, fileSize: attachment.fileSize }]);
      toast.success("Drawing attached");
    } catch (err) {
      toast.error("Failed to upload drawing");
    } finally {
      setUploadingDrawing(false);
    }
  };

  const handleDrawingDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/requisitions/drawing-attachments/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Failed to remove attachment");
        return;
      }
      setDrawingAttachments((prev) => prev.filter((a) => a.id !== id));
      toast.success("Attachment removed");
    } catch {
      toast.error("Failed to remove attachment");
    }
  };

  const handleCreateRequisition = async (data: CreateRequisitionData & { generationStatus: GenerationStatus }) => {
    console.log('[CreateRequisition] handleCreateRequisition called with:', {
      generationStatus: data.generationStatus,
      heading: data.heading,
      vesselId: data.vesselId,
      requisitionType: data.requisitionType,
      itemsCount: data.items?.length || 0,
      hasUser: !!currentUser?.id,
    });

    if (!currentUser?.id) {
      console.error('[CreateRequisition] User not authenticated');
      toast.error("User not authenticated. Please refresh the page.");
      return;
    }

    if (selectedType === RequisitionType.LUB && !selectedLubeOilSupplierId) {
      toast.error("Please select a lube oil supplier");
      return;
    }

    setIsSubmitting(true);
    try {
      const requestBody = {
        ...data,
        createdById: currentUser.id,
        requisitionPurpose: requisitionPurpose || data.requisitionPurpose || REQUISITION_PURPOSE.ROUTINE_MAINTENANCE,
        priority: requisitionUrgency,
        contractId: selectedContractId || undefined,
        budgetCode: budgetCode || undefined,
        glCode: glCode || undefined,
        costCenter: costCenter || undefined,
        drawingAttachmentIds: drawingAttachments.map((a) => a.id),
        subCategoryCode:
          selectedType === RequisitionType.CTM || selectedType === RequisitionType.LUB
            ? undefined
            : selectedSubCategoryCodes[0] || undefined,
        subCategoryCodes:
          selectedType !== RequisitionType.LUB && selectedSubCategoryCodes.length > 0
            ? selectedSubCategoryCodes
            : undefined,
        lubeOilSupplierId:
          selectedType === RequisitionType.LUB ? selectedLubeOilSupplierId : undefined,
        storeLocationId:
          selectedType === RequisitionType.STR && selectedStoreLocationId
            ? selectedStoreLocationId
            : undefined,
      };
      
      console.log('[CreateRequisition] Sending POST request to /api/requisitions with:', {
        ...requestBody,
        items: requestBody.items?.map((item: any) => ({
          itemName: item.itemName,
          quantity: item.quantity,
          unit: item.unit,
        })),
      });

      const response = await fetch("/api/requisitions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(requestBody),
      });

      console.log('[CreateRequisition] Response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
        const errorMessage = errorData.error || errorData.message || `Failed to create requisition (${response.status})`;
        
        // Show specific error messages
        if (response.status === 403) {
          toast.error("Access denied: " + errorMessage);
        } else if (response.status === 400) {
          toast.error("Validation error: " + errorMessage);
        } else if (response.status === 500) {
          toast.error("Server error: " + errorMessage + ". Check server logs.");
        } else {
          toast.error(errorMessage);
        }
        
        // Throw error so form doesn't close
        throw new Error(errorMessage);
      }
      
      // Success - parse response
      const requisition = await response.json();
      console.log('[CreateRequisition] Requisition created successfully:', requisition.id);
      
      if (data.generationStatus === GenerationStatus.SAVED_AS_DRAFT) {
        toast.success("Requisition saved as draft successfully!");
      } else {
        toast.success("Requisition created successfully!");
      }
      
      // Return requisition so form can upload item attachments, then redirect
      const redirectUrl = data.generationStatus === GenerationStatus.SAVED_AS_DRAFT
        ? "/purchase/draft-requisitions"
        : "/purchase/view-requisitions";
      return {
        requisition: {
          id: requisition.id,
          items: (requisition.items || []).map((it: { id: string }) => ({ id: it.id })),
        },
        redirectUrl,
      };
    } catch (error) {
      console.error("[CreateRequisition] Network or other error:", error);
      toast.error("Failed to create requisition. Please check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Stop loader immediately - page structure renders right away
  useEffect(() => {
    markSuccess();
  }, [markSuccess]);

  // Memoize preFilledData to ensure form updates when values change
  const handleSaveItemsSnapshot = useCallback(
    (type: RequisitionType, items: RequisitionFormData["items"]) => {
      setItemsSnapshotByType((prev) => ({
        ...prev,
        [type]: items.map((item) => ({ ...item })),
      }));
    },
    []
  );

  const preFilledDataMemo = useMemo(() => ({
    heading,
    description,
    portOfSupply,
    portAgentDetails,
    contractId: selectedContractId,
    budgetCode,
    glCode,
    costCenter,
    requisitionPurpose,
  }), [heading, description, portOfSupply, portAgentDetails, selectedContractId, budgetCode, glCode, costCenter, requisitionPurpose]);
  
  // Page structure renders immediately - no blocking loader

  if (accessDenied) {
    return (
      <div className="w-full max-w-full space-y-4">
        <main className="w-full py-4">
          <Card>
            <CardContent className="p-8">
              <div className="text-center space-y-4">
                <div className="flex justify-center">
                  <Shield className="h-16 w-16 text-destructive" />
                </div>
                <h1 className="text-2xl font-bold text-foreground">Access Denied</h1>
                <p className="text-foreground">
                  You don&apos;t have sufficient access level to create requisitions.
                  Only vessel crew with designation access level 17–25 can create requisitions; they remain draft until the Master (25) approves.
                </p>
                <div className="bg-muted p-4 rounded-lg">
                  <p className="text-sm text-foreground">
                    <strong>Your Current Designation:</strong> {currentUser?.designation || "Not Set"}
                    <br />
                    <strong>Your Access Level:</strong> {userAccessLevel || "Unknown"}
                    <br />
                    <strong>Required access level:</strong> 17–25
                  </p>
                </div>
                <Button onClick={() => window.history.back()}>
                  Go Back
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>

    );
  }

  return (<PageReadyGate ready={ready}>
    <div className="w-full max-w-full space-y-4">
      <main className="w-full py-4">
        {/* Header Section */}
        <div className="mb-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Create Requisition</h1>
            <p className="text-foreground">
              Create new requisitions for your vessel. Select vessel and type to begin.
            </p>
          </div>
        </div>

        {(isOffline || isStandalone) && (
          <div className="mb-6 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-950 text-sm">
            <div className="font-medium">Offline mode notice</div>
            <div className="text-xs mt-1">
              This screen uses online APIs for searching items (IMPA/store/machinery). Reconnect to create requisitions here, or use Actinium-Ruby on the vessel for offline work.
            </div>
          </div>
        )}

        {/* Requisition Setup and Port Agent Details - Merged with Tabs */}
        <Card variant="compact" className="mb-4">
          <CardHeader className="px-5 pb-0 pt-2 gap-1 [.border-b]:pb-0">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Ship className="h-4 w-4 text-info" />
                Requisition Information
              </CardTitle>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                <div className="flex flex-wrap items-center gap-2 rounded-md bg-muted/50 px-2.5 py-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Req. Number</Label>
                  {autoGeneratedNumber ? (
                    <div className="flex min-w-0 items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 text-success flex-shrink-0" />
                      <p className="text-sm font-mono font-semibold text-info truncate">{autoGeneratedNumber}</p>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Select vessel & type</p>
                  )}
                </div>
                {selectedVessel && selectedType && (
                  <div className="flex flex-wrap gap-2 justify-end">
                  <Button
                    type="button"
                    onClick={handleDownloadTemplate}
                    disabled={downloadingTemplate}
                    variant="outline"
                    className="flex items-center gap-2 whitespace-nowrap"
                  >
                    <Download className={`h-4 w-4 ${downloadingTemplate ? 'animate-spin' : ''}`} />
                    {downloadingTemplate ? 'Generating...' : 'Download Excel Template'}
                  </Button>
                  <Button
                    type="button"
                    onClick={handleDownloadSubcategoryBudgetTemplate}
                    disabled={downloadingSubcategorySheet}
                    variant="outline"
                    className="flex items-center gap-2 whitespace-nowrap"
                  >
                    <Download className={`h-4 w-4 ${downloadingSubcategorySheet ? 'animate-spin' : ''}`} />
                    {downloadingSubcategorySheet ? "Generating..." : "Sub-categories & budgets (Excel)"}
                  </Button>
                  </div>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-5 pt-1.5 pb-2.5">
            <Tabs defaultValue="setup" className="w-full gap-0">
              <TabsList className="mt-0 h-7 w-fit">
                <TabsTrigger value="setup" className="flex-none gap-2 px-3 text-xs">
                  <Ship className="h-3.5 w-3.5" />
                  Requisition Setup
                </TabsTrigger>
                <TabsTrigger value="agent" className="flex-none gap-2 px-3 text-xs">
                  <User className="h-3.5 w-3.5" />
                  Port Agent Details
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="setup" className="mt-2">
            {/* Row 1: Vessel, Type, Heading, Purpose, Urgency, Manual Req (6 columns on xl) */}
                <div className="rounded-md border-l-2 border-info/50 bg-muted/20 px-3 py-2">
                <div className="grid grid-cols-1 gap-2 xl:grid-cols-[repeat(24,minmax(0,1fr))]">
                  <div className="rounded-md border bg-background/80 p-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)] xl:col-span-7">
                    <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Setup</div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div className="space-y-1 min-w-0">
                    <Label htmlFor="vessel-select" className="text-xs font-medium">Vessel *</Label>
                    <Select value={selectedVessel} onValueChange={setSelectedVessel}>
                      <SelectTrigger id="vessel-select" className="min-w-0" width="vessel">
                        <SelectValue placeholder="Select vessel" />
                      </SelectTrigger>
                      <SelectContent>
                        {vessels.map((vessel: { id: string; name: string; code: string }) => (
                          <SelectItem key={vessel.id} value={vessel.id}>
                            {vessel.name} ({vessel.code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1 min-w-0">
                    <Label htmlFor="type-select" className="text-xs font-medium">Type *</Label>
                    <Select
                      value={selectedType}
                      onValueChange={(value) => setSelectedType(value as RequisitionType)}
                      disabled={!selectedVessel}
                    >
                      <SelectTrigger id="type-select" className="min-w-0 max-w-full" width="full">
                        <SelectValue placeholder={selectedVessel ? "Select type" : "Select vessel first"} />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(REQUISITION_TYPE_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {selectedType && selectedType !== RequisitionType.CTM && selectedType !== RequisitionType.LUB && (
                    <div className="space-y-1 min-w-0">
                      <Label htmlFor="subcategory-select" className="text-xs font-medium">
                        Sub category
                      </Label>
                      <Select
                        value={selectedSubCategoryCodes[0] || undefined}
                        onValueChange={(value) =>
                          setSelectedSubCategoryCodes(value ? [value] : [])
                        }
                        disabled={
                          !selectedType ||
                          subCategoriesLoading ||
                          (subCategoryOptions.length === 0 && !subCategoriesLoadError)
                        }
                      >
                        <SelectTrigger id="subcategory-select" className="min-w-0 max-w-full" width="full">
                          <SelectValue
                            placeholder={
                              subCategoriesLoading
                                ? "Loading sub-categories…"
                                : subCategoriesLoadError
                                  ? "Failed to load — change type to retry"
                                  : subCategoryOptions.length === 0
                                    ? "No sub-categories (run DB migration)"
                                    : "Select sub category"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {subCategoryOptions.map((o) => (
                            <SelectItem key={o.code} value={o.code}>
                              {o.code} — {o.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {subCategoriesLoadError && !subCategoriesLoading && (
                        <p className="text-xs text-destructive">{subCategoriesLoadError}</p>
                      )}
                    </div>
                  )}
                  {selectedType === RequisitionType.LUB && (
                    <div className="space-y-1 min-w-0">
                      <Label htmlFor="lube-supplier-select" className="text-xs font-medium">
                        Lube oil supplier *
                      </Label>
                      <Select
                        value={selectedLubeOilSupplierId || undefined}
                        onValueChange={setSelectedLubeOilSupplierId}
                        disabled={lubeSuppliersLoading || lubeOilSuppliers.length === 0}
                      >
                        <SelectTrigger id="lube-supplier-select" className="min-w-0 max-w-full" width="full">
                          <SelectValue
                            placeholder={
                              lubeSuppliersLoading
                                ? "Loading suppliers…"
                                : lubeOilSuppliers.length === 0
                                  ? "No suppliers — add in Admin → Lube Oil Catalog"
                                  : "Select supplier"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {lubeOilSuppliers.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.name} ({s.code})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {selectedType === RequisitionType.STR && (
                    <div className="space-y-1 min-w-0">
                      <Label htmlFor="store-location-select" className="text-xs font-medium">
                        Store location
                      </Label>
                      <Select
                        value={selectedStoreLocationId || undefined}
                        onValueChange={setSelectedStoreLocationId}
                        disabled={!selectedVessel || storeLocationsLoading}
                      >
                        <SelectTrigger id="store-location-select" className="min-w-0 max-w-full" width="full">
                          <SelectValue
                            placeholder={
                              storeLocationsLoading
                                ? "Loading stores…"
                                : storeLocationOptions.length === 0
                                  ? "No store locations for vessel"
                                  : "Select physical store (optional)"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {storeLocationOptions.map((loc) => (
                            <SelectItem key={loc.id} value={loc.id}>
                              {loc.name} ({loc.code})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                    </div>
                  </div>

                  <div className="rounded-md border bg-background/80 p-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)] xl:col-span-9">
                    <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Requisition Details</div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-[repeat(12,minmax(0,1fr))]">
                  <div className="space-y-1 min-w-0 xl:col-span-7">
                    <Label htmlFor="heading" className="text-xs font-medium">Heading *</Label>
                    <Input
                      id="heading"
                      type="text"
                      placeholder="Enter requisition heading"
                      value={heading}
                      onChange={(e) => setHeading(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1 min-w-0 xl:col-span-5">
                    <Label htmlFor="manual-req" className="text-xs font-medium">Manual Req Number</Label>
                    <Input
                      id="manual-req"
                      type="text"
                      placeholder="Optional manual reference"
                      value={manualReqNumber}
                      onChange={(e) => setManualReqNumber(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1 min-w-0 xl:col-span-7">
                    <Label htmlFor="requisition-purpose" className="text-xs font-medium">Purpose</Label>
                    <Select
                      value={requisitionPurpose}
                      onValueChange={(value) => setRequisitionPurpose(value as RequisitionPurpose)}
                    >
                      <SelectTrigger id="requisition-purpose" className="min-w-0">
                        <SelectValue placeholder="Select purpose" />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(REQUISITION_PURPOSE_LABELS) as RequisitionPurpose[]).map((key) => (
                          <SelectItem key={key} value={key}>
                            {REQUISITION_PURPOSE_LABELS[key]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1 min-w-0 xl:col-span-5">
                    <Label htmlFor="requisition-urgency" className="text-xs font-medium">Urgency</Label>
                    <Select
                      value={requisitionUrgency}
                      onValueChange={(v) => setRequisitionUrgency(v as "NORMAL" | "URGENT" | "CRITICAL")}
                    >
                      <SelectTrigger id="requisition-urgency" className="min-w-0">
                        <SelectValue placeholder="Urgency" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NORMAL">Normal</SelectItem>
                        <SelectItem value="URGENT">Urgent</SelectItem>
                        <SelectItem value="CRITICAL">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                    </div>
                  </div>

                  <div className="rounded-md border bg-background/80 p-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)] xl:col-span-8">
                    <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Budget & Delivery</div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-[repeat(12,minmax(0,1fr))]">
                  <div className="space-y-1 min-w-0 xl:col-span-7">
                    <Label className="text-xs font-medium">Budget Code (auto)</Label>
                    <div className="min-h-9 truncate rounded-md border bg-muted/40 px-3 py-2 text-sm">
                      {loadingBudgetCode ? (
                        <span className="text-muted-foreground">Resolving budget code…</span>
                      ) : budgetCodeLabel ? (
                        <span>{budgetCodeLabel}</span>
                      ) : selectedType ? (
                        <span className="text-muted-foreground">
                          No automatic mapping for this type (configure in database)
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Select requisition type</span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1 min-w-0 xl:col-span-5">
                    <Label htmlFor="port-supply" className="text-xs font-medium">Supply Port</Label>
                    <Input
                      id="port-supply"
                      type="text"
                      placeholder="Enter supply port"
                      value={portOfSupply}
                      onChange={(e) => setPortOfSupply(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1 min-w-0 sm:col-span-2 xl:col-span-12">
                    <Label htmlFor="description" className="text-xs font-medium">Description</Label>
                    <Textarea
                      id="description"
                      placeholder="Enter requisition description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="min-h-[52px] resize-y"
                    />
                  </div>
                    </div>
                  </div>
                </div>

                {selectedType === RequisitionType.SPR && selectedVessel && (
                      <>
                        <div className="space-y-1.5">
                          <Label className="text-sm font-medium">Machinery *</Label>
                          <div className="space-y-2">
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id="spare-use-manual-machinery"
                                checked={spareUseManualMachinery}
                                onCheckedChange={(checked) => {
                                  setSpareUseManualMachinery(checked === true);
                                  if (checked) {
                                    setSpareMachineryId("");
                                  } else {
                                    setSpareManualMachineryName("");
                                  }
                                }}
                              />
                              <Label htmlFor="spare-use-manual-machinery" className="text-sm cursor-pointer whitespace-nowrap">
                                Enter manually
                              </Label>
                            </div>
                            {!spareUseManualMachinery ? (
                              <Popover open={spareMachineryComboboxOpen} onOpenChange={setSpareMachineryComboboxOpen}>
                                <PopoverTrigger asChild>
                                  <Button
                                    variant="outline"
                                    role="combobox"
                                    className="w-full justify-between text-left font-normal min-w-0"
                                    type="button"
                                  >
                                    <span className="truncate">
                                      {spareMachineryId
                                        ? spareMachinery.find(m => m.id === spareMachineryId)?.name || "Select machinery"
                                        : "Select machinery"}
                                    </span>
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[400px] p-0" align="start">
                                  <Command>
                                    <CommandInput placeholder="Search machinery..." />
                                    <CommandList>
                                      <CommandEmpty>No machinery found.</CommandEmpty>
                                      <CommandGroup>
                                        {spareMachinery.map((machinery) => (
                                          <CommandItem
                                            key={machinery.id}
                                            value={`${machinery.code || ''} ${machinery.name}`}
                                            onSelect={() => {
                                              setSpareMachineryId(machinery.id);
                                              setSpareMachineryComboboxOpen(false);
                                            }}
                                          >
                                            <Check
                                              className={cn(
                                                "mr-2 h-4 w-4",
                                                spareMachineryId === machinery.id
                                                  ? "opacity-100"
                                                  : "opacity-0"
                                              )}
                                            />
                                            {machinery.code ? `${machinery.code} - ` : ''}{machinery.name}
                                            {machinery.make && machinery.model && ` (${machinery.make} ${machinery.model})`}
                                          </CommandItem>
                                        ))}
                                      </CommandGroup>
                                    </CommandList>
                                  </Command>
                                </PopoverContent>
                              </Popover>
                            ) : (
                              <Input
                                placeholder="Enter machinery name"
                                value={spareManualMachineryName}
                                onChange={(e) => setSpareManualMachineryName(e.target.value)}
                                className="min-w-0"
                              />
                            )}
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-sm font-medium">Drawing</Label>
                          <div className="flex flex-wrap items-end gap-2">
                            <div className="min-w-[140px] flex-1 max-w-xs space-y-1">
                              <Label htmlFor="common-drawing-number" className="text-xs text-muted-foreground">
                                Drawing number
                              </Label>
                              <Input
                                id="common-drawing-number"
                                placeholder="DWG No."
                                value={commonDrawingNumber}
                                onChange={(e) => setCommonDrawingNumber(e.target.value)}
                                className="h-9"
                              />
                            </div>
                            <input
                              ref={drawingFileInputRef}
                              type="file"
                              accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx,.xls,.xlsx"
                              className="hidden"
                              onChange={handleDrawingUpload}
                              disabled={uploadingDrawing}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="gap-1.5 shrink-0"
                              onClick={() => drawingFileInputRef.current?.click()}
                              disabled={uploadingDrawing}
                            >
                              {uploadingDrawing ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Paperclip className="h-3.5 w-3.5" />
                              )}
                              {uploadingDrawing ? "Uploading…" : "Attach drawing"}
                            </Button>
                          </div>
                          {drawingAttachments.length > 0 && (
                            <ul className="space-y-1">
                              {drawingAttachments.map((a) => (
                                <li
                                  key={a.id}
                                  className="flex items-center justify-between gap-2 text-xs bg-muted rounded px-2 py-1.5"
                                >
                                  <span className="truncate min-w-0" title={a.fileName}>
                                    {a.fileName}
                                  </span>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                                    onClick={() => handleDrawingDelete(a.id)}
                                    aria-label="Remove drawing"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </Button>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </>
                    )}

                {spareMachineryId && !spareUseManualMachinery && selectedType === RequisitionType.SPR && (() => {
                  const selected = spareMachinery.find(m => m.id === spareMachineryId);
                  if (!selected) return null;
                  return (
                    <div className="rounded-lg border border-border bg-muted p-3 mt-3 space-y-2">
                      <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                        <Settings className="h-4 w-4 text-foreground" />
                        Machinery details
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-sm">
                        <div>
                          <span className="text-muted-foreground block">Name</span>
                          <span className="font-medium text-foreground">{selected.name}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block">Code</span>
                          <span className="font-medium text-foreground">{selected.code}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block">Make</span>
                          <span className="font-medium text-foreground">{selected.make ?? "—"}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block">Model</span>
                          <span className="font-medium text-foreground">{selected.model ?? "—"}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block">Serial number</span>
                          <span className="font-medium text-foreground">{selected.serialNumber ?? "—"}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block">Vessel</span>
                          <span className="font-medium text-foreground">{selected.vesselName ?? "—"}</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}
                </div>
              </TabsContent>
              
              <TabsContent value="agent" className="mt-3">
                <div className="space-y-2">
                  <Label htmlFor="port-agent-details" className="text-sm font-medium">Port Agent Details</Label>
                  <Textarea
                    id="port-agent-details"
                    placeholder="Enter port agent details, contact information, and other relevant information"
                    className="min-h-[300px]"
                    value={portAgentDetails}
                    onChange={(e) => setPortAgentDetails(e.target.value)}
                  />
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Requisition Form - Full Page */}
        {selectedVessel && selectedType && (selectedType !== RequisitionType.LUB || selectedLubeOilSupplierId) ? (
          <>
            {/* Manual Entry Button for Spare Requisition */}
            {selectedType === RequisitionType.SPR && (
              <div className="mb-4 flex justify-end">
                <Button
                  type="button"
                  onClick={() => setShowManualEntryForm(true)}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Manual Entry (5 Items)
                </Button>
              </div>
            )}
            
            <RequisitionForm
              displayMode="page"
              onClose={() => (window.location.href = '/purchase')}
              onSubmit={handleCreateRequisition}
              isSubmitting={isSubmitting}
              vessels={vessels}
              currentUserId={currentUser?.id || ""}
              selectedType={selectedType as RequisitionType}
              selectedVessel={selectedVessel}
              manualReqNumber={manualReqNumber}
              preFilledData={preFilledDataMemo}
              hideAgentDetails={true}
              selectedSubCategoryCodes={selectedSubCategoryCodes}
              subCategoryOptions={subCategoryOptions}
              selectedLubeOilSupplierId={
                selectedType === RequisitionType.LUB ? selectedLubeOilSupplierId : undefined
              }
              spareMachineryId={selectedType === RequisitionType.SPR ? spareMachineryId : undefined}
              spareManualMachineryName={selectedType === RequisitionType.SPR && spareUseManualMachinery ? spareManualMachineryName : undefined}
              spareIsMainEngine={selectedType === RequisitionType.SPR ? spareIsMainEngine : false}
              spareCommonDrawingNumber={selectedType === RequisitionType.SPR ? commonDrawingNumber : undefined}
              itemsSnapshotByType={itemsSnapshotByType}
              onSaveItemsSnapshot={handleSaveItemsSnapshot}
            />
          </>
        ) : (
          <Card variant="compact">
            <CardContent className="px-6 py-8">
              <div className="text-center space-y-3">
                <div className="flex justify-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                    <AlertTriangle className="h-6 w-6 text-muted-foreground" />
                  </div>
                </div>
                <h3 className="text-base font-semibold text-foreground">Selection Required</h3>
                <p className="text-sm text-muted-foreground max-w-xl mx-auto">
                  Please select both a vessel and a requisition type from the options above to begin creating your requisition.
                  {selectedType && selectedType !== RequisitionType.CTM && selectedType !== RequisitionType.LUB ? (
                    <span className="block mt-2">
                      Choose a sub category (department / area) in the setup row when you need a specific budget line; if you leave it blank, the system defaults to the mixed (*-COM) line when you submit.
                    </span>
                  ) : selectedType === RequisitionType.LUB ? (
                    <span className="block mt-2">
                      Select a lube oil supplier in the setup row. Products for that supplier will appear in the item list.
                    </span>
                  ) : null}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Floating Manual Entry Form Dialog */}
        <Dialog open={showManualEntryForm} onOpenChange={setShowManualEntryForm}>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Manual Entry - Spare Parts (5 Items)</DialogTitle>
              <DialogDescription>
                Enter up to 5 spare parts manually. All items will use the selected machinery: {spareUseManualMachinery ? spareManualMachineryName : (spareMachinery.find(m => m.id === spareMachineryId)?.name || "Not selected")}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {manualEntryItems.map((item, index) => (
                <Card key={index} className="p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label>Part Number *</Label>
                      <Input
                        value={item.partNumber}
                        onChange={(e) => {
                          const updated = [...manualEntryItems];
                          updated[index].partNumber = e.target.value;
                          setManualEntryItems(updated);
                        }}
                        placeholder="Part Number"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Part Name *</Label>
                      <Input
                        value={item.partName}
                        onChange={(e) => {
                          const updated = [...manualEntryItems];
                          updated[index].partName = e.target.value;
                          setManualEntryItems(updated);
                        }}
                        placeholder="Part Name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Item Number</Label>
                      <Input
                        value={item.itemNumber}
                        onChange={(e) => {
                          const updated = [...manualEntryItems];
                          updated[index].itemNumber = e.target.value;
                          setManualEntryItems(updated);
                        }}
                        placeholder="Item Number"
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2 lg:col-span-4">
                      <p className="text-xs text-muted-foreground">
                        Drawing number is set once above next to Attach drawing (applies to all items).
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>Quantity *</Label>
                      <RequisitionQuantityInput
                        value={item.quantity > 0 ? item.quantity : null}
                        showBlankWhenUnset
                        onChange={(quantity) => {
                          const updated = [...manualEntryItems];
                          updated[index].quantity = quantity;
                          setManualEntryItems(updated);
                        }}
                        placeholder="Quantity"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Unit *</Label>
                      <Input
                        value={item.unit}
                        onChange={(e) => {
                          const updated = [...manualEntryItems];
                          updated[index].unit = e.target.value;
                          setManualEntryItems(updated);
                        }}
                        placeholder="Unit (PCS, etc.)"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Current ROB</Label>
                      <Input
                        type="number"
                        min="0"
                        value={item.currentRob || ""}
                        onChange={(e) => {
                          const updated = [...manualEntryItems];
                          updated[index].currentRob = parseFloat(e.target.value) || 0;
                          setManualEntryItems(updated);
                        }}
                        placeholder="Current ROB"
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>Remarks</Label>
                      <Textarea
                        value={item.remarks}
                        onChange={(e) => {
                          const updated = [...manualEntryItems];
                          updated[index].remarks = e.target.value;
                          setManualEntryItems(updated);
                        }}
                        placeholder="Remarks"
                        className="min-h-[60px]"
                      />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowManualEntryForm(false);
                  setManualEntryItems([
                    { partNumber: "", partName: "", itemNumber: "", drawingNumber: "", quantity: 0, unit: "PCS", currentRob: 0, remarks: "" },
                    { partNumber: "", partName: "", itemNumber: "", drawingNumber: "", quantity: 0, unit: "PCS", currentRob: 0, remarks: "" },
                    { partNumber: "", partName: "", itemNumber: "", drawingNumber: "", quantity: 0, unit: "PCS", currentRob: 0, remarks: "" },
                    { partNumber: "", partName: "", itemNumber: "", drawingNumber: "", quantity: 0, unit: "PCS", currentRob: 0, remarks: "" },
                    { partNumber: "", partName: "", itemNumber: "", drawingNumber: "", quantity: 0, unit: "PCS", currentRob: 0, remarks: "" },
                  ]);
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => {
                  // Validate and add items to RequisitionForm
                  const validItems = manualEntryItems.filter(
                    item => item.partNumber.trim() && item.partName.trim() && item.quantity > 0 && item.unit.trim()
                  );
                  
                  if (validItems.length === 0) {
                    toast.error("Please enter at least one valid item with Part Number, Part Name, Quantity, and Unit");
                    return;
                  }

                  if (!spareMachineryId && !spareUseManualMachinery) {
                    toast.error("Please select machinery first");
                    return;
                  }

                  // Add items via callback
                  const formRef = (window as any).requisitionFormRef;
                  if (formRef && formRef.addItems) {
                    const { added } = formRef.addItems(validItems.map(item => ({
                      itemName: `${item.partNumber} - ${item.partName}`,
                      description: item.partName,
                      quantity: item.quantity,
                      unit: item.unit,
                      urgency: "NORMAL" as any,
                      remarks: item.remarks,
                      partNumber: item.partNumber,
                      partName: item.partName,
                      itemNumber: item.itemNumber,
                      drawingNumber: commonDrawingNumber.trim(),
                      currentRob: item.currentRob,
                      machineryInstanceId: spareMachineryId || undefined,
                      manualMachineryName: spareManualMachineryName || undefined,
                    })));
                    if (added > 0) {
                      toast.success(`Added ${added} item(s) to requisition`);
                      setShowManualEntryForm(false);
                      setManualEntryItems([
                        { partNumber: "", partName: "", itemNumber: "", drawingNumber: "", quantity: 0, unit: "PCS", currentRob: 0, remarks: "" },
                        { partNumber: "", partName: "", itemNumber: "", drawingNumber: "", quantity: 0, unit: "PCS", currentRob: 0, remarks: "" },
                        { partNumber: "", partName: "", itemNumber: "", drawingNumber: "", quantity: 0, unit: "PCS", currentRob: 0, remarks: "" },
                        { partNumber: "", partName: "", itemNumber: "", drawingNumber: "", quantity: 0, unit: "PCS", currentRob: 0, remarks: "" },
                        { partNumber: "", partName: "", itemNumber: "", drawingNumber: "", quantity: 0, unit: "PCS", currentRob: 0, remarks: "" },
                      ]);
                    }
                  } else {
                    toast.error("Unable to add items. Please try again.");
                  }
                }}
              >
                Add Items
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>

    </div>
    </PageReadyGate>
  );
}
