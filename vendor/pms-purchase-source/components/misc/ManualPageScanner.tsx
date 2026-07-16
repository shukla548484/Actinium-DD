"use client";

import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Camera, X, Upload, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface ScannedPage {
  id: string;
  imageData: string;
  file: File;
}

interface ManualPageScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScanComplete: (pages: ScannedPage[]) => void;
}

export default function ManualPageScanner({
  isOpen,
  onClose,
  onScanComplete,
}: ManualPageScannerProps) {
  const [scannedPages, setScannedPages] = useState<ScannedPage[]>([]);
  const [isCapturing, setIsCapturing] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isStartingCamera, setIsStartingCamera] = useState(false);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
      const isMobileDevice = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase());
      const isSmallScreen = window.innerWidth < 768;
      setIsMobile(isMobileDevice || isSmallScreen);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setScannedPages([]);
      setIsVideoReady(false);
    }
    return () => {
      stopCamera();
    };
  }, [isOpen]);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.onloadedmetadata = () => {
        setIsVideoReady(true);
      };
    }
  }, [stream]);

  const startCamera = async () => {
    try {
      setIsStartingCamera(true);
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: isMobile ? "environment" : "user",
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
      setIsCapturing(true);
    } catch (error: any) {
      console.error("Error accessing camera:", error);
      toast.error(
        error.name === "NotAllowedError"
          ? "Camera access denied. Please allow camera access and try again."
          : "Failed to access camera. Please check your camera permissions."
      );
    } finally {
      setIsStartingCamera(false);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setIsCapturing(false);
    setIsVideoReady(false);
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const captureImage = () => {
    if (!videoRef.current || !canvasRef.current) {
      toast.error("Camera not ready. Please wait for the camera to start.");
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");

    if (!context) {
      toast.error("Failed to get canvas context");
      return;
    }

    if (video.readyState < 2) {
      toast.error("Video not ready. Please wait a moment and try again.");
      return;
    }

    if (video.videoWidth === 0 || video.videoHeight === 0) {
      toast.error("Video dimensions not available. Please wait for the camera to fully initialize.");
      return;
    }

    try {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0);

      canvas.toBlob((blob) => {
        if (!blob) {
          toast.error("Failed to capture image");
          return;
        }

        const file = new File([blob], `manual-page-${Date.now()}.jpg`, { type: "image/jpeg" });
        const reader = new FileReader();

        reader.onloadend = () => {
          const base64 = reader.result as string;
          const newPage: ScannedPage = {
            id: `page-${Date.now()}-${Math.random()}`,
            imageData: base64,
            file,
          };
          setScannedPages((prev) => [...prev, newPage]);
          toast.success("Page captured successfully");
        };

        reader.onerror = () => {
          toast.error("Failed to read captured image");
        };

        reader.readAsDataURL(blob);
      }, "image/jpeg", 0.9);
    } catch (error) {
      console.error("Error capturing image:", error);
      toast.error("Failed to capture image. Please try again.");
    }
  };

  const removePage = (pageId: string) => {
    setScannedPages((prev) => prev.filter((page) => page.id !== pageId));
    toast.success("Page removed");
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      if (!file.type.startsWith("image/")) {
        toast.error(`${file.name} is not an image file`);
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        const newPage: ScannedPage = {
          id: `page-${Date.now()}-${Math.random()}`,
          imageData: base64,
          file,
        };
        setScannedPages((prev) => [...prev, newPage]);
      };
      reader.readAsDataURL(file);
    });

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleComplete = () => {
    if (scannedPages.length === 0) {
      toast.error("Please scan at least one page");
      return;
    }
    onScanComplete(scannedPages);
    stopCamera();
    setScannedPages([]);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Scan Manual Pages</DialogTitle>
          <DialogDescription>
            Capture or upload pages from machinery manuals to extract spare parts information
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Camera Section */}
          {!isCapturing ? (
            <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-gray-300 rounded-lg">
              <Camera className="h-12 w-12 text-gray-400 mb-4" />
              <p className="text-gray-600 mb-4">Start camera to scan pages</p>
              <div className="flex gap-2">
                <Button
                  onClick={startCamera}
                  disabled={isStartingCamera}
                  variant="default"
                >
                  {isStartingCamera ? "Starting..." : "Start Camera"}
                </Button>
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  variant="outline"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Images
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative border rounded-lg overflow-hidden bg-black">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-auto max-h-[400px] object-contain"
                />
                <canvas ref={canvasRef} className="hidden" />
              </div>
              <div className="flex gap-2 justify-center">
                <Button onClick={captureImage} disabled={!isVideoReady}>
                  <Camera className="h-4 w-4 mr-2" />
                  Capture Page
                </Button>
                <Button onClick={stopCamera} variant="outline">
                  Stop Camera
                </Button>
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  variant="outline"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Upload More
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>
            </div>
          )}

          {/* Scanned Pages Preview */}
          {scannedPages.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-semibold text-sm">
                Scanned Pages ({scannedPages.length})
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 max-h-[200px] overflow-y-auto">
                {scannedPages.map((page) => (
                  <div key={page.id} className="relative group">
                    <img
                      src={page.imageData}
                      alt="Scanned page"
                      className="w-full h-32 object-cover rounded border"
                    />
                    <Button
                      variant="destructive"
                      size="sm"
                      className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => removePage(page.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleComplete}
            disabled={scannedPages.length === 0}
          >
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Process {scannedPages.length} Page{scannedPages.length !== 1 ? "s" : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}















