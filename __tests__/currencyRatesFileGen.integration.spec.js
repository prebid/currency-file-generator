
const https = require('https');
let shell = require('../src/shell.js');
let process = require('process');
const TIME_IN_MS_JAN_1_2018 = 1514838640000;

const contextMock = {
    done: jest.fn(),
    fail: jest.fn()
};

shell.runCommand = jest.fn().mockImplementation((cmd)=>{
    console.log('running command: ', cmd);
});

process.chdir = jest.fn().mockImplementation((dir) => {
    console.log('switching directory', dir);
});

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

const resp = {
    eventHandlers: {},
    data(chunk) {
        return (resp.eventHandlers['data']) ? resp.eventHandlers['data'](chunk) : function(chunk) {
            throw Error('on.data downloadPublish does not exist:', chunk);
        };
    },
    end() {
        return (resp.eventHandlers['end']) ? resp.eventHandlers['end']() : function() {
            throw Error('on.end downloadPublish does not exist');
        };
    },
    error(e) {
        return (resp.eventHandlers['error']) ? resp.eventHandlers['error'](e) : function(e) {
            throw Error('on.error downloadPublish does not exist', e);
        };
    },
    on(eventType, downloadPublish) {
        resp.eventHandlers[eventType] = downloadPublish;
    },
    reset() {
        Object.keys(resp.eventHandlers).forEach(key => {
            resp.eventHandlers[key] = undefined;
        });
    }
};

const { spec } = require('../src/currencyRatesFileGen');

describe('Integration tests', () => {
    test('downloadPublish', async () => {
        // Mock Date.prototype.getTime used by getExpiration method
        const dateGetTimeSpy = jest.spyOn(global.Date.prototype, 'getTime').mockImplementation(() => {
            return TIME_IN_MS_JAN_1_2018;
        });

        jest.doMock('../node_modules/lambda-git', () => {
            return function require() {
                return 
                {
                    prop: 'value'
                };
            }
        });
        debugger;


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
                case 'https://purge.jsdelivr.net/gh/prebid/currency-file@1/latest.json':
                    resp.data('{');
                    resp.data('"fastly":[{"status":"ok","id":"6342-1540441144-16715"},{"status":"ok","id":"6338-1540434953-17514"},{"status":"ok","id":"6337-1539912850-86976"},{"status":"ok","id":"6341-1539911879-174523"},{"status":"ok","id":"275-1539142500-297119"},{"status":"ok","id":"6338-1540434953-17515"}],"maxcdn":{"code":200},"cloudflare":true');
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
        global.console.error = jest.fn();


        // Integration tests

        // check valid responses
        let result = await spec.downloadPublish({}, contextMock);
        expect(result).toEqual('success');

        // check invalid responses
        // httpGetSpy.mockReset();
        // httpGetSpy.mockImplementation((url, callback) => {
        //     callback(resp);
        //     switch (url) {
        //         case 'https://api.exchangeratesapi.io/latest?base=USD':
        //             resp.data('{');
        //             resp.data('"base":"USD","date":"2018-02-26","rates":{"TRY":3.7808,"ZAR":11.593}');
        //             resp.data('}');
        //             resp.end();
        //             break;
        //         case 'https://api.exchangeratesapi.io/latest?base=GBP':
        //             resp.data('{');
        //             resp.data('"base":"GBP","date":"2018-02-26","rates":{"AUD":1.7889,"BRL":4.5385,"CAD":1.7783,"CHF":1.3129,"CNY":8.8503,"CZK":28.913,"DKK":8.4786,"EUR":1.1387,"HKD":10.976,"HUF":357.08,"IDR":19169.0,"ILS":4.9003,"INR":90.871,"JPY":149.85,"KRW":1503.3,"MXN":26.097,"MYR":5.4845,"NOK":10.966,"NZD":1.9184,"PHP":72.803,"PLN":4.748,"RUB":78.501,"SEK":11.437,"SGD":1.8478,"THB":43.938,"TRY":5.3039,"USD":1.4029,"ZAR":16.264}');
        //             resp.data('}');
        //             resp.end();
        //             break;
        //         default:
        //             resp.error(new Error('Error loading url', url));
        //             break;
        //     }
        // });
        // contextMock.done.mockReset();
        // global.console.error.mockReset();

        // spec.downloadPublish({}, contextMock);
        // expect(contextMock.done).not.toBeCalled();
        // expect(global.console.error).toBeCalledWith("Error: did not receive responses for all fromCurrencies", undefined);
        // expect(global.console.error.mock.calls.length).toEqual(2);
        // expect(global.console.error.mock.calls[0]).toEqual(["Error: json data failed validation:", {"base": "USD", "date": "2018-02-26", "rates": {"TRY": 3.7808, "ZAR": 11.593}}]);
        // expect(global.console.error.mock.calls[1]).toEqual(["Error: did not receive responses for all fromCurrencies", undefined]);
        // global.console.error.mockRestore()
        //shell.runCommand.mockRestore();
    });
});

