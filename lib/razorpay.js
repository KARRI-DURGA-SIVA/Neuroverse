const crypto = require("crypto");

function getRazorpayConfig() {
  const prices = (process.env.RAZORPAY_CREDIT_PACK_PRICES_INR || "")
    .split(",")
    .map((value) => Number(value.trim()));
  const pricesInr = prices.length && prices.every((price) => Number.isFinite(price) && price > 0)
    ? prices
    : [];

  return {
    keyId: process.env.RAZORPAY_KEY_ID || "",
    keySecret: process.env.RAZORPAY_KEY_SECRET || "",
    configId: process.env.RAZORPAY_CONFIG_ID || "",
    pricesInr,
  };
}

function isRazorpayEnabled(config = getRazorpayConfig()) {
  return Boolean(config.keyId && config.keySecret && config.configId && config.pricesInr.length);
}

function verifyCheckoutSignature(orderId, paymentId, signature, keySecret) {
  const expected = crypto.createHmac("sha256", keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(String(signature || ""));
  return expectedBuffer.length === receivedBuffer.length
    && crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
}

async function razorpayRequest(path, { method = "GET", body } = {}) {
  const { keyId, keySecret } = getRazorpayConfig();
  if (!keyId || !keySecret) throw new Error("Razorpay is not configured");

  const response = await fetch(`https://api.razorpay.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error?.description || "Razorpay request failed");
  }
  return result;
}

module.exports = {
  getRazorpayConfig,
  isRazorpayEnabled,
  razorpayRequest,
  verifyCheckoutSignature,
};