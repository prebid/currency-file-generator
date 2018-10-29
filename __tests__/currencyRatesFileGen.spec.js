let ajax = require('../src/ajax.js'); 
ajax.requestJSONData = jest.fn();

// mock aws-sdk
jest.mock('aws-sdk', () => {
    const mocks = {
        s3UploadResult: undefined
    };

    function S3() {
    }

    S3.prototype.upload = function upload(params, callback) {
        if (typeof mocks.s3UploadResult === 'function') {
            mocks.s3UploadResult.call(null, params, callback);
        }
        else {
            console.info('<<<<< No callback for \"aws.mocks.s3UploadResult\"');
        }
    };

    return {
        S3,
        mocks
    }
});



const aws = require('aws-sdk');
const { spec } = require('../src/currencyRatesFileGen');

// Helper Constants
const SECONDS_IN_MINUTE = 60;
const SECONDS_IN_HOUR = 60 * SECONDS_IN_MINUTE;
const SECONDS_IN_DAY = SECONDS_IN_HOUR * 24;
// Mon Jan 01 2018 12:30:40 GMT-0800 (PST)
const TIME_IN_MS_JAN_1_2018 = 1514838640000;
// Mock Lambda downloadPublish context.done function
const contextMock = {
    done: jest.fn(),
    fail: jest.fn()
};

describe(`Service aws-node-currency-rates-file-gen: S3 mock for successful operations`, () => {
    beforeAll(() => {
        global.console.error = jest.fn();
        global.console.log = jest.fn();
    });

    beforeEach(() => {
        //resp.reset();
        jest.resetAllMocks();
        jest.resetModules();
    });


    describe('Unit Tests', () => {
        test('constructCurrencyUrl', () => {
            expect(spec.constructCurrencyUrl('USD'))
                .toEqual('https://api.exchangeratesapi.io/latest?base=USD');

            expect(spec.constructCurrencyUrl()).toBeUndefined();

            expect(spec.constructCurrencyUrl('')).toBeUndefined();

        });

        test('createDocument', () => {
            const doc = spec.createDocument([{
                base: 1.5,
                rates: [4, 65, 90]
            }, {
                base: 30.2,
                rates: [2, 4, 65, 90, 23]
            }]);

            expect(doc['conversions']).toEqual({"1.5": [4, 65, 90], "30.2": [2, 4, 65, 90, 23]});
        });

        test('uploadDocumentToS3', () => {
            const docParams = {
                Bucket: 'bucket1',
                Key: 'file1',
                Body: '{"currency":[0.3,0.4,0.8,1.2]}',
                Expires: new Date(TIME_IN_MS_JAN_1_2018).toString()
            };

            // Test success
            aws.mocks.s3UploadResult = function successUploadResult(params, callback) {
                callback(undefined, {
                    filename: 'file1'
                });
            };
            const uploadS3 = spec.uploadDocumentToS3(JSON.parse(JSON.stringify(docParams)), contextMock);
            expect(contextMock.done).toBeCalledWith(null, '{"filename":"file1"}');

            // Test error
            const uploadS3ErrorInvalidArg1Str = spec.uploadDocumentToS3('', contextMock);
            expect(uploadS3ErrorInvalidArg1Str).toBeUndefined();

            const uploadS3ErrorInvalidArg1Null = spec.uploadDocumentToS3(null, contextMock);
            expect(uploadS3ErrorInvalidArg1Null).toBeUndefined();

            const uploadS3ErrorInvalidArg1Undef = spec.uploadDocumentToS3(undefined, contextMock);
            expect(uploadS3ErrorInvalidArg1Undef).toBeUndefined();

            const uploadS3ErrorInvalidArg2Str = spec.uploadDocumentToS3(JSON.parse(JSON.stringify(docParams)), '');
            expect(uploadS3ErrorInvalidArg2Str).toBeUndefined();

            const uploadS3ErrorInvalidArg2Null = spec.uploadDocumentToS3(JSON.parse(JSON.stringify(docParams)), null);
            expect(uploadS3ErrorInvalidArg2Null).toBeUndefined();

            const uploadS3ErrorInvalidArg2Undef = spec.uploadDocumentToS3(JSON.parse(JSON.stringify(docParams)), undefined);
            expect(uploadS3ErrorInvalidArg2Undef).toBeUndefined();

            const uploadS3ErrorInvalidArg2EmptObj = spec.uploadDocumentToS3(JSON.parse(JSON.stringify(docParams)), {});
            expect(uploadS3ErrorInvalidArg2EmptObj).toBeUndefined();

            // Error argument passed to callback
            aws.mocks.s3UploadResult = function errorUploadResult(params, callback) {
                callback(new Error('Error: uploading to bucket'), {
                    filename: 'file1',
                    error: {
                        Location: 'https://s3.upload/bucket1/file1',
                        ETag: 'bucket1-file1',
                        Bucket: 'bucket1',
                        Key: 'file1'
                    }
                });
            };
            const uploadS3Error = spec.uploadDocumentToS3(JSON.parse(JSON.stringify(docParams)), contextMock);
            expect(contextMock.done).toBeCalledWith(null, '{"filename":"file1","error":{"filename":"file1","error":{"Location":"https://s3.upload/bucket1/file1","ETag":"bucket1-file1","Bucket":"bucket1","Key":"file1"}}}');
        });

        test('getExpiration', () => {
            // Mock Date.prototype.getTime used by getExpiration method
            const dateGetTimeSpy = jest.spyOn(global.Date.prototype, 'getTime').mockImplementation(() => {
                return TIME_IN_MS_JAN_1_2018;
            });

            // Result is current time + expiration argument time
            const expirationOneHour = spec.getExpiration(SECONDS_IN_HOUR);
            const expirationOneDay = spec.getExpiration(SECONDS_IN_DAY);
            const expirationOneMonth = spec.getExpiration(SECONDS_IN_DAY * 31);

            expect(spec.getExpiration(NaN)).toBeUndefined();
            expect(spec.getExpiration('2309')).toBeUndefined();
            expect(spec.getExpiration(null)).toBeUndefined();
            expect(spec.getExpiration(undefined)).toBeUndefined();

            // Disable getTime mocking so it can be used below
            dateGetTimeSpy.mockRestore();

            expect(expirationOneHour.getTime()).toEqual(1514842240000);
            expect(expirationOneDay.getTime()).toEqual(1514925040000);
            expect(expirationOneMonth.getTime()).toEqual(1517517040000);
        });

        test('createDocumentParams', () => {
            const doc = {"doc": {"content": ""}};
            const docAsString = JSON.stringify(doc);
            const expires = new Date(new Date().getTime() + 365 * 1000);
            const docParams = spec.createDocumentParams('test', 'file1', doc, expires);

            expect(docParams).toEqual({
                Bucket: 'test',
                Key: 'file1',
                Body: docAsString,
                Expires: expires
            });

            expect(spec.createDocumentParams(undefined, undefined, undefined, undefined)).toBeUndefined();
            expect(spec.createDocumentParams('bucket1', undefined, undefined, undefined)).toBeUndefined();
            expect(spec.createDocumentParams('bucket1', 'file1', undefined, undefined)).toBeUndefined();

            expect(spec.createDocumentParams('', '', '', '')).toBeUndefined();
            expect(spec.createDocumentParams('', 'file1', doc, expires)).toBeUndefined();
            expect(spec.createDocumentParams('bucket1', '', doc, expires)).toBeUndefined();
            expect(spec.createDocumentParams('bucket1', 'file1', doc, 2435245)).toBeUndefined();

            expect(spec.createDocumentParams(234, 'file1', doc, expires)).toBeUndefined();
            expect(spec.createDocumentParams('bucket1', 2230, doc, expires)).toBeUndefined();
            expect(spec.createDocumentParams('bucket1', 2230, doc, expires)).toBeUndefined();
            expect(spec.createDocumentParams('bucket1', 'file1', 233, expires)).toBeUndefined();

            expect(spec.createDocumentParams('bucket1', 'file1', doc, undefined)).toBeUndefined();
            expect(spec.createDocumentParams('bucket1', 'file1', doc, '32432')).toBeUndefined();

            expect(spec.createDocumentParams('bucket1', 'file1', {}, expires)).toBeUndefined();
        });

        test('getDebug', () => {
            expect(spec.getDebug()).toBeTruthy();
            process.env.DEBUG = 0;
            expect(spec.getDebug()).toBeFalsy();
            process.env.DEBUG = 1;
            expect(spec.getDebug()).toBeTruthy();
            delete process.env.DEBUG;
            expect(spec.getDebug()).toBeTruthy();
        });

        test('getBucket', () => {
            expect(spec.getBucket()).toEqual('currency.prebid.org');
            process.env.S3_BUCKET = 'currency1.prebid.org';
            expect(spec.getBucket()).toEqual('currency1.prebid.org');
            delete process.env.S3_BUCKET;
            process.env.S3_BUCKET = 'currency1.prebid.org';
        });

        test('getFilename', () => {
            expect(spec.getFilename()).toEqual('latest.json');
            process.env.S3_FILENAME = 'latest1.json';
            expect(spec.getFilename()).toEqual('latest1.json');
            delete process.env.S3_FILENAME;
            process.env.S3_FILENAME = 'latest.json';
        });

        test('log', () => {
            spec.log('log info');
            expect(global.console.log).toBeCalledWith('log info');
            spec.log({testTitle:'foo'});
            expect(global.console.log).toBeCalledWith({testTitle:'foo'});
            spec.log(null);
            expect(global.console.log).toBeCalledWith(null);
            spec.log(undefined);
            expect(global.console.log).toBeCalledWith(undefined);
        });

        test('logError', () => {
            spec.logError('line');
            expect(global.console.error).toBeCalledWith('line');
            spec.logError('line', {});
            expect(global.console.error).toBeCalledWith('line');
            
        });
        
        // test('purgeCache', async () => {
        //     ajax.requestJSONData = jest.fn();
        //     const response = {"someKey": "someData"};
        //     ajax.requestJSONData.mockImplementation((url, accept, reject) =>{
        //         accept(response);
        //     });
        //     await spec.purgeCache('http://purge-url.com', contextMock);
        //     expect(global.console.log).toBeCalledWith('successfully purged cache', response);
        //     ajax.requestJSONData.mockRestore();
        // });
    });
});
