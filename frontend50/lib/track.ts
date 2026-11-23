// Onboarding step logging. Fire-and-forget: never throws, never blocks a screen,
// never shows anything to the user. Steps must be in ONBOARDING_STEPS in
// backend/src/routes/events.routes.js (anything else is dropped server-side).
//
// installId is a random id kept in AsyncStorage, so steps from before an account
// exists (slides, register screen) line up with the account afterwards. The
// Bearer token rides along automatically once logged in (api.ts default header).
// No email, name or free text goes in meta.
import api from "@lib/api";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { Platform } from "react-native";

const KEY = "track:installId";
let installId: string | null = null;

async function getInstallId(): Promise<string> {
  if (installId) return installId;
  let id = await AsyncStorage.getItem(KEY);
  if (!id) {
    id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 10)}`;
    await AsyncStorage.setItem(KEY, id);
  }
  installId = id;
  return id;
}

type Meta = Record<string, string | number | boolean | undefined | null>;

export function track(step: string, meta?: Meta): void {
  (async () => {
    try {
      const id = await getInstallId();
      await api.post(
        "/api/events",
        { installId: id, step, meta, platform: Platform.OS, appVersion: Constants?.expoConfig?.version },
        { timeout: 8000 }
      );
    } catch {
      // Logging must never affect the app.
    }
  })();
}
