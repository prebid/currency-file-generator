import {retry} from "../../src/retry.js";
import sinon from 'sinon';
import {expect} from 'chai';
import {expectError} from "../utils.js";

describe('retry', () => {
    let fn, retryer, delay;
    beforeEach(() => {
        fn = sinon.stub();
        delay = sinon.stub().callsFake(() => Promise.resolve());
        retryer = retry(fn, {delays: [1, 2], delay});

    });
    it('should delegate to fn', async () => {
        fn.returns(Promise.resolve('value'));
        expect(await retryer()).to.eql('value');
    });
    it('should retry until fn succeeds', async () => {
        let i = 0;
        fn.callsFake(() => i++ < 1 ? Promise.reject('err') : Promise.resolve('success'));
        expect(await retryer()).to.eql('success');
        sinon.assert.calledOnce(delay);
        sinon.assert.calledWith(delay, 1);
    })
    it('should throw after retries have been exhausted', async () => {
        fn.callsFake(() => Promise.reject('err'));
        await expectError(retryer, (e) => {
            expect(e).to.eql('err');
        });
        [1, 2].forEach(sec => sinon.assert.calledWith(delay, sec));
    })
})