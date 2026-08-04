import { useAuth } from "@context/AuthContext";
import { useTheme } from "@context/ThemeContext";
import api from "@lib/api";
import { ensureFirebaseAuth } from "@lib/firebaseAuth";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useRouter } from "expo-router";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { storage } from "../../firebaseConfig";

export default function CarShowScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();

  const [shows, setShows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [createModal, setCreateModal] = useState(false);
  const [editingShow, setEditingShow] = useState<any>(null);
  const [attendeesModal, setAttendeesModal] = useState<any>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [date, setDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fetchShows = async () => {
    try {
      const res = await api.get("/api/car-shows");
      setShows(res.data);
    } catch (err) {
      console.error("FETCH CAR SHOWS ERROR:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { fetchShows(); }, []));

  const handlePickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission needed", "Please allow access to your photo library.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.7,
      });
      if (result.canceled) return;
      await uploadImage(result.assets[0].uri);
    } catch (err) {
      Alert.alert("Error", "Could not open photo library.");
    }
  };

  const uploadImage = async (uri: string) => {
    try {
      await ensureFirebaseAuth();
      setUploading(true);
      const response = await fetch(uri);
      const blob = await response.blob();
      const filename = `car-shows/${user?.id}/show_${Date.now()}.jpg`;
      const storageRef = ref(storage, filename);
      const uploadTask = uploadBytesResumable(storageRef, blob);
      uploadTask.on("state_changed", null,
        (error) => {
          console.error("CAR SHOW UPLOAD ERROR:", error);
          Alert.alert("Upload failed", error?.message || "Please try again.");
          setUploading(false);
        },
        async () => {
          const url = await getDownloadURL(uploadTask.snapshot.ref);
          setImageUrl(url);
          setUploading(false);
        }
      );
    } catch (err) {
      console.error("CAR SHOW UPLOAD ERROR (outer):", err);
      Alert.alert("Error", "Upload failed.");
      setUploading(false);
    }
  };

  const openCreateModal = () => {
    setEditingShow(null);
    setName(""); setDescription(""); setLocation(""); setDate(null); setImageUrl("");
    setCreateModal(true);
  };

  const openEditModal = (show: any) => {
    setEditingShow(show);
    setName(show.name || "");
    setDescription(show.description || "");
    setLocation(show.location || "");
    setDate(show.date ? new Date(show.date) : null);
    setImageUrl(show.imageUrl || "");
    setCreateModal(true);
  };

  const handleSaveShow = async () => {
    if (!name.trim() || !location.trim() || !date) {
      Alert.alert("Missing fields", "Name, location, and date are required.");
      return;
    }
    try {
      setSubmitting(true);
      if (editingShow) {
        await api.put(`/api/car-shows/${editingShow.id}`, { name, description, location, date: date.toISOString(), imageUrl });
        Alert.alert("✅ Show Updated!", "Your changes have been saved.");
      } else {
        await api.post("/api/car-shows", { name, description, location, date: date.toISOString(), imageUrl });
        Alert.alert("🎪 Car Show Posted!", "Your show has been added.");
      }
      setCreateModal(false);
      setEditingShow(null);
      setName(""); setDescription(""); setLocation(""); setDate(null); setImageUrl("");
      fetchShows();
    } catch (err) {
      Alert.alert("Error", `Could not ${editingShow ? "update" : "create"} car show. Try again.`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAttend = async (showId: number) => {
    try {
      const res = await api.post(`/api/car-shows/${showId}/attend`);
      setShows(prev => prev.map(s => {
        if (s.id !== showId) return s;
        const attendees = res.data.attending
          ? [...s.attendees, { userId: user?.id }]
          : s.attendees.filter((a: any) => a.userId !== user?.id);
        return { ...s, attendees };
      }));
    } catch (err) {
      Alert.alert("Error", "Could not update attendance.");
    }
  };

  const handleDelete = async (showId: number) => {
    Alert.alert("Delete Show", "Are you sure you want to delete this car show?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        try {
          await api.delete(`/api/car-shows/${showId}`);
          fetchShows();
        } catch (err) {
          Alert.alert("Error", "Could not delete car show.");
        }
      }},
    ]);
  };

  const inputStyle = {
    backgroundColor: colors.background,
    color: colors.text,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
    fontSize: 15,
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator color={colors.blue} size="large" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>

      <Modal visible={createModal} animationType="slide" transparent onRequestClose={() => setCreateModal(false)}>
        <KeyboardAvoidingView
          style={{ flex: 1, justifyContent: "flex-end" }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
        <View style={{ flex: 1, backgroundColor: "#00000088", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 48, maxHeight: "90%" }}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={{ color: colors.text, fontSize: 22, fontWeight: "900", marginBottom: 4 }}>{editingShow ? "✏️ Edit Car Show" : "🎪 Post a Car Show"}</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 20 }}>{editingShow ? "Update your show details" : "Share an upcoming show with the community"}</Text>

              <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 6 }}>Event Name *</Text>
              <TextInput value={name} onChangeText={setName} placeholder="e.g. Vineland Classic Car Show" placeholderTextColor={colors.textMuted} style={inputStyle} />

              <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 6 }}>Location *</Text>
              <TextInput value={location} onChangeText={setLocation} placeholder="e.g. Vineland, NJ" placeholderTextColor={colors.textMuted} style={inputStyle} />

              <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 6 }}>Date & Time *</Text>
              <TouchableOpacity onPress={() => setShowDatePicker(true)} style={{ ...inputStyle, justifyContent: "center" }}>
                <Text style={{ color: date ? colors.text : colors.textMuted, fontSize: 15 }}>
                  {date
                    ? date.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })
                    : "Tap to select date & time"}
                </Text>
              </TouchableOpacity>

              <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 6, marginTop: 12 }}>Description</Text>
              <TextInput value={description} onChangeText={setDescription} placeholder="Tell people what to expect..." placeholderTextColor={colors.textMuted} style={{ ...inputStyle, height: 80, textAlignVertical: "top" }} multiline />

              <TouchableOpacity onPress={handlePickImage} disabled={uploading} style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 14, alignItems: "center", marginBottom: 12 }}>
                {uploading ? (
                  <ActivityIndicator color={colors.blue} />
                ) : imageUrl ? (
                  <Image source={{ uri: imageUrl }} style={{ width: "100%", height: 140, borderRadius: 8 }} resizeMode="cover" />
                ) : (
                  <Text style={{ color: colors.textMuted, fontSize: 14 }}>📸 Add a flyer or photo (optional)</Text>
                )}
              </TouchableOpacity>

              <View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}>
                <TouchableOpacity onPress={() => { setCreateModal(false); setEditingShow(null); }} style={{ flex: 1, backgroundColor: colors.border, padding: 14, borderRadius: 12, alignItems: "center" }}>
                  <Text style={{ color: colors.text, fontWeight: "700" }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSaveShow} disabled={submitting} style={{ flex: 1, backgroundColor: colors.blue, padding: 14, borderRadius: 12, alignItems: "center" }}>
                  <Text style={{ color: "white", fontWeight: "700" }}>{submitting ? "Saving..." : editingShow ? "Save Changes" : "Post Show"}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>

        {/* DATE PICKER OVERLAY — rendered inside the same modal instead of a
            second stacked <Modal>, since iOS won't reliably present two
            native modals at once. */}
        {showDatePicker && (
          <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, justifyContent: "flex-end", backgroundColor: "#00000088", zIndex: 999 }}>
            <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 }}>
              <DateTimePicker
                value={date || new Date()}
                mode="datetime"
                display="spinner"
                minimumDate={new Date()}
                themeVariant="dark"
                onChange={(event, selectedDate) => {
                  if (selectedDate) setDate(selectedDate);
                }}
              />
              <TouchableOpacity onPress={() => setShowDatePicker(false)} style={{ backgroundColor: colors.blue, padding: 14, borderRadius: 12, alignItems: "center", marginTop: 12 }}>
                <Text style={{ color: "white", fontWeight: "700" }}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        </KeyboardAvoidingView>
      </Modal>

      {/* ATTENDEES MODAL */}
      <Modal visible={!!attendeesModal} transparent animationType="slide" onRequestClose={() => setAttendeesModal(null)}>
        <View style={{ flex: 1, backgroundColor: "#00000088", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40, maxHeight: "75%" }}>
            <Text style={{ color: colors.text, fontSize: 20, fontWeight: "900", marginBottom: 4 }}>🎪 Who's Going</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 16 }}>{attendeesModal?.name}</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {attendeesModal?.attendees?.length === 0 ? (
                <Text style={{ color: colors.textMuted, fontSize: 14, textAlign: "center", marginTop: 20 }}>No one has RSVP'd yet.</Text>
              ) : (
                attendeesModal?.attendees?.map((a: any) => (
                  <TouchableOpacity
                    key={a.userId}
                    onPress={() => { setAttendeesModal(null); router.push(`/(tabs)/user/${a.userId}`); }}
                    style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}
                  >
                    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.border, overflow: "hidden", justifyContent: "center", alignItems: "center" }}>
                      {a.user?.profilePhoto ? (
                        <Image source={{ uri: a.user.profilePhoto }} style={{ width: 40, height: 40 }} />
                      ) : (
                        <Text style={{ color: colors.text, fontWeight: "700" }}>{a.user?.name?.[0]?.toUpperCase() || "?"}</Text>
                      )}
                    </View>
                    <Text style={{ color: colors.text, fontSize: 15, fontWeight: "600" }}>{a.user?.name || "Anonymous"}</Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
            <TouchableOpacity onPress={() => setAttendeesModal(null)} style={{ backgroundColor: colors.border, padding: 14, borderRadius: 12, alignItems: "center", marginTop: 16 }}>
              <Text style={{ color: colors.text, fontWeight: "700" }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <View style={{ paddingTop: 60, paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View>
            <Text style={{ color: colors.text, fontSize: 24, fontWeight: "900" }}>🎪 Car Shows</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }}>Upcoming shows near you</Text>
          </View>
          <TouchableOpacity onPress={openCreateModal} style={{ backgroundColor: colors.blue, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 }}>
            <Text style={{ color: "white", fontWeight: "700", fontSize: 14 }}>+ Post Show</Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={shows}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={{ padding: 16, gap: 14 }}
        onRefresh={() => { setRefreshing(true); fetchShows(); }}
        refreshing={refreshing}
        ListEmptyComponent={
          <View style={{ alignItems: "center", marginTop: 80 }}>
            <Text style={{ fontSize: 48 }}>🎪</Text>
            <Text style={{ color: colors.text, fontSize: 20, fontWeight: "bold", marginTop: 16 }}>No shows yet</Text>
            <Text style={{ color: colors.textSecondary, marginTop: 8, textAlign: "center", paddingHorizontal: 40 }}>
              Be the first to post an upcoming car show!
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const isAttending = item.attendees?.some((a: any) => a.userId === user?.id);
          const attendeeCount = item.attendees?.length || 0;
          const showDate = new Date(item.date);

          return (
            <View style={{ backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, overflow: "hidden" }}>
              {item.imageUrl && (
                <Image source={{ uri: item.imageUrl }} style={{ width: "100%", height: 160 }} resizeMode="cover" />
              )}

              <View style={{ padding: 16 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <View style={{ backgroundColor: colors.blue + "22", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: colors.blue + "44" }}>
                    <Text style={{ color: colors.blue, fontSize: 12, fontWeight: "700" }}>
                      {showDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </Text>
                  </View>
                  <View style={{ backgroundColor: "#f59e0b22", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: "#f59e0b44" }}>
                    <Text style={{ color: "#f59e0b", fontSize: 12, fontWeight: "700" }}>
                      {showDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                    </Text>
                  </View>
                </View>

                <Text style={{ color: colors.text, fontSize: 18, fontWeight: "900", marginBottom: 6 }}>{item.name}</Text>

                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
                  <Text style={{ fontSize: 14 }}>📍</Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 14 }}>{item.location}</Text>
                </View>

                {item.description && (
                  <Text style={{ color: colors.textMuted, fontSize: 13, lineHeight: 20, marginBottom: 12 }}>{item.description}</Text>
                )}

                <TouchableOpacity onPress={() => router.push(`/(tabs)/user/${item.user?.id}`)} style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 }}>
                  <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: colors.border, overflow: "hidden", justifyContent: "center", alignItems: "center" }}>
                    {item.user?.profilePhoto ? (
                      <Image source={{ uri: item.user.profilePhoto }} style={{ width: 28, height: 28 }} />
                    ) : (
                      <Text style={{ color: colors.text, fontSize: 12, fontWeight: "bold" }}>{item.user?.name?.[0]?.toUpperCase()}</Text>
                    )}
                  </View>
                  <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Posted by <Text style={{ color: colors.text, fontWeight: "600" }}>{item.user?.name}</Text></Text>
                </TouchableOpacity>

                <View style={{ flexDirection: "row", gap: 10 }}>
                  <TouchableOpacity
                    onPress={() => handleAttend(item.id)}
                    style={{ flex: 1, backgroundColor: isAttending ? colors.blue : colors.background, borderWidth: 1, borderColor: isAttending ? colors.blue : colors.border, padding: 12, borderRadius: 12, alignItems: "center" }}
                  >
                    <Text style={{ color: isAttending ? "white" : colors.text, fontWeight: "700", fontSize: 14 }}>
                      {isAttending ? "✅ Going" : "🎪 I'm Going"}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setAttendeesModal(item)}
                    style={{ justifyContent: "center", alignItems: "center", paddingHorizontal: 12 }}
                  >
                    <Text style={{ color: colors.text, fontWeight: "700", fontSize: 16 }}>{attendeeCount}</Text>
                    <Text style={{ color: colors.blue, fontSize: 11 }}>Going ›</Text>
                  </TouchableOpacity>
                  {(item.userId === user?.id || user?.isAdmin) && (
                    <>
                      <TouchableOpacity onPress={() => openEditModal(item)} style={{ backgroundColor: colors.blue + "22", borderWidth: 1, borderColor: colors.blue + "44", padding: 12, borderRadius: 12, alignItems: "center", justifyContent: "center" }}>
                        <Text style={{ fontSize: 16 }}>✏️</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleDelete(item.id)} style={{ backgroundColor: "#b91c1c22", borderWidth: 1, borderColor: "#b91c1c44", padding: 12, borderRadius: 12, alignItems: "center", justifyContent: "center" }}>
                        <Text style={{ fontSize: 16 }}>🗑️</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </View>
            </View>
          );
        }}
      />

      <TouchableOpacity
        onPress={openCreateModal}
        style={{ position: "absolute", bottom: 24, right: 24, backgroundColor: colors.blue, width: 56, height: 56, borderRadius: 28, justifyContent: "center", alignItems: "center", elevation: 8 }}
      >
        <Text style={{ color: "white", fontSize: 28, fontWeight: "300", marginTop: -2 }}>➕</Text>
      </TouchableOpacity>
    </View>
  );
}
