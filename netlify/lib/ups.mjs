// UPS Tracking helper (OAuth client credentials + Track API v1)
const BASE = () => Netlify.env.get("UPS_BASE") || "https://onlinetools.ups.com";
let tok = null;

async function token() {
  if (tok && tok.exp > Date.now() + 60000) return tok.v;
  const id = Netlify.env.get("UPS_CLIENT_ID");
  const sec = Netlify.env.get("UPS_CLIENT_SECRET");
  if (!id || !sec) throw new Error("UPS tracking is not set up on the server yet");
  const r = await fetch(BASE() + "/security/v1/oauth/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", authorization: "Basic " + btoa(id + ":" + sec) },
    body: "grant_type=client_credentials",
  });
  if (!r.ok) throw new Error("UPS login failed (" + r.status + ")");
  const j = await r.json();
  tok = { v: j.access_token, exp: Date.now() + (Number(j.expires_in) || 14000) * 1000 };
  return tok.v;
}

const fmtDate = (d, t) => {
  if (!d || String(d).length !== 8) return "";
  const s = `${d.slice(4, 6)}/${d.slice(6, 8)}/${d.slice(0, 4)}`;
  return t && String(t).length >= 4 ? `${s} ${String(t).slice(0, 2)}:${String(t).slice(2, 4)}` : s;
};

export async function upsStatus(num) {
  const t = await token();
  const r = await fetch(BASE() + "/api/track/v1/details/" + encodeURIComponent(num) + "?locale=en_US&returnSignature=false", {
    headers: { authorization: "Bearer " + t, transId: crypto.randomUUID(), transactionSrc: "order-portal" },
  });
  if (r.status === 404) return { status: "Not found yet", delivered: false, place: "", when: "", eta: "" };
  if (!r.ok) throw new Error("UPS tracking error (" + r.status + ")");
  const j = await r.json();
  const sh = j?.trackResponse?.shipment?.[0];
  const pk = sh?.package?.[0];
  if (!pk) return { status: sh?.warnings?.[0]?.message || "No tracking details yet", delivered: false, place: "", when: "", eta: "" };
  const act = pk.activity?.[0];
  const cs = pk.currentStatus;
  const desc = cs?.simplifiedTextDescription || cs?.description || act?.status?.description || "In progress";
  const delivered = act?.status?.type === "D" || /^delivered/i.test(desc);
  const a = act?.location?.address || {};
  return {
    status: desc,
    delivered,
    place: [a.city, a.stateProvince, a.country].filter(Boolean).join(", "),
    when: fmtDate(act?.date, act?.time),
    eta: fmtDate(pk.deliveryDate?.[0]?.date),
  };
}

// Refresh every undelivered tracking number on one submission. Returns the saved record.
export async function refreshSub(store, key, force) {
  const s = await store.get(key, { type: "json" });
  if (!s || !s.tracking?.length) return s;
  let changed = false;
  for (const t of s.tracking) {
    if (t.delivered) continue;
    if (!force && t.checked && Date.now() - t.checked < 10 * 60 * 1000) continue;
    try { Object.assign(t, await upsStatus(t.number), { checked: Date.now(), error: "" }); }
    catch (e) { t.error = String(e.message || e); t.checked = Date.now(); }
    changed = true;
  }
  if (changed) await store.setJSON(key, s);
  return s;
}

// Used by the hourly scheduled function: refresh recent orders that still have undelivered parcels.
export async function refreshAll(store) {
  const { blobs } = await store.list({ prefix: "subs/" });
  const cutoff = Date.now() - 60 * 86400000;
  for (const b of blobs) {
    const t = Number(b.key.split("/")[2]);
    if (t < cutoff) continue;
    try { await refreshSub(store, b.key, true); } catch (e) { console.error("refresh failed", b.key, e); }
  }
}
