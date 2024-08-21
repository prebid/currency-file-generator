import sinon from 'sinon';
import {updater} from "../../src/update.js";
import {expectAlmostEqual, expectError, generateXmlRates} from "../utils.js";
import {readFile} from 'node:fs/promises'

describe('updater', () => {
    let update, mockFetch, updateS3, updateGH, convertXml, sampleRates;
    beforeEach(async () => {
        mockFetch = sinon.stub();
        updateS3 = sinon.stub();
        updateGH = sinon.stub();
        convertXml = sinon.stub();
        update = await updater({fetch_: mockFetch, updateS3, updateGH: Promise.resolve(updateGH)});
        sampleRates = JSON.parse((await readFile('tst/fixtures/sample_converted.json')).toString());
    });

    function makeRates(rates = {}) {
        return generateXmlRates(new Date().toISOString().substring(0, 10), rates)
    }

    function fetchToFile(file, ok = true) {
        mockFetch.callsFake(() => Promise.resolve(({
            ok,
            text: () => readFile(`tst/fixtures/${file}`).then(stream => stream.toString())
        })));
    }

    it('should parse rates and pass them to update functions', async () => {
        fetchToFile('sample_rates.xml');
        await update();
        [updateS3, updateGH].forEach(upd => {
            sinon.assert.called(upd);
            expectAlmostEqual(JSON.parse(upd.args[0][0]), sampleRates);
        });
    });

    it('should throw if XML fetch does not succeed', async () => {
        fetchToFile('sample_rates.xml', false)
        await expectError(update)
    })


    it('should throw if XML does not contain reference rates', async () => {
        delete sampleRates.USD;
        mockFetch.callsFake(() => Promise.resolve({
            ok: true,
            text: () => Promise.resolve(makeRates(sampleRates))
        }));
        await expectError(update);
    });
})