"use client";
import { useEffect, useState } from "react";
import { Switch } from "@gorth-com/primitive/default/switch";
import { Button } from "@gorth-com/primitive/custom/button";
import {
  chatNotificationPreferences,
  setChatNotificationPreference,
  type ChatPreference,
} from "@/queries/chat-preferences";
export default function NotificationSetting() {
  const [preferences, setPreferences] = useState<ChatPreference[] | null>(null),
    [error, setError] = useState<string | null>(null),
    [busy, setBusy] = useState(false);
  async function refresh() {
    try {
      setPreferences(await chatNotificationPreferences());
      setError(null);
    } catch {
      setError("Unable to load notification preferences");
    }
  }
  useEffect(() => {
    let stopped = false;
    void chatNotificationPreferences()
      .then((result) => {
        if (!stopped) setPreferences(result);
      })
      .catch(() => {
        if (!stopped) setError("Unable to load notification preferences");
      });
    return () => {
      stopped = true;
    };
  }, []);
  return (
    <section className="max-w-2xl space-y-5">
      <h1 className="text-2xl font-bold">Notification</h1>
      <p className="text-muted-foreground">
        Message previews contain no message text. Email and push require a
        verified endpoint and a configured provider in the Notification service.
      </p>
      {error ? <p role="alert">{error}</p> : null}
      <Button variant="outline" onClick={() => void refresh()}>
        Reload
      </Button>
      {["in_app", "email", "push", "web_push"].map((channel) => (
        <label
          key={channel}
          className="flex items-center justify-between gap-4 rounded-lg border p-4"
        >
          <span>{channel.replaceAll("_", " ")}</span>
          <Switch
            disabled={busy || !preferences}
            checked={
              Boolean(preferences) &&
              !preferences!.some(
                (row) =>
                  row.channel === channel &&
                  !row.enabled &&
                  ["*", "chat.message"].includes(row.notificationType),
              )
            }
            onCheckedChange={(enabled) => {
              setBusy(true);
              setError(null);
              void setChatNotificationPreference(channel, enabled)
                .then(refresh)
                .catch(() => setError("Preference was not saved"))
                .finally(() => setBusy(false));
            }}
          />
        </label>
      ))}
    </section>
  );
}
