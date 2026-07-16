"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageSquare, Send, FileText, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useVendorChat } from "@/lib/hooks/useVendorChat";
import { ChatMessageItem } from "@/components/ChatMessageItem";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purchaseOrderId: string;
  poNumber: string;
  invoiceNumber: string;
  onMessagesRead?: () => void;
};

export function InvoicePlatformMessagesDialog({
  open,
  onOpenChange,
  purchaseOrderId,
  poNumber,
  invoiceNumber,
  onMessagesRead,
}: Props) {
  const [reply, setReply] = useState("");
  const [chatFiles, setChatFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    messages,
    loading,
    sending,
    sendMessage,
    refreshMessages,
  } = useVendorChat({
    purchaseOrderId: open ? purchaseOrderId : null,
    enabled: open,
    onMessageSent: () => {
      void refreshMessages();
    },
  });

  useEffect(() => {
    if (open) {
      const timer = window.setTimeout(() => {
        onMessagesRead?.();
      }, 600);
      return () => window.clearTimeout(timer);
    }
  }, [open, purchaseOrderId, onMessagesRead]);

  const formatDate = useCallback((date: string) => {
    const d = new Date(date);
    if (!Number.isFinite(d.getTime())) return "—";
    return d.toLocaleString(undefined, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  }, []);

  const memoizedMessages = useMemo(
    () =>
      messages.map((msg) => (
        <ChatMessageItem key={msg.id} message={msg} formatDate={formatDate} />
      )),
    [messages, formatDate]
  );

  const handleSend = async () => {
    const text = reply.trim();
    if (!text && chatFiles.length === 0) return;

    const filesToSend = [...chatFiles];
    setReply("");
    setChatFiles([]);

    const ok = await sendMessage(text, filesToSend.length > 0 ? filesToSend : undefined);
    if (ok) {
      toast.success("Reply sent to supplier");
    }
  };

  const handleChatFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setChatFiles((prev) => [...prev, ...files]);
    e.target.value = "";
  };

  const removeChatFile = (index: number) => {
    setChatFiles((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            View vendor reply — {invoiceNumber}
          </DialogTitle>
          <DialogDescription>
            PO {poNumber} — all supplier queries and office replies are handled here.
            Suppliers must respond in the Actinium-sm vendor portal, not by email.
          </DialogDescription>
        </DialogHeader>

        <div className="relative flex-1 min-h-[280px] flex flex-col border rounded-md bg-muted/20 overflow-hidden">
          {loading && messages.length === 0 ? (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading messages…
            </div>
          ) : (
            <div
              id="chat-messages-container"
              className="flex-1 overflow-y-auto p-3 space-y-3"
            >
              {messages.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No messages yet. Supplier replies will appear here.
                </p>
              ) : (
                memoizedMessages
              )}
            </div>
          )}

          <div className="border-t bg-background p-3 space-y-2">
            {chatFiles.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {chatFiles.map((file, index) => (
                  <div
                    key={`${file.name}-${index}`}
                    className="flex items-center gap-2 bg-muted px-2 py-1 rounded text-sm"
                  >
                    <FileText className="h-4 w-4" />
                    <span className="max-w-[200px] truncate">{file.name}</span>
                    <button
                      type="button"
                      onClick={() => removeChatFile(index)}
                      className="text-destructive hover:opacity-80"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <Input
                placeholder="Type your reply to the supplier…"
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void handleSend();
                  }
                }}
              />
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleChatFileSelect}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
              >
                <FileText className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            onClick={() => void handleSend()}
            disabled={sending || (!reply.trim() && chatFiles.length === 0)}
          >
            <Send className="h-4 w-4 mr-2" />
            {sending ? "Sending…" : "Send reply"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
