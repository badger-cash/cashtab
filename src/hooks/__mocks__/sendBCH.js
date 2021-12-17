import { fromSmallestDenomination } from '@utils/cashMethods';
import { currency } from '@components/Common/Ticker';

export default {
    utxos: [
        {
            version: 1,
            coinbase: false,
            height: -1,
            hash:
                '6e83b4bf54b5a85b6c40c4e2076a6e3945b86e4d219a931d0eb93ba1a1e3bd6f',
            index: 1,
            value: 131689,
            script: '76a914c5c649ec64e02a16a5bd7a6c8f1fa5aaa7e488eb88ac',
            address: 'ecash:qrzuvj0vvnsz5949h4axercl5k420eygav4zf9ncfr',
        },
    ],
    wallet: {
        Path145: {
            cashAddress:
                'ecash:qrzuvj0vvnsz5949h4axercl5k420eygav4zf9ncfr',
            fundingWif:
                'L3ufcMjHZ2u8v2NeyHB2pCSE5ezCk8dvR7kcLLX2B3xK5VgK9wz4'
        },
        Path245: {
            cashAddress:
                'ecash:qrzuvj0vvnsz5949h4axercl5k420eygav4zf9ncfr',
            fundingWif:
                'L3ufcMjHZ2u8v2NeyHB2pCSE5ezCk8dvR7kcLLX2B3xK5VgK9wz4'
        },
        Path1899: {
            cashAddress:
                'ecash:qrzuvj0vvnsz5949h4axercl5k420eygav4zf9ncfr',
            fundingWif:
                'L3ufcMjHZ2u8v2NeyHB2pCSE5ezCk8dvR7kcLLX2B3xK5VgK9wz4'
        },
    },
    destinationAddress:
        'ecash:qr2npxqwznhp7gphatcqzexeclx0hhwdxgg2wjetuy',
    sendAmount: fromSmallestDenomination(currency.dustSats).toString(),
    expectedTxId:
        '4582ef5cf6f95be9e0010ff16fc12142889e79e6d7c6e358ed00e93bc51d9f0b',
    expectedTxIdMulti:
        '1ccf7f9c1d128d40d5d91165c8678ebabf79c659d29389c17dd4d20566e97848',
    expectedHex: [
        '02000000016fbde3a1a13bb90e1d939a214d6eb845396e6a07e2c4406c5ba8b554bfb4836e010000006a473044022014213502b672599a965f03a91c4aecb789ed15e758ba6594426572ed2ff20ef202201137053f16b9f1b796076ebe6e4755304f3be5df96bb181aaf9f70ad229291bb4121032d9ea429b4782e9a2c18a383362c23a44efa2f6d6641d63f53788b4bf45c1decffffffff0226020000000000001976a914d530980e14ee1f2037eaf00164d9c7ccfbddcd3288ac7cfe0100000000001976a914c5c649ec64e02a16a5bd7a6c8f1fa5aaa7e488eb88ac00000000',
    ],
    testOnly: true
};
