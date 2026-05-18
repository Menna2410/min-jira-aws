import { cn } from "@/lib/utils";

export function Separator({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("h-px w-full shrink-0 bg-zinc-800", className)} role="presentation" {...props} />;
}
