import { getStore } from "@netlify/blobs";
import nodemailer from "nodemailer";

const J = (o, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const esc = (v) => String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const money = (n) => (Number(n) < 0 ? "-" : "") + "$" + Math.abs(Number(n) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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

  if (b.kind === "submit") {
    const loc = String(parseInt(b.loc, 10));
    if (!/^\d{2,4}$/.test(loc)) return J({ error: "Invalid store" }, 400);
    if (!(Number(b.qty) > 0) || !Array.isArray(b.lines) || !b.lines.length) return J({ error: "The order is empty" }, 400);
    if (typeof b.file !== "string" || b.file.length > 3_000_000) return J({ error: "Order file is too large" }, 413);

    const user = Netlify.env.get("MAIL_USER") || "telenor.servicecentre@gmail.com";
    const pass = Netlify.env.get("GMAIL_APP_PASSWORD");
    if (!pass) return J({ error: "Email is not set up on the server yet" }, 500);

    const last = await store.get("lastsubmit/" + loc, { type: "json" });
    if (last && Date.now() - last.t < 15000) return J({ error: "Please wait a few seconds before submitting again" }, 429);

    const when = new Date().toLocaleString("en-US", { timeZone: Netlify.env.get("MAIL_TZ") || "America/Chicago", dateStyle: "medium", timeStyle: "short" });
    const rows = b.lines.slice(0, 500).map((l) =>
      `<tr><td>${esc(l[0])}</td><td>${esc(l[1])}</td><td style="text-align:right">${esc(l[2])}</td><td style="text-align:right">${money(l[3])}</td><td style="text-align:right">${money(l[4])}</td></tr>`).join("");
    const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#111">
<h2 style="margin:0 0 8px">Order submitted: ${esc(loc)} - ${esc(b.store)}</h2>
<p style="margin:0 0 12px">Submitted ${esc(when)}</p>
<table cellpadding="6" style="border-collapse:collapse;margin-bottom:14px">
<tr><td>Total units</td><td><b>${esc(b.qty)}</b></td></tr>
<tr><td>Order value</td><td><b>${money(b.value)}</b></td></tr>
<tr><td>${esc(b.bm || "")} ${b.pooled ? "pooled " : ""}available budget</td><td>${money(b.avail)}</td></tr>
<tr><td>Budget remaining after this order</td><td><b style="color:${b.over ? "#c4201a" : "#0b7a27"}">${money(b.rem)}${b.over ? " (OVER BUDGET)" : ""}</b></td></tr></table>
<table cellpadding="6" border="1" style="border-collapse:collapse;border-color:#bbb">
<tr style="background:#e4f5de"><th align="left">SKU</th><th align="left">Product</th><th>Quantity</th><th>Unit Cost</th><th>Order Value</th></tr>${rows}</table>
<p style="margin-top:14px">The same details are attached as an Excel file (Order Report, Store Summary, All Items).</p></div>`;

    const filename = String(b.filename || "Store_Orders.xlsx").replace(/[^\w.\-]/g, "_");
    const transporter = nodemailer.createTransport({ service: "gmail", auth: { user, pass } });
    try {
      await transporter.sendMail({
        from: `"Store Order Portal" <${user}>`,
        to: Netlify.env.get("MAIL_TO") || user,
        subject: `Order submitted: ${loc} ${b.store} - ${money(b.value)} (${when})`,
        html,
        attachments: [{ filename, content: Buffer.from(b.file, "base64"), contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }],
      });
    } catch (e) {
      console.error("mail failed", e);
      return J({ error: "Email could not be sent" }, 502);
    }
    await store.setJSON("lastsubmit/" + loc, { t: Date.now() });
    return J({ ok: 1 });
  }

  return J({ error: "kind" }, 400);
};
