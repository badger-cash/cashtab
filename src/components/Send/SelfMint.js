import React, { useState, useEffect } from 'react';
import { 
    useLocation,
    useHistory
} from 'react-router-dom';
import PropTypes from 'prop-types';
import { WalletContext } from '@utils/context';
import {
    SendBip70Input,
    Bip70AddressSingle,
} from '@components/Common/EnhancedInputs';
import {
    Form,
    Modal,
    Button,
} from 'antd';
import { Row, Col } from 'antd';
import PrimaryButton, {
    SecondaryButton,
} from '@components/Common/PrimaryButton';
import useBCH from '@hooks/useBCH';
import {
    sendXecNotification,
    sendTokenNotification,
    errorNotification,
} from '@components/Common/Notifications';
import {
    currency
} from '@components/Common/Ticker.js';
import { Event } from '@utils/GoogleAnalytics';
import {
    fiatToCrypto,
    shouldRejectAmountInput,
} from '@utils/validation';
import BalanceHeader from '@components/Common/BalanceHeader';
import BalanceHeaderFiat from '@components/Common/BalanceHeaderFiat';
import {
    ZeroBalanceHeader,
    ConvertAmount,
    AlertMsg,
} from '@components/Common/Atoms';
import { 
    getWalletState,
    fromSmallestDenomination
} from '@utils/cashMethods';
import ApiError from '@components/Common/ApiError';
import { formatFiatBalance } from '@utils/validation';
import styled from 'styled-components';
import cashaddr from 'ecashaddrjs';
import { authPubKeys } from '@utils/selfMint';
import { 
    Script,
    script
} from 'bcash';
const { SLP } = script;
import { U64 } from 'n64';

const MemoLabel = styled.div`
    color: purple;
`;

const SelfMint = ({ passLoadingStatus }) => {
    // use balance parameters from wallet.state object and not legacy balances parameter from walletState, if user has migrated wallet
    // this handles edge case of user with old wallet who has not opened latest Cashtab version yet

    // If the wallet object from ContextValue has a `state key`, then check which keys are in the wallet object
    // Else set it as blank
    const ContextValue = React.useContext(WalletContext);
    const location = useLocation();
    const { wallet, fiatPrice, apiError, cashtabSettings } = ContextValue;
    const walletState = getWalletState(wallet);
    const { 
        tokens,
        balances
    } = walletState;
    // Modal settings
    const purchaseTokenIds = [
        '744354f928fa48de87182c4024e2c4acbd3c34f42ce9d679f541213688e584b1'
    ];

    const blankFormData = {
        dirty: true,
        value: '',
        address: '',
    };

    const [formData, setFormData] = useState(blankFormData);
    let tokenFormattedBalance;
    if (formData.token) {
        const token = tokens.find(token => 
            token.tokenId === formData.token.tokenId
        );
        if (token) {
            const tokenBalance = token.balance.toString();
            tokenFormattedBalance = U64.fromString(tokenBalance)
                .divn(10 ** token.info.decimals)
                .toString();
        } else {
            tokenFormattedBalance = '0';
        }
    }
    const [authCodeB64, setAuthCodeB64] = useState(null);
    const [sendBchAddressError, setSendBchAddressError] = useState(false);
    const [sendBchAmountError, setSendBchAmountError] = useState(false);
    const [selectedCurrency, setSelectedCurrency] = useState(currency.ticker);

    // Support cashtab button from web pages
    const [prInfoFromUrl, setPrInfoFromUrl] = useState(false);

    // Show a confirmation modal on transactions created by populating form from web page button
    const [isModalVisible, setIsModalVisible] = useState(false);

    // Show a purchase modal when BUX is requested and insufficient balance
    const [isPurchaseModalVisible, setIsPurchaseModalVisible] = useState(false);
    const [purchaseTokenAmount, setPurchaseTokenAmount] = useState(0);

    const prefixesArray = [
        ...currency.prefixes,
        ...currency.tokenPrefixes
    ]

    const showModal = () => {
        setIsModalVisible(true);
    };

    const handleOk = () => {
        setIsModalVisible(false);
        send();
    };

    const handleCancel = () => {
        setIsModalVisible(false);
    };

    const handlePurchaseOk = () => {
        setIsPurchaseModalVisible(false);
        // Remove anchor hash from url
        const callbackUrl = window.location.href.replace(
            window.location.hash,
            ''
        );
        return window.location.assign(
            `https://bux.digital/?cbxamount=${purchaseTokenAmount.toString()}`
            + `&cbxaddress=${wallet.Path1899.slpAddress}`
            + `&cbxcallback=${encodeURIComponent(callbackUrl)}`
            +`#payment`
        )
    };

    const handlePurchaseCancel = () => {
        setIsPurchaseModalVisible(false);
    };

    const sleep = (ms) => {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    const history = useHistory();

    const { getBcashRestUrl, sendSelfMint } = useBCH();

    // If the balance has changed, unlock the UI
    // This is redundant, if backend has refreshed in 1.75s timeout below, UI will already be unlocked
    useEffect(() => {
        passLoadingStatus(false);
    }, [balances.totalBalance]);

    useEffect(async () => {
        if (!wallet.Path1899)
            return history.push('/wallet');
        passLoadingStatus(true);
        // Manually parse for prInfo object on page load when SendBip70.js is loaded with a query string

        // Do not set prInfo in state if query strings are not present
        if (
            !window.location ||
            !window.location.hash ||
            (window.location.search == '' && window.location.hash === '#/selfMint')
        ) {
            passLoadingStatus(false);
            return;
        }

        const fullQueryString = window.location.search == '' ? 
            window.location.hash : window.location.search;

        const delimiterIndex = fullQueryString.indexOf('?');
        const txInfoArr = fullQueryString
            .slice(delimiterIndex+1)
            .split('&');

        // Iterate over this to create object
        let authCode;
        for (let i = 0; i < txInfoArr.length; i += 1) {
            const delimiterIndex = txInfoArr[i].indexOf('=');
            const param = txInfoArr[i]
                .slice(0, delimiterIndex)
                .toLowerCase();
            const encodedValue = txInfoArr[i].slice(delimiterIndex+1);
            const value = decodeURIComponent(encodedValue);
            if (param === 'mintauth') {
                authCode = value;
            }
        }
        console.log(`authCode`, authCode);
        setAuthCodeB64(authCode)

        passLoadingStatus(false);
    }, [authCodeB64]);

    async function populateFormsFromPaymentDetails(paymentDetails) {
        if (!paymentDetails)
            return;
        const txInfo = {};
        if (paymentDetails.type === 'ecash') {
            const address = Script.fromRaw(
                Buffer.from(paymentDetails.outputs[0].script)
            ).getAddress().toString();
            const totalSats = paymentDetails.outputs.reduce((total, output) => {
                return total + output.value
            }, 0);
            txInfo.address = address;
            txInfo.value = fromSmallestDenomination(totalSats);

        } else if (paymentDetails.type === 'etoken') {
            const cashAddress = Script.fromRaw(
                Buffer.from(paymentDetails.outputs[1].script)
            ).getAddress().toString();
            const decodedAddress = cashaddr.decode(cashAddress);
            const tokenAddress = cashaddr.encode(
            'etoken',
            decodedAddress.type,
            decodedAddress.hash
        )
            const slpScript = SLP.fromRaw(Buffer.from(
                paymentDetails.outputs[0].script
            ));
            // Be sure it is valid SEND
            if (slpScript.isValidSlp() &&
                slpScript.getType() === 'SEND'
            ) {
                const tokenIdBuf = slpScript.getData(4);
                const sendRecords = slpScript.getRecords(tokenIdBuf);
                const totalBase = sendRecords.reduce((total, record) => {
                    return total.add(U64.fromBE(Buffer.from(record.value)));
                }, U64.fromInt(0));

                const tokenInfo = await fetch(
                    `${getBcashRestUrl()}/token/${tokenIdBuf.toString('hex')}`
                ).then(res => res.json());

                txInfo.address = tokenAddress;
                txInfo.value = totalBase
                    .divn(10 ** tokenInfo.decimals)
                    .toString();
                txInfo.token = tokenInfo;
            }
        }
        
        setFormData(txInfo);
    }

    function handleSendXecError(errorObj, ticker) {
        // Set loading to false here as well, as balance may not change depending on where error occured in try loop
        passLoadingStatus(false);
        let message;

        if (!errorObj.error && !errorObj.message) {
            message = `Transaction failed: no response from ${getBcashRestUrl()}.`;
        } else if (
            /Could not communicate with full node or other external service/.test(
                errorObj.error,
            )
        ) {
            message = 'Could not communicate with API. Please try again.';
        } else if (
            errorObj.error &&
            errorObj.error.includes(
                'too-long-mempool-chain, too many unconfirmed ancestors [limit: 50] (code 64)',
            )
        ) {
            message = `The ${currency.ticker} you are trying to send has too many unconfirmed ancestors to send (limit 50). Sending will be possible after a block confirmation. Try again in about 10 minutes.`;
        } else {
            message =
                errorObj.message || errorObj.error || JSON.stringify(errorObj);
        }

        errorNotification(errorObj, message, `Sending ${ticker}`);

    }

    async function send() {
        setFormData({
            ...formData,
            dirty: false,
        });

        // ensure prInfo exists
        if (!authCodeB64) {
            return;
        }

        // TODO: Handle many different tokens
        const tokenId = Buffer.from(
            authPubKeys[0].tokenId,
            'hex'
        );

        // Event("Category", "Action", "Label")
        // Track number of XEC BIP70 transactions
        Event('SelfMint.js', 'SelfMint', authCodeB64);

        passLoadingStatus(true);

        try {
            // Send transaction
            const link = await sendSelfMint(
                wallet,
                tokenId,
                authCodeB64,
                false // testOnly
            );

            sendXecNotification(link);
            // Sleep for 3 seconds and then 
            await sleep(3000);
            // Manually disable loading
            passLoadingStatus(false);
            // String replaceAll case-insensitive
            String.prototype.replaceAll = function(strReplace, strWith) {
                // See http://stackoverflow.com/a/3561711/556609
                var esc = strReplace.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                var reg = new RegExp(esc, 'ig');
                return this.replace(reg, strWith);
            };
            const searchMask = `mintauth=${authCodeB64}`;
            // Remove mintauth parameter and value from url
            window.history.replaceState(
                null, 
                '', 
                window.location.href.replaceAll(searchMask, '')
            );
            return history.push(`/wallet`);
        } catch (e) {
            handleSendXecError(e, authCodeB64);
        }
        
        // Clear the address field
        setFormData(blankFormData);
        // Manually disable loading
        passLoadingStatus(false);
    }

    const handleSelectedCurrencyChange = e => {
        setSelectedCurrency(e);
        // Clear input field to prevent accidentally sending 1 BCH instead of 1 USD
        setFormData(p => ({
            ...p,
            value: '',
        }));
    };

    const handleBchAmountChange = e => {
        const { value, name } = e.target;
        let bchValue = value;
        const error = shouldRejectAmountInput(
            bchValue,
            selectedCurrency,
            fiatPrice,
            balances.totalBalance,
        );
        setSendBchAmountError(error);

        setFormData(p => ({
            ...p,
            [name]: value,
        }));
    };

    const checkSufficientFunds = () => {
        if (formData.token) {
            return Number(tokenFormattedBalance) > Number(formData.value)
        } else if (formData) {
            return Number(balances.totalBalance) > Number(formData.value)
        }
        return false
    }

    // Display price in USD below input field for send amount, if it can be calculated
    let fiatPriceString = '';
    if (fiatPrice !== null && !isNaN(formData.value)) {
        if (selectedCurrency === currency.ticker) {
            // calculate conversion to fiatPrice
            fiatPriceString = `${(fiatPrice * Number(formData.value)).toFixed(
                2,
            )}`;

            // formats to fiat locale style
            fiatPriceString = formatFiatBalance(Number(fiatPriceString));

            // insert symbol and currency before/after the locale formatted fiat balance
            fiatPriceString = `${
                cashtabSettings
                    ? `${
                          currency.fiatCurrencies[cashtabSettings.fiatCurrency]
                              .symbol
                      } `
                    : '$ '
            } ${fiatPriceString} ${
                cashtabSettings && cashtabSettings.fiatCurrency
                    ? cashtabSettings.fiatCurrency.toUpperCase()
                    : 'USD'
            }`;
        } else {
            fiatPriceString = `${
                formData.value
                    ? formatFiatBalance(
                          Number(fiatToCrypto(formData.value, fiatPrice)),
                      )
                    : formatFiatBalance(0)
            } ${currency.ticker}`;
        }
    }

    const priceApiError = fiatPrice === null && selectedCurrency !== 'XEC';

    const displayBalance = tokenFormattedBalance || balances.totalBalance;
    const displayTicker = formData.token?.ticker || currency.ticker;

    return (
        <>
            <Modal
                title="Confirm Send"
                visible={isModalVisible}
                onOk={handleOk}
                onCancel={handleCancel}
            >
                <p>
                    Are you sure you want to send {formData.value}{' '}
                    {displayTicker} to settle this payment request?
                </p>
            </Modal>
            <Modal
                title={`Purchase ${displayTicker}`}
                visible={isPurchaseModalVisible}
                onOk={handlePurchaseOk}
                onCancel={handlePurchaseCancel}
            >
                <p>
                    You have insufficient funds. Do you want to purchase {' '}
                    <strong>{purchaseTokenAmount}{' '}{displayTicker}{' '}</strong>
                    in order to be able to settle this payment request?
                </p>
            </Modal>
            {!checkSufficientFunds() ? (
                <ZeroBalanceHeader>
                    You currently have {displayBalance} {displayTicker}
                    <br />
                    Deposit some funds to use this feature
                </ZeroBalanceHeader>
            ) : (
                <>
                    <BalanceHeader
                        balance={displayBalance}
                        ticker={displayTicker}
                    />
                    {fiatPrice !== null && (
                        <BalanceHeaderFiat
                            balance={balances.totalBalance}
                            settings={cashtabSettings}
                            fiatPrice={fiatPrice}
                        />
                    )}
                </>
            )}

            <Row type="flex">
                <Col span={24}>
                    <Form
                        style={{
                            width: 'auto',
                        }}
                    >
                        {prInfoFromUrl 
                            && prInfoFromUrl.paymentDetails && (
                            <>
                                <Button
                                    type="text"
                                    block
                                >
                                    <MemoLabel>
                                        {prInfoFromUrl.paymentDetails.memo}
                                    </MemoLabel>
                                </Button>
                                <Bip70AddressSingle
                                    validateStatus={
                                        sendBchAddressError ? 'error' : ''
                                    }
                                    help={
                                        sendBchAddressError
                                            ? sendBchAddressError
                                            : ''
                                    }
                                    inputProps={{
                                        placeholder: `${currency.ticker} Address`,
                                        name: 'address',
                                        required: true,
                                        value: formData.address,
                                    }}
                                ></Bip70AddressSingle>
                                <SendBip70Input
                                    activeTokenCode={
                                        formData &&
                                        formData.token
                                            ? formData.token.ticker
                                            : currency.ticker
                                    }
                                    validateStatus={
                                        sendBchAmountError ? 'error' : ''
                                    }
                                    help={
                                        sendBchAmountError
                                            ? sendBchAmountError
                                            : ''
                                    }
                                    inputProps={{
                                        name: 'value',
                                        dollar:
                                            selectedCurrency === 'USD' ? 1 : 0,
                                        placeholder: 'Amount',
                                        onChange: e => handleBchAmountChange(e),
                                        required: true,
                                        value: formData.value,
                                        token: formData.token
                                    }}
                                    selectProps={{
                                        disabled: queryStringText !== null,
                                        onChange: e =>
                                            handleSelectedCurrencyChange(e),
                                    }}
                                ></SendBip70Input>
                                {!formData.token && priceApiError && (

                                    <AlertMsg>
                                        Error fetching fiat price. Setting send
                                        by{' '}
                                        {currency.fiatCurrencies[
                                            cashtabSettings.fiatCurrency
                                        ].slug.toUpperCase()}{' '}
                                        disabled
                                    </AlertMsg>
                                )}
                                {!formData.token && (
                                    <ConvertAmount>
                                        {fiatPriceString !== '' && '='}{' '}
                                        {fiatPriceString}
                                    </ConvertAmount>
                                )}
                            </>
                        )}
                        <div
                            style={{
                                paddingTop: '32px',
                            }}
                        >
                        </div>
                        <div
                            style={{
                                paddingTop: '12px',
                            }}
                        >
                            {!authCodeB64 ? (
                                <SecondaryButton>Mint Tokens</SecondaryButton>
                            ) : (
                                <PrimaryButton
                                    onClick={() => send()}
                                >
                                    Mint Tokens
                                </PrimaryButton>
                            )}
                        </div>
                        {apiError && <ApiError />}
                    </Form>
                </Col>
            </Row>
        </>
    );
};

/*
passLoadingStatus must receive a default prop that is a function
in order to pass the rendering unit test in SendBip70.test.js

status => {console.log(status)} is an arbitrary stub function
*/

SelfMint.defaultProps = {
    passLoadingStatus: status => {
        console.log(status);
    },
};

SelfMint.propTypes = {
    passLoadingStatus: PropTypes.func,
};

export default SelfMint;
