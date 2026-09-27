import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { apiFetch } from "../lib/api-client";

const MAX_AVATAR_DIMENSION = 256; // px, keeps the stored data URL small
const MAX_AVATAR_SOURCE_MB = 5;

// Resizes/compresses an image file client-side and returns a JPEG data URL,
// so we can store the avatar directly on the user row without needing a
// separate file-upload request or server-side storage bucket.
function fileToAvatarDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("Please choose an image file"));
      return;
    }
    if (file.size > MAX_AVATAR_SOURCE_MB * 1024 * 1024) {
      reject(new Error(`Image must be under ${MAX_AVATAR_SOURCE_MB}MB`));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read image"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Could not load image"));
      img.onload = () => {
        const scale = Math.min(1, MAX_AVATAR_DIMENSION / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.8));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

export default function Signup() {
  const [form, setForm] = useState({ name: "", email: "", password: "", age: "", bio: "" });
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  function update(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function onAvatarChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    try {
      const dataUrl = await fileToAvatarDataUrl(file);
      setAvatarPreview(dataUrl);
    } catch (err) {
      setError(err.message);
    }
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await apiFetch("/api/auth/signup", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          age: form.age ? Number(form.age) : null,
          profilePic: avatarPreview || null,
        }),
      });
      router.push("/onboarding");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#fafafa] px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 justify-center mb-8">
          <div className="w-9 h-9 rounded-lg bg-accent-500 flex items-center justify-center text-white font-bold">N</div>
          <span className="font-semibold text-xl text-ink-900 tracking-tight">NeuroVerse</span>
        </div>
        <div className="card p-8">
          <h1 className="text-lg font-semibold text-ink-900 mb-1">Create your account</h1>
          <p className="text-sm text-ink-500 mb-6">You'll start with <span className="font-medium text-accent-600">50 free credits</span> to book your first session.</p>

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-accent-100 text-accent-700 flex items-center justify-center font-semibold text-xl overflow-hidden shrink-0">
                {avatarPreview ? (
                  <img src={avatarPreview} alt="Profile preview" className="w-full h-full object-cover" />
                ) : (
                  (form.name || "?").slice(0, 1).toUpperCase()
                )}
              </div>
              <div>
                <label className="label mb-1">Profile picture (optional)</label>
                <input
                  className="text-sm text-ink-700 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-accent-50 file:text-accent-700 hover:file:bg-accent-100"
                  type="file"
                  accept="image/*"
                  onChange={onAvatarChange}
                />
              </div>
            </div>
            <div>
              <label className="label">Full name</label>
              <input className="input-field" required value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="Jane Doe" />
            </div>
            <div>
              <label className="label">Email</label>
              <input className="input-field" type="email" required value={form.email} onChange={(e) => update("email", e.target.value)} placeholder="you@example.com" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Password</label>
                <input className="input-field" type="password" required value={form.password} onChange={(e) => update("password", e.target.value)} placeholder="••••••••" />
              </div>
              <div>
                <label className="label">Age (optional)</label>
                <input className="input-field" type="number" value={form.age} onChange={(e) => update("age", e.target.value)} placeholder="25" />
              </div>
            </div>
            <div>
              <label className="label">Bio (optional)</label>
              <textarea
                className="input-field resize-none"
                rows={3}
                maxLength={280}
                value={form.bio}
                onChange={(e) => update("bio", e.target.value)}
                placeholder="Tell mentors and learners a bit about yourself..."
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button className="btn-primary w-full" disabled={loading}>
              {loading ? "Creating account..." : "Create account"}
            </button>
          </form>

          <p className="text-sm text-ink-500 text-center mt-6">
            Already have an account?{" "}
            <Link href="/login" className="text-accent-600 font-medium">Log in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
