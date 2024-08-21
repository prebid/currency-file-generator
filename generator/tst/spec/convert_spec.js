import fs from 'node:fs/promises';
import {expect} from 'chai'
import {convert, extractRates, ratesForCurrency} from "../../src/convert.js";
import {expectAlmostEqual, generateXmlRates} from "../utils.js";

describe('convert', () => {

    describe('extractRates', () => {

        it('can extract (eur) rates from xml', async () => {
            const rates = await extractRates(generateXmlRates('2020-01-01', {'GBP': '1.23', 'JPY': '3.21'}));
            expect(rates).to.eql({
                'date': new Date('2020-01-01').toISOString(),
                'rates': {
                    'GBP': 1.23,
                    'JPY': 3.21
                }
            });
        });
    });

    describe('ratesForCurrency', () => {
        let refRates;
        beforeEach(() => {
            refRates = {
                'USD': 2,
                'JPY': 3
            }
        })
        it('returns same rates, plus itself at 1, if refCur = currency', () => {
            expect(ratesForCurrency('EUR', refRates, 'EUR')).to.eql(Object.assign({
                'EUR': 1
            }, refRates))
        });
        it('uses reference currency to generate rates for other currencies', () => {
            expect(ratesForCurrency('USD', refRates, 'EUR')).to.eql({
                'USD': 1,
                'EUR': 0.5,
                'JPY': 1.5
            })
        });
    });

    describe('convert', () => {
        async function expectConversions(xmlFile, jsonFile) {
            // precision seems to depend on the node runtime, so allow for some difference
            const precision = 0.00000000001;
            const xml = (await fs.readFile(xmlFile)).toString();
            const expected = JSON.parse((await fs.readFile(jsonFile)).toString())
            const actual = await convert(xml, expected.generatedAt);
            expect(actual.generatedAt).to.eql(expected.generatedAt);
            expectAlmostEqual(actual, expected);
        }

        it('can convert xml from ECB', async () => {
            await expectConversions('tst/fixtures/sample_rates.xml', 'tst/fixtures/sample_converted.json');
        })

    })
});
