/**
 * Modal to select or create a course and add the current deck to it.
 */
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { X, Plus, GraduationCap, Check } from "lucide-react-native";
import { useColors, spacing, radius, typography } from "../theme";
import { useTranslation } from "react-i18next";
import {
  listCourses,
  createCourse,
  addDeckToCourse,
  type Course,
} from "../lib/api";

interface CoursePickerModalProps {
  visible: boolean;
  deckId: string;
  onClose: () => void;
  onAdded: (course: Course) => void;
}

export default function CoursePickerModal({
  visible,
  deckId,
  onClose,
  onAdded,
}: CoursePickerModalProps) {
  const colors = useColors();
  const { t } = useTranslation();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [adding, setAdding] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      loadCourses();
    }
  }, [visible]);

  const loadCourses = async () => {
    setLoading(true);
    try {
      const { courses: fetched } = await listCourses();
      setCourses(fetched);
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCourse = async () => {
    if (!newTitle.trim()) return;
    try {
      const { course } = await createCourse(newTitle.trim());
      setCourses((prev) => [course, ...prev]);
      setNewTitle("");
      setCreating(false);
      // Auto-add deck to the new course
      await handleAddToCourse(course);
    } catch {
      Alert.alert(t("common.error"), t("course.createError"));
    }
  };

  const handleAddToCourse = async (course: Course) => {
    setAdding(course.id);
    try {
      await addDeckToCourse(course.id, deckId);
      onAdded(course);
      onClose();
    } catch {
      Alert.alert(t("common.error"), t("course.addError"));
    } finally {
      setAdding(null);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        {/* Header */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            padding: spacing.lg,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            backgroundColor: colors.surface,
          }}
        >
          <TouchableOpacity onPress={onClose} style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
            <X size={18} color={colors.textSecondary} />
            <Text style={{ color: colors.textSecondary, fontSize: typography.base }}>{t("common.cancel")}</Text>
          </TouchableOpacity>
          <Text style={{ fontWeight: typography.bold, fontSize: typography.lg, color: colors.text }}>
            {t("course.select")}
          </Text>
          <TouchableOpacity
            onPress={() => setCreating(true)}
            style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}
          >
            <Plus size={18} color={colors.primary} />
            <Text style={{ color: colors.primary, fontSize: typography.base, fontWeight: typography.semibold }}>
              {t("common.new")}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Create new course inline */}
        {creating && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              padding: spacing.lg,
              gap: spacing.sm,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
              backgroundColor: colors.surfaceSecondary,
            }}
          >
            <TextInput
              value={newTitle}
              onChangeText={setNewTitle}
              placeholder={t("course.titlePlaceholder")}
              placeholderTextColor={colors.textTertiary}
              autoFocus
              style={{
                flex: 1,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: radius.md,
                padding: spacing.md,
                fontSize: typography.base,
                backgroundColor: colors.surface,
                color: colors.text,
              }}
            />
            <TouchableOpacity
              onPress={handleCreateCourse}
              disabled={!newTitle.trim()}
              style={{
                backgroundColor: newTitle.trim() ? colors.primary : colors.textTertiary,
                borderRadius: radius.md,
                padding: spacing.md,
              }}
            >
              <Check size={18} color={colors.textInverse} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setCreating(false); setNewTitle(""); }}>
              <X size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        )}

        {/* Course list */}
        {loading ? (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}>
            {courses.length === 0 ? (
              <View style={{ alignItems: "center", paddingTop: 40, gap: spacing.md }}>
                <GraduationCap size={40} color={colors.textTertiary} />
                <Text style={{ color: colors.textSecondary, textAlign: "center", fontSize: typography.base }}>
                  {t("course.empty")}
                </Text>
              </View>
            ) : (
              courses.map((course) => (
                <TouchableOpacity
                  key={course.id}
                  onPress={() => handleAddToCourse(course)}
                  disabled={adding === course.id}
                  activeOpacity={0.7}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    padding: spacing.lg,
                    backgroundColor: colors.surface,
                    borderRadius: radius.md,
                    borderWidth: 1,
                    borderColor: colors.border,
                    gap: spacing.md,
                  }}
                >
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor: course.color ?? colors.primaryLight,
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    <GraduationCap size={18} color={course.color ? colors.textInverse : colors.primary} />
                  </View>
                  <Text style={{ flex: 1, fontSize: typography.base, fontWeight: typography.medium, color: colors.text }}>
                    {course.title}
                  </Text>
                  {adding === course.id && <ActivityIndicator size="small" color={colors.primary} />}
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
}
