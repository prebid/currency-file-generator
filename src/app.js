/**
 ** @fileOverview Loads currency rates from the European Central Bank and uploads a JSON representation to github.
 ** @version 2.0
 **/
'use strict';
const https = require('https');
const aws = require('aws-sdk');
const fs = require('fs')
const path = require('path')
const process = require('process')
const { spawnSync } = require('child_process')

const { GITHUB_TOKEN, GITHUB_USERNAME, GITHUB_EMAIL } = process.env
// leaving this without https:// in order to reuse it when adding the remote
const gitRepositoryURL = 'github.com/prebid/currency-file.git'
const repositoryName = 'currency-file'

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
    return process.env.S3_FILENAME || 'latest-test.json';
}

/**
* @returns {boolean} env variable value if set or default
*/
function getDebug() {
    return (typeof process.env.DEBUG !== 'undefined') ? (process.env.DEBUG === '1') : true;
}

// runs a git command
function runCommand(commandString, options) {
    // console.log("in runCommand: " + commandString);
    const [command, ...args] = commandString.match(/(".*?")|(\S+)/g)
    const cmd = spawnSync(command, args, options)
    // console.log("after spawnsync: " + JSON.stringify(cmd));
    const errorString = cmd.stderr.toString()
    if (errorString) {
        console.log('throwing error', errorString);
        throw new Error(
            `Git command failed
      ${commandString}
      ${errorString}`
        )
    }
}

// gets the current git version and increments the third level
function incGitTag() {
    var result = spawnSync('git', ['describe', '--abbrev=0', '--tags'], { stdio: 'pipe' });
    var errorString = result.stderr.toString()
    if (errorString) {
        logError("incGitTag error: " + errorString);
        return (-1);
    }
    var output = result.stdout.toString();
    if (output && output != "") {
        // console.log("incGitTag output: " + output);
        var versionArray;
        versionArray = output.split(".");
        if (versionArray.length != 3) {
            logError("invalid version: " + version);
            return (-1);
        }
        var version3 = parseInt(versionArray[2]);
        if (isNaN(version3)) {
            logError("invalid version: " + version);
            return (-1);
        }
        console.log('NEW VERSION');

        var newVersion = versionArray[0] + "." + versionArray[1] + "." + (version3 + 1);
        console.log(newVersion);
        // write tag
        result = spawnSync('git', ['tag', newVersion]);
        var errorString = result.stderr.toString()
        if (errorString) {
            logError("git tag error: " + errorString);
            return (-1);
        }
        console.log("version updated to " + newVersion);
    } else {
        logError("git describe output was invalid");
        return (-1);
    }
}

module.exports.downloadPublish = async function (event, context, callback) {
    process.env['PATH'] = process.env['PATH'] + ':' + process.env['LAMBDA_TASK_ROOT']

    // install git binary
    await require('lambda-git')()

    // first try to get the data from the source

    /** @type {Array.<Object>} - loaded and parsed json objects for currency */
    //console.log('fromCurrencies', fromCurrencies);
    const urls = [];
    fromCurrencies.forEach((fromCurrency)=> urls.push(constructCurrencyUrl(fromCurrency)));
    let responses;
    try{
        responses = await fetchMultipleUrlsAsPromise(urls);
    }
    catch(e){
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
    // context.done() is called on complete/error
    uploadDocumentToS3(docParams, context);

    return "success";
}

// Based on https://gist.github.com/Loopiezlol/e00c35b0166b4eae891ec6b8d610f83c
// TODO clean up and add tests
function pushToGithub(newDocument) {

    // now push the file up to git
    // change the cwd to /tmp
    process.chdir('/tmp')
    // clone the repository and set it as the cwd
    runCommand(`git clone --quiet https://${gitRepositoryURL}`);
    process.chdir(path.join(process.cwd(), repositoryName))
    runCommand(`git pull`);
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
    runCommand(
        `git remote add origin https://${GITHUB_USERNAME}:${GITHUB_TOKEN}@${gitRepositoryURL}`
    )
    // push changes to remote
    runCommand('git push --porcelain --set-upstream origin master')
    runCommand('git push --porcelain origin --tags')
    return (0);
}

// TODO - clear jsdelivr cache
// Purge cache
// jsDelivr has an easy to use API to purge files from the cache and force the files to update. This is useful when you release a new version and want to force the update of all version aliased users.
//
// To avoid abuse, access to purge is given after an email request (for now - dak@prospectone.io).


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
 * @returns {string|undefined}
 */
function constructCurrencyUrl(fromCurrency) {
    if (typeof fromCurrency !== 'string' || fromCurrency === '') {
        logError('Error: invalid fromCurrency', fromCurrency + ' ' + Object.prototype.toString.call(fromCurrency));
        return undefined;
    }
    return 'https://api.exchangeratesapi.io/latest?base=' + fromCurrency;
}

/**
 * @param {string} url
 * @param {function} fileEndCallback
 * @returns {http.ClientRequest}
 * TODO: add promise style rejections. 
 */
function requestCurrencyFile(url, fileEndCallback) {
    log('requesting: ' + url);

    return https.get(url, (res /** @type {https.IncomingMessage} */) => {
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
 * @param {Array.<Object>} results
 * @returns {{dataAsOf: string, conversions: {}}}
 */
function createDocument(results) {
    const conversions = {};
    for (let cv = 0; cv < results.length; cv++) {
        conversions[results[cv].base] = results[cv].rates;
    }
    return {
        'dataAsOf': new Date().toISOString().split('T')[0],
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
    if(typeof context === 'object') {
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
            logError(e.lineNumber, e.message);
            context.done(null, JSON.stringify({ filename: params.Key, error: data }));
        } else {
            log('rates pushed to s3: ' + params.Bucket + ' ' + params.Key);
            context.done(null, JSON.stringify({ filename: params.Key }));
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

async function fetchMultipleUrlsAsPromise(fetchUrls){
    const responses = [];
    for (let url of fetchUrls) {
        const promise = new Promise((resolve, reject) => {
            requestCurrencyFile(url, resolve);
        });
        const data = await promise;
        validateCurrencyData(data);
        responses.push(data);
    }
    return responses;
}

function validateCurrencyData(json) {
    if(!json || typeof json !== 'object') {
        throw new Error(`Error: json data failed validation`);
    }
    if (!json.base || !json.date || typeof json.rates !== 'object' || Object.keys(json.rates).length < 20) {
        throw new Error(`Error: json data failed validation: ${json}`);
    }
}

/**
 * Export internal functions for testing
 */
exports.spec = {
    getDebug,
    log,
    logError,
    constructCurrencyUrl,
    requestCurrencyFile,
    pushToGithub,
    getExpiration,
    createDocument,
    runCommand,
    incGitTag,
    uploadDocumentToS3,
    getFilename,
    getBucket,
    createDocumentParams
};
