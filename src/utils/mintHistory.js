import localforage from "localforage";


export const writeMempoolMint = async (mempoolMint) => {
    try {
        const key = `externalMints-${mempoolMint.minter_pubkey}`;
        const mempoolMints = await localforage.getItem(key) || [];
        mempoolMints.push(mempoolMint);

        await localforage.setItem(key, mempoolMints);
        console.log("added item to storage", key, mempoolMints);
    } catch (err) {
        console.log(`Error in writeMempoolMint()`);
        console.log(err);
    }
}

export const getMempoolMints = async (minterPublicKey) => {
    try {
        const key = `externalMints-${minterPublicKey}`;
        const mempoolMints = await localforage.getItem(key);

        return mempoolMints || [];
    } catch(err) {
        console.log(`Error in getMempoolMints()`);
        console.log(err);
    }
}

export const updateMempoolMints = async (minterPublicKey, unconfirmedMints) => {
    try {
        const key = `externalMints-${minterPublicKey}`;
        if (unconfirmedMints.length === 0) {
            await localforage.removeItem(key);
            console.log("removed item with key", key);
        } else {
            await localforage.setItem(key, unconfirmedMints);
            console.log("updated item with key", key, unconfirmedMints);
        }
    } catch(err) {
        console.log(`Error in updateMempoolMints()`);
        console.log(err);
    }
}
