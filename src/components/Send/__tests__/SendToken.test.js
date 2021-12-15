import React from 'react';
import renderer from 'react-test-renderer';
import { ThemeProvider } from 'styled-components';
import { theme } from '@assets/styles/theme';
import SendToken from '@components/Send/SendToken';
import {
    walletWithBalancesAndTokensWithCorrectState,
} from '../../Wallet/__mocks__/walletAndBalancesMock';
import { BrowserRouter as Router } from 'react-router-dom';

let realUseContext;
let useContextMock;

beforeEach(() => {
    realUseContext = React.useContext;
    useContextMock = React.useContext = jest.fn();

    // Mock method not implemented in JSDOM
    // See reference at https://jestjs.io/docs/manual-mocks#mocking-methods-which-are-not-implemented-in-jsdom
    Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation(query => ({
            matches: false,
            media: query,
            onchange: null,
            addListener: jest.fn(), // Deprecated
            removeListener: jest.fn(), // Deprecated
            addEventListener: jest.fn(),
            removeEventListener: jest.fn(),
            dispatchEvent: jest.fn(),
        })),
    });
});

afterEach(() => {
    React.useContext = realUseContext;
});

test('Wallet with BCH balances and tokens and state field', () => {
    useContextMock.mockReturnValue(walletWithBalancesAndTokensWithCorrectState);
    const component = renderer.create(
        <ThemeProvider theme={theme}>
            <Router>
                <SendToken
                    tokenId={
                        'bd1acc4c986de57af8d6d2a64aecad8c30ee80f37ae9d066d758923732ddc9ba'
                    }
                />
            </Router>
        </ThemeProvider>,
    );
    let tree = component.toJSON();
    expect(tree).toMatchSnapshot();
});

test('Without wallet defined', () => {
    useContextMock.mockReturnValue({
        wallet: {},
        loading: false,
    });
    expect(() => {
        renderer.create(
            <ThemeProvider theme={theme}>
                <Router>
                    <SendToken
                        tokenId={
                            'bd1acc4c986de57af8d6d2a64aecad8c30ee80f37ae9d066d758923732ddc9ba'
                        }
                    />
                </Router>
            </ThemeProvider>,
        );
    }).toThrow('balance');
});
