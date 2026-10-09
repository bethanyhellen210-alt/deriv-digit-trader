/* Isolated Deriv tick/signal engine. Does not place trades.
   Additive file for review; original index.html remains untouched. */
(function (root) {
  "use strict";
  class DerivDigitEngine {
    constructor(options = {}) {
      this.appId = String(options.appId || "1089");
      this.thresholdPercent = Number(options.thresholdPercent || 10.4);
      this.windowSize = Math.max(20, Number(options.windowSize || 100));
      this.onStatus = options.onStatus || function () {};
      this.onTick = options.onTick || function () {};
      this.onSignal = options.onSignal || function () {};
      this.onError = options.onError || function () {};
      this.ws = null;
      this.authorized = false;
      this.symbol = null;
      this.digits = [];
      this.counts = Array(10).fill(0);
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
      if (!this.authorized) {
        this.onStatus("Market selected; waiting for authorization.");
        return false;
      }
      this.send({ forget_all: "ticks", req_id: 2 });
      return this.send({ ticks: this.symbol, subscribe: 1, req_id: 3 });
    }
    acceptTick(tick) {
      if (this.symbol && tick.symbol && tick.symbol !== this.symbol) return;
      const digit = DerivDigitEngine.lastDigit(tick.quote, tick.pip_size);
      if (digit === null) return;
      this.digits.push(digit);
      if (this.digits.length > this.windowSize) this.digits.shift();
      this.counts = Array(10).fill(0);
      this.digits.forEach((d) => { this.counts[d] += 1; });
      const total = this.digits.length;
      this.onTick({
        symbol: tick.symbol || this.symbol, quote: tick.quote, digit, total,
        digits: this.digits.slice(), counts: this.counts.slice(),
        percentages: this.counts.map((n) => total ? n * 100 / total : 0)
      });
      this.onStatus("Live ticks: " + total + "/" + this.windowSize);
    }
    static lastDigit(quote, pipSize) {
      const precision = Number(pipSize), value = Number(quote);
      if (!Number.isFinite(value) || !Number.isInteger(precision) || precision < 0 || precision > 10) return null;
      const match = value.toFixed(precision).match(/(\d)$/);
      return match ? Number(match[1]) : null;
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
      const observed = count * 100 / total, signal = observed < threshold;
      const result = {
        status: signal ? "signal" : "no-signal", contractType, barrier: n,
        observedPercent: Number(observed.toFixed(2)), thresholdPercent: threshold,
        condition: group, total,
        message: signal
          ? "Candidate signal: " + group + " observed at " + observed.toFixed(2) + "%, below " + threshold + "%."
          : "No signal found, change market. " + group + " observed at " + observed.toFixed(2) + "%."
      };
      if (signal) this.onSignal(result);
      return result;
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
