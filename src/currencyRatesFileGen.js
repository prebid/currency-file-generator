/**
 * @fileOverview Loads currency rates from api.fixer.io and creates and uploads a JSON representation to S3.
 * @version 0.0.1
 */
const http = require('http');
const aws = require('aws-sdk');

const fromCurrencies = ['USD', 'GBP'];
const supportedCurrencies = 'AUD,BRL,CAD,CHF,CNY,CZK,DKK,EUR,GBP,HKD,HUF,IDR,ILS,INR,JPY,KRW,MXN,MYR,NOK,NZD,PHP,PLN,RUB,SEK,SGD,THB,TRY,TWD,USD,ZAR';

// when to expire for HTTP "Expires:" header (seconds)
const expires = 24 * 3600 + 5;

/**
 * @returns {boolean} env variable value if set or default
 */
function getDebug() {
    return (typeof process.env.DEBUG !== 'undefined') ? (process.env.DEBUG === '1') : true;
}

/**
 *  env variable value if set or default
 * @returns {string}
 */
function getBucket() {
    return process.env.S3_BUCKET || 'currency.prebid.org';
}

/**
 * env variable value if set or default
 * @returns {string}
 */
function getFilename() {
    return process.env.S3_FILENAME || 'latest.json';
}

/**
 * The function AWS Lambda calls to start execution of your Lambda function.
 * You identify the handler when you create your Lambda function: IE
 * 'Handler':'currencyRatesFilesGen.handler'
 * @param event - AWS Lambda uses this parameter to pass in event data to the handler.
 * @param context - the context parameter contains functions to access runtime information
 */
exports.handler = function(event, context) {
    /** @type {Array.<Object>} - loaded and parsed json objects for currency */
    const results = [];
    console.log('fromCurrencies', fromCurrencies);

    for (let fromCurrency of fromCurrencies) {
        /** @type {string|undefined} */
        const currencyUrl = constructCurrencyUrl(fromCurrency, supportedCurrencies);
        if (!currencyUrl) {
            logError('Error: malformed currencyUrl', currencyUrl);
            // error, exit
            return;
        }

        // load currency json file from currency url
        requestCurrencyFile(currencyUrl, (json) => {
            if (json !== null && typeof json === 'object') {
                results.push(json);
            }
            else {
                logError('Error: malformed json:', json);
                // error, exit
                return;
            }

            // All results loaded when results count is equal to fromCurrencies count
            if (results.length === fromCurrencies.length) {
                const expiration = getExpiration(expires);
                if (!expiration) {
                    logError('Error: malformed expiration date:', expiration);
                    // error, exit
                    return;
                }

                const docParams = createDocumentParams(getBucket(), getFilename(), createDocument(results), expiration);
                if (!docParams) {
                    logError('Error: malformed docParams:', docParams);
                    // error, exit
                    return;
                }

                // upload json to S3 bucket at key
                // context.done() is called on complete/error
                uploadDocumentToS3(docParams, context);
            }
        });
    }
};

/**
 * @param {string} bucket
 * @param {string} filename
 * @param {Object} documentObj
 * @param {Date} expires - when to expire for HTTP "Expires:"
 * @return {S3UploadParams|undefined}
 */
function createDocumentParams(bucket, filename, documentObj, expires) {
    if (typeof bucket === 'string' && bucket !== '' &&
        typeof filename === 'string' && filename !== '' &&
        documentObj !== null && typeof documentObj === 'object' && !Array.isArray(documentObj) && Object.keys(documentObj).length > 0 &&
        documentObj !== null && typeof expires === 'object' && expires instanceof Date) {
        return {
            Bucket: bucket,
            Key: filename,
            Body: JSON.stringify(documentObj),
            Expires: expires
        }
    }
}

/**
 * @param {number} expires - when to expire for HTTP "Expires:" header (seconds)
 * @return {Date|undefined}
 */
function getExpiration(expires) {
    if (typeof expires === 'number' && !isNaN(expires)) {
        return new Date(new Date().getTime() + expires * 1000);
    }
}

/**
 * @param {string} fromCurrency
 * @param {string} supportedCurrencies
 * @returns {string|undefined}
 */
function constructCurrencyUrl(fromCurrency, supportedCurrencies) {
    if (typeof fromCurrency !== 'string' || fromCurrency === '') {
        logError('Error: invalid fromCurrency', fromCurrency + ' ' + Object.prototype.toString.call(fromCurrency));
        return undefined;
    }
    if (typeof supportedCurrencies !== 'string' || supportedCurrencies === '') {
        logError('Error: invalid supportedCurrencies', supportedCurrencies + ' ' + Object.prototype.toString.call(supportedCurrencies));
        return undefined;
    }
    return 'http://api.fixer.io/latest?base=' + fromCurrency + '&symbols=' + supportedCurrencies;
}

/**
 * @param {string} url
 * @param {function} fileEndCallback
 * @returns {http.ClientRequest}
 */
function requestCurrencyFile(url, fileEndCallback) {
    log('requesting: ' + url);

    return http.get(url, (res /** @type {http.IncomingMessage} */) => {
        let body = '';

        // the 'data' event is emitted whenever the stream is relinquishing ownership of a chunk of data to the consumer
        res.on('data', (chunk) => {
            body += chunk;
        });

        // the 'error' event emits if the stream is unable to generate data due to internal failure or from an invalid chunk of data
        res.on('error', (e) => {
            logError(e.message);
            fileEndCallback(undefined);
        });

        // The 'end' event is emitted after all data has been output.
        res.on('end', () => {
            if (body === '') {
                logError('Error: response body is empty');
                fileEndCallback(undefined);
            }
            try {
                const json = JSON.parse(body);
                fileEndCallback(json);
            }
            catch (e) {
                logError(e.message, body);
                fileEndCallback(undefined);
            }
        });
    });
}

/**
 * @typedef {Object} S3UploadParams
 * @property {string} Bucket - Name of the bucket to which the PUT operation was initiated.
 * @property {string} Key - Object key for which the PUT operation was initiated.
 * @property {Buffer|Array|Blob|String|ReadableStream} Body - Object data
 * @property {Date} Expires - The date and time at which the object is no longer cacheable.
 */

/**
 * @param {S3UploadParams} params
 * @param context
 */
function uploadDocumentToS3(params, context) {
    if (params === null || typeof params !== 'object') {
        logError('Error: invalid params argument passed to uploadDocumentToS3', params);
        return;
    }
    if (context === null || typeof context !== 'object' || !context.hasOwnProperty('done') || typeof context.done !== 'function') {
        logError('Error: invalid context argument passed to uploadDocumentToS3', context);
        return;
    }

    log('rates s3 upload to: ' + params.Bucket + ' ' + params.Key);

    // Upload assembled currency json to S3 bucket
    const s3 = new aws.S3();
    // upload callback executes context.done on complete or error
    return s3.upload(params, (e, data) => {
        if (e) {
            logError(e.lineNumber, e.message);
            context.done(null, JSON.stringify({filename: params.Key, error: data}));
        } else {
            log('rates pushed to s3: ' + params.Bucket + ' ' + params.Key);
            context.done(null, JSON.stringify({filename: params.Key}));
        }
    });
}

/**
 * @param {Array.<Object>} results
 * @returns {{dataAsOf: string, conversions: {}}}
 */
function createDocument(results) {
    const conversions = {};
    for (let cv = 0; cv < results.length; cv++) {
        conversions[results[cv].base] = results[cv].rates;
    }
    return {
        'dataAsOf': new Date().toDateString().split('T')[0],
        'conversions': conversions
    };
}

/**
 * @param {*} line
 */
function log(line) {
    if (getDebug()) console.log(line);
}

/**
 * @param {*} line
 * @param {*} error
 */
function logError(line, error) {
    console.error(line, error);
}


/**
 * Export internal functions for testing
 */
exports.spec = {
    getDebug,
    getFilename,
    getBucket,
    log,
    logError,
    constructCurrencyUrl,
    requestCurrencyFile,
    uploadDocumentToS3,
    createDocumentParams,
    getExpiration,
    createDocument
};