let cachedToken = null;
let tokenExpiresAt = 0;

function configurationError(message) {
  const error = new Error(message);
  error.definitive = true;
  return error;
}

async function getAccessToken() {
  const { ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET } = process.env;
  if (!ZOOM_ACCOUNT_ID || !ZOOM_CLIENT_ID || !ZOOM_CLIENT_SECRET) {
    throw configurationError("Zoom server-to-server OAuth is not configured");
  }
  if (cachedToken && tokenExpiresAt > Date.now() + 60_000) return cachedToken;

  const basic = Buffer.from(`${ZOOM_CLIENT_ID}:${ZOOM_CLIENT_SECRET}`).toString("base64");
  let response;
  try {
    response = await fetch(`https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${encodeURIComponent(ZOOM_ACCOUNT_ID)}`, {
      method: "POST",
      headers: { Authorization: `Basic ${basic}` },
    });
  } catch {
    throw configurationError("Could not connect to Zoom OAuth; no meeting was created");
  }
  const result = await response.json();
  if (!response.ok || !result.access_token) {
    throw configurationError(result.reason || result.message || "Zoom authentication failed");
  }
  cachedToken = result.access_token;
  tokenExpiresAt = Date.now() + Number(result.expires_in || 3600) * 1000;
  return cachedToken;
}

async function zoomRequest(path, { method = "GET", body } = {}) {
  const token = await getAccessToken();
  const response = await fetch(`https://api.zoom.us/v2${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const result = response.status === 204 ? {} : await response.json();
  if (!response.ok) {
    const error = new Error(result.message || "Zoom meeting request failed");
    error.definitive = response.status < 500;
    throw error;
  }
  return result;
}

async function createZoomMeeting({ sessionId, title, scheduledStart, durationMinutes }) {
  const host = process.env.ZOOM_USER_ID || "me";
  const meeting = await zoomRequest(`/users/${encodeURIComponent(host)}/meetings`, {
    method: "POST",
    body: {
      topic: `NeuroVerse: ${title}`,
      type: 2,
      start_time: new Date(scheduledStart).toISOString(),
      duration: durationMinutes,
      timezone: "UTC",
      agenda: `NeuroVerse session ${sessionId}`,
      settings: {
        waiting_room: true,
        join_before_host: false,
        approval_type: 2,
      },
    },
  });
  if (!meeting.id || !meeting.join_url) {
    const error = new Error("Zoom did not return a meeting ID and participant join URL");
    error.definitive = true;
    throw error;
  }
  return { id: String(meeting.id), joinUrl: meeting.join_url };
}

async function updateZoomMeetingDuration(meetingId, durationMinutes) {
  return zoomRequest(`/meetings/${encodeURIComponent(meetingId)}`, {
    method: "PATCH",
    body: { duration: durationMinutes },
  });
}

module.exports = { createZoomMeeting, updateZoomMeetingDuration };