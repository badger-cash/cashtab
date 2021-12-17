// @generated

export const walletWithoutStateMock = {
    wallet: {
        name: 'MigrationTestAlpha',
        Path245: {
            cashAddress:
                'ecash:qztqe8k4v8ckn8cvfxt5659nhd7dcyvxy5v6zglsrs',
            slpAddress:
                'etoken:qztqe8k4v8ckn8cvfxt5659nhd7dcyvxy5zyt2fh88',
            fundingWif: 'KwgNkyijAaxFr5XQdnaYyNMXVSZobgHzSoKKfWiC3Q7Xr4n7iYMG',
            fundingAddress:
                'etoken:qztqe8k4v8ckn8cvfxt5659nhd7dcyvxy5zyt2fh88',
            legacyAddress: '1EgPUfBgU7ekho3EjtGze87dRADnUE8ojP',
        },
        Path145: {
            cashAddress:
                'ecash:qq47pcxfn8n7w7jy86njd7pvgsv39l9f9vkjud0qr4',
            slpAddress:
                'etoken:qq47pcxfn8n7w7jy86njd7pvgsv39l9f9vcv40e88z',
            fundingWif: 'L2xvTe6CdNxroR6pbdpGWNjAa55AZX5Wm59W5TXMuH31ihNJdDjt',
            fundingAddress:
                'etoken:qq47pcxfn8n7w7jy86njd7pvgsv39l9f9vcv40e88z',
            legacyAddress: '1511T3ynXKgCwXhFijCUWKuTfqbPxFV1AF',
        },
        Path1899: {
            cashAddress:
                'ecash:qzagy47mvh6qxkvcn3acjnz73rkhkc6y7ccxkrr6zd',
            slpAddress:
                'etoken:qzagy47mvh6qxkvcn3acjnz73rkhkc6y7ckclp4ax6',
            fundingWif: 'Kx4FiBMvKK1iXjFk5QTaAK6E4mDGPjmwDZ2HDKGUZpE4gCXMaPe9',
            fundingAddress:
                'etoken:qzagy47mvh6qxkvcn3acjnz73rkhkc6y7ckclp4ax6',
            legacyAddress: '1J1Aq5tAAYxZgSDRo8soKM2Rb41z3xrYpm',
        },
    },
    loading: false,
};

export const walletWithBalancesAndTokensWithCorrectState = {
    wallet: {
        name: 'MigrationTestAlpha',
        Path245: {
            cashAddress:
                'ecash:qztqe8k4v8ckn8cvfxt5659nhd7dcyvxy5v6zglsrs',
            slpAddress:
                'etoken:qztqe8k4v8ckn8cvfxt5659nhd7dcyvxy5zyt2fh88',
            fundingWif: 'KwgNkyijAaxFr5XQdnaYyNMXVSZobgHzSoKKfWiC3Q7Xr4n7iYMG',
            fundingAddress:
                'etoken:qztqe8k4v8ckn8cvfxt5659nhd7dcyvxy5zyt2fh88',
            legacyAddress: '1EgPUfBgU7ekho3EjtGze87dRADnUE8ojP',
        },
        Path145: {
            cashAddress:
                'ecash:qq47pcxfn8n7w7jy86njd7pvgsv39l9f9vkjud0qr4',
            slpAddress:
                'etoken:qq47pcxfn8n7w7jy86njd7pvgsv39l9f9vcv40e88z',
            fundingWif: 'L2xvTe6CdNxroR6pbdpGWNjAa55AZX5Wm59W5TXMuH31ihNJdDjt',
            fundingAddress:
                'etoken:qq47pcxfn8n7w7jy86njd7pvgsv39l9f9vcv40e88z',
            legacyAddress: '1511T3ynXKgCwXhFijCUWKuTfqbPxFV1AF',
        },
        Path1899: {
            cashAddress:
                'ecash:qzagy47mvh6qxkvcn3acjnz73rkhkc6y7ccxkrr6zd',
            slpAddress:
                'etoken:qzagy47mvh6qxkvcn3acjnz73rkhkc6y7ckclp4ax6',
            fundingWif: 'Kx4FiBMvKK1iXjFk5QTaAK6E4mDGPjmwDZ2HDKGUZpE4gCXMaPe9',
            fundingAddress:
                'etoken:qzagy47mvh6qxkvcn3acjnz73rkhkc6y7ckclp4ax6',
            legacyAddress: '1J1Aq5tAAYxZgSDRo8soKM2Rb41z3xrYpm',
        },
        state: {
            balances: {
                totalBalanceInSatoshis: 6047469,
                totalBalance: 0.06047469,
            },
            tokens: [
                {
                    info: {
                        decimals: 9,
                        hash: '',
                        tokenId:
                            'bd1acc4c986de57af8d6d2a64aecad8c30ee80f37ae9d066d758923732ddc9ba',
                        ticker: 'TBS',
                        name: 'TestBits',
                        uri: 'https://thecryptoguy.com/',
                        tokenDocumentHash: '',
                    },
                    tokenId:
                        'bd1acc4c986de57af8d6d2a64aecad8c30ee80f37ae9d066d758923732ddc9ba',
                    balance: '6.001',
                    hasBaton: false,
                },
            ],
            slpBalancesAndUtxos: {
                slpUtxos: [
                    {
                        version: 1,
                        height: 718101,
                        value: 546,
                        script: "76a914ba8257db65f40359989c7b894c5e88ed7b6344f688ac",
                        address: "ecash:qzagy47mvh6qxkvcn3acjnz73rkhkc6y7ccxkrr6zd",
                        coinbase: false,
                        hash: "7628ef0325f84a4de1d745fd934b6fd7c620dbb481062df2b2f0f8f316e73577",
                        index: 1,
                        slp: {
                            vout: 1,
                            tokenId: "7628ef0325f84a4de1d745fd934b6fd7c620dbb481062df2b2f0f8f316e73577",
                            value: "999",
                            type: "GENESIS"
                      }
                    }
                ],
                nonSlpUtxos: [
                    {
                        version: 1,
                        height: 718101,
                        value: 120000,
                        script: "76a914ba8257db65f40359989c7b894c5e88ed7b6344f688ac",
                        address: "ecash:qzagy47mvh6qxkvcn3acjnz73rkhkc6y7ccxkrr6zd",
                        coinbase: false,
                        hash: "7628ef0325f84a4de1d745fd934b6fd7c620dbb481062df2b2f0f8f316e73577",
                        index: 2,
                    },
                    {
                        version: 1,
                        height: 718101,
                        value: 700,
                        script: "76a914ba8257db65f40359989c7b894c5e88ed7b6344f688ac",
                        address: "ecash:qzagy47mvh6qxkvcn3acjnz73rkhkc6y7ccxkrr6zd",
                        coinbase: false,
                        hash: "1628ef0325f84a4de1d745fd934b6fd7c620dbb481062df2b2f0f8f316e73577",
                        index: 1,
                    }
                ]
            },
            utxos: [
                {
                    version: 1,
                    height: 718101,
                    value: 120000,
                    script: "76a914ba8257db65f40359989c7b894c5e88ed7b6344f688ac",
                    address: "ecash:qzagy47mvh6qxkvcn3acjnz73rkhkc6y7ccxkrr6zd",
                    coinbase: false,
                    hash: "7628ef0325f84a4de1d745fd934b6fd7c620dbb481062df2b2f0f8f316e73577",
                    index: 2,
                },
                {
                    version: 1,
                    height: 718101,
                    value: 700,
                    script: "76a914ba8257db65f40359989c7b894c5e88ed7b6344f688ac",
                    address: "ecash:qzagy47mvh6qxkvcn3acjnz73rkhkc6y7ccxkrr6zd",
                    coinbase: false,
                    hash: "1628ef0325f84a4de1d745fd934b6fd7c620dbb481062df2b2f0f8f316e73577",
                    index: 1,
                },
                {
                    version: 1,
                    height: 718101,
                    value: 546,
                    script: "76a914ba8257db65f40359989c7b894c5e88ed7b6344f688ac",
                    address: "ecash:qzagy47mvh6qxkvcn3acjnz73rkhkc6y7ccxkrr6zd",
                    coinbase: false,
                    hash: "7628ef0325f84a4de1d745fd934b6fd7c620dbb481062df2b2f0f8f316e73577",
                    index: 1,
                    slp: {
                        vout: 1,
                        tokenId: "7628ef0325f84a4de1d745fd934b6fd7c620dbb481062df2b2f0f8f316e73577",
                        value: "999",
                        type: "GENESIS"
                  }
                }
            ],
            parsedTxHistory: [],
        },
    },
    loading: false,
};

export const addressArray = [
    'ecash:qztqe8k4v8ckn8cvfxt5659nhd7dcyvxy5v6zglsrs', 
    'ecash:qq47pcxfn8n7w7jy86njd7pvgsv39l9f9vkjud0qr4',
    'ecash:qzagy47mvh6qxkvcn3acjnz73rkhkc6y7ccxkrr6zd'
];
