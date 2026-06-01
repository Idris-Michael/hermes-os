import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "./index.css";
import App from "./App";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Polling pauses when the tab is hidden — same guarantee as useInterval.
      refetchIntervalInBackground: false,
      refetchOnWindowFocus: false,
      // Don't refetch on every mount; let staleTime + explicit refetch govern.
      // Without this, StrictMode + lazy-loaded pages double-fetch on mount.
      refetchOnMount: false,
      retry: 1,
      staleTime: 30_000,
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>
);
