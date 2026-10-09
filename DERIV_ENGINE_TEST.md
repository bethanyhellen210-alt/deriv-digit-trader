# Isolated engine test notes

This branch adds `deriv-engine-v2.js` and `VERCEL_DEPLOYMENT.md`; the original `index.html` has not been edited.

## Scope
- Connects to the Deriv WebSocket using a token supplied at runtime.
- Waits for authorization before subscribing to the selected market.
- Parses the last quote digit, keeps a rolling tick window, and calculates digit frequencies.
- Offers `evaluate(contractType, barrier, thresholdPercent)` for candidate signal analysis.
- Does not send proposal or buy requests. It cannot place a trade.

## Browser smoke test
1. Use a temporary test page or browser console on a non-production copy; do not add the module to the current production page yet.
2. Load `deriv-engine-v2.js` and instantiate `new DerivDigitEngine({onStatus: console.log, onError: console.error, onTick: console.log, onSignal: console.log})`.
3. From a user click handler, call `engine.connect(token)` with a token that has read-only market-data permissions.
4. After the status says authorized, call `engine.subscribe("R_100")`.
5. Confirm live tick events, digits 0–9 frequency totals, market switching, invalid-token errors, and disconnect behavior.
6. Once at least 20 ticks have arrived, call `engine.evaluate("DIGITOVER", 3, 10.4)` and inspect the returned statistics.

## Important limitations
The 10.4% logic is a configurable historical-frequency heuristic, not a predictive guarantee. Group-based Over/Under frequencies are calculated over digits 0..barrier and barrier..9 respectively; confirm that interpretation before connecting the analyzer to the existing interface. No real-money trading or automated order placement is included.
