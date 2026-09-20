import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import { apiFetch } from "../lib/api-client";

export default function Wallet() {
  const [packs, setPacks] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [buying, setBuying] = useState(null);

  async function load() {
    const p = await apiFetch("/api/wallet/buy");
    setPacks(p.packs);
    const t = await apiFetch("/api/wallet/transactions");
    setTransactions(t.transactions);
  }

  useEffect(() => {
    load();
  }, []);

  async function buy(idx) {
    setBuying(idx);
    try {
      await apiFetch("/api/wallet/buy", { method: "POST", body: JSON.stringify({ packIndex: idx }) });
      await load();
    } finally {
      setBuying(null);
    }
  }

  return (
    <Layout>
      {({ user }) => (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-semibold text-ink-900">Wallet</h1>
            <p className="text-ink-500 text-sm mt-1">Current balance: <span className="font-semibold text-ink-900">{user.credits} credits</span></p>
          </div>

          <div>
            <h2 className="text-base font-semibold text-ink-900 mb-3">Buy credits</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {packs.map((p, i) => (
                <div key={i} className="card p-5 text-center">
                  <p className="text-2xl font-semibold text-ink-900">{p.credits}</p>
                  <p className="text-xs text-ink-500 mb-3">credits</p>
                  <p className="text-sm text-ink-700 mb-3">${p.priceUSD}</p>
                  <button onClick={() => buy(i)} disabled={buying === i} className="btn-primary text-sm w-full">
                    {buying === i ? "Processing..." : "Buy"}
                  </button>
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
      )}
    </Layout>
  );
}
