// Expected result of applying parseTxData to mockTxDataWityhPassthrough[0]
export const mockSentCashTx = [
    {
        amountReceived: 0,
        amountSent: 60434.36,
        blocktime: 1609947472,
        confirmations: 50347,
        destinationAddress: 'ecash:qrcl220pxeec78vnchwyh6fsdyf60uv9tca7668slm',
        height: 667749,
        outgoingTx: true,
        isCashtabMessage: false,
        opReturnMessage: '',
        replyAddress: 'ecash:qzagy47mvh6qxkvcn3acjnz73rkhkc6y7ccxkrr6zd',
        tokenTx: false,
        txid: '3642216be898b672253033a1466c3a5f776a4f7842c21180dd7e56a143bd0b2d',
    },
];

export const mockReceivedCashTx = [
    {
        amountReceived: 60532.69,
        amountSent: 0,
        blocktime: 1609438936,
        confirmations: 51123,
        destinationAddress:
            'ecash:qq47pcxfn8n7w7jy86njd7pvgsv39l9f9vkjud0qr4',
        height: 666975,
        outgoingTx: false,
        isCashtabMessage: false,
        opReturnMessage: '',
        replyAddress: 'ecash:qppc593r2hhksvrz5l77n5yd6usrj74waq2ddsngw7',
        tokenTx: false,
        txid: 'fb8a741c55971abc52879ca5ea26586ecda6cecd80f74492483c922bc2b02dc0',
    },
];

export const mockSentTokenTx = [
    {
        amountReceived: 0,
        amountSent: 5.46,
        blocktime: 1609447983,
        confirmations: 51111,
        destinationAddress:
            'ecash:qpv9fx6mjdpgltygudnpw3tvmxdyzx7savwvrqe2gt',
        height: 666987,
        outgoingTx: true,
        isCashtabMessage: false,
        opReturnMessage: '',
        replyAddress: 'ecash:qq47pcxfn8n7w7jy86njd7pvgsv39l9f9vkjud0qr4',
        tokenInfo: {
            qtyReceived: "0",
            qtySent: "0.004",
            tokenId: "bd1acc4c986de57af8d6d2a64aecad8c30ee80f37ae9d066d758923732ddc9ba",
            tokenName: "TestBits",
            tokenTicker: "TBS",
            transactionType: "SEND",
        },
        tokenTx: true,
        txid: '535201eddeb2366f8e1477b653c6cf766680a1bb33eccd5587dcb240e08c7268',
    },
];
export const mockReceivedTokenTx = [
    {
        amountReceived: 5.46,
        amountSent: 0,
        blocktime: 1609949058,
        confirmations: 50348,
        destinationAddress:
            'ecash:qztqe8k4v8ckn8cvfxt5659nhd7dcyvxy5v6zglsrs',
        height: 667750,
        outgoingTx: false,
        isCashtabMessage: false,
        opReturnMessage: '',
        replyAddress: 'ecash:qrcl220pxeec78vnchwyh6fsdyf60uv9tca7668slm',
        tokenInfo: {
            qtyReceived: "1e-9",
            qtySent: "0",
            tokenId: "bfddfcfc9fb9a8d61ed74fa94b5e32ccc03305797eea461658303df5805578ef",
            tokenName: "Sending Token",
            tokenTicker: "Sending Token",
            transactionType: "SEND",
        },
        tokenTx: true,
        txid: 'a0058a66a161c4b72bd39da75baaf58f59dda6208cfa425428b7934b12ba4bca',
    },
];
export const mockSentOpReturnMessageTx = [
    {
        amountReceived: 0,
        amountSent: 5.46,
        blocktime: 0,
        confirmations: 0,
        destinationAddress: 'ecash:qqvgh4xmdxzurr4zkn9ke4vpxphj95t0gsgsc0dyaz',
        height: -1,
        opReturnMessage: new Buffer('cashtabular'),
        replyAddress: 'ecash:qzagy47mvh6qxkvcn3acjnz73rkhkc6y7ccxkrr6zd',
        outgoingTx: true,
        tokenTx: false,
        isCashtabMessage: true,
        txid: '4f8f6f9361b29cf7f9f2770e64a019570100669ce8fca865852e9182433ad414',
    },
];
export const mockReceivedOpReturnMessageTx = [
    {
        amountReceived: 20,
        amountSent: 0,
        blocktime: 0,
        confirmations: 0,
        destinationAddress: 'ecash:qzagy47mvh6qxkvcn3acjnz73rkhkc6y7ccxkrr6zd',
        height: -1,
        opReturnMessage: new Buffer('bingoelectrum'),
        replyAddress: 'ecash:qzjf2lmefpad60axlh3mysgtryw0fw2vhvafhgzysd',
        outgoingTx: false,
        tokenTx: false,
        isCashtabMessage: false,
        txid: 'df9865b5da263a9930e915dda09a4b0638007533ee483a35535bce970795655d',
    },
];
