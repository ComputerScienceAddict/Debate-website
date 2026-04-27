/** Normalize FastAPI `detail` (string | object | validation array) for JSON clients. */
export function gatewayErrorMessage(detail: unknown): string {
  if (detail == null) return "Gateway error";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (item && typeof item === "object" && "msg" in item) {
          return String((item as { msg: unknown }).msg);
        }
        try {
          return JSON.stringify(item);
        } catch {
          return String(item);
        }
      })
      .join(" ");
  }
  if (typeof detail === "object" && "message" in detail) {
    return String((detail as { message: unknown }).message);
  }
  return "Gateway error";
}
