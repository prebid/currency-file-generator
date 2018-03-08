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
        callback.call(null, {});
    });
    SES = jest.fn(() => ({
        sendEmail: sendEmail
    }));
    aws.SES = SES;

    // aws.S3
    getObject = jest.fn((params, callback) => {
        callback.call(null, {});
    });
    S3 = jest.fn(() => ({
        getObject: getObject
    }));
    aws.S3 = S3;

    currencyFileAlerter = require('../src/prebidCurrencyRatesFileAlerter');
}

describe(`Service aws-node-prebid-currency-rates-file-alerter:`, () => {
    beforeAll(() => {

    });

    beforeEach(() => {
        global.console.error = jest.fn();
        global.console.log = jest.fn();
        initMocks();
    });

    afterEach(() => {
        jest.restoreAllMocks();
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
            // TODO
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
            const fileStaleResult = currencyFileAlerter.spec.getFileStaleResult(13413134, 2);
            // TODO
        });

        test('daysDifference', () => {
            const daysDiff = currencyFileAlerter.spec.daysDifference(324234, new Date());
            // TODO
        });

        test('sendAlert', () => {
            const emailCallback = function emailCallback(params, callback) {
                console.info('emailCallback():', params, callback);
            };

            const context = {
                done: function(n, v) {
                    console.info('context.done():', n, v);
                }
            };

            currencyFileAlerter.spec.sendAlert(null, context);
            expect(global.console.error).toBeCalledWith('Error: missing argument for sendAlert: result', undefined);

            jest.resetAllMocks();

            currencyFileAlerter.spec.sendAlert({ message: '' }, context);
            expect(global.console.error).toBeCalledWith('Error: undefined variable in sendAlert: sendEmailParams', undefined);

            jest.resetAllMocks();

            currencyFileAlerter.spec.sendAlert({ message: 'email sent' }, undefined);
            expect(global.console.error).toBeCalledWith('Error: missing argument for sendAlert: context', undefined);
        });

        test('createSendEmailParams', () => {
            const referenceOutput = {
                Destination: {ToAddresses: 'alerts@prebid.org'},
                Message:
                    {
                        Subject:
                            {
                                Data: 'ALERT: Prebid Currency Rates File Monitor',
                                Charset: 'UTF-8'
                            },
                        Body: {Text: [Object]}
                    },
                Source: 'alerts@prebid.org',
                ReplyToAddresses: ['alerts@prebid.org']
            };

            const emailParams = currencyFileAlerter.spec.createSendEmailParams('currency file 1001 updated');

            Object.keys(referenceOutput).forEach(emailParam => {
                expect(emailParams.hasOwnProperty(emailParam)).toBeTruthy();
                expect(emailParams[emailParam]).toBeDefined();

                const refValue = (typeof referenceOutput[emailParam]);
                switch (refValue) {
                    case 'string':
                        expect(typeof emailParams[emailParam] === 'string').toBeTruthy();
                        break;
                    case 'object':
                        expect((emailParams[emailParam] && typeof emailParams[emailParam] === 'object')).toBeTruthy();
                        break;
                }
            });
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