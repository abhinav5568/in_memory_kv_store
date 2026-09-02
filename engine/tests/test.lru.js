const LRUCache = require('../lru.js')

// ============================================================================
// TEST SUITE FOR YOUR UPDATED TTL-LRU CACHE
// ============================================================================

async function runTests() {
  console.log("STARTING CACHE UNIT TESTS...\n");

  // Helper utility to pause execution for a given number of milliseconds
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // ==========================================
  // TEST 1: Basic LRU Operations & Eviction Order
  // ==========================================
  console.log("--- TEST 1: Standard LRU Eviction & Capacity Limit ---");
  let cache = new LRUCache(3); // Cap capacity at 3 items
  
  cache.insert("A", "Apple");
  cache.insert("B", "Banana");
  cache.insert("C", "Cherry");
  
  console.log("Initial Cache State:");
  cache.dll.display(); // Expected Order: C:Cherry -> B:Banana -> A:Apple

  console.log("\nAccessing 'A' to make it Most Recently Used (MRU)...");
  cache.getVal("A");
  cache.dll.display(); // Expected Order: A:Apple -> C:Cherry -> B:Banana

  console.log("\nInserting 'D' to push capacity to limit (Should evict 'B')...");
  cache.insert("D", "Dragonfruit");
  cache.dll.display(); // Expected Order: D:Dragonfruit -> A:Apple -> C:Cherry
  
  console.log("Checking if 'B' is safely gone:", cache.getVal("B") === null ? "PASSED (null)" : "FAILED");
  console.log("");


  // ==========================================
  // TEST 2: Checking Infinity vs Expiration Timers
  // ==========================================
  console.log("--- TEST 2: Passive TTL Expiration & Infinity Persistence ---");
  let timedCache = new LRUCache(3);
  
  // 1. Insert an item with an explicit 1-second lifespan
  timedCache.insert("temp", "I disappear in 1s", 1000);
  
  // 2. Insert items checking your new safe_ttl fallback rules (undefined / null / omitted)
  timedCache.insert("forever1", "I live forever (omitted TTL)"); 
  timedCache.insert("forever2", "I live forever (undefined TTL)", undefined);
  
  console.log("Cache state immediately after insertion:");
  timedCache.dll.display();

  console.log("\nWaiting 1.2 seconds for 'temp' to expire...");
  await wait(1200);

  console.log("Attempting to get expired item 'temp':");
  let expiredVal = timedCache.getVal("temp"); // Should trigger passive removal
  console.log("Result (Expected null):", expiredVal);
  
  console.log("\nChecking if persistent items are still perfectly intact:");
  console.log("forever1:", timedCache.getVal("forever1")); // Expected: "I live forever (omitted TTL)"
  console.log("forever2:", timedCache.getVal("forever2")); // Expected: "I live forever (undefined TTL)"
  timedCache.dll.display();
  console.log("");


  // ==========================================
  // TEST 3: Dynamic setTTL Boundary Adjustments
  // ==========================================
  console.log("--- TEST 3: Dynamic setTTL Modification ---");
  let ttlCache = new LRUCache(2);
  
  ttlCache.insert("X", "Xylophone"); // Defaults to Infinity
  console.log("Setting a short 500ms lifespan on persistent key 'X'...");
  ttlCache.setTTL("X", 500); 

  console.log("Reading 'X' instantly:", ttlCache.getVal("X")); // Expected: "Xylophone"
  
  console.log("Waiting 700ms for new timer to expire...");
  await wait(700);
  
  console.log("Reading 'X' now (Expected null):", ttlCache.getVal("X"));
  console.log("");


  // ==========================================
  // TEST 4: Stats Bookkeeping
  // ==========================================
  console.log("--- TEST 4: Monitoring System Statistics ---");
  let statsCache = new LRUCache(5);
  statsCache.insert(1, "One");
  statsCache.insert(2, "Two");
  statsCache.remove(1);
  
  let currentStats = statsCache.stats();
  console.log("Current Key Count (Expected 1):", currentStats.key_count);
  console.log("Total Commands Interpreted:", currentStats.commands_interpreted);
  
  console.log("\n🎉 ALL TEST PIPELINES EXECUTED SUCCESSFULLY.");
}

runTests();