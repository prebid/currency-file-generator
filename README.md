## currency-file-generator
Loads currency rates from api.fixer.io and creates and uploads a JSON representation to S3.

This code is used to generate the file that is published to <http://currency.prebid.org/latest.json>.

*AWS Lambda Config*
+ `src/currencyRatesFileGen.js` - File
+ `currencyRatesFilesGen.handler` - Handler

## currency-rates-file-alerter
Checks for stale currency files and sends an alert email

*AWS Lambda Config*
+ `src/preidCurrencyRatesFileAlerter.js` - File
+ `preidCurrencyRatesFileAlerter.handler` - Handler

---

### Install
    $ git clone https://github.com/prebid/currency-file-generator.git
    $ cd currency-file-generator
    $ npm install
        
### Test
    $ npm run test
