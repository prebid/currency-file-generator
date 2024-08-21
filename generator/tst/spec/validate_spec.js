import {validate} from "../../src/validate.js";
import {expect} from 'chai';

describe('validate', () => {
    it('should throw if there are too few rates', async () => {
        expect(() => {
            validate({conversions: {USD: rates, GPB: rates}})
        }).to.throw;
    });

    Object.entries({
        'no conversions': {},
        'empty conversions': {conversions: {}}
    }).forEach(([t, value]) => {
        it(`should throw on ${t}`, () => {
            expect(() => validate(value)).to.throw();
        })
    })
})