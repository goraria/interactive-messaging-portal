"use client";
import { useState } from "react";
import { Button } from "@gorth-com/primitive/custom/button";
import { Input } from "@gorth-com/primitive/default/input";
import { cn } from "@gorth-com/primitive/cores/cn";
import { Dot, RotateCcw } from "@gorth-com/primitive/cores/lucide";
import {
  changeMessengerMessage,
  reactMessengerMessage,
  reportMessengerMessage,
} from "@/queries/messenger";
import { useUser } from "@/hooks/use-user";
import type { ChatMessage } from "@/hooks/use-conversation";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@gorth-com/primitive/custom/avatar";
import {
  Bubble,
  BubbleContent,
  BubbleGroup,
  BubbleReactions,
} from "@gorth-com/primitive/default/bubble";
import {
  Message as MessageRoot,
  MessageAvatar,
  MessageContent,
  MessageFooter,
  MessageHeader,
} from "@gorth-com/primitive/default/message";
import { formatMessageTime, getInitials } from "@/utils/client/formatter";
import { useNetworkErrorToast } from "@/hooks/use-network-error-toast";

interface MessageProps {
  message: ChatMessage;
  isOwnMessage: boolean;
  showHeader: boolean;
  showAvatar: boolean;
  showFooter?: boolean;
  showDeliveryStatus?: boolean;
  failed?: boolean;
  onRetry?: () => void;
  avatar?: string | null;
  pending?: boolean;
  onChange?: (message: ChatMessage) => void;
}

export function Message({
  message,
  isOwnMessage,
  showHeader,
  showAvatar,
  showFooter = true,
  showDeliveryStatus = true,
  failed = false,
  onRetry,
  avatar,
  pending = false,
  onChange,
}: MessageProps) {
  const { user } = useUser();
  const [editing, setEditing] = useState(false);
  const [editingVersion, setEditingVersion] = useState(message.version);
  const [draft, setDraft] = useState(message.content);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const networkError = useNetworkErrorToast(error);
  const [removing, setRemoving] = useState(false);
  const deliveryStatus = failed
    ? "Error"
    : pending
      ? "Sending"
      : message.receipts.some(
            (receipt) =>
              receipt.status === "read" && receipt.userId !== message.user.id,
          )
        ? "Read"
        : message.receipts.some((receipt) => receipt.userId !== message.user.id)
          ? "Delivered"
          : "Sent";
  const act = async (operation: () => Promise<ChatMessage>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      onChange?.(await operation());
      setEditing(false);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to update message",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <MessageRoot
      id={"message-" + message.id}
      align={isOwnMessage ? "end" : "start"}
      data-state={removing ? "leaving" : "visible"}
      className={cn(
        "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-200 motion-reduce:transition-none",
        "transition-[opacity,transform] duration-200 ease-out",
        removing && "translate-y-1 scale-[0.98] opacity-0",
      )}
    >
      <MessageAvatar
        aria-hidden={!showAvatar}
        className={cn(
          "self-start rounded-md group-has-data-[slot=message-footer]/message:translate-y-0",
          !showAvatar && "invisible",
        )}
      >
        <Avatar className="size-9 rounded-md">
          <AvatarImage
            src={avatar ?? undefined}
            alt={message.user.name}
            className="rounded-md"
          />
          <AvatarFallback className="rounded-md">
            {getInitials(message.user.name)}
          </AvatarFallback>
        </Avatar>
      </MessageAvatar>
      <MessageContent className="relative gap-1">
        {showHeader ? (
          <MessageHeader className="sr-only">{message.user.name}</MessageHeader>
        ) : null}
        <BubbleGroup className="gap-2">
          <Bubble
            variant={isOwnMessage ? "default" : "muted"}
            align={isOwnMessage ? "end" : "start"}
            className="max-w-[min(100%,36rem)]"
          >
            <BubbleContent
              key={message.deletedAt ? "deleted" : "content"}
              className="flex min-h-9 min-w-9 items-center rounded-md px-3 py-2 leading-5 whitespace-pre-wrap [overflow-wrap:anywhere] motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
            >
              {message.deletedAt ? (
                <em>Message deleted</em>
              ) : editing ? (
                <div className="space-y-2">
                  <Input
                    aria-label="Edit message"
                    value={draft}
                    maxLength={4000}
                    onChange={(event) => setDraft(event.target.value)}
                  />
                  <Button
                    disabled={busy || !draft.trim()}
                    onClick={() =>
                      void act(() =>
                        changeMessengerMessage(message.id, {
                          content: draft,
                          version: editingVersion,
                        }),
                      )
                    }
                  >
                    Save
                  </Button>
                  <Button variant="ghost" onClick={() => setEditing(false)}>
                    Cancel
                  </Button>
                </div>
              ) : (
                message.content || (pending ? "Sending attachment" : "")
              )}
            </BubbleContent>
            {!message.deletedAt && !pending && message.reactions.length ? (
              <BubbleReactions
                aria-label="Message reactions"
                align={isOwnMessage ? "start" : "end"}
              >
                {message.reactions.map((reaction) => (
                  <Button
                    key={reaction.id}
                    size="sm"
                    variant={
                      reaction.userId === user?.id ? "secondary" : "ghost"
                    }
                    disabled={busy}
                    aria-label={`React ${reaction.emoji}`}
                    onClick={() =>
                      void act(() =>
                        reactMessengerMessage(
                          message.id,
                          reaction.emoji,
                          reaction.userId === user?.id,
                        ),
                      )
                    }
                  >
                    {reaction.emoji}
                  </Button>
                ))}
              </BubbleReactions>
            ) : null}
          </Bubble>
          {!message.deletedAt
            ? message.attachments.map((attachment) => (
                <Bubble
                  key={attachment.id}
                  variant={isOwnMessage ? "default" : "muted"}
                  align={isOwnMessage ? "end" : "start"}
                  className="max-w-[min(100%,24rem)]"
                >
                  <BubbleContent className="flex flex-col gap-2 rounded-md">
                    {attachment.mimeType?.startsWith("image/") ? (
                      // Authenticated same-origin image requests must carry the browser cookie.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={attachment.fileUrl}
                        alt={attachment.fileName}
                        loading="lazy"
                        className="max-h-72 rounded-md object-contain"
                      />
                    ) : attachment.mimeType?.startsWith("audio/") ? (
                      <audio controls preload="none" src={attachment.fileUrl} />
                    ) : attachment.mimeType?.startsWith("video/") ? (
                      <video
                        controls
                        preload="none"
                        src={attachment.fileUrl}
                        className="max-h-72"
                      />
                    ) : null}
                    <a
                      href={attachment.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="break-all text-sm underline"
                    >
                      {attachment.fileName}
                    </a>
                  </BubbleContent>
                </Bubble>
              ))
            : null}
        </BubbleGroup>
        {showFooter ? (
          <MessageFooter
            className={cn(
              "h-5 items-center gap-0 leading-5",
              isOwnMessage
                ? "self-end justify-end"
                : "self-start justify-start",
            )}
          >
            {isOwnMessage && showDeliveryStatus ? (
              <>
                <span role={pending || failed ? "status" : undefined}>
                  {deliveryStatus}
                </span>
                {failed && onRetry ? (
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="mx-1 size-5 p-0"
                    aria-label="Resend message"
                    onClick={onRetry}
                  >
                    <RotateCcw className="size-4" />
                  </Button>
                ) : (
                  <Dot className="size-4" aria-hidden="true" />
                )}
              </>
            ) : null}
            <time dateTime={message.createdAt}>
              {formatMessageTime(message.createdAt)}
            </time>
          </MessageFooter>
        ) : null}
        {!message.deletedAt && !pending ? (
          <div
            className={cn(
              "absolute bottom-full z-10 flex items-center gap-1 rounded-md bg-background opacity-0 transition-opacity group-hover/message:opacity-100 focus-within:opacity-100 motion-reduce:transition-none",
              isOwnMessage ? "right-0" : "left-0",
            )}
          >
            <select
              aria-label="React to message"
              value=""
              disabled={busy}
              onChange={(event) => {
                if (event.target.value)
                  void act(() =>
                    reactMessengerMessage(message.id, event.target.value),
                  );
              }}
              className="bg-transparent text-xs"
            >
              <option value="">React</option>
              {["👍", "❤️", "😂", "😮", "😢", "🙏"].map((emoji) => (
                <option key={emoji}>{emoji}</option>
              ))}
            </select>
            {isOwnMessage ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setDraft(message.content);
                    setEditingVersion(message.version);
                    setEditing(true);
                  }}
                >
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() => {
                    if (window.confirm("Delete this message for everyone?"))
                      void act(async () => {
                        setRemoving(true);
                        try {
                          const [changed] = await Promise.all([
                            changeMessengerMessage(message.id, null),
                            new Promise((resolve) => setTimeout(resolve, 200)),
                          ]);
                          return changed;
                        } finally {
                          setRemoving(false);
                        }
                      });
                  }}
                >
                  Delete
                </Button>
              </>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => {
                  const reason = window.prompt(
                    "Reason for reporting this message",
                  );
                  if (reason) {
                    setBusy(true);
                    void reportMessengerMessage(message.id, reason)
                      .then(() => setError("Report submitted"))
                      .catch(() => setError("Unable to submit report"))
                      .finally(() => setBusy(false));
                  }
                }}
              >
                Report
              </Button>
            )}
          </div>
        ) : null}
        {error && !networkError ? (
          <p role="status" className="text-xs">
            {error}
          </p>
        ) : null}
      </MessageContent>
    </MessageRoot>
  );
}
