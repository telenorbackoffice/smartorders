# Store Order Portal (Netlify)

## Files
- `public/index.html` - the portal page
- `netlify/functions/api.mjs` - shared storage (orders, IASR file, budgets) and the order email
- `netlify.toml`, `package.json` - Netlify settings

## Deploy (Git or CLI, needed for the shared storage and email)
1. Push this folder to a GitHub repo, then in Netlify choose "Add new site > Import an existing project" and pick the repo. Leave the build command empty. Publish directory is `public` (already in netlify.toml).
   Or with the CLI: `npm install` then `npx netlify deploy --prod`.
2. Add these in Site settings > Environment variables:
   - `GMAIL_APP_PASSWORD` - a Google App Password for telenor.servicecentre@gmail.com (see below). Required for the Submit button.
   - `ADMIN_PASSWORD` - your own admin password. Optional `ADMIN_USER` (default `Telenor`). If you skip these, the defaults are `Telenor` / `orders`.
   - Optional: `MAIL_USER` and `MAIL_TO` (both default to telenor.servicecentre@gmail.com), `MAIL_TZ` (default `America/Chicago`).
3. Redeploy once after adding the variables.

## Google App Password
1. Sign in to telenor.servicecentre@gmail.com and turn on 2-Step Verification (Google Account > Security).
2. Go to Google Account > Security > 2-Step Verification > App passwords, create one (name it "Order Portal") and copy the 16 characters.
3. Paste it as `GMAIL_APP_PASSWORD` in Netlify. Do not put it in any file.

## Submit button
- At the bottom of the order table, an employee presses "Submit order" for the selected store.
- An email goes from telenor.servicecentre@gmail.com to telenor.servicecentre@gmail.com with the order table in the body and an Excel attachment in the same format as "Download Excel" (sheets: Order Report, Store Summary, All Items), filtered to that store.
- A store can submit again only after 15 seconds.

## Notes
- Anyone can open the site and enter orders. Only the signed-in admin can update the IASR file, edit budgets, clear orders, import codes and download Excel.
- The server checks the admin password for IASR and budget updates.
- If you only drag-and-drop `public/index.html`, the page opens but the shared storage and email function are missing.
