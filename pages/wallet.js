import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Script from "next/script";
import Layout from "../components/Layout";
import { apiFetch } from "../lib/api-client";

export default function Wallet() {
  const router = useRouter();
  const [packs, setPacks] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [buying, setBuying] = useState(null);
  const [notice, setNotice] = useState("");
  const [paymentEnabled, setPaymentEnabled] = useState(false);
  const [razorpayEnabled, setRazorpayEnabled] = useState(false);
  const [pendingVerification, setPendingVerification] = useState(null);

  async function load() {
    const p = await apiFetch("/api/wallet/buy");
    setPacks(p.packs);
    setPaymentEnabled(p.paymentEnabled);
    setRazorpayEnabled(p.razorpayEnabled);
    const t = await apiFetch("/api/wallet/transactions");
    setTransactions(t.transactions);
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("neuroverse_razorpay_pending");
      if (saved) setPendingVerification(JSON.parse(saved));
    } catch {
      sessionStorage.removeItem("neuroverse_razorpay_pending");
    }
  }, []);

  useEffect(() => {
    const { checkout, packIndex, session_id: sessionId } = router.query;
    if (checkout === "success" && packIndex !== undefined && sessionId) {
      const idx = Number(packIndex);
      if (!Number.isNaN(idx)) {
        apiFetch("/api/wallet/buy", { method: "POST", body: JSON.stringify({ packIndex: idx, sessionId, paymentSource: "checkout" }) })
          .then(() => {
            setNotice("Payment successful. Your credits have been added.");
            return load();
          })
          .catch(() => setNotice("Payment was completed, but the credit update could not be confirmed."));
      }
    }
    if (checkout === "cancelled") {
      setNotice("Payment cancelled. No credits were added.");
    }
  }, [router.query]);

  async function buy(idx) {
    setBuying(idx);
    setNotice("");
    try {
      const result = await apiFetch("/api/wallet/buy", { method: "POST", body: JSON.stringify({ packIndex: idx }) });
      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
        return;
      }
      setNotice("Credits added successfully.");
      await load();
    } catch (err) {
      setNotice(err.message || "Unable to complete checkout.");
    } finally {
      setBuying(null);
    }
  }

  async function verifyRazorpayPayment(payment) {
    setPendingVerification(payment);
    sessionStorage.setItem("neuroverse_razorpay_pending", JSON.stringify(payment));
    try {
      await apiFetch("/api/wallet/razorpay-verify", {
        method: "POST",
        body: JSON.stringify(payment),
      });
      sessionStorage.removeItem("neuroverse_razorpay_pending");
      setPendingVerification(null);
      setNotice("Payment verified. Your credits have been added.");
      await load();
    } catch (error) {
      setNotice(error.message || "Payment verification is incomplete. Retry verification before starting another checkout.");
    }
  }

  async function buyWithRazorpay(idx, user) {
    setBuying(idx);
    setNotice("");
    try {
      const idempotencyKey = window.crypto.randomUUID();
      const order = await apiFetch("/api/wallet/razorpay-order", {
        method: "POST",
        body: JSON.stringify({ packIndex: idx, idempotencyKey }),
      });
      if (!window.Razorpay) throw new Error("Razorpay Checkout has not loaded. Refresh and try again.");

      const checkout = new window.Razorpay({
        key: order.keyId,
        order_id: order.orderId,
        amount: order.amount,
        currency: order.currency,
        name: "NeuroVerse",
        description: `${order.credits} wallet credits`,
        image: "/favicon.ico",
        config_id: order.configId || undefined,
        prefill: { name: user.name, email: user.email },
        theme: { color: "#2858e8" },
        method: { upi: true, netbanking: true, card: false, wallet: false, emi: false, paylater: false },
        handler: async (response) => {
          await verifyRazorpayPayment({
            orderId: response.razorpay_order_id,
            paymentId: response.razorpay_payment_id,
            signature: response.razorpay_signature,
          });
          setBuying(null);
        },
        modal: { ondismiss: () => setBuying(null) },
      });
      checkout.open();
    } catch (err) {
      setNotice(err.message || "Unable to start Razorpay checkout.");
      setBuying(null);
    }
  }

  return (
    <Layout>
      {({ user }) => (
        <>
        <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" />
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-semibold text-ink-900">Wallet</h1>
            <p className="text-ink-500 text-sm mt-1">Current balance: <span className="font-semibold text-ink-900">{user.credits} credits</span></p>
          </div>

          {notice && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</div>}
          {pendingVerification && <button type="button" onClick={() => verifyRazorpayPayment(pendingVerification)} className="btn-secondary text-sm">Retry payment verification</button>}

          <div>
            <h2 className="text-base font-semibold text-ink-900 mb-3">Buy credits</h2>
            <p className="mb-4 text-xs text-ink-500">{razorpayEnabled ? "Razorpay checkout accepts UPI and netbanking." : paymentEnabled ? "Razorpay is not configured; Stripe Checkout remains available." : "Configure Razorpay wallet pricing and keys to enable UPI and netbanking checkout."}</p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {packs.map((p, i) => (
                <div key={i} className="card p-5 text-center">
                  <p className="text-2xl font-semibold text-ink-900">{p.credits}</p>
                  <p className="text-xs text-ink-500 mb-3">credits</p>
                  {p.priceINR ? <p className="text-sm text-ink-700 mb-3">₹{p.priceINR}</p> : <p className="text-sm text-ink-700 mb-3">${p.priceUSD}</p>}
                  {razorpayEnabled && <button onClick={() => buyWithRazorpay(i, user)} disabled={buying === i || Boolean(pendingVerification)} className="btn-primary mb-2 w-full text-sm">{buying === i ? "Processing..." : pendingVerification ? "Verify previous payment first" : "Pay with Razorpay"}</button>}
                  {paymentEnabled && <button onClick={() => buy(i)} disabled={buying === i} className="btn-secondary w-full text-sm">{buying === i ? "Processing..." : "Pay with Stripe"}</button>}
                  {!razorpayEnabled && !paymentEnabled && <button disabled className="btn-primary w-full text-sm opacity-50">Payments unavailable</button>}
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-base font-semibold text-ink-900 mb-3">Transaction history</h2>
            <div className="card divide-y divide-gray-100">
              {transactions.map((t) => (
                <div key={t.id} className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-ink-900 capitalize">{t.type.replace("_", " ")}</p>
                    <p className="text-xs text-ink-500">{t.description}</p>
                  </div>
                  <p className={`text-sm font-semibold ${Number(t.credits) >= 0 ? "text-green-600" : "text-red-500"}`}>
                    {Number(t.credits) >= 0 ? "+" : ""}{t.credits}
                  </p>
                </div>
              ))}
              {transactions.length === 0 && <p className="p-4 text-sm text-ink-500">No transactions yet.</p>}
            </div>
          </div>
        </div>
        </>
      )}
    </Layout>
  );
}
