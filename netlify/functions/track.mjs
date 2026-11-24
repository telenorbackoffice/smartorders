import { getStore } from "@netlify/blobs";
import { refreshAll } from "../lib/ups.mjs";

// Runs every hour and updates the UPS status of all open tracking numbers.
export default async () => {
  await refreshAll(getStore({ name: "portal", consistency: "strong" }));
};

export const config = { schedule: "@hourly" };
