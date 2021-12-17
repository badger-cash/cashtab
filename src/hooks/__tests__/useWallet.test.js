import useWallet from '../useWallet';
import { renderHook } from '@testing-library/react-hooks';
import mockLegacyWallets from '../__mocks__/mockLegacyWallets';

jest.mock('../useBCH');

test('Migrating legacy wallet on testnet', async () => {
    const { result } = renderHook(() => useWallet());
    process = {
        env: {
            REACT_APP_NETWORK: `testnet`,
            REACT_APP_BCASH_API:'https://ecash.badger.cash:8332',
        },
    };

    result.current.getWallet = false;
    let wallet;
    wallet = await result.current.migrateLegacyWallet(
        mockLegacyWallets.legacyAlphaTestnet,
    );
    expect(wallet).toStrictEqual(mockLegacyWallets.migratedLegacyAlphaTestnet);
});

test('Migrating legacy wallet on mainnet', async () => {
    const { result } = renderHook(() => useWallet());
    process = {
        env: {
            REACT_APP_NETWORK: `mainnet`,
            REACT_APP_BCASH_API:'https://ecash.badger.cash:8332'
        },
    };

    result.current.getWallet = false;
    let wallet;
    wallet = await result.current.migrateLegacyWallet(
        mockLegacyWallets.legacyAlphaMainnet,
    );
    expect(wallet).toStrictEqual(mockLegacyWallets.migratedLegacyAlphaMainnet);
});
