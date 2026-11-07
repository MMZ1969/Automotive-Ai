// push.ts — notification permission, asked at the moment it's useful.
//
// Before 1.0.29 the OS prompt fired at login/signup, before people had seen
// anything worth being notified about. On iOS that prompt can only be shown
// once, so most new users declined and stayed unreachable (6 in 10 had no
// push token). Now:
//   - login / launch only SYNC the token if permission is already granted
//     (syncPushToken), never prompt;
//   - the app asks with its own message first at three moments (after posting
//     a question, after setting a reminder, and a card under a diagnosis) and
//     only shows the OS prompt after the user taps "Turn on";
//   - if the OS won't ask again (they declined before), we offer Settings.
import api from "@lib/api";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Alert, Linking, Platform } from "react-native";

export type PushReason = "question" | "reminder" | "diagnosis";
export type PushStatus = "granted" | "ask" | "blocked" | "unsupported";

const SAVED_KEY = "push:savedAt"; // when this device's token was last sent for the logged-in user
const RESYNC_MS = 7 * 24 * 60 * 60 * 1000;
const askedKey = (reason: PushReason) => `push:asked:${reason}`;
// How long after a "Not now" before the same moment asks again
const COOLDOWN_MS: Record<PushReason, number> = {
  question: 3 * 24 * 60 * 60 * 1000,
  reminder: 3 * 24 * 60 * 60 * 1000,
  diagnosis: 30 * 24 * 60 * 60 * 1000,
};
const COPY: Record<PushReason, { title: string; body: string }> = {
  question: {
    title: "Get notified when a mechanic answers?",
    body: "We'll let you know as soon as someone replies to your question.",
  },
  reminder: {
    title: "Turn on reminder notifications?",
    body: "Your reminder can only reach you if notifications are on. We'll ping you when service is due.",
  },
  diagnosis: {
    title: "Get a heads-up on replies?",
    body: "Turn on notifications to hear when a mechanic answers or a maintenance reminder is due. No spam.",
  },
};

async function ensureAndroidChannel() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("default", {
    name: "default",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
  });
}

export async function getPushStatus(): Promise<PushStatus> {
  if (!Device.isDevice) return "unsupported";
  try {
    const p = await Notifications.getPermissionsAsync();
    if (p.status === "granted") return "granted";
    return p.canAskAgain ? "ask" : "blocked";
  } catch {
    return "unsupported";
  }
}

// Sends this device's push token to the backend. Never shows a prompt.
// force: skip the "sent recently" shortcut (right after login/permission).
export async function syncPushToken(force = false): Promise<boolean> {
  try {
    if ((await getPushStatus()) !== "granted") return false;
    if (!force) {
      const last = Number(await AsyncStorage.getItem(SAVED_KEY)) || 0;
      if (Date.now() - last < RESYNC_MS) return true;
    }
    await ensureAndroidChannel();
    // getExpoPushTokenAsync() needs the EAS projectId on store builds.
    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ??
      (Constants as any)?.easConfig?.projectId ??
      "6f942beb-c59e-4d1a-b4b0-8317a2566f21";
    const { data: pushToken } = await Notifications.getExpoPushTokenAsync({ projectId });
    await api.put("/api/users/me", { pushToken });
    await AsyncStorage.setItem(SAVED_KEY, String(Date.now()));
    console.log("PUSH: token saved to backend");
    return true;
  } catch (err) {
    console.error("PUSH TOKEN ERROR:", err);
    return false;
  }
}

// Call on logout so the next account on this device re-sends the token.
export async function forgetPushSync() {
  try { await AsyncStorage.removeItem(SAVED_KEY); } catch {}
}

// The user said yes in our own UI: show the OS prompt, or Settings if the OS
// won't ask again. Returns true when notifications end up on.
export async function turnOnPush(): Promise<boolean> {
  const status = await getPushStatus();
  if (status === "granted") return syncPushToken(true);
  if (status === "unsupported") return false;
  if (status === "blocked") {
    Linking.openSettings().catch(() => {});
    return false; // AuthContext re-syncs when the app comes back to the foreground
  }
  try {
    await ensureAndroidChannel(); // Android 13+ needs a channel before the prompt shows
    const r = await Notifications.requestPermissionsAsync();
    if (r.status === "granted") return syncPushToken(true);
  } catch (err) {
    console.error("PUSH PERMISSION ERROR:", err);
  }
  return false;
}

// Our own "want notifications?" message at a useful moment. Does nothing if
// already on, or if the user said "Not now" to this moment recently.
export async function askForPush(reason: PushReason): Promise<void> {
  const status = await getPushStatus();
  if (status === "granted") { syncPushToken(); return; }
  if (status === "unsupported") return;
  try {
    const last = Number(await AsyncStorage.getItem(askedKey(reason))) || 0;
    if (Date.now() - last < COOLDOWN_MS[reason]) return;
    await AsyncStorage.setItem(askedKey(reason), String(Date.now()));
  } catch {}

  const { title, body } = COPY[reason];
  if (status === "blocked") {
    Alert.alert("Notifications are off", `${body}\n\nYou can turn them on in Settings.`, [
      { text: "Not now", style: "cancel" },
      { text: "Open Settings", onPress: () => Linking.openSettings().catch(() => {}) },
    ]);
  } else {
    Alert.alert(title, body, [
      { text: "Not now", style: "cancel" },
      { text: "Turn on", onPress: () => { turnOnPush(); } },
    ]);
  }
}

// For the in-line card: hidden for 30 days after "Not now".
export async function nudgeDismissedRecently(reason: PushReason): Promise<boolean> {
  try {
    const last = Number(await AsyncStorage.getItem(askedKey(reason))) || 0;
    return Date.now() - last < COOLDOWN_MS[reason];
  } catch {
    return false;
  }
}
export async function dismissNudge(reason: PushReason) {
  try { await AsyncStorage.setItem(askedKey(reason), String(Date.now())); } catch {}
}
export const pushCopy = COPY;
