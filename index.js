const express = require("express");
const axios = require("axios");
const port = 9000;
const MongoClient = require("mongodb").MongoClient;
const DB_NAME = "kaanch-db"; // 


const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const MONGO_URL = "mongodb://admin:password@localhost:27017";
const client = new MongoClient(MONGO_URL);

MongoClient.connect(MONGO_URL)
    .then(client => {
        console.log("✅ Connected to MongoDB");
        db = client.db(DB_NAME);
        app.listen(port, () => {
            console.log(`🚀 Proxy server running at http://localhost:${port}`);
        });
    })
    .catch(err => {
        console.error("❌ Failed to connect to MongoDB:", err.message);
        process.exit(1);
    });


// api logic
async function checkAndSyncBlocks() {
    try {
        // 1: Get latest block (rpc 2)
        const latestBlock = await axios.post("https://rpc.kaanch.network", {
            jsonrpc: "2.0",
            method: "eth_blockNumber",
            params: [],
            id: 1
        });
        const hexBlockNumber = latestBlock.data.result;
        const latestBlockNumber = parseInt(hexBlockNumber, 16);

        // 2: Get last inserted block from DB
        const nearestBlock = await db.collection("block")
            .find()
            .sort({ blockNumber: -1 })
            .limit(1)
            .toArray();

        let startBlock = 0;
        if (nearestBlock.length > 0) {
            startBlock = nearestBlock[0].blockNumber + 1;
        }

        // 3: Insert missing blocks
        for (let i = startBlock; i <= latestBlockNumber; i++) {
            try {
                const blockData = await axios.post("https://rpc.kaanch.network", {
                    jsonrpc: "2.0",
                    method: "kaanch_getblockdata",
                    params: [i.toString()],
                    id: 1,
                });

                const blockResult = blockData.data.result;
                const block = {
                    ...blockResult,
                    createdAt: new Date(),
                };

                await db.collection("block").insertOne(block);
                console.log(`✅ Inserted block ${i} into 'block' collection`);
                if (Array.isArray(blockResult.transactions) && blockResult.transactions.length > 0) {
                    await db.collection("transaction").insertOne(block);
                    console.log(`📦 Inserted block ${i} into 'transaction' collection (with transactions)`);
                }

            } catch (blockErr) {
                console.error(`❌ Failed to fetch/insert block ${i}:`, blockErr.message);
            }
        }


        console.log(`✔️Synced up to block ${latestBlockNumber}`);
    } catch (error) {
        console.error("❌ Error syncing blocks:", error.message);
    }

    // Schedule the next execution after 1 second
    setTimeout(checkAndSyncBlocks, 1000);
}

checkAndSyncBlocks();

app.get("/", (req, res) => {
    res.send({ message: "Hello from Kaanch docker." })
})