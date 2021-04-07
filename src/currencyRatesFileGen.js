/**
 ** @fileOverview Loads currency rates from the European Central Bank and uploads a JSON representation to github.
 ** @version 2.0
 **/
'use strict';
const https = require('https');
const aws = require('aws-sdk');
const fs = require('fs');
const path = require('path');
const process = require('process');
const {requestJSONData, requestXMLData} = require('./ajax.js');
const {runCommand} = require('./shell.js');

const {GITHUB_TOKEN, GITHUB_USERNAME, GITHUB_EMAIL} = process.env;
// leaving this without https:// in order to reuse it when adding the remote
const gitRepositoryURL = 'github.com/prebid/currency-file.git';
const repositoryName = 'currency-file';
const PURGE_URL = 'https://purge.jsdelivr.net/gh/prebid/currency-file@1/latest.json';
const fromCurrencies = ['USD', 'GBP'];
// when to expire for HTTP "Expires:" header (seconds)
const expires = 24 * 3600 + 5;

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
 * @returns {boolean} env variable value if set or default
 */
function getDebug() {
    return (typeof process.env.DEBUG !== 'undefined') ? (process.env.DEBUG === '1') : true;
}


// gets the current git version and increments the third level
function incGitTag() {
    let output = runCommand('git describe --abbrev=0 --tags', {stdio: 'pipe'});
    if (output && output !== "") {
        let versionArray;
        versionArray = output.split(".");
        if (versionArray.length !== 3) {
            logError("invalid version: " + version);
        }
        var version3 = parseInt(versionArray[2]);
        if (isNaN(version3)) {
            logError("invalid version: " + version);
        }
        var newVersion = versionArray[0] + "." + versionArray[1] + "." + (version3 + 1);
        console.log('new tag version', newVersion);
        // write tag
        output = runCommand(`git tag ${newVersion}`);
        console.log("version updated to " + newVersion);
    } else {
        logError("git describe output was invalid");
    }
}

async function downloadPublish(event, context) {
    process.env['PATH'] = process.env['PATH'] + ':' + process.env['LAMBDA_TASK_ROOT']

    // first try to get the data from the source

    /** @type {Array.<Object>} - loaded and parsed json objects for currency */
    let responses;
    try {
        responses = await fetchCurrencyResponsesAsPromise();
    } catch (e) {
        context.fail(e);
        return;
    }
    const expiration = getExpiration(expires);
    if (!expiration) {
        logError(`Error: malformed expiration date: ${expiration}`, context);
        return;
    }

    const newDocument = createDocument(responses);

    // for a transition period we send to github and then write to S3
    if (pushToGithub(newDocument) < 0) {
        logError("failure pushing to github", context);
        return;
    }

    const docParams = createDocumentParams(getBucket(), getFilename(), newDocument, expiration);
    if (!docParams) {
        const error = 'Error: malformed docParams:';
        logError(error, context);
        return;
    }
    // upload json to S3 bucket at key
    console.log('awaiting upload');
    uploadDocumentToS3(docParams, context);

    console.log('awaiting purge');
    await purgeCache(PURGE_URL, context);

    return "success";
}

module.exports.downloadPublish = downloadPublish;

// Based on https://gist.github.com/Loopiezlol/e00c35b0166b4eae891ec6b8d610f83c
function pushToGithub(newDocument) {
    // now push the file up to git
    // change the cwd to /tmp
    process.chdir('/tmp')
    const randomPrefix = getRandomString(7);
    // adding prefix to make possibility of cloning repository before s3 removes the previous one downloaded
    const nameWithPrefix = `${randomPrefix}_${repositoryName}`
    // clone the repository and set it as the cwd
    runCommand(`git clone --quiet https://${gitRepositoryURL} ${nameWithPrefix}`);
    process.chdir(path.join(process.cwd(), nameWithPrefix))
    runCommand(`git pull --ff-only`);
    // update local file
    fs.writeFileSync('latest.json', JSON.stringify(newDocument));

    // update local git config with email and username (required)
    runCommand(`git config --local user.email ${GITHUB_EMAIL}`)
    runCommand(`git config --local user.name ${GITHUB_USERNAME}`)
    // stage local files
    runCommand('git add .')
    // commit changes
    runCommand('git commit -m "commit by :robot:"')
    if (incGitTag() < 0) {
        logError("incGitTag failed");
        return (-1);
    }
    // replace the remote with an authenticated one
    runCommand('git remote rm origin')
    runCommand(`git remote add origin https://${GITHUB_USERNAME}:${GITHUB_TOKEN}@${gitRepositoryURL}`);
    // push changes to remote
    runCommand('git push --porcelain --set-upstream origin master')
    runCommand('git push --porcelain origin --tags')
    return (0);
}

function getRandomString(length) {
    var result = [];
    var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for (var i = 0; i < length; i++) {
        result.push(characters.charAt(Math.floor(Math.random() *
            charactersLength)));
    }
    return result.join('');
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
 * @param {Array.<Object>} results
 * @returns {{dataAsOf: string, conversions: {}}}
 */
function createDocument(results) {
    const conversions = {};
    for (let cv = 0; cv < results.length; cv++) {
        conversions[results[cv].base] = results[cv].rates;
    }
    return {
        'dataAsOf': new Date().toISOString(),
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
 * @param {String} error
 * @param {Object} Context
 */
function logError(error, context) {
    console.error(error);
    if (context && typeof context === 'object' && typeof context.fail === 'function') {
        context.fail(error);
    }
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
        logError(`Error: invalid params argument passed to uploadDocumentToS3: ${params}`, context);
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
            logError(e.message, context);
            context.done(null, JSON.stringify({filename: params.Key, error: data}));
        } else {
            log('rates pushed to s3: ' + params.Bucket + ' ' + params.Key);
            context.done(null, JSON.stringify({filename: params.Key}));
        }
    });
}

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
        documentObj !== null && typeof documentObj === 'object' && !Array.isArray(documentObj)
        && Object.keys(documentObj).length > 0 && typeof expires === 'object' && expires instanceof Date) {
        return {
            Bucket: bucket,
            Key: filename,
            Body: JSON.stringify(documentObj),
            Expires: expires
        }
    }
}

async function fetchCurrencyResponsesAsPromise() {
    const promise = new Promise((resolve, reject) => {
        requestXMLData('https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml', resolve, reject);
    });
    const data = await promise;
    const currencyData = data["gesmes:Envelope"]["Cube"][0]["Cube"][0];
    let currencyObjects = normalizeData(currencyData)
    currencyObjects.forEach(currency => validateCurrencyData(currency))

    return currencyObjects;
}

function normalizeData(currencyData) {
    if (!currencyData) {
        throw new Error(`Error: currency data is not present`);
    }
    const currencyRates = currencyData["Cube"];
    const currencyDate = currencyData["$"]["time"];
    const currencyObjects = currencyRates.map(data => {
        return Object.create({
            currency: data["$"]["currency"],
            rate: data["$"]["rate"]
        });
    })
    let requestedCurrencies = currencyObjects.filter(curObj => fromCurrencies.includes(curObj.currency));
    return requestedCurrencies.map(obj => createCurrencyResponse(obj, currencyObjects, currencyDate));
}

function createCurrencyResponse(currencyObject, currencyData, currencyDate) {
    let response = Object.create({});
    response["base"] = currencyObject.currency;
    response["date"] = currencyDate;
    let rate = Object.create({});
    currencyData.forEach(data => {
        rate[data.currency] = data.rate / currencyObject.rate;
    })
    // Downloaded file contains every currency rate related to EUR, but does not have EUR entry
    rate["EUR"] = 1 / currencyObject.rate;
    response["rates"] = rate;
    return response;
}

function validateCurrencyData(json) {
    if (!json || typeof json !== 'object') {
        throw new Error(`Error: json data failed validation`);
    }
    if (!json.base || !json.date || typeof json.rates !== 'object' || Object.keys(json.rates).length < 20) {
        throw new Error(`Error: json data failed validation: ${json}`);
    }
}

async function purgeCache(url, context) {

    const promise = new Promise((resolve, reject) => {
        requestJSONData(url, resolve, reject);
    });
    const data = await promise;
    if (data) {
        console.log('successfully purged cache', data);
    } else {
        logError('error purging cache', context);
    }
}

/**
 * Export internal functions for testing
 */
exports.spec = {
    getDebug,
    log,
    logError,
    pushToGithub,
    getExpiration,
    createDocument,
    incGitTag,
    uploadDocumentToS3,
    getFilename,
    getBucket,
    createDocumentParams,
    purgeCache,
    downloadPublish
};
