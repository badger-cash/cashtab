import React, { useState, useEffect } from 'react';
import { 
    useHistory
} from 'react-router-dom';
import PropTypes from 'prop-types';
import { WalletContext } from '@utils/context';
import {
    SelfMintAuthCode
} from '@components/Common/EnhancedInputs';
import {
    Form,
    Modal,
} from 'antd';
import { Row, Col } from 'antd';
import PrimaryButton, {
    SecondaryButton,
} from '@components/Common/PrimaryButton';
import useBCH from '@hooks/useBCH';
import {
    selfMintTokenNotification,
    errorNotification,
} from '@components/Common/Notifications';
import {
    currency
} from '@components/Common/Ticker.js';
import { Event } from '@utils/GoogleAnalytics';
import BalanceHeader from '@components/Common/BalanceHeader';
import {
    ZeroBalanceHeader
} from '@components/Common/Atoms';
import { 
    getWalletState
} from '@utils/cashMethods';
import ApiError from '@components/Common/ApiError';
import styled from 'styled-components';
import { authPubKeys } from '@utils/selfMint';
import { U64 } from 'n64';
import { SelfMintPurchaseAmount } from '../Common/EnhancedInputs';

const StyledSpacer = styled.div`
    height: 1px;
    width: 100%;
    background-color: ${props => props.theme.wallet.borders.color};
    margin: 60px 0 50px;
`;

const SelfMint = ({ passLoadingStatus }) => {
    // use balance parameters from wallet.state object and not legacy balances parameter from walletState, if user has migrated wallet
    // this handles edge case of user with old wallet who has not opened latest Cashtab version yet

    // If the wallet object from ContextValue has a `state key`, then check which keys are in the wallet object
    // Else set it as blank
    const ContextValue = React.useContext(WalletContext);
    const { wallet, apiError} = ContextValue;
    const walletState = getWalletState(wallet);
    const { 
        tokens,
        balances
    } = walletState;
    
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
    const [tokenToMint, setTokenToMint] = useState(null);

    // Show a purchase modal when BUX is requested and insufficient balance
    const [isPurchaseModalVisible, setIsPurchaseModalVisible] = useState(false);
    const [purchaseTokenAmount, setPurchaseTokenAmount] = useState(0);

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
        sendSelfMint, 
        sendSelfMintV2, 
        readAuthCode,
        getTxBcash,
        getTxHistoryBcash,
        getUtxoBcash
     } = useBCH();

    // If the balance has changed, unlock the UI
    // This is redundant, if backend has refreshed in 1.75s timeout below, UI will already be unlocked
    useEffect(() => {
        passLoadingStatus(false);
    }, [balances.totalBalance]);

    useEffect(async () => {
        if (!wallet.Path1899)
            return history.push('/wallet');
        passLoadingStatus(true);

        // Do not set authCode in state if query strings are not present or code is already set
        if (
            authCodeB64 ||
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
        // console.log('authCode', authCode);
        // If no authcode specified
        if (!authCode) {
            passLoadingStatus(false);
            return;
        }
        // Process auth code
        await processAuthCode(authCode);

        passLoadingStatus(false);
    }, [authCodeB64]);

    async function processAuthCode (authCode) {
        try {
            const { 
                mintQuantity, 
                stampOutpoint,
                batonUtxo,
                tokenId,
                version
            } = readAuthCode(authCode);
            const outpointTocheck = stampOutpoint || batonUtxo;
            const stampUtxo = await getUtxoBcash(
                outpointTocheck.txid(),
                outpointTocheck.index
            );
            if (!stampUtxo) {
                // remove the mintauth parameter from the url
                removeMintAuthParam(authCode);
                return handleSendXecError(
                    new Error(`Invalid authorization code: UTXO in authcode does not exist`),
                    'MINT'
                );
            }

            let genesisTx;

            if (version === 1) {
                const stampTxs = await getTxHistoryBcash(
                    [stampUtxo.address],
                    10,
                    false
                );
                genesisTx = stampTxs.find(tx => 
                    authPubKeys.find(authObj => 
                        authObj.tokenId == tx.slpToken?.tokenId
                    )
                );
            } else {
                genesisTx = await getTxBcash(tokenId.toString('hex'))
            }
            if (!genesisTx) {
                // remove the mintauth parameter from the url
                removeMintAuthParam(authCode);
                return handleSendXecError(
                    new Error(`Invalid authorization code: Authcode is for unsupported self-mint token`),
                    'MINT'
                );
            }

            const mintQtyString = U64
                .fromBE(mintQuantity)
                .toInt() / (10 ** genesisTx.slpToken.decimals);

            setTokenToMint({
                ...genesisTx.slpToken,
                mintQuantity: mintQtyString
            })
            setAuthCodeB64(authCode);
            // remove mintauth url parameter if present
            removeMintAuthParam(authCode);
        } catch (err) {
            console.log(err)
           // remove the mintauth parameter from the url
           removeMintAuthParam(authCode);
           return handleSendXecError(
               new Error(`Invalid authorization code: Copy and paste a valid auth code`),
               'MINT'
           ); 
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
        } else if (errorObj && errorObj.type == 'VerifyError') {
            message = "Mint transaction rejected. The provided authcode is not valid for the address controlled by this wallet"
        } else {
            message =
                errorObj.message || errorObj.error || JSON.stringify(errorObj);
        }

        errorNotification(errorObj, message, `Sending ${ticker}`);

    }

    function removeMintAuthParam(authCode) {
        // String replaceAll case-insensitive
        String.prototype.replaceAll = function(strReplace, strWith) {
            // See http://stackoverflow.com/a/3561711/556609
            var esc = strReplace.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
            var reg = new RegExp(esc, 'ig');
            return this.replace(reg, strWith);
        };
        const searchMask = `mintauth=${authCode}`;
        let locationStr = window.location.href.replaceAll(searchMask, '');
        locationStr = locationStr.replace('/?#/', '/#/');
        locationStr = locationStr.replace('/?&', '/?');
        // Remove mintauth parameter and value from url
        window.history.replaceState(
            null, 
            '', 
            locationStr
        );
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
            tokenToMint.tokenId,
            'hex'
        );

        // Event("Category", "Action", "Label")
        // Track number of XEC BIP70 transactions
        Event('SelfMint.js', 'SelfMint', authCodeB64);

        passLoadingStatus(true);

        try {
            const { 
                version
            } = readAuthCode(authCodeB64);
            // Send transaction
            if (version === 1) {
                await sendSelfMint(
                    wallet,
                    tokenId,
                    authCodeB64,
                    false // testOnly
                );
            } else {
                await sendSelfMintV2(
                    wallet,
                    authCodeB64,
                    false // testOnly
                );
            }

            selfMintTokenNotification();
            // Sleep for 10 seconds and then 
            await sleep(8000);
            // Manually disable loading
            passLoadingStatus(false);
            // Remove mintauth url param
            removeMintAuthParam(authCodeB64);

            return history.push(`/wallet`);
        } catch (e) {
            handleSendXecError(e, authCodeB64);
        }
        
        // Clear the address field
        setFormData(blankFormData);
        // Manually disable loading
        passLoadingStatus(false);
    }

    const handleAuthCodeChange = async e => {
        const { value } = e.target;
        console.log('value', value);
        passLoadingStatus(true);
        processAuthCode(value);
    };

    const handlePurchaseAmountChange = async e => {
        const { value } = e.target;
        setPurchaseTokenAmount(Number(value).toFixed(2));
    }

    const displayTicker = formData.token?.ticker || currency.ticker;

    return (
        <>
            <Modal
                title={`Purchase ${displayTicker}`}
                visible={isPurchaseModalVisible}
                onOk={handlePurchaseOk}
                onCancel={handlePurchaseCancel}
            >
                <p>
                    Do you want to purchase a Self Mint authorization code for {' '}
                    <strong>{purchaseTokenAmount}{' '}BUX</strong>?
                </p>
            </Modal>
            {!tokenToMint ? (
                <ZeroBalanceHeader>
                    Would you like to mint new tokens?
                    <br />
                    Please provide a valid Self Mint Authorization Code
                </ZeroBalanceHeader>
            ) : (
                <>
                    <BalanceHeader
                        balance={tokenToMint.mintQuantity.toString()}
                        ticker={tokenToMint.ticker}
                    />
                </>
            )}

            <Row type="flex">
                <Col span={24}>
                    <Form
                        style={{
                            width: 'auto',
                        }}
                    >
                        {(!tokenToMint) && (
                            <>
                                <SelfMintAuthCode
                                    inputProps={{
                                        placeholder: `Enter Self Mint Authorization Code`,
                                        name: 'authcode',
                                        required: true,
                                        onChange: e => handleAuthCodeChange(e),
                                    }}
                                ></SelfMintAuthCode>
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
                            {!tokenToMint ? (
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
            {(!authCodeB64 || !tokenToMint) && (
                <>
                    <StyledSpacer />
                    <ZeroBalanceHeader>
                    Don't have an authorization code? Purchase one.
                    <br />
                    How many BUX tokens do you want to mint?
                    </ZeroBalanceHeader>
                    <Row type="flex">
                        <Col span={24}>
                            <Form
                                style={{
                                    width: 'auto',
                                }}
                            >
                                <SelfMintPurchaseAmount
                                    inputProps={{
                                        placeholder: `Amount Of BUX Tokens To Mint`,
                                        name: 'authcode',
                                        required: true,
                                        dollar: 1,
                                        onChange: e => handlePurchaseAmountChange(e),
                                    }}
                                ></SelfMintPurchaseAmount>
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
                                    {!purchaseTokenAmount ? (
                                        <SecondaryButton>Purchase Self Mint Authorization Code</SecondaryButton>
                                    ) : (
                                        <PrimaryButton
                                            onClick={() => setIsPurchaseModalVisible(true)}
                                        >
                                            Purchase Self Mint Authorization Code
                                        </PrimaryButton>
                                    )}
                                </div>
                                {apiError && <ApiError />}
                            </Form>
                        </Col>
                    </Row>
                </>
            )}
        </>
    );
};

/*
passLoadingStatus must receive a default prop that is a function
in order to pass the rendering unit test in SelfMint.test.js

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
