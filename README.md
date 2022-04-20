# Cashtab

## eCash Web Wallet

![CashAppHome](./screenshots/ss-readme.png)

### Features

-   Send & Receive XEC and eTokens
-   Import existing wallets
-   Sign messages using wallet private key
-   [BIP70](https://github.com/bitcoin/bips/blob/master/bip-0070.mediawiki) and [Simple Ledger Payment Protocol](https://github.com/simpleledger/slp-specifications/blob/master/slp-payment-protocol.md) Support
-   [Simple Ledger Postage Protocol](https://github.com/simpleledger/slp-specifications/blob/master/slp-postage-protocol.md) Support
-   [Simple Ledger Self Mint Token](https://github.com/badger-cash/slp-self-mint-protocol/blob/master/selfmint-specification.md) Support
-   [SLP Token Type 1 Burn](https://github.com/badger-cash/slp-self-mint-protocol/blob/master/token-type1-burn.md) Support

## Development

```
yarn install
yarn start
```

Runs the app in the development mode.<br>
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

The page will reload if you make edits.<br>
You will also see any lint errors in the console.

## Testing

Run the tests in watch mode (interactive):

```
yarn test
```

Run the tests and generate a coverage report (non-interactive):

```
yarn run test:coverage
```

You can then browse the HTML coverage report by opening the
`coverage/lcov-report/index.html` file in your web browser.

## Production

In the project directory, run:

```
yarn run build
```

Builds the app for production to the `build` folder.<br>
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.<br>
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

## Browser Extension

1. `yarn run extension`
2. Open Chrome or Brave
3. Navigate to `chrome://extensions/` (or `brave://extensions/`)
4. Enable Developer Mode
5. Click "Load unpacked"
6. Select the `extension/dist` folder that was created with `yarn run extension`

## Docker deployment

```
yarn install
docker-compose build
docker-compose up
```

## Bcash full node HTTP API

Cashtab accepts multiple instances of `bcash` HTTP API as its backend. Input your desired API URL 
into the `REACT_APP_BCASH_API` variable. For example

```
REACT_APP_BCASH_API=https://ecash.badger.cash:8332
```

## Cashtab Roadmap

The following features are under active development:

-   Cashtab browser extension
