import type { LucideIcon } from "@gorth/primitive/cores/lucide"
import { Spinner } from "@gorth/primitive/pattern/spinner"
import { cn } from "@/lib/utils"

interface ConversationStateProps {
  title?: string
  description?: string
  icon?: LucideIcon
  loading?: boolean
  className?: string
}

export function ConversationState({
  title,
  description,
  icon: Icon,
  loading = false,
  className,
}: ConversationStateProps) {
  return (
    <div
      className={cn(
        "flex min-h-40 w-full flex-col items-center justify-center gap-3 p-6 text-center",
        className
      )}
    >
      {loading ? (
        <Spinner variant="infinite" size={32} />
      ) : Icon ? (
        <span className="bg-muted flex size-12 items-center justify-center rounded-md">
          <Icon className="size-5" />
        </span>
      ) : null}
      {title || description ? (
        <div className="space-y-1">
          {title ? <p className="text-sm font-medium">{title}</p> : null}
          {description ? (
            <p className="text-muted-foreground text-xs leading-5">
              {description}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
