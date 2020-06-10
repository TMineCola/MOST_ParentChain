require('dotenv').config();
const { Connector } = require('./quorum-connector');
const { TX_STATE } = require('../model/enum/crosschain-status');

class ContractManager {
    
    constructor() {
        this.connector = new Connector();
    }

    async getConnector() {
        return await this.connector;
    }

    async calcHash(from, to, method, data) {
        return await this.connector.calcHash(from, to, method, data);
    }

    async getLastUpdate(hash) {
        let contract = await this.connector.getCrossContract();
        return await contract.getTxInsertTime(hash, { from: process.env.PUBLIC_KEY });
    }

    async getRecentState(hash) {
        let contract = await this.connector.getCrossContract();
        return await contract.getTxRecentState(hash, { from: process.env.PUBLIC_KEY });
    }

    async sendTransaction(from, to, method, data) {
        let contract = await this.connector.getCrossContract();
        return await contract.sendCrossChainTransaction(parseInt(from), parseInt(to), method, JSON.stringify(data), new Date().getTime(), { from: process.env.PUBLIC_KEY });
    }

    async changeState(hash, state) {
        let contract = await this.connector.getCrossContract();
        return await contract.changeTxState(hash, state, new Date().getTime(), { from: process.env.PUBLIC_KEY });
    }

    async revokeTransaction(hash) {
        let contract = await this.connector.getCrossContract();
        return await contract.changeTxState(hash, TX_STATE.REVOKE, new Date().getTime(), { from: process.env.PUBLIC_KEY });
    }

    async registeNaming(account, chainID, ip) {
        let contract = await this.connector.getNamingContract();
        return await contract.register(account, chainID, ip, { from: process.env.PUBLIC_KEY });
    }

    async searchNaming(chainId) {
        let contract = await this.connector.getNamingContract();
        return await contract.findIpByChainID(chainId, { from: process.env.PUBLIC_KEY });
    }

}

module.exports = {
    ContractManager
};