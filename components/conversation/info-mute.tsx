"use client";
import { useState } from "react";
import { Button } from "@gorth-com/primitive/custom/button";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@gorth-com/primitive/default/dialog";
import { RadioGroup, RadioGroupItem } from "@gorth-com/primitive/custom/radio";
import { Label } from "@gorth-com/primitive/default/label";
import { Bell } from "@gorth-com/primitive/cores/lucide";
import { messengerMutation } from "@/queries/messenger";
import { chatQueryKeys } from "@/queries/chat";
import { useQueryClient } from "@gorth-com/primitive/cores/tanstack/query";
import { useNetworkErrorToast } from "@/hooks/use-network-error-toast";

export function InfoMute({
  conversationId,
  muted,
  label,
  open: controlledOpen,
  onOpenChange,
}: {
  conversationId: string;
  muted: boolean;
  label?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const [activity, setActivity] = useState(muted ? "none" : "all");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const networkError = useNetworkErrorToast(error);
  const client = useQueryClient();
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (busy) return;
        setOpen(next);
        setActivity(muted ? "none" : "all");
        setError(null);
      }}
    >
      <DialogTrigger
        render={
          <Button
            variant={label ? "ghost" : "outline"}
            size={label ? "default" : "icon"}
            className={label ? "w-full justify-start" : undefined}
            aria-label={label ?? "Mute notifications"}
          />
        }
      >
        {label ?? <Bell />}
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <form
          className="space-y-6"
          onSubmit={(event) => {
            event.preventDefault();
            if (busy) return;
            setBusy(true);
            setError(null);
            void messengerMutation(
              "/conversation/" + conversationId + "/preference",
              "PATCH",
              {
                mutedUntil:
                  activity === "none" ? "9999-12-31T23:59:59.000Z" : null,
              },
            )
              .then(async () => {
                await Promise.all([
                  client.invalidateQueries({
                    queryKey: chatQueryKeys.conversation(conversationId),
                  }),
                  client.invalidateQueries({
                    queryKey: chatQueryKeys.conversations,
                  }),
                ]);
                setOpen(false);
              })
              .catch((cause) =>
                setError(
                  cause instanceof Error
                    ? cause.message
                    : "Unable to save notifications",
                ),
              )
              .finally(() => setBusy(false));
          }}
        >
          <DialogHeader>
            <DialogTitle>Notifications for this chat</DialogTitle>
            <DialogDescription>
              {muted
                ? "Notifications for this chat are muted."
                : "You are currently receiving notifications for this chat."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-between gap-3 border-b pb-4">
            <span className="text-sm">Mute this chat?</span>
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={() => setActivity(activity === "none" ? "all" : "none")}
            >
              <Bell />
              {activity === "none" ? "Unmute" : "Mute"}
            </Button>
          </div>
          <div className="space-y-4">
            <h3 className="font-medium">Activity</h3>
            <RadioGroup
              value={activity}
              onValueChange={setActivity}
              disabled={busy}
            >
              <Label
                className="flex justify-between"
                htmlFor="chat-activity-all"
              >
                All activity
                <RadioGroupItem id="chat-activity-all" value="all" />
              </Label>
              <Label
                className="flex justify-between"
                htmlFor="chat-activity-none"
              >
                None
                <RadioGroupItem id="chat-activity-none" value="none" />
              </Label>
            </RadioGroup>
          </div>
          {error && !networkError ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <DialogClose
              render={
                <Button type="button" variant="secondary" disabled={busy}>
                  Cancel
                </Button>
              }
            />
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Done"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
