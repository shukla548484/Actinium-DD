/**
 * Vendor Chat Hook - Modern Chat App Architecture
 * 
 * Principles:
 * 1. UI is ALWAYS stable - container structure never changes
 * 2. Data loads in background - never blocks UI
 * 3. Incremental updates - only update what changed
 * 4. Optimistic updates - messages appear instantly
 * 5. Refs for data, state only for UI triggers
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import { subscribeToChatChannel, subscribeToTypingIndicators, sendTypingIndicator } from "@/lib/pusher-client";

export interface ChatMessage {
  id: string;
  purchaseOrderId: string;
  vendorId: string;
  senderType: "PURCHASER" | "VENDOR";
  senderId: string;
  message: string;
  isRead: boolean;
  readAt: string | null;
  status?: "SENDING" | "SENT" | "DELIVERED" | "READ";
  deliveredAt?: string | null;
  editedAt?: string | null;
  isPinned?: boolean;
  pinnedAt?: string | null;
  replyToMessageId?: string | null;
  replyToMessage?: {
    id: string;
    message: string;
    senderType: "PURCHASER" | "VENDOR";
    createdAt: string;
  } | null;
  quickReplyId?: string | null;
  attachments?: ChatAttachment[];
  createdAt: string;
  updatedAt: string;
}

export interface ChatAttachment {
  id: string;
  messageId: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSize: bigint | number | string | null;
  createdAt: string;
}

interface UseVendorChatOptions {
  purchaseOrderId: string | null;
  enabled?: boolean;
  onMessageSent?: (message: ChatMessage) => void;
  onError?: (error: string) => void;
}

interface UseVendorChatReturn {
  messages: ChatMessage[];
  loading: boolean;
  sending: boolean;
  error: string | null;
  isTyping: boolean;
  typingUser: string | null;
  sendMessage: (message: string, files?: File[], quickReplyId?: string, replyToMessageId?: string) => Promise<boolean>;
  refreshMessages: () => Promise<void>;
  clearError: () => void;
  sendTypingIndicator: (isTyping: boolean) => void;
  searchMessages: (query: string, filters?: any) => Promise<ChatMessage[]>;
}

export function useVendorChat({
  purchaseOrderId,
  enabled = true,
  onMessageSent,
  onError,
}: UseVendorChatOptions): UseVendorChatReturn {
  // State is ONLY for triggering UI updates - data lives in refs
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUser, setTypingUser] = useState<string | null>(null);
  
  // All data stored in refs - these never cause re-renders
  const messagesRef = useRef<ChatMessage[]>([]);
  const prevMessagesRef = useRef<ChatMessage[]>([]); // Track previous state to prevent loops
  const isInitialLoadRef = useRef(true);
  const isUnauthorizedRef = useRef(false);
  const optimisticMessageIdRef = useRef<string | null>(null);
  const pusherUnsubscribeRef = useRef<(() => void) | null>(null);
  const typingUnsubscribeRef = useRef<(() => void) | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const updateScheduledRef = useRef(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const onErrorRef = useRef(onError); // Store onError in ref to prevent dependency loops
  const onMessageSentRef = useRef(onMessageSent); // Store onMessageSent in ref to prevent dependency loops

  /**
   * Update UI from refs - batched and scheduled to prevent flickering
   * FIXED: Removed messages dependency to prevent infinite loops
   * Uses refs for comparison to avoid any state dependencies
   */
  const scheduleUIUpdate = useCallback(() => {
    if (updateScheduledRef.current) return;
    
    updateScheduledRef.current = true;
    // Use setTimeout instead of requestAnimationFrame to break any potential loops
    setTimeout(() => {
      // Only update if messages actually changed
      const currentMessages = messagesRef.current;
      const prevMessages = prevMessagesRef.current;
      
      // Simple comparison - check length and IDs only (faster, prevents loops)
      const hasChanged = 
        currentMessages.length !== prevMessages.length ||
        currentMessages.some((msg, idx) => {
          const prev = prevMessages[idx];
          return !prev || msg.id !== prev.id;
        });
      
      if (hasChanged) {
        prevMessagesRef.current = [...currentMessages]; // Update ref before state
        // Use functional update to prevent dependency on current state
        setMessages(() => [...currentMessages]); // Create new array reference
      }
      
      updateScheduledRef.current = false;
    }, 0); // Use setTimeout(0) to break render cycle
  }, []); // NO DEPENDENCIES - prevents infinite loops

  // Keep callback refs in sync (non-blocking, doesn't cause re-renders)
  useEffect(() => {
    onErrorRef.current = onError;
    onMessageSentRef.current = onMessageSent;
  }, [onError, onMessageSent]);

  /**
   * Fetch messages - runs in background, never blocks UI
   */
  const fetchMessages = useCallback(async (showLoading = false): Promise<void> => {
    if (!purchaseOrderId || !enabled) {
      return;
    }

    // Only show loading on true initial load
    if (showLoading && isInitialLoadRef.current && messagesRef.current.length === 0) {
      setLoading(true);
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(`/api/purchase-orders/${purchaseOrderId}/chat?limit=50`, {
        method: "GET",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 401) {
          isUnauthorizedRef.current = true;
          setError("Unauthorized - Please refresh the page");
          setLoading(false);
          return;
        }
        
        const errorData = await response.json().catch(() => ({
          error: `HTTP ${response.status}: ${response.statusText}`,
        }));
        throw new Error(errorData.error || "Failed to fetch messages");
      }
      
      if (isUnauthorizedRef.current) {
        isUnauthorizedRef.current = false;
      }

      const data = await response.json();
      if (data.success !== false) {
        const fetchedMessages = (data.messages || []) as ChatMessage[];
        
        // Debug logging to check message types
        const purchaserCount = fetchedMessages.filter(m => m.senderType === "PURCHASER").length;
        const vendorCount = fetchedMessages.filter(m => m.senderType === "VENDOR").length;
        console.log(`[useVendorChat] Fetched ${fetchedMessages.length} messages: ${purchaserCount} purchaser, ${vendorCount} vendor`);
        
        // Update ref immediately (no re-render)
        messagesRef.current = fetchedMessages;
        
        // Remove optimistic message if real one arrived
        const optimisticId = optimisticMessageIdRef.current;
        if (optimisticId) {
          const hasRealMessage = fetchedMessages.some(m => 
            m.id === optimisticId ||
            (m.message === messagesRef.current.find(m => m.id === optimisticId)?.message &&
             Math.abs(new Date(m.createdAt).getTime() - Date.now()) < 5000)
          );
          if (hasRealMessage) {
            optimisticMessageIdRef.current = null;
          }
        }
        
        // Schedule UI update (non-blocking)
        scheduleUIUpdate();
        
        // Auto-scroll only on initial load
        if (isInitialLoadRef.current) {
          requestAnimationFrame(() => {
            const container = containerRef.current || document.getElementById("chat-messages-container");
            if (container) {
              container.scrollTop = container.scrollHeight;
            }
          });
        }
        
        isInitialLoadRef.current = false;
      }
    } catch (err: any) {
      if (err.name === "AbortError") {
        console.log("Chat fetch aborted");
        return;
      }
      
      if (!isUnauthorizedRef.current) {
        const errorMsg = err.message || "Failed to fetch messages";
        setError(errorMsg);
        // Use ref to avoid dependency on onError
        if (onErrorRef.current) {
          onErrorRef.current(errorMsg);
        }
      }
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }, [purchaseOrderId, enabled]); // Removed onError and scheduleUIUpdate - both are stable via refs

  /**
   * Send typing indicator
   */
  const handleSendTypingIndicator = useCallback((typing: boolean) => {
    if (!purchaseOrderId || !enabled) return;
    
    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Send typing indicator
    sendTypingIndicator(
      purchaseOrderId,
      "", // Will be set by API
      "", // Will be set by API
      typing
    );
    
    // Auto-stop typing after 3 seconds
    if (typing) {
      typingTimeoutRef.current = setTimeout(() => {
        handleSendTypingIndicator(false);
      }, 3000);
    }
  }, [purchaseOrderId, enabled]);

  /**
   * Search messages
   */
  const searchMessages = useCallback(async (query: string, filters?: any): Promise<ChatMessage[]> => {
    if (!purchaseOrderId || !enabled) return [];
    
    try {
      const params = new URLSearchParams({ q: query });
      if (filters?.senderType) params.append("senderType", filters.senderType);
      if (filters?.hasAttachments) params.append("hasAttachments", "true");
      if (filters?.startDate) params.append("startDate", filters.startDate);
      if (filters?.endDate) params.append("endDate", filters.endDate);
      
      const response = await fetch(`/api/purchase-orders/${purchaseOrderId}/chat/search?${params}`, {
        credentials: "include",
      });
      
      if (response.ok) {
        const data = await response.json();
        return data.messages || [];
      }
      return [];
    } catch (err) {
      console.error("Error searching messages:", err);
      return [];
    }
  }, [purchaseOrderId, enabled]);

  /**
   * Send message - optimistic update pattern
   */
  const sendMessage = useCallback(async (
    message: string, 
    files?: File[], 
    quickReplyId?: string,
    replyToMessageId?: string
  ): Promise<boolean> => {
    if (!purchaseOrderId || !enabled || sending) {
      return false;
    }

    if (!message.trim() && (!files || files.length === 0)) {
      return false;
    }

    // Stop typing indicator
    handleSendTypingIndicator(false);
    
    // Create optimistic message
    const tempId = `temp-${Date.now()}`;
    const optimisticMessage: ChatMessage = {
      id: tempId,
      purchaseOrderId,
      vendorId: messagesRef.current[0]?.vendorId || "",
      senderType: "PURCHASER",
      senderId: "",
      message: message.trim(),
      isRead: false,
      readAt: null,
      status: "SENDING",
      quickReplyId: quickReplyId || null,
      replyToMessageId: replyToMessageId || null,
      attachments: files?.map((file, idx) => ({
        id: `temp-att-${Date.now()}-${idx}`,
        messageId: tempId,
        fileName: file.name,
        fileUrl: "",
        fileType: file.type,
        fileSize: file.size,
        createdAt: new Date().toISOString(),
      })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Add optimistic message immediately (no API call yet)
    messagesRef.current = [...messagesRef.current, optimisticMessage];
    optimisticMessageIdRef.current = tempId;
    scheduleUIUpdate();

    // Auto-scroll to show new message
    requestAnimationFrame(() => {
      const container = containerRef.current || document.getElementById("chat-messages-container");
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    });

    setSending(true);

    try {
      const formData = new FormData();
      formData.append("message", message.trim());
      if (files && files.length > 0) {
        files.forEach((file) => {
          formData.append("files", file);
        });
      }
      if (quickReplyId) {
        formData.append("quickReplyId", quickReplyId);
      }
      if (replyToMessageId) {
        formData.append("replyToMessageId", replyToMessageId);
      }

      const response = await fetch(`/api/purchase-orders/${purchaseOrderId}/chat`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (!response.ok) {
        if (response.status === 401) {
          isUnauthorizedRef.current = true;
          setError("Unauthorized - Please refresh the page");
        } else {
          const errorData = await response.json().catch(() => ({
            error: `HTTP ${response.status}: ${response.statusText}`,
          }));
          throw new Error(errorData.error || "Failed to send message");
        }
        
        // Remove optimistic message on error
        messagesRef.current = messagesRef.current.filter(m => m.id !== tempId);
        optimisticMessageIdRef.current = null;
        scheduleUIUpdate();
        return false;
      }

      const data = await response.json();
      if (data.success && data.message) {
        const realMessage = {
          ...data.message,
          status: "SENT" as const, // Update status to SENT
        } as ChatMessage;
        
        // Replace optimistic message with real one
        const optimisticIndex = messagesRef.current.findIndex(m => m.id === tempId);
        if (optimisticIndex >= 0) {
          messagesRef.current[optimisticIndex] = realMessage;
        } else {
          messagesRef.current = [...messagesRef.current, realMessage];
        }
        
        optimisticMessageIdRef.current = null;
        scheduleUIUpdate();

        // Use ref to avoid dependency on onMessageSent
        if (onMessageSentRef.current) {
          onMessageSentRef.current(realMessage);
        }

        // Auto-scroll
        requestAnimationFrame(() => {
          const container = containerRef.current || document.getElementById("chat-messages-container");
          if (container) {
            container.scrollTop = container.scrollHeight;
          }
        });

        return true;
      }

      return false;
    } catch (err: any) {
      // Remove optimistic message on error
      messagesRef.current = messagesRef.current.filter(m => m.id !== tempId);
      optimisticMessageIdRef.current = null;
      scheduleUIUpdate();
      
      const errorMsg = err.message || "Failed to send message";
      toast.error(errorMsg);
      return false;
    } finally {
      setSending(false);
    }
  }, [purchaseOrderId, enabled, sending, onMessageSent]);

  /**
   * Refresh messages - background only, never shows loading
   */
  const refreshMessages = useCallback(async (): Promise<void> => {
    await fetchMessages(false); // Never show loading on refresh
  }, [fetchMessages]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Initial load
  useEffect(() => {
    if (!purchaseOrderId || !enabled) {
      messagesRef.current = [];
      prevMessagesRef.current = [];
      setMessages([]);
      return;
    }

    // Reset state
    isInitialLoadRef.current = true;
    messagesRef.current = [];
    prevMessagesRef.current = []; // Reset prev messages ref too
    setMessages([]);
    setError(null);
    isUnauthorizedRef.current = false;

    // Load initial messages
    fetchMessages(true);

    // Subscribe to typing indicators
    const typingUnsubscribe = subscribeToTypingIndicators(
      purchaseOrderId,
      (userId: string, userName: string, typing: boolean) => {
        // Don't show typing indicator for own messages
        if (userId && typing) {
          setIsTyping(true);
          setTypingUser(userName);
        } else {
          setIsTyping(false);
          setTypingUser(null);
        }
      }
    );
    typingUnsubscribeRef.current = typingUnsubscribe;

    // Subscribe to Pusher for real-time updates
    const unsubscribe = subscribeToChatChannel(
      purchaseOrderId,
      (newMessage: ChatMessage) => {
        console.log(`[useVendorChat] Pusher received message: ${newMessage.id}, senderType: ${newMessage.senderType}, message: ${newMessage.message.substring(0, 50)}...`);
        
        // Check if message already exists
        if (messagesRef.current.some(m => m.id === newMessage.id)) {
          console.log(`[useVendorChat] Message ${newMessage.id} already exists, skipping`);
          return;
        }
        
        // Remove optimistic message if it exists
        const optimisticId = optimisticMessageIdRef.current;
        if (optimisticId) {
          messagesRef.current = messagesRef.current.filter(m => m.id !== optimisticId);
          optimisticMessageIdRef.current = null;
        }
        
        // Add new message
        messagesRef.current = [...messagesRef.current, newMessage];
        console.log(`[useVendorChat] Added message ${newMessage.id}, total messages: ${messagesRef.current.length}`);
        scheduleUIUpdate();

        // Auto-scroll if near bottom
        requestAnimationFrame(() => {
          const container = containerRef.current || document.getElementById("chat-messages-container");
          if (container) {
            const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
            if (isNearBottom) {
              container.scrollTop = container.scrollHeight;
            }
          }
        });
      },
      (messageId: string, updates: any) => {
        // Update existing message (e.g., read status)
        const index = messagesRef.current.findIndex(m => m.id === messageId);
        if (index >= 0) {
          messagesRef.current[index] = { ...messagesRef.current[index], ...updates };
          scheduleUIUpdate();
        }
      }
    );

    pusherUnsubscribeRef.current = unsubscribe;

    return () => {
      if (pusherUnsubscribeRef.current) {
        pusherUnsubscribeRef.current();
        pusherUnsubscribeRef.current = null;
      }
      if (typingUnsubscribeRef.current) {
        typingUnsubscribeRef.current();
        typingUnsubscribeRef.current = null;
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [purchaseOrderId, enabled, fetchMessages]); // scheduleUIUpdate is stable, no need in deps

  // REMOVED: Sync useEffect - it was causing loops
  // State will be updated by scheduleUIUpdate when messages are fetched
  // No need to sync manually

  // Always return state - state is the source of truth, refs are just for internal tracking
  // This prevents inconsistencies that could cause render loops
  return {
    messages, // Always use state - it's updated by scheduleUIUpdate
    loading,
    sending,
    error,
    isTyping,
    typingUser,
    sendMessage,
    refreshMessages,
    clearError,
    sendTypingIndicator: handleSendTypingIndicator,
    searchMessages,
  };
}