import { useRouter } from "expo-router";
import {
    ScrollView,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

export default function CommunityGuidelines() {
  const router = useRouter();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: "#050509" }}
      contentContainerStyle={{ padding: 20 }}
    >
      {/* HEADER */}
      <View style={{
        marginTop: 20,
        marginBottom: 30,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
      }}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: "#345bff", fontSize: 16 }}>← Back</Text>
        </TouchableOpacity>
        <Text style={{ color: "white", fontSize: 24, fontWeight: "900" }}>
          Community Guidelines
        </Text>
      </View>

      {/* INTRO */}
      <View style={{
        backgroundColor: "#11131a",
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "#252838",
        padding: 20,
        marginBottom: 20,
      }}>
        <Text style={{ fontSize: 32, textAlign: "center", marginBottom: 12 }}>🚗</Text>
        <Text style={{ color: "white", fontSize: 18, fontWeight: "800", textAlign: "center", marginBottom: 8 }}>
          AutoAI is for Car People
        </Text>
        <Text style={{ color: "#9ca3af", fontSize: 14, textAlign: "center", lineHeight: 22 }}>
          This is a community built by car enthusiasts, for car enthusiasts. Keep it automotive, keep it respectful.
        </Text>
      </View>

      {/* WHAT WE ARE */}
      <Text style={sectionTitle}>✅ What Belongs Here</Text>
      <View style={card}>
        {[
          { icon: "🔧", title: "Car Questions", desc: "Ask about repairs, diagnostics, maintenance, and mods" },
          { icon: "🚗", title: "Builds & Vanity", desc: "Show off your ride, your garage, your project car" },
          { icon: "🏁", title: "Mechanic Services", desc: "Offer your services, post your work, build your reputation" },
          { icon: "🛒", title: "Parts Marketplace", desc: "Buy and sell automotive parts and accessories" },
          { icon: "⭐", title: "Reviews & Tips", desc: "Share your experience with shops, parts, and repairs" },
        ].map((item, i) => (
          <View key={i}>
            <View style={{ flexDirection: "row", gap: 14, padding: 16, alignItems: "flex-start" }}>
              <Text style={{ fontSize: 24 }}>{item.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: "white", fontWeight: "700", fontSize: 15, marginBottom: 4 }}>
                  {item.title}
                </Text>
                <Text style={{ color: "#9ca3af", fontSize: 13, lineHeight: 20 }}>
                  {item.desc}
                </Text>
              </View>
            </View>
            {i < 4 && <View style={{ height: 1, backgroundColor: "#252838", marginHorizontal: 16 }} />}
          </View>
        ))}
      </View>

      {/* WHAT WE ARE NOT */}
      <Text style={sectionTitle}>🚫 What Doesn't Belong Here</Text>
      <View style={card}>
        {[
          { icon: "🏴", title: "No Politics", desc: "This is not a political platform. Keep political opinions off AutoAI." },
          { icon: "✝️", title: "No Religion", desc: "Respect everyone's beliefs by keeping religion out of posts." },
          { icon: "💢", title: "No Offensive Content", desc: "Truck nuts, offensive flags, hate symbols — not here. Take it elsewhere." },
          { icon: "🗑️", title: "No Spam or Nonsense", desc: "Irrelevant posts, scams, and spam will be removed immediately." },
          { icon: "😡", title: "No Harassment", desc: "Treat every member with respect. Bullying and abuse will not be tolerated." },
        ].map((item, i) => (
          <View key={i}>
            <View style={{ flexDirection: "row", gap: 14, padding: 16, alignItems: "flex-start" }}>
              <Text style={{ fontSize: 24 }}>{item.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: "#ef4444", fontWeight: "700", fontSize: 15, marginBottom: 4 }}>
                  {item.title}
                </Text>
                <Text style={{ color: "#9ca3af", fontSize: 13, lineHeight: 20 }}>
                  {item.desc}
                </Text>
              </View>
            </View>
            {i < 4 && <View style={{ height: 1, backgroundColor: "#252838", marginHorizontal: 16 }} />}
          </View>
        ))}
      </View>

      {/* ENFORCEMENT */}
      <Text style={sectionTitle}>⚖️ Enforcement</Text>
      <View style={card}>
        {[
          { icon: "🚩", title: "Flag", desc: "Community members flag posts that violate guidelines" },
          { icon: "⚠️", title: "Warning", desc: "First offense gets a warning and post removal" },
          { icon: "🔨", title: "Ban", desc: "Repeat offenders are permanently banned — no exceptions" },
        ].map((item, i) => (
          <View key={i}>
            <View style={{ flexDirection: "row", gap: 14, padding: 16, alignItems: "flex-start" }}>
              <Text style={{ fontSize: 24 }}>{item.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: "white", fontWeight: "700", fontSize: 15, marginBottom: 4 }}>
                  {item.title}
                </Text>
                <Text style={{ color: "#9ca3af", fontSize: 13, lineHeight: 20 }}>
                  {item.desc}
                </Text>
              </View>
            </View>
            {i < 2 && <View style={{ height: 1, backgroundColor: "#252838", marginHorizontal: 16 }} />}
          </View>
        ))}
      </View>

      {/* MONETIZATION PHILOSOPHY */}
      <Text style={sectionTitle}>💚 Our Promise to You</Text>
      <View style={{
        backgroundColor: "#0a1a0a",
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "#10b98133",
        padding: 20,
        marginBottom: 20,
        gap: 12,
      }}>
        {[
          "🚗 Automotive content only — always",
          "💰 Mechanics keep 100% of their earnings",
          "🚫 No random ads — automotive only",
          "💚 Free to use — forever for the basics",
          "🔒 Your data is never sold",
        ].map((item, i) => (
          <Text key={i} style={{ color: "#10b981", fontSize: 14, lineHeight: 22 }}>
            {item}
          </Text>
        ))}
      </View>

      {/* CONTACT */}
      <View style={{
        backgroundColor: "#11131a",
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "#252838",
        padding: 20,
        marginBottom: 40,
        alignItems: "center",
      }}>
        <Text style={{ color: "#9ca3af", fontSize: 14, textAlign: "center", lineHeight: 22 }}>
          Questions or concerns? Reach out at{"\n"}
          <Text style={{ color: "#345bff" }}>maz@amazmade.com</Text>
        </Text>
      </View>

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
  marginTop: 8,
};

const card = {
  backgroundColor: "#11131a",
  borderRadius: 14,
  borderWidth: 1,
  borderColor: "#252838",
  marginBottom: 20,
  overflow: "hidden" as const,
};