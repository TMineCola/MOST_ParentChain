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

    async getLastUpdate(dataHash) {
        let contract = await this.connector.getCrossContract();
        return await contract.getTxInsertTime(dataHash, { from: process.env.PUBLIC_KEY });
    }

    async getRecentState(dataHash) {
        let contract = await this.connector.getCrossContract();
        return await contract.getTxRecentState(dataHash, { from: process.env.PUBLIC_KEY });
    }

    async getInitTx(datahash) {
        let contract = await this.connector.getContract();
        return await contract.getTxInitInfo(datahash, { from: process.env.PUBLIC_KEY });
    }

    async sendTransaction(from, to, method, data) {
        let contract = await this.connector.getCrossContract();
        return await contract.sendCrossChainTransaction(parseInt(from), parseInt(to), method, JSON.stringify(data), new Date().getTime(), { from: process.env.PUBLIC_KEY });
    }

    async setInitTx(dataHash, txHash) {
        let contract = await this.connector.getContract();
        return await contract.setTxInfo(dataHash, txHash, { from: process.env.PUBLIC_KEY });
    }

    async changeState(dataHash, state) {
        let contract = await this.connector.getCrossContract();
        return await contract.changeTxState(dataHash, state, new Date().getTime(), { from: process.env.PUBLIC_KEY });
    }

    async revokeTransaction(dataHash) {
        let contract = await this.connector.getCrossContract();
        return await contract.changeTxState(dataHash, TX_STATE.REVOKE, new Date().getTime(), { from: process.env.PUBLIC_KEY });
    }

    async registeNaming(account, chainId, ip) {
        let contract = await this.connector.getNamingContract();
        return await contract.register(account, parseInt(chainId), ip, { from: process.env.PUBLIC_KEY });
    }

    async searchNaming(chainId) {
        let contract = await this.connector.getNamingContract();
        return await contract.findIpByChainID(parseInt(chainId), { from: process.env.PUBLIC_KEY });
    }

}

module.exports = {
    ContractManager
};