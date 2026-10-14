// src/lib/TelemetryClient.js

export class TelemetryClient {
  // 1. Declare deeply reactive class properties using Svelte Runes
  userId = $state('');
  isConnected = $state(false);
  sysMetrics = $state({});
  cacheMetrics = $state([]); // Array of reactive cache metadata objects

  // Private network management variables
  #ws = null;
  #reconnectAttempts = 0;
  #deliberateDisconnect = false;
  #chartUpdateCallback = null;

  constructor() {
    // Singleton safety wrapper check (optional)
  }

  setChartCallback(callback) {
    this.#chartUpdateCallback = callback;
  }

  connect(targetUserId) {
    if (!targetUserId || targetUserId.trim() === '') return;
    
    this.userId = targetUserId.trim();
    this.#deliberateDisconnect = false;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // If running Vite on 5173, point down to the Express server on 3000
    const host = window.location.host.includes('5173') ? 'localhost:3000' : window.location.host;
    
    this.#ws = new WebSocket(`${protocol}//${host}/api/telemetry/stream`);

    this.#ws.onopen = () => {
      this.isConnected = true;
      this.#reconnectAttempts = 0;
      
      // Subscribe to target streams
      this.#ws.send(JSON.stringify({ type: 'SUBSCRIBE', userId: this.userId }));
    };

    this.#ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.error) {
        console.error("Server Error Response:", data.error);
        return;
      }

      // 2. Deep Reactivity in Action: Directly mutating properties 
      // Svelte tracks these mutations at a micro-level
      this.sysMetrics = data.sys_metrics || {};
      this.cacheMetrics = data.cache_metrics || [];

      // Extract details for the Chart.js visual hook if present
      if (this.#chartUpdateCallback) {
        const totalHits = this.cacheMetrics.reduce((acc, c) => acc + (c.hit_count || 0), 0);
        const totalMisses = this.cacheMetrics.reduce((acc, c) => acc + (c.miss_count || 0), 0);
        this.#chartUpdateCallback(totalHits, totalMisses);
      }
    };

    this.#ws.onclose = () => {
      this.isConnected = false;
      if (this.#deliberateDisconnect) return;

      // 3. Exponential Reconnection Backoff with Jitter
      const baseDelay = Math.min(500 * Math.pow(2, this.#reconnectAttempts), 10000);
      const jitter = Math.random() * 200;
      this.#reconnectAttempts++;

      console.warn(`WS connection dropped. Reconnecting in ${(baseDelay + jitter).toFixed(0)}ms...`);
      setTimeout(() => this.connect(this.userId), baseDelay + jitter);
    };

    this.#ws.onerror = (err) => {
      console.error("WebSocket Internal Exception:", err);
      this.#ws.close();
    };
  }

  disconnect() {
    this.#deliberateDisconnect = true;
    if (this.#ws) this.#ws.close();
    
    // Reset state parameters
    this.sysMetrics = {};
    this.cacheMetrics = [];
    if (this.#chartUpdateCallback) this.#chartUpdateCallback(0, 0);
  }
}

// Export a single dedicated instance across the workspace (Singleton Pattern)
export const telemetry = new TelemetryClient();
