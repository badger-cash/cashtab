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
import { getUrlFromQueryString } from '@utils/bip70';
import { getPaymentRequest } from '../../utils/bip70';
import { 
    Script,
    script
} from 'bcash';
const { SLP } = script;
import { U64 } from 'n64';

const MemoLabel = styled.div`
    color: purple;
`;

const SendBip70 = ({ passLoadingStatus }) => {
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
        '7e7dacd72dcdb14e00a03dd3aff47f019ed51a6f1f4e4f532ae50692f62bc4e5'
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
            tokenFormattedBalance = (tokenBalance / (10 ** token.info.decimals))
                .toString();
        } else {
            tokenFormattedBalance = '0';
        }
    }
    const [queryStringText, setQueryStringText] = useState(null);
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

    // Postage Protocol Check (for BURN)
    const [postageData, setPostageData] = useState(null);
    const [usePostage, setUsePostage] = useState(false);

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

    const { 
        getBcashRestUrl, 
        sendBip70,
        getPostage 
    } = useBCH();

    // If the balance has changed, unlock the UI
    // This is redundant, if backend has refreshed in 1.75s timeout below, UI will already be unlocked
    useEffect(() => {
        passLoadingStatus(false);
    }, [balances.totalBalance]);

    useEffect(() => {
        // Check to see if purchase modal should be shown
        if (formData.token) {
            const difference = (Number(tokenFormattedBalance) - Number(formData.value))
                .toFixed(formData.token.decimals);
            if (purchaseTokenIds.includes(formData.token?.tokenId)) {
                // Set purchase modal visible and set amount to purchase
                setIsPurchaseModalVisible(difference < 0);
                const purchaseAmount = difference < 0 ? Math.abs(difference) : 0
                setPurchaseTokenAmount(purchaseAmount);
            }
        }
    }, [tokenFormattedBalance]);

    useEffect(async () => {
        if (!wallet.Path1899)
            return history.push('/wallet');
        passLoadingStatus(true);
        // Manually parse for prInfo object on page load when SendBip70.js is loaded with a query string

        // Do not set prInfo in state if query strings are not present
        if (
            !window.location ||
            !window.location.hash ||
            (window.location.search == '' && window.location.hash === '#/sendBip70')
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
        const prInfo = {};
        for (let i = 0; i < txInfoArr.length; i += 1) {
            const delimiterIndex = txInfoArr[i].indexOf('=');
            const param = txInfoArr[i]
                .slice(0, delimiterIndex)
                .toLowerCase();
            // Forward to selfMint if auth code is specified
            if (param == 'mintauth') {
                console.log('has mintauth')
                return history.push('/selfMint');
            }

            const encodedValue = txInfoArr[i].slice(delimiterIndex+1);
            const value = decodeURIComponent(encodedValue);
            const prefix = value.split(':')[0];
            if (param === 'uri' && prefixesArray.includes(prefix)) {
                const queryString = value.split('?')[1];
                const url = getUrlFromQueryString(queryString);
                if (url) {
                    prInfo.type = prefix.toLowerCase();
                    prInfo.url = url;
                }
            }
        }
        console.log(`prInfo from page params`, prInfo);
        if (prInfo.url && prInfo.type) {
            try {
                prInfo.paymentDetails = (await getPaymentRequest(
                    prInfo.url, 
                    prInfo.type
                )).paymentDetails;
            } catch (err) {
                return errorNotification(err, 
                    'Failed to fetch invoice. May be expired or invalid', 
                    `Fetching invoice: ${prInfo.url}`
                );
            }
        }
        setPrInfoFromUrl(prInfo);
        prInfo.paymentDetails.type = prInfo.type;
        await populateFormsFromPaymentDetails(prInfo.paymentDetails);

        passLoadingStatus(false);
    }, []);

    async function populateFormsFromPaymentDetails(paymentDetails) {
        if (!paymentDetails)
            return;
        const txInfo = {};
        // Define postage object in case of BURN
        let postageObj;
        // Begin parsing BIP70 Payment Request
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
            const slpScript = SLP.fromRaw(Buffer.from(
                paymentDetails.outputs[0].script
            ));
            // Be sure it is valid SLP transaction
            if (slpScript.isValidSlp()) {
                const tokenIdBuf = slpScript.getData(4);
                // Handle SEND and BURN
                let tokenAddress;
                let sendRecords;
                if (slpScript.getType() === 'SEND') {
                    const cashAddress = Script.fromRaw(
                        Buffer.from(paymentDetails.outputs[1].script)
                    ).getAddress().toString();
                    const decodedAddress = cashaddr.decode(cashAddress);
                    tokenAddress = cashaddr.encode(
                        'etoken',
                        decodedAddress.type,
                        decodedAddress.hash
                    )
                    sendRecords = slpScript.getRecords(tokenIdBuf);
                } else if (slpScript.getType() === 'BURN') {
                    tokenAddress = '**BURN**'
                    sendRecords = [{
                        value: slpScript.getData(5)
                    }]
                    // Get postage info
                    postageObj = await getPostage(
                        tokenIdBuf.toString('hex')
                    );
                } else {
                    throw new Error(
                        `Unsupported SLP transaction type: ${slpScript.getType()}`
                    );
                }
                // Compute total amount to send
                const totalBase = sendRecords.reduce((total, record) => {
                    return total.add(U64.fromBE(Buffer.from(record.value)));
                }, U64.fromInt(0));
                console.log('totalBase', totalBase);

                const tokenInfo = await fetch(
                    `${getBcashRestUrl()}/token/${tokenIdBuf.toString('hex')}`
                ).then(res => res.json());

                txInfo.address = tokenAddress;
                const tokenValue = totalBase.toInt() / (10 ** tokenInfo.decimals);
                txInfo.value = `${tokenValue}`;
                txInfo.token = tokenInfo;
            }
        }
        
        setFormData(txInfo);
        if (postageObj) {
            setPostageData(postageObj);
            setUsePostage(true);
        }
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

        const { paymentDetails, type } = prInfoFromUrl;

        // ensure prInfo exists
        if (!paymentDetails) {
            return;
        }

        // Event("Category", "Action", "Label")
        // Track number of XEC BIP70 transactions
        Event('SendBip70.js', 'SendBip70', type);

        passLoadingStatus(true);

        try {
            // Send transaction
            const link = await sendBip70(
                wallet,
                paymentDetails,
                currency.defaultFee,
                false // testOnly
            );
            if (type == 'ecash')
                sendTokenNotification(link);
            else {
                sendXecNotification(link);
            }
            // Sleep for 3 seconds and then 
            await sleep(3000);
            // Manually disable loading
            passLoadingStatus(false);
            window.history.replaceState(null, '', window.location.origin);
            return history.push(`/wallet`);
        } catch (e) {
            const ticker = type == 'etoken' ?
                currency.tokenTicker : currency.ticker;
            handleSendXecError(e, ticker);
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
            return Number(tokenFormattedBalance) >= Number(formData.value)
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
                            {!checkSufficientFunds() ||
                            apiError ||
                            sendBchAmountError ||
                            sendBchAddressError ||
                            !prInfoFromUrl ? (
                                <SecondaryButton>Send</SecondaryButton>
                            ) : (
                                <PrimaryButton
                                    onClick={() => showModal()}
                                >
                                    Send
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

SendBip70.defaultProps = {
    passLoadingStatus: status => {
        console.log(status);
    },
};

SendBip70.propTypes = {
    passLoadingStatus: PropTypes.func,
};

export default SendBip70;
