import ActiniumLoader from "@/components/ActiniumLoader";

type Props = {
  /** Shown under the Actinium anchor */
  text?: string;
  className?: string;
};

/**
 * Full-width centered loader for Purchase routes (`loading.tsx`) and in-page bootstrapping.
 */
export default function PurchaseRouteLoading({ text = "Loading Purchase…", className }: Props) {
  return (
    <div
      className={`flex min-h-[calc(100vh-14rem)] w-full flex-col items-center justify-center py-16 ${className ?? ""}`}
    >
      <ActiniumLoader size="lg" text={text} />
    </div>
  );
}
