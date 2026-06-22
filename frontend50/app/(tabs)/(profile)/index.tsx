import { useAuth } from "@context/AuthContext";
import { useTheme } from "@context/ThemeContext";
import api from "@lib/api";
import { ensureFirebaseAuth } from "@lib/firebaseAuth";
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
  const { user, logout, isMechanic, updateProfilePhoto } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [vanityPosts, setVanityPosts] = useState<any[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);

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

  const fetchStats = useCallback(async () => {
    if (!user?.id) return;
    try {
      const res = await api.get(`/api/users/${user?.id}/profile`);
      setFollowerCount(res.data._count?.followers || 0);
      setFollowingCount(res.data._count?.following || 0);
    } catch (err) {
      console.error("FETCH STATS ERROR:", err);
    }
  }, [user?.id]);

  const fetchUnreadMessages = async () => {
    try {
      const res = await api.get("/api/messages/unread-count");
      setUnreadMessages(res.data.count || 0);
    } catch (err) {
      // silently fail — badge just won't show
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchVanityPosts();
      fetchStats();
      fetchUnreadMessages();
    }, [fetchStats])
  );

  if (!user) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }}>
        <Text style={{ color: colors.text, fontSize: 20 }}>Not logged in</Text>
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
      await ensureFirebaseAuth();
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

  const itemSize = 80;

  const statPill = {
    backgroundColor: colors.card,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center" as const,
    minWidth: 80,
  };

  const menuCard = {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 10,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 14,
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 20 }}
    >
      {/* PROFILE PHOTO + USER HEADER */}
      <View style={{ alignItems: "center", marginBottom: 24, marginTop: 20 }}>
        <TouchableOpacity onPress={handlePickPhoto} disabled={uploading}>
          <View style={{
            width: 100, height: 100, borderRadius: 50,
            backgroundColor: colors.card, borderWidth: 2,
            borderColor: isMechanic ? colors.blue : colors.green,
            justifyContent: "center", alignItems: "center",
            marginBottom: 12, overflow: "hidden",
          }}>
            {uploading ? (
              <View style={{ alignItems: "center" }}>
                <ActivityIndicator color={colors.text} />
                <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 4 }}>{uploadProgress}%</Text>
              </View>
            ) : user.profilePhoto ? (
              <Image source={{ uri: user.profilePhoto }} style={{ width: 100, height: 100, borderRadius: 50 }} />
            ) : (
              <Text style={{ fontSize: 36 }}>{user.name ? user.name[0].toUpperCase() : "?"}</Text>
            )}
          </View>
        </TouchableOpacity>

        <TouchableOpacity onPress={handlePickPhoto} disabled={uploading}>
          <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
            {uploading ? "Uploading..." : "Tap photo to change"}
          </Text>
        </TouchableOpacity>

        <Text style={{ color: colors.text, fontSize: 26, fontWeight: "bold", marginTop: 12 }}>
          {user.name || "Your Profile"}
        </Text>
        <Text style={{ color: colors.textSecondary, marginTop: 4 }}>{user.email}</Text>

        <View style={{
          marginTop: 10,
          backgroundColor: user?.isVerified ? "#1e3a8a" : isMechanic ? colors.blue : colors.green,
          paddingVertical: 6, paddingHorizontal: 16, borderRadius: 20,
          borderWidth: user?.isVerified ? 1 : 0, borderColor: "#60a5fa",
        }}>
          <Text style={{ color: "white", fontWeight: "700", fontSize: 13 }}>
            {user?.isVerified ? "🏁 Verified Mechanic" : isMechanic ? "🏁 MECHANIC" : "🔧 DIYER"}
          </Text>
        </View>

        {/* STATS ROW */}
        <View style={{ flexDirection: "row", gap: 12, marginTop: 20 }}>
          <View style={statPill}>
            <Text style={{ color: colors.text, fontWeight: "700", fontSize: 18 }}>{user.repPoints || 0}</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 11 }}>Rep</Text>
          </View>
          <TouchableOpacity
            style={statPill}
            onPress={() => router.push({ pathname: "/(tabs)/followers", params: { id: user.id, type: "followers" } })}
          >
            <Text style={{ color: colors.text, fontWeight: "700", fontSize: 18 }}>{followerCount}</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 11 }}>Followers</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={statPill}
            onPress={() => router.push({ pathname: "/(tabs)/followers", params: { id: user.id, type: "following" } })}
          >
            <Text style={{ color: colors.text, fontWeight: "700", fontSize: 18 }}>{followingCount}</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 11 }}>Following</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* RIDES & BUILDS GALLERY */}
      <View style={{ backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 16 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: "800" }}>🚗 Rides & Builds</Text>
          <TouchableOpacity onPress={() => router.push("/(tabs)/create")}>
            <Text style={{ color: colors.blue, fontSize: 13 }}>+ Add</Text>
          </TouchableOpacity>
        </View>
        {loadingPosts ? (
          <ActivityIndicator color={colors.blue} />
        ) : vanityPosts.length === 0 ? (
          <View style={{ alignItems: "center", paddingVertical: 24 }}>
            <Text style={{ fontSize: 36, marginBottom: 8 }}>📸</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 14, textAlign: "center" }}>
              No builds posted yet.{"\n"}Share your first ride!
            </Text>
          </View>
        ) : (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
            {vanityPosts.map((post) => (
              <TouchableOpacity
                key={post.id}
                onPress={() => router.push(`/(tabs)/post/${post.id}`)}
                style={{ width: itemSize, height: itemSize, borderRadius: 10, overflow: "hidden", backgroundColor: colors.border }}
              >
                {post.imageUrl ? (
                  <Image source={{ uri: post.imageUrl }} style={{ width: itemSize, height: itemSize }} resizeMode="cover" />
                ) : (
                  <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 8 }}>
                    <Text style={{ fontSize: 20, marginBottom: 4 }}>🚗</Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 10, textAlign: "center" }} numberOfLines={3}>{post.content}</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* MECHANIC MENU */}
      {isMechanic && (
        <>
          <TouchableOpacity
            onPress={() => router.push("/(tabs)/mechanic")}
            style={[menuCard, { borderColor: colors.blue + "44" }]}
          >
            <Text style={{ fontSize: 28 }}>🏁</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontSize: 17, fontWeight: "700" }}>Dashboard</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>Jobs near me • Quick Alert • Reviews</Text>
            </View>
            <Text style={{ color: colors.textMuted, fontSize: 18 }}>›</Text>
          </TouchableOpacity>
        </>
      )}

      {/* MY GARAGE — both roles */}
      <TouchableOpacity
        onPress={() => router.push("/(tabs)/(profile)/garage")}
        style={[menuCard, { borderColor: colors.blue + "44" }]}
      >
        <Text style={{ fontSize: 28 }}>🚗</Text>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontSize: 17, fontWeight: "700" }}>My Garage</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>Vehicles & service logs</Text>
        </View>
        <Text style={{ color: colors.textMuted, fontSize: 18 }}>›</Text>
      </TouchableOpacity>

      {/* POST A JOB — DIYers only */}
      {!isMechanic && (
        <>
          <TouchableOpacity
            onPress={() => router.push("/(tabs)/mechanic/jobs")}
            style={[menuCard, { borderColor: colors.blue + "44" }]}
          >
            <Text style={{ fontSize: 28 }}>💼</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontSize: 17, fontWeight: "700" }}>Post a Job</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>Find a mechanic near you</Text>
            </View>
            <Text style={{ color: colors.textMuted, fontSize: 18 }}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push("/(tabs)/diyer/jobs")}
            style={[menuCard, { borderColor: colors.blue + "44" }]}
          >
            <Text style={{ fontSize: 28 }}>📋</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontSize: 17, fontWeight: "700" }}>Job History</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>View all your past and active jobs</Text>
            </View>
            <Text style={{ color: colors.textMuted, fontSize: 18 }}>›</Text>
          </TouchableOpacity>
        </>
      )}

      {/* MESSAGES — both roles */}
      <TouchableOpacity
        onPress={() => router.push("/(tabs)/messages")}
        style={menuCard}
      >
        <Text style={{ fontSize: 28 }}>💬</Text>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontSize: 17, fontWeight: "700" }}>Messages</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>Your conversations</Text>
        </View>
        {unreadMessages > 0 && (
          <View style={{
            backgroundColor: "#ef4444",
            borderRadius: 12,
            minWidth: 24,
            height: 24,
            justifyContent: "center",
            alignItems: "center",
            paddingHorizontal: 7,
            marginRight: 6,
          }}>
            <Text style={{ color: "white", fontSize: 12, fontWeight: "700" }}>
              {unreadMessages > 99 ? "99+" : unreadMessages}
            </Text>
          </View>
        )}
        <Text style={{ color: colors.textMuted, fontSize: 18 }}>›</Text>
      </TouchableOpacity>

      {/* LEADERBOARD — both roles */}
      <TouchableOpacity
        onPress={() => router.push("/(tabs)/leaderboard")}
        style={menuCard}
      >
        <Text style={{ fontSize: 28 }}>🏆</Text>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontSize: 17, fontWeight: "700" }}>Leaderboard</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>Top rep earners • Search users</Text>
        </View>
        <Text style={{ color: colors.textMuted, fontSize: 18 }}>›</Text>
      </TouchableOpacity>

      {/* ADMIN PANEL — admin only */}
      {user?.isAdmin && (
        <TouchableOpacity
          onPress={() => router.push("/(tabs)/(profile)/admin")}
          style={[menuCard, { borderColor: "#f59e0b44" }]}
        >
          <Text style={{ fontSize: 28 }}>🛡️</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontSize: 17, fontWeight: "700" }}>Admin Panel</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>Manage verification requests</Text>
          </View>
          <Text style={{ color: colors.textMuted, fontSize: 18 }}>›</Text>
        </TouchableOpacity>
      )}

      {/* SETTINGS */}
      <TouchableOpacity
        onPress={() => router.push("/(tabs)/(profile)/settings")}
        style={menuCard}
      >
        <Text style={{ fontSize: 28 }}>⚙️</Text>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontSize: 17, fontWeight: "700" }}>Settings</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>Account preferences & app settings</Text>
        </View>
        <Text style={{ color: colors.textMuted, fontSize: 18 }}>›</Text>
      </TouchableOpacity>

      {/* LOG OUT */}
      <TouchableOpacity
        onPress={async () => await logout()}
        style={{ backgroundColor: "#b91c1c", padding: 16, borderRadius: 14, marginTop: 6, marginBottom: 40, alignItems: "center" }}
      >
        <Text style={{ color: "white", fontWeight: "700", fontSize: 18 }}>Log Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
