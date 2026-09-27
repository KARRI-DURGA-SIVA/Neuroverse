import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Layout from "../components/Layout";
import { apiFetch } from "../lib/api-client";

const MAX_AVATAR_DIMENSION = 256;
const MAX_AVATAR_SOURCE_MB = 5;

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

export default function Profile() {
  const [dash, setDash] = useState(null);
  const [editing, setEditing] = useState(false);
  const [bioDraft, setBioDraft] = useState("");
  const [avatarDraft, setAvatarDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const router = useRouter();

  useEffect(() => {
    apiFetch("/api/dashboard").then(setDash);
  }, []);

  async function logout() {
    await apiFetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  function startEditing(user) {
    setBioDraft(user.bio || "");
    setAvatarDraft(user.profile_pic || null);
    setSaveError("");
    setEditing(true);
  }

  async function onAvatarChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSaveError("");
    try {
      const dataUrl = await fileToAvatarDataUrl(file);
      setAvatarDraft(dataUrl);
    } catch (err) {
      setSaveError(err.message);
    }
  }

  async function saveProfile(setUser) {
    setSaving(true);
    setSaveError("");
    try {
      const { user } = await apiFetch("/api/user/profile", {
        method: "PATCH",
        body: JSON.stringify({ bio: bioDraft, profilePic: avatarDraft }),
      });
      setUser(user);
      setEditing(false);
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Layout>
      {({ user, setUser }) => (
        <div className="space-y-6 max-w-4xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-accent-100 text-accent-700 flex items-center justify-center font-semibold text-xl overflow-hidden shrink-0">
                {user.profile_pic ? (
                  <img src={user.profile_pic} alt={user.name} className="w-full h-full object-cover" />
                ) : (
                  user.name.slice(0, 1).toUpperCase()
                )}
              </div>
              <div>
                <h1 className="text-xl font-semibold text-ink-900">{user.name}</h1>
                <p className="text-sm text-ink-500">{user.email}{user.age ? ` · ${user.age} yrs` : ""}</p>
                {user.bio && !editing && <p className="text-sm text-ink-700 mt-1 max-w-md">{user.bio}</p>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!editing && (
                <button onClick={() => startEditing(user)} className="btn-secondary text-sm">Edit profile</button>
              )}
              <button onClick={logout} className="btn-secondary text-sm">Log out</button>
            </div>
          </div>

          {editing && (
            <div className="card p-5 space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-accent-100 text-accent-700 flex items-center justify-center font-semibold overflow-hidden shrink-0">
                  {avatarDraft ? (
                    <img src={avatarDraft} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    user.name.slice(0, 1).toUpperCase()
                  )}
                </div>
                <div>
                  <label className="label mb-1">Profile picture</label>
                  <input
                    className="text-sm text-ink-700 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-accent-50 file:text-accent-700 hover:file:bg-accent-100"
                    type="file"
                    accept="image/*"
                    onChange={onAvatarChange}
                  />
                </div>
              </div>
              <div>
                <label className="label">Bio</label>
                <textarea
                  className="input-field resize-none"
                  rows={3}
                  maxLength={280}
                  value={bioDraft}
                  onChange={(e) => setBioDraft(e.target.value)}
                  placeholder="Tell mentors and learners a bit about yourself..."
                />
              </div>
              {saveError && <p className="text-sm text-red-600">{saveError}</p>}
              <div className="flex items-center gap-2">
                <button className="btn-primary text-sm" disabled={saving} onClick={() => saveProfile(setUser)}>
                  {saving ? "Saving..." : "Save changes"}
                </button>
                <button className="btn-secondary text-sm" onClick={() => setEditing(false)}>Cancel</button>
              </div>
            </div>
          )}

          <div>
            <h2 className="text-base font-semibold text-ink-900 mb-3">Performance dashboard</h2>
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="card p-5">
                <p className="text-xs font-medium text-ink-500 uppercase">Sessions completed</p>
                <p className="text-2xl font-semibold text-ink-900 mt-1.5">{dash?.performance?.sessions_completed ?? "—"}</p>
              </div>
              <div className="card p-5">
                <p className="text-xs font-medium text-ink-500 uppercase">Avg. assessment score</p>
                <p className="text-2xl font-semibold text-ink-900 mt-1.5">{dash ? `${Math.round(dash.performance.avg_assessment_score)}%` : "—"}</p>
              </div>
              <div className="card p-5">
                <p className="text-xs font-medium text-ink-500 uppercase">Mentor rating</p>
                <p className="text-2xl font-semibold text-ink-900 mt-1.5">{dash ? `${Number(dash.performance.mentor_avg_rating).toFixed(1)}★` : "—"}</p>
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-base font-semibold text-ink-900 mb-3">Skills I know</h2>
            <div className="flex flex-wrap gap-2">
              {dash?.knownSkills?.map((s) => (
                <span key={s.id} className="badge bg-accent-50 text-accent-700">{s.skill_name} · {s.level || "unassessed"}</span>
              ))}
              {(!dash?.knownSkills || dash.knownSkills.length === 0) && <p className="text-sm text-ink-500">No skills added yet.</p>}
            </div>
          </div>

          <div>
            <h2 className="text-base font-semibold text-ink-900 mb-3">Recommended to upskill</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {dash?.recommendedSkills?.map((s) => (
                <div key={s.id} className="card p-4">
                  <p className="font-medium text-ink-900 text-sm">{s.name}</p>
                  <p className="text-xs text-ink-500">{s.mentor_count} mentors available</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
