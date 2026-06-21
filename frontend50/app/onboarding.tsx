import { useTheme } from "@context/ThemeContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { Dimensions, FlatList, Text, TouchableOpacity, View } from "react-native";

const { width } = Dimensions.get("window");

const SLIDES = [
  { id: "1", emoji: "🚗", title: "Welcome to AutoAI™", subtitle: "Your AI co-pilot for cars — plus a community of enthusiasts, DIYers, and pro mechanics, all in one place." },
  { id: "2", emoji: "🤖", title: "AI Diagnostics", subtitle: "Describe a problem (or just speak it) and get an instant diagnosis: likely causes, severity, repair steps, suggested parts, and how-to videos." },
  { id: "3", emoji: "📣", title: "Community Feed", subtitle: "Share your builds, follow other gearheads, join local car shows, and climb the rep leaderboard." },
  { id: "4", emoji: "🛒", title: "Parts & Jobs", subtitle: "Buy and sell parts in the marketplace. DIYers can post jobs and hire help — mechanics can find work nearby." },
  { id: "5", emoji: "🏁", title: "Mechanics: Get Verified", subtitle: "A pro? Submit your credentials to earn the verified badge, appear on the Near Me map, and land more job requests." },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const flatListRef = useRef<FlatList>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleNext = () => {
    if (currentIndex < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
      setCurrentIndex(currentIndex + 1);
    } else {
      handleFinish();
    }
  };

  const handleFinish = async () => {
    await AsyncStorage.setItem("hasSeenOnboarding", "true");
    router.replace("/(auth)/login");
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        ref={flatListRef}
        data={SLIDES}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        renderItem={({ item }) => (
          <View style={{ width, flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 40 }}>
            <Text style={{ fontSize: 80, marginBottom: 32 }}>{item.emoji}</Text>
            <Text style={{ color: colors.text, fontSize: 28, fontWeight: "900", textAlign: "center", marginBottom: 16, lineHeight: 36 }}>
              {item.title}
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 16, textAlign: "center", lineHeight: 26 }}>
              {item.subtitle}
            </Text>
          </View>
        )}
      />

      {/* DOTS */}
      <View style={{ flexDirection: "row", justifyContent: "center", gap: 8, marginBottom: 32 }}>
        {SLIDES.map((_, index) => (
          <View
            key={index}
            style={{
              width: index === currentIndex ? 24 : 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: index === currentIndex ? colors.blue : colors.border,
            }}
          />
        ))}
      </View>

      {/* BUTTONS */}
      <View style={{ paddingHorizontal: 24, paddingBottom: 48, gap: 12 }}>
        <TouchableOpacity
          onPress={handleNext}
          style={{ backgroundColor: colors.blue, paddingVertical: 16, borderRadius: 14, alignItems: "center" }}
        >
          <Text style={{ color: "white", fontSize: 17, fontWeight: "700" }}>
            {currentIndex === SLIDES.length - 1 ? "Get Started 🚀" : "Next →"}
          </Text>
        </TouchableOpacity>

        {currentIndex < SLIDES.length - 1 && (
          <TouchableOpacity onPress={handleFinish} style={{ alignItems: "center", paddingVertical: 8 }}>
            <Text style={{ color: colors.textMuted, fontSize: 14 }}>Skip</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}