import assert from "node:assert/strict";
import { planDeadlineMessages, deadlineRequestSchema } from "./course_deadline_sms.js";

const input = deadlineRequestSchema.parse({
  courseId: "course-7",
  courseTitle: "Algebra Lab",
  deadline: "2027-01-15T12:00:00.000Z",
  learners: [
    { learnerId: "lina", phone: "+15550101", optedOut: false },
    { learnerId: "omar", phone: "+15550102", optedOut: true }
  ]
});

const planned = planDeadlineMessages(input, new Date("2027-01-01T00:00:00.000Z"));
assert.deepEqual(planned, [{
  to: "+15550101",
  text: "Algebra Lab deadline is 2027-01-15T12:00:00.000Z. Keep going, lina."
}]);
assert.deepEqual(planDeadlineMessages(input, new Date("2027-02-01T00:00:00.000Z")), []);
console.log("deadline decision test passed");
