// Browser WebRTC protocol orchestration. Cryptography is owned by WebRTC.
export interface PeerConnection {
  remoteDescription: { sdp: string; type: string } | null
  localDescription: { sdp: string; type: string } | null
  addIceCandidate(candidate: RTCIceCandidateInit): Promise<void>
  setRemoteDescription(description: RTCSessionDescriptionInit): Promise<void>
  setLocalDescription(description: RTCSessionDescriptionInit): Promise<void>
  createAnswer(): Promise<RTCSessionDescriptionInit>
}
export async function applyPeerSignal(
  peer: PeerConnection,
  kind: string,
  payload: string,
  pending: RTCIceCandidateInit[],
  sendAnswer: (payload: string) => Promise<unknown>
) {
  if (kind === "ice") {
    const candidate = JSON.parse(payload) as RTCIceCandidateInit
    if (typeof candidate.candidate !== "string")
      throw new Error("Invalid ICE candidate")
    if (peer.remoteDescription) await peer.addIceCandidate(candidate)
    else pending.push(candidate)
  }
  if (kind === "offer" || kind === "answer") {
    const description = JSON.parse(payload) as RTCSessionDescriptionInit
    if (description.type !== kind || typeof description.sdp !== "string")
      throw new Error("Invalid session description")
    const changed =
      peer.remoteDescription?.sdp !== description.sdp ||
      peer.remoteDescription.type !== kind
    if (changed) {
      await peer.setRemoteDescription(description)
      for (const candidate of pending.splice(0))
        await peer.addIceCandidate(candidate)
    }
    if (kind === "offer") {
      if (changed || peer.localDescription?.type !== "answer")
        await peer.setLocalDescription(await peer.createAnswer())
      await sendAnswer(JSON.stringify(peer.localDescription))
    }
  }
}
