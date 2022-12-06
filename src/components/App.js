import React, { useState, Suspense, lazy } from 'react';
import 'antd/dist/antd.less';
import { Spin } from 'antd';
import { CashLoadingIcon, LoadingBlock } from '@components/Common/CustomIcons';
import '../index.css';
import styled, { ThemeProvider, createGlobalStyle } from 'styled-components';
import { theme } from '@assets/styles/theme';
import {
    FolderOpenFilled,
    CaretRightOutlined,
    SettingFilled,
    AppstoreAddOutlined,
} from '@ant-design/icons';
// import Wallet from '@components/Wallet/Wallet';
const Wallet = lazy(() => import('./Wallet/Wallet'));
// import Tokens from '@components/Tokens/Tokens';
const Tokens = lazy(() => import('./Tokens/Tokens'));
// import Send from '@components/Send/Send';
const Send = lazy(() => import('./Send/Send'));
// import SendToken from '@components/Send/SendToken';
const SendToken = lazy(() => import('./Send/SendToken'));
// import Checkout from '@components/Send/Checkout';
const Checkout = lazy(() => import('./Send/Checkout'));
// import SendBip70 from '@components/Send/SendBip70';
const SendBip70 = lazy(() => import('./Send/SendBip70'));
// import Configure from '@components/Configure/Configure';
const Configure = lazy(() => import('./Configure/Configure'));
// import SelfMint from './Send/SelfMint';
const SelfMint = lazy(() => import('./Send/SelfMint'));
// import NotFound from '@components/NotFound';
const NotFound = lazy(() => import('./NotFound'));
import CashTab from '@assets/cashtab_xec.png';
import './App.css';
import { WalletContext } from '@utils/context';
import { isValidStoredWallet } from '@utils/cashMethods';
import WalletLabel from '@components/Common/WalletLabel.js';
import {
    Route,
    Redirect,
    Switch,
    useLocation,
    useHistory,
} from 'react-router-dom';
// Easter egg imports not used in extension/src/components/App.js
import TabCash from '@assets/tabcash.png';
import ABC from '@assets/logo_topright.png';
import { checkForTokenById } from '@utils/tokenMethods.js';
// Biometric security import not used in extension/src/components/App.js
import ProtectableComponentWrapper from './Authentication/ProtectableComponentWrapper';

const GlobalStyle = createGlobalStyle`    
    .ant-modal-wrap > div > div.ant-modal-content > div > div > div.ant-modal-confirm-btns > button, .ant-modal > button, .ant-modal-confirm-btns > button, .ant-modal-footer > button, #cropControlsConfirm {
        border-radius: 8px;
        background-color: ${props => props.theme.modals.buttons.background};
        color: ${props => props.theme.wallet.text.secondary};
        font-weight: bold;
    }    
    
    .ant-modal-wrap > div > div.ant-modal-content > div > div > div.ant-modal-confirm-btns > button:hover,.ant-modal-confirm-btns > button:hover, .ant-modal-footer > button:hover, #cropControlsConfirm:hover {
        color: ${props => props.theme.primary};
        transition: color 0.3s;
        background-color: ${props => props.theme.modals.buttons.background};
    }   
    .selectedCurrencyOption {
        text-align: left;
        color: ${props => props.theme.wallet.text.secondary} !important;
        background-color: ${props => props.theme.contrast} !important;
    }
    .cashLoadingIcon {
        color: ${props => props.theme.primary} !important;
        font-size: 48px !important;
    }
    .selectedCurrencyOption:hover {
        color: ${props => props.theme.contrast} !important;
        background-color: ${props => props.theme.primary} !important;
    }
    #addrSwitch, #cropSwitch {
        .ant-switch-checked {
            background-color: white !important;
        }
    }
    #addrSwitch.ant-switch-checked, #cropSwitch.ant-switch-checked {
        background-image: ${props =>
            props.theme.buttons.primary.backgroundImage} !important;
    }

    .ant-slider-rail {
        background-color: ${props => props.theme.forms.border} !important;
    }
    .ant-slider-track {
        background-color: ${props => props.theme.primary} !important;
    }
`;

const CustomApp = styled.div`
    text-align: center;
    font-family: 'Plus Jakarta Sans', sans-serif;
    background-color: ${props => props.theme.app.background};
`;

const Footer = styled.div`
    z-index: 2999;
    background-color: ${props => props.theme.footer.background};
    border-radius: 20px 20px 0 0;
    position: fixed;
    bottom: 0;
    width: 500px;
    box-shadow: 0px -34px 20px rgba(0, 0, 0, 0.02), 0px -15px 15px rgba(0, 0, 0, 0.03), 0px -4px 8px rgba(0, 0, 0, 0.03), 0px 0px 0px rgba(0, 0, 0, 0.03);
    @media (max-width: 768px) {
        width: 100%;
    }
`;

export const NavButton = styled.button`
    :focus,
    :active {
        outline: none;
    }
    cursor: pointer;
    padding: 24px 12px 12px 12px;
    margin: 0 28px;
    @media (max-width: 475px) {
        margin: 0 20px;
    }
    @media (max-width: 420px) {
        margin: 0 12px;
    }
    @media (max-width: 350px) {
        margin: 0 8px;
    }
    background-color: ${props => props.theme.footer.background};
    border: none;
    font-size: 10.5px;
    font-weight: bold;
    .anticon {
        display: block;
        color: ${props => props.theme.footer.navIconInactive};
        font-size: 24px;
        margin-bottom: 6px;
    }
    ${({ active, ...props }) =>
        active &&
        `    
        color: ${props.theme.primary};
        .anticon {
            color: ${props.theme.primary};
        }
  `}
`;

export const WalletBody = styled.div`
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    min-height: 100vh;
    background: #d5d5d5;
`;

export const WalletCtn = styled.div`
    position: relative;
    width: 500px;
    background-color: ${props => props.theme.footerBackground};
    min-height: 100vh;
    padding: 10px 30px 120px 30px;
    background: ${props => props.theme.wallet.background};
    box-shadow: 0px 8px 15px rgba(0, 0, 0, 0.1), 0px 3px 6px rgba(0, 0, 0, 0.05);
    @media (max-width: 768px) {
        width: 100%;
        -webkit-box-shadow: none;
        -moz-box-shadow: none;
        box-shadow: none;
    }
`;

export const HeaderCtn = styled.div`
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    padding: 10px 0 0px;
    margin-bottom: 20px;
    justify-content: flex-end;

    a {
        color: ${props => props.theme.wallet.text.secondary};

        :hover {
            color: ${props => props.theme.primary};
        }
    }

    @media (max-width: 768px) {
        a {
            font-size: 12px;
        }
        padding: 10px 0 20px;
    }
`;

export const CashTabLogo = styled.img`
    width: 55px;
    margin-left: 8px;
`;

// AbcLogo styled component not included in extension, replaced by open in new tab link
export const AbcLogo = styled.img`
    width: 70px;
`;

// Easter egg styled component not used in extension/src/components/App.js
export const EasterEgg = styled.img`
    position: fixed;
    bottom: -195px;
    margin: 0;
    right: 10%;
    transition-property: bottom;
    transition-duration: 1.5s;
    transition-timing-function: ease-out;

    :hover {
        bottom: 0;
    }

    @media screen and (max-width: 1250px) {
        display: none;
    }
`;

const App = () => {
    const ContextValue = React.useContext(WalletContext);
    const { wallet, loading } = ContextValue;
    const [loadingUtxosAfterSend, setLoadingUtxosAfterSend] = useState(false);
    // If wallet is unmigrated, do not show page until it has migrated
    // An invalid wallet will be validated/populated after the next API call, ETA 10s
    const validWallet = isValidStoredWallet(wallet);
    const location = useLocation();
    const history = useHistory();
    const selectedKey =
        location && location.pathname ? location.pathname.substr(1) : '';

    // Easter egg boolean not used in extension/src/components/App.js
    const hasTab = validWallet
        ? checkForTokenById(
              wallet.state.tokens,
              '50d8292c6255cda7afc6c8566fed3cf42a2794e9619740fe8f4c95431271410e',
          )
        : false;
    
    const codeSplitLoader = <LoadingBlock>{CashLoadingIcon}</LoadingBlock>;

    const navRedirect = (key) => {
            window.history.replaceState(null, '', window.location.origin);
            history.push(`/${key}`)
    }

    return (
        <ThemeProvider theme={theme}>
            <GlobalStyle />
            <Spin
                spinning={
                    loading || loadingUtxosAfterSend || (wallet && !validWallet)
                }
                indicator={CashLoadingIcon}
            >
                <CustomApp>
                    <WalletBody>
                        <WalletCtn>
                            <HeaderCtn>
                                {/*Begin component not included in extension as desktop only*/}
                                {hasTab && (
                                    <EasterEgg src={TabCash} alt="tabcash" />
                                )}
                                {/*End component not included in extension as desktop only*/}
                                {/*Begin component not included in extension as replaced by open in tab link*/}
                                <a
                                    href="https://e.cash/"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    <AbcLogo src={ABC} alt="abc" />
                                </a>
                                <CashTabLogo src={CashTab} alt="cashtab" />
                                {/*Begin component not included in extension as replaced by open in tab link*/}
                            </HeaderCtn>
                            <ProtectableComponentWrapper>
                            <WalletLabel name={wallet.name}></WalletLabel>
                                <Suspense fallback={codeSplitLoader}>
                                    <Switch>
                                        <Route path="/wallet">
                                            <Wallet />
                                        </Route>
                                        <Route path="/tokens">
                                            <Tokens
                                                passLoadingStatus={
                                                    setLoadingUtxosAfterSend
                                                }
                                            />
                                        </Route>
                                        <Route path="/send">
                                            <Send
                                                passLoadingStatus={
                                                    setLoadingUtxosAfterSend
                                                }
                                            />
                                        </Route>
                                        <Route
                                            path="/send-token/:tokenId"
                                            render={props => (
                                                <SendToken
                                                    tokenId={
                                                        props.match.params.tokenId
                                                    }
                                                    passLoadingStatus={
                                                        setLoadingUtxosAfterSend
                                                    }
                                                />
                                            )}
                                        />
                                        <Route path="/checkout">
                                            <Checkout
                                                passLoadingStatus={
                                                    setLoadingUtxosAfterSend
                                                }
                                            />
                                        </Route>
                                        <Route path="/sendBip70">
                                            <SendBip70
                                                passLoadingStatus={
                                                    setLoadingUtxosAfterSend
                                                }
                                            />
                                        </Route>
                                        <Route path="/selfMint">
                                            <SelfMint
                                                passLoadingStatus={
                                                    setLoadingUtxosAfterSend
                                                }
                                            />
                                        </Route>
                                        <Route path="/configure">
                                            <Configure />
                                        </Route>
                                        <Redirect exact from="/" to="/wallet" />
                                        <Route component={NotFound} />
                                    </Switch>
                                </Suspense>
                            </ProtectableComponentWrapper>
                        </WalletCtn>
                        {wallet ? (
                            <Footer>
                                <NavButton
                                    active={selectedKey === 'wallet'}
                                    onClick={() => navRedirect('wallet')}
                                >
                                    <FolderOpenFilled />
                                    Wallet
                                </NavButton>

                                <NavButton
                                    active={selectedKey === 'tokens'}
                                    onClick={() => navRedirect('tokens')}
                                >
                                    <AppstoreAddOutlined />
                                    eTokens
                                </NavButton>

                                <NavButton
                                    active={selectedKey === 'send'}
                                    onClick={() => navRedirect('send')}
                                >
                                    <CaretRightOutlined />
                                    Send
                                </NavButton>
                                <NavButton
                                    active={selectedKey === 'configure'}
                                    onClick={() => navRedirect('configure')}
                                >
                                    <SettingFilled />
                                    Settings
                                </NavButton>
                            </Footer>
                        ) : null}
                    </WalletBody>
                </CustomApp>
            </Spin>
        </ThemeProvider>
    );
};

export default App;
