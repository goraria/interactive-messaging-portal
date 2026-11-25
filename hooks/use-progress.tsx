"use client";

import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import { useProgress as useNativeProgress } from "@gorth-com/primitive/cores/progress/next";
import { toast } from "@gorth-com/primitive/custom/toast";

type StartArgs = Parameters<ReturnType<typeof useNativeProgress>["start"]>;
type StopArgs = Parameters<ReturnType<typeof useNativeProgress>["stop"]>;

export interface ProgressOptions {
  keepUntilNavigation?: boolean;
  errorMessage?: string;
  errorTitle?: string;
  errorId?: string;
  onError?: (error: unknown) => void;
}

export interface ProgressValue {
  start: (...args: StartArgs) => boolean;
  stop: (...args: StopArgs) => void;
  pending: boolean;
  run: <T>(
    operation: () => T | Promise<T>,
    options?: ProgressOptions,
  ) => Promise<T | undefined>;
  finish: () => void;
  fail: (message: string) => void;
}

interface ProgressController {
  pending: boolean;
  start: (owner: symbol, args: StartArgs) => boolean;
  stop: (owner: symbol, args: StopArgs) => boolean;
  fail: (owner: symbol, options: ProgressOptions) => boolean;
}

const ProgressContext = createContext<ProgressController | null>(null);

export function ProgressProvider({
  children,
  pendingLabel = "Processing…",
}: PropsWithChildren<{ pendingLabel?: string }>) {
  const { start: nativeStart, stop: nativeStop } = useNativeProgress();
  const [pending, setPending] = useState(false);
  const active = useRef<symbol | null>(null);
  const pathname = usePathname();
  const previousPath = useRef(pathname);

  const start = useCallback(
    (owner: symbol, args: StartArgs) => {
      // Lock before React renders so rapid clicks cannot start a second request.
      if (active.current) return false;
      active.current = owner;
      setPending(true);
      nativeStart(...args);
      return true;
    },
    [nativeStart],
  );

  const stop = useCallback(
    (owner: symbol, args: StopArgs) => {
      // A late response from an old screen must not stop a newer action.
      if (active.current !== owner) return false;
      active.current = null;
      setPending(false);
      nativeStop(...args);
      return true;
    },
    [nativeStop],
  );

  const fail = useCallback(
    (owner: symbol, options: ProgressOptions) => {
      if (!stop(owner, [])) return false;
      toast.add({
        id: options.errorId ?? "action-progress-error",
        type: "error",
        title: (
          <span className="text-destructive">
            {options.errorTitle ?? "Unable to continue"}
          </span>
        ),
        description: options.errorMessage ?? "Please try again.",
      });
      return true;
    },
    [stop],
  );

  useEffect(() => {
    if (previousPath.current === pathname) return;
    previousPath.current = pathname;
    if (active.current) stop(active.current, []);
  }, [pathname, stop]);

  useEffect(() => {
    const restore = (event: PageTransitionEvent) => {
      if (event.persisted && active.current) stop(active.current, []);
    };
    window.addEventListener("pageshow", restore);
    return () => window.removeEventListener("pageshow", restore);
  }, [stop]);

  const value = useMemo(
    () => ({ pending, start, stop, fail }),
    [pending, start, stop, fail],
  );
  return (
    <ProgressContext.Provider value={value}>
      {pending ? (
        <span role="status" className="sr-only">
          {pendingLabel}
        </span>
      ) : null}
      {children}
    </ProgressContext.Provider>
  );
}

export function useProgress(): ProgressValue {
  const value = useContext(ProgressContext);
  const owner = useRef(Symbol("progress-action"));
  if (!value) throw new Error("ProgressProvider is required");
  const {
    pending,
    start: startAction,
    stop: stopAction,
    fail: failAction,
  } = value;

  const start = useCallback(
    (...args: StartArgs) => {
      const token = Symbol("progress-action");
      if (!startAction(token, args)) return false;
      owner.current = token;
      return true;
    },
    [startAction],
  );
  const stop = useCallback(
    (...args: StopArgs) => {
      stopAction(owner.current, args);
    },
    [stopAction],
  );
  const finish = useCallback(() => stop(), [stop]);
  const fail = useCallback(
    (message: string) => {
      failAction(owner.current, { errorMessage: message });
    },
    [failAction],
  );

  const run = useCallback(
    async <T,>(
      operation: () => T | Promise<T>,
      options: ProgressOptions = {},
    ): Promise<T | undefined> => {
      if (!start()) return undefined;
      const token = owner.current;
      try {
        const result = await operation();
        if (!options.keepUntilNavigation) stopAction(token, []);
        return result;
      } catch (error) {
        if (failAction(token, options)) options.onError?.(error);
        return undefined;
      }
    },
    [start, stopAction, failAction],
  );

  return { start, stop, pending, run, finish, fail };
}
