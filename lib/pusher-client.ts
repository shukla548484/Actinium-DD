/**
 * Pusher Client Configuration
 * Used for client-side real-time subscriptions
 * 
 * NOTE: This file must be imported only in client components (use "use client")
 */

"use client";

import Pusher from 'pusher-js';

// Initialize Pusher client instance
// This is used on the client-side to subscribe to channels
let pusherClient: Pusher | null = null;

// Track if we've already warned about missing Pusher config (prevent spam)
let hasWarnedAboutPusher = false;

export function getPusherClient(): Pusher | null {
  const pusherKey = process.env.NEXT_PUBLIC_PUSHER_KEY;
  const pusherCluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'us2';

  if (!pusherKey) {
    // Only warn once per session to prevent console spam
    if (!hasWarnedAboutPusher) {
      console.warn('⚠️ Pusher: NEXT_PUBLIC_PUSHER_KEY is not set. Real-time chat will not work. Please configure Pusher environment variables.');
      hasWarnedAboutPusher = true;
    }
    return null;
  }

  if (!pusherClient) {
    try {
      pusherClient = new Pusher(pusherKey, {
        cluster: pusherCluster,
        authEndpoint: '/api/pusher/auth', // Optional: for private channels
        auth: {
          headers: {
            // Cookies will be sent automatically with credentials: 'include'
          },
        },
      });

      // Enable logging in development
      if (process.env.NODE_ENV === 'development') {
        Pusher.logToConsole = true;
      }
    } catch (error) {
      console.error('❌ Pusher: Error initializing client:', error);
      return null;
    }
  }

  return pusherClient;
}

/**
 * Subscribe to a chat channel for a specific purchase order
 * @param purchaseOrderId - The purchase order ID
 * @param onMessage - Callback when a new message is received
 * @param onMessageUpdate - Callback when a message is updated
 * @returns Unsubscribe function
 */
export function subscribeToChatChannel(
  purchaseOrderId: string,
  onMessage: (message: any) => void,
  onMessageUpdate?: (messageId: string, updates: any) => void
): () => void {
  const pusher = getPusherClient();
  
  // If Pusher is not configured, return a no-op unsubscribe function
  if (!pusher) {
    // Warning already shown by getPusherClient, don't repeat
    return () => {}; // Return empty function for cleanup
  }

  try {
    const channelName = `chat-${purchaseOrderId}`;
    const channel = pusher.subscribe(channelName);

    // Handle connection errors gracefully
    channel.bind('pusher:subscription_error', (error: any) => {
      console.error('Pusher subscription error:', error);
      // Don't crash - just log the error
    });

    channel.bind('pusher:error', (error: any) => {
      console.error('Pusher error:', error);
      // Don't crash - just log the error
    });

    // Listen for new messages
    channel.bind('new-message', (data: { message: any }) => {
      try {
        onMessage(data.message);
      } catch (error) {
        console.error('Error handling new message:', error);
      }
    });

    // Listen for message updates (optional)
    if (onMessageUpdate) {
      channel.bind('message-updated', (data: { messageId: string; updates: any }) => {
        try {
          onMessageUpdate(data.messageId, data.updates);
        } catch (error) {
          console.error('Error handling message update:', error);
        }
      });
    }

    // Return unsubscribe function
    return () => {
      try {
        channel.unbind_all();
        channel.unsubscribe();
      } catch (error) {
        // Silently handle unsubscribe errors
        console.error('Error unsubscribing from Pusher channel:', error);
      }
    };
  } catch (error) {
    console.error('Error subscribing to Pusher channel:', error);
    // Return no-op function - don't crash the app
    return () => {};
  }
}

/**
 * Subscribe to typing indicators
 * @param purchaseOrderId - The purchase order ID
 * @param onTyping - Callback when typing status changes
 * @returns Unsubscribe function
 */
export function subscribeToTypingIndicators(
  purchaseOrderId: string,
  onTyping: (userId: string, userName: string, isTyping: boolean) => void
): () => void {
  const pusher = getPusherClient();
  
  if (!pusher) {
    return () => {};
  }

  try {
    const channelName = `chat-${purchaseOrderId}`;
    const channel = pusher.subscribe(channelName);

    channel.bind('typing', (data: { userId: string; userName: string; isTyping: boolean }) => {
      try {
        onTyping(data.userId, data.userName, data.isTyping);
      } catch (error) {
        console.error('Error handling typing indicator:', error);
      }
    });

    return () => {
      try {
        channel.unbind('typing');
      } catch (error) {
        console.error('Error unsubscribing from typing indicators:', error);
      }
    };
  } catch (error) {
    console.error('Error subscribing to typing indicators:', error);
    return () => {};
  }
}

/**
 * Send typing indicator
 * @param purchaseOrderId - The purchase order ID
 * @param userId - The user ID
 * @param userName - The user name
 * @param isTyping - Whether the user is typing
 */
export async function sendTypingIndicator(
  purchaseOrderId: string,
  userId: string,
  userName: string,
  isTyping: boolean
): Promise<void> {
  try {
    await fetch(`/api/purchase-orders/${purchaseOrderId}/chat/typing`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, userName, isTyping }),
    });
  } catch (error) {
    console.error('Error sending typing indicator:', error);
  }
}

/**
 * Disconnect Pusher client (cleanup)
 */
export function disconnectPusher(): void {
  if (pusherClient) {
    pusherClient.disconnect();
    pusherClient = null;
  }
}

