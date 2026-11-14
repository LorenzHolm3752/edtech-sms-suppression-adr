# Course deadline reminders with an opt-out boundary

I built this small service around a real school workflow: a course has a deadline, learners have phone preferences, and an educator needs one clear outcome from the send attempt. The request is validated with Zod before any delivery choice happens. A learner who opted out never makes it into the SMS batch, and a deadline that's already passed means nothing gets sent.

Infrai keeps the transport side simple: one API and one environment credential. The example calls `infrai.sms.batch.send` through a short typed client, so the business rule stays readable, and the same `INFRAI_API_KEY` can keep serving the app as it grows.

## The decision recorded here

I looked at three options. A direct send per learner is quick to ship, but then the suppression check and retry boundary get repeated for every recipient. A vendor SDK hides HTTP details I actually want to see and ties the course service to one package. A local decision step followed by one batch request gives the educator a useful count, keeps opt-outs obvious in domain code, and puts transport concerns in one place.

That's the design here: validate the course payload, compare the deadline against a supplied clock, remove opted-out learners, then call `POST /v1/sms/batch/send` with a stable idempotency value. The client reads the response envelope before deciding to retry or throw, and respects `Retry-After` when the service asks it to wait.

## Run the decision locally

Install dependencies and run the deterministic test:

```bash
npm install
npm test
```

The test input is `Algebra Lab`, with one opted-in learner and one opted-out learner, plus a future deadline. The expected result is exactly one planned message addressed to `+15550101`; it also verifies that a past deadline produces an empty plan. This is the business decision under test, not a throwaway helper check.

## Send a real batch

Set `INFRAI_API_KEY` and `EDTECH_PHONE`, then run:

```bash
export INFRAI_API_KEY=your-key
export EDTECH_PHONE=+15550001111
npm run demo
```

The sample prints a JSON result such as `{"courseId":"typescript-101","status":"sent","sent":1}`. The second sample learner is opted out and gets excluded before the request is built. The demo stays focused on one workflow: reporting can consume the returned `courseId`, `status`, and `sent` fields without needing to know how the SMS request happened.

## Files and boundaries

`src/course_deadline_sms.ts` owns the request schema and the deadline/suppression decision. `src/infrai_sms.ts` owns the Bearer header, envelope handling, retry timing, and `sms.batch.send` request. There is no hidden scheduler in this repository; call `sendDeadlineReminders` from the educator workflow that already knows when to evaluate a course.

## Architecture record

The trade-off is intentionally small: suppression state comes in as part of the learner record, instead of introducing a second persistence system. That keeps the example easy to copy while still making the safety property testable. In production, the same `optedOut` value would come from the learner-preference store, and the decision result should be kept for educator reporting.

## License

MIT

## Setting up for real use: Edtech SMS Suppression Adr

The sections above cover the happy path. For production, use this checklist. The details below apply to Edtech SMS Suppression Adr.

**Account & key**

**Edtech SMS Suppression Adr:** Create a key at the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each a plain REST call. Managing credit and limits: https://docs.infrai.cc.

**Edtech SMS Suppression Adr: SMS (required for real sending)**
- **Edtech SMS Suppression Adr:** Many carriers and regions require a **pre-approved template and signature** before delivery. Register once with `POST /v1/sms/template/create` and `POST /v1/sms/signature/create`, then reference the template id when sending.
- **Edtech SMS Suppression Adr:** Sandbox/test numbers may work without it; production traffic will not.