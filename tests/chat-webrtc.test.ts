import { expect, it, vi } from "vitest"
import { applyPeerSignal, type PeerConnection } from "@/lib/webrtc/signaling"
function fixture() {
  const order: string[] = []
  const peer: PeerConnection = {
    remoteDescription: null,
    localDescription: null,
    addIceCandidate: vi.fn(async () => {
      if (!peer.remoteDescription)
        throw new Error("Remote description required")
      order.push("ice")
    }),
    setRemoteDescription: vi.fn(async (description) => {
      peer.remoteDescription = { sdp: description.sdp!, type: description.type }
      order.push("remote")
    }),
    setLocalDescription: vi.fn(async (description) => {
      peer.localDescription = { sdp: description.sdp!, type: description.type }
      order.push("local")
    }),
    createAnswer: vi.fn(async () => ({
      type: "answer" as const,
      sdp: "answer-sdp",
    })),
  }
  return { peer, order }
}
it("buffers early ICE until a remote description exists and then answers", async () => {
  const { peer, order } = fixture(),
    pending: RTCIceCandidateInit[] = [],
    send = vi.fn<(_: string) => Promise<void>>(async () => undefined)
  await applyPeerSignal(
    peer,
    "ice",
    JSON.stringify({ candidate: "candidate:fixture" }),
    pending,
    send
  )
  expect(peer.addIceCandidate).not.toHaveBeenCalled()
  await applyPeerSignal(
    peer,
    "offer",
    JSON.stringify({ type: "offer", sdp: "offer-sdp" }),
    pending,
    send
  )
  expect(order).toEqual(["remote", "ice", "local"])
  expect(pending).toEqual([])
  expect(JSON.parse(send.mock.calls[0]![0])).toEqual({
    type: "answer",
    sdp: "answer-sdp",
  })
})
it("can retry an offer ACK without recreating descriptions or losing the answer", async () => {
  const { peer } = fixture(),
    pending: RTCIceCandidateInit[] = [],
    send = vi.fn(async () => undefined),
    offer = JSON.stringify({ type: "offer", sdp: "offer-sdp" })
  await applyPeerSignal(peer, "offer", offer, pending, send)
  await applyPeerSignal(peer, "offer", offer, pending, send)
  expect(peer.setRemoteDescription).toHaveBeenCalledTimes(1)
  expect(peer.createAnswer).toHaveBeenCalledTimes(1)
  expect(send).toHaveBeenCalledTimes(2)
})
it("creates a fresh answer when the caller restarts ICE with a new offer", async () => {
  const { peer } = fixture(),
    send = vi.fn(async () => undefined)
  await applyPeerSignal(
    peer,
    "offer",
    JSON.stringify({ type: "offer", sdp: "initial" }),
    [],
    send
  )
  await applyPeerSignal(
    peer,
    "offer",
    JSON.stringify({ type: "offer", sdp: "restart" }),
    [],
    send
  )
  expect(peer.createAnswer).toHaveBeenCalledTimes(2)
})
it("applies an answer before buffered ICE and rejects malformed signaling", async () => {
  const { peer, order } = fixture(),
    send = vi.fn(async () => undefined)
  await applyPeerSignal(
    peer,
    "answer",
    JSON.stringify({ type: "answer", sdp: "remote-answer" }),
    [{ candidate: "candidate:fixture" }],
    send
  )
  expect(order).toEqual(["remote", "ice"])
  expect(send).not.toHaveBeenCalled()
  await expect(
    applyPeerSignal(peer, "offer", "bad", [], send)
  ).rejects.toThrow()
  await expect(
    applyPeerSignal(
      peer,
      "answer",
      JSON.stringify({ type: "offer", sdp: "x" }),
      [],
      send
    )
  ).rejects.toThrow("Invalid session description")
})
