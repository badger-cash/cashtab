import React from 'react';
import PropTypes from 'prop-types';
import { useHistory } from 'react-router-dom';
import { WalletContext } from '@utils/context';
import { fromSmallestDenomination, getWalletState } from '@utils/cashMethods';
import TokenIconAlert from '@components/Common/Alerts.js';

import CreateTokenForm from '@components/Tokens/CreateTokenForm';
import { currency } from '@components/Common/Ticker.js';
import TokenList from '@components/Wallet/TokenList';
import useBCH from '@hooks/useBCH';
import BalanceHeader from '@components/Common/BalanceHeader';
import BalanceHeaderFiat from '@components/Common/BalanceHeaderFiat';
import { ZeroBalanceHeader, AlertMsg } from '@components/Common/Atoms';
import ApiError from '@components/Common/ApiError';
import styled from 'styled-components';
import PrimaryButton from '@components/Common/PrimaryButton';

const StyledSpacer = styled.div`
    height: 1px;
    width: 100%;
    background-color: ${props => props.theme.wallet.borders.color};
    margin: 60px 0 50px;
`;

const Tokens = ({ jestBCH, passLoadingStatus }) => {
    /*
    Dev note

    This is the first new page created after the wallet migration to include state in storage

    As such, it will only load this type of wallet

    If any user is still migrating at this point, this page will display a loading spinner until
    their wallet has updated (ETA within 10 seconds)

    Going forward, this approach will be the model for Wallet, Send, and SendToken, as the legacy
    wallet state parameters not stored in the wallet object are deprecated
    */

    const { wallet, apiError, fiatPrice, cashtabSettings } =
        React.useContext(WalletContext);
    const walletState = getWalletState(wallet);
    const { balances, tokens } = walletState;

    const { getBcashRestUrl, createToken } = useBCH();

    const history = useHistory();

    return (
        <>
            {!balances.totalBalance ? (
                <>
                    <ZeroBalanceHeader>
                        You need some {currency.ticker} in your wallet to create
                        tokens.
                    </ZeroBalanceHeader>
                    <BalanceHeader balance={0} ticker={currency.ticker} />
                </>
            ) : (
                <>
                    <BalanceHeader
                        balance={balances.totalBalance}
                        ticker={currency.ticker}
                    />
                    {fiatPrice !== null && !isNaN(balances.totalBalance) && (
                        <BalanceHeaderFiat
                            balance={balances.totalBalance}
                            settings={cashtabSettings}
                            fiatPrice={fiatPrice}
                        />
                    )}
                </>
            )}
            <TokenIconAlert />
            {apiError && <ApiError />}
            <CreateTokenForm
                getBcashRestUrl={getBcashRestUrl}
                createToken={createToken}
                disabled={balances.totalBalanceInSatoshis < currency.dustSats}
                passLoadingStatus={passLoadingStatus}
            />
            {balances.totalBalanceInSatoshis < currency.dustSats && (
                <AlertMsg>
                    You need at least{' '}
                    {fromSmallestDenomination(currency.dustSats).toString()}{' '}
                    {currency.ticker} (
                    {cashtabSettings
                        ? `${
                              currency.fiatCurrencies[
                                  cashtabSettings.fiatCurrency
                              ].symbol
                          } `
                        : '$ '}
                    {(
                        fromSmallestDenomination(currency.dustSats).toString() *
                        fiatPrice
                    ).toFixed(4)}{' '}
                    {cashtabSettings
                        ? `${currency.fiatCurrencies[
                              cashtabSettings.fiatCurrency
                          ].slug.toUpperCase()} `
                        : 'USD'}
                    ) to create a token
                </AlertMsg>
            )}

            {tokens && tokens.length > 0 ? (
                <>
                    <TokenList tokens={tokens} />
                </>
            ) : (
                <>No {currency.tokenTicker} tokens in this wallet</>
            )}
            <StyledSpacer />
            <PrimaryButton
                onClick={() => history.push('/selfmint')}
            >
                Self Mint Tokens
            </PrimaryButton>
        </>
    );
};

/*
passLoadingStatus must receive a default prop that is a function
in order to pass the rendering unit test in Tokens.test.js

status => {console.log(status)} is an arbitrary stub function
*/

Tokens.defaultProps = {
    passLoadingStatus: status => {
        console.log(status);
    },
};

Tokens.propTypes = {
    passLoadingStatus: PropTypes.func,
};

export default Tokens;
