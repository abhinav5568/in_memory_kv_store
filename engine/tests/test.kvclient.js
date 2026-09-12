
const KVClient = require('../lib/KVClient.js')
const userId = "b2be5139-0ee2-4a2a-81eb-7bdef2314f11"
const host = '127.0.0.1';
const port = 6379;
function tests(){
    const client = new KVClient({
        userId, 
        host,
        port
    });

    client.connect().then(() => {
        console.log("connected to the server.");
        client.set('new_name', "kv client user");
        client.get('new_name').then((data) => {
            console.log(data);
        })
        client.del('new_name').then((data) => {
            console.log("deleted the key.", data);
        })
        client.stats().then((data) => {
            console.log(data);
        })
        client.disconnect();
    })
}

tests();