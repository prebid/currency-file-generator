// prebidCurrencyRatesFileGenerator
// loads currency rates from api.fixer.io and creates a JSON representation in S3
// revision:
var http = require('http');
var AWS = require('aws-sdk');

var fromCurrencies = ['USD','GBP'];
var supportedCurrencies = 'AUD,BRL,CAD,CHF,CNY,CZK,DKK,EUR,GBP,HKD,HUF,IDR,ILS,INR,JPY,KRW,MXN,MYR,NOK,NZD,PHP,PLN,RUB,SEK,SGD,THB,TRY,USD,ZAR';

var bucket = 'currency.prebid.org';
var filename = 'latest.json';
var debug = true;
var expires = 24 * 3600 + 5; // when to expire for HTTP "Expires:" header (seconds)

exports.handler = function(event, context) {
    var results = [];
    var countCompleted = 0;
    for (let fromCurrency of fromCurrencies) {
        let url = 'http://api.fixer.io/latest?base=' + fromCurrency + '&symbols=' + supportedCurrencies;
        log('requesting: ' + url);
        let req = http.get(url, (res) => {
            var body = '';
            res.on('data', (d) => { body += d; });
            res.on('end', () => {
                results.push(JSON.parse(body));
                countCompleted++;
                if (countCompleted == fromCurrencies.length) {
                    var document = {
                        "dataAsOf": new Date().toISOString().split('T')[0],
                        "conversions": {}
                    };
                    for (let cv = 0; cv < results.length; cv++) {
                        document.conversions[results[cv].base] = results[cv].rates;
                    }
                    log('rates s3 upload to: ' + bucket + ' ' + filename);
                    var s3 = new AWS.S3();
                    var param = { Bucket: bucket, Key: filename, Body: JSON.stringify(document), Expires: new Date(new Date().getTime() + expires * 1000) };
                    s3.upload(param, function(e, data) {
                        if (e) {
                            logError(e, e.stack);
                            context.done(null, JSON.stringify({ filename: filename, error: data }));
                        } else {
                            log('rates pushed to s3: ' + bucket + ' ' + filename);
                            context.done(null, JSON.stringify({ filename: filename }));
                        }
                    });
                }
            });
        });
    }
}

function log (line) {
    if (debug) console.log(line);
}

function logError (line, error) {
    console.error(line, error);
}
