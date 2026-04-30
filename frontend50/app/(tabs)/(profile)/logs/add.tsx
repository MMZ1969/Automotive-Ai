import api from "@lib/api";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export default function AddLog() {
  const { vehicleId } = useLocalSearchParams();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [mileage, setMileage] = useState("");
  const [cost, setCost] = useState("");
  const [category, setCategory] = useState("Maintenance");
  const [saving, setSaving] = useState(false);

  const categories = ["Maintenance", "Repair", "Modification", "Inspection", "Other"];
  
  console.log("VEHICLE ID FROM PARAMS:", vehicleId);

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert("Missing fields", "Title is required.");
      return;
    }
    try {
      setSaving(true);
      await api.post(`/api/logs/vehicle/${vehicleId}`, {
  title: title.trim(),
  description: description.trim(),
  mileage: mileage ? Number(mileage) : null,
  cost: cost ? Number(cost) : null,
  category,
  });
      Alert.alert("✅ Log Added!", "Your maintenance log has been saved.");
      router.back();
    } catch (err) {
      console.error("ADD LOG ERROR:", err);
      Alert.alert("Error", "Could not save log. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#050509" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* HEADER */}
      <View style={{
        paddingTop: 60, paddingHorizontal: 20, paddingBottom: 16,
        borderBottomWidth: 1, borderBottomColor: "#252838",
        flexDirection: "row", alignItems: "center", gap: 12,
      }}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: "#345bff", fontSize: 16 }}>← Back</Text>
        </TouchableOpacity>
        <Text style={{ color: "white", fontSize: 22, fontWeight: "900" }}>🔧 Add Log</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">

        <TextInput
          placeholder="Title (e.g. Oil Change)"
          placeholderTextColor="#4b5563"
          value={title}
          onChangeText={setTitle}
          style={inputStyle}
        />

        <TextInput
          placeholder="Description (optional)"
          placeholderTextColor="#4b5563"
          value={description}
          onChangeText={setDescription}
          multiline
          style={[inputStyle, { minHeight: 80, textAlignVertical: "top" }]}
        />

        <TextInput
          placeholder="Mileage (optional)"
          placeholderTextColor="#4b5563"
          value={mileage}
          onChangeText={setMileage}
          keyboardType="numeric"
          style={inputStyle}
        />

        <TextInput
          placeholder="Cost (optional, e.g. 49.99)"
          placeholderTextColor="#4b5563"
          value={cost}
          onChangeText={setCost}
          keyboardType="numeric"
          style={inputStyle}
        />

        {/* CATEGORY */}
        <Text style={{ color: "#9ca3af", fontSize: 13, marginBottom: 8 }}>Category</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat}
              onPress={() => setCategory(cat)}
              style={{
                backgroundColor: category === cat ? "#345bff" : "#11131a",
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: category === cat ? "#345bff" : "#252838",
              }}
            >
              <Text style={{ color: category === cat ? "white" : "#9ca3af", fontWeight: "600" }}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          onPress={handleSave}
          disabled={saving}
          style={{
            backgroundColor: saving ? "#1f2937" : "#345bff",
            padding: 16,
            borderRadius: 14,
            alignItems: "center",
            marginTop: 10,
          }}
        >
          <Text style={{ color: "white", fontWeight: "700", fontSize: 16 }}>
            {saving ? "Saving..." : "💾 Save Log"}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const inputStyle = {
  backgroundColor: "#11131a",
  color: "white" as const,
  padding: 12,
  borderRadius: 10,
  borderWidth: 1,
  borderColor: "#252838",
  marginBottom: 12,
  fontSize: 15,
};