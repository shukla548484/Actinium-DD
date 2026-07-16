"use client";

import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Upload, FileSpreadsheet, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import ActiniumLoader from "@/components/ActiniumLoader";
import { TableSerialHead, TableSerialCell } from "@/components/ui/table-serial-column";

interface VendorBulkUploadDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function VendorBulkUploadDialog({
  isOpen,
  onClose,
  onSuccess,
}: VendorBulkUploadDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{
    successful: number;
    failed: number;
    errors: any[];
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    // Validate file type
    const validTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
    ];

    if (!validTypes.includes(selectedFile.type) && !selectedFile.name.match(/\.(xlsx|xls)$/i)) {
      toast.error("Please select a valid Excel file (.xlsx or .xls)");
      return;
    }

    setFile(selectedFile);
    setUploadResult(null);

    // Parse file for preview
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await fetch("/api/vendors/bulk-upload?preview=true", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        setPreviewData(data.vendors || []);
        setIsPreviewMode(true);
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to parse Excel file");
        setFile(null);
      }
    } catch (error) {
      console.error("Error parsing file:", error);
      toast.error("Failed to parse Excel file");
      setFile(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/vendors/bulk-upload", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        setUploadResult(data);
        
        if (data.failed === 0) {
          toast.success(`Successfully uploaded ${data.successful} vendors`);
          setTimeout(() => {
            handleClose();
            onSuccess();
          }, 2000);
        } else {
          toast.warning(
            `Uploaded ${data.successful} vendors. ${data.failed} failed.`
          );
        }
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to upload vendors");
      }
    } catch (error) {
      console.error("Error uploading file:", error);
      toast.error("Failed to upload vendors");
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setPreviewData([]);
    setIsPreviewMode(false);
    setUploadResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    onClose();
  };

  const handleReset = () => {
    setFile(null);
    setPreviewData([]);
    setIsPreviewMode(false);
    setUploadResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle style={{ fontSize: "14px" }}>Bulk Upload Vendors</DialogTitle>
          <DialogDescription style={{ fontSize: "12px" }}>
            Upload the Excel template with full vendor registration details (company, contacts,
            legal, banking, ports). Download the latest template for required columns.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Upload Result */}
          {uploadResult && (
            <div className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span style={{ fontSize: "12px" }}>
                    <strong>{uploadResult.successful}</strong> successful
                  </span>
                </div>
                {uploadResult.failed > 0 && (
                  <div className="flex items-center gap-2">
                    <XCircle className="h-5 w-5 text-red-600" />
                    <span style={{ fontSize: "12px" }}>
                      <strong>{uploadResult.failed}</strong> failed
                    </span>
                  </div>
                )}
              </div>

              {uploadResult.errors.length > 0 && (
                <div className="space-y-2">
                  <p style={{ fontSize: "12px" }} className="font-medium">
                    Errors:
                  </p>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {uploadResult.errors.map((error, index) => (
                      <div
                        key={index}
                        className="flex items-start gap-2 text-red-600"
                        style={{ fontSize: "10px" }}
                      >
                        <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                        <span>
                          Row {error.row}: {error.error}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* File Upload */}
          {!isPreviewMode && (
            <div className="border-2 border-dashed rounded-lg p-8 text-center space-y-4">
              <div className="flex justify-center">
                <FileSpreadsheet className="h-12 w-12 text-muted-foreground" />
              </div>
              <div>
                <p style={{ fontSize: "12px" }} className="font-medium mb-1">
                  Select an Excel file to upload
                </p>
                <p style={{ fontSize: "10px" }} className="text-muted-foreground">
                  Supported formats: .xlsx, .xls
                </p>
              </div>
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="vendor-file-upload"
                />
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  variant="outline"
                  style={{ fontSize: "12px" }}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Choose File
                </Button>
              </div>
            </div>
          )}

          {/* Preview Table */}
          {isPreviewMode && previewData.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p style={{ fontSize: "12px" }} className="font-medium">
                    Preview: {previewData.length} vendors found
                  </p>
                  <p style={{ fontSize: "10px" }} className="text-muted-foreground">
                    {file?.name}
                  </p>
                </div>
                <Button
                  onClick={handleReset}
                  variant="outline"
                  size="sm"
                  style={{ fontSize: "12px" }}
                >
                  Choose Different File
                </Button>
              </div>

              <div className="border rounded-lg max-h-96 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableSerialHead />
                      <TableHead style={{ fontSize: "10px" }}>Name</TableHead>
                      <TableHead style={{ fontSize: "10px" }}>Email</TableHead>
                      <TableHead style={{ fontSize: "10px" }}>Country</TableHead>
                      <TableHead style={{ fontSize: "10px" }}>Services</TableHead>
                      <TableHead style={{ fontSize: "10px" }}>Ports</TableHead>
                      <TableHead style={{ fontSize: "10px" }}>Status</TableHead>
                      <TableHead style={{ fontSize: "10px" }}>Rating</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewData.slice(0, 50).map((vendor, index) => (
                      <TableRow key={index}>
                        <TableSerialCell serialNo={index + 1} />
                        <TableCell style={{ fontSize: "10px" }}>
                          {vendor.name}
                        </TableCell>
                        <TableCell style={{ fontSize: "10px" }}>
                          {vendor.primaryEmail}
                        </TableCell>
                        <TableCell style={{ fontSize: "10px" }}>
                          {vendor.country}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {vendor.serviceTypes?.slice(0, 2).map((type: string, index) => (
                              <Badge
                                key={type}
                                variant="outline"
                                style={{ fontSize: "8px" }}
                              >
                                {type}
                              </Badge>
                            ))}
                            {vendor.serviceTypes?.length > 2 && (
                              <Badge variant="outline" style={{ fontSize: "8px" }}>
                                +{vendor.serviceTypes.length - 2}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell style={{ fontSize: "10px" }}>
                          {vendor.portLabels?.join(", ") || (vendor.portIds?.length ? `${vendor.portIds.length} matched` : "-")}
                        </TableCell>
                        <TableCell style={{ fontSize: "10px" }}>
                          {vendor.validationError ? (
                            <span className="text-destructive">{vendor.validationError}</span>
                          ) : (
                            <span className="text-green-700">Ready</span>
                          )}
                        </TableCell>
                        <TableCell style={{ fontSize: "10px" }}>
                          {vendor.rating ? `${vendor.rating} ⭐` : "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {previewData.length > 50 && (
                <p style={{ fontSize: "10px" }} className="text-muted-foreground text-center">
                  Showing first 50 of {previewData.length} vendors
                </p>
              )}
            </div>
          )}

          {/* Upload Button */}
          {isPreviewMode && (
            <div className="flex justify-end gap-2">
              <Button
                onClick={handleClose}
                variant="outline"
                disabled={isUploading}
                style={{ fontSize: "12px" }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpload}
                disabled={
                  isUploading ||
                  !file ||
                  previewData.some((v) => Boolean(v.validationError))
                }
                style={{ fontSize: "12px" }}
              >
                {isUploading ? (
                  <>
                    <ActiniumLoader size="sm" />
                    <span className="ml-2">Uploading...</span>
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload {previewData.length} Vendors
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
