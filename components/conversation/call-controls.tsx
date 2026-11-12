"use client"
import { useEffect, useRef, useState } from "react"
import { Button } from "@gorth-io/primitive/custom/button"
import {
  Phone,
  Video,
  PhoneOff,
  Mic,
  MicOff,
  History,
} from "@gorth-io/primitive/cores/lucide"
import * as api from "@/services/client/messenger"
import type { MessengerCall } from "@/schemas/client/messenger"
import { applyPeerSignal } from "@/lib/webrtc/signaling"
import { subscribeIncomingCalls } from "@/lib/realtime/call-client"
import { useNetworkErrorToast } from "@/hooks/use-network-error-toast"

export function ChatCallControls({
  conversationId,
  userId,
  enabled,
}: {
  conversationId: string
  userId: string
  enabled: boolean
}) {
  const [calls, setCalls] = useState<MessengerCall[]>([])
  const [incomingCalls, setIncomingCalls] = useState<MessengerCall[]>([])
  const [active, setActive] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const networkError = useNetworkErrorToast(error)
  const [busy, setBusy] = useState(false)
  const [muted, setMuted] = useState(false)
  const [history, setHistory] = useState(false)
  const peer = useRef<RTCPeerConnection | null>(null)
  const local = useRef<MediaStream | null>(null)
  const remoteVideo = useRef<HTMLVideoElement | null>(null)
  const localVideo = useRef<HTMLVideoElement | null>(null)
  const connectedCall = useRef<string | null>(null)
  const live = useRef(true)
  const candidates = useRef<RTCIceCandidateInit[]>([])
  function close() {
    peer.current?.close()
    peer.current = null
    local.current?.getTracks().forEach((track) => track.stop())
    local.current = null
    connectedCall.current = null
    candidates.current = []
    if (localVideo.current) localVideo.current.srcObject = null
    if (remoteVideo.current) remoteVideo.current.srcObject = null
  }
  useEffect(() => {
    live.current = true
    const unsubscribe = enabled
      ? subscribeIncomingCalls(userId, (incoming) => {
          if (live.current)
            setIncomingCalls(
              incoming.filter((call) => call.conversationId === conversationId)
            )
        })
      : undefined
    return () => {
      live.current = false
      unsubscribe?.()
      const call = connectedCall.current
      close()
      if (call) void api.messengerSignal(call, "end").catch(() => undefined)
    }
  }, [conversationId, userId, enabled])
  useEffect(() => {
    if (!enabled || !history) return
    let stopped = false
    let busyPoll = false
    const poll = async () => {
      if (busyPoll) return
      busyPoll = true
      try {
        const rows = await api.messengerCalls(conversationId)
        if (!stopped) setCalls(rows)
      } catch {
        if (!stopped) {
          setError("Call service unavailable")
        }
      } finally {
        busyPoll = false
      }
    }
    void poll()
    return () => {
      stopped = true
    }
  }, [conversationId, enabled, history])
  useEffect(() => {
    if (!active) return
    let stopped = false,
      busyPoll = false,
      after = "0"
    const poll = async () => {
      if (stopped || busyPoll) return
      busyPoll = true
      try {
        const result = await api.messengerSignals(active, after)
        if (stopped) return
        if (result.state === "ended") {
          close()
          setActive(null)
          return
        }
        const connection = peer.current
        if (!connection) return
        for (const signal of result.data) {
          if (stopped) return
          await applyPeerSignal(
            connection,
            signal.kind,
            signal.payload,
            candidates.current,
            (payload) => api.messengerSignal(active, "answer", payload)
          )
          if (["end", "reject"].includes(signal.kind)) {
            close()
            setActive(null)
            return
          }
          after = signal.sequence
        }
      } catch (cause) {
        if (!stopped) {
          if (
            [401, 403, 404].includes((cause as { status?: number }).status ?? 0)
          ) {
            close()
            setActive(null)
          }
          setError("Unable to synchronize call; retrying")
        }
      } finally {
        busyPoll = false
      }
    }
    void poll()
    const timer = setInterval(() => void poll(), 1000)
    return () => {
      stopped = true
      clearInterval(timer)
    }
  }, [active])
  async function setup(
    callId: string,
    kind: "audio" | "video",
    caller: boolean,
    media: MediaStream
  ) {
    const config = await api.messengerIce()
    if (!live.current) {
      media.getTracks().forEach((track) => track.stop())
      return
    }
    const connection = new RTCPeerConnection(config)
    local.current = media
    peer.current = connection
    connectedCall.current = callId
    for (const track of media.getTracks()) connection.addTrack(track, media)
    connection.ontrack = (event) => {
      if (remoteVideo.current)
        remoteVideo.current.srcObject =
          event.streams[0] ?? new MediaStream([event.track])
    }
    connection.onicecandidate = (event) => {
      if (event.candidate)
        void api
          .messengerSignal(
            callId,
            "ice",
            JSON.stringify(event.candidate.toJSON())
          )
          .catch(() => {
            if (live.current) setError("ICE signaling unavailable")
          })
    }
    connection.onconnectionstatechange = () => {
      if (connection.connectionState === "failed" && caller) {
        connection.restartIce()
        void connection
          .createOffer({ iceRestart: true })
          .then(async (offer) => {
            await connection.setLocalDescription(offer)
            await api.messengerSignal(
              callId,
              "offer",
              JSON.stringify(connection.localDescription)
            )
          })
          .catch(() => {
            if (live.current)
              setError("Call connection failed; check TURN configuration")
          })
      }
    }
    if (caller) {
      await connection.setLocalDescription(await connection.createOffer())
      await api.messengerSignal(
        callId,
        "offer",
        JSON.stringify(connection.localDescription)
      )
    }
    setActive(callId)
    requestAnimationFrame(() => {
      if (localVideo.current) localVideo.current.srcObject = media
    })
  }
  async function start(kind: "audio" | "video") {
    if (busy || active) return
    setBusy(true)
    setError(null)
    let media: MediaStream | null = null
    try {
      media = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: kind === "video",
      })
      const call = await api.startMessengerCall(
        conversationId,
        kind,
        crypto.randomUUID()
      )
      await setup(call.id, kind, true, media)
    } catch (cause) {
      media?.getTracks().forEach((track) => track.stop())
      close()
      setError(cause instanceof Error ? cause.message : "Unable to start call")
    } finally {
      setBusy(false)
    }
  }
  async function accept(call: MessengerCall) {
    if (busy) return
    setBusy(true)
    setError(null)
    let media: MediaStream | null = null
    try {
      media = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: call.kind === "video",
      })
      await api.messengerSignal(call.id, "accept")
      await setup(call.id, call.kind, false, media)
    } catch (cause) {
      media?.getTracks().forEach((track) => track.stop())
      close()
      setError(cause instanceof Error ? cause.message : "Unable to accept call")
    } finally {
      setBusy(false)
    }
  }
  const incoming = incomingCalls.find(
    (call) =>
      call.calleeId === userId &&
      call.state === "ringing" &&
      new Date(call.expiresAt) > new Date() &&
      call.id !== active
  )
  return (
    <>
      <Button
        size="icon"
        variant="ghost"
        aria-label="Start video call"
        disabled={!enabled || busy || Boolean(active)}
        onClick={() => void start("video")}
      >
        <Video />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        aria-label="Start voice call"
        disabled={!enabled || busy || Boolean(active)}
        onClick={() => void start("audio")}
      >
        <Phone />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        aria-label="Call history"
        onClick={() => setHistory((current) => !current)}
      >
        <History />
      </Button>
      {incoming || active || error || history ? (
        <section
          role="dialog"
          aria-label="Conversation call"
          className="fixed bottom-4 right-4 z-50 w-80 space-y-3 rounded-xl border bg-card p-4 shadow-xl"
        >
          {history ? (
            <div className="max-h-60 space-y-2 overflow-auto">
              <h2 className="font-medium">Call history</h2>
              {calls.length ? (
                calls.map((call) => (
                  <article
                    key={call.id}
                    className="rounded-md border p-2 text-sm"
                  >
                    <p>
                      {call.callerId === userId ? "Outgoing" : "Incoming"}{" "}
                      {call.kind} ·{" "}
                      {["ringing", "active"].includes(call.state) &&
                      new Date(call.expiresAt) < new Date()
                        ? call.state === "ringing"
                          ? "missed"
                          : "ended"
                        : call.state}
                    </p>
                    <time className="text-xs text-muted-foreground">
                      {new Date(call.createdAt).toLocaleString()}
                    </time>
                  </article>
                ))
              ) : (
                <p>No calls yet.</p>
              )}
            </div>
          ) : null}
          {incoming ? (
            <>
              <p>Incoming {incoming.kind} call</p>
              <Button disabled={busy} onClick={() => void accept(incoming)}>
                Accept
              </Button>
              <Button
                variant="outline"
                onClick={() => void api.messengerSignal(incoming.id, "reject")}
              >
                Decline
              </Button>
            </>
          ) : null}
          {active ? (
            <>
              <video
                ref={remoteVideo}
                autoPlay
                playsInline
                className="max-h-60 w-full rounded-lg"
                aria-label="Remote participant"
              />
              <video
                ref={localVideo}
                autoPlay
                muted
                playsInline
                className="max-h-24 rounded-md"
                aria-label="Your camera"
              />
              <Button
                variant="outline"
                onClick={() => {
                  const next = !muted
                  local.current
                    ?.getAudioTracks()
                    .forEach((track) => (track.enabled = !next))
                  setMuted(next)
                }}
              >
                {muted ? <MicOff /> : <Mic />}
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  void api.messengerSignal(active, "end").catch(() => undefined)
                  close()
                  setActive(null)
                }}
              >
                <PhoneOff />
                End call
              </Button>
            </>
          ) : null}
          {error && !networkError ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          {!active && !incoming ? (
            <Button
              variant="ghost"
              onClick={() => {
                setError(null)
                setHistory(false)
              }}
            >
              Dismiss
            </Button>
          ) : null}
        </section>
      ) : null}
    </>
  )
}
