// test-client.js
const net = require('net');
const readline = require('readline');

// Establish persistent TCP pipeline to your engine
const client = net.createConnection({ port: 6379, host: 'localhost' }, () => {
    console.log('✅ Connected successfully to KV-Store Engine!');
    console.log('💡 Format: COMMAND|KEY|VALUE (e.g., SET|name|Aman or GET|name)');
    console.log('------------------------------------------------------------');
    promptUser();
});

// Configure standard I/O for interactive terminal typing
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function promptUser() {
    rl.question('db-engine> ', (input) => {
        if (input.trim().toLowerCase() === 'exit') {
            client.end();
            rl.close();
            return;
        }
        // Append the required newline character before transmitting over raw TCP socket
        client.write(input + '\n');
    });
}

// Handle data returned backwards from the engine
client.on('data', (data) => {
    console.log(`\n🔹 Server Response: ${data.toString().trim()}`);
    console.log('------------------------------------------------------------');
    promptUser(); // Re-prompt for next input
});

client.on('end', () => {
    console.log('\n❌ Disconnected from server.');
    process.exit(0);
});

client.on('error', (err) => {
    console.error('\n🚨 Client Network Error:', err.message);
    process.exit(1);
});
