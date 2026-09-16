const KVClient = require('../lib/KVClient.js'); // Path to your updated client file

// Helper to pause execution for TTL expiration verification
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runTests() {
  console.log('🧪 Starting KV-Engine Standalone Testing Suite...\n');

  // Hardcode a mock userID for testing continuity across client lifecycles
  const mockUserID = '678e35f0-9955-4778-be0e-052abff73531';
  
  // Setup client reference
  let db = new KVClient({ userId: mockUserID });

  try {
    console.log('--- 🔌 STAGE 1: Connection & Authentication ---');
    await db.connect();
    console.log('✅ Connected & Authenticated with server.');

    console.log('\n--- 📂 STAGE 2: Cache Multi-Instance Isolation ---');
    const cache1 = await db.createCache();
    const cache2 = await db.createCache();
    
    console.log(`✅ Cache 1 provisioned with ID: ${cache1.cacheID}`);
    console.log(`✅ Cache 2 provisioned with ID: ${cache2.cacheID}`);

    // Verify closure isolation
    if (cache1.cacheID === cache2.cacheID) {
      throw new Error('❌ Isolation Error: Cache IDs are identical!');
    }

    console.log('\n--- 📥 STAGE 3: Core Data Operations (No TTL) ---');
    const setRes1 = await cache1.set('profile', 'Alice_Dev');
    const setRes2 = await cache2.set('profile', 'Bob_Manager');
    
    console.log(`Cache 1 Set Status: ${setRes1}`);
    console.log(`Cache 2 Set Status: ${setRes2}`);

    const val1 = await cache1.get('profile');
    const val2 = await cache2.get('profile');
    
    console.log(`Cache 1 ['profile']: ${val1}`);
    console.log(`Cache 2 ['profile']: ${val2}`);

    if (val1 !== 'Alice_Dev' || val2 !== 'Bob_Manager') {
      throw new Error('❌ Data Collision: Keys are overwriting between distinct cache contexts.');
    }
    console.log('✅ Isolation Verified: Separate caches hold distinct data schemas for identical keys.');

    console.log('\n--- ⏳ STAGE 4: Time-To-Live (TTL) Eviction ---');
    // Set a key on cache 1 with a 2-second lifespan
    await cache1.set('temp_token', 'SECRET_XYZ', 2);
    
    let immediateCheck = await cache1.get('temp_token');
    console.log(`Immediate TTL Check (Should exist): ${immediateCheck}`);
    if (immediateCheck !== 'SECRET_XYZ') throw new Error('❌ TTL insertion failed to write data.');

    console.log('Waiting 2.5 seconds for TTL expiration...');
    await sleep(2500);

    let expiredCheck = await cache1.get('temp_token');
    console.log(`Post-Expiration Check (Should be null): ${expiredCheck}`);
    if (expiredCheck !== null) {
      console.warn('⚠️ Warning: TTL eviction failed. Ensure your lru.js handles TTL checks on read requests.');
    } else {
      console.log('Polled value clean! ✅ TTL Eviction Success.');
    }

    console.log('\n--- 🗑️ STAGE 5: Explicit Deletions ---');
    await cache1.set('target_key', 'Deletable_Value');
    const delRes = await cache1.del('target_key');
    console.log(`Delete Command Status: ${delRes}`);
    
    const postDelCheck = await cache1.get('target_key');
    console.log(`Post-Delete Read (Should be null): ${postDelCheck}`);
    if (postDelCheck !== null) throw new Error('❌ Delete operation did not remove key.');
    console.log('✅ Deletion operational.');

    // Save cache IDs to verify rehydration state persistence after you reboot your server
    const savedCacheId1 = cache1.cacheID;
    const savedCacheId2 = cache2.cacheID;

    console.log('\n--- 🔌 STAGE 6: Disconnecting Client Lifecycle ---');
    db.disconnect();
    console.log('Client connection closed clean.');

    console.log('\n======================================================');
    console.log('⚠️  SERVER REBOOT INSTRUCTION FOR REHYDRATION CHECK  ⚠️');
    console.log('======================================================');
    console.log('1. Go to your server terminal and press Ctrl+C to kill it.');
    console.log('2. Start your server again: node server.js');
    console.log('3. Press ANY KEY in this terminal window to resume validation...');
    console.log('======================================================\n');

    // Wait for manual confirmation that you restarted the server
    await new Promise((resolve) => {
        process.stdin.setRawMode(true);
        process.stdin.resume();
        process.stdin.once('data', () => {
            process.stdin.setRawMode(false);
            process.stdin.pause();
            resolve();
        });
    });

    console.log('Resuming validation sequence...');
    console.log('Re-establishing connection using identical layout configurations...');
    
    db = new KVClient({ userId: mockUserID });
    await db.connect();
    console.log('✅ Client reconnected successfully.');

    console.log('\n--- 🔁 STAGE 7: State Rehydration Verification ---');
    
    // Instead of calling createCache() (which creates a blank space),
    // we bypass creation and construct scoped objects manually around known old IDs
    // to check if the server reloaded them from the AOF logs.
    const rehydratedCache1 = {
        async get(k) { return db._sendCommand(`GET|${savedCacheId1}|${k}`); }
    };
    const rehydratedCache2 = {
        async get(k) { return db._sendCommand(`GET|${savedCacheId2}|${k}`); }
    };

    const restoredVal1 = await rehydratedCache1.get('profile');
    const restoredVal2 = await rehydratedCache2.get('profile');

    console.log(`Restored Cache 1 ['profile'] Response: ${restoredVal1}`);
    console.log(`Restored Cache 2 ['profile'] Response: ${restoredVal2}`);

    if (restoredVal1.includes('Alice_Dev') && restoredVal2.includes('Bob_Manager')) {
        console.log('\n🎉 🎉 🎉 SUCCESS: Server state completely restored across runtime reboots! 🎉 🎉 🎉');
    } else {
        throw new Error('❌ Rehydration failure: Historical context maps could not be resolved from AOF.');
    }

    db.disconnect();

  } catch (error) {
    console.error('\n❌ TEST RUN FAILED:\n', error);
    db.disconnect();
    process.exit(1);
  }
}

runTests();
