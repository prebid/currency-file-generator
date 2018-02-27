# currency-file-generator
Loads currency rates from api.fixer.io and creates and uploads a JSON representation to S3.
This code is used to generate the file that is published to <http://currency.prebid.org/latest.json>.

## Repo structure:

### Lambda Config
+ `src/currencyRatesFileGen.js` - File
+ `currencyRatesFilesGen.handler` - Handler

### Install
    $ git clone https://github.com/prebid/currency-file-generator.git
    $ cd currency-file-generator
    $ npm install
        
### Test
    $ npm run test
