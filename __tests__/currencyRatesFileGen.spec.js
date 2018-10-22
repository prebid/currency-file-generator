const https = require('https');

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
const {spec, handler} = require('../src/currencyRatesFileGen');

// Mock for https.get callback argument: response
const resp = {
    eventHandlers: {},
    data(chunk) {
        return (resp.eventHandlers['data']) ? resp.eventHandlers['data'](chunk) : function(chunk) {
            throw Error('on.data handler does not exist:', chunk);
        };
    },
    end() {
        return (resp.eventHandlers['end']) ? resp.eventHandlers['end']() : function() {
            throw Error('on.end handler does not exist');
        };
    },
    error(e) {
        return (resp.eventHandlers['error']) ? resp.eventHandlers['error'](e) : function(e) {
            throw Error('on.error handler does not exist', e);
        };
    },
    on(eventType, handler) {
        resp.eventHandlers[eventType] = handler;
    },
    reset() {
        Object.keys(resp.eventHandlers).forEach(key => {
            resp.eventHandlers[key] = undefined;
        });
    }
};

// Helper Constants
const SECONDS_IN_MINUTE = 60;
const SECONDS_IN_HOUR = 60 * SECONDS_IN_MINUTE;
const SECONDS_IN_DAY = SECONDS_IN_HOUR * 24;
// Mon Jan 01 2018 12:30:40 GMT-0800 (PST)
const TIME_IN_MS_JAN_1_2018 = 1514838640000;

describe(`Service aws-node-currency-rates-file-gen: S3 mock for successful operations`, () => {
    beforeAll(() => {
        global.console.error = jest.fn();
        global.console.log = jest.fn();
    });

    beforeEach(() => {
        resp.reset();
        jest.resetAllMocks()
    });

    describe('Integration tests', () => {
        test('handler', () => {
            // Mock Date.prototype.getTime used by getExpiration method
            const dateGetTimeSpy = jest.spyOn(global.Date.prototype, 'getTime').mockImplementation(() => {
                return TIME_IN_MS_JAN_1_2018;
            });
            // Mock https get
            const httpGetSpy = jest.spyOn(https, 'get').mockImplementation((url, callback) => {
                callback(resp);
                switch (url) {
                    case 'https://api.exchangeratesapi.io/latest?base=USD':
                        resp.data('{');
                        resp.data('"base":"USD","date":"2018-02-26","rates":{"AUD":1.2752,"BRL":3.2351,"CAD":1.2676,"CHF":0.93588,"CNY":6.3087,"CZK":20.61,"DKK":6.0438,"EUR":0.81169,"GBP":0.71282,"HKD":7.8236,"HUF":254.54,"IDR":13664.0,"ILS":3.493,"INR":64.775,"JPY":106.82,"KRW":1071.6,"MXN":18.602,"MYR":3.9095,"NOK":7.8168,"NZD":1.3675,"PHP":51.896,"PLN":3.3845,"RUB":55.958,"SEK":8.1526,"SGD":1.3171,"THB":31.32,"TRY":3.7808,"ZAR":11.593}');
                        resp.data('}');
                        resp.end();
                        break;
                    case 'https://api.exchangeratesapi.io/latest?base=GBP':
                        resp.data('{');
                        resp.data('"base":"GBP","date":"2018-02-26","rates":{"AUD":1.7889,"BRL":4.5385,"CAD":1.7783,"CHF":1.3129,"CNY":8.8503,"CZK":28.913,"DKK":8.4786,"EUR":1.1387,"HKD":10.976,"HUF":357.08,"IDR":19169.0,"ILS":4.9003,"INR":90.871,"JPY":149.85,"KRW":1503.3,"MXN":26.097,"MYR":5.4845,"NOK":10.966,"NZD":1.9184,"PHP":72.803,"PLN":4.748,"RUB":78.501,"SEK":11.437,"SGD":1.8478,"THB":43.938,"TRY":5.3039,"USD":1.4029,"ZAR":16.264}');
                        resp.data('}');
                        resp.end();
                        break;
                    default:
                        resp.error(new Error('Error loading url', url));
                        break;
                }
            });
            // Mock S3.upload callback
            aws.mocks.s3UploadResult = function successUploadResult(params, callback) {
                callback(undefined, {
                    filename: 'latest.json'
                });
            };
            // Mock Lambda handler context.done function
            const contextMock = {done: jest.fn()};
            global.console.error = jest.fn();


            // Integration tests

            // check valid responses
            handler({}, contextMock);
            expect(contextMock.done).toBeCalledWith(null, JSON.stringify({filename: 'latest.json'}));

            // check invalid responses
            httpGetSpy.mockReset();
            httpGetSpy.mockImplementation((url, callback) => {
                callback(resp);
                switch (url) {
                    case 'https://api.exchangeratesapi.io/latest?base=USD':
                        resp.data('{');
                        resp.data('"base":"USD","date":"2018-02-26","rates":{"TRY":3.7808,"ZAR":11.593}');
                        resp.data('}');
                        resp.end();
                        break;
                    case 'https://api.exchangeratesapi.io/latest?base=GBP':
                        resp.data('{');
                        resp.data('"base":"GBP","date":"2018-02-26","rates":{"AUD":1.7889,"BRL":4.5385,"CAD":1.7783,"CHF":1.3129,"CNY":8.8503,"CZK":28.913,"DKK":8.4786,"EUR":1.1387,"HKD":10.976,"HUF":357.08,"IDR":19169.0,"ILS":4.9003,"INR":90.871,"JPY":149.85,"KRW":1503.3,"MXN":26.097,"MYR":5.4845,"NOK":10.966,"NZD":1.9184,"PHP":72.803,"PLN":4.748,"RUB":78.501,"SEK":11.437,"SGD":1.8478,"THB":43.938,"TRY":5.3039,"USD":1.4029,"ZAR":16.264}');
                        resp.data('}');
                        resp.end();
                        break;
                    default:
                        resp.error(new Error('Error loading url', url));
                        break;
                }
            });
            contextMock.done.mockReset();
            global.console.error.mockReset();

            handler({}, contextMock);
            expect(contextMock.done).not.toBeCalled();
            expect(global.console.error).toBeCalledWith("Error: did not receive responses for all fromCurrencies", undefined);
            expect(global.console.error.mock.calls.length).toEqual(2);
            expect(global.console.error.mock.calls[0]).toEqual(["Error: json data failed validation:", {"base": "USD", "date": "2018-02-26", "rates": {"TRY": 3.7808, "ZAR": 11.593}}]);
            expect(global.console.error.mock.calls[1]).toEqual(["Error: did not receive responses for all fromCurrencies", undefined]);
            global.console.error.mockRestore()
        });
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

        test('requestCurrencyFile', () => {
            // Mock https get and requestCurrencyFile callback
            const httpGetSpy = jest.spyOn(https, 'get').mockImplementation((url, callback) => {
                callback(resp);
                switch (url) {
                    case 'fileSuccess':
                        resp.data('{');
                        resp.data('"body":"content"');
                        resp.data('}');
                        resp.end();
                        break;
                    case 'fileEnd':
                        resp.end();
                        break;
                    case 'fileError':
                        resp.error(new Error('Error: https could not be parsed'));
                        break;
                    case 'fileBroken':
                        resp.data('{');
                        resp.data('"body":"content"');
                        resp.end();
                        break;
                }
            });
            const mockRequestCurrencyFileCallback = jest.fn();

            spec.requestCurrencyFile('fileSuccess', mockRequestCurrencyFileCallback);
            expect(mockRequestCurrencyFileCallback).toBeCalledWith({body: 'content'});

            spec.requestCurrencyFile('fileEnd', mockRequestCurrencyFileCallback);
            expect(mockRequestCurrencyFileCallback).toBeCalledWith(undefined);

            spec.requestCurrencyFile('fileError', mockRequestCurrencyFileCallback);
            expect(mockRequestCurrencyFileCallback).toBeCalledWith(undefined);

            spec.requestCurrencyFile('fileBroken', mockRequestCurrencyFileCallback);
            expect(mockRequestCurrencyFileCallback).toBeCalledWith(undefined);

            httpGetSpy.mockRestore();
        });

        test('uploadDocumentToS3', () => {
            // Mock Lambda handler context.done function
            const contextMock = {done: jest.fn()};

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
            expect(global.console.error).toBeCalledWith('line', undefined);
            spec.logError('line', 'error');
            expect(global.console.error).toBeCalledWith('line', 'error');
            spec.logError('line', {testTitle:'foo'});
            expect(global.console.error).toBeCalledWith('line', {testTitle:'foo'});
            spec.logError(null);
            expect(global.console.error).toBeCalledWith(null, undefined);
            spec.logError();
            expect(global.console.error).toBeCalledWith(undefined, undefined);
        });
    });
});
