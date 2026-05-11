import { useAuth } from "@context/AuthContext";
import api from "@lib/api";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

const PRESET_MESSAGES = [
  "🚗 Your vehicle is ready for pickup!",
  "🔧 Work is in progress on your vehicle",
  "🔍 Still diagnosing the issue",
  "💰 Estimate is ready — please call us",
  "⏳ Waiting on parts to arrive",
  "✅ Job is complete!",
  "📅 Please call to schedule your appointment",
  "🔑 Keys are ready at the front desk",
];

export default function QuickAlertScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [sending, setSending] = useState(false);

  const handleSearch = async (text: string) => {
    setQuery(text);
    if (text.trim().length < 2) {
      setResults([]);
      return;
    }
    try {
      setSearching(true);
      const res = await api.get(`/api/users/search?q=${text}`);
      setResults(res.data);
    } catch (err) {
      console.error("SEARCH ERROR:", err);
    } finally {
      setSearching(false);
    }
  };

  const handleSendAlert = async (message: string) => {
    if (!selectedCustomer) return;
    try {
      setSending(true);
      await api.post("/api/jobs/quick-alert", {
        customerId: selectedCustomer.id,
        message,
      });
      Alert.alert("✅ Alert Sent!", `${selectedCustomer.name} has been notified.`);
      setSelectedCustomer(null);
      setQuery("");
      setResults([]);
    } catch (err) {
      Alert.alert("Error", "Could not send alert. Try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#050509" }}>
      {/* HEADER */}
      <View style={{
        paddingTop: 60,
        paddingHorizontal: 20,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: "#252838",
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
      }}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: "#345bff", fontSize: 16 }}>← Back</Text>
        </TouchableOpacity>
        <Text style={{ color: "white", fontSize: 20, fontWeight: "900" }}>
          ⚡ Quick Alert
        </Text>
      </View>

      <View style={{ flex: 1, padding: 20 }}>
        {!selectedCustomer ? (
          <>
            <Text style={{ color: "#9ca3af", fontSize: 14, marginBottom: 16, lineHeight: 20 }}>
              Search for a customer by name and send them a quick notification — no job posting needed!
            </Text>

            {/* SEARCH */}
            <TextInput
              value={query}
              onChangeText={handleSearch}
              placeholder="Search customer by name..."
              placeholderTextColor="#4b5563"
              autoCapitalize="none"
              style={{
                backgroundColor: "#11131a",
                color: "white",
                paddingHorizontal: 16,
                paddingVertical: 12,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: "#252838",
                fontSize: 16,
                marginBottom: 16,
              }}
            />

            {searching ? (
              <ActivityIndicator color="#345bff" />
            ) : (
              <FlatList
                data={results}
                keyExtractor={(item) => item.id.toString()}
                ListEmptyComponent={
                  query.length >= 2 ? (
                    <Text style={{ color: "#6b7280", textAlign: "center", marginTop: 20 }}>
                      No customers found
                    </Text>
                  ) : null
                }
                renderItem={({ item }) => (
                  <TouchableOpacity
                    onPress={() => setSelectedCustomer(item)}
                    style={{
                      backgroundColor: "#11131a",
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: "#252838",
                      padding: 14,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                      marginBottom: 10,
                    }}
                  >
                    <View style={{
                      width: 44,
                      height: 44,
                      borderRadius: 22,
                      backgroundColor: "#1f2937",
                      justifyContent: "center",
                      alignItems: "center",
                      borderWidth: 2,
                      borderColor: item.role === "MECHANIC" ? "#345bff" : "#10b981",
                      overflow: "hidden",
                    }}>
                      {item.profilePhoto ? (
                        <Image source={{ uri: item.profilePhoto }} style={{ width: 44, height: 44, borderRadius: 22 }} />
                      ) : (
                        <Text style={{ color: "white", fontSize: 18, fontWeight: "bold" }}>
                          {item.name?.[0]?.toUpperCase() || "?"}
                        </Text>
                      )}
                    </View>
                    <View>
                      <Text style={{ color: "white", fontWeight: "700", fontSize: 16 }}>
                        {item.name}
                      </Text>
                      <Text style={{ color: "#6b7280", fontSize: 12 }}>
                        {item.role === "MECHANIC" ? "🏁 Mechanic" : "🔧 DIYer"}
                      </Text>
                    </View>
                    <Text style={{ color: "#345bff", marginLeft: "auto", fontSize: 13 }}>
                      Select →
                    </Text>
                  </TouchableOpacity>
                )}
              />
            )}
          </>
        ) : (
          <>
            {/* SELECTED CUSTOMER */}
            <View style={{
              backgroundColor: "#11131a",
              borderRadius: 12,
              borderWidth: 1,
              borderColor: "#10b981",
              padding: 14,
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              marginBottom: 24,
            }}>
              <View style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: "#1f2937",
                justifyContent: "center",
                alignItems: "center",
                borderWidth: 2,
                borderColor: "#10b981",
                overflow: "hidden",
              }}>
                {selectedCustomer.profilePhoto ? (
                  <Image source={{ uri: selectedCustomer.profilePhoto }} style={{ width: 44, height: 44, borderRadius: 22 }} />
                ) : (
                  <Text style={{ color: "white", fontSize: 18, fontWeight: "bold" }}>
                    {selectedCustomer.name?.[0]?.toUpperCase() || "?"}
                  </Text>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: "white", fontWeight: "700", fontSize: 16 }}>
                  {selectedCustomer.name}
                </Text>
                <Text style={{ color: "#10b981", fontSize: 12 }}>✅ Selected</Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedCustomer(null)}>
                <Text style={{ color: "#6b7280", fontSize: 13 }}>Change</Text>
              </TouchableOpacity>
            </View>

            <Text style={{ color: "#9ca3af", fontSize: 13, marginBottom: 12, fontWeight: "600", letterSpacing: 1, textTransform: "uppercase" }}>
              Select a message to send:
            </Text>

            {PRESET_MESSAGES.map((msg) => (
              <TouchableOpacity
                key={msg}
                onPress={() => handleSendAlert(msg)}
                disabled={sending}
                style={{
                  backgroundColor: "#11131a",
                  borderWidth: 1,
                  borderColor: "#252838",
                  padding: 14,
                  borderRadius: 12,
                  marginBottom: 10,
                }}
              >
                <Text style={{ color: "white", fontSize: 15 }}>{msg}</Text>
              </TouchableOpacity>
            ))}
          </>
        )}
      </View>
    </View>
  );
}