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
    video: true,
    audio: true,
  });

  localVideo.srcObject = stream;
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

