"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormProvider,
} from "@/components/ui/form";
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
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus,
  Trash2,
  Save,
  Send,
  FileText,
  Package,
  AlertCircle,
  Paperclip,
  X,
  Search,
  Check,
  ChevronsUpDown,
  DollarSign,
  MapPin,
  User,
  Copy,
  Pencil,
  ArrowLeft,
} from "lucide-react";
import {
  RequisitionType,
  GenerationStatus,
  ItemUrgency,
  ITEM_URGENCY_LABELS,
  CreateRequisitionData,
  Requisition,
  REQUISITION_PURPOSE,
  REQUISITION_PURPOSE_LABELS,
  RequisitionPurpose,
} from "@/lib/types/requisition";
import { getRequisitionItemHeaderLabel } from "@/lib/requisition-item-display-columns";
import {
  impaCatalogCodePlaceholder,
  impaCatalogItemNamePlaceholder,
  usesImpaCatalogSearch,
  usesChemicalImpaSearchScope,
  usesProvisionImpaSearchScope,
} from "@/lib/requisition-impa-catalog";
import { CHEMICAL_IMPA_CHAPTER_LABEL } from "@/lib/impa-chemical-scope";
import {
  ChemicalRequisitionItemCells,
  type ChemicalCatalogProduct,
} from "@/components/requisition/ChemicalRequisitionItemCells";
import {
  RequisitionDecimalQuantityInput,
  RequisitionQuantityInput,
} from "@/components/requisition/RequisitionQuantityInput";
import type { QuoteItemColumnKey } from "@/lib/excel-requisition-quote-schema";
import ActiniumLoader from "@/components/ActiniumLoader";
import { toast } from "sonner";
import { KnowledgePackMatchHint } from "@/components/procurement/KnowledgePackMatchHint";
import type { MainEnginePlateCatalogEntry } from "@/lib/spares-inventory/main-engine-plate-catalog";
import { cn } from "@/lib/utils";
import {
  inferPaintColorFromProductName,
  resolvePaintColorHex,
  type PaintColorOption,
} from "@/lib/paint-color-grades";

/** Scrollable catalog dropdown height (~4 list rows visible). */
const CATALOG_LIST_SCROLL_CLASS = "max-h-[11rem] overflow-y-auto";

type LubeProductOption = {
  value: string;
  label: string;
  description?: string | null;
  category?: string | null;
  grade?: string | null;
};

const requisitionItemSchema = z.object({
  itemName: z.string().min(1, "Item name is required"),
  impaCode: z.string().optional(),
  description: z.string().optional(),
  quantity: z.number().int().min(1, "Quantity must be a positive whole number (1, 2, 3, ...)"),
  unit: z.string().min(1, "Unit is required"),
  urgency: z.nativeEnum(ItemUrgency),
  remarks: z.string().optional(),
  // Spare requisition fields
  machineryInstanceId: z.string().optional(),
  manualMachineryName: z.string().optional(),
  partNumber: z.string().optional(),
  plateNumber: z.string().optional(),
  partName: z.string().optional(),
  itemNumber: z.string().optional(),
  drawingNumber: z.string().optional(),
  currentRob: z.number().optional(),
  addToInventory: z.boolean().default(true).optional(),
  // Lube oil requisition fields
  oilGrade: z.string().optional(),
  quantityInLiters: z.number().optional(),
  portOfSupply: z.string().optional(),
  // Paint requisition fields
  paintBrand: z.string().optional(),
  paintProductName: z.string().optional(),
  paintColorGrade: z.string().optional(),
  paintColorName: z.string().optional(),
  paintColorHex: z.string().optional(),
  paintType: z.string().optional(),
  paintCategory: z.string().optional(),
});

/** CTM, REP, and SER build line items on submit — no manual item rows in the form. */
const AUTO_ITEM_REQUISITION_TYPES: RequisitionType[] = [
  RequisitionType.CTM,
  RequisitionType.REP,
  RequisitionType.SER,
];

function requisitionUsesAutoItems(type: RequisitionType): boolean {
  return AUTO_ITEM_REQUISITION_TYPES.includes(type);
}

const requisitionFormSchema = z.object({
  heading: z.string().min(1, "Heading is required"),
  manualReqNumber: z.string().optional(),
  description: z.string().optional(),
  portOfSupply: z.string().optional(),
  requisitionType: z.nativeEnum(RequisitionType),
  requisitionPurpose: z.string().optional(),
  portAgentDetails: z.string().optional(),
  vesselId: z.string().min(1, "Vessel is required"),
  contractId: z.string().optional(),
  budgetCode: z.string().optional(),
  glCode: z.string().optional(),
  costCenter: z.string().optional(),
  items: z.array(requisitionItemSchema),
}).refine((data) => {
  if (requisitionUsesAutoItems(data.requisitionType)) {
    return true;
  }
  return data.items.length >= 1;
}, {
  message: "At least one item is required",
  path: ["items"],
}).refine((data) => {
  if (requisitionUsesAutoItems(data.requisitionType)) {
    return true;
  }
  return data.items.every(item => Number.isInteger(item.quantity) && item.quantity >= 1);
}, {
  message: "Quantity must be a positive whole number (1, 2, 3, ...)",
  path: ["items"],
});

type RequisitionFormData = z.infer<typeof requisitionFormSchema>;

export type { RequisitionFormData };

type DisplayMode = "dialog" | "page";

/** Keeps line-item inputs controlled (never undefined → defined). */
function normalizeRequisitionItemRow(
  item: Partial<RequisitionFormData["items"][number]>,
  requisitionType?: RequisitionType | null
): RequisitionFormData["items"][number] {
  return {
    itemName: item.itemName ?? "",
    impaCode: item.impaCode ?? "",
    description: item.description ?? "",
    quantity: Math.max(1, Math.floor(Number(item.quantity) || 1)),
    unit: item.unit ?? (requisitionType === RequisitionType.SPR ? "PCS" : ""),
    urgency: item.urgency ?? ItemUrgency.NORMAL,
    remarks: item.remarks ?? "",
    machineryInstanceId: item.machineryInstanceId ?? "",
    manualMachineryName: item.manualMachineryName ?? "",
    partNumber: item.partNumber ?? "",
    plateNumber: item.plateNumber ?? "",
    partName: item.partName ?? "",
    itemNumber: item.itemNumber ?? "",
    drawingNumber: item.drawingNumber ?? "",
    currentRob: item.currentRob != null ? Number(item.currentRob) : 0,
    addToInventory: item.addToInventory !== false,
    oilGrade: item.oilGrade ?? "",
    quantityInLiters: item.quantityInLiters != null ? Number(item.quantityInLiters) : 0,
    portOfSupply: item.portOfSupply ?? "",
    paintBrand: item.paintBrand ?? "",
    paintProductName: item.paintProductName ?? "",
    paintColorGrade: item.paintColorGrade ?? "",
    paintColorName: item.paintColorName ?? "",
    paintColorHex: item.paintColorHex ?? "",
    paintType: item.paintType ?? "",
    paintCategory: item.paintCategory ?? "",
  };
}

function defaultRequisitionItems(type?: RequisitionType | null): RequisitionFormData["items"] {
  if (type && requisitionUsesAutoItems(type)) {
    return [];
  }
  return [normalizeRequisitionItemRow({}, type)];
}

function cloneFormItems(
  items: RequisitionFormData["items"],
  requisitionType?: RequisitionType | null
): RequisitionFormData["items"] {
  return items.map((item) => normalizeRequisitionItemRow({ ...item }, requisitionType));
}

function hasMeaningfulItems(items: RequisitionFormData["items"]): boolean {
  return items.some((item) => {
    const textFields = [
      item.itemName,
      item.oilGrade,
      item.partNumber,
      item.paintProductName,
      item.impaCode,
      item.partName,
    ];
    if (textFields.some((v) => (v || "").trim() !== "")) return true;
    if ((item.quantityInLiters ?? 0) > 0) return true;
    if ((item.quantity ?? 0) > 1) return true;
    return false;
  });
}

type PortSearchItem = {
  id: string;
  name: string;
  country: string;
  code?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

const DUPLICATE_ITEM_SELECTED_MESSAGE =
  "This item is already selected. It cannot be added again as an additional line.";

type ItemLikeForDedupe = {
  impaCode?: string | null;
  partNumber?: string | null;
  oilGrade?: string | null;
  machineryInstanceId?: string | null;
  paintBrand?: string | null;
  paintProductName?: string | null;
  paintColorGrade?: string | null;
  paintColorName?: string | null;
};

function normalizeDedupePart(s: string | undefined | null): string {
  return (s || "").trim().toLowerCase();
}

/** Stable key for catalog-backed line identity; null means do not dedupe this draft. */
function getCatalogDuplicateKey(
  requisitionType: RequisitionType,
  draft: ItemLikeForDedupe
): string | null {
  switch (requisitionType) {
    case RequisitionType.SPR: {
      const pn = normalizeDedupePart(draft.partNumber);
      return pn ? `spr:part:${pn}` : null;
    }
    case RequisitionType.LUB: {
      const og = normalizeDedupePart(draft.oilGrade);
      return og ? `lub:${og}` : null;
    }
    case RequisitionType.PNT: {
      const b = normalizeDedupePart(draft.paintBrand);
      const p = normalizeDedupePart(draft.paintProductName);
      if (!b || !p) return null;
      return `pnt:${b}|${p}|${normalizeDedupePart(draft.paintColorGrade)}|${normalizeDedupePart(
        draft.paintColorName
      )}`;
    }
    case RequisitionType.CHE: {
      const m = normalizeDedupePart(draft.paintBrand);
      const p = normalizeDedupePart(draft.paintProductName);
      const c = normalizeDedupePart(draft.partNumber);
      if (!m || !p) return null;
      return `che:${m}|${p}|${c}`;
    }
    default: {
      const impa = normalizeDedupePart(draft.impaCode);
      if (impa) return `impa:${impa}`;
      return null;
    }
  }
}

function isCatalogDuplicateInItems(
  requisitionType: RequisitionType,
  items: ItemLikeForDedupe[],
  excludeIndex: number,
  draft: ItemLikeForDedupe
): boolean {
  const key = getCatalogDuplicateKey(requisitionType, draft);
  if (!key) return false;
  for (let i = 0; i < items.length; i++) {
    if (i === excludeIndex) continue;
    const otherKey = getCatalogDuplicateKey(requisitionType, items[i]);
    if (otherKey && otherKey === key) return true;
  }
  return false;
}

function filterNewRowsAgainstDuplicateKeys(
  requisitionType: RequisitionType,
  existingItems: ItemLikeForDedupe[],
  newRows: ItemLikeForDedupe[]
): { accepted: ItemLikeForDedupe[]; skipped: number } {
  const used = new Set<string>();
  for (const it of existingItems) {
    const k = getCatalogDuplicateKey(requisitionType, it);
    if (k) used.add(k);
  }
  const accepted: ItemLikeForDedupe[] = [];
  let skipped = 0;
  for (const row of newRows) {
    const k = getCatalogDuplicateKey(requisitionType, row);
    if (k && used.has(k)) {
      skipped++;
      continue;
    }
    if (k) used.add(k);
    accepted.push(row);
  }
  return { accepted, skipped };
}

interface RequisitionFormProps {
  open?: boolean;
  onClose?: () => void;
  onSubmit: (data: CreateRequisitionData & { generationStatus: GenerationStatus }) => Promise<void | { requisition: { id: string; items: { id: string }[] }; redirectUrl?: string }>;
  editing?: Requisition | null;
  isSubmitting?: boolean;
  vessels: Array<{ id: string; name: string; code: string }>;
  currentUserId: string; // This would come from session
  selectedType?: RequisitionType | null; // Pre-selected requisition type
  selectedVessel?: string; // Pre-selected vessel
  manualReqNumber?: string; // Manual req number from parent
  preFilledData?: {
    heading?: string;
    description?: string;
    portOfSupply?: string;
    portAgentDetails?: string;
    contractId?: string;
    budgetCode?: string;
    glCode?: string;
    costCenter?: string;
    requisitionPurpose?: RequisitionPurpose;
  };
  displayMode?: DisplayMode;
  hideAgentDetails?: boolean; // Hide agent details section (for tabbed layout)
  spareMachineryId?: string; // Requisition-level machinery (model) for SPR
  spareManualMachineryName?: string; // Manual machinery name for SPR
  /** When true (Main Engine selected), show Plate Number column on SPR item rows. */
  spareIsMainEngine?: boolean;
  /** Common drawing number for all SPR line items (set on create-requisition machinery section). */
  spareCommonDrawingNumber?: string;
  /** Selected sub-category codes from create-requisition setup. */
  selectedSubCategoryCodes?: string[];
  subCategoryOptions?: Array<{ code: string; name: string; defaultBudgetCategoryCode?: string | null }>;
  /** LUB requisitions: supplier selected in setup row. */
  selectedLubeOilSupplierId?: string;
  onAddManualItems?: (items: Array<{
    partNumber: string;
    partName: string;
    itemNumber: string;
    drawingNumber: string;
    quantity: number;
    unit: string;
    currentRob: number;
    remarks: string;
  }>) => void; // Callback to add items from manual entry form
  /** Persisted line-item drafts keyed by requisition type (survives type toggles / remounts). */
  itemsSnapshotByType?: Partial<Record<RequisitionType, RequisitionFormData["items"]>>;
  onSaveItemsSnapshot?: (type: RequisitionType, items: RequisitionFormData["items"]) => void;
}

export function RequisitionForm({
  open = true,
  onClose,
  onSubmit,
  editing,
  isSubmitting = false,
  vessels,
  currentUserId,
  selectedType = null,
  selectedVessel = "",
  manualReqNumber = "",
  preFilledData,
  displayMode = "dialog",
  hideAgentDetails = false,
  spareMachineryId,
  spareManualMachineryName,
  spareIsMainEngine = false,
  spareCommonDrawingNumber = "",
  selectedSubCategoryCodes = [],
  subCategoryOptions = [],
  selectedLubeOilSupplierId,
  onAddManualItems,
  itemsSnapshotByType,
  onSaveItemsSnapshot,
}: RequisitionFormProps) {
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [pendingGenerationStatus, setPendingGenerationStatus] = useState<GenerationStatus>(
    GenerationStatus.SAVED_AS_DRAFT
  );
  const [itemAttachments, setItemAttachments] = useState<Record<number, File[]>>({});
  const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const [impaSearchResults, setImpaSearchResults] = useState<Record<number, any[]>>({});
  const [impaSearchQuery, setImpaSearchQuery] = useState<Record<number, string>>({});
  const [impaPopoverOpen, setImpaPopoverOpen] = useState<Record<number, boolean>>({});
  const searchTimeoutRef = useRef<Record<number, NodeJS.Timeout>>({});
  
  // Spare requisition state
  const [machineryInstances, setMachineryInstances] = useState<any[]>([]);
  const [machineryComboboxOpen, setMachineryComboboxOpen] = useState<Record<number, boolean>>({});
  const [sparePartsSearchResults, setSparePartsSearchResults] = useState<Record<number, any[]>>({});
  const [portComboboxOpen, setPortComboboxOpen] = useState(false);
  const [portSearchQuery, setPortSearchQuery] = useState("");
  const [portSearchResults, setPortSearchResults] = useState<PortSearchItem[]>([]);
  const [portSearchLoading, setPortSearchLoading] = useState(false);
  const [sparePartsSearchQuery, setSparePartsSearchQuery] = useState<Record<number, string>>({});
  const [sparePartsPopoverOpen, setSparePartsPopoverOpen] = useState<Record<number, boolean>>({});
  const [plateCatalogByPlate, setPlateCatalogByPlate] = useState<
    Record<string, MainEnginePlateCatalogEntry[]>
  >({});
  const [plateCatalogLoading, setPlateCatalogLoading] = useState<Record<string, boolean>>({});
  const [plateItemComboboxOpen, setPlateItemComboboxOpen] = useState<Record<number, boolean>>({});
  const [selectedMachineryDetails, setSelectedMachineryDetails] = useState<Record<number, any>>({});
  const [useManualMachinery, setUseManualMachinery] = useState<Record<number, boolean>>({});
  
  // Lube oil requisition state
  const [lubeProducts, setLubeProducts] = useState<LubeProductOption[]>([]);
  const [lubeTypeComboboxOpen, setLubeTypeComboboxOpen] = useState<Record<number, boolean>>({});

  // CTM requisition state
  const [ctmAmount, setCtmAmount] = useState<string>("");
  const [ctmCurrency, setCtmCurrency] = useState<string>("USD");
  const [ctmPort, setCtmPort] = useState<string>("");
  const [ctmNoteDenominations, setCtmNoteDenominations] = useState<Record<number, number>>({});
  const [ctmAgentDetails, setCtmAgentDetails] = useState<string>("");

  // REP/SER requisition state
  const [repSerMachineryInstanceId, setRepSerMachineryInstanceId] = useState<string>("");
  const [repSerManualMachineryName, setRepSerManualMachineryName] = useState<string>("");
  const [repSerUseManualMachinery, setRepSerUseManualMachinery] = useState<boolean>(false);
  const [repSerDateOfArrival, setRepSerDateOfArrival] = useState<string>("");
  const [repSerMachineryDetails, setRepSerMachineryDetails] = useState<string>("");
  const [repSerDamageReport, setRepSerDamageReport] = useState<File[]>([]);
  const [repSerTroubleshootingReport, setRepSerTroubleshootingReport] = useState<File[]>([]);
  const [repSerMachineryComboboxOpen, setRepSerMachineryComboboxOpen] = useState<boolean>(false);
  const damageReportInputRef = useRef<HTMLInputElement | null>(null);
  const troubleshootingReportInputRef = useRef<HTMLInputElement | null>(null);

  // Paint requisition state
  const [paintBrands, setPaintBrands] = useState<string[]>([]);
  /** Single maker/brand for the whole PNT requisition (applied to every line). */
  const [requisitionPaintBrand, setRequisitionPaintBrand] = useState("");
  const [paintManualBrandMode, setPaintManualBrandMode] = useState(false);
  const [paintManualBrandValue, setPaintManualBrandValue] = useState("");
  const [paintSearchResults, setPaintSearchResults] = useState<Record<number, any[]>>({});
  const [paintSearchQuery, setPaintSearchQuery] = useState<Record<number, string>>({});
  const [paintPopoverOpen, setPaintPopoverOpen] = useState<Record<number, boolean>>({});
  const [paintAddDialogOpen, setPaintAddDialogOpen] = useState<Record<number, boolean>>({});
  const [newPaintData, setNewPaintData] = useState<Record<number, any>>({});
  const [manualBrandEntry, setManualBrandEntry] = useState<Record<number, boolean>>({});
  const [manualBrandValue, setManualBrandValue] = useState<Record<number, string>>({});
  const [paintColorOptions, setPaintColorOptions] = useState<Record<number, PaintColorOption[]>>({});
  const [paintColorSearchQuery, setPaintColorSearchQuery] = useState<Record<number, string>>({});
  const [paintColorPopoverOpen, setPaintColorPopoverOpen] = useState<Record<number, boolean>>({});

  // Chemical requisition state
  const [chemicalMakers, setChemicalMakers] = useState<string[]>([]);
  const [requisitionChemicalMaker, setRequisitionChemicalMaker] = useState("");
  const [chemicalManualMakerMode, setChemicalManualMakerMode] = useState(false);
  const [chemicalManualMakerValue, setChemicalManualMakerValue] = useState("");
  const [chemicalSearchResults, setChemicalSearchResults] = useState<
    Record<number, ChemicalCatalogProduct[]>
  >({});
  const [chemicalSearchQuery, setChemicalSearchQuery] = useState<Record<number, string>>({});
  const [chemicalPopoverOpen, setChemicalPopoverOpen] = useState<Record<number, boolean>>({});

  // Copy from previous requisition (SPR): search → pick lines → import (same machinery only)
  const [showCopyDialog, setShowCopyDialog] = useState(false);
  const [copyImportStep, setCopyImportStep] = useState<"search" | "pick_items">("search");
  const [copySearchQuery, setCopySearchQuery] = useState("");
  const [copySearchResults, setCopySearchResults] = useState<any[]>([]);
  const [copySearchLoading, setCopySearchLoading] = useState(false);
  const [copySourceMeta, setCopySourceMeta] = useState<{
    id: string;
    displayNumber: string;
    heading: string;
  } | null>(null);
  const [copyEligibleItems, setCopyEligibleItems] = useState<any[]>([]);
  const [copySelectedItemIds, setCopySelectedItemIds] = useState<Set<string>>(() => new Set());
  const [loadingCopyReqDetail, setLoadingCopyReqDetail] = useState(false);
  const copySearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [duplicateItemAlertOpen, setDuplicateItemAlertOpen] = useState(false);
  const [duplicateItemAlertMessage, setDuplicateItemAlertMessage] = useState("");

  // Available note denominations per currency
  const getAvailableDenominations = (currency: string): number[] => {
    const denominations: Record<string, number[]> = {
      USD: [1, 5, 10, 20, 50, 100],
      EUR: [5, 10, 20, 50, 100, 200, 500],
      GBP: [5, 10, 20, 50],
      INR: [10, 20, 50, 100, 200, 500, 2000],
      SGD: [2, 5, 10, 50, 100, 1000],
      JPY: [1000, 2000, 5000, 10000],
      AUD: [5, 10, 20, 50, 100],
      CAD: [5, 10, 20, 50, 100],
      CHF: [10, 20, 50, 100, 200, 1000],
      CNY: [1, 5, 10, 20, 50, 100],
    };
    return denominations[currency] || denominations.USD;
  };

  // Calculate total from note denominations
  const calculateTotalFromNotes = (): number => {
    const denominations = getAvailableDenominations(ctmCurrency);
    return denominations.reduce((total, denom) => {
      return total + (denom * (ctmNoteDenominations[denom] || 0));
    }, 0);
  };

  // Validate note denominations match requested amount
  const validateNoteDenominations = (): boolean => {
    const requestedAmount = parseFloat(ctmAmount) || 0;
    const calculatedTotal = calculateTotalFromNotes();
    return Math.abs(requestedAmount - calculatedTotal) < 0.01; // Allow small floating point differences
  };

  const form = useForm<RequisitionFormData>({
    resolver: zodResolver(requisitionFormSchema),
    defaultValues: {
      heading: preFilledData?.heading || "",
      manualReqNumber: manualReqNumber || "",
      description: preFilledData?.description || "",
      portOfSupply: preFilledData?.portOfSupply || "",
      requisitionType: selectedType || RequisitionType.STR,
      requisitionPurpose: preFilledData?.requisitionPurpose || REQUISITION_PURPOSE.ROUTINE_MAINTENANCE,
      portAgentDetails: preFilledData?.portAgentDetails || "",
      vesselId: selectedVessel || "",
      contractId: preFilledData?.contractId || "",
      budgetCode: preFilledData?.budgetCode || "",
      glCode: preFilledData?.glCode || "",
      costCenter: preFilledData?.costCenter || "",
      items: defaultRequisitionItems(selectedType),
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const prevSelectedTypeRef = useRef<RequisitionType | "">(selectedType || "");

  // Reset form when editing record changes
  useEffect(() => {
    if (!editing) return;

    form.reset({
      heading: editing.heading,
      manualReqNumber: editing.manualReqNumber || "",
      description: editing.description || "",
      portOfSupply: editing.portOfSupply || "",
      requisitionType: editing.requisitionType,
      requisitionPurpose: (editing as any).requisitionPurpose || REQUISITION_PURPOSE.ROUTINE_MAINTENANCE,
      portAgentDetails: editing.portAgentDetails || "",
      vesselId: editing.vesselId,
      items: editing.items?.map((item) =>
        normalizeRequisitionItemRow(
          {
            itemName: item.itemName,
            impaCode: (item as { impaCode?: string | null }).impaCode,
            description: item.description || "",
            quantity: Math.max(1, Math.floor(Number(item.quantity) || 1)),
            unit: item.unit || (editing.requisitionType === RequisitionType.SPR ? "PCS" : ""),
            urgency: item.urgency,
            remarks: item.remarks || "",
            machineryInstanceId: item.machineryInstanceId || "",
            manualMachineryName: item.manualMachineryName || "",
            partNumber: item.partNumber || "",
            plateNumber: (item as { plateNumber?: string | null }).plateNumber || "",
            partName: item.partName || "",
            itemNumber: item.itemNumber || "",
            drawingNumber: item.drawingNumber || "",
            currentRob: item.currentRob ? Number(item.currentRob) : 0,
            addToInventory: item.addToInventory !== false,
            oilGrade: item.oilGrade || "",
            quantityInLiters: item.quantityInLiters ? Number(item.quantityInLiters) : 0,
            paintBrand: item.paintBrand || "",
            paintProductName: item.paintProductName || "",
            paintColorGrade: item.paintColorGrade || "",
            paintColorName: item.paintColorName || "",
            paintColorHex: item.paintColorHex || "",
            paintType: item.paintType || "",
            paintCategory: item.paintCategory || "",
          },
          editing.requisitionType
        )
      ) || [normalizeRequisitionItemRow({}, editing.requisitionType)],
    });

    if (editing.requisitionType === RequisitionType.CTM && editing.items) {
      const ctmItems = editing.items.filter(item => item.itemName.includes('CTM') || item.itemName.includes('Note'));
      if (ctmItems.length > 0) {
        const firstItem = ctmItems[0];
        const currencyMatch = firstItem.itemName.match(/(USD|EUR|GBP|INR|SGD|JPY|AUD|CAD|CHF|CNY)/);
        if (currencyMatch) {
          setCtmCurrency(currencyMatch[1]);
        }
        if (editing.portOfSupply) {
          setCtmPort(editing.portOfSupply);
        }
        if (editing.portAgentDetails) {
          setCtmAgentDetails(editing.portAgentDetails);
        }
      }
    }
  }, [editing, form]);

  // Requisition type change: swap item rows (restore prior draft for that type when available)
  useEffect(() => {
    if (editing) return;

    const nextType = (selectedType || RequisitionType.STR) as RequisitionType;
    const prevType = prevSelectedTypeRef.current;
    const restored = itemsSnapshotByType?.[nextType];

    if (prevType === nextType) {
      const currentItems = form.getValues("items");
      if (restored && restored.length > 0 && !hasMeaningfulItems(currentItems)) {
        form.setValue("items", cloneFormItems(restored, nextType), { shouldValidate: false });
        toast.info(`Restored ${restored.length} item(s) from your previous ${nextType} entry.`);
      }
      return;
    }

    const currentItems = form.getValues("items");
    if (prevType && onSaveItemsSnapshot && hasMeaningfulItems(currentItems)) {
      onSaveItemsSnapshot(prevType as RequisitionType, cloneFormItems(currentItems, prevType as RequisitionType));
    }

    const nextItems =
      restored && restored.length > 0
        ? cloneFormItems(restored, nextType)
        : defaultRequisitionItems(selectedType);

    if (restored && restored.length > 0) {
      toast.info(`Restored ${restored.length} item(s) from your previous ${nextType} entry.`);
    }

    form.setValue("requisitionType", nextType, { shouldValidate: false });
    form.setValue("items", nextItems, { shouldValidate: false });

    if (nextType === RequisitionType.CTM && preFilledData?.portOfSupply) {
      setCtmPort(preFilledData.portOfSupply);
    }

    prevSelectedTypeRef.current = nextType;
  }, [selectedType, editing, form, itemsSnapshotByType, onSaveItemsSnapshot, preFilledData?.portOfSupply]);

  // Vessel / manual ref changes must not wipe line items
  useEffect(() => {
    if (editing) return;
    form.setValue("vesselId", selectedVessel || "", { shouldValidate: false });
    form.setValue("manualReqNumber", manualReqNumber || "", { shouldValidate: false });
  }, [selectedVessel, manualReqNumber, editing, form]);

  // Sync preFilledData changes to form when not editing (header fields only — never reset items)
  useEffect(() => {
    if (!editing && preFilledData) {
      if (preFilledData.heading !== undefined) {
        form.setValue("heading", preFilledData.heading, { shouldValidate: true });
      }
      if (preFilledData.description !== undefined) {
        form.setValue("description", preFilledData.description, { shouldValidate: true });
      }
      if (preFilledData.requisitionPurpose !== undefined) {
        form.setValue("requisitionPurpose", preFilledData.requisitionPurpose, { shouldValidate: false });
      }
      if (preFilledData.contractId !== undefined) {
        form.setValue("contractId", preFilledData.contractId, { shouldValidate: false });
      }
      if (preFilledData.budgetCode !== undefined) {
        form.setValue("budgetCode", preFilledData.budgetCode, { shouldValidate: false });
      }
      if (preFilledData.glCode !== undefined) {
        form.setValue("glCode", preFilledData.glCode, { shouldValidate: false });
      }
      if (preFilledData.costCenter !== undefined) {
        form.setValue("costCenter", preFilledData.costCenter, { shouldValidate: false });
      }
      if (preFilledData.portOfSupply !== undefined) {
        form.setValue("portOfSupply", preFilledData.portOfSupply, { shouldValidate: true });
        if (
          selectedType === RequisitionType.LUB ||
          form.getValues("requisitionType") === RequisitionType.LUB
        ) {
          form.getValues("items").forEach((_, i) => {
            form.setValue(`items.${i}.portOfSupply`, preFilledData.portOfSupply ?? "", {
              shouldValidate: false,
            });
          });
        }
        if (selectedType === RequisitionType.CTM) {
          setCtmPort(preFilledData.portOfSupply);
        }
      }
      if (preFilledData.portAgentDetails !== undefined) {
        form.setValue("portAgentDetails", preFilledData.portAgentDetails, { shouldValidate: false });
      }
    }
  }, [preFilledData, editing, form, selectedType]);

  // Handle requisition type changes
  useEffect(() => {
    const requisitionType = form.watch("requisitionType");
    if (requisitionUsesAutoItems(requisitionType)) {
      // Clear items — CTM/REP/SER auto-generate line items on submit
      form.setValue("items", [], { shouldValidate: false });
    }
    if (requisitionType === RequisitionType.CTM) {
      // Reset REP/SER state when switching to CTM
      setRepSerMachineryInstanceId("");
      setRepSerManualMachineryName("");
      setRepSerUseManualMachinery(false);
      setRepSerDateOfArrival("");
      setRepSerMachineryDetails("");
      setRepSerDamageReport([]);
      setRepSerTroubleshootingReport([]);
    } else if (requisitionType === RequisitionType.REP || requisitionType === RequisitionType.SER) {
      // Reset CTM state when switching to REP/SER
      setCtmAmount("");
      setCtmCurrency("USD");
      setCtmPort("");
      setCtmNoteDenominations({});
      setCtmAgentDetails("");
    } else {
      // Reset CTM state when switching away from CTM
      setCtmAmount("");
      setCtmCurrency("USD");
      setCtmPort("");
      setCtmNoteDenominations({});
      setCtmAgentDetails("");
      // Reset REP/SER state when switching away from REP/SER
      setRepSerMachineryInstanceId("");
      setRepSerManualMachineryName("");
      setRepSerUseManualMachinery(false);
      setRepSerDateOfArrival("");
      setRepSerMachineryDetails("");
      setRepSerDamageReport([]);
      setRepSerTroubleshootingReport([]);
      // Ensure at least one item exists for other requisition types
      const currentItems = form.getValues("items");
      const reqType = form.getValues("requisitionType");
      if (currentItems.length === 0) {
        form.setValue("items", [{
          itemName: "",
          description: "",
          quantity: 1,
          unit: reqType === RequisitionType.SPR ? "PCS" : "",
          urgency: ItemUrgency.NORMAL,
          remarks: "",
        }]);
      }
    }
  }, [form.watch("requisitionType")]);

  // When requisition type is SPR, ensure any item with empty unit gets "PCS" so validation passes and UI matches
  const watchedReqType = form.watch("requisitionType");
  const watchedItems = form.watch("items");
  useEffect(() => {
    if (watchedReqType !== RequisitionType.SPR) return;
    const items = form.getValues("items");
    let changed = false;
    const updated = items.map((item) => {
      if (!item.unit || item.unit.trim() === "") {
        changed = true;
        return { ...item, unit: "PCS" };
      }
      return item;
    });
    if (changed) form.setValue("items", updated, { shouldValidate: false });
  }, [watchedReqType, watchedItems?.length]);

  const applyPaintBrandToAllItems = useCallback(
    (brand: string) => {
      const trimmed = brand.trim();
      setRequisitionPaintBrand(trimmed);
      const items = form.getValues("items");
      items.forEach((_, i) => {
        form.setValue(`items.${i}.paintBrand`, trimmed, { shouldValidate: false });
      });
    },
    [form]
  );

  const applyChemicalMakerToAllItems = useCallback(
    (maker: string) => {
      const trimmed = maker.trim();
      setRequisitionChemicalMaker(trimmed);
      const items = form.getValues("items");
      items.forEach((_, i) => {
        form.setValue(`items.${i}.paintBrand`, trimmed, { shouldValidate: false });
      });
    },
    [form]
  );

  useEffect(() => {
    if (form.watch("requisitionType") !== RequisitionType.PNT) {
      setRequisitionPaintBrand("");
      setPaintManualBrandMode(false);
      setPaintManualBrandValue("");
      return;
    }
    const fromItems = form
      .getValues("items")
      .map((i) => i.paintBrand?.trim() || "")
      .find(Boolean);
    if (fromItems) {
      setRequisitionPaintBrand(fromItems);
    }
  }, [editing?.id, form]);

  useEffect(() => {
    if (form.watch("requisitionType") !== RequisitionType.PNT || !requisitionPaintBrand) return;
    const items = form.getValues("items");
    items.forEach((item, i) => {
      if ((item.paintBrand || "") !== requisitionPaintBrand) {
        form.setValue(`items.${i}.paintBrand`, requisitionPaintBrand, { shouldValidate: false });
      }
    });
  }, [requisitionPaintBrand, fields.length, form]);

  useEffect(() => {
    if (form.watch("requisitionType") !== RequisitionType.CHE) {
      setRequisitionChemicalMaker("");
      setChemicalManualMakerMode(false);
      setChemicalManualMakerValue("");
      return;
    }
    const fromItems = form
      .getValues("items")
      .map((i) => i.paintBrand?.trim() || "")
      .find(Boolean);
    if (fromItems) {
      setRequisitionChemicalMaker(fromItems);
    }
  }, [editing?.id, form]);

  useEffect(() => {
    if (form.watch("requisitionType") !== RequisitionType.CHE || !requisitionChemicalMaker) return;
    const items = form.getValues("items");
    items.forEach((item, i) => {
      if ((item.paintBrand || "") !== requisitionChemicalMaker) {
        form.setValue(`items.${i}.paintBrand`, requisitionChemicalMaker, { shouldValidate: false });
      }
    });
  }, [requisitionChemicalMaker, fields.length, form]);

  const watchedPortOfSupply = form.watch("portOfSupply");
  useEffect(() => {
    if (form.watch("requisitionType") !== RequisitionType.LUB) return;
    const port = watchedPortOfSupply || "";
    form.getValues("items").forEach((item, i) => {
      if ((item.portOfSupply || "") !== port) {
        form.setValue(`items.${i}.portOfSupply`, port, { shouldValidate: false });
      }
    });
  }, [watchedPortOfSupply, fields.length, form]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      Object.values(searchTimeoutRef.current).forEach(timeout => {
        if (timeout) clearTimeout(timeout);
      });
    };
  }, []);

  const handleSubmit = async (data: RequisitionFormData, generationStatus: GenerationStatus) => {
    // For SPR requisitions, set machinery for all items from requisition-level
    let itemsToSubmit = data.items;
    if (data.requisitionType === RequisitionType.SPR) {
      const commonDrawing = spareCommonDrawingNumber.trim();
      itemsToSubmit = data.items.map(item => ({
        ...item,
        machineryInstanceId: spareMachineryId || undefined,
        manualMachineryName: spareManualMachineryName || undefined,
        drawingNumber: commonDrawing || item.drawingNumber || "",
      }));
    }

    if (data.requisitionType === RequisitionType.PNT) {
      const brand = requisitionPaintBrand.trim() || data.items[0]?.paintBrand?.trim() || "";
      if (!brand) {
        toast.error("Please select a paint brand for this requisition");
        return;
      }
      itemsToSubmit = data.items.map((item) => ({
        ...item,
        paintBrand: brand,
      }));
    }

    if (data.requisitionType === RequisitionType.CHE) {
      const maker = requisitionChemicalMaker.trim() || data.items[0]?.paintBrand?.trim() || "";
      if (!maker) {
        toast.error("Please select a chemical maker for this requisition");
        return;
      }
      itemsToSubmit = data.items.map((item) => ({
        ...item,
        paintBrand: maker,
        itemName:
          item.itemName?.trim() ||
          `${maker} ${item.paintProductName || ""}${item.partNumber ? ` (${item.partNumber})` : ""}`.trim(),
      }));
    }

    if (data.requisitionType === RequisitionType.LUB) {
      const port = data.portOfSupply?.trim() || "";
      if (!port) {
        toast.error("Please enter supply port for this requisition");
        return;
      }
      itemsToSubmit = data.items.map((item) => ({
        ...item,
        portOfSupply: port,
        quantity: item.quantityInLiters ?? item.quantity,
      }));
    }
    
    // For CTM requisitions, create items from note denominations
    if (data.requisitionType === RequisitionType.CTM) {
      itemsToSubmit = [];
    }
    
    // For REP/SER requisitions, validate and prepare data
    if (data.requisitionType === RequisitionType.REP || data.requisitionType === RequisitionType.SER) {
      // Validate REP/SER specific fields
      if (!repSerUseManualMachinery && !repSerMachineryInstanceId) {
        toast.error("Please select machinery/equipment");
        return;
      }
      if (repSerUseManualMachinery && !repSerManualMachineryName.trim()) {
        toast.error("Please enter machinery/equipment name");
        return;
      }
      if (!data.portOfSupply) {
        toast.error("Please enter the port");
        return;
      }
      if (!repSerDateOfArrival) {
        toast.error("Please enter the date of arrival");
        return;
      }
      if (!data.portAgentDetails) {
        toast.error("Please enter agency details");
        return;
      }
      if (!repSerMachineryDetails) {
        toast.error("Please enter details of machinery/equipment");
        return;
      }

      // Create a service/repair item with all the details
      const machineryName = repSerUseManualMachinery
        ? repSerManualMachineryName.trim()
        : machineryInstances.find(m => m.id === repSerMachineryInstanceId)?.name || "Unknown Machinery";
      
      // Build attachment information
      const attachmentInfo: string[] = [];
      if (repSerDamageReport.length > 0) {
        attachmentInfo.push(`Damage Report: ${repSerDamageReport.map(f => f.name).join(', ')}`);
      }
      if (repSerTroubleshootingReport.length > 0) {
        attachmentInfo.push(`Troubleshooting Report: ${repSerTroubleshootingReport.map(f => f.name).join(', ')}`);
      }
      
      const serviceDescription = `${data.requisitionType === RequisitionType.REP ? 'Repair' : 'Service'} required for ${machineryName}. ` +
        `Port: ${data.portOfSupply}. Date of Arrival: ${repSerDateOfArrival}. ` +
        `Machinery Details: ${repSerMachineryDetails}` +
        (attachmentInfo.length > 0 ? ` | Attachments: ${attachmentInfo.join('; ')}` : '');

      itemsToSubmit = [{
        itemName: `${data.requisitionType === RequisitionType.REP ? 'Repair' : 'Service'} - ${machineryName}`,
        description: serviceDescription,
        quantity: 1,
        unit: "service",
        urgency: ItemUrgency.NORMAL,
        remarks: `Port: ${data.portOfSupply} | Date of Arrival: ${repSerDateOfArrival} | Agency: ${data.portAgentDetails}`,
      }];
    }
    
    if (data.requisitionType === RequisitionType.CTM) {
      // Validate CTM data
      if (!ctmAmount || parseFloat(ctmAmount) <= 0) {
        toast.error("Please enter a valid amount");
        return;
      }
      
      if (!ctmCurrency) {
        toast.error("Please select a currency");
        return;
      }
      
      if (!ctmPort) {
        toast.error("Please enter the port name");
        return;
      }
      
      if (!ctmAgentDetails) {
        toast.error("Please enter agent details");
        return;
      }
      
      if (!validateNoteDenominations()) {
        toast.error("Note denominations do not match the requested amount. Please check your entries.");
        return;
      }

      // Create items from note denominations
      const denominations = getAvailableDenominations(ctmCurrency);
      itemsToSubmit = denominations
        .filter(denom => ctmNoteDenominations[denom] && ctmNoteDenominations[denom] > 0)
        .map(denom => ({
          itemName: `${ctmCurrency} ${denom} Note`,
          description: `Request for ${ctmNoteDenominations[denom]} notes of ${ctmCurrency} ${denom}`,
          quantity: ctmNoteDenominations[denom],
          unit: "notes",
          urgency: ItemUrgency.NORMAL,
          remarks: `Total: ${ctmCurrency} ${denom * ctmNoteDenominations[denom]}`,
        }));

      // If no notes specified, create a summary item
      if (itemsToSubmit.length === 0) {
        itemsToSubmit = [{
          itemName: `CTM Request - ${ctmCurrency} ${ctmAmount}`,
          description: `Cash to Master request for ${ctmCurrency} ${ctmAmount} at ${ctmPort}`,
          quantity: 1,
          unit: "request",
          urgency: ItemUrgency.NORMAL,
          remarks: `Port: ${ctmPort} | Agent: ${ctmAgentDetails}`,
        }];
      }

      // Update port of supply and agent details
      data.portOfSupply = ctmPort;
      data.portAgentDetails = ctmAgentDetails;
    }

    const submitData: CreateRequisitionData & { generationStatus: GenerationStatus; createdById: string } = {
      ...data,
      requisitionPurpose: (data.requisitionPurpose as RequisitionPurpose) || REQUISITION_PURPOSE.ROUTINE_MAINTENANCE,
      items: itemsToSubmit,
      generationStatus,
      createdById: currentUserId, // This would come from session
    };
    const result = await onSubmit(submitData);
    // If parent returned created requisition and we have item attachments, upload and verify
    if (result && typeof result === "object" && result.requisition?.id && result.requisition.items?.length && Object.keys(itemAttachments).length > 0) {
      const failures: string[] = [];
      let savedCount = 0;
      for (let i = 0; i < result.requisition.items.length; i++) {
        const files = itemAttachments[i];
        if (!files?.length) continue;
        const itemId = result.requisition.items[i]?.id;
        if (!itemId) {
          failures.push(`Item ${i + 1}: missing item id from server`);
          continue;
        }
        for (const file of files) {
          try {
            const formData = new FormData();
            formData.append("file", file);
            const uploadRes = await fetch(`/api/requisitions/${result.requisition.id}/items/${itemId}/attachments`, {
              method: "POST",
              body: formData,
              credentials: "include",
            });
            if (!uploadRes.ok) {
              const err = await uploadRes.json().catch(() => ({}));
              const msg = err.error || uploadRes.statusText || `HTTP ${uploadRes.status}`;
              failures.push(`${file.name}: ${msg}`);
              continue;
            }
            const uploadJson = await uploadRes.json().catch(() => null);
            const attachmentIds = uploadJson?.attachments?.map((a: { id: string }) => a.id) ?? [];
            if (attachmentIds.length === 0) {
              failures.push(`${file.name}: server did not return attachment id (not saved)`);
              continue;
            }
            const verifyRes = await fetch(
              `/api/requisitions/${result.requisition.id}/items/${itemId}/attachments/${attachmentIds[0]}`,
              { method: "GET", credentials: "include" }
            );
            if (!verifyRes.ok) {
              failures.push(`${file.name}: saved but verification failed (${verifyRes.status})`);
              savedCount += 1;
              continue;
            }
            savedCount += 1;
          } catch (err: any) {
            failures.push(`${file.name}: ${err?.message || "Network error"}`);
          }
        }
      }
      const totalFiles = Object.values(itemAttachments).flat().length;
      if (savedCount === totalFiles && totalFiles > 0) {
        toast.success(`${savedCount} attachment(s) saved to database successfully.`);
      } else if (savedCount > 0) {
        toast.warning(`${savedCount} of ${totalFiles} attachment(s) saved. Failed: ${failures.join("; ")}`);
      } else if (failures.length > 0) {
        toast.error(`Attachments could not be saved. Causes: ${failures.join("; ")}`);
      }
    }
    if (result && typeof result === "object" && result.redirectUrl) {
      window.location.href = result.redirectUrl;
      return;
    }
  };

  const onFormSubmit = async (data: RequisitionFormData) => {
    try {
      console.log('[RequisitionForm] Submitting form with data:', {
        heading: data.heading,
        vesselId: data.vesselId,
        requisitionType: data.requisitionType,
        itemsCount: data.items.length,
        generationStatus: pendingGenerationStatus,
      });
      
      await handleSubmit(data, pendingGenerationStatus);
      setShowSaveConfirm(false);
    } catch (error) {
      console.error('[RequisitionForm] Error submitting form:', error);
      toast.error('Failed to save requisition. Please check the form and try again.');
    }
  };

  const handleSaveAsDraft = () => {
    console.log('[RequisitionForm] Save as Draft clicked');
    
    // Check form validity before showing confirmation
    const isValid = form.formState.isValid;
    const errors = form.formState.errors;
    
    console.log('[RequisitionForm] Form validation state:', {
      isValid,
      errors: Object.keys(errors),
      errorsDetails: errors,
    });
    
    setPendingGenerationStatus(GenerationStatus.SAVED_AS_DRAFT);
    setShowSaveConfirm(true);
  };

  const sprSourceItemMatchesSelectedMachinery = useCallback(
    (item: any) => {
      const mid = spareMachineryId?.trim();
      if (mid) {
        return item.machineryInstanceId === mid;
      }
      const manual = spareManualMachineryName?.trim();
      if (manual) {
        return (item.manualMachineryName || "").trim().toLowerCase() === manual.toLowerCase();
      }
      return false;
    },
    [spareMachineryId, spareManualMachineryName]
  );

  const resetSprCopyDialog = useCallback(() => {
    setCopyImportStep("search");
    setCopySearchQuery("");
    setCopySearchResults([]);
    setCopySourceMeta(null);
    setCopyEligibleItems([]);
    setCopySelectedItemIds(new Set());
    setLoadingCopyReqDetail(false);
    setCopySearchLoading(false);
  }, []);

  const closeSprCopyDialog = useCallback(
    (open: boolean) => {
      if (!open) resetSprCopyDialog();
      setShowCopyDialog(open);
    },
    [resetSprCopyDialog]
  );

  const fetchSprCopySearch = useCallback(
    async (q: string) => {
      const vesselId = form.getValues("vesselId");
      if (!vesselId) return;
      const params = new URLSearchParams({
        vesselId,
        requisitionType: RequisitionType.SPR,
        limit: "30",
        q: q.trim(),
      });
      if (spareMachineryId?.trim()) {
        params.set("machineryInstanceId", spareMachineryId.trim());
      } else if (spareManualMachineryName?.trim()) {
        params.set("manualMachineryName", spareManualMachineryName.trim());
      }
      setCopySearchLoading(true);
      try {
        const res = await fetch(`/api/requisitions/search?${params.toString()}`, {
          credentials: "include",
        });
        if (!res.ok) {
          toast.error("Failed to search requisitions");
          setCopySearchResults([]);
          return;
        }
        const data = await res.json();
        setCopySearchResults(data.requisitions || []);
      } catch {
        toast.error("Failed to search requisitions");
        setCopySearchResults([]);
      } finally {
        setCopySearchLoading(false);
      }
    },
    [form, spareMachineryId, spareManualMachineryName]
  );

  useEffect(() => {
    if (!showCopyDialog || copyImportStep !== "search") return;
    if (copySearchTimerRef.current) clearTimeout(copySearchTimerRef.current);
    copySearchTimerRef.current = setTimeout(() => {
      void fetchSprCopySearch(copySearchQuery);
    }, 350);
    return () => {
      if (copySearchTimerRef.current) clearTimeout(copySearchTimerRef.current);
    };
  }, [copySearchQuery, showCopyDialog, copyImportStep, fetchSprCopySearch]);

  const handleCopyFromPrevious = () => {
    const vesselId = form.getValues("vesselId");
    if (!vesselId) {
      toast.error("Please select a vessel first");
      return;
    }
    if (!spareMachineryId?.trim() && !spareManualMachineryName?.trim()) {
      toast.error(
        "Select machinery for this spare requisition before copying parts. Only parts for that machinery can be imported."
      );
      return;
    }
    resetSprCopyDialog();
    setShowCopyDialog(true);
  };

  const openSprCopyPickItems = async (
    reqId: string,
    meta: { displayNumber: string; heading: string }
  ) => {
    setLoadingCopyReqDetail(true);
    try {
      const res = await fetch(`/api/requisitions/${reqId}`, { credentials: "include" });
      if (!res.ok) {
        toast.error("Could not load requisition");
        return;
      }
      const data = await res.json();
      const req = data.requisition || data;
      const items = (req.items || []).filter(sprSourceItemMatchesSelectedMachinery);
      if (items.length === 0) {
        toast.error("No lines for the selected machinery were found on this requisition.");
        return;
      }
      setCopySourceMeta({ id: reqId, displayNumber: meta.displayNumber, heading: meta.heading });
      setCopyEligibleItems(items);
      setCopySelectedItemIds(new Set(items.map((it: any) => String(it.id))));
      setCopyImportStep("pick_items");
    } catch {
      toast.error("Could not load requisition");
    } finally {
      setLoadingCopyReqDetail(false);
    }
  };

  const mapSprApiItemToFormRow = (item: any) => ({
    itemName: (item.partName || item.itemName || "").trim() || "Spare part",
    impaCode: "",
    description: item.description ?? "",
    quantity: Math.max(1, Math.floor(Number(item.quantity) || 1)),
    unit: item.unit || "PCS",
    urgency:
      item.urgency && Object.values(ItemUrgency).includes(item.urgency)
        ? item.urgency
        : ItemUrgency.NORMAL,
    remarks: item.remarks ?? "",
    machineryInstanceId: spareMachineryId?.trim() ? spareMachineryId : "",
    manualMachineryName: spareManualMachineryName?.trim() ? spareManualMachineryName : "",
    partNumber: item.partNumber ?? "",
    plateNumber: item.plateNumber ?? "",
    partName: item.partName ?? "",
    itemNumber: item.itemNumber ?? "",
    drawingNumber: item.drawingNumber ?? "",
    currentRob: 0,
    addToInventory: item.addToInventory !== false,
    oilGrade: item.oilGrade ?? "",
    quantityInLiters: item.quantityInLiters != null ? Number(item.quantityInLiters) : 0,
    paintBrand: item.paintBrand ?? "",
    paintProductName: item.paintProductName ?? "",
    paintColorGrade: item.paintColorGrade ?? "",
    paintColorName: item.paintColorName ?? "",
    paintColorHex: item.paintColorHex ?? "",
    paintType: item.paintType ?? "",
    paintCategory: item.paintCategory ?? "",
  });

  const appendCopiedSprItems = (items: any[]) => {
    const rt = form.getValues("requisitionType");
    const newItems = items.map(mapSprApiItemToFormRow);
    const currentItems = form.getValues("items");
    const { accepted, skipped } = filterNewRowsAgainstDuplicateKeys(rt, currentItems, newItems);
    if (accepted.length === 0) {
      if (skipped > 0) {
        setDuplicateItemAlertMessage(DUPLICATE_ITEM_SELECTED_MESSAGE);
        setDuplicateItemAlertOpen(true);
      }
      return;
    }
    if (currentItems.length === 1 && !currentItems[0].itemName) {
      remove(0);
    }
    append(accepted.map((row) => normalizeRequisitionItemRow(row, rt)));
    closeSprCopyDialog(false);
    if (skipped > 0) {
      setDuplicateItemAlertMessage(
        `${skipped} line(s) were already on this requisition and were not imported again.`
      );
      setDuplicateItemAlertOpen(true);
    }
    toast.success(`Imported ${accepted.length} item(s)`);
  };

  const handleSprCopyImportAll = () => {
    appendCopiedSprItems(copyEligibleItems);
  };

  const handleSprCopyImportSelected = () => {
    const picked = copyEligibleItems.filter((it) => copySelectedItemIds.has(String(it.id)));
    if (picked.length === 0) {
      toast.error("Select at least one line to import.");
      return;
    }
    appendCopiedSprItems(picked);
  };

  const toggleSprCopyItem = (itemId: string) => {
    setCopySelectedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const toggleSprCopySelectAll = (checked: boolean) => {
    if (checked) {
      setCopySelectedItemIds(new Set(copyEligibleItems.map((it) => String(it.id))));
    } else {
      setCopySelectedItemIds(new Set());
    }
  };

  const handleCreateRequisition = async () => {
    console.log('[RequisitionForm] Create Requisition clicked');
    
    // For CTM requisitions, validate CTM-specific fields
    if (isCTMRequisition) {
      if (!ctmAmount || parseFloat(ctmAmount) <= 0) {
        toast.error('Please enter a valid amount for the CTM request.');
        return;
      }
      if (!ctmCurrency) {
        toast.error('Please select a currency.');
        return;
      }
      if (!ctmPort) {
        toast.error('Please enter the port name.');
        return;
      }
      if (!ctmAgentDetails) {
        toast.error('Please enter agent details.');
        return;
      }
      if (!validateNoteDenominations()) {
        toast.error('Note denominations do not match the requested amount. Please check your entries.');
        return;
      }
    }

    // For SPR requisitions, validate machinery selection
    if (isSPRRequisition) {
      if (!spareMachineryId && !spareManualMachineryName) {
        toast.error('Please select machinery or enter machinery name manually.');
        return;
      }
    }

    // For REP/SER requisitions, validate REP/SER-specific fields
    if (isRepOrSerRequisition) {
      if (!repSerUseManualMachinery && !repSerMachineryInstanceId) {
        toast.error('Please select machinery/equipment.');
        return;
      }
      if (repSerUseManualMachinery && !repSerManualMachineryName.trim()) {
        toast.error('Please enter machinery/equipment name.');
        return;
      }
      const formData = form.getValues();
      if (!formData.portOfSupply) {
        toast.error('Please enter the port.');
        return;
      }
      if (!repSerDateOfArrival) {
        toast.error('Please enter the date of arrival.');
        return;
      }
      if (!formData.portAgentDetails) {
        toast.error('Please enter agency details.');
        return;
      }
      if (!repSerMachineryDetails) {
        toast.error('Please enter details of machinery/equipment.');
        return;
      }
    }
    
    // For SPR requisitions, validate machinery selection
    if (form.watch("requisitionType") === RequisitionType.SPR) {
      if (!spareMachineryId && !spareManualMachineryName) {
        toast.error('Please select machinery or enter machinery name manually.');
        return;
      }
    }
    
    // Validate form before submitting (REP/SER/CTM auto-generate items — skip zod item validation)
    const reqType = form.getValues("requisitionType");
    if (requisitionUsesAutoItems(reqType)) {
      form.setValue("items", [], { shouldValidate: false });
      form.clearErrors("items");
      if (reqType === RequisitionType.CTM) {
        form.setValue("portOfSupply", ctmPort, { shouldValidate: false });
        form.setValue("portAgentDetails", ctmAgentDetails, { shouldValidate: false });
      }
      const heading = form.getValues("heading")?.trim();
      const vesselId = form.getValues("vesselId")?.trim();
      if (!heading) {
        toast.error("Heading is required.");
        return;
      }
      if (!vesselId) {
        toast.error("Vessel is required.");
        return;
      }
    } else {
      const isValid = await form.trigger();
      if (!isValid) {
        const errors = form.formState.errors;
        console.error('[RequisitionForm] Form validation failed:', errors);
        if (errors.heading) {
          toast.error('Heading is required.');
        } else if (errors.items) {
          toast.error('Please add at least one item to the requisition.');
        } else {
          toast.error('Please fill in all required fields before creating the requisition.');
        }
        return;
      }
    }
    
    // Set generationStatus and submit immediately with the correct status
    setPendingGenerationStatus(GenerationStatus.CREATED);
    
    // Submit with CREATED status directly to avoid race condition with state update
    const formData = form.getValues();
    await handleSubmit(formData, GenerationStatus.CREATED);
  };

  const addItem = () => {
    const requisitionType = form.watch("requisitionType");
    const extra: Record<string, unknown> = {};
    if (requisitionType === RequisitionType.PNT && requisitionPaintBrand) {
      extra.paintBrand = requisitionPaintBrand;
    }
    if (requisitionType === RequisitionType.CHE && requisitionChemicalMaker) {
      extra.paintBrand = requisitionChemicalMaker;
    }
    if (requisitionType === RequisitionType.LUB) {
      extra.portOfSupply = form.getValues("portOfSupply") || "";
    }
    append(normalizeRequisitionItemRow(extra, requisitionType));
  };

  // Expose addItems method for manual entry form
  const addItems = (items: any[]): { added: number; skipped: number } => {
    const rt = form.getValues("requisitionType");
    const current = form.getValues("items");
    const { accepted, skipped } = filterNewRowsAgainstDuplicateKeys(rt, current, items);
    if (accepted.length === 0) {
      if (skipped > 0) {
        setDuplicateItemAlertMessage(DUPLICATE_ITEM_SELECTED_MESSAGE);
        setDuplicateItemAlertOpen(true);
      }
      return { added: 0, skipped };
    }
    accepted.forEach((item) => {
      const row =
        rt === RequisitionType.PNT && requisitionPaintBrand
          ? { ...item, paintBrand: requisitionPaintBrand }
          : rt === RequisitionType.CHE && requisitionChemicalMaker
            ? { ...item, paintBrand: requisitionChemicalMaker, unit: item.unit || "LTR" }
          : rt === RequisitionType.LUB
            ? { ...item, portOfSupply: form.getValues("portOfSupply") || "" }
            : item;
      append(normalizeRequisitionItemRow(row, rt));
    });
    if (skipped > 0) {
      setDuplicateItemAlertMessage(
        `${skipped} line(s) were already on this requisition and were not added again.`
      );
      setDuplicateItemAlertOpen(true);
    }
    return { added: accepted.length, skipped };
  };

  // Expose form methods via window object (for manual entry)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).requisitionFormRef = {
        addItems,
        form,
      };
    }
    return () => {
      if (typeof window !== 'undefined') {
        delete (window as any).requisitionFormRef;
      }
    };
  }, [form, append]);

  const removeItem = (index: number) => {
    remove(index);
    // Re-key attachments after removal (indices shift)
    const newAttachments: Record<number, File[]> = {};
    Object.entries(itemAttachments).forEach(([k, files]) => {
      const i = Number(k);
      if (i < index) newAttachments[i] = files;
      if (i > index) newAttachments[i - 1] = files;
    });
    setItemAttachments(newAttachments);
  };

  const handleFileSelect = (index: number, files: FileList | null) => {
    if (!files) return;
    
    const validFiles: File[] = [];
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    
    Array.from(files).forEach((file) => {
      if (allowedTypes.includes(file.type)) {
        validFiles.push(file);
      } else {
        toast.error(`File ${file.name} is not a valid format. Only PDF and images are allowed.`);
      }
    });
    
    if (validFiles.length > 0) {
      setItemAttachments(prev => ({
        ...prev,
        [index]: [...(prev[index] || []), ...validFiles]
      }));
      toast.success(`${validFiles.length} file(s) attached successfully`);
    }
  };

  const removeAttachment = (itemIndex: number, fileIndex: number) => {
    setItemAttachments(prev => {
      const newAttachments = { ...prev };
      if (newAttachments[itemIndex]) {
        newAttachments[itemIndex] = newAttachments[itemIndex].filter((_, i) => i !== fileIndex);
        if (newAttachments[itemIndex].length === 0) {
          delete newAttachments[itemIndex];
        }
      }
      return newAttachments;
    });
    toast.success('Attachment removed');
  };

  // IMPA Code Search with debouncing
  const getImpaSearchScope = (): "provision" | "chemical" | undefined => {
    const type = form.getValues("requisitionType");
    if (usesProvisionImpaSearchScope(type)) return "provision";
    if (usesChemicalImpaSearchScope(type, selectedSubCategoryCodes)) return "chemical";
    return undefined;
  };

  const searchIMPACodes = async (query: string, itemIndex: number) => {
    const scope = getImpaSearchScope();
    const trimmed = query.trim();
    const isBrowseScope = scope === "provision" || scope === "chemical";

    if (!isBrowseScope && trimmed.length < 2) {
      setImpaSearchResults((prev) => ({ ...prev, [itemIndex]: [] }));
      return;
    }

    if (isBrowseScope && trimmed.length === 1) {
      setImpaSearchResults((prev) => ({ ...prev, [itemIndex]: [] }));
      return;
    }

    try {
      const params = new URLSearchParams({
        q: trimmed,
        limit: isBrowseScope ? "40" : "20",
      });
      if (scope) params.set("scope", scope);

      const response = await fetch(`/api/impa-codes/search?${params.toString()}`);

      if (response.ok) {
        const data = await response.json();

        if (data.impaCodes && data.impaCodes.length > 0) {
          setImpaSearchResults((prev) => ({ ...prev, [itemIndex]: data.impaCodes }));
        } else {
          setImpaSearchResults((prev) => ({ ...prev, [itemIndex]: [] }));
        }
      } else {
        const errorData = await response.json();
        console.error("IMPA search API error:", errorData);
        toast.error("Failed to search IMPA codes");
        setImpaSearchResults((prev) => ({ ...prev, [itemIndex]: [] }));
      }
    } catch (error) {
      console.error("Error searching IMPA codes:", error);
      toast.error("Network error while searching");
      setImpaSearchResults((prev) => ({ ...prev, [itemIndex]: [] }));
    }
  };

  // Debounced search function
  const debouncedSearch = (query: string, itemIndex: number) => {
    // Clear existing timeout for this item
    if (searchTimeoutRef.current[itemIndex]) {
      clearTimeout(searchTimeoutRef.current[itemIndex]);
    }
    
    // Set new timeout
    searchTimeoutRef.current[itemIndex] = setTimeout(() => {
      searchIMPACodes(query, itemIndex);
    }, 300); // 300ms delay
  };

  const handleIMPASelect = (itemIndex: number, impaCode: any) => {
    const rt = form.getValues("requisitionType");
    const items = form.getValues("items");
    if (isCatalogDuplicateInItems(rt, items, itemIndex, { impaCode: impaCode.impaCode })) {
      setDuplicateItemAlertMessage(DUPLICATE_ITEM_SELECTED_MESSAGE);
      setDuplicateItemAlertOpen(true);
      return;
    }
    // Set item name, IMPA code, and unit from IMPA code
    form.setValue(`items.${itemIndex}.itemName`, impaCode.itemName);
    form.setValue(`items.${itemIndex}.impaCode`, impaCode.impaCode ?? "");
    form.setValue(`items.${itemIndex}.unit`, impaCode.unit ?? "");
    setImpaPopoverOpen(prev => ({ ...prev, [itemIndex]: false }));
    setImpaSearchQuery(prev => ({ ...prev, [itemIndex]: '' }));
    toast.success('IMPA code selected');
  };

  // Debounce IMPA search
  useEffect(() => {
    const timers: Record<number, NodeJS.Timeout> = {};
    
    Object.entries(impaSearchQuery).forEach(([index, query]) => {
      const idx = parseInt(index);
      if (timers[idx]) clearTimeout(timers[idx]);
      
      timers[idx] = setTimeout(() => {
        searchIMPACodes(query, idx);
      }, 300);
    });
    
    return () => {
      Object.values(timers).forEach(timer => clearTimeout(timer));
    };
  }, [impaSearchQuery]);

  // Provision requisitions: preload welfare/provision IMPA catalog (000101–101939)
  useEffect(() => {
    if (watchedReqType !== RequisitionType.PRO) return;
    void searchIMPACodes("", 0);
  }, [watchedReqType]);

  // Chemical requisitions (CHE type or STR + chemical sub-category): preload IMPA chapter 55
  const chemicalSubCategoryKey = selectedSubCategoryCodes.join(",");
  useEffect(() => {
    if (!usesChemicalImpaSearchScope(watchedReqType, selectedSubCategoryCodes)) return;
    void searchIMPACodes("", 0);
  }, [watchedReqType, chemicalSubCategoryKey]);

  // Fetch machinery instances when vessel is selected and requisition type is SPR, REP, or SER
  useEffect(() => {
    const vesselId = form.watch("vesselId");
    const requisitionType = form.watch("requisitionType");
    
    if (vesselId && (requisitionType === RequisitionType.SPR || requisitionType === RequisitionType.REP || requisitionType === RequisitionType.SER)) {
      const fetchMachineryInstances = async () => {
        try {
          const response = await fetch(`/api/machinery-instances?vesselId=${vesselId}&limit=1000`, {
            credentials: 'include'
          });
          if (response.ok) {
            const data = await response.json();
            setMachineryInstances(data.instances || []);
          }
        } catch (error) {
          console.error('Error fetching machinery instances:', error);
        }
      };
      fetchMachineryInstances();
    } else {
      setMachineryInstances([]);
    }
  }, [form.watch("vesselId"), form.watch("requisitionType")]);

  useEffect(() => {
    if (!portComboboxOpen) {
      setPortSearchQuery("");
      setPortSearchResults([]);
      return;
    }
    if (!portSearchQuery || portSearchQuery.trim().length < 2) {
      setPortSearchResults([]);
      return;
    }
    const timeoutId = setTimeout(async () => {
      setPortSearchLoading(true);
      try {
        const response = await fetch(`/api/ports/search?q=${encodeURIComponent(portSearchQuery.trim())}&limit=30`, {
          credentials: "include",
        });
        if (!response.ok) {
          setPortSearchResults([]);
          return;
        }
        const data = await response.json();
        setPortSearchResults((data?.ports || []) as PortSearchItem[]);
      } catch {
        setPortSearchResults([]);
      } finally {
        setPortSearchLoading(false);
      }
    }, 250);
    return () => clearTimeout(timeoutId);
  }, [portComboboxOpen, portSearchQuery]);

  // Fetch lube products for selected supplier (LUB requisitions)
  useEffect(() => {
    const requisitionType = form.watch("requisitionType");
    if (requisitionType !== RequisitionType.LUB || !selectedLubeOilSupplierId) {
      setLubeProducts([]);
      return;
    }

    const fetchLubeProducts = async () => {
      try {
        const response = await fetch(
          `/api/lube-oil-products?supplierId=${encodeURIComponent(selectedLubeOilSupplierId)}`,
          { credentials: "include" }
        );
        if (response.ok) {
          const data = await response.json();
          const rows = Array.isArray(data.products) ? data.products : [];
          setLubeProducts(
            rows.map((p: { code: string; name: string; description?: string | null; category?: string | null; grade?: string | null }) => ({
              value: p.code,
              label: p.name,
              description: p.description,
              category: p.category,
              grade: p.grade,
            }))
          );
        } else {
          setLubeProducts([]);
        }
      } catch (error) {
        console.error("Error fetching lube products:", error);
        setLubeProducts([]);
      }
    };
    void fetchLubeProducts();
  }, [form.watch("requisitionType"), selectedLubeOilSupplierId]);

  const filteredLubeTypes = useMemo(() => {
    if (form.watch("requisitionType") !== RequisitionType.LUB) return [];
    return lubeProducts;
  }, [lubeProducts, form.watch("requisitionType")]);

  // Clear invalid product selections when supplier catalog changes
  useEffect(() => {
    if (form.getValues("requisitionType") !== RequisitionType.LUB) return;
    if (!selectedLubeOilSupplierId) return;
    const allowed = new Set(filteredLubeTypes.map((lt) => lt.value));
    const items = form.getValues("items") ?? [];
    items.forEach((item, index) => {
      if (item.oilGrade && !allowed.has(item.oilGrade)) {
        form.setValue(`items.${index}.oilGrade`, "");
        form.setValue(`items.${index}.itemName`, "");
      }
    });
  }, [filteredLubeTypes, selectedLubeOilSupplierId, form]);

  // Fetch paint brands when requisition type is PNT (Paint)
  useEffect(() => {
    const requisitionType = form.watch("requisitionType");
    
    if (requisitionType === RequisitionType.PNT) {
      const fetchPaintBrands = async () => {
        try {
          const response = await fetch('/api/paint-catalog/makers', {
            credentials: 'include'
          });
          if (response.ok) {
            const data = await response.json();
            setPaintBrands(data.makers || []);
          }
        } catch (error) {
          console.error('Error fetching paint brands:', error);
        }
      };
      fetchPaintBrands();
    } else {
      setPaintBrands([]);
    }
  }, [form.watch("requisitionType")]);

  // Fetch chemical makers when requisition type is CHE
  useEffect(() => {
    const requisitionType = form.watch("requisitionType");
    if (requisitionType === RequisitionType.CHE) {
      const fetchChemicalMakers = async () => {
        try {
          const response = await fetch("/api/chemical-catalog/makers", {
            credentials: "include",
          });
          if (response.ok) {
            const data = await response.json();
            setChemicalMakers(data.makers || []);
          }
        } catch (error) {
          console.error("Error fetching chemical makers:", error);
        }
      };
      void fetchChemicalMakers();
    } else {
      setChemicalMakers([]);
    }
  }, [form.watch("requisitionType")]);

  // Search spare parts
  const plateCatalogCacheKey = useCallback(
    (plateNumber: string) => {
      const vesselId = form.getValues("vesselId")?.trim() || "";
      const machineryId = spareMachineryId?.trim() || "";
      return `${vesselId}|${machineryId}|${plateNumber.trim().toLowerCase()}`;
    },
    [form, spareMachineryId]
  );

  const fetchPlateCatalog = useCallback(
    async (plateNumber: string, force = false): Promise<MainEnginePlateCatalogEntry[]> => {
      const plate = plateNumber.trim();
      if (!spareIsMainEngine || !plate) return [];
      const vesselId = form.getValues("vesselId")?.trim();
      const machineryId = spareMachineryId?.trim();
      if (!vesselId || !machineryId) return [];

      const key = plateCatalogCacheKey(plate);
      if (!force && plateCatalogByPlate[key]) {
        return plateCatalogByPlate[key];
      }

      setPlateCatalogLoading((prev) => ({ ...prev, [key]: true }));
      try {
        const params = new URLSearchParams({
          vesselId,
          machineryId,
          plateNumber: plate,
        });
        const response = await fetch(`/api/main-engine-plate-items?${params.toString()}`, {
          credentials: "include",
        });
        if (response.ok) {
          const data = await response.json();
          const items: MainEnginePlateCatalogEntry[] = data.items || [];
          setPlateCatalogByPlate((prev) => ({ ...prev, [key]: items }));
          return items;
        }
      } catch (error) {
        console.error("Error loading plate catalog:", error);
      } finally {
        setPlateCatalogLoading((prev) => ({ ...prev, [key]: false }));
      }
      return [];
    },
    [form, plateCatalogByPlate, plateCatalogCacheKey, spareIsMainEngine, spareMachineryId]
  );

  useEffect(() => {
    setPlateCatalogByPlate({});
  }, [form.watch("vesselId"), spareMachineryId]);

  const applyPlateCatalogItem = (itemIndex: number, entry: MainEnginePlateCatalogEntry) => {
    form.setValue(`items.${itemIndex}.itemNumber`, entry.itemNumber);
    if (entry.partNumber) {
      form.setValue(`items.${itemIndex}.partNumber`, entry.partNumber);
    }
    if (entry.partName) {
      form.setValue(`items.${itemIndex}.partName`, entry.partName);
      form.setValue(`items.${itemIndex}.itemName`, entry.partName);
    }
    setPlateItemComboboxOpen((prev) => ({ ...prev, [itemIndex]: false }));
  };

  const loadAllPlateCatalogItems = async (plateNumber: string) => {
    const plate = plateNumber.trim();
    if (!plate) return;
    const catalog = await fetchPlateCatalog(plate, true);
    if (catalog.length === 0) {
      toast.info("No items on file for this plate on this vessel.");
      return;
    }

    const items = form.getValues("items");
    const existingKeys = new Set(
      items
        .filter((i) => (i.plateNumber || "").trim().toLowerCase() === plate.toLowerCase())
        .map((i) => (i.itemNumber || "").trim().toLowerCase())
        .filter(Boolean)
    );
    const toAdd = catalog.filter(
      (entry) => !existingKeys.has(entry.itemNumber.trim().toLowerCase())
    );
    if (toAdd.length === 0) {
      toast.info("All items for this plate are already on the requisition.");
      return;
    }

    for (const entry of toAdd) {
      append(
        normalizeRequisitionItemRow(
          {
            plateNumber: plate,
            itemNumber: entry.itemNumber,
            partNumber: entry.partNumber || "",
            partName: entry.partName || "",
            drawingNumber: entry.drawingNumber || "",
            quantity: 1,
            unit: "PCS",
          },
          RequisitionType.SPR
        )
      );
    }
    toast.success(`Added ${toAdd.length} item(s) from plate ${plate}`);
  };

  const searchSpareParts = async (query: string, itemIndex: number, machineryId?: string) => {
    if (!query || query.length < 2) {
      setSparePartsSearchResults(prev => ({ ...prev, [itemIndex]: [] }));
      return;
    }
    
    try {
      const params = new URLSearchParams({
        q: query,
        limit: '20'
      });
      if (machineryId) {
        params.append('machineryId', machineryId);
      }
      
      const response = await fetch(`/api/spare-parts/search?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setSparePartsSearchResults(prev => ({ ...prev, [itemIndex]: data.results || data.data || [] }));
      }
    } catch (error) {
      console.error('Error searching spare parts:', error);
    }
  };

  const handleSparePartSelect = (itemIndex: number, part: any) => {
    const rt = form.getValues("requisitionType");
    const items = form.getValues("items");
    if (isCatalogDuplicateInItems(rt, items, itemIndex, { partNumber: part.sparePartNumber })) {
      setDuplicateItemAlertMessage(DUPLICATE_ITEM_SELECTED_MESSAGE);
      setDuplicateItemAlertOpen(true);
      return;
    }
    form.setValue(`items.${itemIndex}.partNumber`, part.sparePartNumber);
    form.setValue(`items.${itemIndex}.partName`, part.name);
    form.setValue(`items.${itemIndex}.itemName`, `${part.sparePartNumber} - ${part.name}`);
    form.setValue(`items.${itemIndex}.currentRob`, Number(part.quantity) || 0);
    // Set unit from part, or default to "PCS" for spare requisitions
    form.setValue(`items.${itemIndex}.unit`, part.unit || "PCS");
    setSparePartsPopoverOpen(prev => ({ ...prev, [itemIndex]: false }));
    setSparePartsSearchQuery(prev => ({ ...prev, [itemIndex]: '' }));
    toast.success('Spare part selected');
  };

  // Load paint catalog products (by brand and/or search query)
  const loadPaintCatalogProducts = async (query: string, itemIndex: number, brand?: string) => {
    const trimmedBrand = brand?.trim() || "";
    const trimmedQuery = query.trim();

    if (!trimmedBrand && trimmedQuery.length < 2) {
      setPaintSearchResults((prev) => ({ ...prev, [itemIndex]: [] }));
      return;
    }

    try {
      const params = new URLSearchParams({ limit: "100" });
      if (trimmedBrand) params.append("maker", trimmedBrand);
      if (trimmedQuery.length >= 2) params.append("q", trimmedQuery);

      const response = await fetch(`/api/paint-catalog/products?${params.toString()}`, {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setPaintSearchResults((prev) => ({ ...prev, [itemIndex]: data.products || [] }));
      }
    } catch (error) {
      console.error("Error loading paint catalog:", error);
    }
  };

  // Paint requisitions: when brand is selected, preload registered products for all rows
  useEffect(() => {
    if (form.watch("requisitionType") !== RequisitionType.PNT) return;
    const brand = requisitionPaintBrand.trim();
    if (!brand) {
      setPaintSearchResults({});
      return;
    }
    fields.forEach((_, itemIndex) => {
      void loadPaintCatalogProducts(paintSearchQuery[itemIndex] || "", itemIndex, brand);
    });
  }, [requisitionPaintBrand, fields.length, form]);

  const loadPaintColorOptions = async (
    itemIndex: number,
    brand?: string,
    productName?: string,
    query?: string
  ) => {
    try {
      const params = new URLSearchParams({ limit: "100" });
      const trimmedBrand = brand?.trim() || "";
      const trimmedProduct = productName?.trim() || "";
      if (trimmedBrand) params.set("brand", trimmedBrand);
      if (trimmedProduct) params.set("productName", trimmedProduct);
      if (query?.trim()) params.set("q", query.trim());

      const response = await fetch(`/api/paint-catalog/colors?${params.toString()}`, {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setPaintColorOptions((prev) => ({ ...prev, [itemIndex]: data.colors || [] }));
      }
    } catch (error) {
      console.error("Error loading paint color options:", error);
    }
  };

  const handlePaintColorSelect = (itemIndex: number, color: PaintColorOption) => {
    form.setValue(`items.${itemIndex}.paintColorGrade`, color.colorGrade);
    form.setValue(`items.${itemIndex}.paintColorName`, color.colorName);
    form.setValue(`items.${itemIndex}.paintColorHex`, color.colorHex);
    setPaintColorPopoverOpen((prev) => ({ ...prev, [itemIndex]: false }));
    setPaintColorSearchQuery((prev) => ({ ...prev, [itemIndex]: "" }));
  };

  const getPaintPreviewHex = (itemIndex: number): string | null => {
    const hex = form.watch(`items.${itemIndex}.paintColorHex`);
    if (hex?.trim()) return hex.trim();
    const grade = form.watch(`items.${itemIndex}.paintColorGrade`);
    const name = form.watch(`items.${itemIndex}.paintColorName`);
    return resolvePaintColorHex(grade || name);
  };

  const handlePaintSelect = (itemIndex: number, paint: any) => {
    const maker = paint.maker || paint.brand || "";
    const productName = paint.productName || "";
    const productCode = paint.productCode?.trim() || "";
    const rt = form.getValues("requisitionType");
    const items = form.getValues("items");
    if (
      isCatalogDuplicateInItems(rt, items, itemIndex, {
        paintBrand: maker,
        paintProductName: productName,
        paintColorGrade: paint.colorGrade,
        paintColorName: paint.colorName,
      })
    ) {
      setDuplicateItemAlertMessage(DUPLICATE_ITEM_SELECTED_MESSAGE);
      setDuplicateItemAlertOpen(true);
      return;
    }
    if (maker) {
      applyPaintBrandToAllItems(maker);
    }
    form.setValue(`items.${itemIndex}.paintProductName`, productName);
    if (productCode) {
      form.setValue(`items.${itemIndex}.partNumber`, productCode);
    }

    const inferredColor = paint.colorGrade
      ? null
      : inferPaintColorFromProductName(productName);
    form.setValue(
      `items.${itemIndex}.paintColorGrade`,
      paint.colorGrade || inferredColor?.colorGrade || ""
    );
    form.setValue(
      `items.${itemIndex}.paintColorName`,
      paint.colorName || inferredColor?.colorName || ""
    );
    form.setValue(
      `items.${itemIndex}.paintColorHex`,
      paint.colorHex || inferredColor?.colorHex || ""
    );
    form.setValue(`items.${itemIndex}.paintType`, paint.paintType || "");
    form.setValue(`items.${itemIndex}.paintCategory`, paint.category || "Paint");
    form.setValue(
      `items.${itemIndex}.itemName`,
      `${maker} ${productName}${productCode ? ` (${productCode})` : ""}`
    );
    form.setValue(`items.${itemIndex}.unit`, paint.unit || "LTR");
    setPaintPopoverOpen(prev => ({ ...prev, [itemIndex]: false }));
    setPaintSearchQuery(prev => ({ ...prev, [itemIndex]: '' }));
    void loadPaintColorOptions(itemIndex, maker, productName);
    toast.success('Paint product selected');
  };

  const handleLubeOilGradeSelect = (
    itemIndex: number,
    lubeType: LubeProductOption
  ) => {
    const rt = form.getValues("requisitionType");
    const items = form.getValues("items");
    if (
      isCatalogDuplicateInItems(rt, items, itemIndex, {
        oilGrade: lubeType.value,
      })
    ) {
      setDuplicateItemAlertMessage(DUPLICATE_ITEM_SELECTED_MESSAGE);
      setDuplicateItemAlertOpen(true);
      return;
    }
    form.setValue(`items.${itemIndex}.oilGrade`, lubeType.value);
    form.setValue(`items.${itemIndex}.itemName`, lubeType.label);
    form.setValue(`items.${itemIndex}.unit`, "LTR");
    form.setValue(`items.${itemIndex}.machineryInstanceId`, "");
    setLubeTypeComboboxOpen((prev) => ({ ...prev, [itemIndex]: false }));
    toast.success("Lube product selected");
  };

  const refreshPaintMakers = async () => {
    try {
      const response = await fetch("/api/paint-catalog/makers", { credentials: "include" });
      if (response.ok) {
        const data = await response.json();
        setPaintBrands(data.makers || []);
      }
    } catch (error) {
      console.error("Error refreshing paint makers:", error);
    }
  };

  const loadChemicalCatalogProducts = async (query: string, itemIndex: number, maker?: string) => {
    const trimmedMaker = maker?.trim() || "";
    const trimmedQuery = query.trim();

    if (!trimmedMaker && trimmedQuery.length < 2) {
      setChemicalSearchResults((prev) => ({ ...prev, [itemIndex]: [] }));
      return;
    }

    try {
      const params = new URLSearchParams({ limit: "100" });
      if (trimmedMaker) params.append("maker", trimmedMaker);
      if (trimmedQuery.length >= 2) params.append("q", trimmedQuery);

      const response = await fetch(`/api/chemical-catalog/products?${params.toString()}`, {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setChemicalSearchResults((prev) => ({ ...prev, [itemIndex]: data.products || [] }));
      }
    } catch (error) {
      console.error("Error loading chemical catalog:", error);
    }
  };

  useEffect(() => {
    if (form.watch("requisitionType") !== RequisitionType.CHE) return;
    const maker = requisitionChemicalMaker.trim();
    if (!maker) {
      setChemicalSearchResults({});
      return;
    }
    fields.forEach((_, itemIndex) => {
      void loadChemicalCatalogProducts(chemicalSearchQuery[itemIndex] || "", itemIndex, maker);
    });
  }, [requisitionChemicalMaker, fields.length, form]);

  const handleChemicalSelect = (itemIndex: number, product: ChemicalCatalogProduct) => {
    const maker = product.maker || "";
    const productName = product.productName || "";
    const productCode = product.productCode?.trim() || "";
    const rt = form.getValues("requisitionType");
    const items = form.getValues("items");
    if (
      isCatalogDuplicateInItems(rt, items, itemIndex, {
        paintBrand: maker,
        paintProductName: productName,
        partNumber: productCode,
      })
    ) {
      setDuplicateItemAlertMessage(DUPLICATE_ITEM_SELECTED_MESSAGE);
      setDuplicateItemAlertOpen(true);
      return;
    }
    if (maker) {
      applyChemicalMakerToAllItems(maker);
    }
    form.setValue(`items.${itemIndex}.paintProductName`, productName);
    if (productCode) {
      form.setValue(`items.${itemIndex}.partNumber`, productCode);
    }
    form.setValue(
      `items.${itemIndex}.itemName`,
      `${maker} ${productName}${productCode ? ` (${productCode})` : ""}`
    );
    form.setValue(`items.${itemIndex}.unit`, "LTR");
    setChemicalPopoverOpen((prev) => ({ ...prev, [itemIndex]: false }));
    setChemicalSearchQuery((prev) => ({ ...prev, [itemIndex]: "" }));
    toast.success("Chemical product selected");
  };

  const handleAddNewChemicalProduct = async (itemIndex: number) => {
    setChemicalPopoverOpen((prev) => ({ ...prev, [itemIndex]: false }));
    const maker = (requisitionChemicalMaker || prompt("Chemical maker") || "").trim();
    if (!maker) return;
    const productName = (prompt("Product name") || "").trim();
    if (!productName) {
      toast.error("Product name is required");
      return;
    }
    const productCode = (prompt("Product code (optional)") || "").trim();
    try {
      const response = await fetch("/api/chemical-catalog/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ maker, productName, productCode }),
      });
      if (response.ok) {
        const data = await response.json();
        toast.success("Chemical product added to catalog");
        const makersRes = await fetch("/api/chemical-catalog/makers", { credentials: "include" });
        if (makersRes.ok) {
          const makersData = await makersRes.json();
          setChemicalMakers(makersData.makers || []);
        }
        handleChemicalSelect(itemIndex, data.product);
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to add chemical product");
      }
    } catch (error) {
      console.error("Error adding chemical product:", error);
      toast.error("Failed to add chemical product");
    }
  };

  const handleAddNewPaint = async (itemIndex: number) => {
    const paintData = newPaintData[itemIndex];
    if (!paintData || !paintData.brand || !paintData.productName) {
      toast.error("Please fill in maker and product name");
      return;
    }

    try {
      const response = await fetch("/api/paint-catalog/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          maker: paintData.brand.trim(),
          productName: paintData.productName.trim(),
          productCode: paintData.productCode?.trim() || "",
        }),
      });

      if (response.ok) {
        const data = await response.json();
        await refreshPaintMakers();
        handlePaintSelect(itemIndex, {
          ...data.product,
          colorGrade: paintData.colorGrade,
          colorName: paintData.colorName,
          colorHex: paintData.colorHex,
          paintType: paintData.paintType,
          category: paintData.category || "Paint",
          unit: paintData.unit || "LTR",
        });
        setPaintAddDialogOpen((prev) => ({ ...prev, [itemIndex]: false }));
        setNewPaintData((prev) => {
          const updated = { ...prev };
          delete updated[itemIndex];
          return updated;
        });
        toast.success("Paint product added to catalog");
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to add paint product");
      }
    } catch (error: unknown) {
      console.error("Error adding paint catalog product:", error);
      toast.error("Failed to add paint product");
    }
  };

  if (displayMode === "dialog" && !open) return null;

  const isCTMRequisition = form.watch("requisitionType") === RequisitionType.CTM;
  const isSPRRequisition = form.watch("requisitionType") === RequisitionType.SPR;
  const isRepOrSerRequisition = form.watch("requisitionType") === RequisitionType.REP || form.watch("requisitionType") === RequisitionType.SER;
  const watchedRequisitionType = form.watch("requisitionType");
  const itemColHeader = (key: QuoteItemColumnKey, fallback: string) =>
    getRequisitionItemHeaderLabel(watchedRequisitionType, key) ?? fallback;

  const FormBody = (
    <FormProvider {...form}>
    <Form {...form}>
      <form className="space-y-6">
        {/* Hidden fields for form validation - values are controlled by parent page */}
        <FormField
          control={form.control}
          name="requisitionType"
          render={() => <input type="hidden" />}
        />
        <FormField
          control={form.control}
          name="vesselId"
          render={() => <input type="hidden" />}
        />
        <FormField
          control={form.control}
          name="heading"
          render={() => <input type="hidden" />}
        />
        <FormField
          control={form.control}
          name="description"
          render={() => <input type="hidden" />}
        />

        {/* CTM Specific Form */}
        {isCTMRequisition ? (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-green-600" />
                  CTM Request Details
                </CardTitle>
                <CardDescription>
                  Enter amount, currency, port, note breakdown, and agent details — no separate item list is needed.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-md border-l-2 border-green-500/50 bg-muted/20 px-3 py-3">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                    <div className="space-y-1 min-w-0">
                      <Label htmlFor="ctm-amount" className="text-xs font-medium">
                        Amount Requested *
                      </Label>
                      <Input
                        id="ctm-amount"
                        type="number"
                        step="0.01"
                        min="0.01"
                        placeholder="0.00"
                        value={ctmAmount}
                        onChange={(e) => {
                          setCtmAmount(e.target.value);
                          const newAmount = parseFloat(e.target.value) || 0;
                          const currentTotal = calculateTotalFromNotes();
                          if (Math.abs(newAmount - currentTotal) > newAmount * 0.1) {
                            setCtmNoteDenominations({});
                          }
                        }}
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1 min-w-0">
                      <Label htmlFor="ctm-currency" className="text-xs font-medium">
                        Currency *
                      </Label>
                      <Select value={ctmCurrency} onValueChange={(value) => {
                        setCtmCurrency(value);
                        setCtmNoteDenominations({});
                      }}>
                        <SelectTrigger id="ctm-currency" className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="USD">USD - US Dollar</SelectItem>
                          <SelectItem value="EUR">EUR - Euro</SelectItem>
                          <SelectItem value="GBP">GBP - British Pound</SelectItem>
                          <SelectItem value="INR">INR - Indian Rupee</SelectItem>
                          <SelectItem value="SGD">SGD - Singapore Dollar</SelectItem>
                          <SelectItem value="JPY">JPY - Japanese Yen</SelectItem>
                          <SelectItem value="AUD">AUD - Australian Dollar</SelectItem>
                          <SelectItem value="CAD">CAD - Canadian Dollar</SelectItem>
                          <SelectItem value="CHF">CHF - Swiss Franc</SelectItem>
                          <SelectItem value="CNY">CNY - Chinese Yuan</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1 min-w-0">
                      <Label htmlFor="ctm-port" className="text-xs font-medium flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5" />
                        Port *
                      </Label>
                      <Input
                        id="ctm-port"
                        type="text"
                        placeholder="Enter port name"
                        value={ctmPort}
                        onChange={(e) => {
                          setCtmPort(e.target.value);
                          form.setValue("portOfSupply", e.target.value, { shouldValidate: false });
                        }}
                        className="h-9"
                      />
                    </div>
                  </div>

                  {/* Note Denominations */}
                  <div className="mt-3 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Label className="text-xs font-medium">Note Denominations *</Label>
                      <div className="text-xs text-muted-foreground">
                        Total: <span className="font-semibold text-foreground">{ctmCurrency} {calculateTotalFromNotes().toFixed(2)}</span>
                        {ctmAmount && (
                          <span className={`ml-2 ${Math.abs(parseFloat(ctmAmount) - calculateTotalFromNotes()) < 0.01 ? "text-green-600" : "text-red-600"}`}>
                            ({Math.abs(parseFloat(ctmAmount) - calculateTotalFromNotes()) < 0.01 ? "✓ Match" : "✗ Mismatch"})
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="rounded-md border bg-background/80 p-2">
                      <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                        {getAvailableDenominations(ctmCurrency).map((denom) => (
                          <div key={denom} className="space-y-1">
                            <Label className="text-[11px] font-medium text-muted-foreground">
                              {ctmCurrency} {denom}
                            </Label>
                            <Input
                              type="number"
                              min="0"
                              step="1"
                              placeholder="0"
                              value={ctmNoteDenominations[denom] || ""}
                              onChange={(e) => {
                                const value = parseInt(e.target.value) || 0;
                                if (value >= 0) {
                                  setCtmNoteDenominations(prev => ({
                                    ...prev,
                                    [denom]: value,
                                  }));
                                }
                              }}
                              className="h-8"
                            />
                            {ctmNoteDenominations[denom] > 0 && (
                              <p className="text-[10px] text-muted-foreground">
                                = {ctmCurrency} {(denom * ctmNoteDenominations[denom]).toLocaleString()}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                      {ctmAmount && Math.abs(parseFloat(ctmAmount) - calculateTotalFromNotes()) >= 0.01 && (
                        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-md">
                          <p className="text-xs text-red-700">
                            <AlertCircle className="h-3.5 w-3.5 inline mr-1.5" />
                            Note denominations total ({ctmCurrency} {calculateTotalFromNotes().toFixed(2)}) does not match requested amount ({ctmCurrency} {parseFloat(ctmAmount).toFixed(2)}).
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Agent Details */}
                  <div className="mt-3 space-y-1">
                    <Label htmlFor="ctm-agent" className="text-xs font-medium flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5" />
                      Agent Details *
                    </Label>
                    <Textarea
                      id="ctm-agent"
                      placeholder="Agent name, contact information, and other relevant details"
                      value={ctmAgentDetails}
                      onChange={(e) => {
                        setCtmAgentDetails(e.target.value);
                        form.setValue("portAgentDetails", e.target.value, { shouldValidate: false });
                      }}
                      className="min-h-[72px] resize-y"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        ) : isRepOrSerRequisition ? (
          <>
            {/* REP/SER Specific Form */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Package className="h-5 w-5 text-blue-600" />
                  {form.watch("requisitionType") === RequisitionType.REP ? "Repair" : "Service"} Requisition Details
                </CardTitle>
                <CardDescription>
                  Fill in the fields below — no separate item list is needed. The system creates one {form.watch("requisitionType") === RequisitionType.REP ? "repair" : "service"} line from this information when you submit.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-md border-l-2 border-blue-500/50 bg-muted/20 px-3 py-3">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {/* Machinery/Equipment Selection */}
                    <div className="space-y-1 min-w-0 md:col-span-2 xl:col-span-2">
                      <Label className="text-xs font-medium">Machinery/Equipment *</Label>
                      <div className="flex items-center space-x-2 mb-1">
                        <Checkbox
                          id="rep-ser-use-manual-machinery"
                          checked={repSerUseManualMachinery}
                          onCheckedChange={(checked) => {
                            setRepSerUseManualMachinery(checked === true);
                            if (checked) {
                              setRepSerMachineryInstanceId("");
                            } else {
                              setRepSerManualMachineryName("");
                            }
                          }}
                        />
                        <Label htmlFor="rep-ser-use-manual-machinery" className="text-xs cursor-pointer">
                          Enter manually
                        </Label>
                      </div>
                      {!repSerUseManualMachinery ? (
                        <Popover open={repSerMachineryComboboxOpen} onOpenChange={setRepSerMachineryComboboxOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              className="w-full justify-between text-left font-normal h-9 min-w-0"
                              type="button"
                            >
                              <span className="truncate">
                                {repSerMachineryInstanceId
                                  ? machineryInstances.find(m => m.id === repSerMachineryInstanceId)?.name || "Select machinery"
                                  : "Select machinery/equipment"}
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
                                  {machineryInstances.map((machinery) => (
                                    <CommandItem
                                      key={machinery.id}
                                      value={`${machinery.code} ${machinery.name}`}
                                      onSelect={() => {
                                        setRepSerMachineryInstanceId(machinery.id);
                                        setRepSerMachineryComboboxOpen(false);
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          repSerMachineryInstanceId === machinery.id
                                            ? "opacity-100"
                                            : "opacity-0"
                                        )}
                                      />
                                      {machinery.code} - {machinery.name}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      ) : (
                        <Input
                          placeholder="Enter machinery/equipment name"
                          value={repSerManualMachineryName}
                          onChange={(e) => setRepSerManualMachineryName(e.target.value)}
                          className="h-9"
                        />
                      )}
                    </div>

                    {/* Date of Arrival */}
                    <div className="space-y-1 min-w-0">
                      <Label htmlFor="rep-ser-date-arrival" className="text-xs font-medium">
                        Date of Arrival *
                      </Label>
                      <Input
                        id="rep-ser-date-arrival"
                        type="date"
                        value={repSerDateOfArrival}
                        onChange={(e) => setRepSerDateOfArrival(e.target.value)}
                        className="h-9"
                      />
                    </div>

                    {/* Port */}
                    <div className="space-y-1 min-w-0">
                      <Label htmlFor="rep-ser-port" className="text-xs font-medium flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5" />
                        Port *
                      </Label>
                      <FormField
                        control={form.control}
                        name="portOfSupply"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Popover open={portComboboxOpen} onOpenChange={setPortComboboxOpen}>
                                <PopoverTrigger asChild>
                                  <Button
                                    variant="outline"
                                    role="combobox"
                                    className={cn("w-full justify-between text-left font-normal h-9 min-w-0", !field.value && "text-muted-foreground")}
                                    type="button"
                                  >
                                    <span className="truncate">
                                      {field.value || "Search port..."}
                                    </span>
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                                  <Command>
                                    <CommandInput
                                      placeholder="Search ports..."
                                      value={portSearchQuery}
                                      onValueChange={setPortSearchQuery}
                                    />
                                    <CommandList>
                                      <CommandEmpty>
                                        {portSearchLoading ? "Searching..." : "No ports found."}
                                      </CommandEmpty>
                                      <CommandGroup>
                                        {portSearchResults.map((port) => (
                                          <CommandItem
                                            key={port.id}
                                            value={`${port.name} ${port.country} ${port.code || ""}`}
                                            onSelect={() => {
                                              form.setValue("portOfSupply", port.name, { shouldValidate: true });
                                              setPortComboboxOpen(false);
                                              setPortSearchQuery("");
                                              setPortSearchResults([]);
                                            }}
                                          >
                                            <Check
                                              className={cn(
                                                "mr-2 h-4 w-4",
                                                field.value === port.name ? "opacity-100" : "opacity-0"
                                              )}
                                            />
                                            <span className="truncate">
                                              {port.name}
                                              {port.code ? ` (${port.code})` : ""}
                                              {port.country ? ` — ${port.country}` : ""}
                                            </span>
                                          </CommandItem>
                                        ))}
                                      </CommandGroup>
                                    </CommandList>
                                  </Command>
                                </PopoverContent>
                              </Popover>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Agency Details — spans 2 cols on xl */}
                    <div className="space-y-1 min-w-0 md:col-span-2 xl:col-span-2">
                      <Label htmlFor="rep-ser-agency" className="text-xs font-medium flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5" />
                        Agency Details *
                      </Label>
                      <FormField
                        control={form.control}
                        name="portAgentDetails"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Textarea
                                id="rep-ser-agency"
                                placeholder="Agency name, contact information, and other relevant details"
                                className="min-h-[72px] resize-y"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* Machinery/Equipment Details — full width */}
                  <div className="mt-3 space-y-1">
                    <Label htmlFor="rep-ser-machinery-details" className="text-xs font-medium">
                      Details of Machinery/Equipment *
                    </Label>
                    <Textarea
                      id="rep-ser-machinery-details"
                      placeholder="Detailed description of the machinery/equipment, issue, and required service/repair"
                      value={repSerMachineryDetails}
                      onChange={(e) => setRepSerMachineryDetails(e.target.value)}
                      className="min-h-[72px] resize-y"
                    />
                  </div>

                  {/* Attachments — 2 columns */}
                  <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Damage Report (Attachment)</Label>
                    <input
                      type="file"
                      ref={damageReportInputRef}
                      className="hidden"
                      accept=".pdf,.jpg,.jpeg,.png"
                      multiple
                      onChange={(e) => {
                        if (e.target.files) {
                          const files = Array.from(e.target.files);
                          const validFiles: File[] = [];
                          const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
                          
                          files.forEach((file) => {
                            if (allowedTypes.includes(file.type)) {
                              validFiles.push(file);
                            } else {
                              toast.error(`File ${file.name} is not a valid format. Only PDF and images are allowed.`);
                            }
                          });
                          
                          if (validFiles.length > 0) {
                            setRepSerDamageReport(prev => [...prev, ...validFiles]);
                            toast.success(`${validFiles.length} file(s) attached successfully`);
                          }
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => damageReportInputRef.current?.click()}
                      className="w-full"
                    >
                      <Paperclip className="h-4 w-4 mr-2" />
                      Attach Damage Report
                    </Button>
                    {repSerDamageReport.length > 0 && (
                      <div className="space-y-1 mt-2">
                        {repSerDamageReport.map((file, index) => (
                          <div key={index} className="flex items-center gap-2 bg-slate-50 p-2 rounded text-sm">
                            <span className="truncate flex-1" title={file.name}>
                              {file.name.length > 30 ? `${file.name.substring(0, 27)}...` : file.name}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setRepSerDamageReport(prev => prev.filter((_, i) => i !== index));
                                toast.success('File removed');
                              }}
                              className="text-red-500 hover:text-red-700"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Troubleshooting Report (Attachment)</Label>
                    <input
                      type="file"
                      ref={troubleshootingReportInputRef}
                      className="hidden"
                      accept=".pdf,.jpg,.jpeg,.png"
                      multiple
                      onChange={(e) => {
                        if (e.target.files) {
                          const files = Array.from(e.target.files);
                          const validFiles: File[] = [];
                          const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
                          
                          files.forEach((file) => {
                            if (allowedTypes.includes(file.type)) {
                              validFiles.push(file);
                            } else {
                              toast.error(`File ${file.name} is not a valid format. Only PDF and images are allowed.`);
                            }
                          });
                          
                          if (validFiles.length > 0) {
                            setRepSerTroubleshootingReport(prev => [...prev, ...validFiles]);
                            toast.success(`${validFiles.length} file(s) attached successfully`);
                          }
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => troubleshootingReportInputRef.current?.click()}
                      className="w-full"
                    >
                      <Paperclip className="h-4 w-4 mr-2" />
                      Attach Troubleshooting Report
                    </Button>
                    {repSerTroubleshootingReport.length > 0 && (
                      <div className="space-y-1 mt-2">
                        {repSerTroubleshootingReport.map((file, index) => (
                          <div key={index} className="flex items-center gap-2 bg-slate-50 p-2 rounded text-sm">
                            <span className="truncate flex-1" title={file.name}>
                              {file.name.length > 30 ? `${file.name.substring(0, 27)}...` : file.name}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setRepSerTroubleshootingReport(prev => prev.filter((_, i) => i !== index));
                                toast.success('File removed');
                              }}
                              className="text-red-500 hover:text-red-700"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                </div>
              </CardContent>
            </Card>
          </>
        ) : (
          <>
            {/* Port Agent Details - Only show for non-CTM, non-REP/SER requisitions, and if not hidden */}
            {!hideAgentDetails && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Port Agent Details</CardTitle>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="portAgentDetails"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Port Agent Details</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter port agent details"
                      className="min-h-[60px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>
            )}
          </>
        )}

        {/* Items - Hide for CTM and REP/SER requisitions as they are auto-generated */}
        {!isCTMRequisition && !isRepOrSerRequisition && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Requisition Items
              </span>
              <div className="flex gap-2">
                {form.watch("requisitionType") === RequisitionType.SPR && (
                  <Button type="button" onClick={handleCopyFromPrevious} variant="outline" size="sm">
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Previous
                  </Button>
                )}
                <Button type="button" onClick={addItem} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Item
                </Button>
              </div>
            </CardTitle>
            <CardDescription>
              {form.watch("requisitionType") === RequisitionType.SPR ? (
                <>
                  Add all items required for this requisition. At least one item is required. Use the checkbox in
                  Actions to mark items as Machinery Spare.
                </>
              ) : form.watch("requisitionType") === RequisitionType.PRO ? (
                <>
                  Add provision and welfare items (IMPA 000101–101939). Click Item Name or IMPA Code to
                  browse the catalog, or type to search manually.
                </>
              ) : form.watch("requisitionType") === RequisitionType.GLY ? (
                <>
                  Search galley IMPA items or enter item details manually. Click Item Name or IMPA Code to
                  pick from the catalog.
                </>
              ) : form.watch("requisitionType") === RequisitionType.OTR ? (
                <>
                  Search IMPA items or enter item details manually. Click Item Name or IMPA Code to pick
                  from the catalog.
                </>
              ) : form.watch("requisitionType") === RequisitionType.CHE ? (
                <>
                  Select a chemical maker once on row 1, then choose registered products and product codes
                  from the catalog (same flow as paint requisitions).
                </>
              ) : (
                <>Add all items required for this requisition. At least one item is required.</>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-300">
                    <th className="px-2 py-2 text-left text-sm font-medium text-slate-700 w-16">#</th>
                    {form.watch("requisitionType") === RequisitionType.SPR ? (
                      <>
                        {spareIsMainEngine && (
                          <th className="px-2 py-2 text-left text-sm font-medium text-slate-700 w-[10.2rem]">Plate No.</th>
                        )}
                        <th className="px-2 py-2 text-left text-sm font-medium text-slate-700 w-32">{itemColHeader("partNumber", "Part No.")} *</th>
                        <th className="px-2 py-2 text-left text-sm font-medium text-slate-700 min-w-[200px]">{itemColHeader("partName", "Part Name")} *</th>
                        <th className="px-2 py-2 text-left text-sm font-medium text-slate-700 w-24">{itemColHeader("itemNumber", "Item No.")}</th>
                        <th className="px-2 py-2 text-left text-sm font-medium text-slate-700 w-20">{itemColHeader("quantity", "Qty")} *</th>
                        <th className="px-2 py-2 text-left text-sm font-medium text-slate-700 w-24">{itemColHeader("unit", "Unit")} *</th>
                        <th className="px-2 py-2 text-left text-sm font-medium text-slate-700 w-24">Current ROB</th>
                        <th className="px-2 py-2 text-left text-sm font-medium text-slate-700 w-32">{itemColHeader("remarks", "Remarks")}</th>
                        <th className="px-1 py-2 text-left text-sm font-medium text-slate-700 w-[26px] max-w-[26px]">Attachments</th>
                        <th className="px-1 py-2 text-center text-sm font-medium text-slate-700 w-[40px] min-w-[40px] max-w-[40px]">Actions</th>
                      </>
                    ) : form.watch("requisitionType") === RequisitionType.LUB ? (
                      <>
                        <th className="px-3 py-2 text-left text-sm font-medium text-slate-700">{itemColHeader("oilGrade", "Oil Grade")} *</th>
                        <th className="px-3 py-2 text-left text-sm font-medium text-slate-700">{itemColHeader("machinery", "Machinery")}</th>
                        <th className="px-3 py-2 text-left text-sm font-medium text-slate-700 w-32">{itemColHeader("quantity", "Qty (L)")} *</th>
                        <th className="px-3 py-2 text-left text-sm font-medium text-slate-700 w-32">Port of Supply</th>
                        <th className="px-3 py-2 text-left text-sm font-medium text-slate-700 w-32">{itemColHeader("remarks", "Remarks")}</th>
                        <th className="px-3 py-2 text-left text-sm font-medium text-slate-700 w-40">Attachments</th>
                        <th className="px-3 py-2 text-center text-sm font-medium text-slate-700 w-32">Action</th>
                      </>
                    ) : form.watch("requisitionType") === RequisitionType.CHE ? (
                      <>
                        <th className="px-3 py-2 text-left text-sm font-medium text-slate-700">{itemColHeader("paintBrand", "Chemical Maker")} *</th>
                        <th className="px-3 py-2 text-left text-sm font-medium text-slate-700">{itemColHeader("paintProduct", "Product Name")} *</th>
                        <th className="px-3 py-2 text-left text-sm font-medium text-slate-700">{itemColHeader("partNumber", "Product Code")}</th>
                        <th className="px-3 py-2 text-left text-sm font-medium text-slate-700 w-28">{itemColHeader("quantity", "Qty")} *</th>
                        <th className="px-3 py-2 text-left text-sm font-medium text-slate-700 w-24">{itemColHeader("unit", "Unit")} *</th>
                        <th className="px-3 py-2 text-left text-sm font-medium text-slate-700 w-32">{itemColHeader("remarks", "Remarks")}</th>
                        <th className="px-3 py-2 text-left text-sm font-medium text-slate-700 w-40">Attachments</th>
                        <th className="px-3 py-2 text-center text-sm font-medium text-slate-700 w-32">Action</th>
                      </>
                    ) : form.watch("requisitionType") === RequisitionType.PNT ? (
                      <>
                        <th className="px-3 py-2 text-left text-sm font-medium text-slate-700">{itemColHeader("paintBrand", "Brand")} *</th>
                        <th className="px-3 py-2 text-left text-sm font-medium text-slate-700">{itemColHeader("paintProduct", "Product Name")} *</th>
                        <th className="px-3 py-2 text-left text-sm font-medium text-slate-700">{itemColHeader("paintColorGrade", "Color Grade")}</th>
                        <th className="px-3 py-2 text-left text-sm font-medium text-slate-700 w-20">Color Preview</th>
                        <th className="px-3 py-2 text-left text-sm font-medium text-slate-700">{itemColHeader("paintCategory", "Category")} *</th>
                        <th className="px-3 py-2 text-left text-sm font-medium text-slate-700 w-28">{itemColHeader("quantity", "Qty")} *</th>
                        <th className="px-3 py-2 text-left text-sm font-medium text-slate-700 w-24">{itemColHeader("unit", "Unit")} *</th>
                        <th className="px-3 py-2 text-left text-sm font-medium text-slate-700 w-32">{itemColHeader("remarks", "Remarks")}</th>
                        <th className="px-3 py-2 text-left text-sm font-medium text-slate-700 w-40">Attachments</th>
                        <th className="px-3 py-2 text-center text-sm font-medium text-slate-700 w-32">Action</th>
                      </>
                    ) : (
                      <>
                    <th className="px-3 py-2 text-left text-sm font-medium text-slate-700">{itemColHeader("itemName", "Item Name")} *</th>
                    <th className="px-3 py-2 text-left text-sm font-medium text-slate-700 w-[9.6rem]">{itemColHeader("impaCode", "IMPA Code")}</th>
                    <th className="px-3 py-2 text-left text-sm font-medium text-slate-700 w-28">{itemColHeader("quantity", "Qty")} *</th>
                    <th className="px-3 py-2 text-left text-sm font-medium text-slate-700 w-[7.2rem]">{itemColHeader("unit", "Unit")} *</th>
                    <th className="px-3 py-2 text-left text-sm font-medium text-slate-700 w-32">{itemColHeader("remarks", "Remarks")}</th>
                    <th className="px-3 py-2 text-center text-sm font-medium text-slate-700 w-10">Attachments</th>
                    <th className="px-3 py-2 text-center text-sm font-medium text-slate-700 w-16">Action</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {fields.map((field, index) => {
                    const watchedRowReqType = form.watch("requisitionType");
                    const isSpareRequisition = watchedRowReqType === RequisitionType.SPR;
                    const isLubeRequisition = watchedRowReqType === RequisitionType.LUB;
                    const isPaintRequisition = watchedRowReqType === RequisitionType.PNT;
                    const isChemicalCatalogRequisition = watchedRowReqType === RequisitionType.CHE;
                    const isImpaCatalogRequisition = usesImpaCatalogSearch(watchedRowReqType);
                    const isProvisionRequisition =
                      usesProvisionImpaSearchScope(watchedRowReqType);
                    const isChemicalRequisition = usesChemicalImpaSearchScope(
                      watchedRowReqType,
                      selectedSubCategoryCodes
                    );
                    const isScopedImpaBrowse = isProvisionRequisition || isChemicalRequisition;
                    return (
                    <React.Fragment key={field.id}>
                      <tr className="border-b border-slate-200 hover:bg-slate-50">
                      {/* Serial Number */}
                      <td className="px-2 py-2 text-sm font-medium text-slate-700">{index + 1}</td>
                      
                      {isSpareRequisition ? (
                        <>
                          {spareIsMainEngine && (
                            <td className="px-2 py-2">
                              <FormField
                                control={form.control}
                                name={`items.${index}.plateNumber`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormControl>
                                      <Input
                                        placeholder="Plate No."
                                        {...field}
                                        className="h-9 text-xs min-w-[10.2rem] w-full"
                                        onBlur={(e) => {
                                          field.onBlur();
                                          void fetchPlateCatalog(e.target.value);
                                        }}
                                      />
                                    </FormControl>
                                    {(() => {
                                      const plate = (field.value || "").trim();
                                      if (!plate) return null;
                                      const key = plateCatalogCacheKey(plate);
                                      const catalog = plateCatalogByPlate[key];
                                      const loading = plateCatalogLoading[key];
                                      if (loading) {
                                        return (
                                          <p className="text-[10px] text-muted-foreground mt-1">
                                            Loading items…
                                          </p>
                                        );
                                      }
                                      if (catalog && catalog.length > 0) {
                                        return (
                                          <Button
                                            type="button"
                                            variant="link"
                                            className="h-auto p-0 mt-1 text-[10px] text-blue-700"
                                            onClick={() => void loadAllPlateCatalogItems(plate)}
                                          >
                                            Load {catalog.length} item(s) from plate
                                          </Button>
                                        );
                                      }
                                      return null;
                                    })()}
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </td>
                          )}
                          {/* Part Number */}
                          <td className="px-2 py-2">
                            <FormField
                              control={form.control}
                              name={`items.${index}.partNumber`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormControl>
                                    <Input placeholder="Part Number" {...field} className="h-9 text-xs" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <KnowledgePackMatchHint
                              partNumber={form.watch(`items.${index}.partNumber`)}
                              drawingNumber={spareCommonDrawingNumber || form.watch(`items.${index}.drawingNumber`)}
                              itemNumber={form.watch(`items.${index}.itemNumber`)}
                              machineryId={spareMachineryId}
                              vesselId={form.watch("vesselId")}
                              requisitionId={editing?.id}
                              requisitionItemId={editing?.items?.[index]?.id}
                            />
                          </td>

                          {/* Part Name */}
                          <td className="px-2 py-2 min-w-[200px]">
                            <FormField
                              control={form.control}
                              name={`items.${index}.partName`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormControl>
                                    <Input 
                                      placeholder="Search parts..." 
                                      {...field} 
                                      onChange={(e) => {
                                        field.onChange(e);
                                        form.setValue(`items.${index}.itemName`, e.target.value);
                                      }}
                                      className="h-9 text-xs w-full min-w-[180px]" 
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </td>

                          {/* Item Number */}
                          <td className="px-2 py-2">
                            {(() => {
                              const plateVal = (form.watch(`items.${index}.plateNumber`) || "").trim();
                              const catalogKey = plateVal ? plateCatalogCacheKey(plateVal) : "";
                              const plateCatalog = catalogKey ? plateCatalogByPlate[catalogKey] : [];
                              const hasPlateCatalog = (plateCatalog?.length ?? 0) > 0;

                              if (hasPlateCatalog) {
                                return (
                                  <Popover
                                    open={plateItemComboboxOpen[index]}
                                    onOpenChange={(open) =>
                                      setPlateItemComboboxOpen((prev) => ({ ...prev, [index]: open }))
                                    }
                                  >
                                    <PopoverAnchor asChild>
                                      <FormField
                                        control={form.control}
                                        name={`items.${index}.itemNumber`}
                                        render={({ field }) => (
                                          <FormItem>
                                            <FormControl>
                                              <Input
                                                placeholder="Select or type item no."
                                                {...field}
                                                className="h-9 text-xs"
                                                onFocus={() =>
                                                  setPlateItemComboboxOpen((prev) => ({
                                                    ...prev,
                                                    [index]: true,
                                                  }))
                                                }
                                              />
                                            </FormControl>
                                            <FormMessage />
                                          </FormItem>
                                        )}
                                      />
                                    </PopoverAnchor>
                                    <PopoverContent className="w-72 p-0" align="start">
                                      <Command>
                                        <CommandInput placeholder="Search item numbers…" />
                                        <CommandList>
                                          <CommandEmpty>No matching items on this plate.</CommandEmpty>
                                          <CommandGroup heading="Items on this plate (this vessel)">
                                            {plateCatalog.map((entry) => (
                                              <CommandItem
                                                key={entry.itemNumber}
                                                value={entry.itemNumber}
                                                onSelect={() => applyPlateCatalogItem(index, entry)}
                                              >
                                                <span className="font-medium">{entry.itemNumber}</span>
                                                {entry.partNumber ? (
                                                  <span className="ml-2 text-muted-foreground text-xs">
                                                    {entry.partNumber}
                                                  </span>
                                                ) : null}
                                              </CommandItem>
                                            ))}
                                          </CommandGroup>
                                        </CommandList>
                                      </Command>
                                    </PopoverContent>
                                  </Popover>
                                );
                              }

                              return (
                                <FormField
                                  control={form.control}
                                  name={`items.${index}.itemNumber`}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormControl>
                                        <Input placeholder="Item Number" {...field} className="h-9 text-xs" />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              );
                            })()}
                          </td>

                          {/* Required QTY */}
                          <td className="px-2 py-2 w-20">
                            <FormField
                              control={form.control}
                              name={`items.${index}.quantity`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormControl>
                                    <RequisitionQuantityInput
                                      name={field.name}
                                      ref={field.ref}
                                      value={field.value}
                                      onChange={field.onChange}
                                      onBlur={field.onBlur}
                                      className="w-20 max-w-[5rem]"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </td>

                          {/* Unit */}
                          <td className="px-2 py-2">
                            <FormField
                              control={form.control}
                              name={`items.${index}.unit`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormControl>
                                    <Select onValueChange={field.onChange} value={field.value || "PCS"}>
                                      <SelectTrigger className="h-9 text-xs">
                                        <SelectValue placeholder="Select unit" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="PCS">PCS</SelectItem>
                                        <SelectItem value="Roll">Roll</SelectItem>
                                        <SelectItem value="PAR">PAR</SelectItem>
                                        <SelectItem value="MTR">MTR</SelectItem>
                                        <SelectItem value="CM">CM</SelectItem>
                                        <SelectItem value="MM">MM</SelectItem>
                                        <SelectItem value="KG">KG</SelectItem>
                                        <SelectItem value="L">L</SelectItem>
                                        <SelectItem value="SET">SET</SelectItem>
                                        <SelectItem value="BOX">BOX</SelectItem>
                                        <SelectItem value="PKT">PKT</SelectItem>
                                        <SelectItem value="BTL">BTL</SelectItem>
                                        <SelectItem value="TUBE">TUBE</SelectItem>
                                        <SelectItem value="CAN">CAN</SelectItem>
                                        <SelectItem value="DRUM">DRUM</SelectItem>
                                        <SelectItem value="BAG">BAG</SelectItem>
                                        <SelectItem value="SHEET">SHEET</SelectItem>
                                        <SelectItem value="M">M</SelectItem>
                                        <SelectItem value="FT">FT</SelectItem>
                                        <SelectItem value="IN">IN</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </td>

                          {/* Current ROB */}
                          <td className="px-2 py-2">
                            <FormField
                              control={form.control}
                              name={`items.${index}.currentRob`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormControl>
                                    <Input 
                                      type="number" 
                                      step="1"
                                      min="0"
                                      placeholder="0"
                                      {...field} 
                                      onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                      className="h-9 text-xs" 
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </td>

                          {/* Remarks */}
                          <td className="px-2 py-2">
                            <FormField
                              control={form.control}
                              name={`items.${index}.remarks`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormControl>
                                    <Input placeholder="Remarks (optional)" {...field} value={field.value ?? ""} className="h-9 text-xs" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </td>

                          {/* Attachments - paper clip as link only */}
                          <td className="px-1 py-2 w-[26px] max-w-[26px] align-top">
                            <div className="space-y-1">
                              <input
                                type="file"
                                ref={(el) => { fileInputRefs.current[index] = el; }}
                                className="hidden"
                                accept=".pdf,.jpg,.jpeg,.png"
                                multiple
                                onChange={(e) => handleFileSelect(index, e.target.files)}
                              />
                              <button
                                type="button"
                                onClick={() => fileInputRefs.current[index]?.click()}
                                className="text-slate-600 hover:text-slate-900 focus:outline-none focus:ring-0 p-0 inline-flex"
                                title="Attach files"
                              >
                                <Paperclip className="h-4 w-4" />
                              </button>
                              {itemAttachments[index] && itemAttachments[index].length > 0 && (
                                <div className="space-y-0.5 mt-1">
                                  {itemAttachments[index].map((file, fileIndex) => (
                                    <div key={fileIndex} className="flex items-center gap-0.5 bg-slate-50 px-0.5 py-0.5 rounded text-xs">
                                      <span className="truncate max-w-[20px]" title={file.name}>
                                        {file.name.length > 4 ? `${file.name.substring(0, 3)}…` : file.name}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => removeAttachment(index, fileIndex)}
                                        className="text-red-500 hover:text-red-700 shrink-0"
                                      >
                                        <X className="h-3 w-3" />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </td>

                          {/* Actions */}
                          <td className="px-1 py-2 text-center w-[40px] min-w-[40px] max-w-[40px]">
                            <div className="flex flex-col gap-1 items-center">
                              <div className="flex items-center gap-0.5">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => {
                                    // Focus on part name input
                                    const partNameInput = document.querySelector(`input[name="items.${index}.partName"]`) as HTMLInputElement;
                                    if (partNameInput) partNameInput.focus();
                                  }}
                                  title="Edit"
                                >
                                  <Pencil className="h-3.5 w-3.5 text-blue-500" />
                                </Button>
                                {fields.length > 1 && (
                                  <Button
                                       type="button"
                                       variant="ghost"
                                       size="icon"
                                       className="h-7 w-7"
                                       onClick={() => removeItem(index)}
                                       title="Delete"
                                     >
                                       <Trash2 className="h-3.5 w-3.5 text-red-500" />
                                     </Button>
                                )}
                              </div>
                              
                              <FormField
                                control={form.control}
                                name={`items.${index}.addToInventory`}
                                render={({ field }) => (
                                  <FormItem className="flex flex-row items-center space-x-0 space-y-0">
                                    <FormControl>
                                      <Checkbox
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                        aria-label="Mark as Machinery Spare"
                                        title="Mark as Machinery Spare"
                                      />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                            </div>
                          </td>
                        </>
                      ) : isLubeRequisition ? (
                          <>
                            {/* Lube product selection */}
                            <td className="px-3 py-3">
                              <Popover open={lubeTypeComboboxOpen[index]} onOpenChange={(open) => setLubeTypeComboboxOpen(prev => ({ ...prev, [index]: open }))}>
                                <PopoverTrigger asChild>
                                  <FormControl>
                                    <Button
                                      variant="outline"
                                      role="combobox"
                                      className="h-9 w-full justify-between text-left font-normal text-xs"
                                      type="button"
                                      disabled={!selectedLubeOilSupplierId}
                                    >
                                      {!selectedLubeOilSupplierId
                                        ? "Select supplier in setup row"
                                        : form.watch(`items.${index}.oilGrade`)
                                        ? filteredLubeTypes.find(l => l.value === form.watch(`items.${index}.oilGrade`))?.label || form.watch(`items.${index}.oilGrade`)
                                        : "Select lube product"}
                                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                  </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-[400px] p-0 max-h-[400px]" align="start">
                                  <Command>
                                    <CommandInput placeholder="Search lube product..." />
                                    <CommandList>
                                      <CommandEmpty>
                                        {!selectedLubeOilSupplierId
                                          ? "Select a supplier in the setup row first."
                                          : filteredLubeTypes.length === 0
                                            ? "No products for this supplier. Add them in Admin → Lube Oil Catalog."
                                            : "No product found."}
                                      </CommandEmpty>
                                      <CommandGroup className="max-h-[300px] overflow-y-auto">
                                        {filteredLubeTypes.map((lubeType) => (
                                          <CommandItem
                                            key={lubeType.value}
                                            value={`${lubeType.value} ${lubeType.label}`}
                                            onSelect={() => handleLubeOilGradeSelect(index, lubeType)}
                                          >
                                            <Check
                                              className={cn(
                                                "mr-2 h-4 w-4",
                                                form.watch(`items.${index}.oilGrade`) === lubeType.value
                                                  ? "opacity-100"
                                                  : "opacity-0"
                                              )}
                                            />
                                            <div className="flex flex-col">
                                              <span className="font-semibold text-sm">{lubeType.label}</span>
                                              {lubeType.grade && (
                                                <span className="text-xs text-slate-600">{lubeType.grade}</span>
                                              )}
                                              {lubeType.category && (
                                                <span className="text-xs text-slate-500">{lubeType.category}</span>
                                              )}
                                            </div>
                                          </CommandItem>
                                        ))}
                                      </CommandGroup>
                                    </CommandList>
                                  </Command>
                                </PopoverContent>
                              </Popover>
                            </td>

                            <td className="px-3 py-3 text-xs text-slate-600">
                              {form.watch(`items.${index}.manualMachineryName`)?.trim() ||
                                filteredLubeTypes.find(
                                  (l) => l.value === form.watch(`items.${index}.oilGrade`)
                                )?.category ||
                                "—"}
                            </td>
                            
                            {/* Quantity in Liters */}
                            <td className="px-3 py-3">
                              <FormField
                                control={form.control}
                                name={`items.${index}.quantityInLiters`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormControl>
                                      <RequisitionDecimalQuantityInput
                                        name={field.name}
                                        ref={field.ref}
                                        value={field.value}
                                        onChange={(value) => {
                                          field.onChange(value);
                                          form.setValue(`items.${index}.quantity`, value);
                                        }}
                                        onBlur={field.onBlur}
                                        placeholder="0"
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </td>
                            
                            {/* Port of Supply (from requisition Supply Port above) */}
                            <td className="px-3 py-3">
                              <Input
                                value={watchedPortOfSupply || "—"}
                                disabled
                                className="h-9 text-xs bg-slate-50 text-slate-600"
                                title="Set once in Supply Port above — applied to all lines"
                              />
                            </td>
                            
                            {/* Remarks */}
                            <td className="px-3 py-3">
                              <FormField
                                control={form.control}
                                name={`items.${index}.remarks`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormControl>
                                      <Input placeholder="Remarks (optional)" {...field} value={field.value ?? ""} className="h-9 text-xs" />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </td>
                            
                            {/* Attachments */}
                            <td className="px-3 py-3">
                              <div className="space-y-2">
                                <input
                                  type="file"
                                  ref={(el) => { fileInputRefs.current[index] = el; }}
                                  className="hidden"
                                  accept=".pdf,.jpg,.jpeg,.png"
                                  multiple
                                  onChange={(e) => handleFileSelect(index, e.target.files)}
                                />
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => fileInputRefs.current[index]?.click()}
                                  className="h-8 w-full text-xs"
                                >
                                  <Paperclip className="h-3 w-3 mr-1" />
                                  Attach
                                </Button>
                                {itemAttachments[index] && itemAttachments[index].length > 0 && (
                                  <div className="space-y-1">
                                    {itemAttachments[index].map((file, fileIndex) => (
                                      <div key={fileIndex} className="flex items-center gap-1 bg-slate-50 p-1 rounded text-xs">
                                        <span className="truncate flex-1" title={file.name}>
                                          {file.name.length > 15 ? `${file.name.substring(0, 12)}...` : file.name}
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => removeAttachment(index, fileIndex)}
                                          className="text-red-500 hover:text-red-700"
                                        >
                                          <X className="h-3 w-3" />
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </td>
                            
                            {/* Action */}
                            <td className="px-3 py-3 text-center">
                              {fields.length > 1 && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeItem(index)}
                                  className="h-8 px-2 text-red-600 hover:text-red-800 hover:bg-red-50"
                                  title="Delete Item"
                                >
                                  <Trash2 className="h-4 w-4 mr-1" />
                                  Delete
                                </Button>
                              )}
                            </td>
                          </>
                        ) : isSpareRequisition ? (
                          <>
                            {spareIsMainEngine && (
                              <td className="px-3 py-3 w-[10.2rem]">
                                <FormField
                                  control={form.control}
                                  name={`items.${index}.plateNumber`}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormControl>
                                        <Input
                                          placeholder="Plate No."
                                          {...field}
                                          className="h-9 text-xs min-w-[10.2rem] w-full"
                                          onBlur={(e) => {
                                            field.onBlur();
                                            void fetchPlateCatalog(e.target.value);
                                          }}
                                        />
                                      </FormControl>
                                      {(() => {
                                        const plate = (field.value || "").trim();
                                        if (!plate) return null;
                                        const key = plateCatalogCacheKey(plate);
                                        const catalog = plateCatalogByPlate[key];
                                        const loading = plateCatalogLoading[key];
                                        if (loading) {
                                          return (
                                            <p className="text-[10px] text-muted-foreground mt-1">
                                              Loading items…
                                            </p>
                                          );
                                        }
                                        if (catalog && catalog.length > 0) {
                                          return (
                                            <Button
                                              type="button"
                                              variant="link"
                                              className="h-auto p-0 mt-1 text-[10px] text-blue-700"
                                              onClick={() => void loadAllPlateCatalogItems(plate)}
                                            >
                                              Load {catalog.length} item(s)
                                            </Button>
                                          );
                                        }
                                        return null;
                                      })()}
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </td>
                            )}
                            {/* Part Number */}
                            <td className="px-3 py-3 w-32">
                              <FormField
                                control={form.control}
                                name={`items.${index}.partNumber`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormControl>
                                      <Input placeholder="Part Number" {...field} className="h-9 text-xs" />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </td>
                            
                            {/* Part Name */}
                            <td className="px-3 py-3">
                              <Popover open={sparePartsPopoverOpen[index]} onOpenChange={(open) => setSparePartsPopoverOpen(prev => ({ ...prev, [index]: open }))}>
                                <PopoverTrigger asChild>
                                  <FormControl>
                                    <Button
                                      variant="outline"
                                      role="combobox"
                                      className="h-9 w-full justify-between text-left font-normal text-xs"
                                      type="button"
                                    >
                                      {form.watch(`items.${index}.partName`) || "Search parts..."}
                                      <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                  </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-[400px] p-0 max-h-[400px]" align="start">
                                  <Command className="max-h-[400px]">
                                    <CommandInput
                                      placeholder="Search by part number or name..."
                                      value={sparePartsSearchQuery[index] || ""}
                                      onValueChange={(value) => {
                                        setSparePartsSearchQuery(prev => ({ ...prev, [index]: value }));
                                        // Use requisition-level machinery for SPR
                                        const machineryId = spareMachineryId;
                                        if (value.length >= 2) {
                                          searchSpareParts(value, index, machineryId);
                                        }
                                      }}
                                    />
                                    <CommandEmpty>
                                      {sparePartsSearchQuery[index] && sparePartsSearchQuery[index].length >= 2
                                        ? "No parts found."
                                        : "Type at least 2 characters to search..."}
                                    </CommandEmpty>
                                    {sparePartsSearchResults[index] && sparePartsSearchResults[index].length > 0 && (
                                      <CommandGroup className="max-h-[300px] overflow-y-auto">
                                        {sparePartsSearchResults[index].map((part: any) => (
                                          <CommandItem
                                            key={part.id}
                                            value={`${part.sparePartNumber} ${part.name}`}
                                            onSelect={() => handleSparePartSelect(index, part)}
                                          >
                                            <Check
                                              className={cn(
                                                "mr-2 h-4 w-4",
                                                form.watch(`items.${index}.partNumber`) === part.sparePartNumber
                                                  ? "opacity-100"
                                                  : "opacity-0"
                                              )}
                                            />
                                            <div className="flex flex-col">
                                              <span className="font-semibold text-sm">{part.sparePartNumber}</span>
                                              <span className="text-xs text-slate-600">{part.name}</span>
                                            </div>
                                          </CommandItem>
                                        ))}
                                      </CommandGroup>
                                    )}
                                  </Command>
                                  <div className="border-t p-2">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        setSparePartsPopoverOpen(prev => ({ ...prev, [index]: false }));
                                        const partNumber = prompt("Enter part number manually:");
                                        const partName = prompt("Enter part name manually:");
                                        if (!partNumber?.trim()) return;
                                        const rt = form.getValues("requisitionType");
                                        const items = form.getValues("items");
                                        if (
                                          isCatalogDuplicateInItems(rt, items, index, {
                                            partNumber: partNumber.trim(),
                                          })
                                        ) {
                                          setDuplicateItemAlertMessage(DUPLICATE_ITEM_SELECTED_MESSAGE);
                                          setDuplicateItemAlertOpen(true);
                                          return;
                                        }
                                        form.setValue(`items.${index}.partNumber`, partNumber);
                                        if (partName) {
                                          form.setValue(`items.${index}.partName`, partName);
                                        }
                                      }}
                                      className="w-full text-xs"
                                    >
                                      Enter manually instead
                                    </Button>
                                  </div>
                                </PopoverContent>
                              </Popover>
                            </td>
                            
                            {/* Item Number */}
                            <td className="px-3 py-3">
                              {(() => {
                                const plateVal = (form.watch(`items.${index}.plateNumber`) || "").trim();
                                const catalogKey = plateVal ? plateCatalogCacheKey(plateVal) : "";
                                const plateCatalog = catalogKey ? plateCatalogByPlate[catalogKey] : [];
                                const hasPlateCatalog = (plateCatalog?.length ?? 0) > 0;

                                if (hasPlateCatalog) {
                                  return (
                                    <Popover
                                      open={plateItemComboboxOpen[index]}
                                      onOpenChange={(open) =>
                                        setPlateItemComboboxOpen((prev) => ({ ...prev, [index]: open }))
                                      }
                                    >
                                      <PopoverAnchor asChild>
                                        <FormField
                                          control={form.control}
                                          name={`items.${index}.itemNumber`}
                                          render={({ field }) => (
                                            <FormItem>
                                              <FormControl>
                                                <Input
                                                  placeholder="Select or type item no."
                                                  {...field}
                                                  className="h-9 text-xs"
                                                  onFocus={() =>
                                                    setPlateItemComboboxOpen((prev) => ({
                                                      ...prev,
                                                      [index]: true,
                                                    }))
                                                  }
                                                />
                                              </FormControl>
                                              <FormMessage />
                                            </FormItem>
                                          )}
                                        />
                                      </PopoverAnchor>
                                      <PopoverContent className="w-72 p-0" align="start">
                                        <Command>
                                          <CommandInput placeholder="Search item numbers…" />
                                          <CommandList>
                                            <CommandEmpty>No matching items on this plate.</CommandEmpty>
                                            <CommandGroup heading="Items on this plate">
                                              {plateCatalog.map((entry) => (
                                                <CommandItem
                                                  key={entry.itemNumber}
                                                  value={entry.itemNumber}
                                                  onSelect={() => applyPlateCatalogItem(index, entry)}
                                                >
                                                  <span className="font-medium">{entry.itemNumber}</span>
                                                  {entry.partNumber ? (
                                                    <span className="ml-2 text-muted-foreground text-xs">
                                                      {entry.partNumber}
                                                    </span>
                                                  ) : null}
                                                </CommandItem>
                                              ))}
                                            </CommandGroup>
                                          </CommandList>
                                        </Command>
                                      </PopoverContent>
                                    </Popover>
                                  );
                                }

                                return (
                                  <FormField
                                    control={form.control}
                                    name={`items.${index}.itemNumber`}
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormControl>
                                          <Input placeholder="Item Number" {...field} className="h-9 text-xs" />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                );
                              })()}
                            </td>
                            
                            {/* Required QTY */}
                            <td className="px-3 py-3 w-20">
                              <FormField
                                control={form.control}
                                name={`items.${index}.quantity`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormControl>
                                      <RequisitionQuantityInput
                                        name={field.name}
                                        ref={field.ref}
                                        value={field.value}
                                        onChange={field.onChange}
                                        onBlur={field.onBlur}
                                        className="w-20 max-w-[5rem]"
                                        placeholder="0"
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </td>
                            
                            {/* Current ROB */}
                            <td className="px-3 py-3">
                              <FormField
                                control={form.control}
                                name={`items.${index}.currentRob`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormControl>
                                      <Input
                                        type="number"
                                        step="1"
                                        min="0"
                                        placeholder="0"
                                        name={field.name}
                                        ref={field.ref}
                                        onBlur={field.onBlur}
                                        onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 0)}
                                        value={field.value ?? ""}
                                        className="h-9 text-xs"
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </td>
                            
                            {/* Remarks */}
                            <td className="px-3 py-3">
                              <FormField
                                control={form.control}
                                name={`items.${index}.remarks`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormControl>
                                      <Input placeholder="Remarks (optional)" {...field} value={field.value ?? ""} className="h-9 text-xs" />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </td>
                            
                            {/* Attachments */}
                            <td className="px-3 py-3">
                              <div className="space-y-2">
                                <input
                                  type="file"
                                  ref={(el) => { fileInputRefs.current[index] = el; }}
                                  className="hidden"
                                  accept=".pdf,.jpg,.jpeg,.png"
                                  multiple
                                  onChange={(e) => handleFileSelect(index, e.target.files)}
                                />
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => fileInputRefs.current[index]?.click()}
                                  className="h-8 w-full text-xs"
                                >
                                  <Paperclip className="h-3 w-3 mr-1" />
                                  Attach
                                </Button>
                                {itemAttachments[index] && itemAttachments[index].length > 0 && (
                                  <div className="space-y-1">
                                    {itemAttachments[index].map((file, fileIndex) => (
                                      <div key={fileIndex} className="flex items-center gap-1 bg-slate-50 p-1 rounded text-xs">
                                        <span className="truncate flex-1" title={file.name}>
                                          {file.name.length > 15 ? `${file.name.substring(0, 12)}...` : file.name}
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => removeAttachment(index, fileIndex)}
                                          className="text-red-500 hover:text-red-700"
                                        >
                                          <X className="h-3 w-3" />
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </td>
                            
                            {/* Action */}
                            <td className="px-3 py-3 text-center">
                              <div className="flex flex-col gap-2 items-center">
                                <div className="flex items-center gap-2">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                      // Focus on part name input
                                      const partNameInput = document.querySelector(`input[name="items.${index}.partName"]`) as HTMLInputElement;
                                      if (partNameInput) partNameInput.focus();
                                    }}
                                    title="Edit"
                                  >
                                    <Pencil className="h-4 w-4 text-blue-500" />
                                  </Button>
                                  {fields.length > 1 && (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => removeItem(index)}
                                      title="Delete"
                                    >
                                      <Trash2 className="h-4 w-4 text-red-500" />
                                    </Button>
                                  )}
                                </div>
                                <FormField
                                  control={form.control}
                                  name={`items.${index}.addToInventory`}
                                  render={({ field }) => (
                                    <FormItem className="flex flex-row items-center space-x-0 space-y-0">
                                      <FormControl>
                                        <Checkbox
                                          checked={field.value}
                                          onCheckedChange={field.onChange}
                                          aria-label="Mark as Machinery Spare"
                                          title="Mark as Machinery Spare"
                                        />
                                      </FormControl>
                                    </FormItem>
                                  )}
                                />
                              </div>
                            </td>
                          </>
                        ) : isPaintRequisition ? (
                          <>
                            {/* Brand — selected once on row 1, shown on all rows */}
                            <td className="px-3 py-3">
                              {index === 0 ? (
                                <FormItem>
                                  {paintManualBrandMode ? (
                                    <div className="flex gap-2">
                                      <FormControl>
                                        <Input
                                          placeholder="Enter brand name"
                                          className="h-9 text-xs"
                                          value={paintManualBrandValue}
                                          onChange={(e) => {
                                            setPaintManualBrandValue(e.target.value);
                                            applyPaintBrandToAllItems(e.target.value);
                                          }}
                                        />
                                      </FormControl>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-9 px-2"
                                        onClick={() => {
                                          setPaintManualBrandMode(false);
                                          setPaintManualBrandValue("");
                                          applyPaintBrandToAllItems("");
                                        }}
                                      >
                                        <X className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  ) : (
                                    <Select
                                      onValueChange={(value) => {
                                        if (value === "__manual__") {
                                          setPaintManualBrandMode(true);
                                          setPaintManualBrandValue("");
                                          applyPaintBrandToAllItems("");
                                        } else {
                                          applyPaintBrandToAllItems(value);
                                        }
                                      }}
                                      value={requisitionPaintBrand || undefined}
                                    >
                                      <FormControl>
                                        <SelectTrigger className="h-9 text-xs">
                                          <SelectValue placeholder="Select brand" />
                                        </SelectTrigger>
                                      </FormControl>
                                      <SelectContent>
                                        {paintBrands.map((brand) => (
                                          <SelectItem key={brand} value={brand}>
                                            {brand}
                                          </SelectItem>
                                        ))}
                                        <SelectItem value="__manual__" className="text-blue-600 font-medium">
                                          <Plus className="h-3 w-3 inline mr-1" />
                                          Add New Brand
                                        </SelectItem>
                                      </SelectContent>
                                    </Select>
                                  )}
                                </FormItem>
                              ) : (
                                <Input
                                  value={requisitionPaintBrand || "—"}
                                  disabled
                                  className="h-9 text-xs bg-slate-50 text-slate-600"
                                  title="Brand is set once for the whole requisition (row 1)"
                                />
                              )}
                            </td>

                            {/* Product Name - Paint Search */}
                            <td className="px-3 py-3">
                              <Popover
                                open={paintPopoverOpen[index]}
                                onOpenChange={(open) => {
                                  setPaintPopoverOpen((prev) => ({ ...prev, [index]: open }));
                                  if (open && requisitionPaintBrand.trim()) {
                                    void loadPaintCatalogProducts(
                                      paintSearchQuery[index] || "",
                                      index,
                                      requisitionPaintBrand
                                    );
                                  }
                                }}
                              >
                                <PopoverTrigger asChild>
                                  <FormControl>
                                    <Button
                                      variant="outline"
                                      role="combobox"
                                      className="h-9 w-full justify-between text-left font-normal text-xs"
                                      type="button"
                                    >
                                      {form.watch(`items.${index}.paintProductName`) || "Search paint..."}
                                      <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                  </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-[500px] p-0 max-h-[400px]" align="start">
                                  <Command className="max-h-[400px]">
                                    <CommandInput
                                      placeholder="Search by product name or code..."
                                      value={paintSearchQuery[index] || ""}
                                      onValueChange={(value) => {
                                        setPaintSearchQuery((prev) => ({ ...prev, [index]: value }));
                                        if (requisitionPaintBrand.trim() || value.length >= 2) {
                                          void loadPaintCatalogProducts(
                                            value,
                                            index,
                                            requisitionPaintBrand
                                          );
                                        }
                                      }}
                                    />
                                    <CommandEmpty>
                                      {requisitionPaintBrand.trim()
                                        ? paintSearchQuery[index] && paintSearchQuery[index].length >= 2
                                          ? "No products found. Add via Admin → Paint Catalog or use Add New Paint."
                                          : "No registered products for this brand."
                                        : paintSearchQuery[index] && paintSearchQuery[index].length >= 2
                                          ? "No products found. Select a brand first or use Add New Paint."
                                          : "Select a paint brand to browse products, or type at least 2 characters..."}
                                    </CommandEmpty>
                                    {paintSearchResults[index] && paintSearchResults[index].length > 0 && (
                                      <CommandGroup className={CATALOG_LIST_SCROLL_CLASS}>
                                        {paintSearchResults[index].map((paint: any) => (
                                          <CommandItem
                                            key={paint.id}
                                            value={`${paint.maker || paint.brand} ${paint.productName} ${paint.productCode || ""}`}
                                            onSelect={() => handlePaintSelect(index, paint)}
                                          >
                                            <Check
                                              className={cn(
                                                "mr-2 h-4 w-4",
                                                form.watch(`items.${index}.paintProductName`) === paint.productName
                                                  ? "opacity-100"
                                                  : "opacity-0"
                                              )}
                                            />
                                            <div className="flex flex-col">
                                              <span className="font-semibold text-sm">
                                                {paint.maker || paint.brand} — {paint.productName}
                                              </span>
                                              {paint.productCode?.trim() ? (
                                                <span className="text-xs text-slate-600">
                                                  Code: {paint.productCode}
                                                </span>
                                              ) : null}
                                            </div>
                                          </CommandItem>
                                        ))}
                                      </CommandGroup>
                                    )}
                                  </Command>
                                  <div className="border-t p-2 space-y-2">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        setPaintPopoverOpen(prev => ({ ...prev, [index]: false }));
                                        setNewPaintData(prev => ({
                                          ...prev,
                                          [index]: {
                                            ...prev[index],
                                            brand: requisitionPaintBrand || prev[index]?.brand || "",
                                          },
                                        }));
                                        setPaintAddDialogOpen(prev => ({ ...prev, [index]: true }));
                                      }}
                                      className="w-full text-xs"
                                    >
                                      <Plus className="h-3 w-3 mr-1" />
                                      Add New Paint
                                    </Button>
                                  </div>
                                </PopoverContent>
                              </Popover>
                            </td>

                            {/* Color Grade */}
                            <td className="px-3 py-3">
                              <Popover
                                open={Boolean(paintColorPopoverOpen[index])}
                                onOpenChange={(open) => {
                                  setPaintColorPopoverOpen((prev) => ({ ...prev, [index]: open }));
                                  if (open) {
                                    void loadPaintColorOptions(
                                      index,
                                      requisitionPaintBrand,
                                      form.getValues(`items.${index}.paintProductName`),
                                      paintColorSearchQuery[index] || ""
                                    );
                                  }
                                }}
                              >
                                <PopoverTrigger asChild>
                                  <FormControl>
                                    <Button
                                      variant="outline"
                                      role="combobox"
                                      className="h-9 w-full justify-between text-left font-normal text-xs"
                                      type="button"
                                    >
                                      {form.watch(`items.${index}.paintColorGrade`) || "Select color grade..."}
                                      <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                  </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-[320px] p-0" align="start">
                                  <Command>
                                    <CommandInput
                                      placeholder="Search colors (e.g. Light Green)..."
                                      value={paintColorSearchQuery[index] || ""}
                                      onValueChange={(value) => {
                                        setPaintColorSearchQuery((prev) => ({ ...prev, [index]: value }));
                                        void loadPaintColorOptions(
                                          index,
                                          requisitionPaintBrand,
                                          form.getValues(`items.${index}.paintProductName`),
                                          value
                                        );
                                      }}
                                    />
                                    <CommandEmpty>No color grades found.</CommandEmpty>
                                    {paintColorOptions[index] && paintColorOptions[index].length > 0 && (
                                      <CommandGroup className={CATALOG_LIST_SCROLL_CLASS}>
                                        {paintColorOptions[index].map((color) => (
                                          <CommandItem
                                            key={color.colorGrade}
                                            value={`${color.colorGrade} ${color.colorName}`}
                                            onSelect={() => handlePaintColorSelect(index, color)}
                                          >
                                            <Check
                                              className={cn(
                                                "mr-2 h-4 w-4",
                                                form.watch(`items.${index}.paintColorGrade`) === color.colorGrade
                                                  ? "opacity-100"
                                                  : "opacity-0"
                                              )}
                                            />
                                            <span
                                              className="mr-2 inline-block h-4 w-4 shrink-0 rounded border border-slate-300"
                                              style={{ backgroundColor: color.colorHex }}
                                              aria-hidden
                                            />
                                            <div className="flex flex-col">
                                              <span className="text-sm font-medium">{color.colorGrade}</span>
                                              <span className="text-xs text-muted-foreground">{color.colorName}</span>
                                            </div>
                                          </CommandItem>
                                        ))}
                                      </CommandGroup>
                                    )}
                                  </Command>
                                </PopoverContent>
                              </Popover>
                            </td>

                            {/* Color Preview */}
                            <td className="px-3 py-3">
                              {(() => {
                                const previewHex = getPaintPreviewHex(index);
                                return previewHex ? (
                                  <div
                                    className="w-12 h-12 rounded border-2 border-slate-300"
                                    style={{ backgroundColor: previewHex }}
                                    title={
                                      form.watch(`items.${index}.paintColorName`) ||
                                      form.watch(`items.${index}.paintColorGrade`) ||
                                      "Color preview"
                                    }
                                  />
                                ) : (
                                  <div className="w-12 h-12 rounded border-2 border-slate-300 bg-slate-100 flex items-center justify-center">
                                    <span className="text-xs text-slate-400">N/A</span>
                                  </div>
                                );
                              })()}
                            </td>

                            {/* Category (Paint/Thinner/Hardener) */}
                            <td className="px-3 py-3">
                              <FormField
                                control={form.control}
                                name={`items.${index}.paintCategory`}
                                render={({ field }) => (
                                  <FormItem>
                                    <Select onValueChange={field.onChange} value={field.value || "Paint"}>
                                      <FormControl>
                                        <SelectTrigger className="h-9 text-xs">
                                          <SelectValue />
                                        </SelectTrigger>
                                      </FormControl>
                                      <SelectContent>
                                        <SelectItem value="Paint">Paint</SelectItem>
                                        <SelectItem value="Thinner">Thinner</SelectItem>
                                        <SelectItem value="Hardener">Hardener</SelectItem>
                                      </SelectContent>
                                    </Select>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </td>

                            {/* Quantity */}
                            <td className="px-3 py-3">
                              <FormField
                                control={form.control}
                                name={`items.${index}.quantity`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormControl>
                                      <RequisitionQuantityInput
                                        name={field.name}
                                        ref={field.ref}
                                        value={field.value}
                                        onChange={field.onChange}
                                        onBlur={field.onBlur}
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </td>

                            {/* Unit */}
                            <td className="px-3 py-3">
                              <FormField
                                control={form.control}
                                name={`items.${index}.unit`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormControl>
                                      <Input placeholder="LTR" {...field} className="h-9 text-xs" />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </td>

                            {/* Remarks */}
                            <td className="px-3 py-3">
                              <FormField
                                control={form.control}
                                name={`items.${index}.remarks`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormControl>
                                      <Input placeholder="Remarks (optional)" {...field} value={field.value ?? ""} className="h-9 text-xs" />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </td>

                            {/* Attachments */}
                            <td className="px-3 py-3">
                              <div className="space-y-2">
                                <input
                                  type="file"
                                  ref={(el) => { fileInputRefs.current[index] = el; }}
                                  className="hidden"
                                  accept=".pdf,.jpg,.jpeg,.png"
                                  multiple
                                  onChange={(e) => handleFileSelect(index, e.target.files)}
                                />
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => fileInputRefs.current[index]?.click()}
                                  className="h-8 w-full text-xs"
                                >
                                  <Paperclip className="h-3 w-3 mr-1" />
                                  Attach
                                </Button>
                                {itemAttachments[index] && itemAttachments[index].length > 0 && (
                                  <div className="space-y-1">
                                    {itemAttachments[index].map((file, fileIndex) => (
                                      <div key={fileIndex} className="flex items-center gap-1 bg-slate-50 p-1 rounded text-xs">
                                        <span className="truncate flex-1" title={file.name}>
                                          {file.name.length > 15 ? `${file.name.substring(0, 12)}...` : file.name}
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => removeAttachment(index, fileIndex)}
                                          className="text-red-500 hover:text-red-700"
                                        >
                                          <X className="h-3 w-3" />
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </td>

                            {/* Action */}
                            <td className="px-3 py-3 text-center">
                              {fields.length > 1 && (
                                <Button
                                  type="button"
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => removeItem(index)}
                                  className="h-9"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </Button>
                              )}
                            </td>
                          </>
                        ) : isChemicalCatalogRequisition ? (
                          <ChemicalRequisitionItemCells
                            index={index}
                            form={form}
                            fields={fields}
                            requisitionChemicalMaker={requisitionChemicalMaker}
                            chemicalMakers={chemicalMakers}
                            chemicalManualMakerMode={chemicalManualMakerMode}
                            chemicalManualMakerValue={chemicalManualMakerValue}
                            setChemicalManualMakerMode={setChemicalManualMakerMode}
                            setChemicalManualMakerValue={setChemicalManualMakerValue}
                            applyChemicalMakerToAllItems={applyChemicalMakerToAllItems}
                            chemicalSearchResults={chemicalSearchResults}
                            chemicalSearchQuery={chemicalSearchQuery}
                            chemicalPopoverOpen={chemicalPopoverOpen}
                            setChemicalSearchQuery={setChemicalSearchQuery}
                            setChemicalPopoverOpen={setChemicalPopoverOpen}
                            loadChemicalCatalogProducts={loadChemicalCatalogProducts}
                            handleChemicalSelect={handleChemicalSelect}
                            itemAttachments={itemAttachments}
                            fileInputRefs={fileInputRefs}
                            handleFileSelect={handleFileSelect}
                            removeAttachment={removeAttachment}
                            removeItem={removeItem}
                            onAddNewProduct={handleAddNewChemicalProduct}
                          />
                        ) : (
                          <>
                      {/* Item Name - IMPA Code Search */}
                      <td className="px-3 py-3">
                        <FormField
                          control={form.control}
                          name={`items.${index}.itemName`}
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                {isImpaCatalogRequisition ? (
                                  <Popover
                                    open={Boolean(impaPopoverOpen[index])}
                                    onOpenChange={(open) =>
                                      setImpaPopoverOpen((prev) => ({ ...prev, [index]: open }))
                                    }
                                    modal={false}
                                  >
                                    <PopoverAnchor asChild>
                                      <div
                                        className="relative w-full min-w-0"
                                        data-impa-item-anchor={index}
                                      >
                                        <Search className="pointer-events-none absolute left-2 top-1/2 z-10 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                                        <Input
                                          placeholder={impaCatalogItemNamePlaceholder(
                                            watchedRowReqType,
                                            selectedSubCategoryCodes
                                          )}
                                          value={field.value || ""}
                                          onFocus={() => {
                                            setImpaPopoverOpen((prev) => ({ ...prev, [index]: true }));
                                            if (isScopedImpaBrowse) {
                                              void searchIMPACodes(
                                                impaSearchQuery[index] || field.value || "",
                                                index
                                              );
                                            }
                                          }}
                                          onChange={(e) => {
                                            const value = e.target.value;
                                            field.onChange(value);
                                            setImpaSearchQuery((prev) => ({ ...prev, [index]: value }));
                                            setImpaPopoverOpen((prev) => ({ ...prev, [index]: true }));
                                            debouncedSearch(value, index);
                                          }}
                                          className={cn(
                                            "h-9 w-full pl-7",
                                            "border-primary/30 focus-visible:ring-primary/25"
                                          )}
                                        />
                                      </div>
                                    </PopoverAnchor>
                                    <PopoverContent
                                      align="start"
                                      side="bottom"
                                      sideOffset={6}
                                      collisionPadding={16}
                                      className="z-[3000] min-w-[var(--radix-popover-anchor-width,18rem)] max-w-[calc(100vw-2rem)] max-h-[min(22rem,55vh)] overflow-hidden p-0"
                                      onOpenAutoFocus={(e) => e.preventDefault()}
                                      onCloseAutoFocus={(e) => e.preventDefault()}
                                      onInteractOutside={(e) => {
                                        const t = e.target as HTMLElement | null;
                                        if (
                                          t?.closest(`[data-impa-item-anchor="${index}"]`)
                                        ) {
                                          e.preventDefault();
                                        }
                                      }}
                                    >
                                      <Command className="max-h-[min(22rem,55vh)] rounded-md">
                                        <CommandList>
                                          <CommandEmpty>
                                            {isProvisionRequisition
                                              ? (impaSearchQuery[index] || "").length >= 2
                                                ? "No provision/welfare IMPA items found."
                                                : "Loading provision & welfare items (IMPA 000101–101939)..."
                                              : isChemicalRequisition
                                                ? (impaSearchQuery[index] || "").length >= 2
                                                  ? "No cleaning/chemical IMPA items found."
                                                  : `Loading cleaning & chemical items (${CHEMICAL_IMPA_CHAPTER_LABEL})...`
                                                : (impaSearchQuery[index] || "").length >= 2
                                                  ? "No IMPA codes found."
                                                  : "Type at least 2 characters to search..."}
                                          </CommandEmpty>
                                          {impaSearchResults[index] && impaSearchResults[index].length > 0 && (
                                            <CommandGroup
                                              heading={
                                                isProvisionRequisition
                                                  ? "Provision & welfare (IMPA 000101–101939)"
                                                  : isChemicalRequisition
                                                    ? `Cleaning & chemicals (${CHEMICAL_IMPA_CHAPTER_LABEL})`
                                                    : "IMPA Matches"
                                              }
                                              className={isScopedImpaBrowse ? CATALOG_LIST_SCROLL_CLASS : undefined}
                                            >
                                              {impaSearchResults[index].map((impa: any) => (
                                                <CommandItem
                                                  key={impa.id}
                                                  value={`${impa.impaCode} ${impa.itemName} ${impa.unit || ""}`}
                                                  className="flex items-start gap-2 py-2"
                                                  onSelect={() => handleIMPASelect(index, impa)}
                                                >
                                                  <Check
                                                    className={cn(
                                                      "mt-0.5 h-3.5 w-3.5",
                                                      (field.value === impa.itemName ||
                                                        form.getValues(`items.${index}.impaCode`) ===
                                                          impa.impaCode)
                                                        ? "opacity-100"
                                                        : "opacity-0"
                                                    )}
                                                  />
                                                  <div className="min-w-0">
                                                    <div className="text-xs font-semibold text-foreground">
                                                      {impa.impaCode}
                                                    </div>
                                                    <div className="truncate text-xs text-muted-foreground">
                                                      {impa.itemName}
                                                    </div>
                                                    <div className="text-[11px] text-muted-foreground">
                                                      Unit: {impa.unit || "—"}
                                                    </div>
                                                  </div>
                                                </CommandItem>
                                              ))}
                                            </CommandGroup>
                                          )}
                                        </CommandList>
                                      </Command>
                                    </PopoverContent>
                                  </Popover>
                                ) : (
                                  <div className="relative">
                                    <Search className="pointer-events-none absolute left-2 top-1/2 z-10 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                      placeholder="Item name"
                                      value={field.value || ""}
                                      onChange={(e) => field.onChange(e.target.value)}
                                      className="h-9 w-full pl-7"
                                    />
                                  </div>
                                )}
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </td>
                      
                      {/* IMPA Code - column 20% wider */}
                      <td className="px-3 py-3 w-[9.6rem] min-w-[9.6rem]">
                        <FormField
                          control={form.control}
                          name={`items.${index}.impaCode`}
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <div className="relative">
                                <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                                <Input 
                                  placeholder={impaCatalogCodePlaceholder(
                                    watchedRowReqType,
                                    selectedSubCategoryCodes
                                  )} 
                                  {...field}
                                  value={field.value ?? ""}
                                  onFocus={() => {
                                    if (isImpaCatalogRequisition) {
                                      setImpaPopoverOpen((prev) => ({ ...prev, [index]: true }));
                                      if (isScopedImpaBrowse) {
                                        void searchIMPACodes(field.value || "", index);
                                      }
                                    }
                                  }}
                                  onChange={(e) => {
                                    field.onChange(e);
                                    if (!isImpaCatalogRequisition) return;
                                    const value = e.target.value;
                                    setImpaSearchQuery(prev => ({ ...prev, [index]: value }));
                                    setImpaPopoverOpen(prev => ({ ...prev, [index]: true }));
                                    debouncedSearch(value, index);
                                  }}
                                  className={cn(
                                    "h-9 w-full min-w-0 pl-7 text-xs",
                                    !isImpaCatalogRequisition && "bg-slate-50"
                                  )}
                                />
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </td>
                      
                      {/* Quantity */}
                      <td className="px-3 py-3">
                        <FormField
                          control={form.control}
                          name={`items.${index}.quantity`}
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <RequisitionQuantityInput
                                  name={field.name}
                                  ref={field.ref}
                                  value={field.value}
                                  onChange={field.onChange}
                                  onBlur={field.onBlur}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </td>
                      
                      {/* Unit - column 20% wider */}
                      <td className="px-3 py-3 w-[7.2rem] min-w-[7.2rem]">
                        <FormField
                          control={form.control}
                          name={`items.${index}.unit`}
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Input placeholder="pcs, kg" {...field} value={field.value ?? ""} className="h-9 w-full min-w-0" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </td>
                      
                      {/* Remarks */}
                      <td className="px-3 py-3">
                        <FormField
                          control={form.control}
                          name={`items.${index}.remarks`}
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Input placeholder="Remarks (optional)" {...field} value={field.value ?? ""} className="h-9 text-xs" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </td>
                      
                      {/* Attachments - icon only, narrow column */}
                      <td className="px-1 py-3 text-center w-10">
                        <div className="flex flex-col items-center gap-1">
                          <input
                            type="file"
                            ref={(el) => { fileInputRefs.current[index] = el; }}
                            className="hidden"
                            accept=".pdf,.jpg,.jpeg,.png"
                            multiple
                            onChange={(e) => handleFileSelect(index, e.target.files)}
                          />
                          <button
                            type="button"
                            onClick={() => fileInputRefs.current[index]?.click()}
                            className="p-1.5 rounded hover:bg-slate-100 text-slate-600 hover:text-slate-800"
                            title="Attach files"
                          >
                            <Paperclip className="h-4 w-4" />
                          </button>
                          {itemAttachments[index] && itemAttachments[index].length > 0 && (
                            <span className="text-xs text-slate-500" title={itemAttachments[index].map(f => f.name).join(", ")}>
                              {itemAttachments[index].length}
                            </span>
                          )}
                        </div>
                      </td>
                      
                      {/* Action - narrow column: show delete when 2+ rows OR when this row has IMPA/item name */}
                      <td className="px-1 py-3 text-center w-16">
                        {(() => {
                          const itemName = form.watch(`items.${index}.itemName`);
                          const impaCode = form.watch(`items.${index}.impaCode`);
                          const hasContent = (itemName && String(itemName).trim() !== "") || (impaCode && String(impaCode).trim() !== "");
                          const showDelete = fields.length > 1 || hasContent;
                          return showDelete ? (
                            <Button
                              type="button"
                              variant="destructive"
                              size="icon"
                              onClick={() => removeItem(index)}
                              className="h-8 w-8"
                              title="Delete item"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          ) : null;
                        })()}
                      </td>
                          </>
                        )}
                    </tr>
                      
                      {/* Machinery Details Row for Spare Requisition */}
                      {isSpareRequisition && selectedMachineryDetails[index] && (
                        <tr className="border-b border-slate-200 bg-slate-50">
                          <td colSpan={11} className="px-3 py-2">
                            <div className="grid grid-cols-3 gap-4 text-xs">
                              <div>
                                <span className="font-semibold text-slate-600">Make:</span>
                                <span className="ml-2">{selectedMachineryDetails[index].make}</span>
                              </div>
                              <div>
                                <span className="font-semibold text-slate-600">Model:</span>
                                <span className="ml-2">{selectedMachineryDetails[index].model}</span>
                              </div>
                              <div>
                                <span className="font-semibold text-slate-600">Serial Number:</span>
                                <span className="ml-2">{selectedMachineryDetails[index].serialNumber}</span>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
        )}
      </form>
    </Form>
    </FormProvider>
  );

  const sprCopyAllSelected =
    copyEligibleItems.length > 0 &&
    copyEligibleItems.every((it) => copySelectedItemIds.has(String(it.id)));

  const duplicateItemAlertJsx = (
    <AlertDialog open={duplicateItemAlertOpen} onOpenChange={setDuplicateItemAlertOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Item already selected</AlertDialogTitle>
          <AlertDialogDescription className="text-left whitespace-pre-wrap">
            {duplicateItemAlertMessage}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction type="button">OK</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  const sprCopyDialogJsx = (
    <Dialog open={showCopyDialog} onOpenChange={closeSprCopyDialog}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Copy spare parts from a previous requisition</DialogTitle>
          <DialogDescription>
            {copyImportStep === "search"
              ? "Search by requisition number, manual number, or heading. Only requisitions that already contain lines for the machinery selected for this spare requisition are listed."
              : `Review lines from ${copySourceMeta?.displayNumber ?? ""}. Only parts for your current machinery are shown; each imported line will use that machinery.`}
          </DialogDescription>
        </DialogHeader>

        {copyImportStep === "search" ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="spr-copy-search">Search</Label>
              <Input
                id="spr-copy-search"
                placeholder="Requisition number, manual number, or heading…"
                value={copySearchQuery}
                onChange={(e) => setCopySearchQuery(e.target.value)}
              />
            </div>
            {copySearchLoading ? (
              <div className="flex justify-center py-10">
                <ActiniumLoader size="lg" />
              </div>
            ) : copySearchResults.length === 0 ? (
              <p className="text-center text-slate-500 py-8">
                No matching spare requisitions for this vessel and machinery.
              </p>
            ) : (
              <div className="grid max-h-[min(50vh,28rem)] gap-2 overflow-y-auto pr-1">
                {copySearchResults.map((req) => (
                  <div
                    key={req.id}
                    className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="font-medium truncate">
                        {req.displayNumber} — {req.heading}
                      </div>
                      <div className="text-sm text-slate-500">
                        {req.createdAt ? new Date(req.createdAt).toLocaleDateString() : ""}
                        {typeof req.eligibleItemCount === "number"
                          ? ` · ${req.eligibleItemCount} line(s) for this machinery`
                          : ""}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="shrink-0"
                      disabled={loadingCopyReqDetail}
                      onClick={() =>
                        openSprCopyPickItems(req.id, {
                          displayNumber: req.displayNumber,
                          heading: req.heading,
                        })
                      }
                    >
                      View & select lines
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-1 px-0 text-muted-foreground"
              onClick={() => {
                setCopyImportStep("search");
                setCopySourceMeta(null);
                setCopyEligibleItems([]);
                setCopySelectedItemIds(new Set());
              }}
            >
              <ArrowLeft className="h-4 w-4" />
              Back to search
            </Button>

            {loadingCopyReqDetail ? (
              <div className="flex justify-center py-10">
                <ActiniumLoader size="lg" />
              </div>
            ) : (
              <>
                <div className="max-h-[min(52vh,32rem)] overflow-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[100px]">Part number</TableHead>
                        <TableHead className="min-w-[140px]">Part name</TableHead>
                        <TableHead className="w-[88px]">Item #</TableHead>
                        <TableHead className="w-[88px]">DWG</TableHead>
                        <TableHead className="w-[72px] text-right">Qty</TableHead>
                        <TableHead className="w-[64px]">Unit</TableHead>
                        <TableHead className="max-w-[160px]">Remarks</TableHead>
                        <TableHead className="w-[88px] text-center">
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-xs font-normal text-muted-foreground">Select</span>
                            <Checkbox
                              checked={sprCopyAllSelected}
                              onCheckedChange={(v) => toggleSprCopySelectAll(Boolean(v))}
                              aria-label="Select all lines"
                            />
                          </div>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {copyEligibleItems.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="align-top font-mono text-xs">{item.partNumber}</TableCell>
                          <TableCell className="align-top text-sm">{item.partName || item.itemName}</TableCell>
                          <TableCell className="align-top text-xs">{item.itemNumber}</TableCell>
                          <TableCell className="align-top text-xs">{item.drawingNumber}</TableCell>
                          <TableCell className="align-top text-right text-sm">
                            {Math.max(1, Math.floor(Number(item.quantity) || 1))}
                          </TableCell>
                          <TableCell className="align-top text-sm">{item.unit || "PCS"}</TableCell>
                          <TableCell
                            className="align-top max-w-[160px] truncate text-xs text-muted-foreground"
                            title={item.remarks || ""}
                          >
                            {item.remarks}
                          </TableCell>
                          <TableCell className="align-top text-center">
                            <Checkbox
                              checked={copySelectedItemIds.has(String(item.id))}
                              onCheckedChange={() => toggleSprCopyItem(String(item.id))}
                              aria-label={`Select line ${item.partNumber || item.itemName || ""}`}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                  <Button type="button" variant="outline" onClick={handleSprCopyImportAll}>
                    Import all ({copyEligibleItems.length})
                  </Button>
                  <Button
                    type="button"
                    onClick={handleSprCopyImportSelected}
                    disabled={copySelectedItemIds.size === 0}
                  >
                    Import selected ({copySelectedItemIds.size})
                  </Button>
                </DialogFooter>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );

  if (displayMode === "dialog") {
    return (
      <>
        <Dialog open={open} onOpenChange={onClose}>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                {editing ? "Edit Requisition" : "Create New Requisition"}
              </DialogTitle>
              <DialogDescription>
                {editing
                  ? "Update the requisition details and items below."
                  : "Fill in the requisition details and add items. You can save as draft or create the requisition directly."}
              </DialogDescription>
            </DialogHeader>

            {FormBody}

            <DialogFooter className="flex justify-between">
              <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSaveAsDraft}
                  disabled={isSubmitting}
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save as Draft
                </Button>
                <Button
                  type="button"
                  onClick={handleCreateRequisition}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <ActiniumLoader size="sm" showText={false} showDots={false} />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  Create Requisition
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Save Confirmation Dialog */}
        <Dialog open={showSaveConfirm} onOpenChange={setShowSaveConfirm}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-orange-500" />
                Save as Draft
              </DialogTitle>
              <DialogDescription>
                This will save the requisition as a draft. You can edit and finalize it later.
                {pendingGenerationStatus === GenerationStatus.SAVED_AS_DRAFT &&
                  " Masters will need to approve drafts created by designation levels 17-25."}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowSaveConfirm(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={async () => {
                  console.log('[RequisitionForm] Save as Draft button clicked in confirmation dialog');
                  
                  // Validate form before submitting (skip items check for draft)
                const isValid = await form.trigger(['heading', 'vesselId', 'requisitionType']);
                if (!isValid) {
                  const errors = form.formState.errors;
                  console.error('[RequisitionForm] Form validation failed:', errors);
                  
                  // Show specific validation errors
                  const errorMessages: string[] = [];
                  if (errors.heading) errorMessages.push('Heading is required');
                  if (errors.vesselId) errorMessages.push('Vessel is required');
                  if (errors.requisitionType) errorMessages.push('Requisition type is required');
                  
                  toast.error(`Please fix the following errors:\n${errorMessages.join('\n')}`, {
                    duration: 5000,
                  });
                  return;
                }
                
                // Submit the form without full validation
                const formData = form.getValues();
                await onFormSubmit(formData);
                }}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActiniumLoader size="sm" showText={false} showDots={false} />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save as Draft
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      {sprCopyDialogJsx}
      {duplicateItemAlertJsx}
      </>
    );
  }

  // Page mode
  // If hideAgentDetails is true, render without tabs (agent details moved to parent page)
  if (hideAgentDetails && displayMode === "page") {
  return (
      <FormProvider {...form}>
    <div className="space-y-6">
      {FormBody}

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={handleSaveAsDraft}
          disabled={isSubmitting}
        >
          <Save className="h-4 w-4 mr-2" />
          Save as Draft
        </Button>
        <Button type="button" onClick={handleCreateRequisition} disabled={isSubmitting}>
          {isSubmitting ? (
            <ActiniumLoader size="sm" showText={false} showDots={false} />
          ) : (
            <Send className="h-4 w-4 mr-2" />
          )}
          Create Requisition
        </Button>
      </div>

      {/* Draft confirmation remains a dialog even in page mode */}
      <Dialog open={showSaveConfirm} onOpenChange={setShowSaveConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-orange-500" />
              Save as Draft
            </DialogTitle>
            <DialogDescription>
              This will save the requisition as a draft. You can edit and finalize it later.
              {pendingGenerationStatus === GenerationStatus.SAVED_AS_DRAFT &&
                " Masters will need to approve drafts created by designation levels 17-25."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowSaveConfirm(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={async () => {
                console.log('[RequisitionForm] Save as Draft button clicked in confirmation dialog (page mode)');
                
                // Validate form before submitting (skip items check for draft)
                const isValid = await form.trigger(['heading', 'vesselId', 'requisitionType']);
                if (!isValid) {
                  const errors = form.formState.errors;
                  console.error('[RequisitionForm] Form validation failed:', errors);
                  
                  // Show specific validation errors
                  const errorMessages: string[] = [];
                  if (errors.heading) errorMessages.push('Heading is required');
                  if (errors.vesselId) errorMessages.push('Vessel is required');
                  if (errors.requisitionType) errorMessages.push('Requisition type is required');
                  
                  toast.error(`Please fix the following errors:\n${errorMessages.join('\n')}`, {
                    duration: 5000,
                  });
                  return;
                }
                
                // Submit the form without full validation
                const formData = form.getValues();
                await onFormSubmit(formData);
              }}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActiniumLoader size="sm" showText={false} showDots={false} />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save as Draft
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {sprCopyDialogJsx}
      {duplicateItemAlertJsx}

        {/* Add New Paint Dialog - Available in both tabbed and non-tabbed modes */}
        {Object.keys(paintAddDialogOpen).map((indexStr) => {
          const index = parseInt(indexStr);
          return (
            <Dialog
              key={index}
              open={paintAddDialogOpen[index] || false}
              onOpenChange={(open) => setPaintAddDialogOpen(prev => ({ ...prev, [index]: open }))}
            >
              <DialogContent className="max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Add New Marine Paint</DialogTitle>
                  <DialogDescription>
                    Add a new paint to the database. This paint will be available for future requisitions.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Brand *</Label>
                      <div className="space-y-2">
                        {manualBrandEntry[index] ? (
                          <div className="flex gap-2">
                            <Input
                              placeholder="Enter brand name"
                              value={manualBrandValue[index] || ""}
                              onChange={(e) => {
                                setManualBrandValue(prev => ({
                                  ...prev,
                                  [index]: e.target.value
                                }));
                                setNewPaintData(prev => ({
                                  ...prev,
                                  [index]: { ...prev[index], brand: e.target.value },
                                }));
                              }}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setManualBrandEntry(prev => ({
                                  ...prev,
                                  [index]: false
                                }));
                                setManualBrandValue(prev => {
                                  const updated = { ...prev };
                                  delete updated[index];
                                  return updated;
                                });
                                setNewPaintData(prev => ({
                                  ...prev,
                                  [index]: { ...prev[index], brand: "" },
                                }));
                              }}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <Select
                            value={newPaintData[index]?.brand || ""}
                            onValueChange={(value) => {
                              if (value === "__manual__") {
                                setManualBrandEntry(prev => ({
                                  ...prev,
                                  [index]: true
                                }));
                                setManualBrandValue(prev => ({
                                  ...prev,
                                  [index]: ""
                                }));
                                setNewPaintData(prev => ({
                                  ...prev,
                                  [index]: { ...prev[index], brand: "" },
                                }));
                              } else {
                                setNewPaintData(prev => ({
                                  ...prev,
                                  [index]: { ...prev[index], brand: value },
                                }));
                              }
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select brand" />
                            </SelectTrigger>
                            <SelectContent>
                              {paintBrands.map((brand) => (
                                <SelectItem key={brand} value={brand}>
                                  {brand}
                                </SelectItem>
                              ))}
                              <SelectItem value="__manual__" className="text-blue-600 font-medium">
                                <Plus className="h-3 w-3 inline mr-1" />
                                Add New Brand
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Product Name *</Label>
                      <Input
                        value={newPaintData[index]?.productName || ""}
                        onChange={(e) => {
                          setNewPaintData(prev => ({
                            ...prev,
                            [index]: { ...prev[index], productName: e.target.value },
                          }));
                        }}
                        placeholder="Enter product name"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Color Name</Label>
                      <Input
                        value={newPaintData[index]?.colorName || ""}
                        onChange={(e) => {
                          setNewPaintData(prev => ({
                            ...prev,
                            [index]: { ...prev[index], colorName: e.target.value },
                          }));
                        }}
                        placeholder="Enter color name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Color Grade</Label>
                      <Input
                        value={newPaintData[index]?.colorGrade || ""}
                        onChange={(e) => {
                          setNewPaintData(prev => ({
                            ...prev,
                            [index]: { ...prev[index], colorGrade: e.target.value },
                          }));
                        }}
                        placeholder="Enter color grade"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Paint Type</Label>
                      <Input
                        value={newPaintData[index]?.paintType || ""}
                        onChange={(e) => {
                          setNewPaintData(prev => ({
                            ...prev,
                            [index]: { ...prev[index], paintType: e.target.value },
                          }));
                        }}
                        placeholder="Enter paint type"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Category</Label>
                      <Input
                        value={newPaintData[index]?.paintCategory || ""}
                        onChange={(e) => {
                          setNewPaintData(prev => ({
                            ...prev,
                            [index]: { ...prev[index], paintCategory: e.target.value },
                          }));
                        }}
                        placeholder="Enter category"
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setPaintAddDialogOpen(prev => ({ ...prev, [index]: false }));
                      setNewPaintData(prev => {
                        const newData = { ...prev };
                        delete newData[index];
                        return newData;
                      });
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={async () => {
                      const paintData = newPaintData[index];
                      if (!paintData?.brand || !paintData?.productName) {
                        toast.error("Brand and Product Name are required");
                        return;
                      }

                      try {
                        const response = await fetch("/api/paint-catalog/products", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          credentials: "include",
                          body: JSON.stringify({
                            maker: paintData.brand.trim(),
                            productName: paintData.productName.trim(),
                            productCode: paintData.productCode?.trim() || "",
                          }),
                        });

                        if (response.ok) {
                          const data = await response.json();
                          toast.success("Paint product added to catalog");
                          setPaintAddDialogOpen((prev) => ({ ...prev, [index]: false }));
                          setNewPaintData((prev) => {
                            const newData = { ...prev };
                            delete newData[index];
                            return newData;
                          });
                          setManualBrandEntry((prev) => {
                            const updated = { ...prev };
                            delete updated[index];
                            return updated;
                          });
                          setManualBrandValue((prev) => {
                            const updated = { ...prev };
                            delete updated[index];
                            return updated;
                          });
                          await refreshPaintMakers();
                          handlePaintSelect(index, {
                            ...data.product,
                            colorGrade: paintData.colorGrade,
                            colorName: paintData.colorName,
                            colorHex: paintData.colorHex,
                            paintType: paintData.paintType,
                            category: paintData.category || "Paint",
                            unit: paintData.unit || "LTR",
                          });
                        } else {
                          const error = await response.json();
                          toast.error(error.error || "Failed to add paint product");
                        }
                      } catch (error) {
                        console.error("Error adding paint product:", error);
                        toast.error("Failed to add paint product");
                      }
                    }}
                  >
                    Add Paint
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          );
        })}
        </div>
      </FormProvider>
    );
  }

  // Standard page mode (without tabs)
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">{editing ? "Edit Requisition" : "Create New Requisition"}</h2>
      </div>

      {FormBody}

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={handleSaveAsDraft}
          disabled={isSubmitting}
        >
          <Save className="h-4 w-4 mr-2" />
          Save as Draft
        </Button>
        <Button type="button" onClick={handleCreateRequisition} disabled={isSubmitting}>
          {isSubmitting ? (
            <ActiniumLoader size="sm" showText={false} showDots={false} />
          ) : (
            <Send className="h-4 w-4 mr-2" />
          )}
          Create Requisition
        </Button>
      </div>

      {/* Draft confirmation remains a dialog even in page mode */}
      <Dialog open={showSaveConfirm} onOpenChange={setShowSaveConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-orange-500" />
              Save as Draft
            </DialogTitle>
            <DialogDescription>
              This will save the requisition as a draft. You can edit and finalize it later.
              {pendingGenerationStatus === GenerationStatus.SAVED_AS_DRAFT &&
                " Masters will need to approve drafts created by designation levels 17-25."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowSaveConfirm(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={async () => {
                console.log('[RequisitionForm] Save as Draft button clicked in confirmation dialog (page mode)');
                
                // Validate form before submitting (skip items check for draft)
                const isValid = await form.trigger(['heading', 'vesselId', 'requisitionType']);
                if (!isValid) {
                  const errors = form.formState.errors;
                  console.error('[RequisitionForm] Form validation failed:', errors);
                  
                  // Show specific validation errors
                  const errorMessages: string[] = [];
                  if (errors.heading) errorMessages.push('Heading is required');
                  if (errors.vesselId) errorMessages.push('Vessel is required');
                  if (errors.requisitionType) errorMessages.push('Requisition type is required');
                  
                  toast.error(`Please fix the following errors:\n${errorMessages.join('\n')}`, {
                    duration: 5000,
                  });
                  return;
                }
                
                // Submit the form without full validation
                const formData = form.getValues();
                await onFormSubmit(formData);
              }}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActiniumLoader size="sm" showText={false} showDots={false} />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save as Draft
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {sprCopyDialogJsx}
      {duplicateItemAlertJsx}

      {/* Add New Paint Dialog */}
      {Object.keys(paintAddDialogOpen).map((indexStr) => {
        const index = parseInt(indexStr);
        return (
          <Dialog
            key={index}
            open={paintAddDialogOpen[index] || false}
            onOpenChange={(open) => setPaintAddDialogOpen(prev => ({ ...prev, [index]: open }))}
          >
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New Marine Paint</DialogTitle>
                <DialogDescription>
                  Add a new paint to the database. This paint will be available for future requisitions.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Brand *</Label>
                    <Select
                      value={newPaintData[index]?.brand || ""}
                      onValueChange={(value) => {
                        setNewPaintData(prev => ({
                          ...prev,
                          [index]: { ...prev[index], brand: value },
                        }));
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select brand" />
                      </SelectTrigger>
                      <SelectContent>
                        {paintBrands.map((brand) => (
                          <SelectItem key={brand} value={brand}>
                            {brand}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Product Name *</Label>
                    <Input
                      value={newPaintData[index]?.productName || ""}
                      onChange={(e) => {
                        setNewPaintData(prev => ({
                          ...prev,
                          [index]: { ...prev[index], productName: e.target.value },
                        }));
                      }}
                      placeholder="Enter product name"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Color Grade</Label>
                    <Input
                      value={newPaintData[index]?.colorGrade || ""}
                      onChange={(e) => {
                        setNewPaintData(prev => ({
                          ...prev,
                          [index]: { ...prev[index], colorGrade: e.target.value },
                        }));
                      }}
                      placeholder="e.g., RAL 5010, BS 4800"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Color Name</Label>
                    <Input
                      value={newPaintData[index]?.colorName || ""}
                      onChange={(e) => {
                        setNewPaintData(prev => ({
                          ...prev,
                          [index]: { ...prev[index], colorName: e.target.value },
                        }));
                      }}
                      placeholder="e.g., Blue, Red, White"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Color Hex Code</Label>
                    <div className="flex gap-2">
                      <Input
                        value={newPaintData[index]?.colorHex || ""}
                        onChange={(e) => {
                          setNewPaintData(prev => ({
                            ...prev,
                            [index]: { ...prev[index], colorHex: e.target.value },
                          }));
                        }}
                        placeholder="#FFFFFF"
                        maxLength={7}
                      />
                      {newPaintData[index]?.colorHex && (
                        <div
                          className="w-12 h-12 rounded border-2 border-slate-300"
                          style={{
                            backgroundColor: newPaintData[index]?.colorHex || "#FFFFFF",
                          }}
                        />
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Paint Type</Label>
                    <Input
                      value={newPaintData[index]?.paintType || ""}
                      onChange={(e) => {
                        setNewPaintData(prev => ({
                          ...prev,
                          [index]: { ...prev[index], paintType: e.target.value },
                        }));
                      }}
                      placeholder="e.g., Primer, Topcoat"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Category *</Label>
                    <Select
                      value={newPaintData[index]?.category || "Paint"}
                      onValueChange={(value) => {
                        setNewPaintData(prev => ({
                          ...prev,
                          [index]: { ...prev[index], category: value },
                        }));
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Paint">Paint</SelectItem>
                        <SelectItem value="Thinner">Thinner</SelectItem>
                        <SelectItem value="Hardener">Hardener</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={newPaintData[index]?.description || ""}
                    onChange={(e) => {
                      setNewPaintData(prev => ({
                        ...prev,
                        [index]: { ...prev[index], description: e.target.value },
                      }));
                    }}
                    placeholder="Optional description"
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setPaintAddDialogOpen(prev => ({ ...prev, [index]: false }));
                    setNewPaintData(prev => {
                      const updated = { ...prev };
                      delete updated[index];
                      return updated;
                    });
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={() => handleAddNewPaint(index)}
                >
                  Add Paint
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        );
      })}
    </div>
  );
}
