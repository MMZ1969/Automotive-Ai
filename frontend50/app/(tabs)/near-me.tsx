import api from "@lib/api";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Text,
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
  const mapRef = useRef<MapView>(null);

  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [mechanics, setMechanics] = useState<MechanicPin[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPin, setSelectedPin] = useState<MechanicPin | null>(null);
  const [locationError, setLocationError] = useState(false);

  useEffect(() => { initMap(); }, []);

  const initMap = async () => {
    try {
      console.log("=== NEAR ME INIT ===");
      console.log("GOOGLE KEY:", GOOGLE_MAPS_API_KEY ? "EXISTS ✅" : "MISSING ❌");

      // 1. Get user location
      const { status } = await Location.requestForegroundPermissionsAsync();
      console.log("LOCATION PERMISSION:", status);
      if (status !== "granted") {
        setLocationError(true);
        setLoading(false);
        return;
      }

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      console.log("USER LOCATION:", loc.coords.latitude, loc.coords.longitude);
      setUserLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });

      // 2. Fetch mechanics
      const res = await api.get("/api/users/mechanics");
      console.log("MECHANICS COUNT:", res.data.length);
      console.log("MECHANICS:", JSON.stringify(res.data));

      const mechanicsWithLocation = res.data;

      // 3. Geocode each mechanic
      const geocoded: MechanicPin[] = [];

      for (const mechanic of mechanicsWithLocation) {
        console.log("GEOCODING:", mechanic.location, "key:", GOOGLE_MAPS_API_KEY ? "present" : "MISSING");
        try {
          const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(mechanic.location)}&key=${GOOGLE_MAPS_API_KEY}`;
          console.log("GEOCODE URL:", url);
          const geoRes = await fetch(url);
          const geoData = await geoRes.json();
          console.log("GEOCODE STATUS:", geoData.status);
          console.log("GEOCODE RESULTS:", geoData.results?.length);

          if (geoData.results?.[0]) {
            const { lat, lng } = geoData.results[0].geometry.location;
            console.log("PIN ADDED:", mechanic.name, lat, lng);
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
          } else {
            console.log("NO GEOCODE RESULTS FOR:", mechanic.location, "STATUS:", geoData.status, "ERROR:", geoData.error_message);
          }
        } catch (err) {
          console.error("GEOCODE ERROR:", err);
        }
      }

      console.log("TOTAL PINS:", geocoded.length);
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
      <View style={{ flex: 1, backgroundColor: "#050509", justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator color="#345bff" size="large" />
        <Text style={{ color: "#9ca3af", marginTop: 16, fontSize: 14 }}>Finding mechanics near you...</Text>
      </View>
    );
  }

  if (locationError) {
    return (
      <View style={{ flex: 1, backgroundColor: "#050509", justifyContent: "center", alignItems: "center", padding: 40 }}>
        <Text style={{ fontSize: 48, marginBottom: 16 }}>📍</Text>
        <Text style={{ color: "white", fontSize: 20, fontWeight: "700", textAlign: "center", marginBottom: 8 }}>Location Required</Text>
        <Text style={{ color: "#9ca3af", textAlign: "center", marginBottom: 24 }}>AutoAI needs your location to show mechanics near you.</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ backgroundColor: "#345bff", padding: 14, borderRadius: 12, paddingHorizontal: 30 }}>
          <Text style={{ color: "white", fontWeight: "700" }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#050509" }}>
      <View style={{ paddingTop: 60, paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: "#252838", flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={{ color: "#345bff", fontSize: 16 }}>← Back</Text>
          </TouchableOpacity>
          <Text style={{ color: "white", fontSize: 22, fontWeight: "900" }}>📍 Near Me</Text>
        </View>
        <View style={{ backgroundColor: "#11131a", borderWidth: 1, borderColor: "#252838", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 }}>
          <Text style={{ color: "#10b981", fontSize: 13, fontWeight: "700" }}>{mechanics.length} Mechanic{mechanics.length !== 1 ? "s" : ""}</Text>
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
          {mechanics.map((mechanic) => (
            <Marker
              key={mechanic.id}
              coordinate={{ latitude: mechanic.lat, longitude: mechanic.lng }}
              onPress={() => setSelectedPin(mechanic)}
            >
              <View style={{ backgroundColor: mechanic.isVerified ? "#f59e0b" : "#345bff", borderRadius: 20, padding: 8, borderWidth: 2, borderColor: "white", alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: 14 }}>{mechanic.isVerified ? "🏁" : "🔧"}</Text>
              </View>
              <Callout tooltip>
                <View style={{ backgroundColor: "#11131a", borderRadius: 10, padding: 10, borderWidth: 1, borderColor: mechanic.isVerified ? "#f59e0b" : "#252838", minWidth: 140 }}>
                  <Text style={{ color: "white", fontWeight: "700", fontSize: 13 }}>{mechanic.name}</Text>
                  {mechanic.isVerified && <Text style={{ color: "#f59e0b", fontSize: 10, fontWeight: "700" }}>🏁 Verified Mechanic</Text>}
                  <Text style={{ color: "#9ca3af", fontSize: 11, marginTop: 2 }}>📍 {mechanic.location}</Text>
                </View>
              </Callout>
            </Marker>
          ))}
        </MapView>

        <TouchableOpacity onPress={centerOnUser} style={{ position: "absolute", bottom: selectedPin ? 220 : 24, right: 16, backgroundColor: "#11131a", borderWidth: 1, borderColor: "#252838", borderRadius: 12, padding: 12 }}>
          <Text style={{ fontSize: 20 }}>🎯</Text>
        </TouchableOpacity>

        {selectedPin && (
          <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "#11131a", borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: 1, borderColor: "#252838", padding: 20 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: "#252838", borderWidth: 2, borderColor: selectedPin.isVerified ? "#f59e0b" : "#345bff", justifyContent: "center", alignItems: "center" }}>
                <Text style={{ color: "white", fontSize: 18, fontWeight: "700" }}>{selectedPin.name[0]?.toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={{ color: "white", fontSize: 17, fontWeight: "700" }}>{selectedPin.name}</Text>
                  {selectedPin.isVerified && (
                    <View style={{ backgroundColor: "#1e3a8a", borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: "#60a5fa" }}>
                      <Text style={{ color: "white", fontSize: 10, fontWeight: "700" }}>🏁 Verified</Text>
                    </View>
                  )}
                </View>
                <Text style={{ color: "#9ca3af", fontSize: 13 }}>📍 {selectedPin.location}</Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedPin(null)}>
                <Text style={{ color: "#6b7280", fontSize: 20 }}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity onPress={() => { setSelectedPin(null); router.push(`/(tabs)/user/${selectedPin.id}`); }} style={{ flex: 1, backgroundColor: "#345bff", padding: 13, borderRadius: 10, alignItems: "center" }}>
                <Text style={{ color: "white", fontWeight: "700" }}>View Profile</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setSelectedPin(null); router.push("/(tabs)/mechanic/jobs"); }} style={{ flex: 1, backgroundColor: "#11131a", padding: 13, borderRadius: 10, alignItems: "center", borderWidth: 1, borderColor: "#252838" }}>
                <Text style={{ color: "white", fontWeight: "700" }}>View Jobs</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {mechanics.length === 0 && !loading && (
        <View style={{ position: "absolute", top: "40%", left: 0, right: 0, alignItems: "center", padding: 40 }}>
          <View style={{ backgroundColor: "#11131a", borderRadius: 16, padding: 24, borderWidth: 1, borderColor: "#252838", alignItems: "center" }}>
            <Text style={{ fontSize: 40, marginBottom: 12 }}>🔧</Text>
            <Text style={{ color: "white", fontSize: 16, fontWeight: "700", textAlign: "center" }}>No mechanics found nearby</Text>
            <Text style={{ color: "#9ca3af", fontSize: 13, textAlign: "center", marginTop: 8 }}>Mechanics who set their service area will appear here</Text>
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