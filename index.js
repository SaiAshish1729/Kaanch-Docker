const express = require("express");
const axios = require("axios");
const port = 9000;
const MongoClient = require("mongodb").MongoClient;
const DB_NAME = "kaanch-db";


const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const MONGO_URL = "mongodb://admin:password@localhost:27017";

let db;
async function startServer() {
    try {
        const client = new MongoClient(MONGO_URL);
        await client.connect();
        db = client.db(DB_NAME);
        console.log("✅ Connected to MongoDB");

        app.listen(port, () => {
            console.log(`🚀 Proxy server running at http://localhost:${port}`);
        });
    } catch (err) {
        console.error("❌ Failed to start server:", err.message);
        process.exit(1);
    }
}
startServer();



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

// user logic
app.post("/get-resp", async (req, res) => {
    try {
        const { method, params } = req.body;
        if (!method || method === "") {
            return res.status(400).json({ message: "'method' is required." })
        }
        const txHash = params[0];

        if (method == "eth_getTransactionReceipt" || method == "eth_getTransactionByHash") {
            const checkTx = await db.collection("transaction").findOne({
                transactions: txHash,
            });

            if (checkTx) {
                return res.status(200).json({
                    success: true,
                    message: "Transaction found in block.",
                    data: checkTx
                });
            } else {
                return res.status(404).json({ success: false, message: "Transaction hash not found in any block." });
            }

        } else if (method == "kaanch_getblockdata") {
            const checkTx = await db.collection("block").findOne({
                $or: [
                    { blockNumber: Number(txHash) },
                    { blockHash: txHash }
                ]
            });
            if (checkTx) {
                return res.status(200).json({
                    success: true,
                    message: "Record found in block.",
                    data: checkTx
                });
            } else {
                return res.status(404).json({ success: false, message: "blockNumber or blockHash hash not found in any block." });
            }
        } else if (method == "eth_getBlockByNumber") {
            // const { blockNumber } = req.body;
            const blockNumberinDecimal = parseInt(txHash, 16);
            const checkTx = await db.collection("block").findOne({ blockNumber: blockNumberinDecimal });
            if (checkTx) {
                return res.status(200).json({
                    success: true,
                    message: "Record found in block.",
                    data: checkTx
                });
            } else {
                return res.status(404).json({ success: false, message: "blockNumber or blockHash hash not found in any block." });
            }
        } else {
            const payload = req.body;
            const resp = await axios.post("https://rpc.kaanch.network", payload);
            return res.status(200).send({ data: resp.data });
        }

    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Error while fetching response.", error });
    }
})

app.get("/", (req, res) => {
    res.send({ message: "Hello from Kaanch docker." })
})