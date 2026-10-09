# Vercel deployment readiness

The existing project is a static HTML site. Keep the Vercel Framework Preset set to Other and leave the build command empty unless a build tool is added. Set the root directory to the repository root; index.html is the entry point.

## Checks before production use
- Inspect the deployment build output and open the deployed site on mobile.
- Confirm the browser console has no JavaScript errors and the Deriv WebSocket connects.
- Verify the Deriv app ID is valid for the deployed domain and the API token has only required permissions.
- Test invalid tokens, lost network, logout, market switching, and reconnect behavior.
- Test signal-only mode before considering automated buying. A reliable trading flow must sequence authorization, proposal, buy, contract monitoring, and risk/stop controls.
- The hardcoded SECRET123 in the existing index.html is visible to every visitor and is not secure production authentication.

This note is additive and does not change index.html.