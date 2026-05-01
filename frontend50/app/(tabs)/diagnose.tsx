import api from "@lib/api";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

// Safe speech recognition import — won't crash in Expo Go
let ExpoSpeechRecognitionModule: any = null;
let useSpeechRecognitionEvent: any = () => {};
try {
  const mod = require("expo-speech-recognition");
  ExpoSpeechRecognitionModule = mod.ExpoSpeechRecognitionModule;
  useSpeechRecognitionEvent = mod.useSpeechRecognitionEvent;
} catch (e) {
  // Running in Expo Go — speech recognition not available
}

export default function Diagnose() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<any>(null);
  const [videos, setVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);

  useSpeechRecognitionEvent("result", (event: any) => {
    if (event.results[0]?.transcript) {
      setQuery(event.results[0].transcript);
    }
  });

  useSpeechRecognitionEvent("end", () => {
    setRecording(false);
  });

  const handleVoice = async () => {
    if (!ExpoSpeechRecognitionModule) {
      alert("Voice input is only available in the full app build.");
      return;
    }
    const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!granted) return;

    if (recording) {
      ExpoSpeechRecognitionModule.stop();
      setRecording(false);
    } else {
      setRecording(true);
      ExpoSpeechRecognitionModule.start({
        lang: "en-US",
        interimResults: true,
      });
    }
  };

  const handleDiagnose = async () => {
  if (!query.trim()) return;

  // Car-related keyword guard
  const carKeywords = [
    "car", "truck", "vehicle", "engine", "motor", "brake", "tire", "wheel",
    "transmission", "exhaust", "oil", "battery", "alternator", "starter",
    "radiator", "coolant", "fuel", "gas", "diesel", "spark", "plug",
    "cylinder", "piston", "valve", "clutch", "differential", "suspension",
    "steering", "alignment", "noise", "leak", "smoke", "warning", "light",
    "check engine", "rpm", "mph", "odometer", "mileage", "mechanic",
    "repair", "fix", "driving", "stall", "idle", "accelerat", "decelerat",
    "vibrat", "shak", "squeal", "grind", "knock", "click", "rattle",
    "honda", "toyota", "ford", "chevy", "chevrolet", "bmw", "mercedes",
    "audi", "volkswagen", "nissan", "hyundai", "kia", "jeep", "dodge",
    "ram", "gmc", "cadillac", "lexus", "acura", "subaru", "mazda",
    "motorcycle", "bike", "atv", "suv", "sedan", "coupe", "pickup",
  ];

  const queryLower = query.toLowerCase();
  const isCarRelated = carKeywords.some(keyword => queryLower.includes(keyword));

  if (!isCarRelated) {
    Alert.alert(
      "🚗 Automotive Only",
      "This AI is specialized for vehicle diagnostics only. Please describe a car, truck, or motorcycle problem.",
      [{ text: "Got it" }]
    );
    return;
  }

  try {
    setLoading(true);
    setResult(null);
    setVideos([]);

    const [diagRes, videoRes] = await Promise.all([
      api.post("/api/diagnose", { query }),
      api.get(`/api/youtube?query=${encodeURIComponent(query)}`),
    ]);

    setResult(diagRes.data);
    setVideos(videoRes.data);
  } catch (err) {
    console.error("DIAGNOSE ERROR:", err);
  } finally {
    setLoading(false);
  }
};

  const severityColor = (severity: string) => {
    switch (severity) {
      case "Low": return "#10b981";
      case "Medium": return "#f59e0b";
      case "High": return "#f97316";
      case "Critical": return "#ef4444";
      default: return "#6b7280";
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#050509" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* HEADER */}
      <View style={{
        paddingTop: 60,
        paddingHorizontal: 20,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: "#252838",
      }}>
        <Text style={{ color: "white", fontSize: 28, fontWeight: "900" }}>
          🔌 AI Diagnose
        </Text>
        <Text style={{ color: "#9ca3af", fontSize: 13, marginTop: 4 }}>
          Describe your car problem and get an instant diagnosis
        </Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }}>

        {/* INPUT */}
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="e.g. My 2019 Honda Civic makes a grinding noise when braking..."
          placeholderTextColor="#4b5563"
          multiline
          style={{
            backgroundColor: "#11131a",
            color: "white",
            paddingHorizontal: 16,
            paddingVertical: 14,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: "#252838",
            fontSize: 15,
            lineHeight: 22,
            minHeight: 100,
            textAlignVertical: "top",
            marginBottom: 8,
          }}
        />

        {/* AI DISCLOSURE — required for Apple App Store compliance */}
        <Text style={{ color: "#6b7280", fontSize: 11, marginBottom: 14, paddingHorizontal: 4 }}>
          🔒 Your description is sent to an AI service for analysis. See our{" "}
          <Text
            style={{ color: "#345bff" }}
            onPress={() => Linking.openURL("https://mmz1969.github.io/Automotive-Ai/privacy-policy.html")}
      >
              Privacy Policy
        </Text> for details.
        </Text>

        {/* VOICE BUTTON */}
        <TouchableOpacity
          onPress={handleVoice}
          style={{
            backgroundColor: recording ? "#ef4444" : "#11131a",
            paddingVertical: 14,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: recording ? "#ef4444" : "#252838",
            alignItems: "center",
            marginBottom: 14,
            flexDirection: "row",
            justifyContent: "center",
            gap: 8,
          }}
        >
          <Text style={{ fontSize: 20 }}>{recording ? "🔴" : "🎤"}</Text>
          <Text style={{ color: recording ? "white" : "#9ca3af", fontWeight: "700" }}>
            {recording ? "Listening... tap to stop" : "Tap to speak"}
          </Text>
        </TouchableOpacity>

        {/* DIAGNOSE BUTTON */}
        <TouchableOpacity
          onPress={handleDiagnose}
          disabled={loading || !query.trim()}
          style={{
            backgroundColor: loading || !query.trim() ? "#1f2937" : "#345bff",
            paddingVertical: 16,
            borderRadius: 14,
            alignItems: "center",
            marginBottom: 24,
          }}
        >
          {loading ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <ActivityIndicator color="white" size="small" />
              <Text style={{ color: "white", fontWeight: "700", fontSize: 16 }}>
                Analyzing...
              </Text>
            </View>
          ) : (
            <Text style={{ color: "white", fontWeight: "700", fontSize: 16 }}>
              🔌 Run Diagnosis
            </Text>
          )}
        </TouchableOpacity>

        {/* RESULTS */}
        {result && (
          <View style={{ gap: 14 }}>

            {/* SUMMARY + SEVERITY */}
            <View style={{
              backgroundColor: "#11131a",
              borderRadius: 16,
              borderWidth: 1,
              borderColor: "#252838",
              padding: 16,
            }}>
              <Text style={{ color: "white", fontSize: 18, fontWeight: "700", marginBottom: 8 }}>
                {result.summary}
              </Text>
              <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
                <View style={{
                  backgroundColor: severityColor(result.severity) + "33",
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: severityColor(result.severity),
                }}>
                  <Text style={{ color: severityColor(result.severity), fontWeight: "700" }}>
                    {result.severity} Severity
                  </Text>
                </View>
                <View style={{
                  backgroundColor: "#1f2937",
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: "#252838",
                }}>
                  <Text style={{ color: "#9ca3af", fontWeight: "700" }}>
                    💰 {result.estimatedCost}
                  </Text>
                </View>
                <View style={{
                  backgroundColor: "#1f2937",
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: "#252838",
                }}>
                  <Text style={{ color: "#9ca3af", fontWeight: "700" }}>
                    🔧 {result.diyDifficulty}
                  </Text>
                </View>
              </View>
            </View>

            {/* IMMEDIATE ACTION */}
            <View style={{
              backgroundColor: "#1a0a0a",
              borderRadius: 16,
              borderWidth: 1,
              borderColor: "#ef444433",
              padding: 16,
            }}>
              <Text style={{ color: "#ef4444", fontWeight: "700", fontSize: 14, marginBottom: 6 }}>
                ⚠️ Immediate Action
              </Text>
              <Text style={{ color: "#e5e7eb", fontSize: 14, lineHeight: 20 }}>
                {result.immediateAction}
              </Text>
            </View>

            {/* LIKELY CAUSES */}
            <View style={{
              backgroundColor: "#11131a",
              borderRadius: 16,
              borderWidth: 1,
              borderColor: "#252838",
              padding: 16,
            }}>
              <Text style={{ color: "white", fontWeight: "700", fontSize: 16, marginBottom: 12 }}>
                🔍 Likely Causes
              </Text>
              {result.causes?.map((cause: string, i: number) => (
                <View key={i} style={{
                  flexDirection: "row",
                  gap: 10,
                  marginBottom: 8,
                  alignItems: "flex-start",
                }}>
                  <Text style={{ color: "#345bff", fontWeight: "700" }}>{i + 1}.</Text>
                  <Text style={{ color: "#e5e7eb", fontSize: 14, flex: 1, lineHeight: 20 }}>
                    {cause}
                  </Text>
                </View>
              ))}
            </View>

            {/* DIAGNOSIS STEPS */}
            <View style={{
              backgroundColor: "#11131a",
              borderRadius: 16,
              borderWidth: 1,
              borderColor: "#252838",
              padding: 16,
            }}>
              <Text style={{ color: "white", fontWeight: "700", fontSize: 16, marginBottom: 12 }}>
                📋 Diagnosis Steps
              </Text>
              {result.diagnosisSteps?.map((step: string, i: number) => (
                <View key={i} style={{
                  flexDirection: "row",
                  gap: 10,
                  marginBottom: 8,
                  alignItems: "flex-start",
                }}>
                  <View style={{
                    backgroundColor: "#345bff",
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    justifyContent: "center",
                    alignItems: "center",
                  }}>
                    <Text style={{ color: "white", fontSize: 11, fontWeight: "700" }}>{i + 1}</Text>
                  </View>
                  <Text style={{ color: "#e5e7eb", fontSize: 14, flex: 1, lineHeight: 20 }}>
                    {step}
                  </Text>
                </View>
              ))}
            </View>

            {/* PRO TIP */}
            <View style={{
              backgroundColor: "#0a1628",
              borderRadius: 16,
              borderWidth: 1,
              borderColor: "#345bff33",
              padding: 16,
            }}>
              <Text style={{ color: "#345bff", fontWeight: "700", fontSize: 14, marginBottom: 6 }}>
                💡 Pro Tip
              </Text>
              <Text style={{ color: "#e5e7eb", fontSize: 14, lineHeight: 20 }}>
                {result.proTip}
              </Text>
            </View>

            {/* YOUTUBE VIDEOS */}
            {videos.length > 0 && (
              <View style={{
                backgroundColor: "#11131a",
                borderRadius: 16,
                borderWidth: 1,
                borderColor: "#252838",
                padding: 16,
                marginBottom: 40,
              }}>
                <Text style={{ color: "white", fontWeight: "700", fontSize: 16, marginBottom: 12 }}>
                  📺 Repair Videos
                </Text>
                {videos.map((video) => (
                  <TouchableOpacity
                    key={video.videoId}
                    onPress={() => Linking.openURL(`https://www.youtube.com/watch?v=${video.videoId}`)}
                    style={{
                      flexDirection: "row",
                      gap: 12,
                      marginBottom: 12,
                      alignItems: "center",
                    }}
                  >
                    <Image
                      source={{ uri: video.thumbnail }}
                      style={{ width: 120, height: 68, borderRadius: 8 }}
                      resizeMode="cover"
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: "white", fontSize: 13, fontWeight: "600", lineHeight: 18 }} numberOfLines={2}>
                        {video.title}
                      </Text>
                      <Text style={{ color: "#6b7280", fontSize: 11, marginTop: 4 }}>
                        {video.channel}
                      </Text>
                      <Text style={{ color: "#345bff", fontSize: 11, marginTop: 2 }}>
                        ▶ Watch on YouTube
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}

          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
