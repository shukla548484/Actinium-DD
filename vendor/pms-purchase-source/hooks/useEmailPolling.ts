import { useEffect, useRef } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { subscribePageReady } from '@/lib/page-ready-coordinator';

function isClientEmailPollingEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  if (process.env.NEXT_PUBLIC_GMAIL_POLLING_ENABLED === 'true') return true;
  if (process.env.NEXT_PUBLIC_GMAIL_POLLING_ENABLED === 'false') return false;
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0') return false;
  return true;
}

/**
 * Hook to automatically poll for new emails every 10 minutes when user is logged in
 * Only processes emails related to user's assigned vessels
 */
export function useEmailPolling() {
  const { isAuthenticated, user } = useAuth();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const initialPollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isClientEmailPollingEnabled()) {
      return;
    }

    if (!isAuthenticated || !user) {
      // Clear interval if user logs out
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (initialPollTimeoutRef.current) {
        clearTimeout(initialPollTimeoutRef.current);
        initialPollTimeoutRef.current = null;
      }
      return;
    }

    // Verify authentication is ready by checking if we can access a protected endpoint
    const verifyAuthReady = async (): Promise<boolean> => {
      try {
        const response = await fetch('/api/auth/me', {
          method: 'GET',
          credentials: 'include',
        });
        // Check if response is OK and is JSON (not a redirect to login page)
        if (response.ok) {
          const contentType = response.headers.get('content-type') || '';
          return contentType.includes('application/json');
        }
        return false;
      } catch {
        return false;
      }
    };

    // Function to poll for new emails and process quote responses
    const pollEmails = async () => {
      try {
        // Add timeout to prevent hanging
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          controller.abort();
        }, 10000); // 10 second timeout

        // First, fetch new emails
        let pollResponse: Response;
        try {
          pollResponse = await fetch('/api/emails/poll', {
            method: 'GET',
            credentials: 'include',
            signal: controller.signal,
          });
          clearTimeout(timeoutId);
        } catch (fetchError: any) {
          clearTimeout(timeoutId);
          if (fetchError.name === 'AbortError') {
            // Timeout - silently skip this poll
            return;
          }
          // Network error or other fetch error
          console.warn('Email polling fetch error:', fetchError.message);
          return;
        }

        // Check if response is JSON before parsing
        const contentType = pollResponse.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          // If not JSON, try to read as text to see what we got
          try {
            const text = await pollResponse.text();
            // If it's an HTML response (likely redirect or error page), skip silently
            if (text.trim().startsWith('<!') || text.includes('<html')) {
              console.warn('Email polling returned HTML response (likely unauthenticated), skipping');
              return;
            }
            // If it's plain text error, log but don't throw
            console.warn('Email polling returned non-JSON response:', text.substring(0, 100));
            return;
          } catch (textError) {
            // Can't read response, skip silently
            return;
          }
        }

        // Only parse JSON if we have a JSON response
        if (pollResponse.ok) {
          try {
            const pollData = await pollResponse.json();
            if (pollData?.skipped || pollData?.gmailUnavailable) {
              return;
            }
            if (pollData && typeof pollData === 'object' && pollData.count > 0) {
              console.log(`📧 Found ${pollData.count} new email(s) for your assigned vessels`);
            }

            // Process pending quote imports even when Gmail returned 0 new messages.
            try {
              const processController = new AbortController();
              const processTimeoutId = setTimeout(() => {
                processController.abort();
              }, 120000);

              const processResponse = await fetch('/api/quotes/process-responses', {
                method: 'POST',
                credentials: 'include',
                signal: processController.signal,
              });

              clearTimeout(processTimeoutId);

              if (processResponse.ok) {
                const processContentType = processResponse.headers.get('content-type');
                if (processContentType && processContentType.includes('application/json')) {
                  try {
                    const processData = await processResponse.json();
                    if (processData && processData.processed > 0) {
                      console.log(
                        `✅ Auto-processed ${processData.processed} quote response(s)`
                      );
                    }
                  } catch {
                    console.warn('Error parsing process response JSON');
                  }
                }
              }
            } catch (processError: any) {
              if (processError.name !== 'AbortError') {
                console.warn('Error processing quote responses:', processError.message);
              }
            }
          } catch (jsonError: any) {
            // Better error handling for JSON parse errors
            if (jsonError.message && jsonError.message.includes('JSON')) {
              console.warn('Email polling JSON parse error - response may not be valid JSON');
            } else {
              console.warn('Error parsing email polling response:', jsonError.message);
            }
            // Don't show error to user, just log it
          }
        } else {
          // Skip logging for 401 (many users don't have email polling access)
          if (pollResponse.status === 401) return;
          if (contentType.includes('application/json')) {
            try {
              const errorData = await pollResponse.json();
              if (errorData.error) {
                console.warn('Email polling error:', errorData.error);
              }
            } catch (e) {
              // Ignore JSON parse errors for error responses
            }
          }
        }
      } catch (error: any) {
        if (error.name !== 'AbortError') {
          // Only log non-abort errors, and make them warnings instead of errors
          console.warn('Error polling emails:', error.message || error);
        }
        // Don't show error to user, just log it
      }
    };

    let started = false;
    const startPolling = async () => {
      if (started) return;
      started = true;
      const isReady = await verifyAuthReady();
      if (!isReady) return;
      void pollEmails();
      intervalRef.current = setInterval(() => {
        if (typeof document !== "undefined" && document.visibilityState === "hidden") {
          return;
        }
        void pollEmails();
      }, 10 * 60 * 1000);
    };

    const fallback = setTimeout(() => {
      void startPolling();
    }, 15000);
    const pageReadyUnsub = subscribePageReady(() => {
      clearTimeout(fallback);
      void startPolling();
    });

    // Cleanup on unmount or logout
    return () => {
      clearTimeout(fallback);
      pageReadyUnsub();
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (initialPollTimeoutRef.current) {
        clearTimeout(initialPollTimeoutRef.current);
        initialPollTimeoutRef.current = null;
      }
    };
  }, [isAuthenticated, user]);

  return null; // This hook doesn't return anything
}

