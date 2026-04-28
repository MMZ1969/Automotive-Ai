import { useAuth } from "@context/AuthContext";
import { useRouter } from "expo-router";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";

export default function Settings() {
  const { user, logout, isMechanic } = useAuth();
  const router = useRouter();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: "#050509" }}
      contentContainerStyle={{ padding: 20 }}
    >
      {/* HEADER */}
      <View style={{ marginTop: 20, marginBottom: 30 }}>
        <Text style={{ color: "white", fontSize: 28, fontWeight: "bold" }}>
          ⚙️ Settings
        </Text>
        <Text style={{ color: "#9ca3af", marginTop: 4 }}>
          Account preferences & app settings
        </Text>
      </View>

      {/* ACCOUNT SECTION */}
      <Text style={sectionTitle}>Account</Text>

      <View style={card}>
        <View style={row}>
          <Text style={label}>Name</Text>
          <Text style={value}>{user?.name || "—"}</Text>
        </View>
        <View style={divider} />
        <View style={row}>
          <Text style={label}>Email</Text>
          <Text style={value}>{user?.email || "—"}</Text>
        </View>
        <View style={divider} />
        <View style={row}>
          <Text style={label}>Role</Text>
          <Text style={value}>{isMechanic ? "🏁 Mechanic" : "🔧 DIYer"}</Text>
        </View>
      </View>

      {/* APP SECTION */}
      <Text style={sectionTitle}>App</Text>

      <View style={card}>
        <View style={row}>
          <Text style={label}>Version</Text>
          <Text style={value}>1.0.0</Text>
        </View>
        <View style={divider} />
        <View style={row}>
          <Text style={label}>Build</Text>
          <Text style={value}>1</Text>
        </View>
      </View>

      {/* LEGAL SECTION */}
      <Text style={sectionTitle}>Legal</Text>

      <View style={card}>
        <TouchableOpacity
          style={row}
          onPress={() => {}}
        >
          <Text style={label}>Privacy Policy</Text>
          <Text style={{ color: "#345bff" }}>View →</Text>
        </TouchableOpacity>
        <View style={divider} />
        <TouchableOpacity
          style={row}
          onPress={() => {}}
        >
          <Text style={label}>Terms of Service</Text>
          <Text style={{ color: "#345bff" }}>View →</Text>
        </TouchableOpacity>
      </View>

      {/* LOGOUT */}
      <TouchableOpacity
        onPress={async () => await logout()}
        style={{
          backgroundColor: "#b91c1c",
          padding: 16,
          borderRadius: 14,
          marginTop: 20,
          marginBottom: 40,
          alignItems: "center",
        }}
      >
        <Text style={{ color: "white", fontWeight: "700", fontSize: 18 }}>
          Log Out
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const sectionTitle = {
  color: "#9ca3af",
  fontSize: 13,
  fontWeight: "600" as const,
  letterSpacing: 1,
  textTransform: "uppercase" as const,
  marginBottom: 8,
  marginTop: 20,
};

const card = {
  backgroundColor: "#11131a",
  borderRadius: 14,
  borderWidth: 1,
  borderColor: "#252838",
  marginBottom: 8,
  overflow: "hidden" as const,
};

const row = {
  flexDirection: "row" as const,
  justifyContent: "space-between" as const,
  alignItems: "center" as const,
  padding: 16,
};

const label = {
  color: "#f5f5f5",
  fontSize: 16,
};

const value = {
  color: "#9ca3af",
  fontSize: 16,
};

const divider = {
  height: 1,
  backgroundColor: "#252838",
  marginHorizontal: 16,
};
