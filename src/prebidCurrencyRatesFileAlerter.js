/**
 * @fileOverview Checks for stale currency files and sends an alert email
 * @version 0.0.1
 */
const aws = require('aws-sdk');
const s3 = new aws.S3();
const ses = new aws.SES();

/**
 * The function AWS Lambda calls to start execution of your Lambda function.
 * You identify the handler when you create your Lambda function: IE
 * 'Handler':'prebidCurrencyRatesFileAlerter.handler'
 * @param event - AWS Lambda uses this parameter to pass in event data to the handler.
 * @param context - the context parameter contains functions to access runtime information
 */
exports.handler = (event, context) => {
    spec.log('Event: ' + JSON.stringify(event));

    const objectRequestParams = spec.createS3GetObjectParams(spec.getBucket(), spec.getFilename());
    if (!objectRequestParams) {
        return;
    }
    const s3GetObjectHandler = spec.s3GetObjectHandler(context);
    if (!s3GetObjectHandler) {
        return;
    }

    s3.getObject(objectRequestParams, s3GetObjectHandler);
};

/**
 * Export internal functions for testing
 */
const spec = {
    /**
     * @returns {boolean} env variable value if set or default
     */
    getDebug() {
        return (typeof process.env.DEBUG !== 'undefined') ? (process.env.DEBUG === '1') : true;
    },

    /**
     *  env variable value if set or default
     * @returns {string}
     */
    getBucket() {
        return process.env.S3_BUCKET || 'currency.prebid.org';
    },

    /**
     * env variable value if set or default
     * @returns {string}
     */
    getFilename() {
        return process.env.S3_FILENAME || 'latest.json';
    },

    /**
     * env variable value if set or default
     * @returns {string}
     */
    getAlertFrom() {
        return process.env.ALERT_FROM || 'alerts@prebid.org';
    },

    /**
     * env variable value if set or default
     * @returns {string}
     */
    getAlertTo() {
        return process.env.ALERT_TO || 'alerts@prebid.org';
    },

    /**
     * env variable value if set or default
     * @returns {number}
     */
    getStaleOlderThanDays() {
        return parseFloat(process.env.STALE_OLDER_THAN_DAYS) || 2;
    },

    /**
     * env variable value if set or default
     * @returns {number}
     */
    getAlertSubject() {
        return parseFloat(process.env.ALERT_SUBJECT) || 'ALERT: Prebid Currency Rates File Monitor';
    },

    /**
     * @param {string} message
     * @returns {{message:string}}
     */
    createResult(message) {
        return {
            'message': message
        };
    },

    /**
     * @returns {{Bucket: string, Key: string}|undefined}
     * @param bucket
     * @param key
     */
    createS3GetObjectParams(bucket, key) {
        if (!bucket) {
            spec.logArgumentError('createS3GetObjectParams', 'bucket');
            return undefined;
        }
        if (!key) {
            spec.logArgumentError('createS3GetObjectParams', 'key');
            return undefined;
        }
        return {
            Bucket: bucket,
            Key: key
        };
    },

    /**
     * @param context
     * @returns {function|undefined} - complete callback for AWS S3.getObject(params, "callback")
     */
    s3GetObjectHandler(context) {
        if (!context) {
            spec.logArgumentError('s3GetObjectHandler', 'context');
            return undefined;
        }
        return function s3GetObjectCallback(err /** @type {AWSError} */, data /** @type {GetObjectOutput} */) {
            if (!err) {
                spec.currencyRatesLoadSuccess(data, context);
            } else {
                spec.currencyRatesLoadError(err, context);
            }
        };
    },

    /**
     * @param {GetObjectOutput} data
     * @param context
     */
    currencyRatesLoadSuccess(data, context) {
        if (!data) {
            spec.logArgumentError('currencyRatesLoadSuccess', 'data');
            return;
        }
        if (!context) {
            spec.logArgumentError('currencyRatesLoadSuccess', 'context');
            return;
        }

        const currencyRates = spec.parseJson(data.Body.toString());
        if (!currencyRates) {
            spec.logVariableError('currencyRatesLoadSuccess', 'currencyRates');
            return;
        }

        const fileResult = spec.getFileStaleResult(currencyRates.dataAsOf, getStaleOlderThanDays());
        if (!fileResult) {
            spec.logVariableError('currencyRatesLoadSuccess', 'fileResult');
            return;
        }

        if (fileResult.stale) {
            spec.logError(fileResult.result.message);
            spec.sendAlert(fileResult.result, context);
        }
        else {
            spec.log(fileResult.result.message);
            context.done(null, fileResult.result);
        }
    },

    /**
     * @param {AWSError} err
     * @param context
     */
    currencyRatesLoadError(err, context) {
        if (!err) {
            spec.logArgumentError('currencyRatesLoadError', 'err');
            return;
        }
        if (!context) {
            spec.logArgumentError('currencyRatesLoadError', 'context');
            return;
        }

        spec.logError(err, err.stack);
        spec.sendAlert(spec.createResult('Error reading currency rates file from S3: ' + err.message), context);
    },

    /**
     * @param {string} data
     * @returns {Object|undefined}
     */
    parseJson(data) {
        if (!data) {
            spec.logArgumentError('parseJson', 'data');
            return undefined;
        }

        let currencyRates;
        try {
            currencyRates = JSON.parse(data);
        }
        catch (e) {
            spec.logError('Error: malformed json:', data);
        }
        return currencyRates;
    },

    /**
     * @param dataAsOf
     * @param {number} staleOlderThanDays
     * @returns {{stale:boolean, result:{message:string}|undefined}}
     */
    getFileStaleResult(dataAsOf, staleOlderThanDays) {
        if (!dataAsOf) {
            spec.logArgumentError('getFileStaleResult', 'dataAsOf');
            return undefined;
        }
        if (!staleOlderThanDays) {
            spec.logArgumentError('getFileStaleResult', 'staleOlderThanDays');
            return undefined;
        }
        const fileDateResult = {
            stale: false
        };

        const daysSinceCurrencyFile = spec.daysDifference(new Date(dataAsOf), new Date());

        if (daysSinceCurrencyFile > staleOlderThanDays) {
            fileDateResult.stale = true;
            fileDateResult.result = spec.createResult('The Prebid currency rates conversion data has a stale timestamp of '
                + dataAsOf + '. Please check the generator logs for failures: '
                + 'https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#logStream:group=/aws/lambda/prebidCurrencyRatesFileGenerator;streamFilter=typeLogStreamPrefix');
        } else {
            fileDateResult.result = spec.createResult('The Prebid currency rates conversion data has a timestamp of ' + dataAsOf + ', found not to be stale.');
        }

        return fileDateResult;
    },

    /**
     * @param {Date} first
     * @param {Date} second
     * @returns {number}
     */
    daysDifference(first, second) {
        return Math.round((second - first) / (1000 * 60 * 60 * 24));
    },

    /**
     * @param {{message:string}} result
     * @param context
     */
    sendAlert(result, context) {
        if (!result) {
            spec.logArgumentError('sendAlert', 'result');
            return undefined;
        }
        if (!context) {
            spec.logArgumentError('sendAlert', 'context');
            return undefined;
        }

        const sendEmailParams = spec.createSendEmailParams(result.message);

        if (!sendEmailParams) {
            spec.logVariableError('sendAlert', 'sendEmailParams');
            return;
        }

        const sendEmailCallback = spec.sendEmailHandler(result, context);
        if (!sendEmailCallback) {
            spec.logVariableError('sendAlert', 'sendEmailCallback');
            return;
        }

        ses.sendEmail(sendEmailParams, sendEmailCallback);
    },

    /**
     * @param {string} message
     * @returns {{Destination: {ToAddresses: Array<string>}, Message: {Subject: {Data: string, Charset: string}, Body: {Text: {Data: string|*, Charset: string}}}, Source: string, ReplyToAddresses: *[]}}
     */
    createSendEmailParams(message) {
        if (!message) {
            spec.logArgumentError('createSendEmailParams', 'message');
            return undefined;
        }

        return {
            Destination: {
                ToAddresses: spec.getAlertTo()
            },
            Message: {
                Subject: {
                    Data: spec.getAlertSubject(),
                    Charset: 'UTF-8'
                },
                Body: {
                    Text: {
                        Data: message,
                        Charset: 'UTF-8'
                    }
                }
            },
            Source: spec.getAlertFrom(),
            ReplyToAddresses: [spec.getAlertFrom()]
        };
    },

    /**
     * @param {{message:number}} result
     * @param context
     * @returns {function|undefined} - complete callback for AWS SES.sendEmail(params, "callback")
     */
    sendEmailHandler(result, context) {
        if (!result) {
            spec.logArgumentError('sendEmailHandler', 'result');
            return undefined;
        }
        if (!context) {
            spec.logArgumentError('sendEmailHandler', 'context');
            return undefined;
        }

        return function sendEmailCallback(err /** {AWSError} */, data /** @type {SendEmailResponse} */) {
            if (err) {
                spec.logError(err, err.stack);
            } else {
                spec.log('Alert \'' + result.message + '\' sent. ');
            }
            context.done(null, result);
        };
    },

    /**
     * @param {*} line
     */
    log(line) {
        if (spec.getDebug()) console.log(line);
    },

    /**
     * @param {*} line
     * @param {*} error
     */
    logError(line, error) {
        console.error(line, error);
    },

    /**
     * @param {string} functionName
     * @param {string} argumentName
     */
    logArgumentError(functionName, argumentName) {
        spec.logError('Error: missing argument for ' + functionName + ': ' + argumentName);
    },

    /**
     * @param {string} functionName
     * @param {string} variableName
     */
    logVariableError(functionName, variableName) {
        spec.logError('Error: undefined variable in ' + functionName + ': ' + variableName);
    }
};
exports.spec = spec;