const https = require('https');

/**
 * @param {string} url
 * @param {function} resolve function to execute in case of success
 * @param {function} reject function to execute in the case of failure
 */
exports.requestXMLData = function (url, resolve, reject) {

    var https = require('https');
    var xml2js = require('xml2js');
    var parser = new xml2js.Parser();

    parser.on('error', function (err) {
        reject(err);
    });

    let data = '';
    return https.get(url, function (res) {

        res.on('data', function (data_) {
            data += data_.toString();
        });
        res.on('error', (e) => {
            reject(e);
        });
        res.on('data', function (data_) {
            data += data_.toString();
        });
        res.on('end', function () {
            if (data === '') {
                reject('Error: response body is empty');
            }
            parser.parseString(data, function (err, result) {
                if (err) {
                    reject(err)
                }
                resolve(result)
            });
        });
    });
}

exports.requestJSONData = function (url, resolve, reject) {

    return https.get(url, (res /** @type {https.IncomingMessage} */) => {
        let body = '';

        // the 'data' event is emitted whenever the stream is relinquishing ownership of a chunk of data to the consumer
        res.on('data', (chunk) => {
            body += chunk;
        });

        // the 'error' event emits if the stream is unable to generate data due to internal failure or from an invalid chunk of data
        res.on('error', (e) => {
            reject(e);
        });

        // The 'end' event is emitted after all data has been output.
        res.on('end', () => {
            if (body === '') {
                reject('Error: response body is empty');
            }
            try {
                const json = JSON.parse(body);
                resolve(json);
            }
            catch (e) {
                reject(e);
            }
        });
    });
}
