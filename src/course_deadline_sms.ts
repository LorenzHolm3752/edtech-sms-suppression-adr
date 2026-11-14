import { z } from "zod";
import { createSmsClient, type SmsMessage } from "./infrai_sms.js";

export const deadlineRequestSchema = z.object({
  courseId: z.string().min(1),
  courseTitle: z.string().min(1),
  deadline: z.string().datetime(),
  learners: z.array(z.object({
    learnerId: z.string().min(1),
    phone: z.string().min(7),
    optedOut: z.boolean()
  })).min(1)
});

export type DeadlineRequest = z.infer<typeof deadlineRequestSchema>;

export function planDeadlineMessages(input: DeadlineRequest, now: Date): SmsMessage[] {
  const deadline = new Date(input.deadline);
  if (deadline.getTime() <= now.getTime()) return [];
  return input.learners
    .filter((learner) => !learner.optedOut)
    .map((learner) => ({
      to: learner.phone,
      text: `${input.courseTitle} deadline is ${deadline.toISOString()}. Keep going, ${learner.learnerId}.`
    }));
}

export async function sendDeadlineReminders(raw: unknown, now = new Date()) {
  const input = deadlineRequestSchema.parse(raw);
  const messages = planDeadlineMessages(input, now);
  if (messages.length === 0) return { courseId: input.courseId, status: "no_messages", sent: 0 } as const;
  const infrai = createSmsClient();
  await infrai.sms.batch.send(messages, `course-deadline-${input.courseId}-${input.deadline}`);
  return { courseId: input.courseId, status: "sent", sent: messages.length } as const;
}

if (process.argv[1]?.endsWith("course_deadline_sms.ts")) {
  const sample = {
    courseId: "typescript-101",
    courseTitle: "TypeScript 101",
    deadline: "2099-06-01T17:00:00.000Z",
    learners: [
      { learnerId: "learner-ada", phone: process.env.EDTECH_PHONE ?? "+15550001111", optedOut: false },
      { learnerId: "learner-grace", phone: "+15550002222", optedOut: true }
    ]
  };
  sendDeadlineReminders(sample).then((result) => console.log(JSON.stringify(result))).catch((error: Error) => console.error(error.message));
}
