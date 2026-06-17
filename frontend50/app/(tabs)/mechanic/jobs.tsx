import { useAuth } from "@context/AuthContext";
import { useTheme } from "@context/ThemeContext";
import api from "@lib/api";
import * as Location from "expo-location";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Modal,
  Platform, ScrollView, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import MapView, { Callout, Marker, PROVIDER_GOOGLE } from "react-native-maps";

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

const statusColor = (status: string) => {
  switch (status) {
    case "OPEN": return "#10b981";
    case "PENDING_CONFIRM": return "#f59e0b";
    case "IN_PROGRESS": return "#345bff";
    case "COMPLETED": return "#6b7280";
    default: return "#6b7280";
  }
};

export default function Jobs() {
  const { user, isMechanic } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();
  const { jobId, tab } = useLocalSearchParams<{ jobId?: string; tab?: string }>();
  const mapRef = useRef<MapView>(null);

  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [myJobs, setMyJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [locationError, setLocationError] = useState(false);
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [mechanicView, setMechanicView] = useState<"map" | "mine">("map");

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [budget, setBudget] = useState("");
  const [creating, setCreating] = useState(false);

  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusJob, setStatusJob] = useState<any>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewJob, setReviewJob] = useState<any>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

  const inputStyle = {
    backgroundColor: colors.background, color: colors.text,
    padding: 12, borderRadius: 10, borderWidth: 1,
    borderColor: colors.border, marginBottom: 10, fontSize: 15,
  };

  const initMap = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") { setLocationError(true); setLoading(false); return; }

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setUserLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });

      const fetchedJobs = await fetchJobs();

      // If we arrived via a job_complete notification, switch to My Jobs tab
      if (tab === "mine") {
        setMechanicView("mine");
      }

      // If we arrived via a job notification, center on and select that job
      if (jobId && fetchedJobs) {
        const target = fetchedJobs.find((j: any) => j.id === Number(jobId));
        if (target && target.latitude && target.longitude) {
          setSelectedJob(target);
          setMechanicView("map");
          setTimeout(() => {
            mapRef.current?.animateToRegion({
              latitude: target.latitude,
              longitude: target.longitude,
              latitudeDelta: 0.05,
              longitudeDelta: 0.05,
            }, 500);
          }, 300);
        }
      }
    } catch (err) {
      console.error("MAP INIT ERROR:", err);
      setLocationError(true);
    } finally {
      setLoading(false);
    }
  };

  const fetchJobs = async () => {
    try {
      const [openRes, myRes] = await Promise.all([
        api.get("/api/jobs"),
        isMechanic ? api.get("/api/jobs/my-bids") : api.get("/api/jobs/mine"),
      ]);
      setJobs(openRes.data);
      setMyJobs(myRes.data);
      return openRes.data;
    } catch (err) {
      console.error("FETCH JOBS ERROR:", err);
      return null;
    }
  };

  useFocusEffect(useCallback(() => { initMap(); }, []));

  const centerOnUser = () => {
    if (!userLocation || !mapRef.current) return;
    mapRef.current.animateToRegion({
      latitude: userLocation.lat, longitude: userLocation.lng,
      latitudeDelta: 0.1, longitudeDelta: 0.1,
    }, 500);
  };

  const handleCreateJob = async () => {
    if (!title.trim() || !description.trim() || !vehicle.trim()) {
      Alert.alert("Missing fields", "Title, description and vehicle are required.");
      return;
    }
    if (!userLocation) {
      Alert.alert("Location needed", "Could not get your location. Please try again.");
      return;
    }
    try {
      setCreating(true);
      const res = await api.post("/api/jobs", {
        title, description, vehicle,
        budget: budget || null,
        latitude: userLocation.lat,
        longitude: userLocation.lng,
      });
      const job = res.data;
      setShowCreateModal(false);
      setTitle(""); setDescription(""); setVehicle(""); setBudget("");
      await fetchJobs();
      setMechanicView("map");
      setTimeout(() => {
        if (job.latitude && job.longitude) {
          mapRef.current?.animateToRegion({
            latitude: job.latitude,
            longitude: job.longitude,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }, 500);
          setSelectedJob(job);
        }
      }, 300);
    } catch {
      Alert.alert("Error", "Could not post job. Try again.");
    } finally {
      setCreating(false);
    }
  };

  const handleClaimJob = async (job: any) => {
    Alert.alert("Claim Job", `Claim "${job.title}"?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Claim", onPress: async () => {
        try {
          await api.post(`/api/jobs/${job.id}/claim`);
          setSelectedJob(null);
          await fetchJobs();
          Alert.alert("🔧 Claimed!", "The DIYer has been notified and needs to confirm.");
        } catch (err: any) {
          Alert.alert("Error", err?.response?.data?.error || "Could not claim job.");
        }
      }},
    ]);
  };

  const handleConfirmJob = async (job: any) => {
    Alert.alert("Confirm Mechanic", `Confirm ${job.mechanic?.name} for "${job.title}"?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Confirm", onPress: async () => {
        try {
          await api.post(`/api/jobs/${job.id}/confirm`);
          await fetchJobs();
          Alert.alert("✅ Confirmed!", "Your mechanic has been notified.");
        } catch (err: any) {
          Alert.alert("Error", err?.response?.data?.error || "Could not confirm.");
        }
      }},
    ]);
  };

  const handleCompleteJob = async (job: any) => {
    Alert.alert("Complete Job", "Mark this job as complete?", [
      { text: "Cancel", style: "cancel" },
      { text: "Complete", onPress: async () => {
        try {
          await api.post(`/api/jobs/${job.id}/complete`);
          await fetchJobs();
          // If mechanic, show review modal for DIYer
          if (isMechanic) {
            setReviewJob(job);
            setReviewRating(5);
            setReviewComment("");
            setShowReviewModal(true);
          } else {
            Alert.alert("🏁 Done!", "Job marked as complete.");
          }
        } catch {
          Alert.alert("Error", "Could not complete job.");
        }
      }},
    ]);
  };

  const handleSubmitMechanicReview = async () => {
    if (!reviewJob) return;
    try {
      setSubmittingReview(true);
      await api.post("/api/reviews/mechanic", {
        jobId: reviewJob.id,
        diyerId: reviewJob.poster?.id || reviewJob.userId,
        rating: reviewRating,
        comment: reviewComment,
      });
      setShowReviewModal(false);
      setReviewJob(null);
      Alert.alert("⭐ Thanks!", "Your review has been submitted.");
    } catch (err: any) {
      if (err?.response?.status === 400) {
        setShowReviewModal(false);
        Alert.alert("Already Reviewed", "You already reviewed this job.");
      } else {
        Alert.alert("Error", "Could not submit review.");
      }
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleCancelJob = async (job: any) => {
    Alert.alert("Cancel Job", "This will release the mechanic and reopen the job. Continue?", [
      { text: "No", style: "cancel" },
      { text: "Yes, Cancel", style: "destructive", onPress: async () => {
        try {
          await api.post(`/api/jobs/${job.id}/cancel`);
          await fetchJobs();
          Alert.alert("✅ Cancelled", "Your job is back on the map for mechanics to claim.");
        } catch (err: any) {
          Alert.alert("Error", err?.response?.data?.error || "Could not cancel job.");
        }
      }},
    ]);
  };

  const handleDeleteJob = async (job: any) => {
    Alert.alert("Delete Job", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        try {
          await api.delete(`/api/jobs/${job.id}`);
          await fetchJobs();
        } catch {
          Alert.alert("Error", "Could not delete job.");
        }
      }},
    ]);
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator color={colors.blue} size="large" />
        <Text style={{ color: colors.textSecondary, marginTop: 16 }}>Loading jobs map...</Text>
      </View>
    );
  }

  if (locationError) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center", alignItems: "center", padding: 40 }}>
        <Text style={{ fontSize: 48, marginBottom: 16 }}>📍</Text>
        <Text style={{ color: colors.text, fontSize: 20, fontWeight: "700", textAlign: "center", marginBottom: 8 }}>Location Required</Text>
        <Text style={{ color: colors.textSecondary, textAlign: "center", marginBottom: 24 }}>AutoAI needs your location to show jobs near you.</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ backgroundColor: colors.blue, padding: 14, borderRadius: 12, paddingHorizontal: 30 }}>
          <Text style={{ color: "white", fontWeight: "700" }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const openJobs = jobs.filter(j => j.latitude && j.longitude);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>

      {/* CREATE JOB MODAL */}
      <Modal visible={showCreateModal} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, backgroundColor: "#00000088", justifyContent: "flex-end" }}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: "flex-end" }}>
            <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 }}>
              <Text style={{ color: colors.text, fontSize: 22, fontWeight: "900", marginBottom: 4 }}>💼 Post a Job</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 16 }}>📍 Your current location will be used as the job pin</Text>
              <TextInput placeholder="Job title" placeholderTextColor={colors.textMuted} value={title} onChangeText={setTitle} style={inputStyle} />
              <TextInput placeholder="Describe the problem..." placeholderTextColor={colors.textMuted} value={description} onChangeText={setDescription} multiline style={[inputStyle, { minHeight: 80, textAlignVertical: "top" }]} />
              <TextInput placeholder="Vehicle (e.g. 2019 Honda Civic)" placeholderTextColor={colors.textMuted} value={vehicle} onChangeText={setVehicle} style={inputStyle} />
              <TextInput placeholder="Budget (optional)" placeholderTextColor={colors.textMuted} value={budget} onChangeText={setBudget} keyboardType="numeric" style={inputStyle} />
              <View style={{ flexDirection: "row", gap: 10, marginTop: 8, marginBottom: 30 }}>
                <TouchableOpacity onPress={() => setShowCreateModal(false)} style={{ flex: 1, backgroundColor: colors.border, padding: 14, borderRadius: 12, alignItems: "center" }}>
                  <Text style={{ color: colors.text, fontWeight: "700" }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleCreateJob} disabled={creating} style={{ flex: 1, backgroundColor: colors.blue, padding: 14, borderRadius: 12, alignItems: "center" }}>
                  <Text style={{ color: "white", fontWeight: "700" }}>{creating ? "Posting..." : "Post Job"}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* MECHANIC REVIEW MODAL */}
      <Modal visible={showReviewModal} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, backgroundColor: "#00000088", justifyContent: "flex-end" }}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: "flex-end" }}>
            <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 }}>
              <Text style={{ color: colors.text, fontSize: 22, fontWeight: "900", marginBottom: 4 }}>⭐ Rate Your Customer</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 20 }}>{reviewJob?.title}</Text>
              <View style={{ flexDirection: "row", justifyContent: "center", gap: 12, marginBottom: 20 }}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <TouchableOpacity key={star} onPress={() => setReviewRating(star)}>
                    <Text style={{ fontSize: 36 }}>{star <= reviewRating ? "⭐" : "☆"}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput
                placeholder="Leave a comment (optional)..."
                placeholderTextColor={colors.textMuted}
                value={reviewComment}
                onChangeText={setReviewComment}
                multiline
                style={{
                  backgroundColor: colors.background, color: colors.text,
                  padding: 12, borderRadius: 10, borderWidth: 1,
                  borderColor: colors.border, marginBottom: 10,
                  fontSize: 15, minHeight: 80, textAlignVertical: "top",
                }}
              />
              <View style={{ flexDirection: "row", gap: 10, marginTop: 8, marginBottom: 30 }}>
                <TouchableOpacity
                  onPress={() => { setShowReviewModal(false); setReviewJob(null); }}
                  style={{ flex: 1, backgroundColor: colors.border, padding: 14, borderRadius: 12, alignItems: "center" }}
                >
                  <Text style={{ color: colors.text, fontWeight: "700" }}>Skip</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSubmitMechanicReview}
                  disabled={submittingReview}
                  style={{ flex: 1, backgroundColor: colors.blue, padding: 14, borderRadius: 12, alignItems: "center" }}
                >
                  <Text style={{ color: "white", fontWeight: "700" }}>{submittingReview ? "Submitting..." : "Submit Review"}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* STATUS UPDATE MODAL */}
      <Modal visible={showStatusModal} animationType="slide" transparent>
        <TouchableOpacity style={{ flex: 1, backgroundColor: "#00000088", justifyContent: "flex-end" }} onPress={() => setShowStatusModal(false)}>
          <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 }}>
            <Text style={{ color: colors.text, fontSize: 22, fontWeight: "900", marginBottom: 4 }}>📢 Send Update</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 20 }}>{statusJob?.title}</Text>
            {["🔧 Work is in progress on your vehicle", "🔍 Still diagnosing the issue", "💰 Estimate is ready — please call us", "⏳ Waiting on parts to arrive"].map((msg) => (
              <TouchableOpacity key={msg} onPress={async () => {
                try {
                  await api.post(`/api/jobs/${statusJob.id}/status-update`, { message: msg });
                  setShowStatusModal(false);
                  Alert.alert("✅ Sent!", "Customer has been notified.");
                } catch { Alert.alert("Error", "Could not send update."); }
              }} style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, padding: 14, borderRadius: 12, marginBottom: 10 }}>
                <Text style={{ color: colors.text, fontSize: 15 }}>{msg}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity onPress={() => setShowStatusModal(false)} style={{ backgroundColor: colors.border, padding: 14, borderRadius: 12, alignItems: "center", marginTop: 4, marginBottom: 20 }}>
              <Text style={{ color: colors.text, fontWeight: "700" }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* HEADER */}
      <View style={{ paddingTop: 60, paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={{ color: colors.blue, fontSize: 16 }}>← Back</Text>
            </TouchableOpacity>
            <Text style={{ color: colors.text, fontSize: 22, fontWeight: "900" }}>
              {isMechanic ? "🔧 Jobs" : "💼 My Jobs"}
            </Text>
          </View>
          {!isMechanic && (
            <TouchableOpacity onPress={() => setShowCreateModal(true)} style={{ backgroundColor: colors.blue, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 }}>
              <Text style={{ color: "white", fontWeight: "700" }}>+ Post Job</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* TAB TOGGLE */}
        <View style={{ flexDirection: "row", backgroundColor: colors.card, borderRadius: 12, padding: 4 }}>
          <TouchableOpacity onPress={() => setMechanicView("map")} style={{ flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: "center", backgroundColor: mechanicView === "map" ? colors.blue : "transparent" }}>
            <Text style={{ color: mechanicView === "map" ? "white" : colors.textMuted, fontWeight: "700", fontSize: 14 }}>🗺️ Map</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setMechanicView("mine")} style={{ flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: "center", backgroundColor: mechanicView === "mine" ? colors.blue : "transparent" }}>
            <Text style={{ color: mechanicView === "mine" ? "white" : colors.textMuted, fontWeight: "700", fontSize: 14 }}>
              {isMechanic ? "🔧 My Jobs" : "📋 My Jobs"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* MAP VIEW */}
      {mechanicView === "map" && (
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
            {/* JOB PINS */}
            {openJobs.map((job) => (
              <Marker
                key={`job-${job.id}`}
                coordinate={{ latitude: job.latitude, longitude: job.longitude }}
                onPress={() => setSelectedJob(job)}
              >
                <View style={{ backgroundColor: statusColor(job.status), borderRadius: 20, padding: 8, borderWidth: 2, borderColor: "white", alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ fontSize: 14 }}>💼</Text>
                </View>
                <Callout tooltip>
                  <View style={{ backgroundColor: colors.card, borderRadius: 10, padding: 10, borderWidth: 1, borderColor: colors.border, minWidth: 140 }}>
                    <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>{job.title}</Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 2 }}>🚗 {job.vehicle}</Text>
                    {job.budget ? <Text style={{ color: colors.green, fontSize: 11, fontWeight: "700" }}>💰 ${job.budget}</Text> : null}
                  </View>
                </Callout>
              </Marker>
            ))}
          </MapView>

          {/* CENTER BUTTON */}
          <TouchableOpacity onPress={centerOnUser} style={{ position: "absolute", bottom: selectedJob ? 260 : 24, right: 16, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12 }}>
            <Text style={{ fontSize: 20 }}>🎯</Text>
          </TouchableOpacity>

          {/* SELECTED JOB CARD */}
          {selectedJob && (
            <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: 1, borderColor: colors.border, padding: 20 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                <Text style={{ color: colors.text, fontSize: 18, fontWeight: "800", flex: 1 }}>{selectedJob.title}</Text>
                <TouchableOpacity onPress={() => setSelectedJob(null)}>
                  <Text style={{ color: colors.textMuted, fontSize: 20 }}>✕</Text>
                </TouchableOpacity>
              </View>
              <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 4 }}>🚗 {selectedJob.vehicle}</Text>
              <Text style={{ color: colors.text, fontSize: 14, lineHeight: 20, marginBottom: 8 }}>{selectedJob.description}</Text>
              <View style={{ flexDirection: "row", gap: 16, marginBottom: 12 }}>
                {selectedJob.budget ? <Text style={{ color: colors.green, fontSize: 13, fontWeight: "700" }}>💰 ${selectedJob.budget}</Text> : null}
                <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Posted by {selectedJob.poster?.name || "Anonymous"}</Text>
              </View>

              {/* MECHANIC: claim button */}
              {isMechanic && selectedJob.status === "OPEN" && (
                <TouchableOpacity onPress={() => handleClaimJob(selectedJob)} style={{ backgroundColor: colors.blue, padding: 14, borderRadius: 12, alignItems: "center", marginBottom: 8 }}>
                  <Text style={{ color: "white", fontWeight: "700", fontSize: 16 }}>🔧 Claim This Job</Text>
                </TouchableOpacity>
              )}

              {/* DIYER: confirm mechanic */}
              {!isMechanic && selectedJob.status === "PENDING_CONFIRM" && selectedJob.userId === user?.id && (
                <View>
                  <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 8 }}>
                    🔧 {selectedJob.mechanic?.name} wants to take this job
                  </Text>
                  <TouchableOpacity onPress={() => handleConfirmJob(selectedJob)} style={{ backgroundColor: colors.green, padding: 14, borderRadius: 12, alignItems: "center", marginBottom: 8 }}>
                    <Text style={{ color: "white", fontWeight: "700", fontSize: 16 }}>✅ Confirm Mechanic</Text>
                  </TouchableOpacity>
                </View>
              )}

              {selectedJob.status === "IN_PROGRESS" && (
                <View style={{ backgroundColor: colors.blue + "22", padding: 10, borderRadius: 10, alignItems: "center", borderWidth: 1, borderColor: colors.blue }}>
                  <Text style={{ color: colors.blue, fontWeight: "700" }}>🔧 In Progress</Text>
                </View>
              )}
            </View>
          )}

          {openJobs.length === 0 && (
            <View style={{ position: "absolute", top: "35%", left: 0, right: 0, alignItems: "center", padding: 40 }}>
              <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 24, borderWidth: 1, borderColor: colors.border, alignItems: "center" }}>
                <Text style={{ fontSize: 40, marginBottom: 12 }}>💼</Text>
                <Text style={{ color: colors.text, fontSize: 16, fontWeight: "700", textAlign: "center" }}>No open jobs nearby</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 13, textAlign: "center", marginTop: 8 }}>
                  {isMechanic ? "Check back soon!" : "Tap '+ Post Job' to add one"}
                </Text>
              </View>
            </View>
          )}
        </View>
      )}

      {/* MY JOBS LIST VIEW */}
      {mechanicView === "mine" && (
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          {myJobs.length === 0 ? (
            <View style={{ alignItems: "center", marginTop: 60 }}>
              <Text style={{ fontSize: 48 }}>💼</Text>
              <Text style={{ color: colors.text, fontSize: 18, fontWeight: "700", marginTop: 16 }}>
                {isMechanic ? "No claimed jobs yet" : "No jobs posted yet"}
              </Text>
              <Text style={{ color: colors.textSecondary, marginTop: 8, textAlign: "center" }}>
                {isMechanic ? "Claim a job from the map!" : "Tap '+ Post Job' to get started"}
              </Text>
            </View>
          ) : myJobs.map((job: any) => {
            const j = isMechanic ? job : job;
            return (
              <View key={j.id} style={{ backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 14 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                  <Text style={{ color: colors.text, fontSize: 17, fontWeight: "700", flex: 1 }}>{j.title}</Text>
                  <View style={{ backgroundColor: statusColor(j.status) + "22", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, borderWidth: 1, borderColor: statusColor(j.status) }}>
                    <Text style={{ color: statusColor(j.status), fontSize: 11, fontWeight: "700" }}>{j.status}</Text>
                  </View>
                </View>
                <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 4 }}>🚗 {j.vehicle}</Text>
                {j.budget ? <Text style={{ color: colors.green, fontSize: 13, fontWeight: "700", marginBottom: 10 }}>💰 ${j.budget}</Text> : <View style={{ marginBottom: 10 }} />}

                {/* DIYER: pending confirm */}
                {!isMechanic && j.status === "PENDING_CONFIRM" && j.mechanic && (
                  <View style={{ backgroundColor: colors.background, borderRadius: 10, padding: 12, marginBottom: 10 }}>
                    <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 4 }}>Mechanic wants to claim this job</Text>
                    <Text style={{ color: colors.text, fontWeight: "700", marginBottom: 10 }}>🔧 {j.mechanic.name}</Text>
                    <View style={{ flexDirection: "row", gap: 10 }}>
                      <TouchableOpacity onPress={() => handleConfirmJob(j)} style={{ flex: 1, backgroundColor: colors.green, padding: 12, borderRadius: 10, alignItems: "center" }}>
                        <Text style={{ color: "white", fontWeight: "700" }}>✅ Confirm</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleCancelJob(j)} style={{ flex: 1, backgroundColor: colors.background, padding: 12, borderRadius: 10, alignItems: "center", borderWidth: 1, borderColor: "#ef444433" }}>
                        <Text style={{ color: "#ef4444", fontWeight: "700" }}>❌ Cancel</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* IN PROGRESS actions */}
                {j.status === "IN_PROGRESS" && (
                  <View>
                    {j.mechanic && (
                      <View style={{ backgroundColor: colors.background, borderRadius: 10, padding: 12, marginBottom: 10 }}>
                        <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{isMechanic ? "Customer" : "Your mechanic"}</Text>
                        <Text style={{ color: colors.text, fontWeight: "700" }}>{isMechanic ? j.poster?.name : j.mechanic?.name}</Text>
                        <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{isMechanic ? j.poster?.phone || j.poster?.email : j.mechanic?.phone || j.mechanic?.email}</Text>
                      </View>
                    )}
                    <View style={{ flexDirection: "row", gap: 10 }}>
                      {isMechanic && (
                        <TouchableOpacity onPress={() => { setStatusJob(j); setShowStatusModal(true); }} style={{ flex: 1, backgroundColor: "#f59e0b", padding: 12, borderRadius: 10, alignItems: "center" }}>
                          <Text style={{ color: "white", fontWeight: "700" }}>📢 Send Update</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity onPress={() => handleCompleteJob(j)} style={{ flex: 1, backgroundColor: colors.blue, padding: 12, borderRadius: 10, alignItems: "center" }}>
                        <Text style={{ color: "white", fontWeight: "700" }}>🏁 Complete</Text>
                      </TouchableOpacity>
                      {!isMechanic && (
                        <TouchableOpacity onPress={() => handleCancelJob(j)} style={{ flex: 1, backgroundColor: colors.background, padding: 12, borderRadius: 10, alignItems: "center", borderWidth: 1, borderColor: "#ef444433" }}>
                          <Text style={{ color: "#ef4444", fontWeight: "700" }}>❌ Cancel</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                )}

                {/* DIYER: delete open job */}
                {!isMechanic && j.status === "OPEN" && (
                  <TouchableOpacity onPress={() => handleDeleteJob(j)} style={{ marginTop: 8, backgroundColor: colors.background, padding: 10, borderRadius: 10, alignItems: "center", borderWidth: 1, borderColor: "#ef444433" }}>
                    <Text style={{ color: "#ef4444", fontWeight: "700" }}>🗑️ Delete Job</Text>
                  </TouchableOpacity>
                )}

                {j.status === "COMPLETED" && (
                  <View style={{ backgroundColor: colors.blue + "22", padding: 10, borderRadius: 10, alignItems: "center", borderWidth: 1, borderColor: colors.blue }}>
                    <Text style={{ color: colors.blue, fontWeight: "700" }}>✅ Completed</Text>
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}