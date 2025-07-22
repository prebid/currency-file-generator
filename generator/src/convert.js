import xml2js from "xml2js";

export function convert(xmlRates, generationDate = new Date().toISOString(), refCurrency = 'EUR', fromCurrencies = ['USD', 'GBP']) {
    return extractRates(xmlRates)
        .then(({date, rates}) => ({
            generatedAt: generationDate,
            dataAsOf: date,
            conversions: Object.fromEntries(
                fromCurrencies
                    .map((cur) => [cur, ratesForCurrency(cur, rates, refCurrency)])
            )
        }))
}

export function extractRates(xmlData) {
    return parseXML(xmlData)
        .then(data => {
            data = data["gesmes:Envelope"]["Cube"][0]["Cube"][0];
            return {
                date: new Date(data.$.time).toISOString(),
                rates: Object.fromEntries(data.Cube.map(el => [el.$.currency, parseFloat(el.$.rate)]))
            }
        })
}

function parseXML(xmlStr) {
    return new Promise((resolve, reject) => {
        var parser = new xml2js.Parser();
        parser.on('error', reject);
        parser.parseString(xmlStr, (err, result) => {
            if (err) reject(err);
            resolve(result);
        })
    })
}

export function ratesForCurrency(currency, rates, refCur = 'EUR') {
    rates = Object.assign({[refCur]: 1}, rates);
    const ratio = 1 / rates[currency];
    return Object.fromEntries(Object.entries(rates).map(([cur, rate]) => [cur, rate * ratio]))
}
