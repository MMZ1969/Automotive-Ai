import { useTheme } from "@context/ThemeContext";
import {
  addMonthsToDay,
  completeReminder,
  createReminder,
  deleteReminder,
  fetchReminders,
  formatDue,
  Reminder,
  REMINDER_PRESETS,
  repeatLabel,
  todayDay,
} from "@lib/reminders";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const REPEAT_OPTIONS: (number | null)[] = [null, 3, 6, 12, 24];

export default function VehicleReminders({ vehicleId }: { vehicleId: string }) {
  const { colors } = useTheme();
  const router = useRouter();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  // Add-reminder sheet
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [months, setMonths] = useState<number | null>(6);
  const [dueDay, setDueDay] = useState(addMonthsToDay(todayDay(), 6));
  const [dueEdited, setDueEdited] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setReminders(await fetchReminders(vehicleId));
    } catch (err) {
      console.error("LOAD REMINDERS ERROR:", err);
    } finally {
      setLoading(false);
    }
  }, [vehicleId]);

  // Reload whenever the vehicle screen regains focus (e.g. after logging a job).
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openAdd = () => {
    setTitle("");
    setMonths(6);
    setDueDay(addMonthsToDay(todayDay(), 6));
    setDueEdited(false);
    setAdding(true);
  };

  const pickRepeat = (m: number | null) => {
    setMonths(m);
    // Follow the interval until the user types their own date.
    if (!dueEdited && m) setDueDay(addMonthsToDay(todayDay(), m));
  };

  const pickPreset = (p: { title: string; months: number }) => {
    setTitle(p.title);
    setMonths(p.months);
    if (!dueEdited) setDueDay(addMonthsToDay(todayDay(), p.months));
  };

  const handleCreate = async () => {
    if (!title.trim()) { Alert.alert("Name it", "What should we remind you about?"); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDay)) { Alert.alert("Due date", "Use the format YYYY-MM-DD."); return; }
    setSaving(true);
    try {
      await createReminder({ vehicleId, title: title.trim(), intervalMonths: months, dueAt: dueDay });
      setAdding(false);
      load();
    } catch (err: any) {
      Alert.alert("Couldn't save", err?.response?.data?.message || "Try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDone = async (r: Reminder) => {
    setBusyId(r.id);
    try {
      const result = await completeReminder(r.id);
      await load();
      const next = result.reminder ? formatDue(result.reminder.dueAt).text.replace(/^Due /, "") : null;
      Alert.alert(
        "✅ Nice work",
        `${next ? `Next ${r.title.toLowerCase()} reminder: ${next}.\n\n` : ""}Add it to your maintenance log too?`,
        [
          { text: "Not now", style: "cancel" },
          {
            text: "Add to log",
            onPress: () =>
              router.push({
                pathname: "/(tabs)/(profile)/vehicles/[id]/logs/add",
                params: { id: vehicleId, title: r.title, skipRemind: "1" },
              }),
          },
        ]
      );
    } catch (err: any) {
      Alert.alert("Error", err?.response?.data?.message || "Couldn't update that reminder.");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = (r: Reminder) => {
    Alert.alert("Delete reminder", `Stop reminding you about "${r.title}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          setBusyId(r.id);
          try {
            await deleteReminder(r.id);
            setReminders((prev) => prev.filter((x) => x.id !== r.id));
          } catch {
            Alert.alert("Error", "Couldn't delete that reminder.");
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

  const toneColor = (tone: string) => (tone === "overdue" ? "#ef4444" : tone === "soon" ? "#f59e0b" : colors.textSecondary);

  const chip = (selected: boolean) => ({
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: selected ? colors.blue : colors.border,
    backgroundColor: selected ? colors.blue : colors.card,
  });

  return (
    <View style={{ backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 20 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: reminders.length ? 8 : 0 }}>
        <Text style={{ color: colors.text, fontSize: 17, fontWeight: "700" }}>🔔 Reminders</Text>
        <TouchableOpacity onPress={openAdd} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: colors.blue }}>
          <Text style={{ color: "white", fontWeight: "700", fontSize: 13 }}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.blue} style={{ marginTop: 12 }} />
      ) : reminders.length === 0 ? (
        <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 10, lineHeight: 19 }}>
          Get a push when the oil change, tire rotation or registration is due.
        </Text>
      ) : (
        reminders.map((r, i) => {
          const due = formatDue(r.dueAt);
          return (
            <View key={r.id} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 10, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.border }}>
              <TouchableOpacity onLongPress={() => handleDelete(r)} style={{ flex: 1, paddingRight: 8 }}>
                <Text style={{ color: colors.text, fontSize: 15, fontWeight: "600" }}>{r.title}</Text>
                <Text style={{ color: toneColor(due.tone), fontSize: 13, marginTop: 2 }}>
                  {due.text} <Text style={{ color: colors.textMuted }}>· {repeatLabel(r.intervalMonths)}</Text>
                </Text>
              </TouchableOpacity>
              {busyId === r.id ? (
                <ActivityIndicator color={colors.blue} size="small" style={{ width: 70 }} />
              ) : (
                <View style={{ flexDirection: "row", gap: 6 }}>
                  <TouchableOpacity onPress={() => handleDone(r)} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: colors.green }}>
                    <Text style={{ color: colors.green, fontWeight: "700", fontSize: 13 }}>✓ Done</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDelete(r)} style={{ paddingHorizontal: 8, paddingVertical: 6 }}>
                    <Text style={{ color: colors.textMuted, fontSize: 15 }}>✕</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })
      )}

      <Modal visible={adding} animationType="slide" transparent onRequestClose={() => setAdding(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "#00000088" }}>
          <View style={{ backgroundColor: colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "88%" }}>
            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <Text style={{ color: colors.text, fontSize: 20, fontWeight: "900" }}>New reminder</Text>
                <TouchableOpacity onPress={() => setAdding(false)}>
                  <Text style={{ color: colors.textMuted, fontSize: 16 }}>Cancel</Text>
                </TouchableOpacity>
              </View>

              <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: "600", marginBottom: 8 }}>Common</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                {REMINDER_PRESETS.map((p) => (
                  <TouchableOpacity key={p.title} onPress={() => pickPreset(p)} style={chip(title === p.title)}>
                    <Text style={{ color: title === p.title ? "white" : colors.textSecondary, fontSize: 13, fontWeight: "600" }}>{p.title}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: "600", marginBottom: 6 }}>Name</Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                maxLength={60}
                placeholder="e.g. Transmission fluid"
                placeholderTextColor={colors.textMuted}
                style={{ backgroundColor: colors.input, color: colors.text, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.border, fontSize: 15, marginBottom: 16 }}
              />

              <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: "600", marginBottom: 8 }}>Repeat</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                {REPEAT_OPTIONS.map((m) => (
                  <TouchableOpacity key={String(m)} onPress={() => pickRepeat(m)} style={chip(months === m)}>
                    <Text style={{ color: months === m ? "white" : colors.textSecondary, fontSize: 13, fontWeight: "600" }}>
                      {m === null ? "One-time" : m % 12 === 0 ? `${m / 12} yr` : `${m} mo`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: "600", marginBottom: 6 }}>First due</Text>
              <TextInput
                value={dueDay}
                onChangeText={(t) => { setDueDay(t); setDueEdited(true); }}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.textMuted}
                keyboardType="numbers-and-punctuation"
                style={{ backgroundColor: colors.input, color: colors.text, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.border, fontSize: 15 }}
              />
              <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 6 }}>
                You'll get a push that morning{months ? ", then it rolls forward each time you tap Done" : ""}.
              </Text>

              <TouchableOpacity
                onPress={handleCreate}
                disabled={saving}
                style={{ backgroundColor: saving ? colors.border : colors.blue, padding: 16, borderRadius: 14, alignItems: "center", marginTop: 24 }}
              >
                {saving ? <ActivityIndicator color="white" /> : <Text style={{ color: "white", fontSize: 16, fontWeight: "700" }}>Save reminder</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
