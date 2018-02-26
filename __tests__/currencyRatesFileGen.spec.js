const {http} = require('../__mocks__/http.mock');
const spec = require('../src/currencyRatesFileGen').spec;

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
        const expiration = spec.getExpiration(365);
        console.log('expiration:', expiration);
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