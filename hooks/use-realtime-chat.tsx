"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@gorth-com/primitive/cores/tanstack/query";
import { subscribeConversation } from "@/lib/realtime/client";
import { chatQueryKeys } from "@/queries/chat";
import * as api from "@/queries/messenger";
import type { MessengerMessage } from "@/schemas/client/messenger";
import { mergeChatMessages } from "@/utils/messenger";
export type ChatMessage = MessengerMessage;
export function useRealtimeChat({
  conversationId,
  username,
  userId,
  onMessage,
}: {
  conversationId: string;
  username: string;
  userId?: string;
  onMessage?: (messages: ChatMessage[]) => void | Promise<void>;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [pendingMessage, setPendingMessage] = useState<ChatMessage | null>(
    null,
  );
  const [sendFailed, setSendFailed] = useState(false);
  const retryPayload = useRef<{ content: string; assetIds: string[] } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [realtimeError, setRealtimeError] = useState(false);
  const queryClient = useQueryClient();
  const replayCursor = useRef("0");
  const generation = useRef(0);
  const pending = useRef<{ key: string; id: string } | null>(null);
  const sendBusy = useRef(false);
  const callback = useRef(onMessage);
  useEffect(() => {
    callback.current = onMessage;
  }, [onMessage]);
  const append = useCallback((rows: ChatMessage[]) => {
    setMessages((current) => mergeChatMessages(current, rows));
    void callback.current?.(rows);
  }, []);
  useEffect(() => {
    const token = ++generation.current;
    let stopped = false,
      busy = false,
      refreshAgain = false,
      initialized = false,
      realtimeConnected = false,
      accessRevoked = false;
    queueMicrotask(() => {
      if (!stopped) {
        setPendingMessage(null);
        setSendFailed(false);
        retryPayload.current = null;
        pending.current = null;
        setRealtimeError(false);
      }
    });
    const refresh = async () => {
      if (stopped || accessRevoked) return;
      if (busy) {
        refreshAgain = true;
        return;
      }
      busy = true;
      try {
        if (!initialized) {
          const page = await api.messengerPage(conversationId);
          if (stopped) return;
          setMessages(page.data);
          setNextCursor(page.pagination.nextCursor);
          replayCursor.current = page.eventCursor;
          initialized = true;
          setLoading(false);
        }
        for (let batch = 0; batch < 10; batch++) {
          const events = await api.messengerEvents(
            conversationId,
            replayCursor.current,
          );
          if (stopped) return;
          const entityIds = new Set(
            events
              .filter((event) =>
                /^(message|reaction|receipt)\./.test(event.type),
              )
              .map((event) => event.entityId),
          );
          const ids = [...entityIds];
          for (let offset = 0; offset < ids.length; offset += 8) {
            const rows = await Promise.all(
              ids.slice(offset, offset + 8).map(async (entityId) => {
                try {
                  return await api.messengerMessage(entityId);
                } catch (cause) {
                  if ((cause as { status?: number }).status !== 404)
                    throw cause;
                  return null;
                }
              }),
            );
            if (stopped) return;
            append(rows.filter((row): row is ChatMessage => row !== null));
          }
          if (events.length)
            replayCursor.current = events[events.length - 1]!.sequence;
          // Receipts can change this user's unread count; reactions cannot.
          if (
            events.some((event) =>
              /^(message\.|receipt\.|conversation\.|member\.)/.test(event.type),
            )
          )
            void queryClient.invalidateQueries({
              queryKey: chatQueryKeys.conversations,
            });
          if (
            events.some((event) =>
              /^(conversation\.|member\.)/.test(event.type),
            )
          )
            void queryClient.invalidateQueries({
              queryKey: chatQueryKeys.conversation(conversationId),
            });
          if (events.length < 100) break;
          if (batch === 9) refreshAgain = true;
        }
        if (!stopped) setError(null);
      } catch (cause) {
        if (stopped) return;
        const status = (cause as { status?: number }).status;
        if (status === 403 || status === 404 || status === 401) {
          accessRevoked = true;
          setMessages([]);
          initialized = false;
          queryClient.removeQueries({
            queryKey: chatQueryKeys.conversation(conversationId),
          });
        }
        setError(
          cause instanceof Error ? cause.message : "Unable to refresh messages",
        );
        setLoading(false);
      } finally {
        busy = false;
        // A WebSocket invalidation received during an HTTP fetch must not wait for polling.
        if (refreshAgain && !stopped) {
          refreshAgain = false;
          void refresh();
        }
      }
    };
    void refresh();
    const unsubscribe = subscribeConversation({
      conversationId,
      onSignal: () => void refresh(),
      onReady: () => {
        realtimeConnected = true;
        if (!stopped) setRealtimeError(false);
      },
      onUnavailable: () => {
        realtimeConnected = false;
        if (!stopped) setRealtimeError(true);
      },
      onForbidden: () => {
        if (stopped) return;
        setRealtimeError(true);
        setMessages([]);
        accessRevoked = true;
        setError("Your session or conversation access has expired");
      },
    });
    // WebSocket is the normal invalidation path. HTTP polling is outage recovery only.
    const timer = setInterval(() => {
      if (!realtimeConnected && document.visibilityState === "visible")
        void refresh();
    }, 15000);
    const online = () => void refresh();
    window.addEventListener("online", online);
    return () => {
      stopped = true;
      generation.current = token + 1;
      clearInterval(timer);
      window.removeEventListener("online", online);
      unsubscribe();
    };
  }, [conversationId, queryClient, append]);
  const sendMessage = useCallback(
    async (content: string, assetIds: string[] = []) => {
      if (sendBusy.current || (!content.trim() && !assetIds.length))
        return null;
      const token = generation.current;
      const key = JSON.stringify([content.trim(), [...assetIds].sort()]);
      if (pending.current?.key !== key)
        pending.current = { key, id: crypto.randomUUID() };
      sendBusy.current = true;
      setSending(true);
      setSendFailed(false);
      retryPayload.current = { content, assetIds: [...assetIds] };
      if (userId) {
        const now = new Date().toISOString();
        setPendingMessage({
          id: "pending:" + pending.current!.id,
          clientMessageId: pending.current!.id,
          conversationId,
          content: content.trim(),
          type: assetIds.length ? "file" : "text",
          user: { id: userId, name: username, email: null },
          createdAt: now,
          updatedAt: now,
          editedAt: null,
          deletedAt: null,
          metadata: {},
          version: 1,
          syncVersion: "0",
          attachments: [],
          reactions: [],
          receipts: [],
        });
      }
      try {
        const message = await api.sendMessengerMessage(conversationId, {
          content: content.trim(),
          assetIds,
          clientMessageId: pending.current!.id,
        });
        if (token !== generation.current) return null;
        append([message]);
        pending.current = null;
        retryPayload.current = null;
        setPendingMessage(null);
        setError(null);
        void queryClient.invalidateQueries({
          queryKey: chatQueryKeys.conversations,
        });
        return message;
      } catch (cause) {
        if (token === generation.current) {
          setSendFailed(true);
          setError(
            cause instanceof Error
              ? cause.message
              : "Message not sent. Retry to send the same message.",
          );
        }
        return null;
      } finally {
        sendBusy.current = false;
        if (token === generation.current) {
          setSending(false);
        }
      }
    },
    [conversationId, userId, username, append, queryClient],
  );
  const loadOlder = async () => {
    if (!nextCursor || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const page = await api.messengerPage(conversationId, nextCursor);
      append(page.data);
      setNextCursor(page.pagination.nextCursor);
    } catch {
      setError("Unable to load older messages");
    } finally {
      setLoadingOlder(false);
    }
  };
  return {
    messages,
    loading,
    sending,
    sendFailed,
    retryMessage: () => {
      const payload = retryPayload.current;
      return payload
        ? sendMessage(payload.content, payload.assetIds)
        : Promise.resolve(null);
    },
    pendingMessage:
      pendingMessage?.conversationId === conversationId &&
      !messages.some(
        (message) => message.clientMessageId === pendingMessage.clientMessageId,
      )
        ? pendingMessage
        : null,
    error,
    sendMessage,
    username,
    realtimeReady: true,
    realtimeError,
    loadOlder,
    hasOlder: Boolean(nextCursor),
    loadingOlder,
    append,
  };
}
