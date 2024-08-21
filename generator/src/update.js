import {convert} from "./convert.js";
import {githubUpdater} from "./github.js";
import {s3Updater} from "./s3.js";
import {validate} from "./validate.js";

const RATE_XML_URL = 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml';

export async function updater(
    {
        logger = console,
        updateGH = githubUpdater({logger}),
        updateS3 = s3Updater({logger}),
        convertXml = convert,
        fetch_ = fetch
    } = {}
) {
    updateGH = await updateGH;
    return async function updateCurrencyFile() {
        logger.info(`Fetching rates from ${RATE_XML_URL}...`);
        const response = await fetch_(RATE_XML_URL);
        if (!response.ok) {
            throw new Error(`Could not fetch rates: got HTTP ${response.status}`)
        }
        const rates = await convertXml(await response.text());
        logger.info(`Computed rates:`, rates);
        validate(rates);
        const newContents = JSON.stringify(rates);
        await updateS3(newContents);
        await updateGH(newContents);
        logger.info(`Done.`)
    }
}
