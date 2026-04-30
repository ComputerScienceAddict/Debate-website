export function createDebatePeerConnection() {
  return new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
  });
}

export function bindLocalPreviewVideo(stream: MediaStream, localVideo: HTMLVideoElement) {
  localVideo.muted = true;
  localVideo.playsInline = true;
  localVideo.autoplay = true;
  localVideo.setAttribute("playsinline", "");
  localVideo.setAttribute("webkit-playsinline", "");
  localVideo.srcObject = stream;
  const tryPlay = () => localVideo.play().catch(() => {});
  void tryPlay();
  setTimeout(tryPlay, 50);
  setTimeout(tryPlay, 200);
}

export async function attachLocalMedia(
  peerConnection: RTCPeerConnection,
  localVideo: HTMLVideoElement
) {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "user" },
    audio: true,
  });

  bindLocalPreviewVideo(stream, localVideo);

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

