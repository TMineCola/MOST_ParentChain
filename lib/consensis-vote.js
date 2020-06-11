require('dotenv').config;
const request = require('request-promise');
const { TX_STATE } =require('../model/enum/crosschain-status');
const { VoteGroup } = require('../model/vote');
const { ContractManager } = require('../lib/contract-manager');
const { TransactionSearcher } = require('../lib/transaction-searcher');

class VoteQueue {

    constructor() {
        this.queue = [];
        this.manager = new ContractManager();
        this.txSearch = new TransactionSearcher();
        this.reset();
    }

    push(hash, voteFrom, txHash) {
        // Find out if vote exist
        let target = this.queue.find(group => group.voteFor === hash);

        if(target) {
            // check repeat
            if ( (target.group).map(x => x.voteFrom).indexOf(voteFrom) != -1 ) return false;
            console.log("[INFO] New vote for " + hash + " from transaction " + txHash + ". Vote by: " + voteFrom);
            // add vote
            target.push(voteFrom);
            return true;
        } else {
            // new vote
            console.log("[INFO] New vote for " + hash + " from transaction " + txHash + " created. Start by: " + voteFrom);
            let group = new VoteGroup(hash, txHash);
            group.push(voteFrom);
            this.queue.push(group);
            return true;
        }
    }

    remove(hash) {
        // Find out if vote exist
        let target = this.queue.find(group => group.voteFor === hash);

        if (target !== -1) { 
            console.log("[INFO] Delete vote for " + hash + " success.");
            this.queue.splice(target, 1);
        } else {
            console.log("[INFO] Cannot found vote for " + hash + " to delete.");
        }
    }
    
    toObject() {
        // Format to Key as hash, value as array of vote info
        let formatObject = { };
        this.queue.map(group => formatObject[group.voteFor] = group.toObject());
        return formatObject
    }

    reset() {
        // Timer for check crosschain
        this.readyForCrosschain = setInterval(() => {
            this.queue.filter(group => group.count() > process.env.CHAIN_COUNT * 2 / 3)
                .map(async legal => {
                    console.log("[INFO] Legal cross chain transaction. Ready for deploy to relay chain.");

                    // Remove vote when transaction is revoke
                    let state = await this.manager.getRecentState(legal.voteFor);

                    if (state === TX_STATE.REVOKE) {
                        this.remove(legal.voteFor);
                        return;
                    }
                    
                    await this.manager.changeState(legal.voteFor, TX_STATE.PREPARE);
                    
                    // Search txhash for cross chain information
                    let crossData = await this.txSearch.receiveCrossChainTx(legal.txHash);
                    // find out child chain ip
                    let targetIp = await this.manager.searchNaming(crossData.to);
                    
                    if (!targetIp) {
                        console.log("[ERROR] Cannot found target ip from naming service. ChainId: " + crossData.to)
                        return;
                    }

                    // Send to child chain
                    let options = {
                        method: 'POST',
                        uri: "http://" + targetIp + "/crosschain",
                        body: {
                            from: crossData.from,
                            to: crossData.to,
                            data: crossData.data
                        },
                        json: true
                    };

                    request(options)
                        .then(async (body) => {
                            console.log("[INFO] Deploy to child chain success. Info: " + body.info);
                            // If send to relay chain success, cross chain transaction is pre commit
                            await this.manager.changeState(legal.voteFor, TX_STATE.PRE_COMMIT);
                            this.remove(legal.voteFor);
                        })
                        .catch((body) => {
                            console.log("[ERROR] Deploy to child chain fail. Error: " + body.error );
                        })
                })
        }, process.env.MINUTES_TIME_FOR_CHECK * 60 * 1000)

        // Timer for check revoke
        this.revokeFromTimeout = setInterval(() => {
            this.queue.filter(group => new Date().getTime() > new Date(group.createTime).getTime() + (process.env.MINUTES_TIME_FOR_REVOKE * 60 * 1000) )
                .map(async groupNeedsRemove => {
                    let result = await this.manager.revokeTransaction(groupNeedsRemove.voteFor);
                    let revokeData = await this.txSearch.receiveStateChange(result.tx);
                    this.remove(revokeData.txHash);
                });
        }, process.env.MINUTES_TIME_FOR_CHECK * 60 * 1000);
    }

    clear() {
        // Clear timer
        clearInterval(this.readyForCrosschain);
        clearInterval(this.revokeFromTimeout)
    }
}

module.exports = {
    VoteQueue
};