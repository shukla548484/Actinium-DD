import { ActiniumLoaderOverlay } from "@/components/ui/ActiniumLoader";

/** Next.js route-level fallback — shown while server components for a segment load. */
export default function RootLoading() {
  return <ActiniumLoaderOverlay label="Loading page…" />;
}
