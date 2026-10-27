import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useRef } from "react";
import { Animated } from "react-native";

// The "like" icon. Outline flag when not given, checkered flag in the accent
// color when given. Waves + pops whenever it flips to active, so the meaning
// ("checkered flag" = props, not "flag/report") lands on the first tap.
export default function CheckeredFlag({
  active,
  size = 20,
  activeColor,
  inactiveColor,
}: {
  active: boolean;
  size?: number;
  activeColor: string;
  inactiveColor: string;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const wave = useRef(new Animated.Value(0)).current;
  const wasActive = useRef(active);

  useEffect(() => {
    if (active && !wasActive.current) {
      scale.setValue(0.5);
      wave.setValue(0);
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, friction: 3, tension: 160, useNativeDriver: true }),
        Animated.sequence(
          [1, -0.8, 0.5, -0.25, 0].map((v) =>
            Animated.timing(wave, { toValue: v, duration: 90, useNativeDriver: true })
          )
        ),
      ]).start();
    }
    wasActive.current = active;
  }, [active]);

  const rotate = wave.interpolate({ inputRange: [-1, 1], outputRange: ["-20deg", "20deg"] });

  return (
    <Animated.View style={{ transform: [{ scale }, { rotate }] }}>
      <MaterialCommunityIcons
        name={active ? "flag-checkered" : "flag-outline"}
        size={size}
        color={active ? activeColor : inactiveColor}
      />
    </Animated.View>
  );
}
