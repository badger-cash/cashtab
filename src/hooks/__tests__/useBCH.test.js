/* eslint-disable no-native-reassign */
import useBCH from '../useBCH';
import mockReturnGetHydratedUtxoDetails from '../__mocks__/mockReturnGetHydratedUtxoDetails';
import mockReturnGetSlpBalancesAndUtxos from '../__mocks__/mockReturnGetSlpBalancesAndUtxos';
import mockReturnGetHydratedUtxoDetailsWithZeroBalance from '../__mocks__/mockReturnGetHydratedUtxoDetailsWithZeroBalance';
import mockReturnGetSlpBalancesAndUtxosNoZeroBalance from '../__mocks__/mockReturnGetSlpBalancesAndUtxosNoZeroBalance';
import sendBCHMock from '../__mocks__/sendBCH';
import createTokenMock from '../__mocks__/createToken';
import mockTxHistory from '../__mocks__/mockTxHistory';
import mockFlatTxHistory from '../__mocks__/mockFlatTxHistory';
import mockTxDataWithPassthrough from '../__mocks__/mockTxDataWithPassthrough';
import {
    tokenSendWdt,
    tokenReceiveGarmonbozia,
    tokenReceiveTBS,
    tokenGenesisCashtabMintAlpha,
} from '../__mocks__/mockParseTokenInfoForTxHistory';
import {
    mockSentCashTx,
    mockReceivedCashTx,
    mockSentTokenTx,
    mockReceivedTokenTx,
    mockSentOpReturnMessageTx,
    mockReceivedOpReturnMessageTx,
} from '../__mocks__/mockParsedTxs';
import { 
    walletWithBalancesAndTokensWithCorrectState,
    addressArray
} from '../../components/Wallet/__mocks__/walletAndBalancesMock';
import { currency } from '../../components/Common/Ticker';
import BigNumber from 'bignumber.js';
import { fromSmallestDenomination } from '@utils/cashMethods';

describe('useBCH hook', () => {
    it('gets Rest Api Url on testnet', () => {
        process = {
            env: {
                REACT_APP_NETWORK: `testnet`,
                REACT_APP_BCASH_API:'https://ecashtest.badger.cash:8332',
            },
        };
        const { getBcashRestUrl } = useBCH();
        const expectedApiUrl = `https://ecashtest.badger.cash:8332`;
        expect(getBcashRestUrl()).toBe(expectedApiUrl);
    });

    it('gets primary Rest API URL on mainnet', () => {
        process = {
            env: {
                REACT_APP_BCASH_API:'https://ecash.badger.cash:8332',
                REACT_APP_NETWORK: 'mainnet',
            },
        };
        const { getBcashRestUrl } = useBCH();
        const expectedApiUrl = `https://ecash.badger.cash:8332`;
        expect(getBcashRestUrl()).toBe(expectedApiUrl);
    });

    it('calculates fee correctly for 2 P2PKH outputs', () => {
        const { calcFee } = useBCH();
        const utxosMock = [{}, {}];

        expect(calcFee(utxosMock, 2, 1.01)).toBe(378);
    });

    it('sends XEC correctly', async () => {
        const { sendXec } = useBCH();
        const wallet = walletWithBalancesAndTokensWithCorrectState.wallet
        const {
            expectedTxId,
            destinationAddress,
            sendAmount,
            testOnly
        } = sendBCHMock;

        expect(
            await sendXec(
                wallet,
                currency.defaultFee,
                '',
                false,
                null,
                destinationAddress,
                sendAmount,
                testOnly
            ),
        ).toBe(`${currency.blockExplorerUrl}/tx/${expectedTxId}`);
    });

    it('sends one to many XEC correctly', async () => {
        const { sendXec } = useBCH();
        const wallet = walletWithBalancesAndTokensWithCorrectState.wallet
        const {
            expectedTxIdMulti,
            testOnly
        } = sendBCHMock;

        const addressAndValueArray = [
            'ecash:qrzuvj0vvnsz5949h4axercl5k420eygav4zf9ncfr,6',
            'ecash:qrzuvj0vvnsz5949h4axercl5k420eygav4zf9ncfr,6.8',
            'ecash:qrzuvj0vvnsz5949h4axercl5k420eygav4zf9ncfr,7',
            'ecash:qrzuvj0vvnsz5949h4axercl5k420eygav4zf9ncfr,6',
        ];

        expect(
            await sendXec(
                wallet,
                currency.defaultFee,
                '',
                true,
                addressAndValueArray,
                null,
                null,
                testOnly
            ),
        ).toBe(`${currency.blockExplorerUrl}/tx/${expectedTxIdMulti}`);
    });

    // TODO: The following two tests are problematic. They pass on their own, but when included will cause
    // the createToken test to fail with a strange error. Could have to do with the way the errors are
    // being handled

    // it(`Throws error if called trying to send one base unit ${currency.ticker} more than available in utxo set`, async () => {
    //     const { sendXec } = useBCH();
    //     const wallet = JSON.parse(
    //         JSON.stringify(walletWithBalancesAndTokensWithCorrectState.wallet)
    //     );
    //     const singleUtxo = wallet.state.slpBalancesAndUtxos.nonSlpUtxos[0]
    //     wallet.state.slpBalancesAndUtxos = {
    //         utxos: [singleUtxo],
    //         nonSlpUtxos: [singleUtxo],
    //         slpUtxos: []
    //     }
    //     const { 
    //         utxos,
    //         destinationAddress,
    //         testOnly
    //     } = sendBCHMock;

    //     const expectedTxFeeInSats = 229;

    //     const oneBaseUnitMoreThanBalance = new BigNumber(utxos[0].value)
    //         .minus(expectedTxFeeInSats)
    //         .plus(1)
    //         .div(10 ** currency.cashDecimals)
    //         .toString();

    //     const failedSendBch = sendXec(
    //         wallet,
    //         currency.defaultFee,
    //         '',
    //         false,
    //         null,
    //         destinationAddress,
    //         oneBaseUnitMoreThanBalance,
    //         testOnly
    //     );
    //     expect(failedSendBch).rejects.toThrow(new Error('Insufficient funds'));
    //     const nullValuesSendBch = await sendXec(
    //         wallet,
    //         currency.defaultFee,
    //         '',
    //         false,
    //         null,
    //         destinationAddress,
    //         null,
    //         testOnly
    //     );
    //     expect(nullValuesSendBch).toBe(null);
    // });

    // it('Throws error on attempt to send one satoshi less than backend dust limit', async () => {
    //     const { sendXec } = useBCH();
    //     const wallet = JSON.parse(
    //         JSON.stringify(walletWithBalancesAndTokensWithCorrectState.wallet)
    //     );
    //     const singleUtxo = wallet.state.slpBalancesAndUtxos.nonSlpUtxos[0]
    //     wallet.state.slpBalancesAndUtxos = {
    //         utxos: [singleUtxo],
    //         nonSlpUtxos: [singleUtxo],
    //         slpUtxos: []
    //     }
    //     const {
    //         destinationAddress,
    //         testOnly
    //     } = sendBCHMock;

    //     const failedSendBch = sendXec(
    //         wallet,
    //         currency.defaultFee,
    //         '',
    //         false,
    //         null,
    //         destinationAddress,
    //         new BigNumber(
    //             fromSmallestDenomination(currency.dustSats).toString(),
    //         )
    //             .minus(new BigNumber('0.00000001'))
    //             .toString(),
    //         testOnly
    //     );
    //     expect(failedSendBch).rejects.toThrow(new Error('dust'));
    //     const nullValuesSendBch = await sendXec(
    //         wallet,
    //         currency.defaultFee,
    //         '',
    //         false,
    //         null,
    //         destinationAddress,
    //         null,
    //         testOnly
    //     );
    //     expect(nullValuesSendBch).toBe(null);
    // });

    it('Creates a token correctly', async () => {
        const { createToken } = useBCH();
        const wallet = walletWithBalancesAndTokensWithCorrectState.wallet;
        const { 
            expectedTxId, 
            configObj,
            testOnly
        } = createTokenMock;

        expect(await createToken(wallet, 5.01, configObj, testOnly)).toBe(
            `${currency.tokenExplorerUrl}/tx/${expectedTxId}`,
        );
    });

    it('Throws correct error if user attempts to create a token with an invalid wallet', async () => {
        const { createToken } = useBCH();
        const { 
            invalidWallet, 
            configObj, 
            testOnly 
        } = createTokenMock;

        const invalidWalletTokenCreation = createToken(
            invalidWallet,
            currency.defaultFee,
            configObj,
            testOnly
        );
        await expect(invalidWalletTokenCreation).rejects.toThrow(
            new Error('Invalid wallet'),
        );
    });

    it(`Correctly parses a "send ${currency.ticker}" transaction`, () => {
        const { parseTxData } = useBCH();
        expect(parseTxData(
            walletWithBalancesAndTokensWithCorrectState.wallet, 
            [mockTxDataWithPassthrough[0]])
            ).toStrictEqual(mockSentCashTx,);
    });

    it(`Correctly parses a "receive ${currency.ticker}" transaction`, () => {
        const { parseTxData } = useBCH();
        expect(parseTxData(
            walletWithBalancesAndTokensWithCorrectState.wallet, 
            [mockTxDataWithPassthrough[5]])
            ).toStrictEqual(mockReceivedCashTx,);
    });

    it(`Correctly parses a "send ${currency.tokenTicker}" transaction`, () => {
        const { parseTxData } = useBCH();
        expect(parseTxData(
            walletWithBalancesAndTokensWithCorrectState.wallet, 
            [mockTxDataWithPassthrough[1]])
            ).toStrictEqual(mockSentTokenTx,);
    });

    it(`Correctly parses a "receive ${currency.tokenTicker}" transaction`, () => {
        const { parseTxData } = useBCH();
        expect(parseTxData(
            walletWithBalancesAndTokensWithCorrectState.wallet, 
            [mockTxDataWithPassthrough[3]])
        ).toStrictEqual(mockReceivedTokenTx,);
    });

    it(`Correctly parses a "send ${currency.tokenTicker}" transaction with token details`, () => {
        const { parseTokenInfoForTxHistory } = useBCH();
        expect(
            parseTokenInfoForTxHistory(
                mockTxDataWithPassthrough[1],
                addressArray,
            ),
        ).toStrictEqual(mockSentTokenTx[0].tokenInfo);
    });

    it(`Correctly parses a "receive ${currency.tokenTicker}" transaction with token details and 9 decimals of precision`, () => {
        const { parseTokenInfoForTxHistory } = useBCH();
        expect(
            parseTokenInfoForTxHistory(
                mockTxDataWithPassthrough[3],
                addressArray,
            ),
        ).toStrictEqual(mockReceivedTokenTx[0].tokenInfo);
    });

    it(`Correctly parses a "GENESIS ${currency.tokenTicker}" transaction with token details`, () => {
        const { parseTokenInfoForTxHistory } = useBCH();
        expect(
            parseTokenInfoForTxHistory(
                mockTxDataWithPassthrough[12],
                addressArray,
            ),
        ).toStrictEqual(tokenGenesisCashtabMintAlpha.tokenInfo);
    });

    it(`Correctly parses a "send ${currency.ticker}" transaction with an OP_RETURN message`, () => {
        const { parseTxData } = useBCH();
        expect(parseTxData(
            walletWithBalancesAndTokensWithCorrectState.wallet,
            [mockTxDataWithPassthrough[10]])
            ).toStrictEqual(mockSentOpReturnMessageTx,);
    });

    it(`Correctly parses a "receive ${currency.ticker}" transaction with an OP_RETURN message`, () => {
        const { parseTxData } = useBCH();
        expect(parseTxData(
            walletWithBalancesAndTokensWithCorrectState.wallet, 
            [mockTxDataWithPassthrough[11]])
        ).toStrictEqual(mockReceivedOpReturnMessageTx,);
    });
});
