import { 
    PaymentRequest,
    Payment,
    PaymentACK
} from "b70";

export const validatePrUrl = (urlString) => {
     // Check for BIP70
     try {
        const prUrl = new URL(urlString);
        if (prUrl.protocol === 'https:')
            return prUrl.href;
    } catch {
        return null;
    }
    return null;
}

export const getUrlFromQueryString = (queryString) => {
    if (typeof queryString !== 'string')
        return null;

    const [ queryParameter, queryData ] = queryString.split('=');
    if ( queryParameter === 'r') {
        // Check for BIP70
        return validatePrUrl(queryData);
    }
    return null;
}

const getAsArrayBuffer = (url, headers)  => {
    return new Promise((accept, reject) => {
        let req = new XMLHttpRequest();
        req.open("GET", url, true);
        Object.entries(headers).forEach(([key, value]) => {
            req.setRequestHeader(key, value);
        });
        req.responseType = "arraybuffer";

        req.onload = function(event) {
            let resp = req.response;

            if (resp) {
                accept(resp);
            }
        };

        req.onerror = function(err) {
            console.warn(err);
            reject(err);
        };

        req.send(null);
    });
};

const postAsArrayBuffer = (url, headers, body) => {
    return new Promise((accept, reject) => {
        let req = new XMLHttpRequest();

        req.open("POST", url, true);
        Object.entries(headers).forEach(([key, value]) => {
            req.setRequestHeader(key, value);
        });
        req.responseType = "arraybuffer";

        req.onload = function(event) {
            let resp = req.response;

            if (req.status === 400 || req.status === 404 || req.status === 500 || req.status === 402) {
                console.log(req)
                reject(
                new Error(
                    `Error processing payment, please check with the merchant and try again later.`,
                    { cause: {code: req.status} }
                )
                );
                return;
            }

            if (resp) {
                accept(resp);
            }
        };

        req.onerror = function(err) {
            console.warn(err);
            reject(err);
        };

        req.send(body);
    });
  };

export const getPaymentRequest = async (paymentRequestUrl, type) => {
    let paymentReq;
    const headers = {
        Accept: `application/${type}-paymentrequest`,
        "Content-Type": "application/octet-stream"
    };
    console.log('headers', headers)
    try {
        const res = await getAsArrayBuffer(paymentRequestUrl, headers);
        const resBuf = Buffer.from(res);
        paymentReq = PaymentRequest.fromRaw(resBuf);
    } catch (err) {
        console.log(err)
        throw new Error('Error fetching Payment Request')
    }

    if (!paymentReq.verifyChain())
            throw new Error('Invalid Payment Request certificate chain');

    if (!paymentReq.verify())
        throw new Error('Invalid Payment Request signature');

    return paymentReq;
}

/* default paymentObj = {
        merchantData: null,
        transactions: [],
        refundTo:[],
        memo:null
    } 
*/

export const postPayment = async (paymentUrl, paymentObj, type) => {
    const payment = new Payment(paymentObj);
    // serialize and send
    const rawbody = payment.toRaw();
    const headers = {
        Accept:
        `application/${type}-paymentrequest, application/${type}-paymentack`,
        "Content-Type": `application/${type}-payment`,
        "Content-Transfer-Encoding": "binary"
    };

    const rawPaymentResponse = await postAsArrayBuffer(
        paymentUrl,
        headers,
        rawbody
    );

    const responseBuf = Buffer.from(rawPaymentResponse);
    const ack = PaymentACK.fromRaw(responseBuf);

    return ack;
}
