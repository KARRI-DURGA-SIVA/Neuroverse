const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { computeSessionPrice } = require("../lib/pricing");
const { razorpayRequest, verifyCheckoutSignature } = require("../lib/razorpay");
const { createZoomMeeting, updateZoomMeetingDuration } = require("../lib/zoom");

test("session pricing uses selected level and duration", () => {
  const beginner = computeSessionPrice({
    baseRate: 20,
    mentorLevel: "advanced",
    sessionLevel: "beginner",
    skillDifficultyFactor: 1,
    mentorAvgRating: 0,
    mentorTotalReviews: 0,
    hours: 2,
  });
  const advanced = computeSessionPrice({
    baseRate: 20,
    mentorLevel: "beginner",
    sessionLevel: "advanced",
    skillDifficultyFactor: 1,
    mentorAvgRating: 0,
    mentorTotalReviews: 0,
    hours: 2,
  });

  assert.equal(beginner.pricePerHour, 10);
  assert.equal(beginner.totalChargedToLearner, 22);
  assert.equal(advanced.pricePerHour, 30);
  assert.equal(advanced.totalChargedToLearner, 66);
});

test("Razorpay checkout signature rejects tampering", () => {
  const secret = "unit-test-secret";
  const signature = crypto.createHmac("sha256", secret).update("order_1|pay_1").digest("hex");
  assert.equal(verifyCheckoutSignature("order_1", "pay_1", signature, secret), true);
  assert.equal(verifyCheckoutSignature("order_1", "pay_2", signature, secret), false);
  assert.equal(verifyCheckoutSignature("order_1", "pay_1", "invalid", secret), false);
});

test("Razorpay order requests use the configured server credentials", async () => {
  const previousFetch = global.fetch;
  const previousId = process.env.RAZORPAY_KEY_ID;
  const previousSecret = process.env.RAZORPAY_KEY_SECRET;
  process.env.RAZORPAY_KEY_ID = "rzp_test_key";
  process.env.RAZORPAY_KEY_SECRET = "unit-test-secret";
  global.fetch = async (url, options) => {
    assert.equal(url, "https://api.razorpay.com/v1/orders");
    assert.equal(options.method, "POST");
    assert.equal(options.headers.Authorization, `Basic ${Buffer.from("rzp_test_key:unit-test-secret").toString("base64")}`);
    assert.deepEqual(JSON.parse(options.body), { amount: 900, currency: "INR" });
    return Response.json({ id: "order_test", amount: 900, currency: "INR" });
  };
  try {
    const order = await razorpayRequest("/orders", { method: "POST", body: { amount: 900, currency: "INR" } });
    assert.equal(order.id, "order_test");
  } finally {
    global.fetch = previousFetch;
    restoreEnv("RAZORPAY_KEY_ID", previousId);
    restoreEnv("RAZORPAY_KEY_SECRET", previousSecret);
  }
});

test("Zoom meeting creation returns only the participant join URL", async () => {
  const previousFetch = global.fetch;
  const previousValues = Object.fromEntries(["ZOOM_ACCOUNT_ID", "ZOOM_CLIENT_ID", "ZOOM_CLIENT_SECRET", "ZOOM_USER_ID"].map((key) => [key, process.env[key]]));
  Object.assign(process.env, {
    ZOOM_ACCOUNT_ID: "account_test",
    ZOOM_CLIENT_ID: "client_test",
    ZOOM_CLIENT_SECRET: "secret_test",
    ZOOM_USER_ID: "me",
  });
  const calls = [];
  global.fetch = async (url, options) => {
    calls.push({ url, options });
    if (String(url).startsWith("https://zoom.us/oauth/token")) return Response.json({ access_token: "test-token", expires_in: 3600 });
    return Response.json({ id: 12345, join_url: "https://zoom.test/join/12345", start_url: "https://zoom.test/host/secret" });
  };
  try {
    const meeting = await createZoomMeeting({
      sessionId: "42",
      title: "Test lesson",
      scheduledStart: "2026-11-01T10:00:00.000Z",
      durationMinutes: 60,
    });
    assert.deepEqual(meeting, { id: "12345", joinUrl: "https://zoom.test/join/12345" });
    assert.match(calls[1].url, /\/users\/me\/meetings$/);
    assert.equal(JSON.parse(calls[1].options.body).duration, 60);
    assert.equal(JSON.parse(calls[1].options.body).start_time, "2026-11-01T10:00:00.000Z");

    await updateZoomMeetingDuration("12345", 75);
    assert.equal(calls[2].options.method, "PATCH");
    assert.deepEqual(JSON.parse(calls[2].options.body), { duration: 75 });
  } finally {
    global.fetch = previousFetch;
    for (const [key, value] of Object.entries(previousValues)) restoreEnv(key, value);
  }
});

function restoreEnv(key, value) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}