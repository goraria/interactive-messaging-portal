import { cn } from "@gorth/primitive/lib/utils"
import { Spinner } from "@gorth/primitive/pattern/spinner"

export interface LoadingScreenProps {
  className?: string
}

export function LoadingScreen({ className }: LoadingScreenProps) {
  return (
    <div
      aria-label="Loading"
      aria-live="polite"
      className={cn(
        "fixed inset-0 z-[9999] flex h-[100vh] min-h-[100vh] w-screen items-center justify-center overflow-hidden bg-transparent",
        className
      )}
      role="status"
      style={{ height: "100vh", minHeight: "100vh" }}
    >
      <Spinner aria-hidden="true" size={32} variant="infinite" />
      <span className="sr-only">Loading...</span>
    </div>
  )
}
