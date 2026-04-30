export const ICE_DISCONNECT_HOLD_MS = 4500;

/** ICE terminal states — peer session is realistically over */
export function isIceTerminated(state: string): boolean {
  return state === "failed" || state === "closed";
}

/** `disconnected` often recovers — only act after DebatePlatform ICE_DISCONNECT_HOLD_MS timeout */
export function isIceDisconnectedProvisional(state: string): boolean {
  return state === "disconnected";
}
