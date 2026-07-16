"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, RefreshCw, Wifi, WifiOff, Loader2 } from "lucide-react";

interface NetworkErrorHandlerProps {
  error: Error | string | null;
  onRetry?: () => void;
  autoRetry?: boolean;
  maxRetries?: number;
  retryDelay?: number; // in milliseconds
  children?: React.ReactNode;
}

export function NetworkErrorHandler({
  error,
  onRetry,
  autoRetry = true,
  maxRetries = 3,
  retryDelay = 2000,
  children,
}: NetworkErrorHandlerProps) {
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    setIsOnline(navigator.onLine);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Auto-retry logic
  useEffect(() => {
    if (!error || !autoRetry || retryCount >= maxRetries || !isOnline) {
      return;
    }

    const isNetworkError = 
      typeof error === 'string' 
        ? error.toLowerCase().includes('network') || 
          error.toLowerCase().includes('timeout') ||
          error.toLowerCase().includes('fetch') ||
          error.toLowerCase().includes('failed to load')
        : error.message?.toLowerCase().includes('network') ||
          error.message?.toLowerCase().includes('timeout') ||
          error.message?.toLowerCase().includes('fetch') ||
          error.message?.toLowerCase().includes('failed to load') ||
          error.message?.toLowerCase().includes('chunk') ||
          error.message?.includes('u is not a function');

    if (!isNetworkError) {
      return;
    }

    const delay = retryDelay * Math.pow(2, retryCount); // Exponential backoff
    setIsRetrying(true);

    const timer = setTimeout(() => {
      if (onRetry) {
        onRetry();
        setRetryCount((prev) => prev + 1);
      } else {
        // Default: reload page
        window.location.reload();
      }
      setIsRetrying(false);
    }, delay);

    return () => clearTimeout(timer);
  }, [error, autoRetry, maxRetries, retryCount, retryDelay, isOnline, onRetry]);

  const handleManualRetry = useCallback(() => {
    setRetryCount(0);
    setIsRetrying(true);
    
    if (onRetry) {
      onRetry();
    } else {
      window.location.reload();
    }
    
    setTimeout(() => setIsRetrying(false), 1000);
  }, [onRetry]);

  const handleReload = useCallback(() => {
    window.location.reload();
  }, []);

  if (!error) {
    return <>{children}</>;
  }

  const errorMessage = typeof error === 'string' ? error : error.message || 'Unknown error';
  const isNetworkIssue = 
    errorMessage.toLowerCase().includes('network') ||
    errorMessage.toLowerCase().includes('timeout') ||
    errorMessage.toLowerCase().includes('fetch') ||
    errorMessage.toLowerCase().includes('failed to load') ||
    errorMessage.toLowerCase().includes('chunk') ||
    errorMessage.includes('u is not a function') ||
    !isOnline;

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <div className="flex items-center gap-3">
            {isOnline ? (
              <Wifi className="h-6 w-6 text-orange-500" />
            ) : (
              <WifiOff className="h-6 w-6 text-red-500" />
            )}
            <CardTitle className="text-xl">
              {isNetworkIssue ? "Network Connection Issue" : "Error Loading Page"}
            </CardTitle>
          </div>
          <CardDescription>
            {isNetworkIssue
              ? "Unable to load the page due to network connectivity issues. Please check your internet connection."
              : "An error occurred while loading this page."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              {errorMessage}
            </AlertDescription>
          </Alert>

          {isNetworkIssue && (
            <div className="space-y-2">
              {!isOnline && (
                <Alert>
                  <AlertDescription className="text-sm">
                    You are currently offline. Please check your internet connection.
                  </AlertDescription>
                </Alert>
              )}

              {autoRetry && retryCount < maxRetries && isOnline && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  {isRetrying ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Retrying automatically... (Attempt {retryCount + 1} of {maxRetries})</span>
                    </>
                  ) : (
                    <span>Will retry automatically in a few seconds... (Attempt {retryCount + 1} of {maxRetries})</span>
                  )}
                </div>
              )}

              {retryCount >= maxRetries && (
                <Alert>
                  <AlertDescription className="text-sm">
                    Automatic retry failed after {maxRetries} attempts. Please try manually.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <Button
              onClick={handleManualRetry}
              disabled={isRetrying}
              className="flex-1"
            >
              {isRetrying ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Retrying...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Retry Now
                </>
              )}
            </Button>
            <Button
              onClick={handleReload}
              variant="outline"
              className="flex-1"
            >
              Reload Page
            </Button>
          </div>

          {isNetworkIssue && (
            <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
              <p><strong>Tips:</strong></p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Check your internet connection</li>
                <li>Try refreshing the page</li>
                <li>If the problem persists, clear your browser cache</li>
                <li>Contact support if the issue continues</li>
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
