import { useTheme } from "@context/ThemeContext";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import api from "@lib/api";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useRouter } from "expo-router";
import * as Speech from "expo-speech";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, Alert, Image, KeyboardAvoidingView, Linking,
  Platform, ScrollView, Text, TextInput, TouchableOpacity, View,
} from "react-native";

let ExpoSpeechRecognitionModule: any = null;
let useSpeechRecognitionEvent: any = () => {};
try {
  const mod = require("expo-speech-recognition");
  ExpoSpeechRecognitionModule = mod.ExpoSpeechRecognitionModule;
  useSpeechRecognitionEvent = mod.useSpeechRecognitionEvent;
} catch (e) {}

// Staged messages shown while a diagnosis is in flight. This is simulated
// progress (the backend makes one blocking call, it doesn't stream real
// stages back) but it's an honest description of what's actually
// happening server-side — search, cross-reference, compile — just not
// wired to real-time signals. Timings are tuned to roughly match how a
// typical multi-search diagnosis actually unfolds, so it lands on the
// last message right around when responses tend to arrive rather than
// looping past it.
const LOADING_STAGES = [
  { icon: "magnify", text: "Searching manufacturer specs..." },
  { icon: "wrench", text: "Checking torque & fastener specs..." },
  { icon: "compare-horizontal", text: "Cross-referencing sources..." },
  { icon: "clipboard-text-outline", text: "Compiling your diagnosis..." },
];
const LOADING_STAGE_DURATION_MS = 8000;

// Builds the plain-text script read aloud for a diagnosis result — meant
// for hands-free use in the shop, so it's phrased as continuous speech
// rather than mirroring the visual card layout exactly (no emoji, no
// bullet symbols, numbers spoken out as "Step 1" etc.).
function buildReadAloudScript(result: any): string {
  const parts: (string | null)[] = [
    result.summary,
    result.severity ? `Severity: ${result.severity}.` : null,
    result.estimatedCost ? `Estimated cost: ${result.estimatedCost}.` : null,
    result.immediateAction ? `Immediate action: ${result.immediateAction}` : null,
  ];

  if (result.causes?.length) {
    parts.push("Likely causes.");
    result.causes.forEach((cause: string, i: number) => parts.push(`${i + 1}. ${cause}`));
  }

  if (result.diagnosisSteps?.length) {
    parts.push("Diagnosis steps.");
    result.diagnosisSteps.forEach((step: any, i: number) => {
      const stepText = typeof step === "string" ? step : step?.text;
      const stepTip = typeof step === "string" ? null : step?.tip;
      parts.push(`Step ${i + 1}: ${stepText}${stepTip ? ` Tip: ${stepTip}` : ""}`);
    });
  }

  if (result.proTip) parts.push(`Pro tip: ${result.proTip}`);

  return parts.filter(Boolean).join(" ");
}

export default function Diagnose() {
  const { colors } = useTheme();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<any>(null);
  const [videos, setVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState(0);
  const [recording, setRecording] = useState(false);
  const [scanImage, setScanImage] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<any>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const loadingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useFocusEffect(useCallback(() => {
    const loadVehicles = async () => {
      try { const res = await api.get("/api/vehicles"); setVehicles(res.data || []); } catch {}
    };
    loadVehicles();
  }, []));

  useSpeechRecognitionEvent("result", (event: any) => {
    if (event.results[0]?.transcript) setQuery(event.results[0].transcript);
  });
  useSpeechRecognitionEvent("end", () => setRecording(false));

  // Drive the staged loading messages while a diagnosis request is in
  // flight. Starts over at stage 0 each time loading turns on, advances
  // on a timer, and holds on the final stage rather than looping — a
  // request that runs long just sits on "Compiling your diagnosis..."
  // instead of cycling back to "Searching..." which would look broken.
  useEffect(() => {
    if (loading) {
      setLoadingStage(0);
      loadingIntervalRef.current = setInterval(() => {
        setLoadingStage((prev) => Math.min(prev + 1, LOADING_STAGES.length - 1));
      }, LOADING_STAGE_DURATION_MS);
    } else if (loadingIntervalRef.current) {
      clearInterval(loadingIntervalRef.current);
      loadingIntervalRef.current = null;
    }
    return () => {
      if (loadingIntervalRef.current) clearInterval(loadingIntervalRef.current);
    };
  }, [loading]);

  // Stop any in-progress speech if the screen loses focus (user navigates
  // away) — nothing worse than a diagnosis reading itself out over
  // another screen. Also stopped explicitly on New Diagnosis / re-run.
  useFocusEffect(useCallback(() => {
    return () => { Speech.stop(); setIsSpeaking(false); };
  }, []));

  const handleReadAloud = () => {
    if (isSpeaking) {
      Speech.stop();
      setIsSpeaking(false);
      return;
    }
    if (!result) return;
    const script = buildReadAloudScript(result);
    setIsSpeaking(true);
    Speech.speak(script, {
      rate: 0.95,
      onDone: () => setIsSpeaking(false),
      onStopped: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false),
    });
  };

  const handleVoice = async () => {
    if (!ExpoSpeechRecognitionModule) { alert("Voice input is only available in the full app build."); return; }
    const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!granted) return;
    if (recording) { ExpoSpeechRecognitionModule.stop(); setRecording(false); }
    else { setRecording(true); ExpoSpeechRecognitionModule.start({ lang: "en-US", interimResults: true }); }
  };

  const handleScanPhoto = async () => {
    Alert.alert("Scan Vehicle Problem", "Take or choose a photo of the issue", [
      { text: "Take Photo", onPress: async () => {
        try {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== "granted") { Alert.alert("Permission needed", "Please allow camera access."); return; }
          const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.7, base64: true });
          if (result.canceled) return;
          await analyzeImage(result.assets[0]);
        } catch { Alert.alert("Error", "Could not open camera."); }
      }},
      { text: "Choose from Library", onPress: async () => {
        try {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== "granted") { Alert.alert("Permission needed", "Please allow photo library access."); return; }
          const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, quality: 0.7, base64: true });
          if (result.canceled) return;
          await analyzeImage(result.assets[0]);
        } catch { Alert.alert("Error", "Could not open photo library."); }
      }},
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const analyzeImage = async (asset: any) => {
    try {
      Speech.stop(); setIsSpeaking(false);
      setScanning(true); setResult(null); setVideos([]); setScanImage(asset.uri);
      const res = await api.post("/api/analyze-image-diagnosis", { imageBase64: asset.base64, mediaType: asset.mimeType || "image/jpeg" });
      if (res.data.error === "not_automotive") {
        Alert.alert("Not Automotive", "This image doesn't appear to show a vehicle problem."); setScanImage(null); return;
      }
      setResult(res.data);
      if (res.data.summary) {
        try { const videoRes = await api.get(`/api/youtube?query=${encodeURIComponent(res.data.summary)}`); setVideos(videoRes.data); } catch {}
      }
    } catch { Alert.alert("Error", "Could not analyze image. Please try again."); }
    finally { setScanning(false); }
  };

  const handleDiagnose = async () => {
    if (!query.trim()) return;
    Speech.stop(); setIsSpeaking(false);
    const vehicleContext = selectedVehicle ? `Vehicle: ${selectedVehicle.year} ${selectedVehicle.make} ${selectedVehicle.model}. ` : "";
    const fullQuery = vehicleContext + query;
    try {
  setLoading(true); setResult(null); setVideos([]); setScanImage(null);
  let diagRes;
  try {
    diagRes = await api.post("/api/diagnose", { query, vehicle: selectedVehicle || null });
  } catch (diagErr: any) {
    if (diagErr?.response?.status === 429) {
      Alert.alert("Daily Limit Reached", "You get 8 free diagnoses per day. Come back tomorrow! 🚗");
      return;
    }
    throw diagErr;
  }
  if (diagRes.data.error === "not_automotive") {
    Alert.alert("🚗 Automotive Only", "I can only help with vehicle problems. Try describing a car issue — a noise, a leak, a warning light, or a part like \"valve cover gasket.\"");
    return;
  }
  const videoRes = await api.get(`/api/youtube?query=${encodeURIComponent(fullQuery)}`);
  setResult(diagRes.data); setVideos(videoRes.data);
} catch { console.error("DIAGNOSE ERROR"); }
finally { setLoading(false); }
  };

  const handleShareToFeed = () => {
    if (!result) return;
    const vehicle = selectedVehicle ? `${selectedVehicle.year} ${selectedVehicle.make} ${selectedVehicle.model}` : null;
    const content = [
      vehicle ? `🚗 ${vehicle}` : null,
      `🔧 ${result.summary}`,
      `⚠️ Severity: ${result.severity}`,
      `💰 Est. Cost: ${result.estimatedCost}`,
      result.proTip ? `💡 Pro Tip: ${result.proTip}` : null,
      `\n#AutoAI #CarDiagnosis #DIY`,
    ].filter(Boolean).join("\n");

    router.push({
      pathname: "/(tabs)/create",
      params: { prefillContent: content },
    });
  };

  const severityColor = (severity: string) => {
    switch (severity) {
      case "Low": return "#10b981"; case "Medium": return "#f59e0b";
      case "High": return "#f97316"; case "Critical": return "#ef4444";
      default: return "#6b7280";
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={{ paddingTop: 60, paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: "row", alignItems: "center", gap: 10 }}>
        <MaterialCommunityIcons name="car-brake-alert" size={30} color="#facc15" />
        <View>
          <Text style={{ color: colors.text, fontSize: 28, fontWeight: "900" }}>AI Diagnose</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }}>Describe or scan your car problem</Text>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">

        {vehicles.length > 0 && (
          <View style={{ marginBottom: 16 }}>
            <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: "600", marginBottom: 8 }}>🚗 SELECT YOUR VEHICLE</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {vehicles.map((vehicle) => (
                <TouchableOpacity key={vehicle.id} onPress={() => setSelectedVehicle(selectedVehicle?.id === vehicle.id ? null : vehicle)}
                  style={{ backgroundColor: selectedVehicle?.id === vehicle.id ? colors.blue : colors.card, borderRadius: 12, borderWidth: 1, borderColor: selectedVehicle?.id === vehicle.id ? colors.blue : colors.border, paddingHorizontal: 14, paddingVertical: 10, alignItems: "center", minWidth: 100 }}>
                  <Text style={{ fontSize: 18 }}>🚗</Text>
                  <Text style={{ color: selectedVehicle?.id === vehicle.id ? "white" : colors.textSecondary, fontSize: 12, fontWeight: "700", marginTop: 4, textAlign: "center" }}>{vehicle.year} {vehicle.make}</Text>
                  <Text style={{ color: selectedVehicle?.id === vehicle.id ? "#ffffff99" : colors.textMuted, fontSize: 11, textAlign: "center" }}>{vehicle.model}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {selectedVehicle && (
              <Text style={{ color: colors.green, fontSize: 12, marginTop: 8 }}>
                ✓ AI will use your {selectedVehicle.year} {selectedVehicle.make} {selectedVehicle.model}{selectedVehicle.engine ? ` • ${selectedVehicle.engine}` : ""} as context
              </Text>
            )}
            {selectedVehicle && !selectedVehicle.vin && (
              <Text style={{ color: "#f59e0b", fontSize: 12, marginTop: 4 }}>
                💡 Add your VIN in My Garage for even more accurate results
              </Text>
            )}
          </View>
        )}

        <TouchableOpacity onPress={handleScanPhoto} disabled={scanning}
          style={{ backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: "#facc1544", borderStyle: "dashed", height: scanImage ? 180 : 100, justifyContent: "center", alignItems: "center", marginBottom: 14, overflow: "hidden" }}>
          {scanImage ? (
            <>
              <Image source={{ uri: scanImage }} style={{ width: "100%", height: 180 }} resizeMode="cover" />
              {scanning && (
                <View style={{ position: "absolute", backgroundColor: "rgba(0,0,0,0.75)", width: "100%", height: "100%", justifyContent: "center", alignItems: "center" }}>
                  <ActivityIndicator color="#facc15" size="large" />
                  <Text style={{ color: "white", marginTop: 12, fontWeight: "700" }}>🤖 AI analyzing...</Text>
                </View>
              )}
            </>
          ) : (
            <>
              <MaterialCommunityIcons name="camera" size={28} color="#facc15" />
              <Text style={{ color: "#facc15", fontWeight: "700", marginTop: 6 }}>Scan a Problem</Text>
              <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>Photo a warning light, leak, damage & more</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 14, gap: 10 }}>
          <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
          <Text style={{ color: colors.textMuted, fontSize: 12 }}>or describe it</Text>
          <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
        </View>

        <TextInput
          value={query} onChangeText={setQuery}
          placeholder={selectedVehicle ? `What's wrong with your ${selectedVehicle.year} ${selectedVehicle.make}?` : "e.g. My 2019 Honda Civic makes a grinding noise when braking..."}
          placeholderTextColor={colors.textMuted} multiline
          style={{ backgroundColor: colors.card, color: colors.text, paddingHorizontal: 16, paddingVertical: 14, borderRadius: 14, borderWidth: 1, borderColor: selectedVehicle ? colors.blue + "44" : colors.border, fontSize: 15, lineHeight: 22, minHeight: 100, textAlignVertical: "top", marginBottom: 8 }}
        />

        <Text style={{ color: colors.textMuted, fontSize: 11, marginBottom: 14, paddingHorizontal: 4 }}>
          🔒 Your description is sent to an AI service for analysis. See our{" "}
          <Text style={{ color: colors.blue }} onPress={() => Linking.openURL("https://mmz1969.github.io/Automotive-Ai/privacy-policy.html")}>Privacy Policy</Text> for details.
        </Text>

        <TouchableOpacity onPress={handleVoice}
          style={{ backgroundColor: recording ? "#ef4444" : colors.card, paddingVertical: 22, borderRadius: 16, borderWidth: 1, borderColor: recording ? "#ef4444" : colors.border, alignItems: "center", marginBottom: 14 }}>
          <MaterialCommunityIcons name="microphone" size={32} color={recording ? "white" : colors.textSecondary} />
          <Text style={{ color: recording ? "white" : colors.textSecondary, fontWeight: "700", fontSize: 16, marginTop: 8 }}>
            {recording ? "Listening... tap to stop" : "Tap to Speak"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={handleDiagnose} disabled={loading || (!query.trim() && !selectedVehicle)}
          style={{ backgroundColor: loading || (!query.trim() && !selectedVehicle) ? colors.border : colors.blue, paddingVertical: 22, borderRadius: 16, alignItems: "center", marginBottom: loading ? 14 : 24, flexDirection: "row", justifyContent: "center", gap: 10 }}>
          {loading ? (
            <><ActivityIndicator color="white" size="small" /><Text style={{ color: "white", fontWeight: "700", fontSize: 18 }}>Analyzing...</Text></>
          ) : (
            <><MaterialCommunityIcons name="car-brake-alert" size={24} color="white" /><Text style={{ color: "white", fontWeight: "700", fontSize: 18 }}>Run Diagnosis</Text></>
          )}
        </TouchableOpacity>

        {/* Staged loading panel — shows a believable checklist of what the
            AI is actually doing (real work, simulated pacing) instead of
            a blank spinner for 30-40 seconds. */}
        {loading && (
          <View style={{ backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.blue + "33", padding: 18, marginBottom: 24 }}>
            {LOADING_STAGES.map((stage, i) => {
              const isDone = i < loadingStage;
              const isCurrent = i === loadingStage;
              return (
                <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: i < LOADING_STAGES.length - 1 ? 14 : 0 }}>
                  <View style={{
                    width: 26, height: 26, borderRadius: 13, justifyContent: "center", alignItems: "center",
                    backgroundColor: isDone ? colors.green : isCurrent ? colors.blue : colors.background,
                    borderWidth: isDone || isCurrent ? 0 : 1, borderColor: colors.border,
                  }}>
                    {isDone ? (
                      <MaterialCommunityIcons name="check" size={16} color="white" />
                    ) : isCurrent ? (
                      <ActivityIndicator color="white" size="small" />
                    ) : (
                      <MaterialCommunityIcons name={stage.icon as any} size={14} color={colors.textMuted} />
                    )}
                  </View>
                  <Text style={{
                    color: isDone ? colors.textSecondary : isCurrent ? colors.text : colors.textMuted,
                    fontSize: 14, fontWeight: isCurrent ? "700" : "500", flex: 1,
                  }}>
                    {stage.text}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        {result && (
  <View style={{ gap: 14 }}>
    <View style={{ flexDirection: "row", gap: 10 }}>
      <TouchableOpacity
        onPress={() => { Speech.stop(); setIsSpeaking(false); setResult(null); setVideos([]); setScanImage(null); setQuery(""); }}
        style={{ flex: 1, backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingVertical: 12, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8 }}
      >
        <MaterialCommunityIcons name="refresh" size={18} color={colors.textSecondary} />
        <Text style={{ color: colors.textSecondary, fontWeight: "700" }}>New Diagnosis</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={handleShareToFeed}
        style={{ flex: 1, backgroundColor: colors.green, borderRadius: 12, paddingVertical: 12, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8 }}
      >
        <MaterialCommunityIcons name="share-variant" size={18} color="white" />
        <Text style={{ color: "white", fontWeight: "700" }}>Share to Feed</Text>
      </TouchableOpacity>
    </View>

            {/* Read Aloud — full-width and separate from the row above since
                this is the hands-free entry point: bigger target, easy to
                hit without looking closely at the screen with dirty hands. */}
            <TouchableOpacity
              onPress={handleReadAloud}
              style={{ backgroundColor: isSpeaking ? "#ef4444" : colors.card, borderRadius: 12, borderWidth: 1, borderColor: isSpeaking ? "#ef4444" : colors.blue + "44", paddingVertical: 14, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8 }}
            >
              <MaterialCommunityIcons name={isSpeaking ? "stop-circle-outline" : "volume-high"} size={22} color={isSpeaking ? "white" : colors.blue} />
              <Text style={{ color: isSpeaking ? "white" : colors.blue, fontWeight: "700", fontSize: 15 }}>
                {isSpeaking ? "Stop Reading" : "🔊 Read Diagnosis Aloud"}
              </Text>
            </TouchableOpacity>

            {/* Summary Card */}
            <View style={{ backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16 }}>
              <Text style={{ color: colors.text, fontSize: 18, fontWeight: "700", marginBottom: 8 }}>{result.summary}</Text>
              <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
                <View style={{ backgroundColor: severityColor(result.severity) + "33", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: severityColor(result.severity) }}>
                  <Text style={{ color: severityColor(result.severity), fontWeight: "700" }}>{result.severity} Severity</Text>
                </View>
                <View style={{ backgroundColor: colors.card, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: colors.border }}>
                  <Text style={{ color: colors.textSecondary, fontWeight: "700" }}>💰 {result.estimatedCost}</Text>
                </View>
                <View style={{ backgroundColor: colors.card, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: colors.border }}>
                  <Text style={{ color: colors.textSecondary, fontWeight: "700" }}>🔧 {result.diyDifficulty}</Text>
                </View>
              </View>
              <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 10, fontStyle: "italic" }}>⚠️ AI diagnosis is for informational purposes only. Always consult a certified mechanic for safety critical repairs.</Text>
            </View>

            {/* Immediate Action */}
            <View style={{ backgroundColor: "#1a0a0a", borderRadius: 16, borderWidth: 1, borderColor: "#ef444433", padding: 16 }}>
              <Text style={{ color: "#ef4444", fontWeight: "700", fontSize: 14, marginBottom: 6 }}>⚠️ Immediate Action</Text>
              <Text style={{ color: colors.text, fontSize: 14, lineHeight: 20 }}>{result.immediateAction}</Text>
            </View>

            {/* Likely Causes */}
            <View style={{ backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16 }}>
              <Text style={{ color: colors.text, fontWeight: "700", fontSize: 16, marginBottom: 12 }}>🔍 Likely Causes</Text>
              {result.causes?.map((cause: string, i: number) => (
                <View key={i} style={{ flexDirection: "row", gap: 10, marginBottom: 8, alignItems: "flex-start" }}>
                  <Text style={{ color: colors.blue, fontWeight: "700" }}>{i + 1}.</Text>
                  <Text style={{ color: colors.text, fontSize: 14, flex: 1, lineHeight: 20 }}>{cause}</Text>
                </View>
              ))}
            </View>

            {/* Diagnosis Steps */}
<View style={{ backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16 }}>
  <Text style={{ color: colors.text, fontWeight: "700", fontSize: 16, marginBottom: 12 }}>📋 Diagnosis Steps</Text>
  {result.diagnosisSteps?.map((step: any, i: number) => {
    // Backend now sends steps as { text, tip } objects, but keep a
    // fallback for plain-string steps (e.g. the image-diagnosis
    // endpoint, which hasn't been updated to this format).
    const stepText = typeof step === "string" ? step : step?.text;
    const stepTip = typeof step === "string" ? null : step?.tip;
    return (
      <View key={i} style={{ marginBottom: 12 }}>
        <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
          <View style={{ backgroundColor: colors.blue, width: 22, height: 22, borderRadius: 11, justifyContent: "center", alignItems: "center" }}>
            <Text style={{ color: "white", fontSize: 11, fontWeight: "700" }}>{i + 1}</Text>
          </View>
          <Text style={{ color: colors.text, fontSize: 14, flex: 1, lineHeight: 20 }}>{stepText}</Text>
        </View>
        {stepTip && (
          <View style={{ marginLeft: 32, marginTop: 6, backgroundColor: colors.background, borderRadius: 8, borderWidth: 1, borderColor: colors.blue + "33", padding: 8 }}>
            <Text style={{ color: colors.blue, fontSize: 12, fontWeight: "600" }}>💡 {stepTip}</Text>
          </View>
        )}
      </View>
    );
  })}
</View>

            {/* Pro Tip */}
            <View style={{ backgroundColor: colors.background, borderRadius: 16, borderWidth: 1, borderColor: colors.blue + "33", padding: 16 }}>
              <Text style={{ color: colors.blue, fontWeight: "700", fontSize: 14, marginBottom: 6 }}>💡 Pro Tip</Text>
              <Text style={{ color: colors.text, fontSize: 14, lineHeight: 20 }}>{result.proTip}</Text>
            </View>

            {/* eBay Parts Section */}
            {result.ebayParts && result.ebayParts.length > 0 && (
              <View style={{ backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: "#e5a00d44", padding: 16 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <Text style={{ color: colors.text, fontWeight: "700", fontSize: 16 }}>🛒 Parts You May Need</Text>
                </View>
                <Text style={{ color: colors.textMuted, fontSize: 11, marginBottom: 12, fontStyle: "italic" }}>
                  Price ranges from current eBay Motors listings. Verify part compatibility with your VIN before purchasing.
                </Text>
                {result.ebayParts.map((part: any, i: number) => (
                  <TouchableOpacity
                    key={i}
                    onPress={() => Linking.openURL(part.ebayUrl)}
                    style={{
                      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                      backgroundColor: colors.background, borderRadius: 12, borderWidth: 1,
                      borderColor: colors.border, padding: 12, marginBottom: 8,
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontWeight: "700", fontSize: 14, textTransform: "capitalize" }}>
                        {part.partName}
                      </Text>
                      <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }}>
                        {part.listingCount} listings found
                      </Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={{ color: "#e5a00d", fontWeight: "800", fontSize: 15 }}>
                        ${part.priceMin} – ${part.priceMax}
                      </Text>
                      <Text style={{ color: colors.blue, fontSize: 11, marginTop: 2 }}>Shop on eBay →</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Repair Videos */}
            {videos.length > 0 && (
              <View style={{ backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 40 }}>
                <Text style={{ color: colors.text, fontWeight: "700", fontSize: 16, marginBottom: 6 }}>📺 Repair Videos</Text>
                <Text style={{ color: colors.textMuted, fontSize: 11, marginBottom: 12, fontStyle: "italic" }}>Videos are AI matched and may not be exact.</Text>
                {videos.map((video) => (
                  <TouchableOpacity key={video.videoId} onPress={() => Linking.openURL(`https://www.youtube.com/watch?v=${video.videoId}`)} style={{ flexDirection: "row", gap: 12, marginBottom: 12, alignItems: "center" }}>
                    <Image source={{ uri: video.thumbnail }} style={{ width: 120, height: 68, borderRadius: 8 }} resizeMode="cover" />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontSize: 13, fontWeight: "600", lineHeight: 18 }} numberOfLines={2}>{video.title}</Text>
                      <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 4 }}>{video.channel}</Text>
                      <Text style={{ color: colors.blue, fontSize: 11, marginTop: 2 }}>▶ Watch on YouTube</Text>
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
