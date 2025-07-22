import sinon from 'sinon';
import {currencyFileChecker, makeCanary, monitor} from "../../src/canary.js";
import {readFile} from 'node:fs/promises'
import {expectError} from "../utils.js";
import {Unit} from 'aws-embedded-metrics';

describe('canary', () => {
    describe('currencyFileChecker', () => {
        let now, fetchResult, body, fetch_, check, reportAge, validBody;

        beforeEach(async () => {
            validBody = (await readFile('./tst/fixtures/sample_converted.json')).toString()
            fetchResult = Promise.resolve({ok: true, json: () => Promise.resolve(JSON.parse(body))});
            fetch_ = sinon.stub().callsFake(() => fetchResult);
            now = sinon.stub().callsFake(() => new Date('2024-08-19T01:00:00Z').getTime())
            check = currencyFileChecker({fetch_, now});
            reportAge = sinon.stub();
        });

        Object.entries({
            'body is valid': validBody,
            'body is incomplete, but has dataAsOf': JSON.stringify({dataAsOf: '2024-08-19T00:00:00'})
        }).forEach(([t, useBody]) => {
            describe(`when ${t}`, () => {
                beforeEach(() => {
                    body = useBody
                });
                it('should call reportAge with dataAsOf', async () => {
                    body = validBody;
                    await check('mock-url', reportAge);
                    sinon.assert.calledWith(reportAge, 1000 * 60 * 60)
                });
            })
        })

        Object.entries({
            'fetch fails'() {
                fetchResult = Promise.resolve(() => ({ok: false, text: () => Promise.resolve(body)}))
            },
            'fetch throws'() {
                fetchResult = Promise.reject(new Error('err'));
            },
            'body is not JSON'() {
                body = 'not-json'
            },
            'rates are missing'() {
                body = JSON.stringify({conversions: {USD: {}}})
            },
            'dataAsOf is not a valid date'() {
                body = JSON.stringify(Object.assign(JSON.parse(validBody), {dataAsOf: ''}))
            },
            'dataAsOf is missing'() {
                body = JSON.stringify(Object.assign(JSON.parse(validBody), {dataAsOf: null}))
            }
        }).forEach(([t, setup]) => {
            describe(`when ${t}`, () => {
                beforeEach(setup);
                it('should throw', async () => {
                    await expectError(() => check('mock-url', reportAge));
                    sinon.assert.notCalled(reportAge);
                })
            })
        });
    });

    describe('monitor', () => {
        let metrics, check, fn;
        beforeEach(() => {
            metrics = {
                putMetric: sinon.stub(),
                flush: sinon.stub()
            };
            check = sinon.stub();
            fn = monitor('Suffix', () => 'url', {check, mkMetrics: () => metrics});
        });

        afterEach(() => {
            sinon.assert.called(metrics.flush);
        })


        it('should collect error metrics when check throws', async () => {
            check.throws(new Error());
            await fn(metrics);
            sinon.assert.calledWith(check, 'url');
            sinon.assert.calledWith(metrics.putMetric, 'Error', 1, Unit.Count);
            sinon.assert.calledWith(metrics.putMetric, 'Error.Suffix', 1, Unit.Count);
        });
        it('should report no errors when check does not throw', async () => {
            await fn(metrics);
            sinon.assert.calledWith(metrics.putMetric, 'Error', 0, Unit.Count);
            sinon.assert.calledWith(metrics.putMetric, 'Error.Suffix', 0, Unit.Count);
        });

        Object.entries({
            'and succeeds'() {},
            'and throws'() { throw new Error() }
        }).forEach(([t, action]) => {
            describe(`when check reports age ${t}`, () => {
                beforeEach(() => {
                    check.callsFake(async (url, reportAge) => {
                        reportAge(123 * 1000 + 321);
                        action();
                    })
                });

                it('should collect age metrics', async () => {
                    await fn();
                    sinon.assert.calledWith(metrics.putMetric, 'Age', 123, Unit.Seconds)
                    sinon.assert.calledWith(metrics.putMetric, 'Age.Suffix', 123, Unit.Seconds);
                })
            })
        })
    })

})
