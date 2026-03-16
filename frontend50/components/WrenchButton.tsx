import { TouchableOpacity, StyleSheet } from "react-native";
import Svg, { Path, Defs, LinearGradient, Stop } from "react-native-svg";

export default function WrenchButton({ size = 70, onPress }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.button, { width: size, height: size, borderRadius: size / 2 }]}
      activeOpacity={0.8}
    >
      <Svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24">
        <Defs>
          {/* Gradient for the wrench icon */}
          <LinearGradient id="wrenchGradient" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor="#f97316" />   {/* Flame orange */}
            <Stop offset="40%" stopColor="#ef4444" />  {/* Hot red */}
            <Stop offset="70%" stopColor="#3b82f6" />  {/* Ember blue */}
            <Stop offset="100%" stopColor="#1e3a8a" /> {/* Deep cobalt */}
          </LinearGradient>

          {/* Background gradient */}
          <LinearGradient id="buttonGradient" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor="#f97316" />   {/* Flame orange */}
            <Stop offset="25%" stopColor="#ef4444" />  {/* Red heat */}
            <Stop offset="55%" stopColor="#3b82f6" />  {/* Cobalt light */}
            <Stop offset="100%" stopColor="#1e3a8a" /> {/* Deep cobalt */}
          </LinearGradient>
        </Defs>

        {/* Wrench Icon */}
        <Path
          fill="url(#wrenchGradient)"
          d="M22.7 19.3l-6.1-6.1c.9-2.1.5-4.7-1.2-6.4-1.7-1.7-4.3-2.1-6.4-1.2l3.1 3.1-2.8 2.8-3.1-3.1c-.9 2.1-.5 4.7 1.2 6.4 1.7 1.7 4.3 2.1 6.4 1.2l6.1 6.1c.4.4 1 .4 1.4 0l1.4-1.4c.4-.4.4-1 0-1.4z"
        />
      </Svg>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "transparent",
    overflow: "hidden",
  },
});