import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { WalletContext } from '@utils/context';
import { 
    Form, 
    message, 
    Row, 
    Col, 
    Alert, 
    Descriptions,
    Checkbox
} from 'antd';
import styled, { css } from 'styled-components';
import PrimaryButton, {
    SecondaryButton,
} from '@components/Common/PrimaryButton';
import {
    FormItemWithMaxAddon,
    DestinationAddressSingle,
} from '@components/Common/EnhancedInputs';
import useBCH from '@hooks/useBCH';
import BalanceHeader from '@components/Common/BalanceHeader';
import { Redirect } from 'react-router-dom';
import useWindowDimensions from '@hooks/useWindowDimensions';
import { isMobile, isIOS, isSafari, ConsoleView } from 'react-device-detect';
import { Img } from 'react-image';
import makeBlockie from 'ethereum-blockies-base64';
import BigNumber from 'bignumber.js';
import {
    currency,
    parseAddress,
    isValidTokenPrefix,
} from '@components/Common/Ticker.js';
import { Event } from '@utils/GoogleAnalytics';
import { authPubKeys } from '@utils/selfMint';
import { getWalletState } from '@utils/cashMethods';
import ApiError from '@components/Common/ApiError';
import {
    sendTokenNotification,
    errorNotification,
} from '@components/Common/Notifications';

3

const StyledCheckbox = styled(Checkbox)`
  ${props =>
    props &&
    css`
      & .ant-checkbox .ant-checkbox-inner {
        background-color: white;
        border-color: blue;
      }
    `}
`;

const SendToken = ({ tokenId, passLoadingStatus }) => {
    const { wallet, apiError } = React.useContext(WalletContext);
    const walletState = getWalletState(wallet);
    const { 
        tokens, 
        slpBalancesAndUtxos: {slpUtxos} 
    } = walletState;
    const token = tokens.find(token => token.tokenId === tokenId);
    const tokenFormattedBalance = token ? new BigNumber(token.balance)
        .div(10 ** token.info.decimals)
        .toString() : '0';
    const tokenUtxos = slpUtxos.filter(u => u.slp.tokenId === tokenId);

    const [tokenStats, setTokenStats] = useState(null);
    const [queryStringText, setQueryStringText] = useState(null);
    const [sendTokenAddressError, setSendTokenAddressError] = useState(false);
    const [sendTokenAmountError, setSendTokenAmountError] = useState(false);
    // Get device window width
    // If this is less than 769, the page will open with QR scanner open
    const { width } = useWindowDimensions();
    // Load with QR code open if device is mobile and NOT iOS + anything but safari
    const scannerSupported = width < 769 && isMobile && !(isIOS && !isSafari);

    const blankFormData = {
        dirty: true,
        value: '',
        address: '',
    };
    const [formData, setFormData] = useState(blankFormData);

    // Postage Protocol Check
    const [postageData, setPostageData] = useState(null);
    const [usePostage, setUsePostage] = useState(false);

    const { 
        getBcashRestUrl, 
        sendToken, 
        getPostage,
        calculatePostage } = useBCH();

    useEffect(async () => {
        passLoadingStatus(true);
        const postageObj = await getPostage(tokenId);
        if (postageObj) {
            setPostageData(postageObj);
            setUsePostage(true);
        }
        passLoadingStatus(false);
    }, []);

    async function submit() {
        setFormData({
            ...formData,
            dirty: false,
        });

        if (
            !formData.address ||
            !formData.value ||
            Number(formData.value <= 0) ||
            sendTokenAmountError
        ) {
            return;
        }

        // Event("Category", "Action", "Label")
        // Track number of SLPA send transactions and
        // SLPA token IDs
        Event('SendToken.js', 'Send', tokenId);

        passLoadingStatus(true);
        const { address, value } = formData;

        // Clear params from address
        let cleanAddress = address.split('?')[0];

        // Convert to simpleledger prefix if etoken
        // cleanAddress = convertEtokenToSimpleledger(cleanAddress);

        try {
            const link = await sendToken(wallet, {
                tokenId: tokenId,
                tokenReceiverAddress: cleanAddress,
                amount: value,
                postageData: usePostage ? postageData : null
                },
                currency.defaultFee
            );

            sendTokenNotification(link);
        } catch (e) {
            passLoadingStatus(false);
            let message;

            if (!e.error && !e.message) {
                message = `Transaction failed: no response from ${getBcashRestUrl()}.`;
            } else if (
                /Could not communicate with full node or other external service/.test(
                    e.error,
                )
            ) {
                message = 'Could not communicate with API. Please try again.';
            } else {
                message = e.message || e.error || JSON.stringify(e);
            }
            errorNotification(e, message, 'Sending eToken');
        }
        // Clear the address field
        setFormData(blankFormData);
        passLoadingStatus(false);
    }

    const handleSlpAmountChange = e => {
        let error = false;
        const { value, name } = e.target;

        // test if exceeds balance using BigNumber
        let isGreaterThanBalance = false;
        if (!isNaN(value)) {
            const bigValue = new BigNumber(value);
            // Returns 1 if greater, -1 if less, 0 if the same, null if n/a
            isGreaterThanBalance = bigValue.comparedTo(token.balance);
        }

        // Validate value for > 0
        if (isNaN(value)) {
            error = 'Amount must be a number';
        } else if (value <= 0) {
            error = 'Amount must be greater than 0';
        } else if (token && token.balance && isGreaterThanBalance === 1) {
            error = `Amount cannot exceed your ${token.info.tokenTicker} balance of ${token.balance}`;
        } else if (!isNaN(value) && value.toString().includes('.')) {
            if (value.toString().split('.')[1].length > token.info.decimals) {
                error = `This token only supports ${token.info.decimals} decimal places`;
            }
        }
        setSendTokenAmountError(error);
        setFormData(p => ({
            ...p,
            [name]: value,
        }));
    };

    const handleTokenAddressChange = e => {
        const { value, name } = e.target;
        // validate for token address
        // validate for parameters
        // show warning that query strings are not supported

        let error = false;
        let addressString = value;

        const addressInfo = parseAddress(addressString, true);
        /*
        Model

        addressInfo = 
        {
            address: '',
            isValid: false,
            queryString: '',
            amount: null,
        };
        */

        const { address, isValid, queryString } = addressInfo;

        // If query string,
        // Show an alert that only amount and currency.ticker are supported
        setQueryStringText(queryString);

        // Is this valid address?
        if (!isValid) {
            error = 'Address is not a valid etoken: address';
            // If valid address but token format
        } else if (!isValidTokenPrefix(address)) {
            error = `Cashtab only supports sending to ${currency.tokenPrefixes[0]} prefixed addresses`;
        }
        setSendTokenAddressError(error);

        setFormData(p => ({
            ...p,
            [name]: value,
        }));
    };

    const handlePostageCheck = (e) => {
        setUsePostage(e.target.checked);
    }

    const onMax = async () => {
        // Clear this error before updating field
        setSendTokenAmountError(false);
        let postageAmount = 0;
        if (usePostage) {
            const postageBaseCost = calculatePostage(
                tokenUtxos.length,
                1,
                postageData
            );
            postageAmount = postageBaseCost / 10 ** postageData.stamp.decimals;
        }
        try {
            let value = tokenFormattedBalance - postageAmount;

            setFormData({
                ...formData,
                value,
            });
        } catch (err) {
            console.log(`Error in onMax:`);
            console.log(err);
            message.error(
                'Unable to calculate the max value due to network errors',
            );
        }
    };

    useEffect(() => {
        // If the balance has changed, unlock the UI
        // This is redundant, if backend has refreshed in 1.75s timeout below, UI will already be unlocked

        passLoadingStatus(false);
    }, [token]);

    // For token image
    const srcUrls = [`${currency.tokenIconsUrl}/32/${tokenId}.png`]
    const authPubKey = authPubKeys.find(authObj => 
        authObj.tokenId == tokenId && authObj.imageUrl
    );
    if (authPubKey)
        srcUrls.push(authPubKey.imageUrl);

    return (
        <>
            {!token && <Redirect to="/" />}

            {token && (
                <>
                    <BalanceHeader
                        balance={tokenFormattedBalance}
                        ticker={token.info.ticker}
                    />
                    {/* <TokenIconAlert /> */}
                    <Row type="flex">
                        <Col span={24}>
                            <Form
                                style={{
                                    width: 'auto',
                                }}
                            >
                                <DestinationAddressSingle
                                    loadWithCameraOpen={scannerSupported}
                                    validateStatus={
                                        sendTokenAddressError ? 'error' : ''
                                    }
                                    help={
                                        sendTokenAddressError
                                            ? sendTokenAddressError
                                            : ''
                                    }
                                    onScan={result =>
                                        handleTokenAddressChange({
                                            target: {
                                                name: 'address',
                                                value: result,
                                            },
                                        })
                                    }
                                    inputProps={{
                                        placeholder: `${currency.tokenTicker} Address`,
                                        name: 'address',
                                        onChange: e =>
                                            handleTokenAddressChange(e),
                                        required: true,
                                        value: formData.address,
                                    }}
                                />
                                <FormItemWithMaxAddon
                                    validateStatus={
                                        sendTokenAmountError ? 'error' : ''
                                    }
                                    help={
                                        sendTokenAmountError
                                            ? sendTokenAmountError
                                            : ''
                                    }
                                    onMax={onMax}
                                    inputProps={{
                                        name: 'value',
                                        step: 1 / 10 ** token.info.decimals,
                                        placeholder: 'Amount',
                                        prefix:
                                            currency.tokenIconsUrl !== '' ? (
                                                <Img
                                                    src={srcUrls}
                                                    width={16}
                                                    height={16}
                                                    unloader={
                                                        <img
                                                            alt={`identicon of tokenId ${tokenId} `}
                                                            heigh="16"
                                                            width="16"
                                                            style={{
                                                                borderRadius:
                                                                    '50%',
                                                            }}
                                                            key={`identicon-${tokenId}`}
                                                            src={makeBlockie(
                                                                tokenId,
                                                            )}
                                                        />
                                                    }
                                                />
                                            ) : (
                                                <img
                                                    alt={`identicon of tokenId ${tokenId} `}
                                                    heigh="16"
                                                    width="16"
                                                    style={{
                                                        borderRadius: '50%',
                                                    }}
                                                    key={`identicon-${tokenId}`}
                                                    src={makeBlockie(tokenId)}
                                                />
                                            ),
                                        suffix: token.info.ticker,
                                        onChange: e => handleSlpAmountChange(e),
                                        required: true,
                                        value: formData.value,
                                    }}
                                />
                                {postageData && (
                                    <StyledCheckbox
                                        defaultChecked={true}
                                        onChange={handlePostageCheck}
                                    >Use Post Office? (pay miner fee in {token.info.ticker})</StyledCheckbox>
                                )}
                                <div
                                    style={{
                                        paddingTop: '12px',
                                    }}
                                >
                                    {apiError ||
                                    sendTokenAmountError ||
                                    sendTokenAddressError ? (
                                        <>
                                            <SecondaryButton>
                                                Send {token.info.name}
                                            </SecondaryButton>
                                        </>
                                    ) : (
                                        <PrimaryButton onClick={() => submit()}>
                                            Send {token.info.name}
                                        </PrimaryButton>
                                    )}
                                </div>

                                {queryStringText && (
                                    <Alert
                                        message={`You are sending a transaction to an address including query parameters "${queryStringText}." Token transactions do not support query parameters and they will be ignored.`}
                                        type="warning"
                                    />
                                )}
                                {apiError && <ApiError />}
                            </Form>
                            <Descriptions
                                column={1}
                                bordered
                                title={`Token info for "${token.info.name}"`}
                            >
                                <Descriptions.Item label="Token ID">
                                    {token.tokenId}
                                </Descriptions.Item>
                                <Descriptions.Item label="Decimals">
                                    {token.info.decimals}
                                </Descriptions.Item>
                                <Descriptions.Item label="Document URI">
                                    {token.info.uri}
                                </Descriptions.Item>
                                <Descriptions.Item label="Document Hash">
                                    {token.info.hash}
                                </Descriptions.Item>
                                <Descriptions.Item label="Version">
                                    {token.info.version}
                                </Descriptions.Item>
                                {tokenStats && (
                                    <>
                                        <Descriptions.Item label="Genesis Date">
                                            {tokenStats.timestampUnix !==
                                            null
                                                ? new Date(
                                                        tokenStats.timestampUnix *
                                                            1000,
                                                    ).toLocaleDateString()
                                                : 'Just now (Genesis tx confirming)'}
                                        </Descriptions.Item>
                                        <Descriptions.Item label="Fixed Supply?">
                                            {tokenStats.containsBaton
                                                ? 'No'
                                                : 'Yes'}
                                        </Descriptions.Item>
                                        <Descriptions.Item label="Initial Quantity">
                                            {tokenStats.initialTokenQty.toLocaleString()}
                                        </Descriptions.Item>
                                        <Descriptions.Item label="Total Burned">
                                            {tokenStats.totalBurned.toLocaleString()}
                                        </Descriptions.Item>
                                        <Descriptions.Item label="Total Minted">
                                            {tokenStats.totalMinted.toLocaleString()}
                                        </Descriptions.Item>
                                        <Descriptions.Item label="Circulating Supply">
                                            {tokenStats.circulatingSupply.toLocaleString()}
                                        </Descriptions.Item>
                                    </>
                                )}
                            </Descriptions>
                        </Col>
                    </Row>
                </>
            )}
        </>
    );
};

/*
passLoadingStatus must receive a default prop that is a function
in order to pass the rendering unit test in SendToken.test.js

status => {console.log(status)} is an arbitrary stub function
*/

SendToken.defaultProps = {
    passLoadingStatus: status => {
        console.log(status);
    },
};

SendToken.propTypes = {
    tokenId: PropTypes.string,
    passLoadingStatus: PropTypes.func,
};

export default SendToken;
