let aws;
let currencyFileAlerter;
let sendEmail;
let getObject;
let SES;
let S3;

function initMocks() {
    aws = require('aws-sdk');

    // aws.SES
    sendEmail = jest.fn((params, callback) => {
            callback(null, {});
    });
    SES = jest.fn(() => ({
        sendEmail: sendEmail
    }));
    aws.SES = SES;

    // aws.S3
    getObject = jest.fn((params, callback) => {
        callback(null, {
            Body: '{"dataAsOf":"2018-01-01","conversions":{"USD":{"AUD":1.2811,"BRL":3.2414,"CAD":1.2917,"CHF":0.94445,"CNY":6.3357,"CZK":20.471,"DKK":5.9983,"EUR":0.80509,"GBP":0.72027,"HKD":7.838,"HUF":251.2,"IDR":13779,"ILS":3.45,"INR":65.13,"JPY":106.13,"KRW":1071.8,"MXN":18.693,"MYR":3.9065,"NOK":7.8202,"NZD":1.3769,"PHP":52.046,"PLN":3.3848,"RUB":56.895,"SEK":8.2256,"SGD":1.3154,"THB":31.335,"TRY":3.8102,"ZAR":11.889},"GBP":{"AUD":1.7786,"BRL":4.5002,"CAD":1.7933,"CHF":1.3112,"CNY":8.7963,"CZK":28.421,"DKK":8.3278,"EUR":1.1178,"HKD":10.882,"HUF":348.76,"IDR":19130,"ILS":4.7898,"INR":90.424,"JPY":147.35,"KRW":1488.1,"MXN":25.952,"MYR":5.4237,"NOK":10.857,"NZD":1.9116,"PHP":72.258,"PLN":4.6993,"RUB":78.991,"SEK":11.42,"SGD":1.8263,"THB":43.504,"TRY":5.2899,"USD":1.3884,"ZAR":16.506}}}'
        });
    });
    S3 = jest.fn(() => ({
        getObject: getObject
    }));
    aws.S3 = S3;

    currencyFileAlerter = require('../src/prebidCurrencyRatesFileAlerter');
}

// Helper Constants
const SECONDS_IN_MINUTE = 60;
const SECONDS_IN_HOUR = 60 * SECONDS_IN_MINUTE;
const SECONDS_IN_DAY = SECONDS_IN_HOUR * 24;
// Mon Jan 01 2018 12:30:40 GMT-0800 (PST)
const TIME_IN_MS_JAN_1_2018 = 1514838640000;

const emailValidationRegEx = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;

describe(`Service aws-node-prebid-currency-rates-file-alerter:`, () => {
    beforeEach(() => {
        global.console.error = jest.fn();
        global.console.log = jest.fn();
        initMocks();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('Integration', () => {
        test('handler', () => {
            let dateNowSpy = jest.spyOn(global.Date, 'now').mockImplementation(() => {
                return (TIME_IN_MS_JAN_1_2018 + ((SECONDS_IN_DAY * 1000) * 4));
            });

            const context = {
                done: jest.fn()
            };
            const event = {
                type: 'test'
            };

            currencyFileAlerter.handler(event, context);
            expect(context.done).toBeCalledWith(null, {
                'message': 'The Prebid currency rates conversion data has a stale timestamp of 2018-01-01. Please check the generator logs for failures: https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#logStream:group=/aws/lambda/prebidCurrencyRatesFileGenerator;streamFilter=typeLogStreamPrefix'
            });
        });
    });

    describe('Unit Tests', () => {

        test('getDebug', () => {
            expect(currencyFileAlerter.spec.getDebug()).toBeTruthy();
            process.env.DEBUG = 0;
            expect(currencyFileAlerter.spec.getDebug()).toBeFalsy();
            process.env.DEBUG = 1;
            expect(currencyFileAlerter.spec.getDebug()).toBeTruthy();
            delete process.env.DEBUG;
            expect(currencyFileAlerter.spec.getDebug()).toBeTruthy();
        });

        test('getBucket', () => {
            expect(currencyFileAlerter.spec.getBucket()).toEqual('currency.prebid.org');
            process.env.S3_BUCKET = 'currency1.prebid.org';
            expect(currencyFileAlerter.spec.getBucket()).toEqual('currency1.prebid.org');
            delete process.env.S3_BUCKET;
            process.env.S3_BUCKET = 'currency1.prebid.org';
        });

        test('getFilename', () => {
            expect(currencyFileAlerter.spec.getFilename()).toEqual('latest.json');
            process.env.S3_FILENAME = 'latest1.json';
            expect(currencyFileAlerter.spec.getFilename()).toEqual('latest1.json');
            delete process.env.S3_FILENAME;
            process.env.S3_FILENAME = 'latest.json';
        });

        test('getAlertFrom', () => {
            expect(currencyFileAlerter.spec.getAlertFrom()).toEqual('alerts@prebid.org');
            process.env.ALERT_FROM = 'alerts1@prebid.org';
            expect(currencyFileAlerter.spec.getAlertFrom()).toEqual('alerts1@prebid.org');
            delete process.env.ALERT_FROM;
            expect(currencyFileAlerter.spec.getAlertFrom()).toEqual('alerts@prebid.org');
        });

        test('getAlertTo', () => {
            expect(currencyFileAlerter.spec.getAlertTo()).toEqual('alerts@prebid.org');
            process.env.ALERT_TO = 'alerts1@prebid.org';
            expect(currencyFileAlerter.spec.getAlertTo()).toEqual('alerts1@prebid.org');
            delete process.env.ALERT_TO;
            expect(currencyFileAlerter.spec.getAlertTo()).toEqual('alerts@prebid.org');
        });

        test('getStaleOlderThanDays', () => {
            expect(currencyFileAlerter.spec.getStaleOlderThanDays()).toEqual(2);
            process.env.STALE_OLDER_THAN_DAYS = 1;
            expect(currencyFileAlerter.spec.getStaleOlderThanDays()).toEqual(1);
            delete process.env.STALE_OLDER_THAN_DAYS;
            expect(currencyFileAlerter.spec.getStaleOlderThanDays()).toEqual(2);
        });

        test('log', () => {
            currencyFileAlerter.spec.log('log info');
            expect(global.console.log).toBeCalledWith('log info');
            currencyFileAlerter.spec.log({testTitle:'foo'});
            expect(global.console.log).toBeCalledWith({testTitle:'foo'});
            currencyFileAlerter.spec.log(null);
            expect(global.console.log).toBeCalledWith(null);
            currencyFileAlerter.spec.log(undefined);
            expect(global.console.log).toBeCalledWith(undefined);
        });

        test('logError', () => {
            currencyFileAlerter.spec.logError('line');
            expect(global.console.error).toBeCalledWith('line', undefined);
            currencyFileAlerter.spec.logError('line', 'error');
            expect(global.console.error).toBeCalledWith('line', 'error');
            currencyFileAlerter.spec.logError('line', {testTitle:'foo'});
            expect(global.console.error).toBeCalledWith('line', {testTitle:'foo'});
            currencyFileAlerter.spec.logError(null);
            expect(global.console.error).toBeCalledWith(null, undefined);
            currencyFileAlerter.spec.logError();
            expect(global.console.error).toBeCalledWith(undefined, undefined);
        });

        test('createResult', () => {
            expect(currencyFileAlerter.spec.createResult('file out of date')).toEqual({ message: 'file out of date' });
            expect(currencyFileAlerter.spec.createResult({ title: 'error result', errorCode: 100})).toEqual({ message: { title: 'error result', errorCode: 100} });
            expect(currencyFileAlerter.spec.createResult('')).toEqual({ message: '' });
            expect(currencyFileAlerter.spec.createResult(null)).toEqual({ message: null });
            expect(currencyFileAlerter.spec.createResult(undefined)).toEqual({ message: undefined });
        });

        test('createS3GetObjectParams', () => {
            expect(currencyFileAlerter.spec.createS3GetObjectParams('bucket1','key1')).toEqual({
                Bucket: 'bucket1',
                Key: 'key1'
            });

            expect(currencyFileAlerter.spec.createS3GetObjectParams('bucket1')).toBeUndefined();
            expect(global.console.error).toBeCalledWith('Error: missing argument for createS3GetObjectParams: key', undefined);

            expect(currencyFileAlerter.spec.createS3GetObjectParams(undefined, 'key1')).toBeUndefined();
            expect(global.console.error).toBeCalledWith('Error: missing argument for createS3GetObjectParams: bucket', undefined);

            expect(currencyFileAlerter.spec.createS3GetObjectParams({})).toBeUndefined();
            expect(global.console.error).toBeCalledWith('Error: missing argument for createS3GetObjectParams: key', undefined);

            expect(currencyFileAlerter.spec.createS3GetObjectParams(null)).toBeUndefined();
            expect(global.console.error).toBeCalledWith('Error: missing argument for createS3GetObjectParams: bucket', undefined);
        });

        test('s3GetObjectHandler', () => {
            const mockLoadSuccess = jest.spyOn(currencyFileAlerter.spec, 'currencyRatesLoadSuccess');
            const mockLoadError = jest.spyOn(currencyFileAlerter.spec, 'currencyRatesLoadError');
            const context = {
                done: jest.fn()
            };

            // validate console error runs and no function returned for invalid argument
            const s3GetObjHandlerError = currencyFileAlerter.spec.s3GetObjectHandler();
            expect(global.console.error).toBeCalledWith('Error: missing argument for s3GetObjectHandler: context', undefined);
            expect(s3GetObjHandlerError).toBeUndefined();

            // validate returned function
            const s3GetObjHandler = currencyFileAlerter.spec.s3GetObjectHandler(context);
            expect(s3GetObjHandler).toBeInstanceOf(Function);
            expect(s3GetObjHandler.name).toEqual('s3GetObjectCallback');
            expect(s3GetObjHandler.length).toBe(2);

            // test returned function
            s3GetObjHandler({}, undefined);
            expect(mockLoadError).toBeCalledWith({}, context);
            expect(mockLoadSuccess).not.toBeCalled();

            jest.resetAllMocks();

            s3GetObjHandler(undefined, {});
            expect(mockLoadSuccess).toBeCalledWith({}, context);
            expect(mockLoadError).not.toBeCalled();
        });

        test('currencyRatesLoadSuccess', () => {
            const context = {
                done: jest.fn()
            };

            let dateNowSpy = jest.spyOn(global.Date, 'now').mockImplementation(() => {
                return (TIME_IN_MS_JAN_1_2018 + (SECONDS_IN_DAY * 1000));
            });

            let mockDaysDifference = jest.spyOn(currencyFileAlerter.spec, 'daysDifference');

            const data = {
                Body: '{"dataAsOf":'+TIME_IN_MS_JAN_1_2018+'}'
            };

            currencyFileAlerter.spec.currencyRatesLoadSuccess(data, context);
            expect(mockDaysDifference).toBeCalledWith(TIME_IN_MS_JAN_1_2018, TIME_IN_MS_JAN_1_2018 + (SECONDS_IN_DAY * 1000));
            expect(context.done).toBeCalledWith(null, {
                message: 'The Prebid currency rates conversion data has a timestamp of 1514838640000, found not to be stale.'
            });

            jest.resetAllMocks();
            jest.restoreAllMocks();

            mockDaysDifference = jest.spyOn(currencyFileAlerter.spec, 'daysDifference');
            context.done = jest.fn();
            dateNowSpy = jest.spyOn(global.Date, 'now').mockImplementation(() => {
                return (TIME_IN_MS_JAN_1_2018 + ((SECONDS_IN_DAY * 1000) * 4));
            });

            const dataStale = {
                Body: '{"dataAsOf":'+(TIME_IN_MS_JAN_1_2018 - ((SECONDS_IN_DAY * 1000) * 4))+'}'
            };

            currencyFileAlerter.spec.currencyRatesLoadSuccess(dataStale, context);
            expect(mockDaysDifference).toBeCalledWith(1514493040000, 1515184240000);
        });

        test('currencyRatesLoadError', () => {
            const context = {
                done: jest.fn()
            };

            const mockLogError = jest.spyOn(currencyFileAlerter.spec, 'logError');
            const mockSendAlert = jest.spyOn(currencyFileAlerter.spec, 'sendAlert');

            let err = {
                message:'null obj',
                stack:'app.com.Main arg[0]'
            };

            currencyFileAlerter.spec.currencyRatesLoadError(err, context);
            expect(mockLogError).toBeCalledWith(err, err.stack);
            expect(mockSendAlert).toBeCalledWith({ message: 'Error reading currency rates file from S3: null obj' }, context);

            jest.resetAllMocks();

            currencyFileAlerter.spec.currencyRatesLoadError({ message:'load error', stack:'com.test.function arg[0]'}, {});
            expect(mockLogError).toBeCalledWith({ 'message': 'load error', 'stack': 'com.test.function arg[0]' }, 'com.test.function arg[0]');
            expect(mockSendAlert).toBeCalledWith({ message: 'Error reading currency rates file from S3: load error' }, {});
        });

        test('parseJson', () => {
            expect(currencyFileAlerter.spec.parseJson('{"foo":"bar"}')).toEqual({foo: 'bar'});
            expect(currencyFileAlerter.spec.parseJson('{"foo""11"}')).toBeUndefined();
            expect(global.console.error).toBeCalledWith('Error: malformed json:', '{"foo""11"}');
        });

        test('getFileStaleResult', () => {
            const fileStaleResult = currencyFileAlerter.spec.getFileStaleResult(TIME_IN_MS_JAN_1_2018, 2);
            expect(fileStaleResult).toEqual({
                stale: true,
                result: {
                    message: 'The Prebid currency rates conversion data has a stale timestamp of 1514838640000. Please check the generator logs for failures: https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#logStream:group=/aws/lambda/prebidCurrencyRatesFileGenerator;streamFilter=typeLogStreamPrefix'
                }
            });

            let dateNowSpy = jest.spyOn(global.Date, 'now').mockImplementation(() => {
                return (TIME_IN_MS_JAN_1_2018 + (SECONDS_IN_DAY * 1000));
            });

            const fileNotStaleResult = currencyFileAlerter.spec.getFileStaleResult(TIME_IN_MS_JAN_1_2018, 2);
            expect(fileNotStaleResult).toEqual({
                stale: false,
                result: {
                    message: 'The Prebid currency rates conversion data has a timestamp of 1514838640000, found not to be stale.'
                }
            });
        });

        test('daysDifference', () => {
            expect(currencyFileAlerter.spec.daysDifference(TIME_IN_MS_JAN_1_2018, (TIME_IN_MS_JAN_1_2018 + ((SECONDS_IN_DAY/3) * 1000)))).toBe(0);
            expect(currencyFileAlerter.spec.daysDifference(TIME_IN_MS_JAN_1_2018, (TIME_IN_MS_JAN_1_2018 + ((SECONDS_IN_DAY/2) * 1000)))).toBe(1);
            expect(currencyFileAlerter.spec.daysDifference(TIME_IN_MS_JAN_1_2018, (TIME_IN_MS_JAN_1_2018 + (SECONDS_IN_DAY * 1000)))).toBe(1);
            expect(currencyFileAlerter.spec.daysDifference(TIME_IN_MS_JAN_1_2018, (TIME_IN_MS_JAN_1_2018 + ((SECONDS_IN_DAY * 2) * 1000)))).toBe(2);
            expect(currencyFileAlerter.spec.daysDifference(TIME_IN_MS_JAN_1_2018, (TIME_IN_MS_JAN_1_2018 + ((SECONDS_IN_DAY * 30) * 1000)))).toBe(30);
            expect(currencyFileAlerter.spec.daysDifference(TIME_IN_MS_JAN_1_2018, (TIME_IN_MS_JAN_1_2018 + ((SECONDS_IN_DAY * 100) * 1000)))).toBe(100);
        });

        test('sendAlert', () => {
            const context = {
                done: jest.fn()
            };

            const resultMessage = {
                message: 'email sent'
            };

            const mockSendEmailHandler = jest.spyOn(currencyFileAlerter.spec, 'sendEmailHandler');

            currencyFileAlerter.spec.sendAlert(resultMessage, context);
            expect(mockSendEmailHandler).toBeCalledWith({
                'message': 'email sent'
            }, context);
            expect(context.done).toHaveBeenCalled();

            jest.resetAllMocks();

            currencyFileAlerter.spec.sendAlert(null, context);
            expect(global.console.error).toBeCalledWith('Error: missing argument for sendAlert: result', undefined);

            jest.resetAllMocks();

            currencyFileAlerter.spec.sendAlert({ message: '' }, context);
            expect(global.console.error).toBeCalledWith('Error: undefined variable in sendAlert: sendEmailParams', undefined);

            jest.resetAllMocks();

            currencyFileAlerter.spec.sendAlert(resultMessage, undefined);
            expect(global.console.error).toBeCalledWith('Error: missing argument for sendAlert: context', undefined);
        });

        test('createSendEmailParams', () => {
            const emailParamsValidationObj = {
                Destination: {
                    ToAddresses: expect.stringMatching(emailValidationRegEx),
                },
                Message: {
                    Subject: {
                        Data: expect.any(String),
                        Charset: 'UTF-8'
                    },
                    Body: {
                        Text: {
                            Data: expect.any(String),
                            Charset: 'UTF-8'
                        }
                    }
                },
                Source: expect.stringMatching(emailValidationRegEx),
                ReplyToAddresses: expect.arrayContaining([
                    expect.stringMatching(emailValidationRegEx)
                ])
            };

            const emailParams = currencyFileAlerter.spec.createSendEmailParams('currency file 1001 updated');
            expect(emailParams).toMatchObject(emailParamsValidationObj);
        });

        test('sendEmailHandler', () => {
            const fileStaleResult = {
                message:'currency file stale 1002'
            };
            const context = {
                done: jest.fn()
            };
            const awsError = {
                message: 'aws S3.sendEmail error',
                stack: 'org.test.error'
            };

            // test callback construction
            const callback = currencyFileAlerter.spec.sendEmailHandler(fileStaleResult, context);
            expect(callback).toBeInstanceOf(Function);
            expect(callback.name).toEqual('sendEmailCallback');
            expect(callback.length).toBe(2);

            // sendEmail error response
            callback(awsError, null);
            expect(global.console.error).toBeCalledWith({'message': 'aws S3.sendEmail error', 'stack': 'org.test.error'}, 'org.test.error');
            expect(context.done).toBeCalledWith(null, fileStaleResult);

            // sendEmail success response
            callback(null, {});
            expect(global.console.log).toBeCalledWith('Alert \'' + fileStaleResult.message + '\' sent.');
            expect(context.done).toBeCalledWith(null, fileStaleResult);
        });
    });
});