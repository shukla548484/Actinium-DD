"use client";

import React, { memo } from "react";
import { FileText } from "lucide-react";
import { ChatMessage } from "@/lib/hooks/useVendorChat";

interface ChatMessageItemProps {
  message: ChatMessage;
  formatDate: (date: string) => string;
}

// Memoized message component to prevent unnecessary re-renders
// Only re-renders if message props actually change
export const ChatMessageItem = memo<ChatMessageItemProps>(({ message, formatDate }) => {
  // Determine message background color based on status
  let messageBgClass = "";
  if (message.senderType === "PURCHASER") {
    // Our messages: Green if delivered (sent), Blue if read
    messageBgClass = message.isRead 
      ? "bg-blue-600 text-white" // Read - Blue
      : "bg-green-600 text-white"; // Delivered but not read - Green
  } else {
    // Vendor messages: Gray (incoming)
    messageBgClass = "bg-gray-200 text-gray-900";
  }

  return (
    <div
      className={`flex ${message.senderType === "PURCHASER" ? "justify-end" : "justify-start"}`}
      data-message-id={message.id}
    >
      <div className={`max-w-[80%] rounded-lg p-3 ${messageBgClass} transition-opacity duration-200`}>
        <p className="text-sm whitespace-pre-wrap break-words">{message.message}</p>
        {message.attachments && message.attachments.length > 0 && (
          <div className="mt-2 space-y-1">
            {message.attachments.map((att: any) => (
              <a
                key={att.id}
                href={`/api/chat/attachments/download?fileUrl=${encodeURIComponent(att.fileUrl)}`}
                download={att.fileName}
                className="text-xs underline flex items-center gap-1 hover:opacity-80 transition-opacity"
              >
                <FileText className="h-3 w-3" />
                {att.fileName}
              </a>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between mt-1">
          <p className="text-xs opacity-75">
            {formatDate(message.createdAt)}
          </p>
          {message.senderType === "PURCHASER" && (
            <span className="text-xs opacity-75 ml-2">
              {message.isRead ? "✓✓ Read" : "✓ Delivered"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function for memo
  // Only re-render if message actually changed
  const prev = prevProps.message;
  const next = nextProps.message;
  
  return (
    prev.id === next.id &&
    prev.message === next.message &&
    prev.isRead === next.isRead &&
    prev.senderType === next.senderType &&
    JSON.stringify(prev.attachments || []) === JSON.stringify(next.attachments || []) &&
    prev.createdAt === next.createdAt
  );
});

ChatMessageItem.displayName = "ChatMessageItem";

