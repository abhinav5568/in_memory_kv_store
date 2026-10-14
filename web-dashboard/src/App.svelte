<script>
  import { onMount, onDestroy } from 'svelte';
  import { telemetry } from './lib/TelemetryClient.svelte.js';
  import { Chart, registerables } from 'chart.js';
  Chart.register(...registerables);

  let inputUserId = $state('');
  let chartCanvas;
  let chartInstance;

  // Derived Reactive Properties using $derived (Svelte 5 Runes)
  // Re-evaluates instantly whenever telemetry.cacheMetrics changes internally
  let totalKeys = $derived(
    telemetry.cacheMetrics.reduce((acc, curr) => acc + (curr.key_count || 0), 0)
  );

  onMount(() => {
    chartInstance = new Chart(chartCanvas, {
      type: 'doughnut',
      data: {
        labels: ['Hits', 'Misses'],
        datasets: [{ data: [], backgroundColor: ['#10B981', '#EF4444'], borderWidth: 0 }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });

    // Provide a channel for the singleton to push chart update vectors
    telemetry.setChartCallback((hits, misses) => {
      if (!chartInstance) return;
      chartInstance.data.datasets[0].data = [hits, misses];
      chartInstance.update();
    });
  });

  onDestroy(() => {
    telemetry.disconnect();
    if (chartInstance) chartInstance.destroy();
  });

  function handleConnectionToggle() {
    if (telemetry.isConnected) {
      telemetry.disconnect();
    } else {
      if (!inputUserId.trim()) return alert("Please specify a target User UUID");
      telemetry.connect(inputUserId);
    }
  }
</script>

<main class="bg-gray-900 text-white min-h-screen p-8">
  <div class="max-w-7xl mx-auto space-y-6">
    
    <!-- Status Configuration Dashboard Bar -->
    <div class="flex justify-between items-center bg-gray-800 p-6 rounded-xl border {telemetry.isConnected ? 'border-gray-700' : 'border-rose-500/30'}">
      <div>
        <h1 class="text-2xl font-bold text-cyan-400">PulseKV Engine Monitor</h1>
        <p class="text-gray-400 text-sm">Fine-Grained Reactive Class Singleton Architecture</p>
      </div>
      <div class="flex items-center gap-4">
        <span class="px-3 py-1 text-xs font-semibold uppercase rounded-full border {telemetry.isConnected ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border-rose-500/30'}">
          {telemetry.isConnected ? 'Connected' : 'Disconnected'}
        </span>
        <div class="flex gap-2">
          <input bind:value={inputUserId} type="text" placeholder="Paste User UUID..." disabled={telemetry.isConnected}
                 class="bg-gray-900 border border-gray-700 text-white px-4 py-2 rounded-lg w-80 text-sm focus:outline-none focus:border-cyan-500 disabled:opacity-50" />
          <button onclick={handleConnectionToggle}
                  class="font-semibold px-5 py-2 rounded-lg text-sm transition shadow-md {telemetry.isConnected ? 'bg-rose-600 hover:bg-rose-500' : 'bg-cyan-600 hover:bg-cyan-500'}">
            {telemetry.isConnected ? 'Disconnect' : 'Connect'}
          </button>
        </div>
      </div>
    </div>

    <!-- Live Card Data Elements Block -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div class="bg-gray-800 p-5 rounded-xl border border-gray-700">
        <p class="text-gray-400 text-xs font-semibold uppercase">Server Uptime</p>
        <p class="text-2xl font-bold mt-1 text-emerald-400">{telemetry.sysMetrics.uptime_seconds || 0}s</p>
      </div>
      <div class="bg-gray-800 p-5 rounded-xl border border-gray-700">
        <p class="text-gray-400 text-xs font-semibold uppercase">Heap Memory</p>
        <p class="text-2xl font-bold mt-1 text-purple-400">{telemetry.sysMetrics.heap_used_mb || 0} MB</p>
      </div>
      <div class="bg-gray-800 p-5 rounded-xl border border-gray-700">
        <p class="text-gray-400 text-xs font-semibold uppercase">Active Sockets</p>
        <p class="text-2xl font-bold mt-1 text-blue-400">{telemetry.sysMetrics.active_connections || 0}</p>
      </div>
      <div class="bg-gray-800 p-5 rounded-xl border border-gray-700">
        <p class="text-gray-400 text-xs font-semibold uppercase">Total Keys</p>
        <p class="text-2xl font-bold mt-1 text-yellow-400">{totalKeys}</p>
      </div>
    </div>

    <!-- Active LRU Workspace Table & Chart Matrix -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div class="lg:col-span-2 bg-gray-800 p-6 rounded-xl border border-gray-700">
        <h2 class="text-lg font-bold mb-4 text-gray-200">Active LRU Caches</h2>
        <div class="overflow-x-auto">
          <table class="w-full text-left text-sm text-gray-300">
            <thead class="bg-gray-900/50 text-gray-400 uppercase text-xs">
              <tr>
                <th class="p-3">Cache ID</th>
                <th class="p-3">Keys</th>
                <th class="p-3">Hits</th>
                <th class="p-3">Misses</th>
                <th class="p-3">Evictions</th>
                <th class="p-3">Cmds</th>
              </tr>
            </thead>
            <tbody>
              {#each telemetry.cacheMetrics as cache (cache.cacheID)}
                <tr class="border-b border-gray-700/50 hover:bg-gray-700/30 transition">
                  <td class="p-3 font-mono text-cyan-400 text-xs">{cache.cacheID}</td>
                  <td class="p-3">{cache.key_count}</td>
                  <td class="p-3 text-emerald-400">{cache.hit_count}</td>
                  <td class="p-3 text-rose-400">{cache.miss_count}</td>
                  <td class="p-3 text-yellow-400">{cache.evictions}</td>
                  <td class="p-3">{cache.commands_interpreted}</td>
                </tr>
              {:else}
                <tr>
                  <td colspan="6" class="p-8 text-center text-gray-500">
                    {telemetry.isConnected ? 'No active caches found.' : 'Awaiting streaming link authorization.'}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>

      <div class="bg-gray-800 p-6 rounded-xl border border-gray-700 flex flex-col items-center justify-between">
        <h2 class="text-lg font-bold mb-4 text-gray-200 w-full text-center">Hit / Miss Ratio</h2>
        <div class="w-56 h-56 relative my-auto">
          <canvas bind:this={chartCanvas}></canvas>
        </div>
      </div>
    </div>
  </div>
</main>
