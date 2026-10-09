# Vercel deployment

## Deploy the manual-entry signal page

This is a static HTML project with a Vercel serverless access-key endpoint. The existing `index.html` is intentionally unchanged. The clean manual-entry UI is `manual.html`.

1. In Vercel, open the project connected to `bethanyhellen210-alt/deriv-digit-trader`.
2. For a preview deployment, select branch `audit/additive-deriv-engine`. To publish to the production domain, merge this additive branch into the production branch after reviewing the changes.
3. Framework Preset: **Other**.
4. Root Directory: repository root.
5. Build Command: leave empty. Output Directory: default/empty.
6. In **Settings → Environment Variables**, add `LICENSE_KEY` with the exact access key you want to use. Add it to Preview and/or Production as appropriate, then redeploy.
7. Deploy and open the deployment URL followed by `/manual.html`.

Example: `https://YOUR-DEPLOYMENT.vercel.app/manual.html`

## Use the app

- Enter the configured access key and select **Verify Access Key**.
- Enter a Deriv App ID (default `1089`) and a Deriv API token, choose a market and a contract strategy, then press **START ANALYSIS**.
- The app reads live ticks from Deriv's public WebSocket API and evaluates the selected strategy. **STOP** closes the connection.
- When the selected strategy does not produce a candidate, the page shows **NO SIGNAL FOUND — CHANGE MARKET**.
- The app is manual-entry only. It never buys contracts or places trades. Signals are heuristic candidates, not guaranteed predictions.
- Prefer a read-only token and never commit/share tokens. The token is kept in page memory and is not saved by this page.

## Notes

- `/api/verify-key` returns an error until `LICENSE_KEY` is configured in Vercel. The example key previously discussed is not automatically active; the value must be configured by the site owner.
- `index.html` remains untouched. Open `/manual.html` directly.
- This code change does not itself confirm a live WebSocket connection or a successful Vercel deployment. Test on the deployed URL with a valid token, then test Stop and market switching on mobile.
