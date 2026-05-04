import { MaterialCommunityIcons } from "@expo/vector-icons";
import api from "@lib/api";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
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
  const [scanImage, setScanImage] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<any>(null);

  // Load user's vehicles when screen focuses
  useFocusEffect(
    useCallback(() => {
      const loadVehicles = async () => {
        try {
          const res = await api.get("/api/vehicles");
          setVehicles(res.data || []);
        } catch (err) {
          // silently fail
        }
      };
      loadVehicles();
    }, [])
  );

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

  const handleScanPhoto = async () => {
    Alert.alert(
      "Scan Vehicle Problem",
      "Take or choose a photo of the issue",
      [
        {
          text: "Take Photo",
          onPress: async () => {
            try {
              const { status } = await ImagePicker.requestCameraPermissionsAsync();
              if (status !== "granted") {
                Alert.alert("Permission needed", "Please allow camera access.");
                return;
              }
              const result = await ImagePicker.launchCameraAsync({
                allowsEditing: true,
                quality: 0.7,
                base64: true,
              });
              if (result.canceled) return;
              await analyzeImage(result.assets[0]);
            } catch (err) {
              Alert.alert("Error", "Could not open camera.");
            }
          },
        },
        {
          text: "Choose from Library",
          onPress: async () => {
            try {
              const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
              if (status !== "granted") {
                Alert.alert("Permission needed", "Please allow photo library access.");
                return;
              }
              const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ["images"],
                allowsEditing: true,
                quality: 0.7,
                base64: true,
              });
              if (result.canceled) return;
              await analyzeImage(result.assets[0]);
            } catch (err) {
              Alert.alert("Error", "Could not open photo library.");
            }
          },
        },
        { text: "Cancel", style: "cancel" },
      ]
    );
  };

  const analyzeImage = async (asset: any) => {
    try {
      setScanning(true);
      setResult(null);
      setVideos([]);
      setScanImage(asset.uri);

      const res = await api.post("/api/analyze-image-diagnosis", {
        imageBase64: asset.base64,
        mediaType: asset.mimeType || "image/jpeg",
      });

      if (res.data.error === "not_automotive") {
        Alert.alert("Not Automotive", "This image doesn't appear to show a vehicle problem. Please try another photo.");
        setScanImage(null);
        return;
      }

      setResult(res.data);

      if (res.data.summary) {
        try {
          const videoRes = await api.get(`/api/youtube?query=${encodeURIComponent(res.data.summary)}`);
          setVideos(videoRes.data);
        } catch (err) {
          // silently fail
        }
      }
    } catch (err) {
      console.error("SCAN ERROR:", err);
      Alert.alert("Error", "Could not analyze image. Please try again.");
    } finally {
      setScanning(false);
    }
  };

  const handleDiagnose = async () => {
    if (!query.trim()) return;

    const carKeywords = [
      "car", "truck", "vehicle", "automobile", "auto", "van", "minivan",
      "suv", "sedan", "coupe", "pickup", "hatchback", "wagon", "convertible",
      "motorcycle", "bike", "atv", "utv", "rv", "boat", "trailer",
      "engine", "motor", "transmission", "gearbox", "drivetrain", "driveshaft",
      "differential", "axle", "transfer case", "torque", "horsepower",
      "cylinder", "piston", "valve", "camshaft", "crankshaft", "timing",
      "turbo", "supercharger", "intercooler", "carburetor", "throttle",
      "intake", "injector", "fuel injection", "compression",
      "oil", "coolant", "antifreeze", "transmission fluid", "brake fluid",
      "power steering fluid", "washer fluid", "fluid", "leak", "drip",
      "fuel", "gas", "gasoline", "diesel", "petrol", "ethanol",
      "battery", "alternator", "starter", "fuse", "relay", "wiring",
      "electrical", "sensor", "module", "ecu", "computer", "code",
      "check engine", "warning light", "dashboard light", "obd",
      "abs light", "traction control", "airbag light", "voltage",
      "low voltage", "dead battery", "jump start",
      "brake", "rotor", "caliper", "pad", "drum", "abs", "parking brake",
      "emergency brake", "suspension", "shock", "strut", "spring",
      "control arm", "ball joint", "tie rod", "sway bar", "alignment",
      "steering", "power steering", "rack", "pinion",
      "tire", "tyre", "wheel", "rim", "flat", "blowout", "pressure",
      "tread", "rotation", "balance", "lug",
      "exhaust", "muffler", "catalytic converter", "cat", "dpf",
      "emission", "smoke", "fumes",
      "radiator", "thermostat", "water pump", "overheat", "temperature",
      "cooling", "fan", "hose",
      "noise", "sound", "squeal", "grind", "knock", "click", "rattle",
      "vibrat", "shak", "pull", "drift", "stall", "hesitat", "surge",
      "idle", "rough", "misfire", "backfire", "sputter",
      "hard start", "won't start", "dead", "slow", "sluggish",
      "accelerat", "decelerat", "bog", "lag", "lurch",
      "mechanic", "repair", "fix", "replace", "service", "maintenance",
      "inspect", "diagnose", "problem", "issue", "broken", "damaged",
      "worn", "failing", "bad", "blow", "bust",
      "driving", "drive", "highway", "city", "parking", "reverse",
      "gear", "shift", "rpm", "mph", "speed", "mileage", "odometer",
      "honda", "toyota", "ford", "chevy", "chevrolet", "gmc", "dodge",
      "ram", "jeep", "chrysler", "bmw", "mercedes", "benz", "audi",
      "volkswagen", "vw", "porsche", "volvo", "saab", "nissan", "infiniti",
      "hyundai", "kia", "genesis", "lexus", "acura", "subaru", "mazda",
      "mitsubishi", "suzuki", "isuzu", "tesla", "rivian", "lucid",
      "cadillac", "buick", "lincoln", "mercury", "pontiac", "oldsmobile",
      "saturn", "hummer", "land rover", "range rover", "jaguar", "mini",
      "fiat", "alfa romeo", "maserati", "ferrari", "lamborghini",
      "harley", "davidson", "kawasaki", "yamaha", "ducati", "triumph",
      "can-am", "polaris", "arctic cat",
      "spark plug", "gap", "torque spec", "oil change", "filter",
      "reset", "calibrate", "bleed", "flush", "rebuild", "gasket",
    ];

    const queryLower = query.toLowerCase();
    const isCarRelated = carKeywords.some(keyword => queryLower.includes(keyword));

    // Build the full query with vehicle context if selected
    const vehicleContext = selectedVehicle
      ? `Vehicle: ${selectedVehicle.year} ${selectedVehicle.make} ${selectedVehicle.model}${selectedVehicle.trim ? ` ${selectedVehicle.trim}` : ""}. `
      : "";

    const fullQuery = vehicleContext + query;

    if (!isCarRelated && !selectedVehicle) {
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
      setScanImage(null);

      const [diagRes, videoRes] = await Promise.all([
        api.post("/api/diagnose", { query: fullQuery }),
        api.get(`/api/youtube?query=${encodeURIComponent(fullQuery)}`),
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
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
      }}>
        <MaterialCommunityIcons name="car-brake-alert" size={30} color="#facc15" />
        <View>
          <Text style={{ color: "white", fontSize: 28, fontWeight: "900" }}>
            AI Diagnose
          </Text>
          <Text style={{ color: "#9ca3af", fontSize: 13, marginTop: 2 }}>
            Describe or scan your car problem
          </Text>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }}>

        {/* VEHICLE SELECTOR */}
        {vehicles.length > 0 && (
          <View style={{ marginBottom: 16 }}>
            <Text style={{ color: "#9ca3af", fontSize: 12, fontWeight: "600", marginBottom: 8 }}>
              🚗 SELECT YOUR VEHICLE
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {vehicles.map((vehicle) => (
                <TouchableOpacity
                  key={vehicle.id}
                  onPress={() => setSelectedVehicle(selectedVehicle?.id === vehicle.id ? null : vehicle)}
                  style={{
                    backgroundColor: selectedVehicle?.id === vehicle.id ? "#345bff" : "#11131a",
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: selectedVehicle?.id === vehicle.id ? "#345bff" : "#252838",
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    alignItems: "center",
                    minWidth: 100,
                  }}
                >
                  <Text style={{ fontSize: 18 }}>🚗</Text>
                  <Text style={{
                    color: selectedVehicle?.id === vehicle.id ? "white" : "#9ca3af",
                    fontSize: 12,
                    fontWeight: "700",
                    marginTop: 4,
                    textAlign: "center",
                  }}>
                    {vehicle.year} {vehicle.make}
                  </Text>
                  <Text style={{
                    color: selectedVehicle?.id === vehicle.id ? "#ffffff99" : "#6b7280",
                    fontSize: 11,
                    textAlign: "center",
                  }}>
                    {vehicle.model}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {selectedVehicle && (
              <Text style={{ color: "#10b981", fontSize: 12, marginTop: 8 }}>
                ✓ AI will use your {selectedVehicle.year} {selectedVehicle.make} {selectedVehicle.model} as context
              </Text>
            )}
          </View>
        )}

        {/* SCAN PHOTO BUTTON */}
        <TouchableOpacity
          onPress={handleScanPhoto}
          disabled={scanning}
          style={{
            backgroundColor: "#11131a",
            borderRadius: 14,
            borderWidth: 1,
            borderColor: "#facc1544",
            borderStyle: "dashed",
            height: scanImage ? 180 : 100,
            justifyContent: "center",
            alignItems: "center",
            marginBottom: 14,
            overflow: "hidden",
          }}
        >
          {scanImage ? (
            <>
              <Image source={{ uri: scanImage }} style={{ width: "100%", height: 180 }} resizeMode="cover" />
              {scanning && (
                <View style={{
                  position: "absolute",
                  backgroundColor: "rgba(0,0,0,0.75)",
                  width: "100%",
                  height: "100%",
                  justifyContent: "center",
                  alignItems: "center",
                }}>
                  <ActivityIndicator color="#facc15" size="large" />
                  <Text style={{ color: "white", marginTop: 12, fontWeight: "700" }}>
                    🤖 AI analyzing...
                  </Text>
                </View>
              )}
            </>
          ) : (
            <>
              <MaterialCommunityIcons name="camera" size={28} color="#facc15" />
              <Text style={{ color: "#facc15", fontWeight: "700", marginTop: 6 }}>
                Scan a Problem
              </Text>
              <Text style={{ color: "#6b7280", fontSize: 12, marginTop: 2 }}>
                Photo a warning light, leak, damage & more
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* DIVIDER */}
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 14, gap: 10 }}>
          <View style={{ flex: 1, height: 1, backgroundColor: "#252838" }} />
          <Text style={{ color: "#6b7280", fontSize: 12 }}>or describe it</Text>
          <View style={{ flex: 1, height: 1, backgroundColor: "#252838" }} />
        </View>

        {/* INPUT */}
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={selectedVehicle
            ? `What's wrong with your ${selectedVehicle.year} ${selectedVehicle.make} ${selectedVehicle.model}?`
            : "e.g. My 2019 Honda Civic makes a grinding noise when braking..."
          }
          placeholderTextColor="#4b5563"
          multiline
          style={{
            backgroundColor: "#11131a",
            color: "white",
            paddingHorizontal: 16,
            paddingVertical: 14,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: selectedVehicle ? "#345bff44" : "#252838",
            fontSize: 15,
            lineHeight: 22,
            minHeight: 100,
            textAlignVertical: "top",
            marginBottom: 8,
          }}
        />

        {/* AI DISCLOSURE */}
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
            paddingVertical: 22,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: recording ? "#ef4444" : "#252838",
            alignItems: "center",
            marginBottom: 14,
          }}
        >
          <MaterialCommunityIcons
            name="microphone"
            size={32}
            color={recording ? "white" : "#9ca3af"}
          />
          <Text style={{
            color: recording ? "white" : "#9ca3af",
            fontWeight: "700",
            fontSize: 16,
            marginTop: 8,
          }}>
            {recording ? "Listening... tap to stop" : "Tap to Speak"}
          </Text>
        </TouchableOpacity>

        {/* DIAGNOSE BUTTON */}
        <TouchableOpacity
          onPress={handleDiagnose}
          disabled={loading || (!query.trim() && !selectedVehicle)}
          style={{
            backgroundColor: loading || (!query.trim() && !selectedVehicle) ? "#1f2937" : "#345bff",
            paddingVertical: 22,
            borderRadius: 16,
            alignItems: "center",
            marginBottom: 24,
            flexDirection: "row",
            justifyContent: "center",
            gap: 10,
          }}
        >
          {loading ? (
            <>
              <ActivityIndicator color="white" size="small" />
              <Text style={{ color: "white", fontWeight: "700", fontSize: 18 }}>
                Analyzing...
              </Text>
            </>
          ) : (
            <>
              <MaterialCommunityIcons name="car-brake-alert" size={24} color="white" />
              <Text style={{ color: "white", fontWeight: "700", fontSize: 18 }}>
                Run Diagnosis
              </Text>
            </>
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
              {/* AI DISCLAIMER */}
              <Text style={{ color: "#6b7280", fontSize: 11, marginTop: 10, fontStyle: "italic" }}>
                ⚠️ AI diagnosis is for informational purposes only. Results may vary by vehicle trim and configuration. Always consult a certified mechanic for safety critical repairs.
              </Text>
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
                <Text style={{ color: "white", fontWeight: "700", fontSize: 16, marginBottom: 6 }}>
                  📺 Repair Videos
                </Text>
                <Text style={{ color: "#6b7280", fontSize: 11, marginBottom: 12, fontStyle: "italic" }}>
                  Videos are AI matched and may not be exact. Always verify with your owner's manual or a certified mechanic.
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
