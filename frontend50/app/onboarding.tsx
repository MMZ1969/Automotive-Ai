import { useTheme } from "@context/ThemeContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { Dimensions, FlatList, Text, TouchableOpacity, View } from "react-native";

const { width } = Dimensions.get("window");

const SLIDES = [
  { id: "1", emoji: "🚗", title: "Welcome to AutoAI™", subtitle: "The social platform built exclusively for car enthusiasts, DIYers, and professional mechanics." },
  { id: "2", emoji: "🔧", title: "Get Help. Share Builds.", subtitle: "Post questions, show off your ride, and connect with mechanics who can get the job done." },
  { id: "3", emoji: "🤖", title: "AI-Powered Diagnostics", subtitle: "Describe your car problem and get instant AI diagnosis — severity, causes, costs, and repair steps." },
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