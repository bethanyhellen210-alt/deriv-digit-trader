# Vercel deployment

## Deploy from GitHub

This is a static HTML project. The additive signal-engine page is `engine.html`; the existing `index.html` was intentionally left unchanged.

1. Open the repository in Vercel and import it, or open the existing Vercel project settings.
2. Select the Git branch `audit/additive-deriv-engine` for this preview deployment.
3. Set Framework Preset to **Other**.
4. Set Root Directory to the repository root.
5. Leave Build Command empty and Output Directory empty/default. Do not set a Node build command.
6. Deploy, then open the deployment URL followed by `/engine.html`.

Example: `https://YOUR-DEPLOYMENT.vercel.app/engine.html`

## Using the signal page

- Enter a Deriv App ID and a read-only API token, then press **Connect & Start**.
- Select a market. The page receives live ticks and shows candidate signal evaluations for Even/Odd, Over 1, Under 8, Over 4, Under 5, Differs, and Matches.
- Use **Stop** to close the WebSocket.
- Tokens are held in page memory only; do not commit or share tokens.
- The risk-check panel is informational and depends on the balance, session P/L, stake and loss counts entered by the user.

## Scope and production cautions

- The existing `index.html` is unchanged. The engine is available at `/engine.html`; it has not been wired into the existing home page.
- This page is signal-only. It does not send proposal or buy requests and does not automate trading.
- The strategy rules are heuristic triggers, not demonstrated predictive edges. Streaks and cold digits do not guarantee a reversal or increase the theoretical next-tick probability.
- This branch has not been verified against a live Deriv account or deployed by this change. After Vercel finishes, test connection status, invalid token behavior, market switching and Stop on mobile before relying on any signals.
- The original `index.html` contains a client-visible hardcoded access key (`SECRET123`). It is not secure authentication and should not be used to protect sensitive features.
