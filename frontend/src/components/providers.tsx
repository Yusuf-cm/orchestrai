"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Toaster } from "sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Case state changes only when the user acts, so polling would add
            // load and UI flicker without telling us anything new.
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: "white",
            border: "1px solid var(--color-paper-200)",
            color: "var(--color-paper-900)",
            borderRadius: "12px",
          },
        }}
      />
    </QueryClientProvider>
  );
}
