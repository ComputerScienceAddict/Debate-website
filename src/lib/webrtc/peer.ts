export function createDebatePeerConnection() {
  return new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
  });
}

export async function attachLocalMedia(
  peerConnection: RTCPeerConnection,
  localVideo: HTMLVideoElement
) {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "user" },
    audio: true,
  });

  // iOS Safari requires muted + playsInline set in JS (HTML attrs alone aren't enough
  // for dynamically assigned srcObject) and needs an explicit play() call.
  localVideo.muted = true;
  localVideo.playsInline = true;
  localVideo.autoplay = true;
  localVideo.setAttribute("playsinline", ""); // Belt-and-suspenders for older iOS
  localVideo.setAttribute("webkit-playsinline", "");
  localVideo.srcObject = stream;

  // Robust play: try immediately, then retry after a tick if iOS deferred it
  const tryPlay = () => localVideo.play().catch(() => {});
  await tryPlay();
  setTimeout(tryPlay, 50);
  setTimeout(tryPlay, 200);

  stream.getTracks().forEach((track) => {
    peerConnection.addTrack(track, stream);
  });

  return stream;
}

export function attachRemoteMedia(
  peerConnection: RTCPeerConnection,
  remoteVideo: HTMLVideoElement
) {
  peerConnection.ontrack = (event) => {
    remoteVideo.srcObject = event.streams[0];
  };
}

export function stopMediaStream(stream: MediaStream | null) {
  if (!stream) return;
  stream.getTracks().forEach((track) => track.stop());
}

