# WebRTC + Supabase signaling notes

Supabase does not transport media; it only coordinates peers.

## Flow

1. Create/join `debate_rooms` row.
2. Mark user online in `room_presence`.
3. Create `RTCPeerConnection` via `createDebatePeerConnection()`.
4. Attach local/remote streams via `attachLocalMedia()` and `attachRemoteMedia()`.
5. Exchange SDP and ICE through `webrtc_signals` using:
   - `sendSignal()`
   - `subscribeSignals()`
6. On disconnect:
   - send `bye` signal
   - mark `room_presence.is_online = false`
   - stop tracks via `stopMediaStream()`

## Offer/Answer outline

- Caller creates offer -> `sendSignal({ signalType: "offer" })`
- Callee receives offer -> sets remote description -> creates answer -> `sendSignal({ signalType: "answer" })`
- Both sides forward ICE candidates with `signalType: "ice_candidate"`

## Reliability

- Current setup uses free STUN (`stun:stun.l.google.com:19302`).
- Add TURN later for users behind strict NAT/firewalls.

