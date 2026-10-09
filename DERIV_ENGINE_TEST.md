# Isolated Deriv engine test notes

This branch adds an isolated signal engine and deployment notes. The original `index.html` remains unchanged.

## Included candidate strategies

- `EVEN_ODD`: signal the opposite parity after three consecutive digits of the same parity.
- `OVER_1`: after two consecutive 0/1 digits, candidate `DIGITOVER` barrier 1.
- `UNDER_8`: after two consecutive 8/9 digits, candidate `DIGITUNDER` barrier 8.
- `OVER_4`: candidate `DIGITOVER` barrier 4 when at least 75% of the last 15 digits are 0–4.
- `UNDER_5`: mirrored candidate `DIGITUNDER` barrier 5 when at least 75% of the last 15 digits are 5–9.
- `DIFFERS`: candidate `DIGITDIFF` using the latest digit as barrier for the subsequent tick.
- `MATCHES`: candidate `DIGITMATCH` for a digit absent from the last 20 ticks; a barrier can be provided explicitly.

Call `engine.evaluateStrategy("EVEN_ODD")` for one strategy or `engine.evaluateAll()` for the full set. `onSignal` reports candidate setups as live ticks arrive. `DerivDigitEngine.checkRisk({balance, stake, sessionProfit, consecutiveLosses, recoveryStep, strategy})` performs a local risk-limit check only.

## Browser smoke test

1. Use a temporary test page or browser console on a non-production copy; do not add this module to the current production page yet.
2. Load `deriv-engine-v2.js` and instantiate `new DerivDigitEngine({onStatus: console.log, onError: console.error, onTick: console.log, onSignal: console.log})`.
3. From a user click handler, call `engine.connect(token)` with a token that has read-only market-data permissions. Never paste the token into a repository or commit it.
4. After the status says authorized, call `engine.subscribe("R_100")`.
5. Confirm live tick events, digit counts, invalid-token errors, market switching, and disconnect behavior.
6. Wait for the needed sample window and inspect `evaluateAll()` and `checkRisk()` results. Do not enable real-money trading based only on this smoke test.

## Safety and interpretation

This is signal-only code: it does not send proposal or buy requests. It has not been confirmed against a live Deriv account or deployed to Vercel in this branch. The rules are heuristics, not demonstrated predictive edges; a cold digit or streak does not change the theoretical next-tick probability under an independent uniform-digit model. The engine cannot enforce account-level limits unless the calling app supplies accurate balance, session P/L, stake, and loss counters. Test with read-only access first.
