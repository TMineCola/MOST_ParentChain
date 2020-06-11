require('dotenv').config();
const Web3 = require("web3");
const Contract = require("truffle-contract");
const fs = require('fs');

class Connector {
    
    constructor() {
        this.privatekey = process.env.PRIVATE_KEY;
        this.publickey = process.env.PUBLIC_KEY;
        this.provider = new Web3.providers.WebsocketProvider(process.env.QUORUM_PROVIDER)
        this.web3 = new Web3(this.provider);
        // Load abi
        try {
            this.cross_abi = JSON.parse(fs.readFileSync(process.env.CONTRACT_CROSS_JSON_PATH, 'utf8')).abi;
            this.naming_abi = JSON.parse(fs.readFileSync(process.env.CONTRACT_NAMING_JSON_PATH, 'utf8')).abi;
        } catch(err) {
            console.log("Load abi fail, error: " + err.message);
        }
        // Load Contract with abi
        this.cross_contract = Contract({
            abi: this.cross_abi
        });
        this.naming_contract = Contract({
            abi: this.naming_abi
        });
        // Set contract provider and address
        this.cross_contract.setProvider(this.provider);
        this.naming_contract.setProvider(this.provider);
    }

    async calcHash(from, to, method, data) {
        return await this.web3.utils.soliditySha3(parseInt(from), parseInt(to), method, (typeof(data) === "object") ? JSON.stringify(data) : data);
    }

    async getCrossContract() {
        return await this.cross_contract.at(process.env.CROSSCHAIN_CONTRACT_ADR);
    }

    async getCrossListenContract() {
        return await new this.web3.eth.Contract(this.cross_abi, process.env.CROSSCHAIN_CONTRACT_ADR);
    }

    async getNamingContract() {
        return await this.naming_contract.at(process.env.NAMING_CONTRACT_ADR);
    }

    async getNamingListenContract() {
        return await new this.web3.eth.Contract(this.naming_abi, process.env.NAMING_CONTRACT_ADR);
    }

    getCrossAbi() {
        return this.cross_abi;
    }

    getNamingAbi() {
        return this.naming_abi;
    }

    getWeb3() {
        return this.web3;
    }

}

module.exports = {
    Connector
};