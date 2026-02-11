import { randomUUID } from "node:crypto";
import { z } from "zod";

const createClassSchema = z.object({
  tenantId: z.string().min(3),
  teacherUserId: z.string().uuid(),
  className: z.string().min(1)
});

export interface B2bClass {
  classId: string;
  tenantId: string;
  teacherUserId: string;
  className: string;
  createdAt: string;
}

const classes: B2bClass[] = [];

export function createB2bClass(input: unknown): B2bClass {
  const parsed = createClassSchema.parse(input);
  const record: B2bClass = {
    classId: randomUUID(),
    tenantId: parsed.tenantId,
    teacherUserId: parsed.teacherUserId,
    className: parsed.className,
    createdAt: new Date().toISOString()
  };
  classes.push(record);
  return record;
}

export function listB2bClasses(tenantId: string): B2bClass[] {
  return classes.filter((record) => record.tenantId === tenantId);
}

export function resetB2bStore(): void {
  classes.length = 0;
}
