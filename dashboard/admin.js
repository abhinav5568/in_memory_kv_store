const blessed = require('blessed');
const contrib = require('blessed-contrib');
const KVClient = require('../kvclient/KVClient.js'); // Adjust path if needed

// read userID for app accessing cache stats for specific namespace in the server memory 
const targetUserId = process.argv[2];

if (!targetUserId) {
  console.error("❌ Error: Please provide a target userID.");
  console.error("Usage: node admin.js <userID>");
  process.exit(1);
}
const screen = blessed.screen({
  smartCSR: true,
  title: 'KV Store Telemetry Dashboard'
});

// 12 x 12 layout
const grid = new contrib.grid({ rows: 12, cols: 12, screen: screen });

/*
 Widget 1: Cache Metrics Table (Left side, upper 8 rows)
*/
const cacheTable = grid.set(0, 0, 8, 8, contrib.table, {
  keys: true,
  fg: 'white',
  selectedFg: 'white',
  selectedBg: 'blue',
  interactive: false,
  label: ' Active Cache Instances ',
  width: '100%',
  height: '100%',
  border: { type: 'line', fg: 'cyan' },
  columnSpacing: 2,
  columnWidth: [14, 8, 8, 8, 10, 10]
});
/*
    Widget 2: Global Hit/Miss Ratio (Top right)
*/
const hitDonut = grid.set(0, 8, 5, 4, contrib.donut, {
  radius: 3,
  arcWidth: 2,
  yPadding: 1,
  remainColor: 'black',
  label: ' Hit / Miss Ratio '
});

/*
    Widget 3: Memory gauge 
*/
const memoryGauge = grid.set(5, 8, 3, 4, contrib.gauge, {
  label: ' Heap Usage (512MB Max) ',
  stroke: 'green',
  fill: 'white'
});


/*
    Widget 4: System Logs & Telemetry Output (Bottom row)
*/
const logBox = grid.set(8, 0, 4, 12, contrib.log, {
  fg: 'green',
  selectedFg: 'green',
  label: ' System Status Log '
});

screen.render();


// connect to server and start polling
async function startDashboard() {
  const client = new KVClient({userId : targetUserId});

  try {
    logBox.log('Connecting to KV Store TCP Server...');
    await client.connect();
    logBox.log('Connected! Starting telemetry polling interval (1000ms)...');

    setInterval(async () => {
      try {
        const sysState = await client._getSysState();
        if (!sysState) return;

        const { sys_metrics, cache_metrics } = sysState;

        let totalHits = 0;
        let totalMisses = 0;

        // Process cache array for Table display & aggregate totals
        const tableRows = cache_metrics.map(c => {
          totalHits += c.hit_count;
          totalMisses += c.miss_count;

          // Shorten long UUIDs so they fit in the table
          const shortId = c.cacheID.length > 12 
            ? `${c.cacheID.substring(0, 10)}...` 
            : c.cacheID;

          return [
            shortId,
            c.key_count.toString(),
            c.hit_count.toString(),
            c.miss_count.toString(),
            c.evictions.toString(),
            c.commands_interpreted.toString()
          ];
        });

        // 1. Update Table
        cacheTable.setData({
          headers: ['Cache ID', 'Keys', 'Hits', 'Misses', 'Evicted', 'Cmds'],
          data: tableRows
        });

        // 2. Update Donut Chart
        const totalReqs = totalHits + totalMisses;
        const hitPercent = totalReqs === 0 ? 0 : Math.round((totalHits / totalReqs) * 100);
        const missPercent = totalReqs === 0 ? 0 : Math.round((totalMisses / totalReqs) * 100);

        hitDonut.setData([
          { percent: hitPercent, label: 'Hits', color: 'green' },
          { percent: missPercent, label: 'Misses', color: 'red' }
        ]);

        // 3. Update Memory Gauge (Assuming 512MB soft target)
        const heapMb = sys_metrics.heap_used_mb || 0;
        const heapPercent = Math.min(100, Math.round((heapMb / 512) * 100));
        memoryGauge.setPercent(heapPercent);

        // Render UI changes to terminal screen
        screen.render();
      } catch (err) {
        logBox.log(`Telemetry Fetch Error: ${err.message}`);
      }
    }, 1000);

  } catch (err) {
    logBox.log(`Dashboard Connection Error: ${err.message}`);
  }
}

// 4. Keyboard Navigation & Termination Shortcuts
screen.key(['escape', 'q', 'C-c'], () => {
  return process.exit(0);
});

// Boot Dashboard
startDashboard();