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
    let countCompleted = 0;

    for (let fromCurrency of fromCurrencies) {
        /**
         * @type {string}
         */
        const currencyUrl = constructCurrencyUrl(fromCurrency, supportedCurrencies);

        /**
         * This object is created internally and returned from http.request().
         * @type {http.ClientRequest} - documented at https://nodejs.org/api/http.html#http_class_http_clientrequest
         */
        const currencyFileRequest = requestCurrencyFile(currencyUrl, (json) => {
            results.push(json);
            countCompleted++;

            if (countCompleted === fromCurrencies.length) {
                const docParams = createDocumentParams(bucket, filename, createDocument(results));
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
 * @return {S3UploadParams}
 */
function createDocumentParams(bucket, filename, documentObj, expires) {
    return {
        Bucket: bucket,
        Key: filename,
        Body: JSON.stringify(documentObj),
        Expires: expires
    }
}

/**
 * @param {number} expires - when to expire for HTTP "Expires:" header (seconds)
 * @return {Date}
 */
function getExpiration(expires) {
    return new Date(new Date().getTime() + expires * 1000);
}

/**
 * @param {string} fromCurrency
 * @param {string} supportedCurrencies
 * @returns {string}
 */
function constructCurrencyUrl(fromCurrency, supportedCurrencies) {
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
        res.on('data', (chunk) => { body += chunk; });

        // the 'error' event emits if the stream is unable to generate data due to internal failure or from an invalid chunk of data
        res.on('error', (e) => {
            logError('request error', e);
        });

        // The 'end' event is emitted after all data has been output.
        res.on('end', () => {
            try {
                const json = JSON.parse(body);
                fileEndCallback(json);
            }
            catch (e) {
                logError('error parsing response', e);
            }
        });
    });
}

/**
 * @param {S3UploadParams} params
 * @param context
 */
function uploadDocumentToS3(params, context) {
    log('rates s3 upload to: ' + params.Bucket + ' ' + params.Key);

    /**
     * @type {S3}
     */
    const s3 = new aws.S3();

    /**
     * Uploads an arbitrarily sized buffer, blob, or stream
     * See {@link https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#upload-property} for more information
     */
    s3.upload(params, (e, data) => {
        /** @type {FileProps} */
        let fileProps;

        if (e) {
            logError(e.toString(), e.stack);
            fileProps = { filename: params.Key, error: data };
        } else {
            log('rates pushed to s3: ' + params.Bucket + ' ' + params.Key);
            fileProps = { filename: params.Key, error: data };
        }

        context.done(null, JSON.stringify(fileProps));
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
function log (line) {
    if (debug) console.log(line);
}

/**
 * @param {string} line
 * @param {string|Error|Object} error
 */
function logError (line, error) {
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