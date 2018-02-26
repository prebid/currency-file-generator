const {http} = require('../__mocks__/http.mock');
const spec = require('../src/currencyRatesFileGen').spec;

// Helper Constants
const SECONDS_IN_MINUTE = 60;
const SECONDS_IN_HOUR = 60 * SECONDS_IN_MINUTE;
const SECONDS_IN_DAY = SECONDS_IN_HOUR * 24;
// Mon Jan 01 2018 12:30:40 GMT-0800 (PST)
const TIME_IN_MS_JAN_1_2018 = 1514838640000;




describe(`Service aws-node-currency-rates-file-gen: S3 mock for successful operations`, () => {
    beforeAll(() => {
        http.reset();
    });

    test('constructCurrencyUrl', () => {
        expect(spec.constructCurrencyUrl('FROMCURRENCY', 'AUD,BRL,CAD,CHF')).toEqual(
            'http://api.fixer.io/latest?base=FROMCURRENCY&symbols=AUD,BRL,CAD,CHF');

        expect(spec.constructCurrencyUrl(undefined, 'AUD,BRL,CAD,CHF')).toEqual(
            'http://api.fixer.io/latest?base=undefined&symbols=AUD,BRL,CAD,CHF');

        expect(spec.constructCurrencyUrl(undefined, undefined)).toEqual(
            'http://api.fixer.io/latest?base=undefined&symbols=undefined');

        expect(spec.constructCurrencyUrl()).toEqual('http://api.fixer.io/latest?base=undefined&symbols=undefined');

        expect(spec.constructCurrencyUrl(23, 'AU')).toEqual('http://api.fixer.io/latest?base=23&symbols=AU');

        expect(spec.constructCurrencyUrl('', '')).toEqual('http://api.fixer.io/latest?base=&symbols=');
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

    });

    test('uploadDocumentToS3', () => {

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
    });
});