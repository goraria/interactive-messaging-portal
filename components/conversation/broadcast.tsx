"use client";

import { FormEvent, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  messengerBuckets,
  uploadMessengerFile,
  readMessengerMessage,
} from "@/queries/messenger";
import { Button } from "@gorth-com/primitive/custom/button";
import { Input } from "@gorth-com/primitive/default/input";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@gorth-com/primitive/custom/message-scroller";
import {
  CirclePlus,
  ImagePlus,
  MessageCircleOff,
  Paperclip,
  SendHorizonal,
  Mic,
  Square,
} from "@gorth-com/primitive/cores/lucide";
import { useLayout } from "@gorth-com/primitive/providers/layout";
import { type ChatMessage, useBroadcast } from "@/hooks/use-conversation";
import { Message } from "@/components/conversation/message";
import { ConversationState } from "@/components/conversation/conversation-state";
import { cn } from "@gorth-com/primitive/cores/cn";
import {
  getLastReadBlockIndex,
  shouldShowHeader,
  shouldShowFooter,
} from "@/utils/conversation";
import { useNetworkErrorToast } from "@/hooks/use-network-error-toast";

interface BroadcastProps {
  conversationId: string;
  username: string;
  userId?: string;
  userAvatars?: Record<string, string | null>;
  onMessage?: (messages: ChatMessage[]) => void | Promise<void>;
  canSend?: boolean;
  onSignIn?: () => void;
  className?: string;
}

export function Broadcast({
  conversationId,
  username,
  userId,
  userAvatars = {},
  onMessage,
  canSend = true,
  onSignIn,
  className,
}: BroadcastProps) {
  const { variant, width } = useLayout();
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const [assets, setAssets] = useState<{ assetId: string; name: string }[]>([]);
  const [buckets, setBuckets] = useState<{ id: string; name: string }[]>([]);
  const [bucket, setBucket] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const uploadAbort = useRef<AbortController | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const alive = useRef(true);
  const lastRead = useRef("");
  const viewport = useRef<HTMLDivElement | null>(null);
  const scrollRestore = useRef<{ height: number; top: number } | null>(null);
  const submittedAssetIds = useRef<string[]>([]);
  const {
    messages,
    loading,
    sending,
    pendingMessage,
    sendFailed,
    retryMessage,
    error,
    realtimeReady,
    realtimeError,
    sendMessage,
    loadOlder,
    hasOlder,
    loadingOlder,
    append,
  } = useBroadcast({ conversationId, username, userId, onMessage });
  const networkError = useNetworkErrorToast(
    error ?? (realtimeError ? "Network connection lost" : null),
  );
  const uploadNetworkError = useNetworkErrorToast(uploadError);
  useLayoutEffect(() => {
    const target = viewport.current,
      previous = scrollRestore.current;
    if (target && previous) {
      target.scrollTop = previous.top + target.scrollHeight - previous.height;
      scrollRestore.current = null;
    }
  }, [messages]);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      uploadAbort.current?.abort();
      if (recorder.current && recorder.current.state !== "inactive")
        recorder.current.stop();
      stream.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);
  useEffect(() => {
    const guard = (event: BeforeUnloadEvent) => {
      if (value.trim() || assets.length || recording || sending) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [value, assets.length, recording, sending]);
  useEffect(() => {
    const last = messages.findLast((message) => message.user.id !== userId);
    const acknowledge = () => {
      if (
        !last ||
        !userId ||
        last.id === lastRead.current ||
        document.visibilityState !== "visible" ||
        last.receipts.some(
          (receipt) => receipt.userId === userId && receipt.status === "read",
        )
      )
        return;
      lastRead.current = last.id;
      void readMessengerMessage(last.id).catch(() => {
        if (lastRead.current === last.id) lastRead.current = "";
      });
    };
    acknowledge();
    document.addEventListener("visibilitychange", acknowledge);
    window.addEventListener("focus", acknowledge);
    return () => {
      document.removeEventListener("visibilitychange", acknowledge);
      window.removeEventListener("focus", acknowledge);
    };
  }, [messages, userId]);
  async function upload(file: File) {
    if (progress !== null || assets.length >= 10) return;
    setUploadError(null);
    if (file.size > 25 * 1024 * 1024) {
      setUploadError("Files must be 25 MB or smaller");
      return;
    }
    const controller = new AbortController();
    uploadAbort.current = controller;
    setProgress(0);
    try {
      let selected = bucket;
      if (!selected) {
        const available = await messengerBuckets();
        setBuckets(available);
        selected = available[0]?.id ?? "";
        setBucket(selected);
      }
      if (!selected)
        throw new Error("No Chat storage bucket has been configured");
      const result = await uploadMessengerFile(
        conversationId,
        selected,
        file,
        controller.signal,
        (p) => {
          if (alive.current) setProgress(p);
        },
      );
      if (alive.current) setAssets((current) => [...current, result]);
    } catch (cause) {
      if (alive.current)
        setUploadError(
          cause instanceof Error ? cause.message : "Upload failed",
        );
    } finally {
      if (alive.current) setProgress(null);
    }
  }
  async function toggleRecording() {
    if (recording) {
      recorder.current?.stop();
      return;
    }
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!alive.current) {
        media.getTracks().forEach((t) => t.stop());
        return;
      }
      stream.current = media;
      const type = ["audio/webm", "audio/ogg", "audio/mp4"].find((t) =>
        MediaRecorder.isTypeSupported(t),
      );
      if (!type) {
        media.getTracks().forEach((t) => t.stop());
        throw new Error("Voice recording is unsupported in this browser");
      }
      const instance = new MediaRecorder(media, { mimeType: type });
      recorder.current = instance;
      const chunks: Blob[] = [];
      let size = 0;
      const timer = setTimeout(() => {
        if (instance.state === "recording") instance.stop();
      }, 300000);
      instance.ondataavailable = (event) => {
        chunks.push(event.data);
        size += event.data.size;
        if (size > 25 * 1024 * 1024 && instance.state === "recording")
          instance.stop();
      };
      instance.onstop = () => {
        clearTimeout(timer);
        media.getTracks().forEach((t) => t.stop());
        if (alive.current) {
          setRecording(false);
          void upload(
            new File(chunks, `voice-${Date.now()}.${type.split("/")[1]}`, {
              type,
            }),
          );
        }
      };
      instance.start(1000);
      setRecording(true);
    } catch (cause) {
      stream.current?.getTracks().forEach((track) => track.stop());
      setRecording(false);
      setUploadError(
        cause instanceof Error ? cause.message : "Microphone unavailable",
      );
    }
  }
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSend) {
      onSignIn?.();
      return;
    }

    submittedAssetIds.current = assets.map((asset) => asset.assetId);
    const sent = await sendMessage(
      value,
      assets.map((asset) => asset.assetId),
    );

    if (sent) {
      setValue("");
      setAssets([]);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }

  const displayedMessages = pendingMessage
    ? [...messages, pendingMessage]
    : messages;
  const lastReadBlockIndex = getLastReadBlockIndex(displayedMessages, userId);

  return (
    <section
      className={cn(
        "flex min-h-0 flex-1 flex-col",
        variant === "sidebar" && "bg-background border-x border-b",
        variant === "floating" && "gap-2 bg-transparent",
        variant === "inset" && "bg-background overflow-hidden",
        className,
      )}
    >
      <MessageScrollerProvider autoScroll defaultScrollPosition="end">
        <MessageScroller
          className={cn(
            "min-h-0 flex-1",
            variant === "floating" &&
              "bg-background overflow-hidden rounded-lg shadow-sm ring-1 ring-sidebar-border",
          )}
        >
          <MessageScrollerViewport ref={viewport} className="min-h-0 flex-1">
            <MessageScrollerContent
              className={cn(
                "gap-3",
                width === "narrow"
                  ? "container mx-auto px-6 py-6"
                  : "p-4 sm:p-6",
              )}
            >
              {hasOlder ? (
                <Button
                  variant="outline"
                  disabled={loadingOlder}
                  onClick={() => {
                    if (viewport.current)
                      scrollRestore.current = {
                        height: viewport.current.scrollHeight,
                        top: viewport.current.scrollTop,
                      };
                    void loadOlder();
                  }}
                >
                  {loadingOlder ? "Loading…" : "Load older messages"}
                </Button>
              ) : null}
              {loading ? (
                <ConversationState loading />
              ) : displayedMessages.length === 0 ? (
                <ConversationState
                  icon={MessageCircleOff}
                  title="No messages yet"
                  description="Send a message to start the conversation."
                />
              ) : (
                displayedMessages.map((message, index) => {
                  const showIdentity = shouldShowHeader(
                    displayedMessages,
                    index,
                  );
                  const isOwnMessage = Boolean(
                    userId && message.user.id === userId,
                  );

                  return (
                    <MessageScrollerItem
                      key={message.clientMessageId ?? message.id}
                      messageId={message.id}
                    >
                      <Message
                        message={message}
                        pending={message.id === pendingMessage?.id}
                        failed={message.id === pendingMessage?.id && sendFailed}
                        onRetry={() => {
                          const retriedAssetIds = [
                            ...submittedAssetIds.current,
                          ];
                          void retryMessage().then((sent) => {
                            if (sent) {
                              setValue((current) =>
                                current.trim() === message.content
                                  ? ""
                                  : current,
                              );
                              setAssets((current) =>
                                current.filter(
                                  (asset) =>
                                    !retriedAssetIds.includes(asset.assetId),
                                ),
                              );
                            }
                          });
                        }}
                        showFooter={shouldShowFooter(displayedMessages, index)}
                        showDeliveryStatus={index >= lastReadBlockIndex}
                        isOwnMessage={isOwnMessage}
                        showHeader={showIdentity}
                        showAvatar={showIdentity}
                        avatar={userAvatars[message.user.id]}
                        onChange={(changed) => append([changed])}
                      />
                    </MessageScrollerItem>
                  );
                })
              )}
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton
            direction="end"
            aria-label="Scroll to latest messages"
          />
        </MessageScroller>
      </MessageScrollerProvider>
      {uploadError && !uploadNetworkError ? (
        <p role="alert" className="px-6 text-sm text-destructive">
          {uploadError}
        </p>
      ) : null}
      {progress !== null ? (
        <div className="flex items-center gap-2 px-6">
          <progress value={progress} max={100} aria-label="Upload progress" />
          <span>{progress}%</span>
          <Button variant="ghost" onClick={() => uploadAbort.current?.abort()}>
            Cancel
          </Button>
        </div>
      ) : null}
      {assets.length ? (
        <div className="flex flex-wrap gap-2 px-6">
          {assets.map((asset) => (
            <Button
              key={asset.assetId}
              variant="outline"
              onClick={() =>
                setAssets((current) =>
                  current.filter((item) => item.assetId !== asset.assetId),
                )
              }
            >
              {asset.name} ×
            </Button>
          ))}
        </div>
      ) : null}
      {buckets.length > 1 ? (
        <select
          aria-label="Storage bucket"
          value={bucket}
          onChange={(event) => setBucket(event.target.value)}
        >
          {buckets.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      ) : null}

      {error && !networkError ? (
        <div
          className={cn(
            "bg-destructive/10 text-destructive px-4 py-2 text-sm",
            variant !== "floating" && "border-t",
            variant === "floating" && "rounded-lg ring-1 ring-destructive/30",
          )}
        >
          {error}
        </div>
      ) : null}

      <form
        onSubmit={handleSubmit}
        autoComplete="off"
        className={cn(
          "bg-background shrink-0",
          variant === "sidebar" && "border-t",
          variant === "floating" &&
            "rounded-lg shadow-sm ring-1 ring-sidebar-border",
          variant === "inset" && "rounded-b-xl border-t",
        )}
      >
        <div
          className={cn(
            "flex w-full items-center gap-1 py-3",
            width === "narrow" ? "container mx-auto px-6" : "px-3",
          )}
        >
          <input
            ref={imageInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void upload(file);
            }}
            className="sr-only"
            tabIndex={-1}
          />
          <input
            ref={attachmentInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,text/plain,audio/webm,audio/ogg,audio/mp4,video/mp4,video/webm"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void upload(file);
            }}
            className="sr-only"
            tabIndex={-1}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Add content"
            disabled={!canSend || sending || progress !== null}
            onClick={() => attachmentInputRef.current?.click()}
          >
            <CirclePlus />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Add image"
            disabled={!canSend || sending || progress !== null}
            onClick={() => imageInputRef.current?.click()}
          >
            <ImagePlus />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Attach file"
            disabled={!canSend || sending || progress !== null}
            onClick={() => attachmentInputRef.current?.click()}
          >
            <Paperclip />
          </Button>
          <Button
            type="button"
            variant={recording ? "destructive" : "ghost"}
            size="icon"
            aria-label={recording ? "Stop recording" : "Record voice message"}
            disabled={!canSend || sending || progress !== null}
            onClick={() => void toggleRecording()}
          >
            {recording ? <Square /> : <Mic />}
          </Button>
          <Input
            ref={inputRef}
            name={`chat-message-${conversationId}`}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder={
              !canSend
                ? onSignIn
                  ? "Sign in to reply"
                  : "Read-only conversation"
                : realtimeReady
                  ? "Type your messages..."
                  : "Connecting realtime..."
            }
            disabled={sending || !canSend || !realtimeReady}
            maxLength={4000}
            className="text-primary min-w-0 flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0"
          />
          <Button
            type="submit"
            variant={realtimeError ? "destructive" : "ghost"}
            size="icon"
            aria-label={
              canSend
                ? "Send message"
                : onSignIn
                  ? "Sign in"
                  : "Read-only conversation"
            }
            disabled={
              sending ||
              (!canSend && !onSignIn) ||
              progress !== null ||
              recording ||
              (canSend && !value.trim() && !assets.length)
            }
          >
            <SendHorizonal />
          </Button>
        </div>
      </form>
    </section>
  );
}
