import React, { useState, useEffect, useRef } from 'react';
import { 
    useLocation,
    useHistory
} from 'react-router-dom';
import PropTypes from 'prop-types';
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";
import { WalletContext } from '@utils/context';
import {
    Form,
    Modal,
    Spin
} from 'antd';
import { CashLoadingIcon } from '@components/Common/CustomIcons';
import PrimaryButton from '@components/Common/PrimaryButton';
import useBCH from '@hooks/useBCH';
import {
    sendXecNotification,
    sendTokenNotification,
    selfMintTokenNotification,
    errorNotification,
} from '@components/Common/Notifications';
import {
    currency
} from '@components/Common/Ticker.js';
import { Event } from '@utils/GoogleAnalytics';
import { fiatToCrypto } from '@utils/validation';
import { 
    getWalletState,
    fromSmallestDenomination
} from '@utils/cashMethods';
import ApiError from '@components/Common/ApiError';
import { formatFiatBalance } from '@utils/validation';
import cashaddr from 'ecashaddrjs';
import { getUrlFromQueryString } from '@utils/bip70';
import { getPaymentRequest } from '../../utils/bip70';
import { 
    Output,
    Script,
    script
} from 'bcash';
const { SLP } = script;
import { U64 } from 'n64';
import CheckOutIcon from "@assets/checkout_icon.svg";
import {
	CheckoutHeader,
	CheckoutStyles,
	PaymentDetails,
	PurchaseAuthCode,
	Heading,
	ListItem,
	CheckoutIcon,
	HorizontalSpacer,
    AgreeOverlay,
    AgreeModal,
} from "../../assets/styles/checkout.styles";
import WertModule from '@wert-io/module-react-component';
import { AcceptHosted, HostedForm } from 'react-acceptjs';


const Checkout = ({ passLoadingStatus }) => {
    // use balance parameters from wallet.state object and not legacy balances parameter from walletState, if user has migrated wallet
    // this handles edge case of user with old wallet who has not opened latest Cashtab version yet

    // If the wallet object from ContextValue has a `state key`, then check which keys are in the wallet object
    // Else set it as blank
    const ContextValue = React.useContext(WalletContext);
    const location = useLocation();
    const { 
        wallet,
        forceWalletUpdate,
        fiatPrice, 
        apiError, 
        cashtabSettings 
    } = ContextValue;
    const walletState = getWalletState(wallet);
    const { 
        tokens,
        balances
    } = walletState;
    // Modal settings
    const purchaseTokenIds = [
        '52b12c03466936e7e3b2dcfcff847338c53c611ba8ab74dd8e4dadf7ded12cf6', // production v2
        '4075459e0ac841f234bc73fc4fe46fe5490be4ed98bc8ca3f9b898443a5a381a' // sandbox v2
    ];

    const paymentServers = [
        'https://pay.badger.cash/i/'
    ]

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

    const [sendBchAddressError, setSendBchAddressError] = useState(false);
    const [sendBchAmountError, setSendBchAmountError] = useState(false);
    const [selectedCurrency, setSelectedCurrency] = useState(currency.ticker);

    // Support cashtab button from web pages
    const [prInfoFromUrl, setPrInfoFromUrl] = useState(false);

    // Show a confirmation modal on transactions created by populating form from web page button
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [isSending, setIsSending] = useState(false);

    const [hasAgreed, setHasAgreed] = useState(false);

    const [tokensMinted, setTokensMinted] = useState(false);
    const [tokensSent, setTokensSent] = useState(false);
    const [purchaseTokenAmount, setPurchaseTokenAmount] = useState(0);

    const calculateFiat = (purchaseTokenAmount) => {
        const exchangeAdditionalAmount = (purchaseTokenAmount * .01).toFixed(2); // Exchange rate
        const feeAmount = ((Number(purchaseTokenAmount) + Number(exchangeAdditionalAmount)) * .04).toFixed(2); // Add 4% fee
        const totalAmount = (Number(purchaseTokenAmount) + Number(exchangeAdditionalAmount) + Number(feeAmount)).toFixed(2);
        return {
            exchangeAdditionalAmount,
            feeAmount,
            totalAmount
        }
    };

    const {
        exchangeAdditionalAmount,
        feeAmount,
        totalAmount
    } = calculateFiat(purchaseTokenAmount);

    const isSandbox = purchaseTokenIds.slice(1).includes(formData.token?.tokenId);
    // const tokenTypeVersion = purchaseTokenIds.slice(2).includes(formData.token?.tokenId) ? 2 : 1;
    const tokenTypeVersion = 2

    // Postage Protocol Check (for BURN)
    const [postageData, setPostageData] = useState(null);
    const [usePostage, setUsePostage] = useState(false);

    const [uuid, setUuid] = useState(null);

    const [formToken, setFormToken] = useState(null);

    const divRef = useRef(null);

    const buildUuid = async (purchaseTokenAmount) => {
        if (uuid) {
            // console.log('uuid', uuid);
            return uuid;
        }

        let uuidHex = '01';
        const prUrlArray = prInfoFromUrl.url.split('/');
        const prId = prUrlArray[prUrlArray.length - 1];
        const prUrlIndex = paymentServers.findIndex(server => server === prInfoFromUrl.url.replace(prId, ''));
        if (prUrlIndex < 0) {
            return errorNotification(new Error(), 
                'Invalid payment server', 
                `Fetching invoice: ${prInfoFromUrl.url}`
            );
        }
        uuidHex += `0${prUrlIndex}${Buffer.from(prId, 'utf8').toString('hex')}`;
        // Write amount as Big Endian buffer
        const buf = Buffer.allocUnsafe(4);
        buf.writeUInt32BE(purchaseTokenAmount * (10 ** 4), 0); // hardcoded for BUX. fix this
        // console.log('base token amount uuid hex', buf.toString('hex'))
        uuidHex += buf.toString('hex');
        // fetch address alias
        const aliasUrl = `https://${isSandbox ? 'dev-api.' : ''}bux.digital/v2/addressalias/${wallet.Path1899.slpAddress}`
        const response = await fetch(aliasUrl, {
            method: 'get',
        });

        const alias = (await response.json()).alias;
        uuidHex += alias;
        // add nonce
        const genRanHex = size => [...Array(size)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
        uuidHex += genRanHex(2);

        const formattedUuid = `${uuidHex.slice(0, 8)}-${uuidHex.slice(8, 12)}-${uuidHex.slice(12, 16)}-${uuidHex.slice(16, 20)}-${uuidHex.slice(20, 32)}`
        // console.log('formattedUuid', formattedUuid);
        setUuid(formattedUuid);
        return formattedUuid;
    }

    const fetchFormToken = async (purchaseAmount) => {
        const tokenUrl = `https://${isSandbox ? 'dev-api.' : ''}bux.digital/v2/authpaymenttoken`;
        const response = await fetch(tokenUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                usdamount: Number(calculateFiat(purchaseAmount).totalAmount),
                buxamount: purchaseAmount,
                address: wallet.Path1899.slpAddress,
                prurl: prInfoFromUrl.url
            }),
        });
        const token = (await response.json()).token;
        // console.log('token', token)
        return setFormToken(token);
    }

    const prefixesArray = [
        ...currency.prefixes,
        ...currency.tokenPrefixes
    ]

    const showModal = () => {
        setIsModalVisible(true);
    };

    const handleOk = () => {
        // setIsModalVisible(false);
        setIsSending(true);
        send();
    };

    const handleCancel = () => {
        setIsModalVisible(false);
    };

    const sleep = (ms) => {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    const history = useHistory();

    const { 
        getBcashRestUrl, 
        sendBip70,
        sendSelfMint,
        sendSelfMintV2,
        generateBurnTx,
        getMintVaultAddress,
        getPostage,
        readAuthCode
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
                // Set amount to purchase
                let purchaseAmount = difference < 0 ? Math.abs(difference) : 0
                if (purchaseAmount > 0) {
                    const rounded = Math.ceil(purchaseAmount * 100) / 100;
                    purchaseAmount = rounded < 1 ? 1 : rounded;
                }
                setPurchaseTokenAmount(purchaseAmount);
                buildUuid(purchaseAmount);
                fetchFormToken(purchaseAmount);
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
        // console.log(`prInfo from page params`, prInfo);
        if (prInfo.url && prInfo.type) {
            try {
                prInfo.paymentDetails = (await getPaymentRequest(
                    prInfo.url, 
                    prInfo.type
                )).paymentDetails;
                prInfo.paymentDetails.merchantDataJson = JSON.parse(prInfo.paymentDetails.merchantData.toString());
                // console.log('prInfo.paymentDetails.merchantDataJson', prInfo.paymentDetails.merchantDataJson)
            } catch (err) {
                errorNotification(err, 
                    'Failed to fetch invoice. May be expired or invalid', 
                    `Fetching invoice: ${prInfo.url}`
                );
                await sleep(3000);
                // Manually disable loading
                passLoadingStatus(false);
                window.history.replaceState(null, '', window.location.origin);
                return history.push(`/wallet`);
            }
        } else {
            passLoadingStatus(false);
            return history.push('/wallet');
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
                // console.log('totalBase', totalBase);

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

    async function send(rawChainTxs, authCodeB64, attempt = 1) {
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

        passLoadingStatus("Please wait while your transaction is broadcast");

        try {
            // Send transaction
            const link = await sendBip70(
                wallet,
                paymentDetails,
                currency.defaultFee,
                false, // testOnly
                false, // isPreburn
                rawChainTxs
            );
            if (type == 'ecash')
                sendTokenNotification(link);
            else {
                sendXecNotification(link);
            }
            
            // Send to success page if included in merchantDetails
            if (paymentDetails.merchantData) {
                const merchantDataJson = JSON.parse(paymentDetails.merchantData.toString());
                if (merchantDataJson.callback?.success_url) {
                    return window.location.assign(merchantDataJson.callback.success_url);
                }
            }

            setTokensSent(true)
            // If doing a chain, force full wallet update
            // UTXOs may not change (ie. in a mint chain)
            if (rawChainTxs)
                await forceWalletUpdate(true);
            else
                await sleep(3000);
            // Manually disable loading
            passLoadingStatus(false);
            // Return to main wallet screen
            window.history.replaceState(null, '', window.location.origin);
            return history.push(`/wallet`);
        } catch (e) {
            console.error(e)
            // Retry send if response is 402 or 404 (mitigates stamp/baton race conditions)
            if ((e.cause.code === 402 || e.cause.code === 404) && attempt < 3) {
                const nextAttempt = attempt + 1;
                passLoadingStatus(`Payment unsuccessful. Retrying... (${nextAttempt}/3)`);
                await sleep(5000);
                if (authCodeB64)
                    return doSelfMint(authCodeB64, nextAttempt);
                else
                    return send(null, null, nextAttempt)
            } else {
                const ticker = type == 'etoken' ?
                    currency.tokenTicker : currency.ticker;
                handleSendXecError(e, ticker);
            }
        }
        
        // Clear the address field
        setFormData(blankFormData);
        // Manually disable loading
        passLoadingStatus(false);
    }

    const doSelfMint = async (authCodeB64, attempt = 1, rawBurnTx) => {
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
            formData.token.tokenId,
            'hex'
        );

        // Event("Category", "Action", "Label")
        // Track number of XEC BIP70 transactions
        Event('SelfMint.js', 'SelfMint', authCodeB64);

        passLoadingStatus("Please wait while your tokens are minted");

        //const doChainedMint = Number(tokenFormattedBalance) === 0;
        // default to always doing a chained mint here, don't show SEND button
        const doChainedMint = true;

        try {
            const { 
                version
            } = readAuthCode(authCodeB64);
            // Send transaction
            let rawMintTx;
            if (version === 1) {
                rawMintTx = await sendSelfMint(
                    wallet,
                    tokenId,
                    authCodeB64,
                    false, // testOnly
                    doChainedMint
                );
            } else {
                rawMintTx = await sendSelfMintV2(
                    wallet,
                    authCodeB64,
                    false, // testOnly
                    doChainedMint,
                    rawBurnTx,
                    isSandbox
                );
            }

            setTokensMinted(true);

            if (doChainedMint)
                return send(
                    [
                        ...rawBurnTx ? [rawBurnTx] : [], 
                        rawMintTx
                    ],
                    authCodeB64,
                    attempt
                )

            selfMintTokenNotification();
            // Sleep for 10 seconds and then 
            // await sleep(10000);
            forceWalletUpdate();
            // Manually disable loading
            return passLoadingStatus(true);
            // return window.location.reload();
        } catch (e) {
            handleSendXecError(e, authCodeB64);
        }
    }

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

    const authorizenetSuccess = async (result) => {
        try {
            console.log('result', result);
            const resultCode = result.messages.resultCode
            console.log('resultCode', resultCode)
            
            if (resultCode !== 'Ok') {
                console.log(`authorize.net responseCode ${result.responseCode}`)
                passLoadingStatus(false);
                return;
            }

            passLoadingStatus('Processing payment information...');
            const tokenUrl = `https://${isSandbox ? 'dev-api.' : ''}bux.digital/v2/authpaymenttransaction`;
            const transResponse = await fetch(tokenUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    usdamount: Number(calculateFiat(purchaseTokenAmount).totalAmount),
                    buxamount: purchaseTokenAmount,
                    address: wallet.Path1899.slpAddress,
                    prurl: prInfoFromUrl.url,
                    opaquedata: result.opaqueData,
                    customerinformation: result.customerInformation
                }),
            });
            const transId = (await transResponse.json()).transId;
            // Call your server to save the transaction
            passLoadingStatus('Fetching authorization code...');
            let burnTx;
            const response = await fetch(`https://${isSandbox ? 'dev-api.' : ''}bux.digital/v${tokenTypeVersion}/success?paymentId=${result.transId || transId}`, {
                method: 'get',
                headers: {
                    'content-type': 'application/json',
                    // ...(burnTx) && ({'x-split-transaction': burnTx.toString('hex')})
                }
            });

            const data = await response.json();
            doSelfMint(data.authcode, 1, burnTx);
        } catch (err) {
            console.log(err);
            const { type } = prInfoFromUrl;
            const ticker = type == 'etoken' ?
                currency.tokenTicker : currency.ticker;
            handleSendXecError(err, ticker);
        }
    }

    const wertSuccess = async (result) => {
        try {
            console.log('result', result);
            
            if (result.status !== 'success') {
                if (result.status === 'pending') {
                    console.log('wert pending')
                    divRef.current.scrollIntoView();
                    // divRef.current.scrollTo({ top: 0, behavior: 'smooth' });
                    passLoadingStatus(
                        'Processing payment. This can take up to 60 seconds.'
                    );
                } else {
                    console.log(`wert ${result.status}`)
                    passLoadingStatus(false);
                }
                return;
            }

            // Your code here after capture the order
            passLoadingStatus('true');
            // Handle token/fiat split payment
            let burnTx;
            // if (Number(tokenFormattedBalance) >= .01) {
            //     passLoadingStatus('Adding existing wallet balance to payment...');
            //     const mintVaultBatonOutput = new Output({
            //         address: getMintVaultAddress(isSandbox),
            //         value: 5700
            //     })
            //     burnTx = await generateBurnTx(
            //         wallet,
            //         formData.token.tokenId,
            //         [],
            //         mintVaultBatonOutput
            //     );
            // }
            // console.log('burnTx', burnTx && burnTx.toString('hex'))
            // passLoadingStatus('Fetching authorization code...');
            // // Call your server to save the transaction
            // const response = await fetch(`https://${isSandbox ? 'dev-api.' : ''}bux.digital/v${tokenTypeVersion}/success?paymentId=${result.order_id}`, {
            //     method: 'get',
            //     headers: {
            //         'content-type': 'application/json',
            //         ...(burnTx) && ({'x-split-transaction': burnTx.toString('hex')})
            //     }
            // });

            // const data = await response.json();
            doSelfMint(result.authcode, 1, burnTx);
        } catch (err) {
            console.log(err);
            const { type } = prInfoFromUrl;
            const ticker = type == 'etoken' ?
                currency.tokenTicker : currency.ticker;
            handleSendXecError(err, ticker);
        }
    }

    const payButtonStyle = {
        border: 'none',
        color: 'rgb(255, 255, 255)',
        backgroundImage: 'linear-gradient(270deg, rgb(0, 116, 194) 0%, rgb(39, 52, 152) 100%)',
        transition: 'all 0.5s ease 0s',
        backgroundSize: '200%',
        fontSize: '18px',
        width: '80%',
        padding: '20px 0px',
        borderRadius: '4px',
        marginBottom: '20px',
        cursor: 'pointer',
    };

    const payButtonText = 'PAY WITH CREDIT CARD';
    const payFormHeaderText = `Pay $${totalAmount} - Self-mint Authorization Code (${purchaseTokenAmount} BUX)`

    const priceApiError = fiatPrice === null && selectedCurrency !== 'XEC';

    const displayBalance = tokenFormattedBalance || balances.totalBalance;
    const displayTicker = formData.token?.ticker || currency.ticker;
    const { invoice, merchant_name, offer_description, offer_name } = prInfoFromUrl.paymentDetails?.merchantDataJson?.ipn_body || {};
    const isStage1 = !checkSufficientFunds() || apiError || sendBchAmountError || sendBchAddressError || !prInfoFromUrl;
    // For making SEND button available
    if (!isStage1) {
        passLoadingStatus(false);
    }

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

                <CheckoutHeader ref={divRef} tabindex="-1">
                    <CheckoutIcon src={CheckOutIcon} />
                    <h4>CHECKOUT</h4>
                    <hr />             
                    {(offer_name && (
                        <>
                            <h1>{offer_name}</h1>
                        </>
                    ))}                            
                </CheckoutHeader>

			<CheckoutStyles>
				<PaymentDetails>
					<h3 className="title">Payment Request Details:</h3>
                    {(offer_description && (
                        <>
                            <p className="offer-description">{offer_description}</p>
                            <span className="merchant">From {merchant_name}</span>
                        </>
                    )) || (prInfoFromUrl && prInfoFromUrl.paymentDetails && (
                        <>
                            <p className="offer-description">{prInfoFromUrl.paymentDetails.memo}</p>                        
                        </>
                    ))}
				</PaymentDetails>

				<HorizontalSpacer />

				{(isStage1 && (
					<>
						<PurchaseAuthCode>
							{!checkSufficientFunds() && <p className="text-muted">You have insufficient funds in this wallet</p>}
							<ListItem className="min-m">
								<span className="key black">Purchase an Auth Code for</span>
								<span className="value black bold">
									{purchaseTokenAmount} {displayTicker}
								</span>
							</ListItem>
							<p className="text-muted">In order to settle this payment request</p>
						</PurchaseAuthCode>

						<HorizontalSpacer />

						<Heading>Transaction Details:</Heading>

						<ListItem>
							<span className="key gray">Subtotal:</span>
							<span className="value gray">${purchaseTokenAmount.toFixed(2)}</span>
						</ListItem>

						<ListItem>
							<span className="key gray">Fee:</span>
							<span className="value gray">${(Number(exchangeAdditionalAmount) + Number(feeAmount)).toFixed(2)}</span>
						</ListItem>
						<ListItem>
							<span className="key gray bold">Total:</span>
							<span className="value gray bold">${totalAmount}</span>
						</ListItem>
					</>
				)) || (
					<>
						<PurchaseAuthCode>
							<ListItem className="min-m">
								<span className="key black">Ready To Send</span>
								<span className="value black bold">
									{formData.value} {displayTicker}
								</span>
							</ListItem>
							<p className="text-muted">In order to settle this payment request</p>
						</PurchaseAuthCode>
					</>
				)}

				<HorizontalSpacer />
                
                {merchant_name && (
                    <>
                        <ListItem>
                            <span className="key gray">Merchant:</span>
                            <span className="value gray">{merchant_name}</span>
                        </ListItem>                       
                    </>
                )}

                {invoice && (
                    <>
                        <ListItem>
                            <span className="key gray">Invoice:</span>
                            <span className="value gray">{invoice}</span>
                        </ListItem>                    
                    </>
                )}

				{(merchant_name || invoice) && (
                    <>
                        <HorizontalSpacer />                    
                    </>
                )}
			</CheckoutStyles>
         
            {isStage1 ? (
                <>
                    { hasAgreed && (
                        <>
                        {!tokensMinted && uuid && formToken ? 
                            <>
                                <p className="text-muted">
                                    By making this purchase you agree to the
                                    <a target="_blank" rel="noopener noreferrer" href="https://bux.digital/tos.html"> Terms Of Service</a>
                                </p>
                                {prInfoFromUrl.paymentDetails.merchantDataJson.ipn_body?.offer_name ? (
                                    <WertModule
                                        style={{height: "580px"}}
                                        options={{
                                            partner_id: isSandbox ? '01H97V3M5ZZPVS7RXW2V2NXVN5' : '01HB6ASSZED5SH5V8KWQD1MR87' ,
                                            origin: `https://${isSandbox ? 'sandbox' : 'widget'}.wert.io`,
                                            click_id: uuid, // unique id of purchase in your system
                                            currency: 'USD',
                                            commodity: 'BUX', // name of your token in Wert system
                                            network: isSandbox ? 'testnet' : 'mainnet', 
                                            address: wallet.Path1899.cashAddress,
                                            commodities: JSON.stringify([
                                                {
                                                commodity: 'BUX',
                                                network: isSandbox ? 'testnet' : 'mainnet',
                                                }, // this restricts what currencies will be available in the widget
                                            ]),
                                            commodity_amount: purchaseTokenAmount, // amount being minted
                                            listeners: {
                                                loaded: () => console.log('Wert widget loaded'),
                                                "payment-status": (result) => wertSuccess(result)
                                            }
                                        }}
                                    />
                                ) : (
                                    <>
                                    <HostedForm 
                                        authData={{
                                            apiLoginID: isSandbox ? '25W2mLe5' : '469zGVDrekmC',
                                            clientKey: isSandbox ? '8TEqfrHqLh4UWqUY8Sf3H8fq5PyczM9gqfV927Rq8Q5eFwVs2P8UYn7H8MK8Fy4T' : '74AUbX9mjmMFFBs38EG8q46dEaxNy9kC6p8rK4f33nw6yGhFn6g62vrX5d2KGAQ8'
                                        }} 
                                        onSubmit={authorizenetSuccess}
                                        environment={isSandbox ? 'SANDBOX' : 'PRODUCTION'}
                                        billingAddressOptions={{show: true, required: true}}
                                        buttonStyle={payButtonStyle}
                                        buttonText={payButtonText}
                                        formHeaderText={payFormHeaderText}
                                    />
                                    {/* <AcceptHosted
                                        formToken={formToken}
                                        integration="iframe"
                                        onTransactionResponse={authorizenetSuccess}
                                        environment={isSandbox ? 'SANDBOX' : 'PRODUCTION'}
                                    >
                                        <AcceptHosted.Button 
                                        style={payButtonStyle}
                                        >
                                            {payButtonText}}
                                        </AcceptHosted.Button>
                                        <AcceptHosted.IFrameBackdrop />
                                        <AcceptHosted.IFrameContainer>
                                            <AcceptHosted.IFrame />
                                        </AcceptHosted.IFrameContainer>
                                    </AcceptHosted> */}
                                    </>
                                )}
                            </>
                            : <Spin spinning={true} indicator={CashLoadingIcon}></Spin>
                        }
                        </>
                    )}
                </>
            ) : (
                <>
                    {isSending || tokensSent ? <Spin spinning={true} indicator={CashLoadingIcon}></Spin> :
                    /* <PrimaryButton onClick={() => handleOk()}>Send</PrimaryButton>*/<></>}
                </>
            )}

            {apiError && <ApiError />}

            { !hasAgreed && isStage1 &&
                <AgreeOverlay>
                    <AgreeModal>
                        <Heading>You are about to purchase a BUX Self-Mint Authorization Code</Heading>
                        <HorizontalSpacer />
                        <span className="key black">To proceed you must agree to the following:</span>
                        <p className=" first">1. The seller of the digital good in this transaction is 
                            <a 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                href={prInfoFromUrl.paymentDetails?.merchantDataJson?.ipn_body?.offer_name ? "https://wert.io" : "https://bux.digital"}>
                                    {prInfoFromUrl.paymentDetails?.merchantDataJson?.ipn_body?.offer_name ? ' WERT.IO' : ' BADGER LLC'}
                            </a>
                        </p>
                        <p>2. This purchase is for an authorization code ONLY. It is not a purchase of digital currency, credits on any third-party platform, or any other product or service</p>
                        <p>3. This unhosted wallet, upon receiving the authorization code (after your credit card payment is made), will mint and send BUX tokens to settle the payment request</p>
                        <p>4. You have read and understand the BUX <a target="_blank" rel="noopener noreferrer" href="https://bux.digital/tos.html"> Terms Of Service</a></p>
                        <PrimaryButton onClick={() => setHasAgreed(true)}>I Agree</PrimaryButton>
                    </AgreeModal>
                </AgreeOverlay>
            }
        </>
    );
};

/*
passLoadingStatus must receive a default prop that is a function
in order to pass the rendering unit test in SendBip70.test.js

status => {console.log(status)} is an arbitrary stub function
*/

Checkout.defaultProps = {
    passLoadingStatus: status => {
        console.log(status);
    },
};

Checkout.propTypes = {
    passLoadingStatus: PropTypes.func,
};

export default Checkout;
