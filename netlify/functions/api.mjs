import { getStore } from "@netlify/blobs";

const J = (o, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json", "cache-control": "no-store" } });

export default async (req) => {
  const store = getStore({ name: "portal", consistency: "strong" });
  const adminOk = () => {
    const u = (req.headers.get("x-user") || "").trim().toLowerCase();
    const p = req.headers.get("x-pass") || "";
    return u === (Netlify.env.get("ADMIN_USER") || "Telenor").toLowerCase() && p === (Netlify.env.get("ADMIN_PASSWORD") || "orders");
  };

  if (req.method === "GET") {
    const { blobs } = await store.list({ prefix: "orders/" });
    const orders = {};
    await Promise.all(blobs.map(async (b) => { orders[b.key.slice(7)] = await store.get(b.key, { type: "json" }); }));
    return J({ orders, iasr: await store.get("iasr", { type: "json" }), budgets: await store.get("budgets", { type: "json" }) });
  }
  if (req.method !== "POST") return J({ error: "method" }, 405);

  let b;
  try { b = await req.json(); } catch { return J({ error: "bad json" }, 400); }

  if (b.kind === "login") return adminOk() ? J({ ok: 1 }) : J({ error: "auth" }, 401);
  if (b.kind === "orders") {
    const loc = String(parseInt(b.loc, 10));
    if (!/^\d{2,4}$/.test(loc)) return J({ error: "loc" }, 400);
    await store.setJSON("orders/" + loc, b.data);
    return J({ ok: 1 });
  }
  if (b.kind === "iasr" || b.kind === "budgets") {
    if (!adminOk()) return J({ error: "auth" }, 401);
    await store.setJSON(b.kind, b.data);
    return J({ ok: 1 });
  }
  return J({ error: "kind" }, 400);
};
