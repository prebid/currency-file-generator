## currency-file-generator
Loads currency rates from a reliable source and creates, uploads a JSON representation to S3, and pushes the file to the currency-file github repo.

The S3 file is published to <http://currency.prebid.org/latest.json>.
The github file is hosted at <https://cdn.jsdelivr.net/gh/prebid/currency-file@1/latest.json>.

### Requirements
 - [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html)
 - AWS credentials for account 273354653561

### Install
```bash
git clone https://github.com/prebid/currency-file-generator.git
cd currency-file-generator
(cd generator; npm install)
```
        
### Test
```bash
(cd generator; npm test)
```

### Deploy (to beta stack)

```bash
sam build &&  sam deploy
```

The beta stack updates different files:

 - https://github.com/dgirardi-org/test-currency/blob/master/latest.json (canary checks https://cdn.jsdelivr.net/gh/dgirardi-org/test-currency@1/latest.json)
 - http://currency-file-generator-beta-testbucket-t9n7w68xdvap.s3-website-us-east-1.amazonaws.com/

### Deploy (to prod)

Once you are satisfifed with your testing in beta, deploy to prod with

```bash
sam build --config-env prod && sam deploy --config-env prod
```