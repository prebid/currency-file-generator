const {http} = require('../__mocks__/http.mock');
const spec = require('../src/currencyRatesFileGen');

describe(`Service aws-node-currency-rates-file-gen: S3 mock for successful operations`, () => {
    beforeAll(() => {

    });

    afterAll(() => {
        http.reset();
    });

    test('getCurrencyUrl', () => {

        expect(spec.getCurrencyUrl('FROMCURRENCY', 'AUD,BRL,CAD,CHF')).toEqual(
                'http://api.fixer.io/latest?base=FROMCURRENCY&symbols=AUD,BRL,CAD,CHF');

        expect(spec.getCurrencyUrl(undefined, 'AUD,BRL,CAD,CHF')).toEqual(
            'http://api.fixer.io/latest?base=undefined&symbols=AUD,BRL,CAD,CHF');

        expect(spec.getCurrencyUrl(undefined, undefined)).toEqual(
            'http://api.fixer.io/latest?base=undefined&symbols=undefined');

        expect(spec.getCurrencyUrl()).toEqual('http://api.fixer.io/latest?base=undefined&symbols=undefined');

        expect(spec.getCurrencyUrl(23,'AU')).toEqual('http://api.fixer.io/latest?base=23&symbols=AU');

        expect(spec.getCurrencyUrl('','')).toEqual('http://api.fixer.io/latest?base=&symbols=');
    });

    test('createDocument', () => {
        const doc = spec.createDocument([{
            base: 1.5,
            rates: [4,65,90]
        }, {
            base: 30.2,
            rates: [2,4,65,90,23]
        }]);

        expect(doc['conversions']).toEqual({"1.5": [4, 65, 90], "30.2": [2, 4, 65, 90, 23]});
    });

    test('createDocument', () => {
        const doc = spec.createDocument([{
            base: 1.5,
            rates: [4,65,90]
        }, {
            base: 30.2,
            rates: [2,4,65,90,23]
        }]);

        expect(doc['conversions']).toEqual({"1.5": [4, 65, 90], "30.2": [2, 4, 65, 90, 23]});
    });


});