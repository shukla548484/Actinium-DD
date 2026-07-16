"use client";
import { usePageBootstrap } from "@/hooks/use-page-bootstrap";
import { PageReadyGate } from "@/components/page-ready/PageReadyGate";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import {
  Package,
  Search,
  Plus,
  Edit,
  Trash2,
  Warehouse,
  Box as BoxIcon,
  Layers,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  ChevronDown,
  MapPin,
  Scan,
  Check,
  X,
  MoreHorizontal,
  Pencil,
  ArrowRightLeft,
  Ban,
  RefreshCcw,
} from "lucide-react";
import { toast } from "sonner";
import ManualPageScanner from "@/components/ManualPageScanner";
import { useVessels } from "@/hooks/useStaticData";
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
import { History, Bell, Calendar, PackageSearch } from "lucide-react";
import { TableSerialHead, TableSerialCell } from "@/components/ui/table-serial-column";

interface Vessel {
  id: string;
  name: string;
  code: string;
}

interface StoreLocation {
  id: string;
  name: string;
  code: string;
  vesselId: string;
  isActive: boolean;
  racks?: Rack[];
}

interface Rack {
  id: string;
  rackNumber: string;
  description?: string;
  storeLocationId: string;
  isActive: boolean;
  boxes?: Box[];
}

interface Box {
  id: string;
  boxNumber: string;
  description?: string;
  rackId: string;
  vesselId: string;
  isActive: boolean;
  spareParts?: SparePart[];
}

interface SparePart {
  id: string;
  name: string;
  sparePartNumber: string;
  currentRobLocation?: string;
  boxId: string;
  quantity: number | string;
  minStockLevel?: number | string;
  unit: string;
  manufacturer?: string;
  model?: string;
  description?: string;
  remarks?: string;
  isActive: boolean;
  box?: {
    id: string;
    boxNumber: string;
    rack?: {
      id: string;
      rackNumber: string;
      storeLocation?: {
        id: string;
        name: string;
        code: string;
      };
    };
  };
}

interface PartSearchResult {
  id: string;
  name: string;
  sparePartNumber: string;
  quantity: number | string;
  unit: string;
  location: { id: string; name: string; code: string } | null;
  rack: { id: string; rackNumber: string; description?: string } | null;
  box: { id: string; boxNumber: string; description?: string } | null;
  vessel: { id: string; name: string; code: string } | null;
}

const LOCATION_OPTIONS = [
  "Ship",
  "Deck",
  "Engine Room",
  "Accommodation",
  "Forward Store",
  "Steering Gear Room",
  "Bosun Store",
  "Midship Store",
  "BWTS Room",
  "AFT Store",
  "Bridge",
  "Safety Locker",
  "Bond Store",
  "Radio Room",
  "Chart Room",
];

export function InventoryManagementContent() {
  const { ready, markSuccess } = usePageBootstrap();
  
  // Use optimized hooks for static data with caching
  const { data: vessels = [], isLoading: vesselsLoading } = useVessels({ limit: 100, isActive: true });
  
  const [selectedVesselId, setSelectedVesselId] = useState<string>("");
  const [storeLocations, setStoreLocations] = useState<StoreLocation[]>([]);
  const [selectedStoreLocationId, setSelectedStoreLocationId] = useState<string>("");
  const [racks, setRacks] = useState<Rack[]>([]);
  const [selectedRackId, setSelectedRackId] = useState<string>("");
  // const [boxes, setBoxes] = useState<Box[]>([]); // Removed: using map instead
  const [boxesByRack, setBoxesByRack] = useState<Record<string, Box[]>>({});
  const [selectedBoxId, setSelectedBoxId] = useState<string>("");
  const [spareParts, setSpareParts] = useState<SparePart[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [partNumberSearch, setPartNumberSearch] = useState("");
  const [partSearchResults, setPartSearchResults] = useState<PartSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [machinery, setMachinery] = useState<any[]>([]);
  const [selectedMachineryId, setSelectedMachineryId] = useState<string>("");
  const [showScanner, setShowScanner] = useState(false);
  const [scannedParts, setScannedParts] = useState<any[]>([]);
  const [showPartsConfirmation, setShowPartsConfirmation] = useState(false);
  const [isProcessingScan, setIsProcessingScan] = useState(false);
  
  // Enhanced inventory features states
  const [activeTab, setActiveTab] = useState("inventory");
  const [inventoryTransactions, setInventoryTransactions] = useState<any[]>([]);
  const [reorderAlerts, setReorderAlerts] = useState<any[]>([]);
  const [partReservations, setPartReservations] = useState<any[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [loadingAlerts, setLoadingAlerts] = useState(false);
  const [loadingReservations, setLoadingReservations] = useState(false);
  
  // Location management states
  const [expandedLocations, setExpandedLocations] = useState<Set<string>>(new Set());
  const [expandedRacks, setExpandedRacks] = useState<Set<string>>(new Set());
  const [showLocationDialog, setShowLocationDialog] = useState(false);
  const [showRackDialog, setShowRackDialog] = useState(false);
  const [showBoxDialog, setShowBoxDialog] = useState(false);
  const [editingLocation, setEditingLocation] = useState<StoreLocation | null>(null);
  const [editingRack, setEditingRack] = useState<Rack | null>(null);
  const [editingBox, setEditingBox] = useState<Box | null>(null);

  // Move Box State
  const [showMoveBoxDialog, setShowMoveBoxDialog] = useState(false);
  const [boxToMove, setBoxToMove] = useState<Box | null>(null);
  const [targetLocationId, setTargetLocationId] = useState("");
  const [targetRackId, setTargetRackId] = useState("");
  const [targetRacks, setTargetRacks] = useState<Rack[]>([]);
  
  // Form states
  const [locationName, setLocationName] = useState("");
  const [locationCode, setLocationCode] = useState("");
  const [rackNumber, setRackNumber] = useState("");
  const [rackDescription, setRackDescription] = useState("");
  const [boxNumber, setBoxNumber] = useState("");
  const [boxDescription, setBoxDescription] = useState("");

  // Fetch current user with cookie caching
  useEffect(() => {
    const fetchUser = async () => {
      try {
        // Check cache first
        const { getCachedUserData, cacheUserData } = await import('@/lib/cookie-cache');
        const cachedUser = getCachedUserData();
        
        if (cachedUser) {
          setCurrentUser(cachedUser);
          // Still fetch in background to update cache
          fetch("/api/profile/basic", { credentials: "include" })
            .then(res => res.ok ? res.json() : null)
            .then(data => {
              if (data?.user) {
                cacheUserData(data.user);
                if (JSON.stringify(cachedUser) !== JSON.stringify(data.user)) {
                  setCurrentUser(data.user);
                }
              }
            })
            .catch(() => {});
          return;
        }

        // No cache, fetch from server
        const response = await fetch("/api/profile/basic", {
          credentials: "include",
        });
        if (response.ok) {
          const data = await response.json();
          setCurrentUser(data.user);
          cacheUserData(data.user);
        }
      } catch (error) {
        console.error("Error fetching user:", error);
      }
    };
    fetchUser();
  }, []);

  // Initialize page - stop loader immediately, vessels load in background
  useEffect(() => {
    // Stop loader immediately - don't block on vessels loading
    markSuccess();
    
    // Auto-select first vessel when vessels load (in background)
    if (!vesselsLoading && vessels.length > 0 && !selectedVesselId) {
      setSelectedVesselId(vessels[0].id);
    }
  }, [vesselsLoading, vessels, selectedVesselId, markSuccess]);

  // Fetch store locations when vessel is selected
  useEffect(() => {
    if (selectedVesselId) {
      fetchStoreLocations();
      fetchMachinery();
    } else {
      setStoreLocations([]);
      setRacks([]);
      setBoxesByRack({});
      setSpareParts([]);
      setMachinery([]);
      setSelectedMachineryId("");
    }
  }, [selectedVesselId]);

  // Fetch machinery for selected vessel (with pagination)
  const fetchMachinery = async () => {
    if (!selectedVesselId) return;
    try {
      const response = await fetch(`/api/machinery?vesselId=${selectedVesselId}&limit=50&page=1`, {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setMachinery(data.data || []);
      }
    } catch (error) {
      console.error("Error fetching machinery:", error);
    }
  };

  // Fetch racks when store location is selected
  useEffect(() => {
    if (selectedStoreLocationId) {
      fetchRacks();
    } else {
      setRacks([]);
      setBoxesByRack({});
      setSpareParts([]);
    }
  }, [selectedStoreLocationId]);

  // Fetch boxes when rack is selected or expanded
  const fetchBoxes = async (rackId: string) => {
    if (!rackId) return;
    // Don't set global loading here to avoid flickering the whole page
    // We could use a local loading state for racks if needed
    try {
      const response = await fetch(
        `/api/spare-parts/boxes?rackId=${rackId}`,
        { credentials: "include" }
      );
      if (response.ok) {
        const data = await response.json();
        setBoxesByRack(prev => ({
            ...prev,
            [rackId]: data
        }));
      }
    } catch (error) {
      console.error("Error fetching boxes:", error);
      toast.error("Failed to fetch boxes");
    }
  };

  useEffect(() => {
    if (selectedRackId) {
      fetchBoxes(selectedRackId);
    }
  }, [selectedRackId]);

  // Fetch spare parts when box is selected
  useEffect(() => {
    if (selectedBoxId) {
      fetchSpareParts();
    } else {
      setSpareParts([]);
    }
  }, [selectedBoxId]);

  // Fetch data when tab changes
  useEffect(() => {
    if (!selectedVesselId) return;

    if (activeTab === 'history') {
      fetchInventoryTransactions();
    } else if (activeTab === 'alerts') {
      fetchReorderAlerts();
    } else if (activeTab === 'reservations') {
      fetchPartReservations();
    }
  }, [activeTab, selectedVesselId]);

  const fetchInventoryTransactions = async () => {
    if (!selectedVesselId) return;
    setLoadingTransactions(true);
    try {
      const response = await fetch(
        `/api/inventory/transactions?vesselId=${selectedVesselId}&limit=100`,
        { credentials: 'include' }
      );
      if (response.ok) {
        const data = await response.json();
        setInventoryTransactions(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoadingTransactions(false);
    }
  };

  const fetchReorderAlerts = async () => {
    if (!selectedVesselId) return;
    setLoadingAlerts(true);
    try {
      const response = await fetch(
        `/api/inventory/reorder-alerts?vesselId=${selectedVesselId}`,
        { credentials: 'include' }
      );
      if (response.ok) {
        const data = await response.json();
        setReorderAlerts(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching alerts:', error);
    } finally {
      setLoadingAlerts(false);
    }
  };

  const fetchPartReservations = async () => {
    if (!selectedVesselId) return;
    setLoadingReservations(true);
    try {
      const response = await fetch(
        `/api/inventory/reservations?vesselId=${selectedVesselId}&status=RESERVED`,
        { credentials: 'include' }
      );
      if (response.ok) {
        const data = await response.json();
        setPartReservations(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching reservations:', error);
    } finally {
      setLoadingReservations(false);
    }
  };

  const fetchStoreLocations = async () => {
    if (!selectedVesselId) return;
    setLoading(true);
    try {
      const response = await fetch(
        `/api/spare-parts/store-locations?vesselId=${selectedVesselId}`,
        { credentials: "include" }
      );
      if (response.ok) {
        const data = await response.json();
        setStoreLocations(data);
        // Expand all locations by default
        setExpandedLocations(new Set(data.map((loc: StoreLocation) => loc.id)));
      }
    } catch (error) {
      console.error("Error fetching store locations:", error);
      toast.error("Failed to fetch store locations");
    } finally {
      setLoading(false);
    }
  };

  const fetchRacks = async () => {
    if (!selectedStoreLocationId) return;
    setLoading(true);
    try {
      const response = await fetch(
        `/api/spare-parts/racks?storeLocationId=${selectedStoreLocationId}`,
        { credentials: "include" }
      );
      if (response.ok) {
        const data = await response.json();
        setRacks(data);
        // Expand all racks by default
        setExpandedRacks(new Set(data.map((rack: Rack) => rack.id)));
      }
    } catch (error) {
      console.error("Error fetching racks:", error);
      toast.error("Failed to fetch racks");
    } finally {
      setLoading(false);
    }
  };

  const fetchSpareParts = async () => {
    if (!selectedBoxId) return;
    setLoading(true);
    try {
      const response = await fetch(
        `/api/spare-parts?boxId=${selectedBoxId}`,
        { credentials: "include" }
      );
      if (response.ok) {
        const result = await response.json();
        setSpareParts(result.data || result);
      }
    } catch (error) {
      console.error("Error fetching spare parts:", error);
      toast.error("Failed to fetch spare parts");
    } finally {
      setLoading(false);
    }
  };

  // Search by part number
  const handlePartNumberSearch = async () => {
    if (!partNumberSearch.trim()) {
      toast.error("Please enter a part number");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `/api/spare-parts/search?partNumber=${encodeURIComponent(partNumberSearch)}${selectedVesselId ? `&vesselId=${selectedVesselId}` : ''}`,
        { credentials: "include" }
      );
      if (response.ok) {
        const data = await response.json();
        setPartSearchResults(data.results || []);
        if (data.results && data.results.length === 0) {
          toast.info("No parts found with that part number");
        }
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || "Failed to search parts");
      }
    } catch (error) {
      console.error("Error searching parts:", error);
      toast.error("Failed to search parts");
    } finally {
      setLoading(false);
    }
  };

  // Location management functions
  const handleCreateLocation = async () => {
    if (!selectedVesselId) {
      toast.error("Please select a vessel first");
      return;
    }
    if (!locationName.trim() || !locationCode.trim()) {
      toast.error("Location name and code are required");
      return;
    }

    try {
      const response = await fetch("/api/spare-parts/store-locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: locationName,
          code: locationCode,
          vesselId: selectedVesselId,
        }),
      });

      if (response.ok) {
        toast.success("Location created successfully");
        setShowLocationDialog(false);
        setLocationName("");
        setLocationCode("");
        await fetchStoreLocations();
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || "Failed to create location");
      }
    } catch (error) {
      console.error("Error creating location:", error);
      toast.error("Failed to create location");
    }
  };

  const handleSaveRack = async () => {
    if (!selectedStoreLocationId) {
      toast.error("Please select a location first");
      return;
    }
    if (!rackNumber.trim()) {
      toast.error("Rack number is required");
      return;
    }

    try {
      const url = "/api/spare-parts/racks";
      const method = editingRack ? "PUT" : "POST";
      const body = {
        id: editingRack?.id,
        rackNumber,
        description: rackDescription || undefined,
        storeLocationId: selectedStoreLocationId,
      };

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      if (response.ok) {
        toast.success(editingRack ? "Rack updated successfully" : "Rack created successfully");
        setShowRackDialog(false);
        setEditingRack(null);
        setRackNumber("");
        setRackDescription("");
        await fetchRacks();
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || `Failed to ${editingRack ? "update" : "create"} rack`);
      }
    } catch (error) {
      console.error(`Error ${editingRack ? "updating" : "creating"} rack:`, error);
      toast.error(`Failed to ${editingRack ? "update" : "create"} rack`);
    }
  };

  const handleSaveBox = async () => {
    if (!selectedRackId || !selectedVesselId) {
      toast.error("Please select a rack and vessel first");
      return;
    }
    if (!boxNumber.trim()) {
      toast.error("Box number is required");
      return;
    }

    try {
      const url = "/api/spare-parts/boxes";
      const method = editingBox ? "PUT" : "POST";
      const body = {
        id: editingBox?.id,
        boxNumber,
        description: boxDescription || undefined,
        rackId: selectedRackId,
        vesselId: selectedVesselId,
      };

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      if (response.ok) {
        toast.success(editingBox ? "Box updated successfully" : "Box created successfully");
        setShowBoxDialog(false);
        setEditingBox(null);
        setBoxNumber("");
        setBoxDescription("");
        await fetchBoxes(selectedRackId);
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || `Failed to ${editingBox ? "update" : "create"} box`);
      }
    } catch (error) {
      console.error(`Error ${editingBox ? "updating" : "creating"} box:`, error);
      toast.error(`Failed to ${editingBox ? "update" : "create"} box`);
    }
  };

  const handleDiscardRack = async (rack: Rack) => {
    // Access check for revival (if inactive)
    if (!rack.isActive) {
      const accessLevel = currentUser?.designationAccessLevel || 0;
      const allowedLevels = [24, 25, 50, 99, 100];
      if (!allowedLevels.includes(accessLevel)) {
        toast.error("Access Denied: Only authorized users can revive racks.");
        return;
      }
    }

    if (rack.isActive) {
       // Check for active boxes before discarding
       const boxes = boxesByRack[rack.id] || [];
       const activeBoxes = boxes.filter(b => b.isActive);
       if (activeBoxes.length > 0) {
         toast.error("Cannot discard rack with active boxes. Please move or discard boxes first.");
         return;
       }
    }

    try {
      const response = await fetch("/api/spare-parts/racks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          id: rack.id,
          isActive: !rack.isActive,
        }),
      });

      if (response.ok) {
        toast.success(`Rack ${rack.isActive ? "discarded" : "revived"} successfully`);
        await fetchRacks();
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to update rack status");
      }
    } catch (error) {
      console.error("Error updating rack:", error);
      toast.error("Failed to update rack status");
    }
  };

  const handleDiscardBox = async (box: Box) => {
    // Access check for revival (if inactive)
    if (!box.isActive) {
      const accessLevel = currentUser?.designationAccessLevel || 0;
      const allowedLevels = [24, 25, 50, 99, 100];
      if (!allowedLevels.includes(accessLevel)) {
        toast.error("Access Denied: Only authorized users can revive boxes.");
        return;
      }
    }
    
    try {
      const response = await fetch("/api/spare-parts/boxes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          id: box.id,
          isActive: !box.isActive,
        }),
      });

      if (response.ok) {
        toast.success(`Box ${box.isActive ? "discarded" : "revived"} successfully`);
        if (box.rackId) {
            await fetchBoxes(box.rackId);
        }
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to update box status");
      }
    } catch (error) {
      console.error("Error updating box:", error);
      toast.error("Failed to update box status");
    }
  };

  const handleMoveBox = async () => {
    if (!boxToMove || !targetRackId) {
      toast.error("Please select a target rack");
      return;
    }

    try {
      const response = await fetch("/api/spare-parts/boxes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          id: boxToMove.id,
          rackId: targetRackId,
        }),
      });

      if (response.ok) {
        toast.success("Box moved successfully");
        setShowMoveBoxDialog(false);
        setBoxToMove(null);
        setTargetLocationId("");
        setTargetRackId("");
        
        if (boxToMove.rackId) {
            await fetchBoxes(boxToMove.rackId);
        }
        if (targetRackId !== boxToMove.rackId) {
            await fetchBoxes(targetRackId);
        }
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to move box");
      }
    } catch (error) {
      console.error("Error moving box:", error);
      toast.error("Failed to move box");
    }
  };

  useEffect(() => {
    const fetchTargetRacks = async () => {
        if (!targetLocationId) {
            setTargetRacks([]);
            return;
        }
        try {
            const response = await fetch(
                `/api/spare-parts/racks?storeLocationId=${targetLocationId}`,
                { credentials: "include" }
            );
            if (response.ok) {
                const data = await response.json();
                setTargetRacks(data);
            }
        } catch (error) {
            console.error("Error fetching target racks:", error);
        }
    };
    fetchTargetRacks();
  }, [targetLocationId]);

  const checkAccessForDiscarded = () => {
    const accessLevel = currentUser?.designationAccessLevel || 0;
    const allowedLevels = [24, 25, 50, 99, 100];
    return allowedLevels.includes(accessLevel);
  };

  const handleRackClick = (rack: Rack) => {
    if (!rack.isActive) {
      if (!checkAccessForDiscarded()) {
        toast.error("Access Denied: This rack is discarded.");
        return;
      }
    }
    toggleRackExpand(rack.id);
  };

  const handleBoxClick = (box: Box) => {
    if (!box.isActive) {
      if (!checkAccessForDiscarded()) {
        toast.error("Access Denied: This box is discarded.");
        return;
      }
    }
    setSelectedBoxId(box.id);
  };

  const toggleLocationExpand = (locationId: string) => {
    const newExpanded = new Set(expandedLocations);
    if (newExpanded.has(locationId)) {
      newExpanded.delete(locationId);
    } else {
      newExpanded.add(locationId);
    }
    setExpandedLocations(newExpanded);
  };

  const toggleRackExpand = (rackId: string) => {
    const newExpanded = new Set(expandedRacks);
    if (newExpanded.has(rackId)) {
      newExpanded.delete(rackId);
    } else {
      newExpanded.add(rackId);
    }
    setExpandedRacks(newExpanded);
  };

  // Filter spare parts by search term
  const filteredSpareParts = spareParts.filter((part) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      part.name.toLowerCase().includes(search) ||
      part.sparePartNumber.toLowerCase().includes(search) ||
      part.manufacturer?.toLowerCase().includes(search) ||
      part.model?.toLowerCase().includes(search)

    );
  });

  // Check if stock is low
  const isLowStock = (part: SparePart) => {
    if (!part.minStockLevel) return false;
    const quantity = typeof part.quantity === 'string' ? parseFloat(part.quantity) : part.quantity;
    const minStock = typeof part.minStockLevel === 'string' ? parseFloat(part.minStockLevel) : part.minStockLevel;
    return quantity <= minStock;
  };

  const handleEditRack = (rack: Rack) => {
    setEditingRack(rack);
    setRackNumber(rack.rackNumber);
    setRackDescription(rack.description || "");
    setShowRackDialog(true);
  };

  const handleEditBox = (box: Box) => {
    setEditingBox(box);
    setBoxNumber(box.boxNumber);
    setBoxDescription(box.description || "");
    setShowBoxDialog(true);
  };

  // Handle scan complete
  const handleScanComplete = async (pages: any[]) => {
    if (!selectedMachineryId) {
      toast.error("Please select a machinery first");
      return;
    }

    setIsProcessingScan(true);
    try {
      // Create FormData with scanned pages
      const formData = new FormData();
      formData.append('machineryId', selectedMachineryId);
      if (selectedVesselId) {
        formData.append('vesselId', selectedVesselId);
      }

      for (const page of pages) {
        // Convert base64 to File
        const response = await fetch(page.imageData);
        const blob = await response.blob();
        // Determine file type from original file or blob
        const fileType = page.file?.type || blob.type || 'image/jpeg';
        const fileName = page.file?.name || `page-${page.id}.${fileType.includes('pdf') ? 'pdf' : 'jpg'}`;
        const file = new File([blob], fileName, { type: fileType });
        formData.append("pages", file);
      }

      // Call extraction API
      const extractResponse = await fetch("/api/spare-parts/scan-extract", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!extractResponse.ok) {
        const errorData = await extractResponse.json();
        throw new Error(errorData.error || "Failed to extract parts information");
      }

      const extractResult = await extractResponse.json();
      // Initialize confirmed property for all parts
      const partsWithConfirmation = (extractResult.parts || []).map((part: any) => ({
        ...part,
        confirmed: true, // Default to confirmed
        // Ensure all fields are present
        partNumber: part.partNumber || '',
        itemNumber: part.itemNumber || '',
        name: part.name || 'Unknown Part',
        description: part.description || '',
        manufacturer: part.manufacturer || '',
        drawingNumber: part.drawingNumber || '',
        quantity: part.quantity || 0,
        unit: part.unit || 'PCS',
      }));
      setScannedParts(partsWithConfirmation);
      setShowPartsConfirmation(true);
      toast.success(`Extracted ${extractResult.parts?.length || 0} parts from ${pages.length} page(s)`);
    } catch (error) {
      console.error("Error processing scan:", error);
      toast.error(error instanceof Error ? error.message : "Failed to process scanned pages");
    } finally {
      setIsProcessingScan(false);
    }
  };

  // Handle confirm scanned parts
  const handleConfirmScannedParts = async () => {
    if (!selectedBoxId) {
      toast.error("Please select a box to add parts to");
      return;
    }

    if (scannedParts.length === 0) {
      toast.error("No parts to add");
      return;
    }

    setLoading(true);
    try {
      // Add each part to the selected box
      const selectedMachinery = machinery.find(m => m.id === selectedMachineryId);
      const addPromises = scannedParts
        .filter(part => part.confirmed !== false)
        .map(part =>
          fetch("/api/spare-parts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              name: part.name || "Unknown Part",
              sparePartNumber: part.partNumber || `SCAN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              itemNumber: part.itemNumber || undefined,
              boxId: selectedBoxId,
              machineryId: selectedMachineryId || undefined,
              quantity: part.quantity || 0,
              unit: part.unit || "PCS",
              manufacturer: part.manufacturer || selectedMachinery?.make || "",
              model: selectedMachinery?.model || "",
              description: part.description || `Scanned from manual - ${part.rawText || ""}`,
              drawingNumber: part.drawingNumber || undefined,
            }),
          })
        );

      const results = await Promise.allSettled(addPromises);
      const successful = results.filter(r => r.status === "fulfilled").length;
      const failed = results.filter(r => r.status === "rejected").length;

      if (successful > 0) {
        toast.success(`Successfully added ${successful} part(s)`);
        setShowPartsConfirmation(false);
        setScannedParts([]);
        // Refresh spare parts list
        if (selectedBoxId) {
          fetchSpareParts();
        }
      }
      if (failed > 0) {
        toast.error(`Failed to add ${failed} part(s)`);
      }
    } catch (error) {
      console.error("Error adding scanned parts:", error);
      toast.error("Failed to add parts");
    } finally {
      setLoading(false);
    }
  };
  return (<PageReadyGate ready={ready}>
    <ProtectedRoute>
      <div className="space-y-4">
        <div className="py-4">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-foreground">Inventory Management</h1>
            <p className="text-foreground mt-2">Manage vessel inventory, spare parts, and storage locations</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Left Sidebar - Location Management */}
            <div className="lg:col-span-2">
              <Card className="sticky top-4 flex flex-col h-[calc(100vh-8rem)]">
                <CardHeader className="flex-shrink-0">
                  <div className="flex items-center justify-between mb-2">
                    <CardTitle className="flex items-center gap-2">
                      <MapPin className="h-5 w-5" />
                      Locations
                    </CardTitle>
                    {selectedVesselId && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setShowLocationDialog(true);
                          setEditingLocation(null);
                          setLocationName("");
                          setLocationCode("");
                        }}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add
                      </Button>
                    )}
                  </div>
                  <CardDescription>Manage storage locations, racks, and boxes</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 overflow-y-auto">
                  {!selectedVesselId ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Select a vessel to manage locations
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {/* Ship (Top Level) */}
                      <div className="font-semibold text-sm text-foreground mb-2">
                        Ship: {vessels.find(v => v.id === selectedVesselId)?.name}
                      </div>
                      
                      {/* Locations List */}
                      {storeLocations.map((location) => (
                        <div key={location.id} className="border rounded-lg">
                          <div
                            className="flex items-center justify-between p-2 hover:bg-muted cursor-pointer"
                            onClick={() => toggleLocationExpand(location.id)}
                          >
                            <div className="flex items-center gap-2 flex-1">
                              {expandedLocations.has(location.id) ? (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              )}
                              <Warehouse className="h-4 w-4 text-info" />
                              <span className="text-sm font-medium">{location.name}</span>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedStoreLocationId(location.id);
                                setShowRackDialog(true);
                                setEditingRack(null);
                                setRackNumber("");
                                setRackDescription("");
                              }}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                          
                          {expandedLocations.has(location.id) && (
                            <div className="pl-6 pr-2 pb-2 space-y-1">
                              {racks
                                .filter(r => r.storeLocationId === location.id)
                                .map((rack) => (
                                  <div key={rack.id} className="border rounded p-2 bg-muted">
                                    <div
                                      className={`flex items-center justify-between cursor-pointer ${!rack.isActive ? 'text-destructive' : ''}`}
                                      onClick={() => handleRackClick(rack)}
                                    >
                                      <div className="flex items-center gap-2 flex-1">
                                        {expandedRacks.has(rack.id) ? (
                                          <ChevronDown className="h-3 w-3 text-muted-foreground" />
                                        ) : (
                                          <ChevronRight className="h-3 w-3 text-muted-foreground" />
                                        )}
                                        <Layers className={`h-3 w-3 ${!rack.isActive ? 'text-destructive' : 'text-success'}`} />
                                        <span className={`text-xs ${!rack.isActive ? 'line-through' : ''}`}>{rack.rackNumber}</span>
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-6 w-6 p-0"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedRackId(rack.id);
                                            setShowBoxDialog(true);
                                            setEditingBox(null);
                                            setBoxNumber("");
                                            setBoxDescription("");
                                          }}
                                          title="Add Box"
                                        >
                                          <Plus className="h-3 w-3" />
                                        </Button>
                                        <DropdownMenu>
                                          <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={(e) => e.stopPropagation()}>
                                              <MoreHorizontal className="h-3 w-3" />
                                            </Button>
                                          </DropdownMenuTrigger>
                                          <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={(e) => {
                                              e.stopPropagation();
                                              handleEditRack(rack);
                                            }}>
                                              <Pencil className="h-3 w-3 mr-2" />
                                              Rename
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={(e) => {
                                              e.stopPropagation();
                                              handleDiscardRack(rack);
                                            }} className={rack.isActive ? "text-destructive" : "text-success"}>
                                              {rack.isActive ? (
                                                <>
                                                  <Trash2 className="h-3 w-3 mr-2" />
                                                  Discard
                                                </>
                                              ) : (
                                                <>
                                                  <RefreshCcw className="h-3 w-3 mr-2" />
                                                  Revive
                                                </>
                                              )}
                                            </DropdownMenuItem>
                                          </DropdownMenuContent>
                                        </DropdownMenu>
                                      </div>
                                    </div>
                                    
                                    {expandedRacks.has(rack.id) && (
                                      <div className="pl-4 pt-1 space-y-1">
                                        {(boxesByRack[rack.id] || [])
                                          .map((box) => (
                                            <div
                                              key={box.id}
                                              className={`flex items-center justify-between text-xs p-1 hover:bg-muted rounded cursor-pointer group ${!box.isActive ? 'bg-destructive text-destructive' : ''}`}
                                              onClick={() => handleBoxClick(box)}
                                            >
                                              <div className="flex items-center gap-2">
                                                <BoxIcon className={`h-3 w-3 ${!box.isActive ? 'text-destructive' : 'text-info'}`} />
                                                <span className={!box.isActive ? 'line-through' : ''}>{box.boxNumber}</span>
                                              </div>
                                              <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                  <Button variant="ghost" size="sm" className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100">
                                                    <MoreHorizontal className="h-3 w-3" />
                                                  </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                  <DropdownMenuItem onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleEditBox(box);
                                                  }}>
                                                    <Pencil className="h-3 w-3 mr-2" />
                                                    Edit Name
                                                  </DropdownMenuItem>
                                                  <DropdownMenuItem onClick={(e) => {
                                                    e.stopPropagation();
                                                    setBoxToMove(box);
                                                    setTargetLocationId("");
                                                    setTargetRackId("");
                                                    setShowMoveBoxDialog(true);
                                                  }}>
                                                    <ArrowRightLeft className="h-3 w-3 mr-2" />
                                                    Move Box
                                                  </DropdownMenuItem>
                                                  <DropdownMenuItem onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDiscardBox(box);
                                                  }} className={box.isActive ? "text-destructive" : "text-success"}>
                                                    {box.isActive ? (
                                                      <>
                                                        <Trash2 className="h-3 w-3 mr-2" />
                                                        Discard
                                                      </>
                                                    ) : (
                                                      <>
                                                        <RefreshCcw className="h-3 w-3 mr-2" />
                                                        Revive
                                                      </>
                                                    )}
                                                  </DropdownMenuItem>
                                                </DropdownMenuContent>
                                              </DropdownMenu>
                                            </div>
                                          ))}
                                      </div>
                                    )}
                                  </div>
                                ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Main Content Area */}
            <div className="lg:col-span-3 space-y-6">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-4 mb-4">
                  <TabsTrigger value="inventory">
                    <PackageSearch className="h-4 w-4 mr-2" />
                    Inventory
                  </TabsTrigger>
                  <TabsTrigger value="history">
                    <History className="h-4 w-4 mr-2" />
                    History
                  </TabsTrigger>
                  <TabsTrigger value="alerts">
                    <Bell className="h-4 w-4 mr-2" />
                    Reorder Alerts
                    {reorderAlerts.filter((a: any) => a.status === 'PENDING').length > 0 && (
                      <Badge variant="destructive" className="ml-2">
                        {reorderAlerts.filter((a: any) => a.status === 'PENDING').length}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="reservations">
                    <Calendar className="h-4 w-4 mr-2" />
                    Reservations
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="inventory" className="space-y-6">
              {/* Vessel Selection and Part Number Search */}
              <Card>
                <CardHeader>
                  <CardTitle>Search & Navigation</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Vessel Selection */}
                  <div>
                    <Label htmlFor="vessel" className="mb-2 block">Vessel</Label>
                    <Select
                      value={selectedVesselId}
                      onValueChange={(value) => {
                        setSelectedVesselId(value);
                        setSelectedStoreLocationId("");
                        setSelectedRackId("");
                        setSelectedBoxId("");
                        setSelectedMachineryId("");
                      }}
                    >
                      <SelectTrigger id="vessel" width="vessel">
                        <SelectValue placeholder="Select Vessel" />
                      </SelectTrigger>
                      <SelectContent>
                        {vessels.map((vessel) => (
                          <SelectItem key={vessel.id} value={vessel.id}>
                            {vessel.name} ({vessel.code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Machinery Selection */}
                  {selectedVesselId && (
                    <div>
                      <Label htmlFor="machinery" className="mb-2 block">Machinery</Label>
                      <Select
                        value={selectedMachineryId}
                        onValueChange={setSelectedMachineryId}
                        disabled={!selectedVesselId || machinery.length === 0}
                      >
                        <SelectTrigger id="machinery">
                          <SelectValue placeholder="Select Machinery" />
                        </SelectTrigger>
                        <SelectContent>
                          {machinery.map((mach) => (
                            <SelectItem key={mach.id} value={mach.id}>
                              {mach.name} ({mach.make} {mach.model || ''})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {machinery.length === 0 && selectedVesselId && (
                        <p className="text-xs text-muted-foreground mt-1">No machinery found for this vessel</p>
                      )}
                    </div>
                  )}

                  {/* Scan Manual Pages Button */}
                  {selectedMachineryId && (
                    <div>
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => setShowScanner(true)}
                      >
                        <Scan className="h-4 w-4 mr-2" />
                        Scan Manual Pages
                      </Button>
                    </div>
                  )}

                  {/* Part Number Search */}
                  <div>
                    <Label htmlFor="partNumberSearch" className="mb-2 block">Search by Part Number</Label>
                    <div className="flex gap-2">
                      <Input
                        id="partNumberSearch"
                        placeholder="Enter part number..."
                        value={partNumberSearch}
                        onChange={(e) => setPartNumberSearch(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handlePartNumberSearch();
                          }
                        }}
                      />
                      <Button onClick={handlePartNumberSearch} disabled={loading}>
                        <Search className="h-4 w-4 mr-2" />
                        Search
                      </Button>
                    </div>
                  </div>

                  {/* Part Search Results */}
                  {partSearchResults.length > 0 && (
                    <div className="border rounded-lg p-4 bg-info">
                      <h3 className="font-semibold mb-2">Search Results:</h3>
                      <div className="space-y-2">
                        {partSearchResults.map((result) => (
                          <div key={result.id} className="bg-white p-3 rounded border">
                            <div className="font-medium">{result.name} ({result.sparePartNumber})</div>
                            <div className="text-sm text-foreground mt-1">
                              <div>Location: {result.location?.name || 'N/A'}</div>
                              <div>Rack: {result.rack?.rackNumber || 'N/A'}</div>
                              <div>Box: {result.box?.boxNumber || 'N/A'}</div>
                              <div>Quantity: {result.quantity} {result.unit}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Location Navigation */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="storeLocation" className="mb-2 block">Store Location</Label>
                      <Select
                        value={selectedStoreLocationId}
                        onValueChange={(value) => {
                          setSelectedStoreLocationId(value);
                          setSelectedRackId("");
                          setSelectedBoxId("");
                        }}
                        disabled={!selectedVesselId}
                      >
                        <SelectTrigger id="storeLocation">
                          <SelectValue placeholder="Select Store Location" />
                        </SelectTrigger>
                        <SelectContent>
                          {storeLocations.map((location) => (
                            <SelectItem key={location.id} value={location.id}>
                              {location.name} ({location.code})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="rack" className="mb-2 block">Rack</Label>
                      <Select
                        value={selectedRackId}
                        onValueChange={(value) => {
                          setSelectedRackId(value);
                          setSelectedBoxId("");
                        }}
                        disabled={!selectedStoreLocationId}
                      >
                        <SelectTrigger id="rack">
                          <SelectValue placeholder="Select Rack" />
                        </SelectTrigger>
                        <SelectContent>
                          {racks.map((rack) => (
                            <SelectItem key={rack.id} value={rack.id}>
                              {rack.rackNumber} {rack.description && `- ${rack.description}`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="box" className="mb-2 block">Box</Label>
                      <Select
                        value={selectedBoxId}
                        onValueChange={setSelectedBoxId}
                        disabled={!selectedRackId}
                      >
                        <SelectTrigger id="box">
                          <SelectValue placeholder="Select Box" />
                        </SelectTrigger>
                        <SelectContent>
                          {(boxesByRack[selectedRackId] || []).map((box) => (
                            <SelectItem key={box.id} value={box.id}>
                              {box.boxNumber} {box.description && `- ${box.description}`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Spare Parts List */}
              {selectedBoxId && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Spare Parts Inventory</CardTitle>
                        <CardDescription>
                          View and manage spare parts in the selected box
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                          <Input
                            placeholder="Search parts..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 w-64"
                          />
                        </div>
                        <Button>
                          <Plus className="h-4 w-4 mr-2" />
                          Add Part
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {loading ? (
                      <div className="text-center py-4 text-muted-foreground">Loading...</div>
                    ) : filteredSpareParts.length === 0 ? (
                      <div className="text-center py-4 text-muted-foreground">
                        {searchTerm ? "No spare parts found matching your search" : "No spare parts in this box"}
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left p-3 font-semibold">Part Number</th>
                              <th className="text-left p-3 font-semibold">Name</th>
                              <th className="text-left p-3 font-semibold">Manufacturer</th>
                              <th className="text-left p-3 font-semibold">Model</th>
                              <th className="text-right p-3 font-semibold">Quantity</th>
                              <th className="text-right p-3 font-semibold">Min Stock</th>
                              <th className="text-left p-3 font-semibold">Unit</th>
                              <th className="text-left p-3 font-semibold">Status</th>
                              <th className="text-right p-3 font-semibold">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredSpareParts.map((part) => (
                              <tr key={part.id} className="border-b hover:bg-muted">
                                <td className="p-3">{part.sparePartNumber}</td>
                                <td className="p-3">{part.name}</td>
                                <td className="p-3">{part.manufacturer || "-"}</td>
                                <td className="p-3">{part.model || "-"}</td>
                                <td className="p-3 text-right">
                                  {typeof part.quantity === 'string' ? parseFloat(part.quantity).toFixed(2) : part.quantity}
                                </td>
                                <td className="p-3 text-right">
                                  {part.minStockLevel 
                                    ? (typeof part.minStockLevel === 'string' ? parseFloat(part.minStockLevel).toFixed(2) : part.minStockLevel)
                                    : "-"}
                                </td>
                                <td className="p-3">{part.unit}</td>
                                <td className="p-3">
                                  {isLowStock(part) ? (
                                    <Badge variant="destructive" className="flex items-center gap-1 w-fit">
                                      <AlertTriangle className="h-3 w-3" />
                                      Low Stock
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="flex items-center gap-1 w-fit">
                                      <CheckCircle2 className="h-3 w-3" />
                                      In Stock
                                    </Badge>
                                  )}
                                </td>
                                <td className="p-3">
                                  <div className="flex items-center justify-end gap-2">
                                    <Button variant="ghost" size="sm">
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="sm">
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Empty State */}
              {!selectedVesselId && (
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center py-12">
                      <Package className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-foreground mb-2">No Vessel Selected</h3>
                      <p className="text-foreground mb-4">
                        Please select a vessel to view its inventory
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
                </TabsContent>

                {/* History Tab */}
                <TabsContent value="history" className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Inventory Transaction History</CardTitle>
                      <CardDescription>Complete audit trail of all inventory movements</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {!selectedVesselId ? (
                        <div className="text-center py-4 text-muted-foreground">Please select a vessel</div>
                      ) : loadingTransactions ? (
                        <div className="text-center py-4">Loading transactions...</div>
                      ) : inventoryTransactions.length === 0 ? (
                        <div className="text-center py-4 text-muted-foreground">No transactions found</div>
                      ) : (
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                      <TableSerialHead />
                                <TableHead>Date</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Part Number</TableHead>
                                <TableHead>Part Name</TableHead>
                                <TableHead>Quantity</TableHead>
                                <TableHead>Cost</TableHead>
                                <TableHead>Work Order</TableHead>
                                <TableHead>Created By</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {inventoryTransactions.map((tx: any, index) => (
                                <TableRow key={tx.id}>
                                  <TableSerialCell serialNo={index + 1} />
                                  <TableCell>{new Date(tx.createdAt).toLocaleDateString()}</TableCell>
                                  <TableCell>
                                    <Badge variant="outline">{tx.transactionType}</Badge>
                                  </TableCell>
                                  <TableCell className="font-mono text-sm">{tx.sparePart?.sparePartNumber}</TableCell>
                                  <TableCell>{tx.sparePart?.name}</TableCell>
                                  <TableCell>{tx.quantity} {tx.unit}</TableCell>
                                  <TableCell>{tx.totalCost ? `$${Number(tx.totalCost).toFixed(2)}` : '-'}</TableCell>
                                  <TableCell>
                                    {tx.workOrder ? (
                                      <span className="font-mono text-sm">{tx.workOrder.workOrderNumber}</span>
                                    ) : '-'}
                                  </TableCell>
                                  <TableCell>
                                    {tx.createdBy?.firstName} {tx.createdBy?.lastName}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Reorder Alerts Tab */}
                <TabsContent value="alerts" className="space-y-6">
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle>Reorder Alerts</CardTitle>
                          <CardDescription>Parts that need to be reordered</CardDescription>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={fetchReorderAlerts}
                          disabled={loadingAlerts}
                        >
                          Refresh
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {!selectedVesselId ? (
                        <div className="text-center py-4 text-muted-foreground">Please select a vessel</div>
                      ) : loadingAlerts ? (
                        <div className="text-center py-4">Loading alerts...</div>
                      ) : reorderAlerts.length === 0 ? (
                        <div className="text-center py-4 text-muted-foreground">No reorder alerts</div>
                      ) : (
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                      <TableSerialHead />
                                <TableHead>Part Number</TableHead>
                                <TableHead>Part Name</TableHead>
                                <TableHead>Current Stock</TableHead>
                                <TableHead>Min Stock</TableHead>
                                <TableHead>Recommended Qty</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Requisition</TableHead>
                                <TableHead>Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {reorderAlerts.map((alert: any, index) => (
                                <TableRow key={alert.id}>
                                  <TableSerialCell serialNo={index + 1} />
                                  <TableCell className="font-mono text-sm">{alert.sparePart?.sparePartNumber}</TableCell>
                                  <TableCell>{alert.sparePart?.name}</TableCell>
                                  <TableCell>{alert.currentStock} {alert.sparePart?.unit}</TableCell>
                                  <TableCell>{alert.minStockLevel} {alert.sparePart?.unit}</TableCell>
                                  <TableCell>{alert.recommendedQty} {alert.sparePart?.unit}</TableCell>
                                  <TableCell>
                                    <Badge className={alert.status === 'PENDING' ? 'bg-warning' : 'bg-success'}>
                                      {alert.status}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    {alert.requisition ? (
                                      <span className="font-mono text-sm">{alert.requisition.requisitionNumber}</span>
                                    ) : (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={async () => {
                                          try {
                                            const response = await fetch(`/api/inventory/reorder-alerts/${alert.id}/create-requisition`, {
                                              method: 'POST',
                                              credentials: 'include',
                                            });
                                            if (response.ok) {
                                              toast.success('Requisition created successfully');
                                              fetchReorderAlerts();
                                            } else {
                                              const error = await response.json();
                                              toast.error(error.error || 'Failed to create requisition');
                                            }
                                          } catch (error) {
                                            console.error('Error creating requisition:', error);
                                            toast.error('Failed to create requisition');
                                          }
                                        }}
                                      >
                                        Create Requisition
                                      </Button>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    {alert.status === 'PENDING' && (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={async () => {
                                          try {
                                            const response = await fetch(`/api/inventory/reorder-alerts/${alert.id}`, {
                                              method: 'PATCH',
                                              headers: { 'Content-Type': 'application/json' },
                                              credentials: 'include',
                                              body: JSON.stringify({ status: 'ACKNOWLEDGED' }),
                                            });
                                            if (response.ok) {
                                              toast.success('Alert acknowledged');
                                              fetchReorderAlerts();
                                            }
                                          } catch (error) {
                                            console.error('Error acknowledging alert:', error);
                                          }
                                        }}
                                      >
                                        Acknowledge
                                      </Button>
                                    )}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Reservations Tab */}
                <TabsContent value="reservations" className="space-y-6">
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle>Part Reservations</CardTitle>
                          <CardDescription>Parts reserved for scheduled maintenance</CardDescription>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={fetchPartReservations}
                          disabled={loadingReservations}
                        >
                          Refresh
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {!selectedVesselId ? (
                        <div className="text-center py-4 text-muted-foreground">Please select a vessel</div>
                      ) : loadingReservations ? (
                        <div className="text-center py-4">Loading reservations...</div>
                      ) : partReservations.length === 0 ? (
                        <div className="text-center py-4 text-muted-foreground">No active reservations</div>
                      ) : (
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                      <TableSerialHead />
                                <TableHead>Part Number</TableHead>
                                <TableHead>Part Name</TableHead>
                                <TableHead>Reserved Qty</TableHead>
                                <TableHead>Available Stock</TableHead>
                                <TableHead>Work Order</TableHead>
                                <TableHead>Reserved Until</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {partReservations.map((reservation: any, index) => (
                                <TableRow key={reservation.id}>
                                  <TableSerialCell serialNo={index + 1} />
                                  <TableCell className="font-mono text-sm">{reservation.sparePart?.sparePartNumber}</TableCell>
                                  <TableCell>{reservation.sparePart?.name}</TableCell>
                                  <TableCell>{reservation.quantity} {reservation.sparePart?.unit}</TableCell>
                                  <TableCell>{reservation.sparePart?.quantity} {reservation.sparePart?.unit}</TableCell>
                                  <TableCell>
                                    {reservation.workOrder ? (
                                      <span className="font-mono text-sm">{reservation.workOrder.workOrderNumber}</span>
                                    ) : '-'}
                                  </TableCell>
                                  <TableCell>{new Date(reservation.reservedUntil).toLocaleDateString()}</TableCell>
                                  <TableCell>
                                    <Badge className={reservation.status === 'RESERVED' ? 'bg-info' : 'bg-success'}>
                                      {reservation.status}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    {reservation.status === 'RESERVED' && (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={async () => {
                                          try {
                                            const response = await fetch(`/api/inventory/reservations/${reservation.id}`, {
                                              method: 'DELETE',
                                              credentials: 'include',
                                            });
                                            if (response.ok) {
                                              toast.success('Reservation released');
                                              fetchPartReservations();
                                            }
                                          } catch (error) {
                                            console.error('Error releasing reservation:', error);
                                          }
                                        }}
                                      >
                                        Release
                                      </Button>
                                    )}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>

        {/* Location Dialog */}
        <Dialog open={showLocationDialog} onOpenChange={setShowLocationDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingLocation ? "Edit Location" : "Create New Location"}</DialogTitle>
              <DialogDescription>
                Create a new storage location for the vessel
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="locationName" className="mb-2 block">Location Name</Label>
                <Input
                  id="locationName"
                  value={locationName}
                  onChange={(e) => setLocationName(e.target.value)}
                  placeholder="e.g., Deck, Engine Room, etc."
                />
              </div>
              <div>
                <Label htmlFor="locationCode" className="mb-2 block">Location Code</Label>
                <Input
                  id="locationCode"
                  value={locationCode}
                  onChange={(e) => setLocationCode(e.target.value)}
                  placeholder="e.g., DECK, ER, etc."
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowLocationDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateLocation}>
                {editingLocation ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Rack Dialog */}
        <Dialog open={showRackDialog} onOpenChange={setShowRackDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingRack ? "Edit Rack" : "Create New Rack"}</DialogTitle>
              <DialogDescription>
                Create a new rack in the selected location
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="rackNumber" className="mb-2 block">Rack Number/Name</Label>
                <Input
                  id="rackNumber"
                  value={rackNumber}
                  onChange={(e) => setRackNumber(e.target.value)}
                  placeholder="e.g., R001, Rack A, etc."
                />
              </div>
              <div>
                <Label htmlFor="rackDescription" className="mb-2 block">Description (Optional)</Label>
                <Textarea
                  id="rackDescription"
                  value={rackDescription}
                  onChange={(e) => setRackDescription(e.target.value)}
                  placeholder="Additional details about the rack"
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowRackDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveRack}>
                {editingRack ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Box Dialog */}
        <Dialog open={showBoxDialog} onOpenChange={setShowBoxDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingBox ? "Edit Box" : "Create New Box"}</DialogTitle>
              <DialogDescription>
                Create a new box in the selected rack
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="boxNumber" className="mb-2 block">Box Number/Name</Label>
                <Input
                  id="boxNumber"
                  value={boxNumber}
                  onChange={(e) => setBoxNumber(e.target.value)}
                  placeholder="e.g., B001, Box 1, etc."
                />
              </div>
              <div>
                <Label htmlFor="boxDescription" className="mb-2 block">Description (Optional)</Label>
                <Textarea
                  id="boxDescription"
                  value={boxDescription}
                  onChange={(e) => setBoxDescription(e.target.value)}
                  placeholder="Additional details about the box"
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowBoxDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveBox}>
                {editingBox ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Move Box Dialog */}
        <Dialog open={showMoveBoxDialog} onOpenChange={setShowMoveBoxDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Move Box: {boxToMove?.boxNumber}</DialogTitle>
              <DialogDescription>
                Select the target location and rack to move this box to.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="targetLocation" className="mb-2 block">Target Location</Label>
                <Select
                  value={targetLocationId}
                  onValueChange={(value) => {
                    setTargetLocationId(value);
                    setTargetRackId("");
                  }}
                >
                  <SelectTrigger id="targetLocation">
                    <SelectValue placeholder="Select Location" />
                  </SelectTrigger>
                  <SelectContent>
                    {storeLocations.map((location) => (
                      <SelectItem key={location.id} value={location.id}>
                        {location.name} ({location.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="targetRack" className="mb-2 block">Target Rack</Label>
                <Select
                  value={targetRackId}
                  onValueChange={setTargetRackId}
                  disabled={!targetLocationId}
                >
                  <SelectTrigger id="targetRack">
                    <SelectValue placeholder="Select Rack" />
                  </SelectTrigger>
                  <SelectContent>
                    {targetRacks.map((rack) => (
                      <SelectItem key={rack.id} value={rack.id}>
                        {rack.rackNumber} {rack.description && `- ${rack.description}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowMoveBoxDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleMoveBox} disabled={!targetRackId}>
                Move Box
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Manual Page Scanner Dialog */}
        <ManualPageScanner
          isOpen={showScanner}
          onClose={() => setShowScanner(false)}
          onScanComplete={handleScanComplete}
        />

        {/* Scanned Parts Confirmation Dialog */}
        <Dialog open={showPartsConfirmation} onOpenChange={setShowPartsConfirmation}>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Confirm Scanned Parts</DialogTitle>
              <DialogDescription>
                Review and confirm the parts extracted from the scanned manual pages. Select the parts you want to add to the database.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {scannedParts.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p>No parts extracted from scanned pages</p>
                </div>
              ) : (
                <>
                  <div className="border rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-12">
                              <Checkbox
                                checked={scannedParts.every(p => p.confirmed)}
                                onCheckedChange={(checked) => {
                                  setScannedParts(prev => prev.map(p => ({ ...p, confirmed: !!checked })));
                                }}
                              />
                            </TableHead>
                            <TableHead>Part Number</TableHead>
                            <TableHead>Item Number</TableHead>
                            <TableHead>Part Name</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Manufacturer</TableHead>
                            <TableHead>Drawing Number</TableHead>
                            <TableHead>Quantity</TableHead>
                            <TableHead>Unit</TableHead>
                            <TableHead>Image</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {scannedParts.map((part, index) => (
                            <TableRow key={index} className={part.confirmed !== false ? 'bg-info' : ''}>
                              <TableSerialCell serialNo={index + 1} />
                              <TableCell>
                                <Checkbox
                                  checked={part.confirmed !== false}
                                  onCheckedChange={(checked) => {
                                    setScannedParts(prev => {
                                      const updated = [...prev];
                                      updated[index] = { ...updated[index], confirmed: !!checked };
                                      return updated;
                                    });
                                  }}
                                />
                              </TableCell>
                              <TableCell className="font-medium font-mono text-sm">
                                {part.partNumber || "N/A"}
                              </TableCell>
                              <TableCell className="font-mono text-sm">
                                {part.itemNumber || "N/A"}
                              </TableCell>
                              <TableCell className="max-w-[200px]">
                                <div className="truncate" title={part.name || "Unknown Part"}>
                                  {part.name || "Unknown Part"}
                                </div>
                              </TableCell>
                              <TableCell className="max-w-[250px]">
                                <div className="text-xs text-foreground line-clamp-2" title={part.description || ""}>
                                  {part.description || "N/A"}
                                </div>
                              </TableCell>
                              <TableCell className="text-sm">
                                {part.manufacturer || "N/A"}
                              </TableCell>
                              <TableCell className="font-mono text-xs">
                                {part.drawingNumber || "N/A"}
                              </TableCell>
                              <TableCell className="text-center">
                                {part.quantity || 0}
                              </TableCell>
                              <TableCell className="text-center text-sm">
                                {part.unit || "PCS"}
                              </TableCell>
                              <TableCell>
                                {part.image ? (
                                  <img
                                    src={`data:image/jpeg;base64,${part.image}`}
                                    alt="Part"
                                    className="w-16 h-16 object-cover rounded border cursor-pointer hover:scale-110 transition-transform"
                                    loading="lazy"
                                    width={64}
                                    height={64}
                                    onClick={() => {
                                      // Open image in new window for better view
                                      const newWindow = window.open();
                                      if (newWindow) {
                                        newWindow.document.write(`<img src="data:image/jpeg;base64,${part.image}" style="max-width: 100%; height: auto;" />`);
                                      }
                                    }}
                                  />
                                ) : (
                                  <span className="text-muted-foreground text-xs">No image</span>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                  <div className="text-sm text-foreground">
                    <p>
                      Selected: {scannedParts.filter(p => p.confirmed !== false).length} of {scannedParts.length} parts
                    </p>
                    {!selectedBoxId && (
                      <p className="text-warning mt-2">
                        ⚠️ Please select a box to add these parts to
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowPartsConfirmation(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleConfirmScannedParts}
                disabled={!selectedBoxId || scannedParts.filter(p => p.confirmed !== false).length === 0 || loading}
              >
                {loading ? "Adding..." : `Add ${scannedParts.filter(p => p.confirmed !== false).length} Part(s)`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </ProtectedRoute>
    </PageReadyGate>
  );
}
