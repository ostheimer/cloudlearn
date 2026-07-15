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
  // Identity is server-controlled: the route always overrides this with the
  // token's user id, so a userId smuggled into the request body is ignored.
  userId: z.string().uuid(),
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

export async function getCourseById(courseId: string, userId: string) {
  return getCourse(courseId, userId);
}

export async function updateCourseForUser(input: unknown) {
  const parsed = updateCourseSchema.parse(input);
  const updates: Partial<{ title: string; description: string; color: string }> = {};
  if (parsed.title !== undefined) updates.title = parsed.title;
  if (parsed.description !== undefined) updates.description = parsed.description;
  if (parsed.color !== undefined) updates.color = parsed.color;
  return updateCourse(parsed.courseId, parsed.userId, updates);
}

export async function deleteCourseForUser(courseId: string, userId: string): Promise<boolean> {
  return deleteCourse(courseId, userId);
}

export async function addDeckToCourseForUser(courseId: string, userId: string, deckId: string, position = 0) {
  return addDeckToCourse(courseId, userId, deckId, position);
}

export async function removeDeckFromCourseForUser(courseId: string, userId: string, deckId: string) {
  return removeDeckFromCourse(courseId, userId, deckId);
}

export async function listDecksInCourseForUser(courseId: string, userId: string) {
  return listDecksInCourse(courseId, userId);
}

export async function listCoursesForDeckForUser(deckId: string) {
  return listCoursesForDeck(deckId);
}
