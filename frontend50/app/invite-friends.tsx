import { useAuth } from "@context/AuthContext";
import { useTheme } from "@context/ThemeContext";
import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, Share, Text, TouchableOpacity, View } from "react-native";

export default function InviteFriends() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();
  const [copied, setCopied] = useState(false);

  const code = user?.referralCode || "";

  // The deep link only works if the app is already installed. For
  // someone who doesn't have it yet, the message spells out the code
  // explicitly so they can still enter it manually after installing —
  // there's no HTTPS landing page for invites yet (unlike password
  // reset), so this is the honest, simple version rather than a link
  // that silently does nothing for half the recipients.
  const shareMessage =
    `Join me on AutoAI 🚗 — AI-powered car diagnostics, a DIY community, and mechanic marketplace, all in one app.\n\n` +
    `Use my referral code when you sign up: ${code}\n\n` +
    `If you already have the app: automotiveai://invite?code=${code}`;

  const handleCopy = async () => {
    if (!code) return;
    await Clipboard.setStringAsync(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (!code) return;
    try {
      await Share.share({ message: shareMessage });
    } catch (err) {
      Alert.alert("Error", "Could not open share sheet. Try again.");
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, padding: 20 }}>
      <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace("/settings")} style={{ marginTop: 20, marginBottom: 20 }}>
        <Text style={{ color: colors.blue, fontSize: 16 }}>← Back</Text>
      </TouchableOpacity>

      <View style={{ alignItems: "center", marginBottom: 32 }}>
        <Text style={{ fontSize: 60, marginBottom: 16 }}>🎉</Text>
        <Text style={{ color: colors.text, fontSize: 26, fontWeight: "900", textAlign: "center", marginBottom: 8 }}>
          Invite Friends, Earn Rep
        </Text>
        <Text style={{ color: colors.textSecondary, fontSize: 15, textAlign: "center", lineHeight: 22, paddingHorizontal: 10 }}>
          When someone you invite adds their first vehicle (or a mechanic submits verification), you get{" "}
          <Text style={{ color: colors.blue, fontWeight: "700" }}>+10 rep</Text> and they get{" "}
          <Text style={{ color: colors.blue, fontWeight: "700" }}>+5 rep</Text>.
        </Text>
      </View>

      {/* CODE DISPLAY */}
      <View style={{ backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.blue + "44", padding: 24, alignItems: "center", marginBottom: 20 }}>
        <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 10 }}>Your Referral Code</Text>
        <Text style={{ color: colors.text, fontSize: 36, fontWeight: "900", letterSpacing: 6, marginBottom: 16 }}>
          {code || "—"}
        </Text>
        <TouchableOpacity
          onPress={handleCopy}
          disabled={!code}
          style={{ backgroundColor: copied ? colors.green : colors.card, borderWidth: 1, borderColor: copied ? colors.green : colors.border, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 }}
        >
          <Text style={{ color: copied ? "white" : colors.blue, fontWeight: "700", fontSize: 14 }}>
            {copied ? "✓ Copied!" : "📋 Copy Code"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* SHARE BUTTON */}
      <TouchableOpacity
        onPress={handleShare}
        disabled={!code}
        style={{ backgroundColor: colors.blue, paddingVertical: 16, borderRadius: 14, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8 }}
      >
        <Text style={{ fontSize: 18 }}>📤</Text>
        <Text style={{ color: "white", fontWeight: "700", fontSize: 17 }}>Share Invite</Text>
      </TouchableOpacity>
    </View>
  );
}
