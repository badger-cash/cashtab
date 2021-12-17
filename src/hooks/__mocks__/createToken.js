// @generated
export default {
    invalidWallet: {},
    wallet: {
        Path1899: {
            cashAddress:
                'ecash:qpuvjl7l3crt3apc62gmtf49pfsluu7s9gf5j6mf3y',
            slpAddress:
                'etoken:qpuvjl7l3crt3apc62gmtf49pfsluu7s9g82mcdw4n',
            fundingWif: 'L2gH81AegmBdnvEZuUpnd3robG8NjBaVjPddWrVD4169wS6Mqyxn',
            fundingAddress:
                'etoken:qpuvjl7l3crt3apc62gmtf49pfsluu7s9g82mcdw4n',
            legacyAddress: '1C1fUT99KT4SjbKjCE2fSCdhc6Bvj5gQjG',
        },
        tokens: [],
        state: {
            balances: [],
            utxos: [],
            hydratedUtxoDetails: [],
            tokens: [],
            slpBalancesAndUtxos: {
                nonSlpUtxos: [
                    {
                        height: 0,
                        value: 1000000,
                        hash: 'e0d6d7d46d5fc6aaa4512a7aca9223c6d7ca30b8253dee1b40b8978fe7dc501e',
                        index: 0,
                        coinbase: false,
                        script: '76a91478c97fdf8e06b8f438d291b5a6a50a61fe73d02a88ac',
                        address:
                            'ecash:qpuvjl7l3crt3apc62gmtf49pfsluu7s9gf5j6mf3y',
                    },
                ],
            },
        },
    },
    configObj: {
        name: 'Cashtab Unit Test Token',
        ticker: 'CUTT',
        documentUrl: 'https://cashtabapp.com/',
        decimals: '2',
        initialQty: '100',
        documentHash: '',
        mintBatonVout: null,
    },
    expectedTxId:
        'ce8f4752f02e641aababc50ff544e4e0cba3787257653f4428013f028162979e',
    expectedHex: [
        '02000000011e50dce78f97b8401bee3d25b830cad7c62392ca7a2a51a4aac65f6dd4d7d6e0000000006a4730440220776cbcaaf918e1924f60ee650143de82d6ae02cd3def3897bf763f00ec7dacff02204b918ca0bce2c3c601bc3ebff7175889f28934405f06728451e48ad0d908a8e1412102322fe90c5255fe37ab321c386f9446a86e80c3940701d430f22325094fdcec60ffffffff030000000000000000546a04534c500001010747454e455349530443555454174361736874616220556e6974205465737420546f6b656e1768747470733a2f2f636173687461626170702e636f6d2f4c0001024c0008000000000000271022020000000000001976a91478c97fdf8e06b8f438d291b5a6a50a61fe73d02a88ac073b0f00000000001976a91478c97fdf8e06b8f438d291b5a6a50a61fe73d02a88ac00000000',
    ],
};
