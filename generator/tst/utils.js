import {expect} from "chai";
import assert from 'node:assert';

export async function expectError(fn, verify = (err) => null) {
    try {
        await fn()
        assert.fail('did not throw')
    } catch (e) {
        expect(e.message).to.not.match(/did not throw/)
        verify(e);
    }
}

export function generateXmlRates(date, eurRates) {
    const rateElements = Object.entries(eurRates)
        .map(([cur, rate]) => `<Cube currency='${cur}' rate='${rate}'/>`)
        .join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
        <gesmes:Envelope xmlns:gesmes="http://www.gesmes.org/xml/2002-08-01" xmlns="http://www.ecb.int/vocabulary/2002-08-01/eurofxref">
            <gesmes:subject>Reference rates</gesmes:subject>
            <gesmes:Sender>
                <gesmes:name>European Central Bank</gesmes:name>
            </gesmes:Sender>
            <Cube>
                <Cube time='${date}'>
                    ${rateElements}
                </Cube>
            </Cube>
        </gesmes:Envelope>`
}

export function expectAlmostEqual(actual, expected, precision = 0.00000000001) {
    // precision seems to depend on the node runtime, so allow for some difference
    expect(actual.dataAsOf).to.eql(expected.dataAsOf);
    expect(Object.keys(actual.conversions)).to.have.members(Object.keys(expected.conversions));
    Object.entries(actual.conversions).forEach(([currency, rates]) => {
        const expectedRates = expected.conversions[currency];
        expect(Object.keys(rates)).to.have.members(Object.keys(expectedRates));
        Object.entries(rates).forEach(([currency, rate]) => {
            expect(Math.abs(rate - expectedRates[currency])).to.be.lessThan(precision);
        })
    })

}