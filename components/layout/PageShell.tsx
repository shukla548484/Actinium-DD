import { cn } from "@/lib/utils";

export { PageHeader } from "@/components/layout/PageHeader";

type PageShellProps = {
  children: React.ReactNode;
  className?: string;
  /** default = max-w-6xl, wide = tender matrix width, full = edge-to-edge padding only */
  size?: "default" | "wide" | "full";
};

/** Standard page container — matches shadcn spacing (p-4 md:p-6, space-y-6). */
export function PageShell({ children, className, size = "default" }: PageShellProps) {
  return (
    <div
      className={cn(
        "mx-auto w-full space-y-6 p-4 pb-10 md:p-6 md:pb-12",
        size === "default" && "max-w-6xl",
        size === "wide" && "max-w-[100rem]",
        size === "full" && "max-w-none",
        className,
      )}
    >
      {children}
    </div>
  );
}
