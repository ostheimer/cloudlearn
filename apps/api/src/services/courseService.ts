import { z } from "zod";
import {
  createCourse,
  listCourses,
  getCourse,
  updateCourse,
  deleteCourse,
  addDeckToCourse,
  removeDeckFromCourse,
  listDecksInCourse,
  listCoursesForDeck,
} from "@/lib/db";

const createCourseSchema = z.object({
  userId: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().optional(),
  color: z.string().optional(),
});

const updateCourseSchema = z.object({
  courseId: z.string().uuid(),
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  color: z.string().optional(),
});

export async function createCourseForUser(input: unknown) {
  const parsed = createCourseSchema.parse(input);
  return createCourse(parsed.userId, parsed.title, parsed.description, parsed.color);
}

export async function listCoursesForUser(userId: string) {
  return listCourses(userId);
}

export async function getCourseById(courseId: string) {
  return getCourse(courseId);
}

export async function updateCourseForUser(input: unknown) {
  const parsed = updateCourseSchema.parse(input);
  const updates: Partial<{ title: string; description: string; color: string }> = {};
  if (parsed.title !== undefined) updates.title = parsed.title;
  if (parsed.description !== undefined) updates.description = parsed.description;
  if (parsed.color !== undefined) updates.color = parsed.color;
  return updateCourse(parsed.courseId, updates);
}

export async function deleteCourseForUser(courseId: string): Promise<boolean> {
  return deleteCourse(courseId);
}

export async function addDeckToCourseForUser(courseId: string, deckId: string, position = 0) {
  return addDeckToCourse(courseId, deckId, position);
}

export async function removeDeckFromCourseForUser(courseId: string, deckId: string) {
  return removeDeckFromCourse(courseId, deckId);
}

export async function listDecksInCourseForUser(courseId: string) {
  return listDecksInCourse(courseId);
}

export async function listCoursesForDeckForUser(deckId: string) {
  return listCoursesForDeck(deckId);
}
