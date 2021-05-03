
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

        // Mock https get
        const httpGetSpy = jest.spyOn(https, 'get').mockImplementation((url, callback) => {
            callback(resp);
            switch (url) {
                case "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml":
                    resp.data('<?xml version="1.0" encoding="UTF-8"?>\n' +
                        '<gesmes:Envelope xmlns:gesmes="http://www.gesmes.org/xml/2002-08-01" xmlns="http://www.ecb.int/vocabulary/2002-08-01/eurofxref">\n' +
                        '    <gesmes:subject>Reference rates</gesmes:subject>\n' +
                        '    <gesmes:Sender>\n' +
                        '        <gesmes:name>European Central Bank</gesmes:name>\n' +
                        '    </gesmes:Sender>\n' +
                        '    <Cube>\n' +
                        '        <Cube time=\'2021-04-07\'>\n' +
                        '            <Cube currency=\'USD\' rate=\'1.1746\'/>\n' +
                        '            <Cube currency=\'JPY\' rate=\'130.03\'/>\n' +
                        '            <Cube currency=\'BGN\' rate=\'1.9558\'/>\n' +
                        '            <Cube currency=\'CZK\' rate=\'26.085\'/>\n' +
                        '            <Cube currency=\'DKK\' rate=\'7.4379\'/>\n' +
                        '            <Cube currency=\'GBP\' rate=\'0.85195\'/>\n' +
                        '            <Cube currency=\'HUF\' rate=\'361.84\'/>\n' +
                        '            <Cube currency=\'PLN\' rate=\'4.6089\'/>\n' +
                        '            <Cube currency=\'RON\' rate=\'4.9088\'/>\n' +
                        '            <Cube currency=\'SEK\' rate=\'10.2753\'/>\n' +
                        '            <Cube currency=\'CHF\' rate=\'1.1099\'/>\n' +
                        '            <Cube currency=\'ISK\' rate=\'148.70\'/>\n' +
                        '            <Cube currency=\'NOK\' rate=\'10.0408\'/>\n' +
                        '            <Cube currency=\'HRK\' rate=\'7.5705\'/>\n' +
                        '            <Cube currency=\'RUB\' rate=\'89.5944\'/>\n' +
                        '            <Cube currency=\'TRY\' rate=\'9.5903\'/>\n' +
                        '            <Cube currency=\'AUD\' rate=\'1.5500\'/>\n' +
                        '            <Cube currency=\'BRL\' rate=\'6.6149\'/>\n' +
                        '            <Cube currency=\'CAD\' rate=\'1.4787\'/>\n' +
                        '            <Cube currency=\'CNY\' rate=\'7.7195\'/>\n' +
                        '            <Cube currency=\'HKD\' rate=\'9.1346\'/>\n' +
                        '            <Cube currency=\'IDR\' rate=\'17068.23\'/>\n' +
                        '            <Cube currency=\'ILS\' rate=\'3.9150\'/>\n' +
                        '            <Cube currency=\'INR\' rate=\'86.2275\'/>\n' +
                        '            <Cube currency=\'KRW\' rate=\'1328.36\'/>\n' +
                        '            <Cube currency=\'MXN\' rate=\'23.8792\'/>\n' +
                        '            <Cube currency=\'MYR\' rate=\'4.8693\'/>\n' +
                        '            <Cube currency=\'NZD\' rate=\'1.6806\'/>\n' +
                        '            <Cube currency=\'PHP\' rate=\'57.076\'/>\n' +
                        '            <Cube currency=\'SGD\' rate=\'1.5801\'/>\n' +
                        '            <Cube currency=\'THB\' rate=\'36.730\'/>\n' +
                        '            <Cube currency=\'ZAR\' rate=\'17.2074\'/></Cube>\n' +
                        '    </Cube>\n' +
                        '</gesmes:Envelope>');
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
        let result = await spec.downloadPublish({}, contextMock);
        expect(result).toEqual('success');
    });
});

