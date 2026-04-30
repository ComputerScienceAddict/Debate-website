/**
 * Symmetric handshake: deterministic caller so both sides agree who sends the offer first.
 * Supabase/auth UUIDs compare lexically as opaque strings — lower string is caller.
 */
export function isWebrtcCaller(localPeerId: string, remotePeerId: string): boolean {
  return localPeerId !== remotePeerId && localPeerId < remotePeerId;
}
