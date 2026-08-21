import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@gorth/primitive/custom/avatar"
import { Dot } from "@gorth/primitive/cores/lucide"
import { Spinner } from "@gorth/primitive/pattern/spinner"
import { getInitials } from "@/lib/utils/formatter"

interface ConversationItemProps {
  name: string
  description: string
  avatar?: string | null
  date?: string
  unread?: boolean
  pending?: boolean
}

export function ConversationItem({
  name,
  description,
  avatar,
  date,
  unread = false,
  pending = false,
}: ConversationItemProps) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3 overflow-hidden">
      <Avatar>
        <AvatarImage src={avatar ?? undefined} alt={name} />
        <AvatarFallback>{getInitials(name)}</AvatarFallback>
      </Avatar>
      <div className="w-0 min-w-0 flex-1 overflow-hidden text-left">
        <div className="flex min-w-0 items-center gap-2 overflow-hidden">
          <span className="min-w-0 flex-1 truncate font-medium">{name}</span>
          {date ? (
            <span className="text-muted-foreground ml-auto shrink-0 text-xs">
              {date}
            </span>
          ) : null}
        </div>
        <div className="flex min-w-0 items-center">
          <span className="text-muted-foreground min-w-0 flex-1 truncate text-xs">
            {description}
          </span>
          {unread ? (
            <Dot className="text-primary size-4 shrink-0" aria-label="Unread" />
          ) : null}
          {pending ? (
            <Spinner variant="infinite" size={16} className="shrink-0" />
          ) : null}
        </div>
      </div>
    </div>
  )
}
