// prebidCurrencyRatesFileGenerator
// loads currency rates from api.fixer.io and creates a JSON representation in S3
// revision:
const http = require('http');
const aws = require('aws-sdk');

const fromCurrencies = ['USD', 'GBP'];
const supportedCurrencies = 'AUD,BRL,CAD,CHF,CNY,CZK,DKK,EUR,GBP,HKD,HUF,IDR,ILS,INR,JPY,KRW,MXN,MYR,NOK,NZD,PHP,PLN,RUB,SEK,SGD,THB,TRY,USD,ZAR';

const bucket = 'currency.prebid.org';
const filename = 'latest.json';
const debug = true;
const expires = 24 * 3600 + 5; // when to expire for HTTP "Expires:" header (seconds)

exports.handler = function(event, context) {
    const results = [];
    let countCompleted = 0;

    for (let fromCurrency of fromCurrencies) {
        const url = getCurrencyUrl(fromCurrency, supportedCurrencies);
        log('requesting: ' + url);

        requestCurrencyFile(url, body => {
            results.push(JSON.parse(body));
            countCompleted++;

            if (countCompleted === fromCurrencies.length) {
                log('rates s3 upload to: ' + bucket + ' ' + filename);
                uploadDocumentToS3(filename, bucket, createDocument(results), (e, data) =>  {
                    if (e) {
                        logError(e, e.stack);
                        context.done(null, JSON.stringify({ filename: filename, error: data }));
                    } else {
                        log('rates pushed to s3: ' + bucket + ' ' + filename);
                        context.done(null, JSON.stringify({ filename: filename }));
                    }
                });
            }
        });
    }
};

/**
 * @param {string} fromCurrency
 * @param {string} supportedCurrencies
 * @returns {string}
 */
function getCurrencyUrl(fromCurrency, supportedCurrencies) {
    return 'http://api.fixer.io/latest?base=' + fromCurrency + '&symbols=' + supportedCurrencies;
}

/**
 * @param {string} url
 * @param {function} fileEndCallback
 */
function requestCurrencyFile(url, fileEndCallback) {
    http.get(url, res => {
        let body = '';
        res.on('data', d => {
            body += d;
        });
        res.on('end', () => {
            fileEndCallback(body);
        });
    });
}

/**
 * @param {string} filename
 * @param {string} bucket
 * @param {Object} document
 * @param {function} completeCallback
 */
function uploadDocumentToS3(filename, bucket, document, completeCallback) {
    const s3 = new aws.S3();

    const param = {
        Bucket: bucket,
        Key: filename,
        Body: JSON.stringify(document),
        Expires: new Date(new Date().getTime() + expires * 1000)
    };

    s3.upload(param, completeCallback);
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

function log (line) {
    if (debug) console.log(line);
}

function logError (line, error) {
    console.error(line, error);
}

/* TEST:START */
exports.getCurrencyUrl = getCurrencyUrl;
exports.requestCurrencyFile = requestCurrencyFile;
exports.uploadDocumentToS3 = uploadDocumentToS3;
exports.createDocument = createDocument;
/* TEST:END */