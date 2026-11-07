// PushNudge — small in-line card offering notifications. Renders nothing when
// notifications are already on, on simulators, or for 30 days after "Not now".
// Used under a diagnosis result; tapping "Turn on" goes straight to the OS
// prompt (the card itself is the soft ask) or to Settings if the OS won't ask.
import { useTheme } from "@context/ThemeContext";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { dismissNudge, getPushStatus, nudgeDismissedRecently, PushReason, PushStatus, pushCopy, turnOnPush } from "@lib/push";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import { AppState, Text, TouchableOpacity, View } from "react-native";

export default function PushNudge({ reason = "diagnosis" }: { reason?: PushReason }) {
  const { colors } = useTheme();
  const [status, setStatus] = useState<PushStatus | null>(null);
  const [hidden, setHidden] = useState(true);

  const check = useCallback(async () => {
    const [s, dismissed] = await Promise.all([getPushStatus(), nudgeDismissedRecently(reason)]);
    setStatus(s);
    setHidden(dismissed || s === "granted" || s === "unsupported");
  }, [reason]);

  // Re-check on focus and when returning from Settings
  useFocusEffect(useCallback(() => {
    check();
    const sub = AppState.addEventListener("change", (st) => { if (st === "active") check(); });
    return () => sub.remove();
  }, [check]));

  if (hidden || !status) return null;
  const blocked = status === "blocked";

  return (
    <View style={{ backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.blue + "55", padding: 14, gap: 10 }}>
      <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
        <MaterialCommunityIcons name="bell-ring-outline" size={22} color={colors.blue} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontWeight: "700", fontSize: 15 }}>
            {blocked ? "Notifications are off" : pushCopy[reason].title}
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }}>
            {pushCopy[reason].body}{blocked ? " Turn them on in Settings." : ""}
          </Text>
        </View>
      </View>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <TouchableOpacity
          onPress={async () => { await dismissNudge(reason); setHidden(true); }}
          style={{ flex: 1, borderRadius: 10, borderWidth: 1, borderColor: colors.border, paddingVertical: 10, alignItems: "center" }}
        >
          <Text style={{ color: colors.textSecondary, fontWeight: "700" }}>Not now</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={async () => { const on = await turnOnPush(); if (on) setHidden(true); else check(); }}
          style={{ flex: 1, borderRadius: 10, backgroundColor: colors.blue, paddingVertical: 10, alignItems: "center" }}
        >
          <Text style={{ color: "white", fontWeight: "700" }}>{blocked ? "Open Settings" : "Turn on"}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
