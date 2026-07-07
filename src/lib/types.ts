export type Quadrant = "q1" | "q2" | "q3" | "q4";
export type Priority = "low" | "medium" | "high";
export type Filter = "all" | "active" | "completed";
export type TaskStatus = "pending" | "in_progress" | "done";

export interface Task {
  id: string;
  title: string;
  description?: string;
  quadrant: Quadrant;
  completed: boolean;
  status: TaskStatus;
  dueDate?: string; // ISO
  priority: Priority;
  createdAt: string; // ISO
}

export const QUADRANT_META: Record<Quadrant, { title: string; subtitle: string; tag: string; color: string }> = {
  q1: { title: "Do", subtitle: "Important & Urgent", tag: "I & U", color: "q1" },
  q2: { title: "Schedule", subtitle: "Important · Not Urgent", tag: "I & NU", color: "q2" },
  q3: { title: "Delegate", subtitle: "Not Important · Urgent", tag: "NI & U", color: "q3" },
  q4: { title: "Delete", subtitle: "Not Important · Not Urgent", tag: "NI & NU", color: "q4" },
};
