import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Layout from "../../components/Layout";
import { apiFetch } from "../../lib/api-client";

export default function MentorMatch() {
  const router = useRouter();
  const { skillId } = router.query;
  const [targetLevel, setTargetLevel] = useState("intermediate");
  const [languages, setLanguages] = useState("");
  const [availability, setAvailability] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [hours, setHours] = useState(1);
  const [scheduledStart, setScheduledStart] = useState("");
  const [booking, setBooking] = useState(false);
  const [bookingMsg, setBookingMsg] = useState("");

  async function search() {
    if (!skillId) return;
    setLoading(true);
    try {
      const res = await apiFetch("/api/mentors/match", {
        method: "POST",
        body: JSON.stringify({
          skillId,
          targetLevel,
          preferredLanguages: languages.split(",").map((l) => l.trim()).filter(Boolean),
          preferredAvailability: availability || null,
        }),
      });
      setResult(res);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (skillId) search();
  }, [skillId]);

  async function bookSession() {
    if (!selected || !scheduledStart) return;
    setBooking(true);
    setBookingMsg("");
    try {
      const res = await apiFetch("/api/sessions/book", {
        method: "POST",
        body: JSON.stringify({ courseId: selected.courseId, hours, scheduledStart }),
      });
      setBookingMsg("Request sent. The mentor must accept before the session is booked; credits are charged only after acceptance. Track the request in My Learning.");
      setSelected(null);
    } catch (err) {
      setBookingMsg(err.message);
    } finally {
      setBooking(false);
    }
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-ink-900">Find your mentor</h1>
          <p className="text-ink-500 text-sm mt-1">Tell us your preferences and we'll rank the best-fit mentors for you.</p>
        </div>

        {bookingMsg && <p role="status" className="text-sm text-accent-700">{bookingMsg}</p>}

        <div className="card p-5 grid sm:grid-cols-4 gap-4 items-end">
          <div>
            <label className="label">Target level</label>
            <select className="input-field" value={targetLevel} onChange={(e) => setTargetLevel(e.target.value)}>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </div>
          <div>
            <label className="label">Preferred languages</label>
            <input className="input-field" placeholder="English, Spanish" value={languages} onChange={(e) => setLanguages(e.target.value)} />
          </div>
          <div>
            <label className="label">Availability</label>
            <input className="input-field" placeholder="e.g. evenings" value={availability} onChange={(e) => setAvailability(e.target.value)} />
          </div>
          <button onClick={search} className="btn-primary" disabled={loading}>{loading ? "Searching..." : "Search mentors"}</button>
        </div>

        {result?.learningPath?.length > 0 && (
          <div className="card p-5">
            <h2 className="text-base font-semibold text-ink-900 mb-3">Your learning path</h2>
            <div className="flex flex-col sm:flex-row gap-3">
              {result.learningPath.map((stage, i) => (
                <div key={stage.level} className="flex-1 border border-gray-200 rounded-lg p-3">
                  <p className="text-xs font-medium text-accent-600 mb-1">Stage {i + 1} · {stage.level}</p>
                  <p className="font-medium text-sm text-ink-900">{stage.title}</p>
                  <p className="text-xs text-ink-500 mt-1">{stage.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid gap-4">
          {result?.mentors?.map((m) => (
            <div key={m.courseId} className="card p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-accent-100 text-accent-700 flex items-center justify-center font-semibold shrink-0">
                  {m.mentorName.slice(0, 1).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-ink-900">{m.mentorName}</p>
                    <span className="badge bg-green-50 text-green-700">{m.suitabilityPercent}% match</span>
                  </div>
                  <p className="text-sm text-ink-500">{m.title} · {m.mentorLevel} level · {m.avgRating.toFixed(1)}★ ({m.totalReviews} reviews)</p>
                  <p className="text-xs text-ink-500 mt-1">{m.reasons.join(" · ")}</p>
                  {m.languages?.length > 0 && <p className="text-xs text-ink-500 mt-1">Languages: {m.languages.join(", ")}</p>}
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-lg font-semibold text-ink-900">{m.pricePerHour} <span className="text-xs font-normal text-ink-500">credits/hr</span></p>
                <button onClick={() => setSelected(m)} className="btn-primary text-sm mt-2">Book session</button>
              </div>
            </div>
          ))}
          {result && result.mentors.length === 0 && (
            <div className="card p-6 text-center text-sm text-ink-500">No mentors are teaching this skill yet. Check back soon.</div>
          )}
        </div>

        {selected && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-40 px-4">
            <div className="card p-6 w-full max-w-sm">
              <h3 className="font-semibold text-ink-900 mb-1">Book with {selected.mentorName}</h3>
              <p className="text-sm text-ink-500 mb-4">{selected.pricePerHour} credits/hr · {selected.suitabilityPercent}% match</p>
              <label className="label">Hours</label>
              <input type="number" min="0.5" step="0.5" className="input-field mb-3" value={hours} onChange={(e) => setHours(e.target.value)} />
              <label className="label">Start time</label>
              <input type="datetime-local" className="input-field mb-4" value={scheduledStart} onChange={(e) => setScheduledStart(e.target.value)} />
              <div className="flex gap-2">
                <button onClick={() => setSelected(null)} className="btn-secondary flex-1">Cancel</button>
                <button onClick={bookSession} disabled={booking} className="btn-primary flex-1">{booking ? "Sending..." : "Send request"}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
