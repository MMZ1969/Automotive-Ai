import { useAuth } from "@context/AuthContext";
import api from "@lib/api";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useRouter } from "expo-router";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { storage } from "../../../firebaseConfig";

export default function Profile() {
  const { user, logout, isMechanic, isDIYer, updateProfilePhoto } = useAuth();
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [vanityPosts, setVanityPosts] = useState<any[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);

  useFocusEffect(
    useCallback(() => {
      fetchVanityPosts();
    }, [])
  );

  const fetchVanityPosts = async () => {
    try {
      setLoadingPosts(true);
      const res = await api.get(`/api/posts?type=VANITY`);
      const myPosts = res.data.filter((p: any) => p.userId === user?.id);
      setVanityPosts(myPosts);
    } catch (err) {
      console.error("FETCH VANITY POSTS ERROR:", err);
    } finally {
      setLoadingPosts(false);
    }
  };

  if (!user) {
    return (
      <View style={{ flex: 1, backgroundColor: "#050509", justifyContent: "center", alignItems: "center" }}>
        <Text style={{ color: "white", fontSize: 20 }}>Not logged in</Text>
      </View>
    );
  }

  const handlePickPhoto = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission needed", "Please allow access to your photo library.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
      if (result.canceled) return;
      await uploadToFirebase(result.assets[0].uri);
    } catch (err) {
      console.error("PHOTO PICK ERROR:", err);
      Alert.alert("Error", "Could not open photo library.");
    }
  };

  const uploadToFirebase = async (uri: string) => {
    try {
      setUploading(true);
      setUploadProgress(0);
      const response = await fetch(uri);
      const blob = await response.blob();
      const filename = `profile-photos/${user.id}/avatar_${Date.now()}.jpg`;
      const storageRef = ref(storage, filename);
      const uploadTask = uploadBytesResumable(storageRef, blob);
      uploadTask.on(
        "state_changed",
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(Math.round(progress));
        },
        (error) => {
          console.error("UPLOAD ERROR:", error);
          Alert.alert("Upload failed", "Please try again.");
          setUploading(false);
        },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          await updateProfilePhoto(downloadURL);
          setUploading(false);
          setUploadProgress(0);
          Alert.alert("Success!", "Profile photo updated! 🚗");
        }
      );
    } catch (err) {
      console.error("UPLOAD ERROR:", err);
      Alert.alert("Error", "Upload failed. Please try again.");
      setUploading(false);
    }
  };

  const GRID_SIZE = 3;
  const itemSize = 80;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: "#050509" }}
      contentContainerStyle={{ padding: 20 }}
    >
      {/* PROFILE PHOTO + USER HEADER */}
      <View style={{ alignItems: "center", marginBottom: 24, marginTop: 20 }}>
        <TouchableOpacity onPress={handlePickPhoto} disabled={uploading}>
          <View style={{
            width: 100,
            height: 100,
            borderRadius: 50,
            backgroundColor: "#11131a",
            borderWidth: 2,
            borderColor: isMechanic ? "#345bff" : "#10b981",
            justifyContent: "center",
            alignItems: "center",
            marginBottom: 12,
            overflow: "hidden",
          }}>
            {uploading ? (
              <View style={{ alignItems: "center" }}>
                <ActivityIndicator color="#ffffff" />
                <Text style={{ color: "#9ca3af", fontSize: 11, marginTop: 4 }}>{uploadProgress}%</Text>
              </View>
            ) : user.profilePhoto ? (
              <Image source={{ uri: user.profilePhoto }} style={{ width: 100, height: 100, borderRadius: 50 }} />
            ) : (
              <Text style={{ fontSize: 36 }}>{user.name ? user.name[0].toUpperCase() : "?"}</Text>
            )}
          </View>
        </TouchableOpacity>

        <TouchableOpacity onPress={handlePickPhoto} disabled={uploading}>
          <Text style={{ color: "#9ca3af", fontSize: 13 }}>
            {uploading ? "Uploading..." : "Tap photo to change"}
          </Text>
        </TouchableOpacity>

        <Text style={{ color: "white", fontSize: 26, fontWeight: "bold", marginTop: 12 }}>
          {user.name || "Your Profile"}
        </Text>
        <Text style={{ color: "#9ca3af", marginTop: 4 }}>{user.email}</Text>

        <View style={{
          marginTop: 10,
          backgroundColor: isMechanic ? "#345bff" : "#10b981",
          paddingVertical: 6,
          paddingHorizontal: 16,
          borderRadius: 20,
        }}>
          <Text style={{ color: "white", fontWeight: "700", fontSize: 13 }}>
            {isMechanic ? "🏁 MECHANIC" : "🔧 DIYER"}
          </Text>
        </View>
      </View>

      {/* RIDES & BUILDS GALLERY */}
      <View style={{
        backgroundColor: "#11131a",
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "#252838",
        padding: 16,
        marginBottom: 20,
      }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <Text style={{ color: "white", fontSize: 18, fontWeight: "800" }}>
            🚗 Rides & Builds
          </Text>
          <TouchableOpacity onPress={() => router.push("/(tabs)/create")}>
            <Text style={{ color: "#345bff", fontSize: 13 }}>+ Add</Text>
          </TouchableOpacity>
        </View>

        {loadingPosts ? (
          <ActivityIndicator color="#345bff" />
        ) : vanityPosts.length === 0 ? (
          <View style={{ alignItems: "center", paddingVertical: 24 }}>
            <Text style={{ fontSize: 36, marginBottom: 8 }}>📸</Text>
            <Text style={{ color: "#9ca3af", fontSize: 14, textAlign: "center" }}>
              No builds posted yet.{"\n"}Share your first ride!
            </Text>
          </View>
        ) : (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
            {vanityPosts.map((post) => (
              <TouchableOpacity
                key={post.id}
                onPress={() => router.push(`/(tabs)/post/${post.id}`)}
                style={{
                  width: itemSize,
                  height: itemSize,
                  borderRadius: 10,
                  overflow: "hidden",
                  backgroundColor: "#252838",
                }}
              >
                {post.imageUrl ? (
                  <Image
                    source={{ uri: post.imageUrl }}
                    style={{ width: itemSize, height: itemSize }}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={{
                    flex: 1,
                    justifyContent: "center",
                    alignItems: "center",
                    padding: 8,
                  }}>
                    <Text style={{ fontSize: 20, marginBottom: 4 }}>🚗</Text>
                    <Text style={{ color: "#9ca3af", fontSize: 10, textAlign: "center" }} numberOfLines={3}>
                      {post.content}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* MECHANIC DASHBOARD LINK */}
      {isMechanic && (
        <TouchableOpacity
          onPress={() => router.push("/(tabs)/mechanic")}
          style={actionCard}
        >
          <Text style={actionCardTitle}>🏁 Mechanic Dashboard</Text>
          <Text style={actionCardSub}>Jobs • Reviews • Earnings</Text>
        </TouchableOpacity>
      )}
      {isMechanic && (
        <TouchableOpacity
          onPress={() => router.push("/quick-alert")}
          style={[actionCard, { borderColor: "#f59e0b44", backgroundColor: "#1a1200" }]}
        >
          <Text style={actionCardTitle}>⚡ Quick Alert</Text>
          <Text style={actionCardSub}>Send a customer a vehicle status update</Text>
        </TouchableOpacity>
      )}

      {/* JOBS */}
      <TouchableOpacity
        onPress={() => router.push("/(tabs)/mechanic/jobs")}
        style={[actionCard, { borderColor: "#345bff44", backgroundColor: "#0f1628" }]}
      >
        <Text style={actionCardTitle}>💼 {isMechanic ? "Browse Jobs" : "My Job Requests"}</Text>
        <Text style={actionCardSub}>
          {isMechanic ? "Find work and place bids" : "Post a job and find a mechanic"}
        </Text>
      </TouchableOpacity>

      {/* SEARCH */}
      <TouchableOpacity
        onPress={() => router.push("/(tabs)/search")}
        style={actionCard}
      >
        <Text style={actionCardTitle}>🔍 Search Users</Text>
        <Text style={actionCardSub}>Find DIYers and Mechanics</Text>
      </TouchableOpacity>

      {/* LEADERBOARD */}
      <TouchableOpacity
        onPress={() => router.push("/(tabs)/leaderboard")}
        style={actionCard}
      >
        <Text style={actionCardTitle}>🏆 Leaderboard</Text>
        <Text style={actionCardSub}>Top earners by rep points</Text>
      </TouchableOpacity>

      {/* VEHICLES */}
      <TouchableOpacity
        onPress={() => router.push("/(tabs)/(profile)/vehicles")}
        style={actionCard}
      >
        <Text style={actionCardTitle}>🚗 Your Vehicles</Text>
        <Text style={actionCardSub}>View and manage your garage</Text>
      </TouchableOpacity>

      {/* LOGS */}
      <TouchableOpacity
        onPress={() => router.push("/(tabs)/(profile)/logs")}
        style={actionCard}
      >
        <Text style={actionCardTitle}>📋 Maintenance Logs</Text>
        <Text style={actionCardSub}>All logs across all vehicles</Text>
      </TouchableOpacity>

      {/* SETTINGS */}
      <TouchableOpacity
        onPress={() => router.push("/(tabs)/(profile)/settings")}
        style={actionCard}
      >
        <Text style={actionCardTitle}>⚙️ Settings</Text>
        <Text style={actionCardSub}>Account preferences & app settings</Text>
      </TouchableOpacity>

      {/* LOGOUT */}
      <TouchableOpacity
        onPress={async () => await logout()}
        style={{
          backgroundColor: "#b91c1c",
          padding: 16,
          borderRadius: 14,
          marginTop: 10,
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

const actionCard = {
  backgroundColor: "#11131a",
  padding: 16,
  borderRadius: 14,
  borderWidth: 1,
  borderColor: "#252838",
  marginBottom: 12,
};

const actionCardTitle = {
  color: "#f5f5f5",
  fontSize: 18,
  fontWeight: "700" as const,
};

const actionCardSub = {
  color: "#9fa4c0",
  marginTop: 4,
  fontSize: 13,
};