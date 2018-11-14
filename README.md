## currency-file-generator
Loads currency rates from a reliable source and creates, uploads a JSON representation to S3, and pushes the file to the currency-file github repo.

The S3 file is published to <http://currency.prebid.org/latest.json>.
The github file is hosted at <https://cdn.jsdelivr.net/gh/prebid/currency-file@1/latest.json>.

### Install
    $ git clone https://github.com/prebid/currency-file-generator.git
    $ cd currency-file-generator
    $ npm install
        
### Test
    $ npm run test

#### AWS Lambda Config
+ `src/currencyRatesFileGen.js` - File
+ `currencyRatesFilesGen.handler` - Handler

## To install in AWS Lambda
1. Get the login/password from someone who has it
1. Update lambda function prebidCurrencyRatesFileAlerter from src/prebidCurrencyRatesFileAlerter.js
1. To update the prebidCurrencyRatesFileGenerator lambda:
    1. clone the git repo and make/test your changes locally
    1. copy src/currencyRatesFileGen.js src/ajax.js src/shell.js to the top level of your local repo dir
    1. the test node_modules aren't needed, so `rm -rf node_modules` and `npm install --production`
    1. zip -r currency-gen.zip currencyRatesFileGen.js serverless.yml node_modules
    1. aws s3 cp currency-gen.zip s3://currency-generation-code
    1. go to the AWS lambda UI and upload https://s3.amazonaws.com/currency-generation-code/currency-gen.zip
    1. make sure the environment variables are set correctly
    1. remove currencyRatesFileGen.js, ajax.js, and shell.js from the top level of your local repo dir
