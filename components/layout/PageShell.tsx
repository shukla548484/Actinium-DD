import { cn } from "@/lib/utils";

export { PageHeader } from "@/components/layout/PageHeader";

type PageShellProps = {
  children: React.ReactNode;
  className?: string;
  /**
   * default/wide = 95% of the main content pane (beside sidebar when present).
   * full = edge-to-edge padding only.
   */
  size?: "default" | "wide" | "full";
};

/** Standard page container — matches shadcn spacing (p-4 md:p-6, space-y-6). */
export function PageShell({ children, className, size = "default" }: PageShellProps) {
  return (
    <div
      className={cn(
        "space-y-6 p-4 pb-10 md:p-6 md:pb-12",
        size === "full" ? "mx-auto w-full max-w-none" : "dd-content-width",
        className,
      )}
    >
      {children}
    </div>
  );
}
