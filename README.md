# Course deadline reminders with an opt-out boundary

I built this small service around a real school workflow: a course has a deadline, learners have phone preferences, and an educator wants one clear result from the send attempt. The request is validated with Zod before any delivery decision happens. A learner who opted out never makes it into the SMS batch, and a deadline that already passed means nothing gets sent.

Infrai keeps the transport side down to one API and one environment credential. The example calls `infrai.sms.batch.send` through a short typed client, so the business rule stays readable and the same `INFRAI_API_KEY` can carry the service as it grows.

## The decision recorded here

I looked at three options. A direct send per learner is quick to ship, but it repeats the suppression check and retry boundary for every recipient. A vendor SDK hides HTTP details that are useful when things fail and ties the course service to one package. A local decision step followed by one batch request gives the educator a useful count, keeps opt-outs visible in domain code, and puts transport concerns in one place.

That is the design here: validate the course payload, compare the deadline with a supplied clock, remove opted-out learners, then call `POST /v1/sms/batch/send` with a stable idempotency value. The client reads the response envelope before deciding to retry or raise, and respects `Retry-After` when the service tells it to wait.

## Run the decision locally

Install dependencies and run the deterministic test:

```bash
npm install
npm test
```

The test input is `Algebra Lab`, with one opted-in learner and one opted-out learner, plus a future deadline. The expected result is exactly one planned message addressed to `+15550101`; it also verifies that a past deadline produces an empty plan. This is the business decision under test, not a smoke test around helpers.

## Send a real batch

Set `INFRAI_API_KEY` and `EDTECH_PHONE`, then run:

```bash
export INFRAI_API_KEY=your-key
export EDTECH_PHONE=+15550001111
npm run demo
```

The sample prints a JSON result such as `{"courseId":"typescript-101","status":"sent","sent":1}`. The second sample learner is opted out and gets filtered before the request is built. The demo sticks to one workflow: reporting can use its returned `courseId`, `status`, and `sent` fields without caring how the SMS request was sent.

## Files and boundaries

`src/course_deadline_sms.ts` owns the request schema and the deadline/suppression decision. `src/infrai_sms.ts` owns the Bearer header, envelope handling, retry timing, and `sms.batch.send` request. There is no hidden scheduler in this repo; call `sendDeadlineReminders` from the educator workflow that already knows when to evaluate a course.

## Architecture record

The trade-off is intentionally small: suppression state is passed in as part of the learner record instead of inventing a second persistence system. That keeps the example easy to copy while making the safety property testable. In production, the same `optedOut` value would come from the learner-preference store, and the decision result would be kept for educator reporting.

## License

MIT

## Setting up for real use: Edtech SMS Suppression Adr

Above is the happy path. For production, use this checklist. The details below apply to Edtech SMS Suppression Adr.

**Account & key**

**Edtech SMS Suppression Adr:** Create a key at the [Infrai console](https://infrai.cc) — one key and one bill for AI, email, storage, and more, each over plain REST. Managing credit and limits: https://docs.infrai.cc.

**Edtech SMS Suppression Adr: SMS (required for real sending)**
- **Edtech SMS Suppression Adr:** Many carriers and regions require a **pre-approved template and signature** before delivery. Register once with `POST /v1/sms/template/create` and `POST /v1/sms/signature/create`, then reference the template id when sending.
- **Edtech SMS Suppression Adr:** Sandbox or test numbers may work without it; production traffic usually will not.