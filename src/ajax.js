const https = require('https');

/**
 * @param {string} url
 * @param {function} resolve function to execute in case of success
 * @param {function} reject function to execute in the case of failure
 */
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