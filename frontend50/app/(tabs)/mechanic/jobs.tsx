import { useAuth } from "@context/AuthContext";
import api from "@lib/api";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

// ─── SHARED HELPERS ───────────────────────────────────────────────────────────

const statusColor = (status: string) => {
  switch (status) {
    case "OPEN": return "#10b981";
    case "IN_PROGRESS": return "#f59e0b";
    case "COMPLETED": return "#345bff";
    default: return "#6b7280";
  }
};

const StatusBadge = ({ status }: { status: string }) => (
  <View style={{
    backgroundColor: statusColor(status) + "22",
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 10, borderWidth: 1,
    borderColor: statusColor(status),
  }}>
    <Text style={{ color: statusColor(status), fontSize: 11, fontWeight: "700" }}>{status}</Text>
  </View>
);

const inputStyle = {
  backgroundColor: "#050509",
  color: "white" as const,
  padding: 12,
  borderRadius: 10,
  borderWidth: 1,
  borderColor: "#252838",
  marginBottom: 10,
  fontSize: 15,
};

const cardStyle = {
  backgroundColor: "#11131a",
  borderRadius: 16,
  borderWidth: 1,
  borderColor: "#252838",
  padding: 16,
  marginBottom: 14,
};

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export default function Jobs() {
  const { user, isMechanic } = useAuth();
  const router = useRouter();
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [mechanicView, setMechanicView] = useState<"browse" | "mine">("browse");

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showBidModal, setShowBidModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedJob, setSelectedJob] = useState<any>(null);

  // Create job form
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [budget, setBudget] = useState("");
  const [location, setLocation] = useState("");
  const [creating, setCreating] = useState(false);

  // Bid form
  const [bidMessage, setBidMessage] = useState("");
  const [bidPrice, setBidPrice] = useState("");
  const [bidding, setBidding] = useState(false);

  // Review form
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

  // ─── DATA ────────────────────────────────────────────────────────────────────

  const fetchJobs = async () => {
    try {
      const endpoint = isMechanic
        ? mechanicView === "browse" ? "/api/jobs" : "/api/jobs/my-bids"
        : "/api/jobs/mine";
      const res = await api.get(endpoint);
      setJobs(res.data);
    } catch (err) {
      console.error("FETCH JOBS ERROR:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { fetchJobs(); }, [mechanicView]));
  const onRefresh = () => { setRefreshing(true); fetchJobs(); };

  // ─── ACTIONS ─────────────────────────────────────────────────────────────────

  const handleCreateJob = async () => {
    if (!user?.phone) {
      Alert.alert("📞 Phone Required", "Add your phone number in Settings so mechanics can contact you.", [
        { text: "Cancel", style: "cancel" },
        { text: "Go to Settings", onPress: () => router.push("/(tabs)/(profile)/settings") },
      ]);
      return;
    }
    if (!title.trim() || !description.trim() || !vehicle.trim()) {
      Alert.alert("Missing fields", "Title, description and vehicle are required.");
      return;
    }
    try {
      setCreating(true);
      await api.post("/api/jobs", { title, description, vehicle, budget, location });
      setShowCreateModal(false);
      setTitle(""); setDescription(""); setVehicle(""); setBudget(""); setLocation("");
      fetchJobs();
      Alert.alert("✅ Job Posted!", "Mechanics can now bid on your job.");
    } catch (err) {
      Alert.alert("Error", "Could not post job. Try again.");
    } finally {
      setCreating(false);
    }
  };

  const handlePlaceBid = async () => {
    if (!bidMessage.trim() || !bidPrice.trim()) {
      Alert.alert("Missing fields", "Message and price are required.");
      return;
    }
    try {
      setBidding(true);
      await api.post(`/api/jobs/${selectedJob.id}/bid`, {
        message: bidMessage,
        price: Number(bidPrice),
      });
      setShowBidModal(false);
      setBidMessage(""); setBidPrice("");
      fetchJobs();
      Alert.alert("✅ Bid Placed!", "The DIYer will be notified.");
    } catch (err: any) {
      Alert.alert(
        err?.response?.status === 400 ? "Already Bid" : "Error",
        err?.response?.status === 400 ? "You already bid on this job." : "Could not place bid. Try again."
      );
    } finally {
      setBidding(false);
    }
  };

  const handleAcceptBid = async (jobId: number, bidId: number) => {
    Alert.alert("Accept Bid", "Accept this bid?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Accept", onPress: async () => {
          try {
            await api.post(`/api/jobs/${jobId}/bids/${bidId}/accept`);
            fetchJobs();
            Alert.alert("🎉 Accepted!", "The mechanic has been notified.");
          } catch {
            Alert.alert("Error", "Could not accept bid. Try again.");
          }
        },
      },
    ]);
  };

  const handleDeleteJob = async (jobId: number) => {
    Alert.alert("Delete Job", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive", onPress: async () => {
          try {
            await api.delete(`/api/jobs/${jobId}`);
            fetchJobs();
          } catch {
            Alert.alert("Error", "Could not delete job. Try again.");
          }
        },
      },
    ]);
  };

  const handleMechanicComplete = async (job: any) => {
    Alert.alert("Complete Job", "Mark this job as complete?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Complete", onPress: async () => {
          try {
            await api.post(`/api/jobs/${job.id}/complete`);
            fetchJobs();
            Alert.alert("🏁 Done!", "The customer has been notified.");
          } catch {
            Alert.alert("Error", "Could not complete job. Try again.");
          }
        },
      },
    ]);
  };

  const handleDiyerComplete = async (job: any) => {
    Alert.alert("Complete Job", "Mark this job as completed?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Complete", onPress: async () => {
          try {
            await api.post(`/api/jobs/${job.id}/complete`);
            fetchJobs();
            setSelectedJob(job);
            setShowReviewModal(true);
          } catch {
            Alert.alert("Error", "Could not complete job. Try again.");
          }
        },
      },
    ]);
  };

  const handleCarReady = async (job: any) => {
    try {
      await api.post(`/api/jobs/${job.id}/status-update`, {
        message: "🚗 Your vehicle is ready for pickup!",
      });
      Alert.alert("✅ Sent!", "Customer has been notified their car is ready!");
    } catch {
      Alert.alert("Error", "Could not send notification. Try again.");
    }
  };

  const handleSubmitReview = async () => {
    if (!selectedJob) return;
    const acceptedBid = selectedJob.bids?.find((b: any) => b.status === "ACCEPTED");
    if (!acceptedBid) return;
    try {
      setSubmittingReview(true);
      await api.post("/api/reviews", {
        jobId: selectedJob.id,
        mechanicId: acceptedBid.mechanic.id,
        rating: reviewRating,
        comment: reviewComment,
      });
      setShowReviewModal(false);
      setReviewComment(""); setReviewRating(5);
      Alert.alert("⭐ Review Submitted!", "Thanks for rating your mechanic.");
    } catch (err: any) {
      if (err?.response?.status === 400) {
        Alert.alert("Already Reviewed", "You already reviewed this job.");
        setShowReviewModal(false);
      } else {
        Alert.alert("Error", "Could not submit review. Try again.");
      }
    } finally {
      setSubmittingReview(false);
    }
  };

  // ─── CARD RENDERERS ──────────────────────────────────────────────────────────

  // MECHANIC BROWSE: Clean job card — one action only
  const renderBrowseCard = ({ item }: { item: any }) => (
    <View style={cardStyle}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
        <Text style={{ color: "white", fontSize: 17, fontWeight: "700", flex: 1 }}>{item.title}</Text>
        <StatusBadge status={item.status} />
      </View>
      <Text style={{ color: "#9ca3af", fontSize: 13, marginBottom: 4 }}>🚗 {item.vehicle}</Text>
      <Text style={{ color: "#e5e7eb", fontSize: 14, lineHeight: 20, marginBottom: 8 }}>{item.description}</Text>
      <View style={{ flexDirection: "row", gap: 16, marginBottom: 12 }}>
        {item.budget ? <Text style={{ color: "#10b981", fontSize: 13, fontWeight: "700" }}>💰 ${item.budget}</Text> : null}
        {item.location ? <Text style={{ color: "#9ca3af", fontSize: 13 }}>📍 {item.location}</Text> : null}
      </View>
      {item.poster && (
        <Text style={{ color: "#6b7280", fontSize: 12, marginBottom: 12 }}>Posted by {item.poster.name || "Anonymous"}</Text>
      )}
      {item.status === "OPEN" && (
        <TouchableOpacity
          onPress={() => { setSelectedJob(item); setShowBidModal(true); }}
          style={{ backgroundColor: "#345bff", padding: 13, borderRadius: 10, alignItems: "center" }}
        >
          <Text style={{ color: "white", fontWeight: "700" }}>🔧 Place Bid</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  // MECHANIC MY JOBS: Job title, vehicle, budget + 3 actions
  const renderMyJobCard = ({ item }: { item: any }) => {
    const job = item.job;
    const isActive = job?.status === "IN_PROGRESS";
    return (
      <View style={cardStyle}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
          <Text style={{ color: "white", fontSize: 17, fontWeight: "700", flex: 1 }}>{job?.title}</Text>
          <StatusBadge status={job?.status} />
        </View>
        <Text style={{ color: "#9ca3af", fontSize: 13, marginBottom: 4 }}>🚗 {job?.vehicle}</Text>
        {job?.budget
          ? <Text style={{ color: "#10b981", fontSize: 13, fontWeight: "700", marginBottom: 12 }}>💰 ${job?.budget}</Text>
          : <View style={{ marginBottom: 12 }} />
        }

        {isActive && (
          <View>
            <TouchableOpacity
              onPress={() => handleCarReady(job)}
              style={{ backgroundColor: "#10b981", padding: 14, borderRadius: 10, alignItems: "center", marginBottom: 10 }}
            >
              <Text style={{ color: "white", fontWeight: "900", fontSize: 16 }}>🚗 Your car is ready!</Text>
            </TouchableOpacity>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity
                onPress={() => { setSelectedJob(job); setShowStatusModal(true); }}
                style={{ flex: 1, backgroundColor: "#f59e0b", padding: 12, borderRadius: 10, alignItems: "center" }}
              >
                <Text style={{ color: "white", fontWeight: "700" }}>📢 Send Update</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleMechanicComplete(job)}
                style={{ flex: 1, backgroundColor: "#345bff", padding: 12, borderRadius: 10, alignItems: "center" }}
              >
                <Text style={{ color: "white", fontWeight: "700" }}>🏁 Complete</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {job?.status === "COMPLETED" && (
          <View style={{ backgroundColor: "#345bff22", padding: 10, borderRadius: 10, alignItems: "center", borderWidth: 1, borderColor: "#345bff" }}>
            <Text style={{ color: "#345bff", fontWeight: "700" }}>✅ Job Completed</Text>
          </View>
        )}
      </View>
    );
  };

  // DIYER MY JOBS: Status-focused — accept bids or track progress
  const renderDiyerCard = ({ item }: { item: any }) => (
    <View style={cardStyle}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
        <Text style={{ color: "white", fontSize: 17, fontWeight: "700", flex: 1 }}>{item.title}</Text>
        <StatusBadge status={item.status} />
      </View>
      <Text style={{ color: "#9ca3af", fontSize: 13, marginBottom: 4 }}>🚗 {item.vehicle}</Text>
      {item.budget
        ? <Text style={{ color: "#10b981", fontSize: 13, fontWeight: "700", marginBottom: 10 }}>💰 ${item.budget}</Text>
        : <View style={{ marginBottom: 10 }} />
      }

      {/* OPEN: Show incoming bids */}
      {item.status === "OPEN" && item.bids?.length > 0 && (
        <View style={{ backgroundColor: "#050509", borderRadius: 10, padding: 12, marginBottom: 10 }}>
          <Text style={{ color: "#9ca3af", fontSize: 13, fontWeight: "700", marginBottom: 8 }}>
            {item.bids.length} Bid{item.bids.length !== 1 ? "s" : ""}
          </Text>
          {item.bids.map((bid: any) => (
            <View key={bid.id} style={{ borderTopWidth: 1, borderTopColor: "#252838", paddingTop: 8, marginTop: 8 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <Text style={{ color: "white", fontWeight: "700" }}>{bid.mechanic?.name || "Mechanic"}</Text>
                <Text style={{ color: "#10b981", fontWeight: "700" }}>${bid.price}</Text>
              </View>
              <Text style={{ color: "#9ca3af", fontSize: 13, marginBottom: 8 }}>{bid.message}</Text>
              <TouchableOpacity
                onPress={() => handleAcceptBid(item.id, bid.id)}
                style={{ backgroundColor: "#10b981", padding: 10, borderRadius: 8, alignItems: "center" }}
              >
                <Text style={{ color: "white", fontWeight: "700" }}>✅ Accept This Bid</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {item.status === "OPEN" && !item.bids?.length && (
        <Text style={{ color: "#6b7280", fontSize: 13, marginBottom: 10 }}>⏳ Waiting for mechanics to bid...</Text>
      )}

      {/* IN PROGRESS: Show who's working on it */}
      {item.status === "IN_PROGRESS" && (() => {
        const accepted = item.bids?.find((b: any) => b.status === "ACCEPTED");
        return (
          <View>
            {accepted && (
              <View style={{ backgroundColor: "#050509", borderRadius: 10, padding: 12, marginBottom: 10 }}>
                <Text style={{ color: "#9ca3af", fontSize: 12, marginBottom: 4 }}>Your mechanic</Text>
                <Text style={{ color: "white", fontWeight: "700" }}>{accepted.mechanic?.name}</Text>
                <Text style={{ color: "#10b981", fontWeight: "700" }}>${accepted.price}</Text>
              </View>
            )}
            <TouchableOpacity
              onPress={() => handleDiyerComplete(item)}
              style={{ backgroundColor: "#10b981", padding: 12, borderRadius: 10, alignItems: "center" }}
            >
              <Text style={{ color: "white", fontWeight: "700" }}>🏁 Mark Complete</Text>
            </TouchableOpacity>
          </View>
        );
      })()}

      {/* OPEN: Delete */}
      {item.status === "OPEN" && (
        <TouchableOpacity
          onPress={() => handleDeleteJob(item.id)}
          style={{ marginTop: 8, backgroundColor: "#1a0a0a", padding: 10, borderRadius: 10, alignItems: "center", borderWidth: 1, borderColor: "#ef444433" }}
        >
          <Text style={{ color: "#ef4444", fontWeight: "700" }}>🗑️ Delete Job</Text>
        </TouchableOpacity>
      )}

      {item.status === "COMPLETED" && (
        <View style={{ backgroundColor: "#345bff22", padding: 10, borderRadius: 10, alignItems: "center", borderWidth: 1, borderColor: "#345bff" }}>
          <Text style={{ color: "#345bff", fontWeight: "700" }}>✅ Job Completed</Text>
        </View>
      )}
    </View>
  );

  // ─── RENDER ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: "#050509", justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator color="#345bff" size="large" />
      </View>
    );
  }

  const emptyText = isMechanic
    ? mechanicView === "browse"
      ? { icon: "🔍", title: "No open jobs yet", sub: "Check back soon — DIYers will post jobs here" }
      : { icon: "🔧", title: "No active jobs yet", sub: "Jobs where your bid was accepted will appear here" }
    : { icon: "💼", title: "No jobs posted yet", sub: "Post a job and mechanics will bid on it!" };

  return (
    <View style={{ flex: 1, backgroundColor: "#050509" }}>

      {/* ── CREATE JOB MODAL ── */}
      <Modal visible={showCreateModal} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, backgroundColor: "#00000088", justifyContent: "flex-end" }}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: "flex-end" }}>
            <View style={{ backgroundColor: "#11131a", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 }}>
              <Text style={{ color: "white", fontSize: 22, fontWeight: "900", marginBottom: 20 }}>💼 Post a Job</Text>
              <TextInput placeholder="Job title (e.g. Brake pad replacement)" placeholderTextColor="#4b5563" value={title} onChangeText={setTitle} style={inputStyle} />
              <TextInput placeholder="Describe the problem..." placeholderTextColor="#4b5563" value={description} onChangeText={setDescription} multiline style={[inputStyle, { minHeight: 80, textAlignVertical: "top" }]} />
              <TextInput placeholder="Vehicle (e.g. 2019 Honda Civic)" placeholderTextColor="#4b5563" value={vehicle} onChangeText={setVehicle} style={inputStyle} />
              <TextInput placeholder="Budget (optional)" placeholderTextColor="#4b5563" value={budget} onChangeText={setBudget} keyboardType="numeric" style={inputStyle} />
              <TextInput placeholder="Location (optional)" placeholderTextColor="#4b5563" value={location} onChangeText={setLocation} style={inputStyle} />
              <View style={{ flexDirection: "row", gap: 10, marginTop: 8, marginBottom: 30 }}>
                <TouchableOpacity onPress={() => setShowCreateModal(false)} style={{ flex: 1, backgroundColor: "#252838", padding: 14, borderRadius: 12, alignItems: "center" }}>
                  <Text style={{ color: "white", fontWeight: "700" }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleCreateJob} disabled={creating} style={{ flex: 1, backgroundColor: "#345bff", padding: 14, borderRadius: 12, alignItems: "center" }}>
                  <Text style={{ color: "white", fontWeight: "700" }}>{creating ? "Posting..." : "Post Job"}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── BID MODAL ── */}
      <Modal visible={showBidModal} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, backgroundColor: "#00000088", justifyContent: "flex-end" }}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: "flex-end" }}>
            <View style={{ backgroundColor: "#11131a", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 }}>
              <Text style={{ color: "white", fontSize: 22, fontWeight: "900", marginBottom: 4 }}>🔧 Place a Bid</Text>
              <Text style={{ color: "#9ca3af", fontSize: 13, marginBottom: 20 }}>{selectedJob?.title}</Text>
              <TextInput placeholder="Your message to the DIYer..." placeholderTextColor="#4b5563" value={bidMessage} onChangeText={setBidMessage} multiline style={[inputStyle, { minHeight: 80, textAlignVertical: "top" }]} />
              <TextInput placeholder="Your price ($)" placeholderTextColor="#4b5563" value={bidPrice} onChangeText={setBidPrice} keyboardType="numeric" style={inputStyle} />
              <View style={{ flexDirection: "row", gap: 10, marginTop: 8, marginBottom: 30 }}>
                <TouchableOpacity onPress={() => setShowBidModal(false)} style={{ flex: 1, backgroundColor: "#252838", padding: 14, borderRadius: 12, alignItems: "center" }}>
                  <Text style={{ color: "white", fontWeight: "700" }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handlePlaceBid} disabled={bidding} style={{ flex: 1, backgroundColor: "#345bff", padding: 14, borderRadius: 12, alignItems: "center" }}>
                  <Text style={{ color: "white", fontWeight: "700" }}>{bidding ? "Placing..." : "Place Bid"}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── STATUS UPDATE MODAL ── */}
      <Modal visible={showStatusModal} animationType="slide" transparent>
        <TouchableOpacity style={{ flex: 1, backgroundColor: "#00000088", justifyContent: "flex-end" }} onPress={() => setShowStatusModal(false)}>
          <View style={{ backgroundColor: "#11131a", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 }}>
            <Text style={{ color: "white", fontSize: 22, fontWeight: "900", marginBottom: 4 }}>📢 Send Update</Text>
            <Text style={{ color: "#9ca3af", fontSize: 13, marginBottom: 20 }}>{selectedJob?.title}</Text>
            {[
              "🔧 Work is in progress on your vehicle",
              "🔍 Still diagnosing the issue",
              "💰 Estimate is ready — please call us",
              "⏳ Waiting on parts to arrive",
            ].map((msg) => (
              <TouchableOpacity
                key={msg}
                onPress={async () => {
                  try {
                    await api.post(`/api/jobs/${selectedJob.id}/status-update`, { message: msg });
                    setShowStatusModal(false);
                    Alert.alert("✅ Sent!", "Customer has been notified.");
                  } catch {
                    Alert.alert("Error", "Could not send update. Try again.");
                  }
                }}
                style={{ backgroundColor: "#050509", borderWidth: 1, borderColor: "#252838", padding: 14, borderRadius: 12, marginBottom: 10 }}
              >
                <Text style={{ color: "white", fontSize: 15 }}>{msg}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity onPress={() => setShowStatusModal(false)} style={{ backgroundColor: "#252838", padding: 14, borderRadius: 12, alignItems: "center", marginTop: 4, marginBottom: 20 }}>
              <Text style={{ color: "white", fontWeight: "700" }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── REVIEW MODAL ── */}
      <Modal visible={showReviewModal} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, backgroundColor: "#00000088", justifyContent: "flex-end" }}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: "flex-end" }}>
            <View style={{ backgroundColor: "#11131a", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 }}>
              <Text style={{ color: "white", fontSize: 22, fontWeight: "900", marginBottom: 4 }}>⭐ Rate Your Mechanic</Text>
              <Text style={{ color: "#9ca3af", fontSize: 13, marginBottom: 20 }}>{selectedJob?.title}</Text>
              <View style={{ flexDirection: "row", justifyContent: "center", gap: 12, marginBottom: 20 }}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <TouchableOpacity key={star} onPress={() => setReviewRating(star)}>
                    <Text style={{ fontSize: 36 }}>{star <= reviewRating ? "⭐" : "☆"}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput placeholder="Leave a comment (optional)..." placeholderTextColor="#4b5563" value={reviewComment} onChangeText={setReviewComment} multiline style={[inputStyle, { minHeight: 80, textAlignVertical: "top" }]} />
              <View style={{ flexDirection: "row", gap: 10, marginTop: 8, marginBottom: 30 }}>
                <TouchableOpacity onPress={() => setShowReviewModal(false)} style={{ flex: 1, backgroundColor: "#252838", padding: 14, borderRadius: 12, alignItems: "center" }}>
                  <Text style={{ color: "white", fontWeight: "700" }}>Skip</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSubmitReview} disabled={submittingReview} style={{ flex: 1, backgroundColor: "#345bff", padding: 14, borderRadius: 12, alignItems: "center" }}>
                  <Text style={{ color: "white", fontWeight: "700" }}>{submittingReview ? "Submitting..." : "Submit Review"}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── HEADER ── */}
      <View style={{ paddingTop: 60, paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: "#252838" }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={{ color: "#345bff", fontSize: 16 }}>← Back</Text>
            </TouchableOpacity>
            <Text style={{ color: "white", fontSize: 22, fontWeight: "900" }}>
              {isMechanic ? "🔧 Jobs" : "💼 My Jobs"}
            </Text>
          </View>
          {!isMechanic && (
            <TouchableOpacity onPress={() => setShowCreateModal(true)} style={{ backgroundColor: "#345bff", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 }}>
              <Text style={{ color: "white", fontWeight: "700" }}>+ Post Job</Text>
            </TouchableOpacity>
          )}
        </View>

        {isMechanic && (
          <View style={{ flexDirection: "row", backgroundColor: "#11131a", borderRadius: 12, padding: 4 }}>
            {(["browse", "mine"] as const).map((view) => (
              <TouchableOpacity
                key={view}
                onPress={() => setMechanicView(view)}
                style={{ flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: "center", backgroundColor: mechanicView === view ? "#345bff" : "transparent" }}
              >
                <Text style={{ color: mechanicView === view ? "white" : "#6b7280", fontWeight: "700", fontSize: 14 }}>
                  {view === "browse" ? "🔍 Browse Jobs" : "🔧 My Jobs"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* ── LIST ── */}
      <FlatList
        data={jobs}
        keyExtractor={(item) => item.id.toString()}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#345bff" />}
        contentContainerStyle={{ padding: 16 }}
        renderItem={
          isMechanic
            ? mechanicView === "browse" ? renderBrowseCard : renderMyJobCard
            : renderDiyerCard
        }
        ListEmptyComponent={
          <View style={{ alignItems: "center", marginTop: 60 }}>
            <Text style={{ fontSize: 48 }}>{emptyText.icon}</Text>
            <Text style={{ color: "white", fontSize: 18, fontWeight: "700", marginTop: 16 }}>{emptyText.title}</Text>
            <Text style={{ color: "#9ca3af", marginTop: 8, textAlign: "center" }}>{emptyText.sub}</Text>
            {!isMechanic && (
              <TouchableOpacity onPress={() => setShowCreateModal(true)} style={{ backgroundColor: "#345bff", padding: 14, borderRadius: 12, marginTop: 20, paddingHorizontal: 30 }}>
                <Text style={{ color: "white", fontWeight: "700" }}>Post Your First Job</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />
    </View>
  );
}
