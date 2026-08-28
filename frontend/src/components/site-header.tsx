import Link from "next/link";
import { Compass } from "lucide-react";

export function SiteHeader({ children }: { children?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-30 border-b border-paper-200 bg-paper-50/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-2xl items-center justify-between gap-3 px-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-forest-700 text-paper-50">
            <Compass className="h-4 w-4" />
          </span>
          <span className="font-display text-lg leading-none text-paper-900">Waypoint</span>
        </Link>
        {children}
      </div>
    </header>
  );
}
