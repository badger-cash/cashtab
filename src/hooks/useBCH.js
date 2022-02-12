import BigNumber from 'bignumber.js';
import {
    currency,
    isCashtabOutput,
    extractCashtabMessage,
    extractExternalMessage,
} from '@components/Common/Ticker';
import {
    toSmallestDenomination,
    fromSmallestDenomination,
    isValidStoredWallet,
    convertToEcashPrefix,
} from '@utils/cashMethods';
import { postPayment } from '@utils/bip70';
import { 
    TXUtil,
    authPubKeys,
    buildOutScript
} from '@utils/selfMint';
import cashaddr from 'ecashaddrjs';
import { U64 } from 'n64';
import { 
    Input,
    Output,
    Outpoint,
    Coin, 
    MTX,
    TX,
    KeyRing,
    Script,
    Opcode,
    utils,
    script
} from 'bcash';
import {
    Hash160,
    SHA256,
    secp256k1
} from 'bcrypto';
import { read } from 'bufio';

const { 
    SLP,
    common: { opcodes }
} = script;

export default function useBCH() {
    const SEND_BCH_ERRORS = {
        INSUFFICIENT_FUNDS: 0,
        NETWORK_ERROR: 1,
        INSUFFICIENT_PRIORITY: 66, // ~insufficient fee
        DOUBLE_SPENDING: 18,
        MAX_UNCONFIRMED_TXS: 64,
    };

    const POSTAGE_URL = `${currency.postageUrl}?currency=${currency.tokenPrefixes[0]}`;

    const getPostage = async (tokenId) => {
        try {
            const res = await fetch(POSTAGE_URL);
            const postageObj = await res.json();
            const stamp = postageObj.stamps.find(
                s => s.tokenId === tokenId
            );
            if (stamp) {
                return {
                    address: postageObj.address,
                    weight: postageObj.weight,
                    stamp
                };
            }
        } catch (err) {
            console.error(err);
        }
        return null;
    };

    const calculatePostage = (
        inputCount, 
        tokenRecipientCount, 
        postageObj
    ) => {
        const sendAmountArray = ['1', '1']; // Begin with stamp output and change
        for (let i = 0; i < tokenRecipientCount; i++) {
            sendAmountArray.push('1');
        }

        const sendOpReturn = buildSendOpReturn(
            Buffer.alloc(32).toString('hex'),
            sendAmountArray
        )
        let byteCount = getByteCount(
            { P2PKH: inputCount },
            { P2PKH: sendAmountArray.length }
        );

        byteCount += 8 + 1 + sendOpReturn.length;
        // Account for difference in inputs and outputs
        byteCount += 546 * (sendAmountArray.length - inputCount);
  
        let stampsNeeded = Math.ceil(byteCount / postageObj.weight);
        // console.log('byteCount', byteCount);
        // console.log('stampsNeeded', stampsNeeded);
        if (stampsNeeded < 1) stampsNeeded = 1;
        return postageObj.stamp.rate * stampsNeeded;
    }

    const getBcashRestUrl = () => {
        return process.env.REACT_APP_BCASH_API;
    }

    const parseTxData = (wallet, txData) => {
        /*
        Desired output
        [
        {
        txid: '',
        type: send, receive
        receivingAddress: '',
        quantity: amount bcha
        token: true/false
        tokenInfo: {
            tokenId:
            tokenQty:
            txType: mint, send, other
        }
        opReturnMessage: 'message extracted from asm' or ''
        }
        ]
        */
        const ownAddressArray = [
            wallet.Path245.cashAddress,
            wallet.Path145.cashAddress,
            wallet.Path1899.cashAddress
        ];

        const parsedTxHistory = [];
        for (let i = 0; i < txData.length; i += 1) {
            const tx = txData[i];

            const parsedTx = {};

            // Move over info that does not need to be calculated
            parsedTx.txid = tx.hash;
            parsedTx.height = tx.height;
            const destinationOutput = tx.outputs.find(output => output.address)
            const destinationAddress = destinationOutput.address;

            // If this tx had too many inputs to be parsed skip it
            // When this occurs, the tx will only have txid and height
            // So, it will not have 'vin'
            if (!Object.keys(tx).includes('inputs')) {
                // Populate as a limited-info tx that can be expanded in a block explorer
                parsedTxHistory.push(parsedTx);
                continue;
            }

            parsedTx.confirmations = tx.confirmations;
            parsedTx.blocktime = tx.time;
            let amountSent = 0;
            let amountReceived = 0;
            let opReturnMessage = '';
            let isCashtabMessage = false;
            // Assume an incoming transaction
            let outgoingTx = false;
            let tokenTx = false;
            let substring = '';

            // get the address of the sender for this tx and encode into eCash address
            let senderAddress = tx.inputs[0].coin.address;

            // If input includes tx address, this is an outgoing tx
            // Note that with bch-input data, we do not have input amounts
            for (let j = 0; j < tx.inputs.length; j += 1) {
                const thisInput = tx.inputs[j];
                if (ownAddressArray.includes(thisInput.coin.address)) {
                    // This is an outgoing transaction
                    outgoingTx = true;
                }
            }
            // Iterate over vout to find how much was sent or received
            for (let j = 0; j < tx.outputs.length; j += 1) {
                const thisOutput = tx.outputs[j];

                // If there is no addresses object in the output, it's either an OP_RETURN msg or token tx
                if (!thisOutput.address) {
                    let hex = thisOutput.script;

                    if (tx.slpToken) {
                        // this is an eToken transaction
                        tokenTx = true;
                        parsedTx.tokenInfo = parseTokenInfoForTxHistory(tx, ownAddressArray);
                    } else if (isCashtabOutput(hex)) {
                        // this is a cashtab.com generated message
                        try {
                            substring = extractCashtabMessage(hex);
                            opReturnMessage = Buffer.from(substring, 'hex');
                            isCashtabMessage = true;
                        } catch (err) {
                            // soft error if an unexpected or invalid cashtab hex is encountered
                            opReturnMessage = '';
                            console.log(
                                'useBCH.parsedTxHistory() error: invalid cashtab msg hex: ' +
                                    substring,
                            );
                        }
                    } else {
                        // this is an externally generated message
                        try {
                            substring = extractExternalMessage(hex);
                            opReturnMessage = Buffer.from(substring, 'hex');
                        } catch (err) {
                            // soft error if an unexpected or invalid cashtab hex is encountered
                            opReturnMessage = '';
                            console.log(
                                'useBCH.parsedTxHistory() error: invalid external msg hex: ' +
                                    substring,
                            );
                        }
                    }
                    continue; // skipping the remainder of tx data parsing logic in both token and OP_RETURN tx cases
                }
                if (thisOutput.address && 
                    ownAddressArray.includes(thisOutput.address)
                ) {
                    if (outgoingTx) {
                        // This amount is change
                        continue;
                    }
                    amountReceived += fromSmallestDenomination(thisOutput.value);
                } else if (outgoingTx) {
                    amountSent += fromSmallestDenomination(thisOutput.value);
                }
            }
            // Construct parsedTx
            parsedTx.amountSent = amountSent;
            parsedTx.amountReceived = amountReceived;
            parsedTx.tokenTx = tokenTx;
            parsedTx.outgoingTx = outgoingTx;
            parsedTx.replyAddress = senderAddress;
            parsedTx.destinationAddress = destinationAddress;
            parsedTx.opReturnMessage = opReturnMessage;
            parsedTx.isCashtabMessage = isCashtabMessage;

            // Add token info
            parsedTxHistory.push(parsedTx);
        }
        return parsedTxHistory;
    };

    const getTxHistoryBcash = async (
        addresses,
        limit = 30,
        reverse = true
    ) => {
        const result = []
        const utxoPromises = addresses.map(address => {
            const addr = convertToEcashPrefix(address);
            result.push({
                address: addr
            });
            return fetch(`${getBcashRestUrl()}/tx/address/${addr}?slp=true&limit=${limit}&reverse=${reverse}`)
                .then(res => res.json());
        });
        const txs = await Promise.all(utxoPromises);
        let allTxs = [];
        for (let i = 0; i < txs.length; i++) {
            allTxs = [
                ...allTxs,
                ...txs[i]
            ]
        }
        return allTxs;
    };

    const parseTokenInfoForTxHistory = (unparsedTx, ownAddressArray) => {
        // Get transaction type by finding first
        const transactionType = unparsedTx.outputs.find(
            output => output.slp
        ).slp.type;

        let qtyReceived = new BigNumber(0);
        let qtySent = new BigNumber(0);
        // Scan over tx to find out how much was sent and received
        const totalSent = unparsedTx.inputs.filter(input => 
                input.coin.slp && 
                ownAddressArray.includes(input.coin.address) &&
                transactionType != 'MINT'
            )
            .reduce((prev, curr) => prev.plus(curr.coin.slp.value), 
                new BigNumber(0));

        const totalReceived = unparsedTx.outputs.filter(output => 
                output.slp && 
                ownAddressArray.includes(output.address) &&
                output.slp.type != 'BATON'
            )
            .reduce((prev, curr) => prev.plus(curr.slp.value), 
                new BigNumber(0));
        // Check to see if this is either a sent or received transaction
        const divisor = 10 ** parseInt(unparsedTx.slpToken.decimals);

        if (totalSent.gte(totalReceived)) {
            qtySent = totalSent.minus(totalReceived)
                .div(divisor);
        } else {
            qtyReceived = totalReceived.minus(totalSent)
                .div(divisor);
        }

        const cashtabTokenInfo = {};
        cashtabTokenInfo.qtySent = qtySent.toString();
        cashtabTokenInfo.qtyReceived = qtyReceived.toString();
        cashtabTokenInfo.tokenId = unparsedTx.slpToken.tokenId;
        cashtabTokenInfo.tokenName = unparsedTx.slpToken.name;
        cashtabTokenInfo.tokenTicker = unparsedTx.slpToken.ticker;
        cashtabTokenInfo.transactionType = transactionType;

        return cashtabTokenInfo;
    };

    const getUtxoBcash = async (hash, index) => {
        return fetch(`${getBcashRestUrl()}/coin/${hash}/${index}?slp=true`)
            .then(res => res.json())
            .catch(err => null);
    };

    const getUtxosBcash = async (addresses) => {
        const result = []
        const utxoPromises = addresses.map(address => {
            const addr = convertToEcashPrefix(address);
            result.push({
                address: addr
            });
            return fetch(`${getBcashRestUrl()}/coin/address/${addr}?slp=true`)
                .then(res => res.json());
        });
        const utxos = await Promise.all(utxoPromises);
        let allUtxos = [];
        for (let i = 0; i < utxos.length; i++) {
            allUtxos = [
                ...allUtxos,
                ...utxos[i]
            ]
        }
        return allUtxos;
    };

    const getSlpBalancesAndUtxosBcash = async (utxos) => {
        // Prevent app from treating slpUtxos as nonSlpUtxos
        // Do not classify any utxos that include token information as nonSlpUtxos
        const nonSlpUtxos = utxos.filter(utxo => 
            !utxo.slp || (utxo.slp && utxo.slp.value == '0')
        );

        // To be included in slpUtxos, the utxo must
        // have utxo.isValid = true
        // If utxo has a utxo.tokenQty field, i.e. not a minting baton, then utxo.value !== '0'
        const slpUtxos = utxos.filter(utxo => 
            utxo.slp && ( utxo.slp.value != '0' || utxo.slp.type == 'MINT')
        );

        let tokensById = {};

        for (let i = 0; i < slpUtxos.length; i++) {
            const slpUtxo = slpUtxos[i];
            let token = tokensById[slpUtxo.slp.tokenId];

            if (token) {
                // Minting baton does nto have a slpUtxo.tokenQty type
                token.hasBaton = slpUtxo.slp.type === 'BATON';

                if (!token.hasBaton) {
                    token.balance = new BigNumber(token.balance).plus(
                        new BigNumber(slpUtxo.slp.value)
                    );
                }

            } else {
                token = {};
                token.info = await fetch(`${getBcashRestUrl()}/token/${slpUtxo.slp.tokenId}`)
                    .then(res => res.json());
                token.tokenId = slpUtxo.slp.tokenId;
                token.hasBaton = slpUtxo.slp.type === 'BATON';
                if (!token.hasBaton) {
                    token.balance = new BigNumber(slpUtxo.slp.value);
                } else {
                    token.balance = new BigNumber(0);
                }

                tokensById[slpUtxo.slp.tokenId] = token;
            }
        }

        const tokens = Object.values(tokensById);
        // console.log(`tokens`, tokens);
        return {
            tokens,
            nonSlpUtxos,
            slpUtxos,
        };
    };

    const broadcastTx = async (hex) => {
        return fetch(`${getBcashRestUrl()}/broadcast`, {
            method: 'POST',
            body: JSON.stringify({tx: hex})
        }).then(res => res.json());
    }

    const getByteCount = (inputs, outputs) => {
        // from https://github.com/bitcoinjs/bitcoinjs-lib/issues/921#issuecomment-354394004
        let totalWeight = 0
        let hasWitness = false
        // assumes compressed pubkeys in all cases.
        const types = {
          inputs: {
            "MULTISIG-P2SH": 49 * 4,
            "MULTISIG-P2WSH": 6 + 41 * 4,
            "MULTISIG-P2SH-P2WSH": 6 + 76 * 4,
            P2PKH: 148 * 4,
            P2WPKH: 108 + 41 * 4,
            "P2SH-P2WPKH": 108 + 64 * 4
          },
          outputs: {
            P2SH: 32 * 4,
            P2PKH: 34 * 4,
            P2WPKH: 31 * 4,
            P2WSH: 43 * 4
          }
        }
    
        Object.keys(inputs).forEach(function(key) {
          if (key.slice(0, 8) === "MULTISIG") {
            // ex. "MULTISIG-P2SH:2-3" would mean 2 of 3 P2SH MULTISIG
            const keyParts = key.split(":")
            if (keyParts.length !== 2) throw new Error(`invalid input: ${key}`)
            const newKey = keyParts[0]
            const mAndN = keyParts[1].split("-").map(function(item) {
              return parseInt(item)
            })
    
            totalWeight += types.inputs[newKey] * inputs[key]
            const multiplyer = newKey === "MULTISIG-P2SH" ? 4 : 1
            totalWeight += (73 * mAndN[0] + 34 * mAndN[1]) * multiplyer
          } else {
            totalWeight += types.inputs[key] * inputs[key]
          }
          if (key.indexOf("W") >= 0) hasWitness = true
        })
    
        Object.keys(outputs).forEach(function(key) {
          totalWeight += types.outputs[key] * outputs[key]
        })
    
        if (hasWitness) totalWeight += 2
    
        totalWeight += 10 * 4
    
        return Math.ceil(totalWeight / 4)
    }

    const calcFee = (
        utxos,
        p2pkhOutputNumber = 2,
        satoshisPerByte = currency.defaultFee,
    ) => {
        const byteCount = getByteCount(
            { P2PKH: utxos.length },
            { P2PKH: p2pkhOutputNumber },
        );
        const txFee = Math.ceil(satoshisPerByte * byteCount);
        return txFee;
    };

    const buildGenesisOpReturn = (configObj) => {
        const stringsArray = [
            'ticker',
            'name',
            'documentUrl'
        ];
        const pushEmptyOp = new Opcode(
            opcodes.OP_PUSHDATA1,
            Buffer.alloc(0)
        );
        const genesisOpReturn = new Script()
                .pushSym('return')
                .pushData(Buffer.concat([
                    Buffer.from('SLP', 'ascii'),
                    Buffer.alloc(1)
                ]))
                .pushPush(Buffer.alloc(1, 1))
                .pushData(Buffer.from('GENESIS', 'ascii'));
                // Push metadata strings
                for (let i = 0; i < stringsArray.length; i++) {
                    const item = configObj[stringsArray[i]];
                    if (item && typeof item === 'string' && item.length > 0)
                        genesisOpReturn.pushString(item);
                    else
                        genesisOpReturn.push(pushEmptyOp);
                }
                // Document Hash
                if (configObj.documentHash) {
                    const documentHash = typeof configObj.documentHash === 'string'
                        ? Buffer.from(configObj.documentHash, 'hex')
                        : configObj.documentHash;
                    if (!Buffer.isBuffer(documentHash) || (documentHash.length != 0 && documentHash.length != 32))
                        throw new Error ('documentHash must be hex string or buffer of 32 bytes or less');
                    if (documentHash.length === 0)
                        genesisOpReturn.push(pushEmptyOp);
                    else
                        genesisOpReturn.pushPush(documentHash);
                } else
                    genesisOpReturn.push(pushEmptyOp);
                // Decimals
                const decimalInt = parseInt(configObj.decimals);
                if (decimalInt > 9 || decimalInt < 0)
                    throw new Error ('decimal value must be a number between 0 and 9');
                genesisOpReturn.pushPush(Buffer.alloc(1, decimalInt));

                // Mint baton
                if (configObj.mintBatonVout) {
                    const batonInt = parseInt(configObj.mintBatonVout)
                    if (batonInt != 2)
                        throw new Error ('mintBaton must equal 2')
                    genesisOpReturn.pushPush(Buffer.alloc(1, batonInt));
                } else 
                    genesisOpReturn.push(pushEmptyOp);
                // Quantity
                genesisOpReturn.pushData(U64
                    .fromString(configObj.initialQty)
                    .muln(10 ** decimalInt)
                    .toBE(Buffer)
                )
                .compile();

        return genesisOpReturn;
    };

    const buildMintOpReturn = (tokenId, mintQuantityBufBE) => {
        const mintOpReturn = new Script()
                .pushSym('return')
                .pushData(Buffer.concat([
                    Buffer.from('SLP', 'ascii'),
                    Buffer.alloc(1)
                ]))
                .pushPush(Buffer.alloc(1, 1))
                .pushData(Buffer.from('MINT', 'ascii'))
                .pushData(tokenId)
                .pushPush(Buffer.alloc(1, 2))
                .pushData(mintQuantityBufBE)
                .compile();
        return mintOpReturn
    };

    const buildSendOpReturn = (tokenId, sendQuantityArray) => {
        const sendOpReturn = new Script()
                .pushSym('return')
                .pushData(Buffer.concat([
                    Buffer.from('SLP', 'ascii'),
                    Buffer.alloc(1)
                ]))
                .pushPush(Buffer.alloc(1, 1))
                .pushData(Buffer.from('SEND', 'ascii'))
                .pushData(Buffer.from(tokenId, 'hex'))
                for (let i = 0; i < sendQuantityArray.length; i++) {
                    const sendQuantity = sendQuantityArray[i]
                    sendOpReturn.pushData(U64.fromString(sendQuantity).toBE(Buffer))
                }
        return sendOpReturn.compile();
    };

    const createToken = async (
        wallet, 
        feeInSatsPerByte, 
        configObj,
        testOnly = false
    ) => {
        try {
            // Throw error if wallet does not have utxo set in state
            if (!isValidStoredWallet(wallet)) {
                const walletError = new Error(`Invalid wallet`);
                throw walletError;
            }
            const utxos = wallet.state.slpBalancesAndUtxos.nonSlpUtxos;

            const CREATION_ADDR = wallet.Path1899.cashAddress;

            const coins = utxos.map(utxo => Coin.fromJSON(utxo));

            const tx = new MTX()

            // Generate the OP_RETURN entry for an SLP GENESIS transaction.
            const genesisOpReturn = buildGenesisOpReturn(configObj);
            // OP_RETURN needs to be the first output in the transaction.
            tx.addOutput(genesisOpReturn, 0);

            // add output w/ address and amount to send
            tx.addOutput(CREATION_ADDR, currency.etokenSats);
            // Add mint baton output
            if (configObj.mintBatonVout)
                tx.addOutput(CREATION_ADDR, currency.etokenSats); 

            await tx.fund(coins, {
                changeAddress: CREATION_ADDR,
                rate: feeInSatsPerByte * 1000 // 1000 sats per kb = 1 sat/b
            });

            const keyRingArray = [
                KeyRing.fromSecret(wallet.Path245.fundingWif),
                KeyRing.fromSecret(wallet.Path145.fundingWif),
                KeyRing.fromSecret(wallet.Path1899.fundingWif)
            ];

            tx.sign(keyRingArray);

            // output rawhex
            const hex = tx.toRaw().toString('hex');

            // Broadcast transaction to the network
            let broadcast = { success: true };
            if (!testOnly)
                broadcast = await broadcastTx(hex);
            const txidStr = tx.txid().toString('hex')

            if (broadcast.success) {
                console.log(`${currency.ticker} txid`, txidStr);
            }
            let link;
            if (process.env.REACT_APP_NETWORK === `mainnet`) {
                link = `${currency.tokenExplorerUrl}/tx/${txidStr}`;
            } else {
                link = `${currency.blockExplorerUrlTestnet}/tx/${txidStr}`;
            }
            //console.log(`link`, link);

            return link;
        } catch (err) {
            if (err.error === 'insufficient priority (code 66)') {
                err.code = SEND_BCH_ERRORS.INSUFFICIENT_PRIORITY;
            } else if (err.error === 'txn-mempool-conflict (code 18)') {
                err.code = SEND_BCH_ERRORS.DOUBLE_SPENDING;
            } else if (err.error === 'Network Error') {
                err.code = SEND_BCH_ERRORS.NETWORK_ERROR;
            } else if (
                err.error ===
                'too-long-mempool-chain, too many unconfirmed ancestors [limit: 25] (code 64)'
            ) {
                err.code = SEND_BCH_ERRORS.MAX_UNCONFIRMED_TXS;
            }
            console.log(`error: `, err);
            throw err;
        }
    };

    const sendToken = async (
        wallet,
        { 
            tokenId, 
            amount, 
            tokenReceiverAddress,
            postageData
        },
        feeInSatsPerByte,
        testOnly = false
    ) => {

        // Get change address from sending utxos
        // fall back to what is stored in wallet
        const REMAINDER_ADDR = wallet.Path1899.cashAddress;

        const slpBalancesAndUtxos = wallet.state.slpBalancesAndUtxos
        // Handle error of user having no BCH and not using post office
        if (slpBalancesAndUtxos.nonSlpUtxos.length === 0 &&
            !postageData
        ) {
            throw new Error(
                `You need some ${currency.ticker} to send ${currency.tokenTicker}`,
            );
        }

        const nonSlpCoins = slpBalancesAndUtxos.nonSlpUtxos.map( utxo => 
            Coin.fromJSON(utxo)
        );

        const tokenUtxos = slpBalancesAndUtxos.slpUtxos.filter(
            utxo => {
                if (
                    utxo && // UTXO is associated with a token.
                    utxo.slp.tokenId === tokenId && // UTXO matches the token ID.
                    utxo.slp.type !== 'BATON' // UTXO is not a minting baton.
                ) {
                    return true;
                }
                return false;
            },
        );

        if (tokenUtxos.length === 0) {
            throw new Error(
                'No token UTXOs for the specified token could be found.',
            );
        }

        // Get Info for token being sent
        const tokenInfo = slpBalancesAndUtxos.tokens.find(token => 
            token.tokenId == tokenId
        ).info;

        // BEGIN transaction construction.

        const tx = new MTX();

        let finalTokenAmountSent = new BigNumber(0);
        // TODO: Handle multiple token outputs
        let postageAmount = new BigNumber(0)
        let tokenAmountBeingSentToAddress = new BigNumber(amount)
            .times(10 ** tokenInfo.decimals);
        let totalTokenOutputAmount = tokenAmountBeingSentToAddress;

        const tokenCoins = [];
        for (let i = 0; i < tokenUtxos.length; i++) {
            const tokenCoin = Coin.fromJSON(tokenUtxos[i]);
            tokenCoins.push(tokenCoin);

            finalTokenAmountSent = finalTokenAmountSent.plus(
                new BigNumber(tokenUtxos[i].slp.value),
            );

            // Handle postage
            if (postageData) {
                const postageBaseAmount = calculatePostage(
                    tokenCoins.length,
                    1,
                    postageData
                );
                postageAmount = new BigNumber(postageBaseAmount);
            }

            totalTokenOutputAmount = tokenAmountBeingSentToAddress
                .plus(postageAmount);

            if (totalTokenOutputAmount.lte(finalTokenAmountSent)) {
                break;
            }
        }

        const tokenAmountArray = [ tokenAmountBeingSentToAddress.toString() ];
        // Add postage to output array if exists
        if (postageAmount.gt(0))
            tokenAmountArray.push(postageAmount.toString());
        // Add change if any
        const tokenChangeAmount = finalTokenAmountSent.minus(totalTokenOutputAmount);
        if (tokenChangeAmount.gt(0))
            tokenAmountArray.push(tokenChangeAmount.toString());

        const sendOpReturn = buildSendOpReturn(
            tokenId,
            tokenAmountArray
        );

        // Add OP_RETURN as first output.
        tx.addOutput(sendOpReturn, 0);

        // Send dust representing tokens being sent.
        const decodedTokenReceiverAddress = cashaddr.decode(tokenReceiverAddress);
        const cleanTokenReceiverAddress = cashaddr.encode(
            'ecash',
            decodedTokenReceiverAddress.type,
            decodedTokenReceiverAddress.hash
        );
        // Add destination output
        tx.addOutput(
            cleanTokenReceiverAddress,
            currency.etokenSats,
        );

        // Add postage output is any
        if (postageAmount.gt(0)) {
            const decodedPostageAddress = cashaddr.decode(postageData.address);
            const cleanPostageAddress = cashaddr.encode(
                'ecash',
                decodedPostageAddress.type,
                decodedPostageAddress.hash
            );
            tx.addOutput(
                cleanPostageAddress,
                currency.etokenSats,
            );
        }

        // Send token change if there is any
        if (tokenChangeAmount.gt(0)) {
            tx.addOutput(
                REMAINDER_ADDR,
                currency.etokenSats,
            );
        }

        // If post office is selected
        if (postageData) {
            for (let i =0; i < tokenCoins.length; i++) {
                tx.addCoin(tokenCoins[i]);
            }
        } else {
            // If post office not being used, add native tokens as gas
            await tx.fund([
                    ...tokenCoins,
                    ...nonSlpCoins
                ], {
                inputs: tokenCoins.map(coin => Input.fromCoin(coin).prevout),
                changeAddress: REMAINDER_ADDR,
                rate: feeInSatsPerByte * 1000 // 1000 sats per kb = 1 sat/b
            });
        }

        const keyRingArray = [
            KeyRing.fromSecret(wallet.Path245.fundingWif),
            KeyRing.fromSecret(wallet.Path145.fundingWif),
            KeyRing.fromSecret(wallet.Path1899.fundingWif)
        ];

        // Set Sighash type
        const hashTypes = Script.hashType;
        const sighashType = postageData
            ? hashTypes.ALL | hashTypes.ANYONECANPAY | hashTypes.SIGHASH_FORKID
            : hashTypes.ALL | hashTypes.SIGHASH_FORKID;

        // Sign transaction
        tx.sign(keyRingArray, sighashType);

        // output rawhex
        let txidStr
        const rawTx = tx.toRaw()
        const hex = rawTx.toString('hex');
        console.log('hex', hex);
        
        const paymentObj = {
            merchantData: Buffer.alloc(0),
            transactions: [rawTx],
            refundTo:[{
                script: Script.fromAddress(REMAINDER_ADDR).toRaw(),
                value: 0
            }],
            memo: ''
        }
        // Broadcast if postage enabled
        if (postageData) {
            let paymentAck;
            if (!testOnly) {
                paymentAck = await postPayment(
                    POSTAGE_URL,
                    paymentObj,
                    currency.tokenPrefixes[0]
                );
            }

            if (paymentAck.payment) {
                const transactionIds = paymentAck.payment.transactions.map(t =>
                    TX.fromRaw(t).txid()
                );
                txidStr = transactionIds[0];
                console.log(`${currency.tokenTicker} txid`, txidStr);
            }

        } else {
            // Broadcast transaction to the network
            let broadcast = { success: true };
            if (!testOnly)
                broadcast = await broadcastTx(hex);
            txidStr = tx.txid().toString('hex')

            if (broadcast.success) {
                console.log(`${currency.tokenTicker} txid`, txidStr);
            }
        }

        let link;
        if (process.env.REACT_APP_NETWORK === `mainnet`) {
            link = `${currency.tokenExplorerUrl}/tx/${txidStr}`;
        } else {
            link = `${currency.blockExplorerUrlTestnet}/tx/${txidStr}`;
        }

        //console.log(`link`, link);

        return link;
    };

    const signPkMessage = async (pk, message) => {
        try {
            const keyring = KeyRing.fromSecret(pk);
            const sig = utils.message.sign(message, keyring);
            return sig.toString('base64');
        } catch (err) {
            console.log(`useBCH.signPkMessage() error: `, err);
            throw err;
        }
    };

    const sendXec = async (
        wallet,
        feeInSatsPerByte,
        optionalOpReturnMsg,
        isOneToMany,
        destinationAddressAndValueArray,
        destinationAddress,
        sendAmount,
        testOnly = false
    ) => {
        try {
            let value = new BigNumber(0);

            const tx = new MTX();

            if (isOneToMany) {
                // this is a one to many XEC transaction
                if (
                    !destinationAddressAndValueArray ||
                    !destinationAddressAndValueArray.length
                ) {
                    throw new Error('Invalid destinationAddressAndValueArray');
                }
                const arrayLength = destinationAddressAndValueArray.length;
                for (let i = 0; i < arrayLength; i++) {
                    // add the total value being sent in this array of recipients
                    value = BigNumber.sum(
                        value,
                        new BigNumber(
                            destinationAddressAndValueArray[i].split(',')[1],
                        ),
                    );
                }

                // If user is attempting to send an aggregate value that is less than minimum accepted by the backend
                if (
                    value.lt(
                        new BigNumber(
                            fromSmallestDenomination(
                                currency.dustSats,
                            ).toString(),
                        ),
                    )
                ) {
                    // Throw the same error given by the backend attempting to broadcast such a tx
                    throw new Error('dust');
                }
            } else {
                // this is a one to one XEC transaction then check sendAmount
                // note: one to many transactions won't be sending a single sendAmount

                if (!sendAmount) {
                    return null;
                }

                value = new BigNumber(sendAmount);

                // If user is attempting to send less than minimum accepted by the backend
                if (
                    value.lt(
                        new BigNumber(
                            fromSmallestDenomination(
                                currency.dustSats,
                            ).toString(),
                        ),
                    )
                ) {
                    // Throw the same error given by the backend attempting to broadcast such a tx
                    throw new Error('dust');
                }
            }

            const satoshisToSend = toSmallestDenomination(value);

            // Throw validation error if toSmallestDenomination returns false
            if (!satoshisToSend) {
                const error = new Error(
                    `Invalid decimal places for send amount`,
                );
                throw error;
            }

            // Start of building the OP_RETURN output.
            // only build the OP_RETURN output if the user supplied it
            if (
                typeof optionalOpReturnMsg !== 'undefined' &&
                optionalOpReturnMsg.trim() !== ''
            ) {
                const script = new Script()
                    .pushSym('return')
                    .pushData(Buffer.from(
                        currency.opReturn.appPrefixesHex.cashtab,
                        'hex',
                    ))
                    .pushString(optionalOpReturnMsg)
                    .compile();

                tx.addOutput(script, 0);
            }
            // End of building the OP_RETURN output.
            const utxos = wallet.state.slpBalancesAndUtxos.nonSlpUtxos
            let coins = [];
            for (let i = 0; i < utxos.length; i++) {
                const utxo = utxos[i];
                coins.push(Coin.fromJSON(utxo));
            }

            // Get change address from sending utxos
            // fall back to what is stored in wallet
            const REMAINDER_ADDR = wallet.Path1899.cashAddress;

            if (isOneToMany) {
                // for one to many mode, add the multiple outputs from the array
                let arrayLength = destinationAddressAndValueArray.length;
                for (let i = 0; i < arrayLength; i++) {
                    // add each send tx from the array as an output
                    let outputAddress =
                        destinationAddressAndValueArray[i].split(',')[0];
                    let outputValue = new BigNumber(
                        destinationAddressAndValueArray[i].split(',')[1],
                    );

                    tx.addOutput(
                        outputAddress, 
                        parseInt(toSmallestDenomination(outputValue))
                    );
                }
            } else {
                // for one to one mode, add output w/ single address and amount to send
                tx.addOutput(
                    destinationAddress, 
                    parseInt(toSmallestDenomination(value))
                );
            }

            await tx.fund(coins, {
                changeAddress: REMAINDER_ADDR,
                rate: feeInSatsPerByte * 1000 // 1000 sats per kb = 1 sat/b
            });

            const keyRingArray = [
                KeyRing.fromSecret(wallet.Path245.fundingWif),
                KeyRing.fromSecret(wallet.Path145.fundingWif),
                KeyRing.fromSecret(wallet.Path1899.fundingWif)
            ];

            tx.sign(keyRingArray);

            // output rawhex
            const hex = tx.toRaw().toString('hex');

            // Broadcast transaction to the network
            let broadcast = {success: true};
            if (!testOnly)
                broadcast = await broadcastTx(hex);
            const txidStr = tx.txid().toString('hex')

            if (broadcast.success) {
                console.log(`${currency.ticker} txid`, txidStr);
            }
            let link;
            if (process.env.REACT_APP_NETWORK === `mainnet`) {
                link = `${currency.blockExplorerUrl}/tx/${txidStr}`;
            } else {
                link = `${currency.blockExplorerUrlTestnet}/tx/${txidStr}`;
            }
            //console.log(`link`, link);

            return link;
        } catch (err) {
            if (err.error === 'insufficient priority (code 66)') {
                err.code = SEND_BCH_ERRORS.INSUFFICIENT_PRIORITY;
            } else if (err.error === 'txn-mempool-conflict (code 18)') {
                err.code = SEND_BCH_ERRORS.DOUBLE_SPENDING;
            } else if (err.error === 'Network Error') {
                err.code = SEND_BCH_ERRORS.NETWORK_ERROR;
            } else if (
                err.error ===
                'too-long-mempool-chain, too many unconfirmed ancestors [limit: 25] (code 64)'
            ) {
                err.code = SEND_BCH_ERRORS.MAX_UNCONFIRMED_TXS;
            }
            console.log(`error: `, err);
            throw err;
        }
    };

    const sendBip70 = async (
        wallet,
        paymentDetails, // b70.PaymentDetails
        feeInSatsPerByte,
        testOnly = false
    ) => {
        // Get change address from sending utxos
        // fall back to what is stored in wallet
        const REMAINDER_ADDR = wallet.Path1899.cashAddress;
        const refundOutput = new Output({
            address: REMAINDER_ADDR
        })

        const slpBalancesAndUtxos = wallet.state.slpBalancesAndUtxos;
        let nonSlpCoins = slpBalancesAndUtxos.nonSlpUtxos.map( utxo => 
            Coin.fromJSON(utxo)
        );

        // Check to see if this is an SLP/eToken transaction
        const firstOutput = paymentDetails.outputs[0]
        const slpScript = SLP.fromRaw(Buffer.from(firstOutput.script));
        const isSlp = slpScript.isValidSlp();
        let postagePaid = false;
        const tokenCoins = [];
        // If is Slp, 
        if (isSlp) {

            // Throw error if transaction type is not SEND
            const slpType = slpScript.getType();
            if (slpType !== 'SEND')
                throw new Error(`Token ${slpType} transactions not supported`);

            // Get required UTXOs
            const tokenIdBuf = slpScript.getData(4);
            const tokenId = tokenIdBuf.toString('hex');
            const sendRecords = slpScript.getRecords(tokenIdBuf);
            const totalBase = sendRecords.reduce((total, record) => {
                return total.add(U64.fromBE(Buffer.from(record.value)));
            }, U64.fromInt(0));
            let totalTokenBalance = U64.fromInt(0);
            const token = wallet.state.tokens.find(token => 
                token.tokenId === tokenId
            );
            if (token) {
                totalTokenBalance = U64.fromString(
                    token.balance.toString()
                );
            }
            if (totalTokenBalance.lt(totalBase))
                throw new Error ('Insufficient token balance to complete transaction');

            const tokenUtxos = slpBalancesAndUtxos.slpUtxos.filter(
                utxo => {
                    if (
                        utxo && // UTXO is associated with a token.
                        utxo.slp.tokenId === tokenId && // UTXO matches the token ID.
                        utxo.slp.type !== 'BATON' // UTXO is not a minting baton.
                    ) {
                        return true;
                    }
                    return false;
                },
            );

            if (tokenUtxos.length === 0) {
                throw new Error(
                    'No token UTXOs for the specified token could be found.',
                );
            }

            let finalTokenAmountSent = U64.fromInt(0);
            for (let i = 0; i < tokenUtxos.length; i++) {
                const tokenCoin = Coin.fromJSON(tokenUtxos[i]);
                tokenCoins.push(tokenCoin);

                finalTokenAmountSent = finalTokenAmountSent.add(
                    U64.fromString(tokenUtxos[i].slp.value),
                );

                if (totalBase.lte(finalTokenAmountSent)) {
                    // Add token change amount to SLP OP_RETURN
                    const tokenChangeAmount = finalTokenAmountSent.sub(totalBase);
                    // Skip if change amount is zero
                    if (tokenChangeAmount.toInt() != 0) {
                        slpScript.pushData(tokenChangeAmount.toBE(Buffer)).compile();
                        // add additional output for change
                        paymentDetails.outputs[0].script = slpScript.toRaw()
                        paymentDetails.outputs.splice(
                            sendRecords.length + 1, // Must skip OP_RETURN
                            0,
                            {
                                script: refundOutput.script.toRaw(),
                                value: 546
                            }
                        );
                    }
                    break;
                }
            }

            // Is Postage Paid by Merchant?
            const merchantData = paymentDetails.getData('json');
            console.log('merchantData', merchantData)
            console.log('typeof merchantData', typeof merchantData)
            if (typeof merchantData === "object" && merchantData.postage) {
                const stamps = merchantData.postage.stamps;
                const listing = stamps.find(stamp => stamp.tokenId == tokenId);
                // If postage is paid don't use native token funding
                if (listing && listing.rate == 0) {
                    postagePaid = true;
                }
            }
            console.log('postagePaid', postagePaid);

            // Handle error of user having no BCH and postage not paid
            if (!postagePaid && slpBalancesAndUtxos.nonSlpUtxos.length === 0) {
                throw new Error(
                    `You need some ${currency.ticker} to send ${currency.tokenTicker}`,
                );
            }
        }

        // Build Transaction
        const tx = new MTX();
        // Set SigHashType
        let sigHashType = Script.hashType.ALL | Script.hashType.SIGHASH_FORKID;

        // Add required outputs
        for (let i = 0; i < paymentDetails.outputs.length; i++) {
            tx.addOutput(paymentDetails.outputs[i]);
        }

        if (postagePaid) {
            // Postage Protocol requires ANYONECANPAY
            sigHashType = Script.hashType.ANYONECANPAY | sigHashType;

            for (let i = 0; i < tokenCoins.length; i++) {
                tx.addCoin(tokenCoins[i]);
            }
        } else {
            await tx.fund([
                    ...tokenCoins,
                    ...nonSlpCoins
                ], {
                inputs: tokenCoins.map(coin => Input.fromCoin(coin).prevout),
                changeAddress: REMAINDER_ADDR,
                rate: feeInSatsPerByte * 1000 // 1000 sats per kb = 1 sat/b
            });
        }

        const keyRingArray = [
            KeyRing.fromSecret(wallet.Path245.fundingWif),
            KeyRing.fromSecret(wallet.Path145.fundingWif),
            KeyRing.fromSecret(wallet.Path1899.fundingWif)
        ];

        tx.sign(keyRingArray, sigHashType);

        // output rawhex
        const rawTx = tx.toRaw()
        const hex = rawTx.toString('hex');
        console.log('hex', hex);

        const paymentObj = {
            merchantData: Buffer.alloc(0),
            transactions: [rawTx],
            refundTo:[{
                script: refundOutput.script.toRaw(),
                value: 0
            }],
            memo: paymentDetails.memo
        } 

        // Broadcast transaction to the network
        let paymentAck;
        if (!testOnly) {
            paymentAck = await postPayment(
                paymentDetails.paymentUrl,
                paymentObj,
                isSlp ? currency.tokenPrefixes[0] : currency.prefixes[0]
            );
        }
        const txidStr = tx.txid().toString('hex');

        if (paymentAck.payment) {
            console.log(`${currency.tokenTicker} txid`, txidStr);
        }

        let link;
        if (process.env.REACT_APP_NETWORK === `mainnet`) {
            link = `${currency.tokenExplorerUrl}/tx/${txidStr}`;
        } else {
            link = `${currency.blockExplorerUrlTestnet}/tx/${txidStr}`;
        }

        //console.log(`link`, link);

        return link;
    };

    const readAuthCode = (authCode) => {
        const authReader = read(Buffer.from(authCode, 'base64'));
        const mintQuantity = authReader.readBytes(8);
        const stampRawOutpoint = authReader.readBytes(36);
        const stampOutpoint = Outpoint.fromRaw(stampRawOutpoint);
        // Auth signature is remaining bytes
        const txAuthSig = authReader.readBytes(authReader.getSize() - authReader.offset);

        return {
            mintQuantity,
            stampOutpoint,
            txAuthSig
        }
    }

    const sendSelfMint = async (
        wallet,
        tokenId, // Buffer
        authCode,
        testOnly = false
    ) => {
        try {
            const tokenIdString = tokenId.toString('hex');
            // Process entered Auth Code string
            const {
                mintQuantity,
                stampOutpoint,
                txAuthSig
            } = readAuthCode(authCode);
            // console.log('stampRawoutpoint', stampRawOutpoint);
            // console.log('txAuthSig', txAuthSig);

            // Get authPubKey for token
            const { pubkey: authPubKey } = authPubKeys.find(authObj => 
                authObj.tokenId == tokenIdString
            );
            // console.log('authKeyBuf', Buffer.from(authPubKey, 'hex'));
            if (!authPubKey)
                throw new Error(`Unsupported self-mint token ID: ${tokenIdString}`);

            // Build Baton Outscript
            const outscript = buildOutScript(
                Buffer.from(authPubKey, 'hex'),
                false
            );
            const outScriptHash = Hash160.digest(outscript.toRaw());
            const p2shPubKeyScript = Script.fromScripthash(outScriptHash);
            const p2shAddress = p2shPubKeyScript.getAddress();

            // Find Baton
            const batonAddrUtxos = await getUtxosBcash([
                p2shAddress.toCashAddr()
            ]);
            const batonUtxo = batonAddrUtxos.find(u => 
                u.slp.tokenId == tokenIdString && u.slp.type == 'BATON'
            );

            // Stub coin/utxo for "stamp" and baton
            const batonCoin = Coin.fromJSON(batonUtxo);

            // Build Stamp Outscript
            const stampOutscript = buildOutScript(
                Buffer.from(authPubKey, 'hex'), 
                true
            );
            const stampOutScriptHash = Hash160.digest(stampOutscript.toRaw());
            const stampP2shPubKeyScript = Script.fromScripthash(stampOutScriptHash);
            const stampUtxo = await getUtxoBcash(
                stampOutpoint.txid().toString('hex'),
                stampOutpoint.index
            )

            if (!stampUtxo)
                throw new Error('Stamp UTXO in auth code is spent or invalid');

            const stampCoin = Coin.fromJSON(stampUtxo);

            const keyring = KeyRing.fromSecret(wallet.Path1899.fundingWif);
            // Construct transaction
            const tx = new TXUtil()
            // Build MINT OP_RETURN
            const mintOpReturn = buildMintOpReturn(tokenId, mintQuantity);
            // Add outputs
            tx.addOutput(mintOpReturn, 0) // SLP mint OP_RETURN
            tx.addOutput(keyring.getAddress(), 546) // Minted tokens
            tx.addOutput(p2shAddress, 546) // Mint baton return
            // Add inputs (must be in this order)
            tx.addCoin(stampCoin) // Input index 0: "stamp"
            tx.addCoin(batonCoin); // Input index 1: existing mint baton

            const sigHashType = Script.hashType.ALL | Script.hashType.SIGHASH_FORKID;
            const flags = Script.flags.STANDARD_VERIFY_FLAGS;

            // Sign TX
            tx.template(keyring); // prepares the template
            // Get the prevout and outputs sequences as they appear in the preimage
            const rawOutputs= tx.outputs.map(output => output.toRaw());
            const outputSeq = Buffer.concat(rawOutputs);
            const rawPrevouts= tx.inputs.map(input => input.prevout.toRaw());
            const prevoutSeq = Buffer.concat(rawPrevouts);
            // Sign The Stamp and Baton
            for (let i = 0; i < 2; i++) {
                const {prevout} = tx.inputs[i];
                const p2shCoin = tx.view.getOutput(prevout);
                const subscript = i == 0 ? stampOutscript : outscript;
                const sig = tx.signature(i, subscript, p2shCoin.value, keyring.privateKey, sigHashType, flags);
                const preimage = tx.getPreimage(i, subscript, p2shCoin.value, sigHashType, false);
                const items = [
                    sig,
                    keyring.getPublicKey(),
                    Buffer.from(preimage.toString('hex'), 'hex'),  
                    txAuthSig,
                    outputSeq,
                    prevoutSeq,
                    subscript.toRaw()
                ];
                tx.inputs[i].script.fromItems(items);
            }

            const hex = tx.toRaw().toString('hex')

            // Verify
            // const mintMsgBuf = Buffer.concat([
            //     stampRawOutpoint,
            //     tx.outputs[0].toRaw(),
            //     tx.outputs[1].toRaw(),
            //     tx.outputs[2].toRaw(),
            // ])
            // console.log('mintMsgBuf', mintMsgBuf);
            // console.log('mintMsgBufHash', SHA256.digest(mintMsgBuf));
            // console.log('checking index 0');
            // const checkBaton = tx.checkInput(0, stampCoin);
            // console.log('checking index 1');
            // const checkStamp = tx.checkInput(1, batonCoin);
            const verified = tx.verify(tx.view);
            
            console.log('verified', verified);
            console.log('tx size', tx.getSize());
            console.log('fee', tx.getFee());
            console.log('tx hex', hex);

            if (!verified)
                throw new Error('Transaction verification failed');
        
            // Broadcast transaction to the network
            let broadcast = {success: true};
            if (!testOnly) {
                broadcast = await broadcastTx(hex);
                if (broadcast.error)
                    throw broadcast.error
            }

            const txidStr = tx.txid().toString('hex')

            if (broadcast.success) {
                console.log(`${currency.tokenTicker} txid`, txidStr);
            }
            let link;
            if (process.env.REACT_APP_NETWORK === `mainnet`) {
                link = `${currency.tokenExplorerUrl}/tx/${txidStr}`;
            } else {
                link = `${currency.blockExplorerUrlTestnet}/tx/${txidStr}`;
            }
            //console.log(`link`, link);

            return link;
        } catch (err) {
            if (err.error === 'insufficient priority (code 66)') {
                err.code = SEND_BCH_ERRORS.INSUFFICIENT_PRIORITY;
            } else if (err.error === 'txn-mempool-conflict (code 18)') {
                err.code = SEND_BCH_ERRORS.DOUBLE_SPENDING;
            } else if (err.error === 'Network Error') {
                err.code = SEND_BCH_ERRORS.NETWORK_ERROR;
            } else if (
                err.error ===
                'too-long-mempool-chain, too many unconfirmed ancestors [limit: 25] (code 64)'
            ) {
                err.code = SEND_BCH_ERRORS.MAX_UNCONFIRMED_TXS;
            }
            console.log(`error: `, err);
            throw err;
        }
    }

    return {
        calcFee,
        getPostage,
        calculatePostage,
        getUtxoBcash,
        getUtxosBcash,
        getSlpBalancesAndUtxosBcash,
        getTxHistoryBcash,
        parseTxData,
        parseTokenInfoForTxHistory,
        getBcashRestUrl,
        signPkMessage,
        sendXec,
        sendToken,
        sendBip70,
        readAuthCode,
        sendSelfMint,
        createToken,
    };
}
