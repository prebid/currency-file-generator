# currency-file-generator

This code is used to generate the file that is published to http://currency.prebid.org/latest.json.

___

#### AWS Lambda Source

* This repo contains the source `src/currencyRatesFileGen.js`, which is code linked to an AWS Lambda configuration. 

* A configuration property **Handler**, registers the `exports.handler` as the script entry point.

___

#### Tests
Run the jest unit tests with:
```
npm run test
```