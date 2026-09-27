import { randomUUID } from 'node:crypto';
import KVClient from '../kvclient/KVClient.js';

// Helper for jitter delay
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runTrafficSimulator() {
    const userId = randomUUID();
    
    console.log("==================================================");
    console.log("🚀 TRAFFIC GENERATOR ACTIVE");
    console.log(`📋 USER ID (Copy this to dashboard):`);
    console.log(`   \x1b[32m${userId}\x1b[0m`);
    console.log("==================================================\n");

    const kvclient = new KVClient({ userId });
    await kvclient.connect();

    // Create a couple of isolated caches
    const cacheSessions = await kvclient.createCache();
    const cacheProducts = await kvclient.createCache();

    const caches = [
        { name: "Sessions", instance: cacheSessions },
        { name: "Products", instance: cacheProducts }
    ];

    // Seed keys pool (including invalid ones to simulate cache misses)
    const validKeys = ["usr_101", "usr_102", "usr_103", "prod_abc", "prod_xyz"];
    const potentialMissKeys = ["usr_999", "prod_404", "expired_token"];
    const allKeys = [...validKeys, ...potentialMissKeys];

    // Pre-populate some keys
    await cacheSessions.set("usr_101", JSON.stringify({ role: "admin" }));
    await cacheSessions.set("usr_102", JSON.stringify({ role: "guest" }));
    await cacheProducts.set("prod_abc", "Laptop");
    await cacheProducts.set("prod_xyz", "Headphones");

    console.log("Pumping operations into the server... Press Ctrl+C to stop.\n");

    // Handle Ctrl+C gracefully
    process.on('SIGINT', () => {
        console.log("\nDisconnecting simulator...");
        kvclient.disconnect();
        process.exit(0);
    });

    // Continuous load loop with jitter
    while (true) {
        const target = caches[Math.floor(Math.random() * caches.length)];
        const randomKey = allKeys[Math.floor(Math.random() * allKeys.length)];
        const isWrite = Math.random() < 0.3; // 30% SETs, 70% GETs

        try {
            if (isWrite) {
                const newVal = `val_${Math.floor(Math.random() * 1000)}`;
                await target.instance.set(randomKey, newVal);
                console.log(`[${target.name}] SET ${randomKey} = ${newVal}`);
            } else {
                const val = await target.instance.get(randomKey);
                const status = val !== null ? "\x1b[32mHIT\x1b[0m" : "\x1b[31mMISS\x1b[0m";
                console.log(`[${target.name}] GET ${randomKey} -> ${status}`);
            }
        } catch (err) {
            console.error("Op failed:", err.message);
        }

        // Random jitter delay between 300ms and 800ms
        const jitterMs = Math.floor(Math.random() * 700) + 300;
        await sleep(jitterMs);
    }
}

await runTrafficSimulator();