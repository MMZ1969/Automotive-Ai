import { useRouter } from "expo-router";
import React, { useState } from "react";
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

import { createVehicle } from "@lib/vehicles";

export default function AddVehicleScreen() {
  const router = useRouter();

  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [trim, setTrim] = useState("");
  const [color, setColor] = useState("");
  const [mileage, setMileage] = useState("");
  const [vin, setVin] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!make.trim() || !model.trim() || !year.trim()) {
      Alert.alert("Missing Fields", "Make, Model and Year are required.");
      return;
    }

    setLoading(true);
    try {
      await createVehicle({
        make,
        model,
        year: parseInt(year),
        trim,
        color,
        mileage: mileage ? parseInt(mileage) : 0,
        vin,
        notes,
      });
      router.back();
    } catch (err) {
      console.error("Error creating vehicle:", err);
      Alert.alert("Error", "Failed to save vehicle.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#050509" }}>
        <ActivityIndicator size="large" color="#345bff" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#050509" }}>
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        {/* HEADER */}
        <View style={{
          flexDirection: "row",
          alignItems: "center",
          marginBottom: 24,
        }}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ marginRight: 12 }}
          >
            <Text style={{ color: "#345bff", fontSize: 16 }}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Add Vehicle</Text>
        </View>

        <Text style={styles.label}>Make *</Text>
        <TextInput
          style={styles.input}
          value={make}
          onChangeText={setMake}
          placeholder="Ford, Chevy, Toyota..."
          placeholderTextColor="#6b7280"
        />

        <Text style={styles.label}>Model *</Text>
        <TextInput
          style={styles.input}
          value={model}
          onChangeText={setModel}
          placeholder="Mustang, Silverado, Supra..."
          placeholderTextColor="#6b7280"
        />

        <Text style={styles.label}>Year *</Text>
        <TextInput
          style={styles.input}
          value={year}
          onChangeText={setYear}
          placeholder="2024"
          placeholderTextColor="#6b7280"
          keyboardType="numeric"
        />

        <Text style={styles.label}>Trim</Text>
        <TextInput
          style={styles.input}
          value={trim}
          onChangeText={setTrim}
          placeholder="GT, LT, Sport..."
          placeholderTextColor="#6b7280"
        />

        <Text style={styles.label}>Color</Text>
        <TextInput
          style={styles.input}
          value={color}
          onChangeText={setColor}
          placeholder="Red, Black, Silver..."
          placeholderTextColor="#6b7280"
        />

        <Text style={styles.label}>Mileage</Text>
        <TextInput
          style={styles.input}
          value={mileage}
          onChangeText={setMileage}
          placeholder="50000"
          placeholderTextColor="#6b7280"
          keyboardType="numeric"
        />

        <Text style={styles.label}>VIN</Text>
        <TextInput
          style={styles.input}
          value={vin}
          onChangeText={setVin}
          placeholder="Vehicle Identification Number"
          placeholderTextColor="#6b7280"
          autoCapitalize="characters"
        />

        <Text style={styles.label}>Notes</Text>
        <TextInput
          style={[styles.input, { height: 120 }]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Any additional notes about the vehicle..."
          placeholderTextColor="#6b7280"
          multiline
        />

        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveButtonText}>🚗 Add Vehicle</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 22,
    fontWeight: "bold",
    color: "white",
  },
  label: {
    fontSize: 15,
    fontWeight: "600",
    color: "#9ca3af",
    marginTop: 16,
    marginBottom: 6,
  },
  input: {
    backgroundColor: "#11131a",
    color: "white",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#252838",
    fontSize: 15,
  },
  saveButton: {
    backgroundColor: "#345bff",
    padding: 16,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 24,
    marginBottom: 40,
  },
  saveButtonText: {
    color: "white",
    fontSize: 17,
    fontWeight: "700",
  },
});