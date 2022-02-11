import React from 'react';
import PropTypes from 'prop-types';
import styled from 'styled-components';
import makeBlockie from 'ethereum-blockies-base64';
import { Img } from 'react-image';
import { currency } from '@components/Common/Ticker';
import { authPubKeys } from '@utils/selfMint';

const TokenIcon = styled.div`
    height: 32px;
    width: 32px;
`;

const BalanceAndTicker = styled.div`
    font-size: 1rem;
`;

const TokenName = styled.div`
    font-size: 1rem;
    overflow: hidden;
`;

const Wrapper = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 15px 25px;
    border-radius: 16px;
    background: ${props => props.theme.tokenListItem.background};
    margin-bottom: 10px;
    box-shadow: ${props => props.theme.tokenListItem.boxShadow};
    border: 1px solid ${props => props.theme.tokenListItem.border};

    :hover {
        transform: translateY(-2px);
        box-shadow: rgb(136 172 243 / 25%) 0px 10px 30px,
            rgb(0 0 0 / 3%) 0px 1px 1px, rgb(0 51 167 / 10%) 0px 10px 20px;
        transition: all 0.8s cubic-bezier(0.075, 0.82, 0.165, 1) 0s;
    }
`;

const TokenListItem = ({ ticker, balance, tokenId, name }) => {
    const srcUrls = [`${currency.tokenIconsUrl}/32/${tokenId}.png`]
    const authPubKey = authPubKeys.find(authObj => 
        authObj.tokenId == tokenId && authObj.imageUrl
    );
    if (authPubKey)
        srcUrls.push(authPubKey.imageUrl);

    return (
        <Wrapper>
            <TokenIcon>
                {currency.tokenIconsUrl !== '' ? (
                    <Img
                        src={srcUrls}
                        width={32}
                        height={32}
                        unloader={
                            <img
                                alt={`identicon of tokenId ${tokenId} `}
                                height="32"
                                width="32"
                                style={{
                                    borderRadius: '50%',
                                }}
                                key={`identicon-${tokenId}`}
                                src={makeBlockie(tokenId)}
                            />
                        }
                    />
                ) : (
                    <img
                        alt={`identicon of tokenId ${tokenId} `}
                        height="32"
                        width="32"
                        style={{
                            borderRadius: '50%',
                        }}
                        key={`identicon-${tokenId}`}
                        src={makeBlockie(tokenId)}
                    />
                )}
            </TokenIcon>
            <TokenName>
                <strong>{name}</strong>
            </TokenName>
            <BalanceAndTicker>
                {balance} <strong>{ticker}</strong>
            </BalanceAndTicker>
        </Wrapper>
    );
};

TokenListItem.propTypes = {
    name: PropTypes.string,
    ticker: PropTypes.string,
    balance: PropTypes.string,
    tokenId: PropTypes.string,
};

export default TokenListItem;
