/**
 * Reminder permission via the Notification API. True scheduled web-push needs a
 * backend VAPID push service (POST /push/subscribe — see docs/06); this asks for
 * permission and confirms with a local notification for the prototype.
 */
export type ReminderResult = "granted" | "denied" | "unsupported";

export async function requestReminder(title: string): Promise<ReminderResult> {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  let perm = Notification.permission;
  if (perm === "default") {
    perm = await Notification.requestPermission();
  }
  if (perm === "granted") {
    try {
      new Notification("Klar — reminder set", {
        body: title,
        icon: "/icon.svg",
      });
    } catch {
      /* some platforms only allow notifications from the SW */
    }
    return "granted";
  }
  return "denied";
}
