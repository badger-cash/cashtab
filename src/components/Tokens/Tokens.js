import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { useHistory } from 'react-router-dom';
import { WalletContext } from '@utils/context';
import { getWalletState } from '@utils/cashMethods';
import { currency } from '@components/Common/Ticker.js';
import TokenList from '@components/Wallet/TokenList';
import useBCH from '@hooks/useBCH';
import BalanceHeader from '@components/Common/BalanceHeader';
import BalanceHeaderFiat from '@components/Common/BalanceHeaderFiat';
import ApiError from '@components/Common/ApiError';
import styled from 'styled-components';
import PrimaryButton, { SecondaryButton } from '@components/Common/PrimaryButton';
import MintHistory from '@components/Wallet/MintHistory';
import { getMempoolMints, updateMempoolMints } from '@utils/mintHistory';



const StyledSpacer = styled.div`
    height: 1px;
    width: 100%;
    background-color: ${props => props.theme.wallet.borders.color};
    margin: 50px 0 50px;
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

    const { getBcashRestUrl, createToken, getMintHistory } = useBCH();

    const history = useHistory();

    const [mintHistory, setMintHistory] = useState(null);

    const getSelfMintTokens = async (tokenIds) => {
        let tokens = [];
        for (let i = 0; i < tokenIds.length; i++) {
            const tokenData = await fetch(
                `${getBcashRestUrl()}/token/${tokenIds[i]}`
            ).then(res => res.json());
            tokens.push(tokenData);
        }
        return tokens;
    }

    const onMintHistory = async (minterPublicKey) => {
        // get mempool mints from local storage and indexed mints from stats api
        const mempoolMints = await getMempoolMints(minterPublicKey);
        const indexedMints = await getMintHistory(minterPublicKey); 
        const indexedMintsTxids = indexedMints.map(mint => mint.txid);
        
        // keep mints as unconfirmed if not already indexed
        const unconfirmedMints = mempoolMints.filter(mint => 
            !indexedMintsTxids.includes(mint.txid)
        );
        
        // update storage if some mints have been confirmed
        const updateRequired = unconfirmedMints.length !== mempoolMints.length;
        if (updateRequired) 
            await updateMempoolMints(minterPublicKey, unconfirmedMints);

        const mintTxs = unconfirmedMints.concat(indexedMints);

        // get token data for minted tokens
        const uniqueTokenIds = mintTxs.map(tx => tx.token_id)
            .filter((value, index, array) => array.indexOf(value) === index);
        const tokens = await getSelfMintTokens(uniqueTokenIds);
            
        // process data to use regular Tx Object
        const mintHistory = mintTxs.map(function(tx) {
            const tokenInfo = tokens.find(({ tokenId }) => tokenId === tx.token_id);
            const divisor = 10 ** tokenInfo.decimals;
            tx.outgoingTx = true;
            tx.tokenTx = true;
            tx.tokenInfo = {
                tokenId: tokenInfo.tokenId,                    
                tokenName: tokenInfo.name,
                transactionType: 'MINT',
                qtySent: +(tx.mint_total_amount / divisor).toFixed(tokenInfo.decimals),
            };
            return tx;
        });

        setMintHistory(mintHistory);
    };

    return (
        <>
            {!balances.totalBalance ? (
                <>
{/*                     <ZeroBalanceHeader>
                        You need some {currency.ticker} in your wallet to create
                        tokens.
                    </ZeroBalanceHeader> */}
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
            {/* <TokenIconAlert /> */}
            {apiError && <ApiError />}
{/*             <CreateTokenForm
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
            )} */}
            <StyledSpacer />
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

            <StyledSpacer />
            <SecondaryButton onClick={() => onMintHistory(wallet.Path1899.publicKey)}>
                Show Mint History
            </SecondaryButton>
            {mintHistory && ( 
                <>  
                    {mintHistory?.length > 0 ? (
                        <MintHistory 
                            txs={mintHistory}
                            fiatPrice={fiatPrice}
                            fiatCurrency={
                                cashtabSettings && cashtabSettings.fiatCurrency
                                    ? cashtabSettings.fiatCurrency
                                    : 'usd'
                            }
                        />                                                
                    ) : (
                        <p>No mint history available</p>
                    )}
                </>
            )}
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
