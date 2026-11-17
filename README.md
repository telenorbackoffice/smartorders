# Store Order Portal (Netlify)

## Files
- `public/index.html` - the portal page
- `netlify/functions/api.mjs` - shared storage (orders, IASR file, budgets) using Netlify Blobs
- `netlify.toml`, `package.json` - Netlify settings

## Deploy (Git or CLI, needed for the shared storage)
1. Push this folder to a GitHub repo, then in Netlify choose "Add new site > Import an existing project" and pick the repo. Leave the build command empty. Publish directory is `public` (already in netlify.toml).
   Or with the CLI: `npm install` then `npx netlify deploy --prod`.
2. In Site settings > Environment variables add `ADMIN_PASSWORD` (your own password). Optional: `ADMIN_USER` (default `Telenor`). If you skip this, the defaults are `Telenor` / `orders`.
3. Redeploy once after adding the variables.

## Notes
- Anyone can open the site and enter orders. Only the signed-in admin can update the IASR file, edit budgets, clear orders, import codes and download Excel.
- The server checks the admin password for IASR and budget updates.
- If you only drag-and-drop `public/index.html`, the page opens but the shared storage function is missing. Orders then stay on each device and managers use the order code feature.
