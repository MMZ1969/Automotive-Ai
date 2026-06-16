import { useTheme } from "@context/ThemeContext";
import api from "@lib/api";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Callout, Marker, PROVIDER_GOOGLE } from "react-native-maps";

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || "";

interface MechanicPin {
  id: number;
  name: string;
  profilePhoto: string | null;
  repPoints: number;
  location: string;
  lat: number;
  lng: number;
  isVerified: boolean;
}

export default function NearMe() {
  const router = useRouter();
  const { colors } = useTheme();
  const mapRef = useRef<MapView>(null);

  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [mechanics, setMechanics] = useState<MechanicPin[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPin, setSelectedPin] = useState<MechanicPin | null>(null);
  const [locationError, setLocationError] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  useEffect(() => { initMap(); }, []);

  const initMap = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocationError(true);
        setLoading(false);
        return;
      }

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setUserLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });

      const res = await api.get("/api/users/mechanics");
      const geocoded: MechanicPin[] = [];

      for (const mechanic of res.data) {
        try {
          const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(mechanic.location)}&key=${GOOGLE_MAPS_API_KEY}`;
          const geoRes = await fetch(url);
          const geoData = await geoRes.json();
          if (geoData.results?.[0]) {
            const { lat, lng } = geoData.results[0].geometry.location;
            geocoded.push({
              id: mechanic.id,
              name: mechanic.name || "Mechanic",
              profilePhoto: mechanic.profilePhoto,
              repPoints: mechanic.repPoints || 0,
              location: mechanic.location,
              lat,
              lng,
              isVerified: mechanic.isVerified || false,
            });
          }
        } catch (err) {
          console.error("GEOCODE ERROR:", err);
        }
      }

      setMechanics(geocoded);
    } catch (err) {
      console.error("MAP INIT ERROR:", err);
      setLocationError(true);
    } finally {
      setLoading(false);
    }
  };

  const centerOnUser = () => {
    if (!userLocation || !mapRef.current) return;
    mapRef.current.animateToRegion({
      latitude: userLocation.lat,
      longitude: userLocation.lng,
      latitudeDelta: 0.1,
      longitudeDelta: 0.1,
    }, 500);
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator color={colors.blue} size="large" />
        <Text style={{ color: colors.textSecondary, marginTop: 16, fontSize: 14 }}>Finding mechanics near you...</Text>
      </View>
    );
  }

  if (locationError) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center", alignItems: "center", padding: 40 }}>
        <Text style={{ fontSize: 48, marginBottom: 16 }}>📍</Text>
        <Text style={{ color: colors.text, fontSize: 20, fontWeight: "700", textAlign: "center", marginBottom: 8 }}>Location Required</Text>
        <Text style={{ color: colors.textSecondary, textAlign: "center", marginBottom: 24 }}>AutoAI needs your location to show mechanics near you.</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ backgroundColor: colors.blue, padding: 14, borderRadius: 12, paddingHorizontal: 30 }}>
          <Text style={{ color: "white", fontWeight: "700" }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* HEADER */}
      <View style={{ paddingTop: 60, paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={{ color: colors.blue, fontSize: 16 }}>← Back</Text>
          </TouchableOpacity>
          <Text style={{ color: colors.text, fontSize: 22, fontWeight: "900" }}>📍 Near Me</Text>
        </View>
        <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 }}>
          <Text style={{ color: colors.green, fontSize: 13, fontWeight: "700" }}>{mechanics.length} Mechanic{mechanics.length !== 1 ? "s" : ""}</Text>
        </View>
      </View>

      {/* SEARCH BAR */}
      <View style={{ paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.card, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: colors.border }}>
          <Text style={{ fontSize: 16 }}>🔍</Text>
          <TextInput
            placeholder="Search mechanics by name or location..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={{ flex: 1, color: colors.text, fontSize: 14 }}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Text style={{ color: colors.textMuted, fontSize: 16 }}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={{ flex: 1 }}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={{ flex: 1 }}
          initialRegion={{
            latitude: userLocation?.lat || 37.78825,
            longitude: userLocation?.lng || -122.4324,
            latitudeDelta: 0.2,
            longitudeDelta: 0.2,
          }}
          customMapStyle={darkMapStyle}
          showsUserLocation
          showsMyLocationButton={false}
        >
          {mechanics.filter(m =>
            m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            m.location.toLowerCase().includes(searchQuery.toLowerCase())
          ).map((mechanic) => (
            <Marker
              key={mechanic.id}
              coordinate={{ latitude: mechanic.lat, longitude: mechanic.lng }}
              onPress={() => setSelectedPin(mechanic)}
            >
              <View style={{
                backgroundColor: mechanic.isVerified ? "#f59e0b" : "#9ca3af",
                borderRadius: 20, padding: 8, borderWidth: 2, borderColor: "white",
                alignItems: "center", justifyContent: "center",
              }}>
                <Text style={{ fontSize: 14 }}>{mechanic.isVerified ? "🏁" : "🔧"}</Text>
              </View>
              <Callout tooltip>
                <View style={{ backgroundColor: colors.card, borderRadius: 10, padding: 10, borderWidth: 1, borderColor: mechanic.isVerified ? "#f59e0b" : "#9ca3af", minWidth: 140 }}>
                  <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>{mechanic.name}</Text>
                  {mechanic.isVerified && <Text style={{ color: "#f59e0b", fontSize: 10, fontWeight: "700" }}>🏁 Verified Mechanic</Text>}
                  <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 2 }}>📍 {mechanic.location}</Text>
                </View>
              </Callout>
            </Marker>
          ))}
        </MapView>

        {/* CENTER BUTTON */}
        <TouchableOpacity onPress={centerOnUser} style={{ position: "absolute", bottom: selectedPin ? 220 : 24, right: 16, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12 }}>
          <Text style={{ fontSize: 20 }}>🎯</Text>
        </TouchableOpacity>

        {/* SELECTED PIN CARD */}
        {selectedPin && (
          <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: 1, borderColor: colors.border, padding: 20 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: colors.border, borderWidth: 2, borderColor: selectedPin.isVerified ? "#f59e0b" : "#9ca3af", justifyContent: "center", alignItems: "center" }}>
                <Text style={{ color: colors.text, fontSize: 18, fontWeight: "700" }}>{selectedPin.name[0]?.toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={{ color: colors.text, fontSize: 17, fontWeight: "700" }}>{selectedPin.name}</Text>
                  {selectedPin.isVerified && (
                    <View style={{ backgroundColor: "#1e3a8a", borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: "#60a5fa" }}>
                      <Text style={{ color: "white", fontSize: 10, fontWeight: "700" }}>🏁 Verified</Text>
                    </View>
                  )}
                </View>
                <Text style={{ color: colors.textSecondary, fontSize: 13 }}>📍 {selectedPin.location}</Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedPin(null)}>
                <Text style={{ color: colors.textMuted, fontSize: 20 }}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity
                onPress={() => { setSelectedPin(null); router.push(`/(tabs)/user/${selectedPin.id}`); }}
                style={{ flex: 1, backgroundColor: colors.blue, padding: 13, borderRadius: 10, alignItems: "center" }}
              >
                <Text style={{ color: "white", fontWeight: "700" }}>View Profile</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => { setSelectedPin(null); router.push("/(tabs)/mechanic/jobs"); }}
                style={{ flex: 1, backgroundColor: colors.card, padding: 13, borderRadius: 10, alignItems: "center", borderWidth: 1, borderColor: colors.border }}
              >
                <Text style={{ color: colors.text, fontWeight: "700" }}>View Jobs</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* NO MECHANICS OVERLAY */}
      {mechanics.filter(m =>
        m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.location.toLowerCase().includes(searchQuery.toLowerCase())
      ).length === 0 && !loading && (
        <View style={{ position: "absolute", top: "40%", left: 0, right: 0, alignItems: "center", padding: 40 }}>
          <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 24, borderWidth: 1, borderColor: colors.border, alignItems: "center" }}>
            <Text style={{ fontSize: 40, marginBottom: 12 }}>🔧</Text>
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: "700", textAlign: "center" }}>No mechanics found nearby</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 13, textAlign: "center", marginTop: 8 }}>Mechanics who set their service area will appear here</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const darkMapStyle = [
  { elementType: "geometry", stylers: [{ color: "#0a0a12" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#9ca3af" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#050509" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#1a1c2a" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#252838" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#252838" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#050509" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ color: "#252838" }] },
];