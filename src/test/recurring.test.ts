import { describe, it, expect } from "vitest";
import {
  getOccurrencesUpTo,
  generateScheduledTasks,
  syncTaskCompletionToHabits,
  syncHabitCompletionToTasks,
} from "@/lib/recurring-engine";
import type { Task, RecurringConfig } from "@/lib/types";

describe("Recurring Task Engine", () => {
  const baseConfig: RecurringConfig = {
    id: "config-1",
    habitId: "habit-1",
    workspace: "personal",
    quadrant: "q2",
    taskName: "Read Books",
    schedule: "daily",
    enabled: true,
    startDate: "2026-07-01",
  };

  describe("getOccurrencesUpTo", () => {
    it("should generate daily occurrences correctly", () => {
      const occurrences = getOccurrencesUpTo(baseConfig, "2026-07-05");
      expect(occurrences).toEqual([
        "2026-07-01",
        "2026-07-02",
        "2026-07-03",
        "2026-07-04",
        "2026-07-05",
      ]);
    });

    it("should respect end date limits", () => {
      const configWithEnd = { ...baseConfig, endDate: "2026-07-03" };
      const occurrences = getOccurrencesUpTo(configWithEnd, "2026-07-05");
      expect(occurrences).toEqual(["2026-07-01", "2026-07-02", "2026-07-03"]);
    });

    it("should handle weekly schedules", () => {
      const weeklyConfig = { ...baseConfig, schedule: "weekly" as const };
      const occurrences = getOccurrencesUpTo(weeklyConfig, "2026-07-16");
      expect(occurrences).toEqual(["2026-07-01", "2026-07-08", "2026-07-15"]);
    });

    it("should handle monthly schedules", () => {
      const monthlyConfig = { ...baseConfig, schedule: "monthly" as const };
      const occurrences = getOccurrencesUpTo(monthlyConfig, "2026-09-02");
      expect(occurrences).toEqual(["2026-07-01", "2026-08-01", "2026-09-01"]);
    });

    it("should handle custom schedule: Every X Days", () => {
      const customConfig: RecurringConfig = {
        ...baseConfig,
        schedule: "custom",
        customValue: 3,
        customUnit: "days",
      };
      const occurrences = getOccurrencesUpTo(customConfig, "2026-07-11");
      expect(occurrences).toEqual(["2026-07-01", "2026-07-04", "2026-07-07", "2026-07-10"]);
    });
  });

  describe("generateScheduledTasks", () => {
    it("should generate tasks when none exist", () => {
      const allTasks = { personal: [], professional: [] };
      const { updatedTasks, generatedCount } = generateScheduledTasks(allTasks, [baseConfig], "2026-07-03");
      
      expect(generatedCount).toBe(3);
      expect(updatedTasks.personal).toHaveLength(3);
      expect(updatedTasks.personal[0].title).toBe("Read Books");
      expect(updatedTasks.personal[0].recurringConfigId).toBe("config-1");
      expect(updatedTasks.personal[0].recurringDate).toBe("2026-07-01");
    });

    it("should skip generation if task occurrence already exists", () => {
      const existingTask: Task = {
        id: "task-existing",
        title: "Read Books",
        completed: false,
        status: "pending",
        priority: "low",
        quadrant: "q2",
        createdAt: new Date().toISOString(),
        recurringConfigId: "config-1",
        recurringDate: "2026-07-01",
      };
      const allTasks = { personal: [existingTask], professional: [] };
      const { updatedTasks, generatedCount } = generateScheduledTasks(allTasks, [baseConfig], "2026-07-02");

      expect(generatedCount).toBe(1); // Only 2026-07-02 is generated
      expect(updatedTasks.personal).toHaveLength(2);
      expect(updatedTasks.personal.find((t) => t.recurringDate === "2026-07-02")).toBeDefined();
    });
  });

  describe("Bidirectional Synchronization", () => {
    it("should sync task completion back to habits store", () => {
      const task: Task = {
        id: "task-1",
        title: "Read Books",
        completed: true,
        status: "done",
        priority: "low",
        quadrant: "q2",
        createdAt: new Date().toISOString(),
        recurringConfigId: "config-1",
        recurringDate: "2026-07-05",
      };

      const habitsStore = {
        theme: "dark",
        months: {},
      };

      const { updatedHabits, changed } = syncTaskCompletionToHabits(task, true, habitsStore, [baseConfig]);
      
      expect(changed).toBe(true);
      expect(updatedHabits.months["2026-07"].days[5].checks["habit-1"]).toBe(true);
    });

    it("should sync habit check toggles back to tasks list", () => {
      const task: Task = {
        id: "task-1",
        title: "Read Books",
        completed: false,
        status: "pending",
        priority: "low",
        quadrant: "q2",
        createdAt: new Date().toISOString(),
        recurringConfigId: "config-1",
        recurringDate: "2026-07-05",
      };

      const allTasks = {
        personal: [task],
        professional: [],
      };

      const { updatedTasks, changed } = syncHabitCompletionToTasks(
        "habit-1",
        5,
        "2026-07",
        true,
        allTasks,
        [baseConfig]
      );

      expect(changed).toBe(true);
      expect(updatedTasks.personal[0].completed).toBe(true);
      expect(updatedTasks.personal[0].status).toBe("done");
    });
  });
});
