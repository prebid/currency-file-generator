/**
 * Loads currency rates from api.fixer.io and creates a JSON representation in S3.
 * @fileOverview prebidCurrencyRatesFileGenerator
 * @author Rubicon Project
 * @version 1.0.1
 */

const http = require('http');
const aws = require('aws-sdk');

const fromCurrencies = ['USD', 'GBP'];
const supportedCurrencies = 'AUD,BRL,CAD,CHF,CNY,CZK,DKK,EUR,GBP,HKD,HUF,IDR,ILS,INR,JPY,KRW,MXN,MYR,NOK,NZD,PHP,PLN,RUB,SEK,SGD,THB,TRY,USD,ZAR';

const bucket = 'currency.prebid.org';
const filename = 'latest.json';
const expires = 24 * 3600 + 5; // when to expire for HTTP "Expires:" header (seconds)

const currencyAlertsEmail = 'alerts@prebid.org';

const debug = true;

/**
 * @typedef {Object} S3UploadParams
 * @property {string} Bucket - Name of the bucket to which the PUT operation was initiated.
 * @property {string} Key - Object key for which the PUT operation was initiated.
 * @property {Buffer|Array|Blob|String|ReadableStream} Body - Object data
 * @property {Date} Expires - The date and time at which the object is no longer cacheable.
 */

/**
 * @typedef {Object} FileProps
 * @property {string} filename
 * @property {ManagedUpload.SendData|undefined} error
 */

/**
 * The function AWS Lambda calls to start execution of your Lambda function.
 * You identify the handler when you create your Lambda function: IE 'Handler':'currencyRatesFilesGen.handler'
 * @param event - AWS Lambda uses this parameter to pass in event data to the handler.
 * @param context - the context parameter contains functions to access runtime information
 */
exports.handler = function(event, context) {
    /**
     * @type {Array.<Object>}
     */
    const results = [];

    for (let fromCurrency of fromCurrencies) {
        /**
         * @type {string|undefined}
         */
        const currencyUrl = constructCurrencyUrl(fromCurrency, supportedCurrencies);
        if (!currencyUrl) {
            return;
        }

        requestCurrencyFile(currencyUrl, (json) => {
            // if there was an error requesting currency file, json will be 'undefined'
            if (typeof json !== 'undefined') {
                results.push(json);
            }

            if (results.length && fromCurrencies.length) {
                const expiration = getExpiration(expires);

                const docParams = createDocumentParams(bucket, filename, createDocument(results), expiration);

                if (docParams !== null && typeof docParams === 'object') {
                    uploadDocumentToS3(docParams, context);
                }
                else {
                    logError('Error uploadDocumentToS3 was not executed because docParams is undefined');
                }
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
    return undefined;
}

/**
 * @param {number} expires - when to expire for HTTP "Expires:" header (seconds)
 * @return {Date|undefined}
 */
function getExpiration(expires) {
    if (typeof expires === 'number' && !isNaN(expires)) {
        return new Date(new Date().getTime() + expires * 1000);
    }
    logError('Error: Invalid \"expiration\" value:', expires + ' ' + Object.prototype.toString.call(expires));
    return undefined;
}

/**
 * @param {string} fromCurrency
 * @param {string} supportedCurrencies
 * @returns {string|undefined}
 */
function constructCurrencyUrl(fromCurrency, supportedCurrencies) {
    if (typeof fromCurrency !== 'string' || fromCurrency === '') {
        logError('Error: currencyUrl, has invalid \"fromCurrency\"', fromCurrency + ' ' + Object.prototype.toString.call(fromCurrency));
        return undefined;
    }
    if (typeof supportedCurrencies !== 'string' || supportedCurrencies === '') {
        logError('Error: currencyUrl, has invalid \"supportedCurrencies\"', supportedCurrencies + ' ' + Object.prototype.toString.call(supportedCurrencies));
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
 * @param {S3UploadParams} params
 * @param context
 */
function uploadDocumentToS3(params, context) {
    if (params === null || typeof params !== 'object') {
        logError('#176', 'invalid \"params\" argument passed to \"uploadDocumentToS3\"');
        return;
    }

    if (context === null || typeof context !== 'object' || !context.hasOwnProperty('done') || typeof context.done !== 'function') {
        logError('#181', 'invalid \"context\" argument passed to \"uploadDocumentToS3\"');
        return;
    }

    log('rates s3 upload to: ' + params.Bucket + ' ' + params.Key);
    /**
     * @type {S3}
     */
    const s3 = new aws.S3();
    /**
     * Uploads an arbitrarily sized buffer, blob, or stream
     * See {@link https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#upload-property} for more information
     */
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
    /**
     * @type {Object}
     */
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
 * @param {string} line
 */
function log(line) {
    if (debug) console.log(line);
}

/**
 * @param {string} line
 * @param {string|Error|Object} error
 */
function logError(line, error) {
    console.error(line, error);
}

exports.spec = {
    constructCurrencyUrl,
    requestCurrencyFile,
    uploadDocumentToS3,
    createDocumentParams,
    getExpiration,
    createDocument
};