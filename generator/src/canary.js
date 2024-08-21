import {validate} from "./validate.js";
import {getCdnUrl, getCurrencyFile, getJsdelivrPath} from "./env.js";
import {Configuration, createMetricsLogger, Unit} from 'aws-embedded-metrics';

Configuration.serviceName = 'CurrencyCanary';
Configuration.namespace = 'Currency';


export function currencyFileChecker({fetch_ = fetch, now = () => new Date().getTime(), logger = console} = {}) {
    return async function (url, reportAge) {
        logger.info(`Checking file at ${url}...`)
        const response = await fetch_(url);
        if (!response.ok) {
            throw new Error(`Could not fetch "${url}": ${response.status}`)
        }
        const rates = await response.json();
        const timestamp = new Date(rates.dataAsOf).getTime();
        if (!rates.dataAsOf || isNaN(timestamp)) {
            throw new Error(`Invalid value for "dataAsOf": ${rates.dataAsOf}`)
        }
        reportAge(now() - timestamp);
        validate(rates);
        logger.info(`File at ${url} is valid.`)
    }
}

export function monitor(suffix, getUrl, {
    check = currencyFileChecker(),
    logger = console,
    mkMetrics = createMetricsLogger,
} = {}) {
    return async function (metrics = mkMetrics()) {
        let err = 0;
        const url = getUrl();
        try {
            await check(url, (ageMs) => {
                const age = Math.floor(ageMs / 1000);
                logger.info(`rates at ${url} are ${Math.floor(age/(60*60))} hours old`);
                ['Age', `Age.${suffix}`].forEach(name => metrics.putMetric(name, age, Unit.Seconds))
            })
        } catch (e) {
            logger.error(e);
            err = 1
        } finally {
            ['Error', `Error.${suffix}`].forEach(name => metrics.putMetric(name, err, Unit.Count))
            await metrics.flush();
        }
    }
}

export function makeCanary(
    {
        check = currencyFileChecker(),
        jsdelivrPath = getJsdelivrPath(),
        cdnUrl = getCdnUrl(),
        file = getCurrencyFile(),
        mon = monitor
    } = {}
) {
    const monitorCdn = mon('Cloudfront', () => `${cdnUrl}${file}`, {check});
    const monitorGh = mon('Jsdelivr', () => {
        // by default, prebid passes date in query params
        const today = new Date().toISOString().substring(0, 10).replaceAll('-', '')
        return `https://cdn.jsdelivr.net/${jsdelivrPath}${file}?date=${today}`
    }, {check});
    return function () {
        return Promise.all([monitorGh(), monitorCdn()])
    }
}