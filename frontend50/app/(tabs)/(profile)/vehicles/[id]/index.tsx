import { useTheme } from "@context/ThemeContext";
import api from "@lib/api";
import { fetchVehicleById } from "@lib/vehicles";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import WrenchButton from "@components/WrenchButton";

// Styles depend on the active theme's colors, so this is a function
// called with colors inside the component rather than a static
// StyleSheet.create at module scope — lets light/dark switch correctly
// instead of being frozen to whatever colors were active on first import.
function getStyles(colors: any) {
  return StyleSheet.create({
    title: { fontSize: 26, fontWeight: "bold", color: colors.text },
    subtitle: { fontSize: 15, color: colors.textSecondary, marginTop: 4 },
    card: {
      backgroundColor: colors.card,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      marginBottom: 20,
    },
    row: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingVertical: 8 },
    divider: { height: 1, backgroundColor: colors.border },
    label: { fontSize: 15, fontWeight: "600", color: colors.textSecondary, flex: 1 },
    value: { fontSize: 15, color: colors.text, flex: 2, textAlign: "right" },
    logsButton: {
      backgroundColor: colors.card,
      padding: 16,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      marginBottom: 80,
    },
    logsButtonText: { color: colors.text, fontSize: 17, fontWeight: "700" },
    editLabel: { fontSize: 15, fontWeight: "600", color: colors.textSecondary, marginTop: 16, marginBottom: 6 },
    input: {
      backgroundColor: colors.card,
      color: colors.text,
      padding: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      fontSize: 15,
    },
  });
}

export default function VehicleDetailsScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = getStyles(colors);

  const [vehicle, setVehicle] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit fields
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [trim, setTrim] = useState("");
  const [color, setColor] = useState("");
  const [mileage, setMileage] = useState("");
  const [vin, setVin] = useState("");
  const [notes, setNotes] = useState("");
  const [decodedVinData, setDecodedVinData] = useState<any>({});

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      setLoading(true);
      try {
        const data = await fetchVehicleById(id as string);
        setVehicle(data);
        populateFields(data);
      } catch (err) {
        console.error("Error loading vehicle:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const decodeVinOnFrontend = async (vinValue: string) => {
    if (vinValue.length !== 17) return;
    try {
      const res = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${vinValue}?format=json`);
      const data = await res.json();
      const v = data.Results?.[0];
      if (v) {
        setDecodedVinData({
          engine: v.DisplacementL && v.EngineCylinders
            ? `${parseFloat(v.DisplacementL).toFixed(1)}L ${v.EngineCylinders}-Cylinder`
            : null,
          engineCylinders: v.EngineCylinders || null,
          displacement: v.DisplacementL || null,
          driveType: v.DriveType || null,
        });
      }
    } catch (err) {
      console.error("VIN DECODE ERROR:", err);
    }
  };

  const populateFields = (data: any) => {
    setMake(data.make || "");
    setModel(data.model || "");
    setYear(data.year?.toString() || "");
    setTrim(data.trim || "");
    setColor(data.color || "");
    setMileage(data.mileage?.toString() || "");
    setVin(data.vin || "");
    setNotes(data.notes || "");
    // Auto-decode VIN if present and engine data is missing
    if (data.vin && data.vin.length === 17 && !data.engine) {
      decodeVinOnFrontend(data.vin);
    }
  };

  const openLogs = () => {
    router.push(`/(tabs)/(profile)/vehicles/${id}/logs`);
  };

  const handleDelete = () => {
    Alert.alert(
      "Delete Vehicle",
      `Are you sure you want to delete your ${vehicle.year} ${vehicle.make} ${vehicle.model}? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              setDeleting(true);
              await api.delete(`/api/vehicles/${id}`);
              router.push("/(tabs)/(profile)/vehicles");
            } catch (err) {
              console.error("DELETE VEHICLE ERROR:", err);
              Alert.alert("Error", "Could not delete vehicle. Try again.");
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  const handleSave = async () => {
    if (!make.trim() || !model.trim() || !year.trim()) {
      Alert.alert("Missing Fields", "Make, Model and Year are required.");
      return;
    }
    try {
      setSaving(true);
      const res = await api.put(`/api/vehicles/${id}`, {
        make,
        model,
        year: parseInt(year),
        trim,
        color,
        mileage: mileage ? parseInt(mileage) : 0,
        vin,
        notes,
        ...decodedVinData,
      });
      setVehicle(res.data);
      setEditing(false);
      Alert.alert("✅ Saved!", "Vehicle updated successfully.");
    } catch (err) {
      console.error("UPDATE VEHICLE ERROR:", err);
      Alert.alert("Error", "Could not update vehicle. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    populateFields(vehicle);
    setEditing(false);
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.blue} />
      </SafeAreaView>
    );
  }

  if (!vehicle) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }}>
        <Text style={{ color: colors.text, fontSize: 18 }}>Vehicle not found.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: 20 }}>

        {/* HEADER */}
        <View style={{ marginBottom: 24 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <TouchableOpacity onPress={() => router.push("/(tabs)/(profile)/vehicles")}>
              <Text style={{ color: colors.blue, fontSize: 16 }}>← Back</Text>
            </TouchableOpacity>

            <View style={{ flexDirection: "row", gap: 10 }}>
              {/* EDIT / CANCEL BUTTON */}
              <TouchableOpacity
                onPress={editing ? handleCancelEdit : () => setEditing(true)}
                style={{
                  backgroundColor: colors.card,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text style={{ color: editing ? colors.textMuted : colors.blue, fontSize: 13, fontWeight: "700" }}>
                  {editing ? "Cancel" : "✏️ Edit"}
                </Text>
              </TouchableOpacity>

              {/* DELETE BUTTON */}
              {!editing && (
                <TouchableOpacity
                  onPress={handleDelete}
                  disabled={deleting}
                  style={{
                    backgroundColor: colors.card,
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: "#ef444444",
                  }}
                >
                  <Text style={{ color: "#ef4444", fontSize: 13, fontWeight: "700" }}>
                    {deleting ? "Deleting..." : "🗑️ Delete"}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {!editing && (
            <>
              <Text style={styles.title}>
                {vehicle.year} {vehicle.make} {vehicle.model}
              </Text>
              {vehicle.trim && <Text style={styles.subtitle}>{vehicle.trim}</Text>}
              {vehicle.color && <Text style={styles.subtitle}>🎨 {vehicle.color}</Text>}
            </>
          )}
        </View>

        {/* VIEW MODE */}
        {!editing ? (
          <>
            <View style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.label}>🛣 Mileage</Text>
                <Text style={styles.value}>
                  {vehicle.mileage ? Number(vehicle.mileage).toLocaleString() + " miles" : "N/A"}
                </Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.row}>
                <Text style={styles.label}>🔑 VIN</Text>
                <Text style={styles.value}>{vehicle.vin || "N/A"}</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.row}>
                <Text style={styles.label}>📝 Notes</Text>
                <Text style={styles.value}>{vehicle.notes || "No notes added."}</Text>
              </View>
            </View>

            <TouchableOpacity onPress={openLogs} style={styles.logsButton}>
            <Text style={styles.logsButtonText}>📋 View Maintenance Logs</Text>
          </TouchableOpacity>

          <WrenchButton onPress={() => router.push(`/(tabs)/(profile)/vehicles/${id}/logs/add`)} />
          </>
        ) : (
          // EDIT MODE
          <>
            <Text style={styles.editLabel}>Make *</Text>
            <TextInput style={styles.input} value={make} onChangeText={setMake} placeholder="Ford, Chevy, Toyota..." placeholderTextColor={colors.textMuted} />

            <Text style={styles.editLabel}>Model *</Text>
            <TextInput style={styles.input} value={model} onChangeText={setModel} placeholder="Mustang, Silverado, Supra..." placeholderTextColor={colors.textMuted} />

            <Text style={styles.editLabel}>Year *</Text>
            <TextInput style={styles.input} value={year} onChangeText={setYear} placeholder="2024" placeholderTextColor={colors.textMuted} keyboardType="numeric" />

            <Text style={styles.editLabel}>Trim</Text>
            <TextInput style={styles.input} value={trim} onChangeText={setTrim} placeholder="GT, LT, Sport..." placeholderTextColor={colors.textMuted} />

            <Text style={styles.editLabel}>Color</Text>
            <TextInput style={styles.input} value={color} onChangeText={setColor} placeholder="Red, Black, Silver..." placeholderTextColor={colors.textMuted} />

            <Text style={styles.editLabel}>Mileage</Text>
            <TextInput style={styles.input} value={mileage} onChangeText={setMileage} placeholder="50000" placeholderTextColor={colors.textMuted} keyboardType="numeric" />

            <Text style={styles.editLabel}>VIN</Text>
            <TextInput 
              style={styles.input} 
              value={vin} 
              onChangeText={(text) => { setVin(text); decodeVinOnFrontend(text); }} 
              placeholder="Vehicle Identification Number" 
              placeholderTextColor={colors.textMuted} 
              autoCapitalize="characters" 
            />

            <Text style={styles.editLabel}>Notes</Text>
            <TextInput style={[styles.input, { height: 120, textAlignVertical: "top" }]} value={notes} onChangeText={setNotes} placeholder="Any additional notes..." placeholderTextColor={colors.textMuted} multiline />

            <TouchableOpacity
              onPress={handleSave}
              disabled={saving}
              style={{
                backgroundColor: saving ? colors.border : colors.blue,
                padding: 16,
                borderRadius: 14,
                alignItems: "center",
                marginTop: 24,
                marginBottom: 40,
              }}
            >
              {saving ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={{ color: "white", fontSize: 17, fontWeight: "700" }}>💾 Save Changes</Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
