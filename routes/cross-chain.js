const express = require('express');
const router = express.Router();
const request = require('request-promise');
const { TX_STATE } = require('../model/enum/crosschain-status');
const { ContractManager } = require('../lib/contract-manager');
const { TransactionSearcher } = require('../lib/transaction-searcher');

const manager = new ContractManager();
const txSearch = new TransactionSearcher();

router.get('/:hash', async (req, res, next) => {
    let hash = req.params.hash;
    
    try {
        console.log("[INFO] Search recent state for " + hash);

        let txRes = await manager.getRecentState(hash);

        if (txRes) {
            let txHash = await manager.getInitTx(hash);
            let txData = await txSearch.receiveCrossChainTx(txHash);
            
            (txData) ?
            res.status(200).json({ info: "查詢成功", status: txRes.words[0], data: txData }) :
            res.status(404).json({ error: "查詢不到該筆跨鏈交易原始紀錄" });
        } else {
            res.status(404).json({ error: "查詢不到該筆跨鏈交易狀態" });
        }

    } catch (err) {
        console.log("[ERROR] Search state error. Error: " + err.message);
        return res.status(500).json({ error: "伺服器發生錯誤" });
    }

});

router.post('/', async (req, res, next) => {
    let txData = req.body;

    if (!txData.from || !txData.to || !txData.data ) return res.status(400).json({ error: "缺少資料欄位" });

    try {
        console.log("[INFO] Creating cross chain transaction from " + txData.from + " to " + txData.to);

        // Create cross chain transaction
        let txRes = await manager.sendTransaction(txData.from, txData.to, "REQUEST", txData.data);
        // Calculate data hash for search
        let dataHash = await manager.calcHash(txData.from, txData.to, "REQUEST", txData.data);
        // Parepare state when receive from child chain
        await manager.changeState(dataHash, TX_STATE.PREPARE);

        // Log transaction to contract
        await manager.setInitTx(dataHash, txRes.receipt.transactionHash);
    
        return res.status(200).json({ info: "跨鏈交易請求已提交", dataHash: dataHash, rawResponse: txRes });
    } catch (err) {
        console.log("[ERROR] Create cross chain transaction error. Error: " + err.message);
        return res.status(500).json({ error: "伺服器發生錯誤" });
    }
});


router.patch('/', async (req, res, next) => {
    let txData = req.body;

    if (!txData.hash || !txData.state ) res.status(400).json({ error: "缺少資料欄位" });

    try {
        // Get current state
        let currentState = await manager.getRecentState(txData.hash);

        if (currentState) {
            // check if step is correct
            if ((parseInt(currentState) !== parseInt(txData.state) + 1) && !TX_STATE.REVOKE) return res.status(400).json({ error: "跨鏈請求狀態不對稱" });

            if (parseInt(txData.state) === TX_STATE.COMMIT) {
                // Search txhash for cross chain information
                let txHash = await manager.getInitTx(txData.hash);
                let crossData = await txSearch.receiveCrossChainTx(txHash);
                let fromIp = await manager.searchNaming(crossData.from);
                let toIp = await manager.searchNaming(crossData.to);

                // Send response to relay chain
                let options = (target, state) => {
                    return {
                        method: 'PATCH',
                        uri: "http://" + target + "/crosschain",
                        body: {
                            hash: txData.hash,
                            state: state
                        },
                        json: true
                    }
                };

                await request(options(fromIp, TX_STATE.COMMIT))
                    .then(() => {
                        console.log("[INFO] Commit to FROM");

                        return request(options(toIp, TX_STATE.COMMIT))
                    })
                    .then(async () => {
                        console.log("[INFO] Commit to TO");
                        // invoke change state
                        await manager.changeState(txData.hash, txData.state);
                        console.log("[INFO] Change cross chain transaction " + txData.hash + " state to " + txData.state + " success.");
                        return res.status(200).json({ info: "跨鏈請求狀態更新成功", state: txData.state });
                    })
                    .catch(() => {
                        return res.status(500).json({ error: "跨鏈交易 COMMIT 失敗" });
                    })
                    
                return;
            }

        } else {
            console.log("[ERROR] Change cross chain transaction " + txData.hash + " state to " + txData.state + " fail. Error: Cannot found specific hash " + txData.hash);
            return res.status(404).json({ error: "找不到該跨鏈請求" });
        }

    } catch (err) {
        console.log("[ERROR] Change cross chain transaction " + txData.hash + " state to " + txData.state + " fail. Error: " + err.message);
        return res.status(500).json({ error: "伺服器發生錯誤" });
    }
});


module.exports = router;