const express = require('express');
const router = express.Router();
const { ContractManager } = require('../lib/contract-manager');

const manager = new ContractManager();

router.get('/:chainId', async (req, res, next) => {
    let chainId = req.params.chainId;

    try {
        console.log("[INFO] Search IP for chain " + chainId);
        return res.status(200).json({ info: "查詢成功", ip: await manager.searchNaming(chainId) }); 
    } catch (err) {
        console.log("[ERROR] Registe error. Error: " + err.message);
        return res.status(500).json({ error: "伺服器發生錯誤" });
    }
});

router.post('/', async (req, res, next) => {
    let namingData = req.body;

    if ( !namingData.account || !namingData.chainId || !namingData.ip ) return res.status(400).json({ error: "缺少資料欄位" });

    try {
        console.log("[INFO] Registe IP: " + namingData.ip + " from chain " + namingData.chainId + " by " + namingData.account );
        await manager.registeNaming(namingData.account, namingData.chainId, namingData.ip);
        return res.status(200).json({ info: "註冊成功" });
    } catch (err) {
        console.log("[ERROR] Registe error. Error: " + err.message);
        return res.status(500).json({ error: "伺服器發生錯誤" });
    }
});

module.exports = router;
