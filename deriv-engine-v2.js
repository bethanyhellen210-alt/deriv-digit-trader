/* Isolated Deriv tick/signal engine. Signal-only: it never buys contracts.
   Additive branch file; original index.html remains untouched.
   Strategy thresholds are heuristics, not evidence of predictive edge. */
(function (root) {
  "use strict";
  class DerivDigitEngine {
    constructor(options = {}) {
      this.appId = String(options.appId || "1089");
      this.thresholdPercent = Number(options.thresholdPercent || 10.4);
      this.windowSize = Math.max(30, Number(options.windowSize || 100));
      this.onStatus = options.onStatus || function () {};
      this.onTick = options.onTick || function () {};
      this.onSignal = options.onSignal || function () {};
      this.onError = options.onError || function () {};
      this.ws = null;
      this.authorized = false;
      this.symbol = null;
      this.digits = [];
      this.counts = Array(10).fill(0);
      this.lastTick = null;
      this.lastSignalKeys = Object.create(null);
      this.closedByUser = false;
    }
    send(data) {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        this.onError(new Error("Deriv connection is not open."));
        return false;
      }
      this.ws.send(JSON.stringify(data));
      return true;
    }
    connect(token) {
      if (!token || !String(token).trim()) {
        this.onError(new Error("Enter a Deriv API token."));
        return false;
      }
      this.disconnect();
      this.closedByUser = false;
      this.onStatus("Connecting to Deriv…");
      this.ws = new WebSocket("wss://ws.derivws.com/websockets/v3?app_id=" + encodeURIComponent(this.appId));
      this.ws.onopen = () => {
        this.onStatus("Connected; authorizing…");
        this.send({ authorize: String(token).trim(), req_id: 1 });
      };
      this.ws.onmessage = (event) => {
        let data;
        try { data = JSON.parse(event.data); }
        catch (_) { this.onError(new Error("Invalid response from Deriv.")); return; }
        if (data.error) {
          this.onError(new Error(data.error.message || "Deriv API error."));
          if (data.msg_type === "authorize") this.onStatus("Authorization failed");
          return;
        }
        if (data.msg_type === "authorize") {
          this.authorized = true;
          this.onStatus("Authorized; choose a market.");
          if (this.symbol) this.subscribe(this.symbol);
        } else if (data.msg_type === "tick" && data.tick) {
          this.acceptTick(data.tick);
        }
      };
      this.ws.onerror = () => {
        this.onStatus("WebSocket connection error");
        this.onError(new Error("Deriv WebSocket connection error."));
      };
      this.ws.onclose = () => {
        this.authorized = false;
        if (!this.closedByUser) this.onStatus("Connection closed; reconnect manually.");
      };
      return true;
    }
    subscribe(symbol) {
      if (!symbol) { this.onError(new Error("Select a market.")); return false; }
      this.symbol = String(symbol);
      this.digits = [];
      this.counts = Array(10).fill(0);
      this.lastTick = null;
      this.lastSignalKeys = Object.create(null);
      if (!this.authorized) {
        this.onStatus("Market selected; waiting for authorization.");
        return false;
      }
      // Forget only this engine's previous tick subscription when possible.
      if (this.lastSubscriptionId) this.send({ forget: this.lastSubscriptionId });
      const sent = this.send({ ticks: this.symbol, subscribe: 1, req_id: 3 });
      return sent;
    }
    acceptTick(tick) {
      if (this.symbol && tick.symbol && tick.symbol !== this.symbol) return;
      const digit = DerivDigitEngine.lastDigit(tick.quote, tick.pip_size);
      if (digit === null) return;
      this.digits.push(digit);
      if (this.digits.length > this.windowSize) this.digits.shift();
      this.counts = Array(10).fill(0);
      this.digits.forEach((d) => { this.counts[d] += 1; });
      const previous = this.lastTick;
      this.lastTick = digit;
      const total = this.digits.length;
      const tickInfo = {
        symbol: tick.symbol || this.symbol, quote: tick.quote, digit, previousDigit: previous, total,
        digits: this.digits.slice(), counts: this.counts.slice(),
        percentages: this.counts.map((n) => total ? n * 100 / total : 0)
      };
      this.onTick(tickInfo);
      this.onStatus("Live ticks: " + total + "/" + this.windowSize);
      // Emits event-triggered candidates; caller must decide whether to display them.
      const automatic = this.evaluateAll();
      automatic.forEach((result) => {
        if (result.status !== "signal") {
          delete this.lastSignalKeys[result.strategy];
          return;
        }
        // Avoid flooding the UI with the same persistent setup on every tick.
        // Differs is evaluated per tick because its barrier follows the latest digit.
        const signature = result.strategy === "DIFFERS"
          ? result.strategy + ":" + result.barrier + ":" + total
          : result.strategy + ":" + result.contractType + ":" + result.barrier;
        if (this.lastSignalKeys[result.strategy] !== signature) {
          this.lastSignalKeys[result.strategy] = signature;
          this.onSignal(result);
        }
      });
    }
    static lastDigit(quote, pipSize) {
      const precision = Number(pipSize), value = Number(quote);
      if (!Number.isFinite(value) || !Number.isInteger(precision) || precision < 0 || precision > 10) return null;
      const match = value.toFixed(precision).match(/(\d)$/);
      return match ? Number(match[1]) : null;
    }
    static streakLength(digits, predicate) {
      let count = 0;
      for (let i = digits.length - 1; i >= 0 && predicate(digits[i]); i--) count++;
      return count;
    }
    evaluateStrategy(strategy, options = {}) {
      const d = this.digits, total = d.length, latest = d[total - 1];
      const minSample = Number(options.minSample || 15);
      if (!total) return { status: "warming-up", strategy, message: "Waiting for live ticks.", total };
      const signal = (contractType, barrier, reason, extra = {}) => ({
        status: "signal", strategy, contractType, barrier: barrier === undefined ? null : barrier,
        symbol: this.symbol, lastDigit: latest, total, reason, message: reason, ...extra
      });
      const noSignal = (reason, extra = {}) => ({
        status: "no-signal", strategy, symbol: this.symbol, lastDigit: latest, total,
        reason, message: reason, ...extra
      });
      if (strategy === "EVEN_ODD") {
        const run = DerivDigitEngine.streakLength(d, (x) => x % 2 === latest % 2);
        if (run >= 3) return signal(latest % 2 ? "DIGITEVEN" : "DIGITODD", null,
          run + " consecutive " + (latest % 2 ? "odd" : "even") + " digits; opposite parity candidate.", { streak: run });
        return noSignal("Waiting for 3 consecutive digits of the same parity.", { streak: run });
      }
      if (strategy === "OVER_1") {
        const last2 = d.slice(-2);
        if (last2.length === 2 && last2.every((x) => x <= 1))
          return signal("DIGITOVER", 1, "Two consecutive digits were 0 or 1; Over 1 candidate.");
        return noSignal("Waiting for two consecutive digits in {0,1}.");
      }
      if (strategy === "UNDER_8") {
        const last2 = d.slice(-2);
        if (last2.length === 2 && last2.every((x) => x >= 8))
          return signal("DIGITUNDER", 8, "Two consecutive digits were 8 or 9; Under 8 candidate.");
        return noSignal("Waiting for two consecutive digits in {8,9}.");
      }
      if (strategy === "OVER_4" || strategy === "UNDER_5") {
        const sample = d.slice(-Math.min(15, total));
        if (sample.length < minSample) return { status: "warming-up", strategy, total, message: "Collecting at least " + minSample + " ticks." };
        const below = sample.filter((x) => x <= 4).length / sample.length * 100;
        const above = 100 - below;
        const observed = strategy === "OVER_4" ? below : above;
        if (observed >= 75) return signal(strategy === "OVER_4" ? "DIGITOVER" : "DIGITUNDER",
          strategy === "OVER_4" ? 4 : 5,
          observed.toFixed(1) + "% of the last " + sample.length + " digits clustered on the opposite side; rebalancing candidate.",
          { sampleSize: sample.length, clusterPercent: Number(observed.toFixed(2)) });
        return noSignal("No 75% cluster in the last " + sample.length + " ticks.", { sampleSize: sample.length, clusterPercent: Number(observed.toFixed(2)) });
      }
      if (strategy === "DIFFERS") {
        return signal("DIGITDIFF", latest, "Latest digit is " + latest + "; Differs candidate uses that digit as barrier for a subsequent tick.", { barrierSource: "latest-digit" });
      }
      if (strategy === "MATCHES") {
        const absentWindow = Math.max(20, Number(options.absentTicks || 20));
        const recent = d.slice(-absentWindow);
        if (recent.length < absentWindow) return { status: "warming-up", strategy, total, message: "Collecting " + absentWindow + " ticks for cold-digit scan." };
        const target = Number.isInteger(options.barrier) && options.barrier >= 0 && options.barrier <= 9
          ? options.barrier : Array.from({ length: 10 }, (_, i) => i).find((x) => !recent.includes(x));
        if (target === undefined) return noSignal("No digit is absent from the last " + absentWindow + " ticks.");
        if (!recent.includes(target)) return signal("DIGITMATCH", target,
          "Digit " + target + " was absent from the last " + absentWindow + " ticks; Match candidate only, not a prediction.",
          { absentTicks: absentWindow });
        return noSignal("Selected digit " + target + " appeared in the last " + absentWindow + " ticks.", { barrier: target, absentTicks: absentWindow });
      }
      return { status: "invalid", strategy, total, message: "Unknown strategy. Use EVEN_ODD, OVER_1, UNDER_8, OVER_4, UNDER_5, DIFFERS or MATCHES." };
    }
    evaluateAll(options = {}) {
      return ["EVEN_ODD", "OVER_1", "UNDER_8", "OVER_4", "UNDER_5", "DIFFERS", "MATCHES"]
        .map((name) => this.evaluateStrategy(name, options));
    }
    evaluate(contractType, barrier, thresholdPercent = this.thresholdPercent) {
      const n = Number(barrier), threshold = Number(thresholdPercent), total = this.digits.length;
      if (total < Math.min(20, this.windowSize))
        return { status: "warming-up", message: "Collecting ticks before evaluating a signal.", total };
      if (!Number.isInteger(n) || n < 0 || n > 9 || !Number.isFinite(threshold) || threshold <= 0 || threshold >= 100)
        return { status: "invalid", message: "Check barrier (0–9) and threshold (0–100%).", total };
      let count = 0, group = "";
      if (contractType === "DIGITOVER") {
        count = this.digits.filter((d) => d <= n).length; group = "digits 0–" + n;
      } else if (contractType === "DIGITUNDER") {
        count = this.digits.filter((d) => d >= n).length; group = "digits " + n + "–9";
      } else if (contractType === "DIGITMATCH" || contractType === "DIGITDIFF") {
        count = this.counts[n]; group = "digit " + n;
      } else if (contractType === "DIGITEVEN") {
        count = this.digits.filter((d) => d % 2 === 0).length; group = "even digits";
      } else if (contractType === "DIGITODD") {
        count = this.digits.filter((d) => d % 2 !== 0).length; group = "odd digits";
      } else {
        return { status: "invalid", message: "Unsupported digit contract type.", total };
      }
      const observed = count * 100 / total, candidate = observed < threshold;
      return {
        status: candidate ? "signal" : "no-signal", contractType, barrier: n,
        observedPercent: Number(observed.toFixed(2)), thresholdPercent: threshold,
        condition: group, total,
        message: candidate
          ? "Candidate signal: " + group + " observed at " + observed.toFixed(2) + "%, below " + threshold + "%."
          : "No signal found, change market. " + group + " observed at " + observed.toFixed(2) + "%."
      };
    }
    static checkRisk(options = {}) {
      const balance = Number(options.balance), stake = Number(options.stake);
      const sessionProfit = Number(options.sessionProfit || 0);
      const consecutiveLosses = Math.max(0, Number(options.consecutiveLosses || 0));
      const recoveryStep = Math.max(0, Number(options.recoveryStep || 0));
      const strategy = String(options.strategy || "");
      const maxLossPercent = Number(options.maxLossPercent || 15);
      const takeProfitPercent = Number(options.takeProfitPercent || 10);
      const maxRecoverySteps = strategy === "DIFFERS" ? 0 : Math.min(3, Number(options.maxRecoverySteps || 3));
      const reasons = [];
      if (!Number.isFinite(balance) || balance <= 0) reasons.push("Balance must be positive.");
      if (!Number.isFinite(stake) || stake <= 0) reasons.push("Stake must be positive.");
      if (balance > 0 && stake > balance * 0.02) reasons.push("Stake exceeds 2% of the supplied balance.");
      if (balance > 0 && sessionProfit <= -(balance * maxLossPercent / 100)) reasons.push("Session stop-loss reached.");
      if (balance > 0 && sessionProfit >= balance * takeProfitPercent / 100) reasons.push("Session take-profit reached.");
      if (consecutiveLosses >= 3) reasons.push("Three consecutive losses: stop and review.");
      if (strategy === "DIFFERS" && consecutiveLosses >= 1) reasons.push("Differs rule: stop after the first loss.");
      if (recoveryStep > maxRecoverySteps) reasons.push("Recovery-step limit reached.");
      return { allowed: reasons.length === 0, reasons, maxRecoverySteps, note: "Risk check only; no order is placed. Supply accurate balance and session P/L from the app." };
    }
    disconnect() {
      this.closedByUser = true;
      this.authorized = false;
      if (this.ws) {
        this.ws.onopen = this.ws.onmessage = this.ws.onerror = this.ws.onclose = null;
        if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) this.ws.close();
      }
      this.ws = null;
      this.onStatus("Disconnected");
    }
  }
  root.DerivDigitEngine = DerivDigitEngine;
})(typeof window !== "undefined" ? window : globalThis);
