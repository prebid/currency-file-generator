function Response() {}
Response.prototype.constructor = Response;
Response.prototype.on = function(eventType, callback) {
    console.log('res events for each: ', eventType, callback(eventType));
};

exports.http = {
    /**
     * @param {string} url
     * @param {function} callback
     */
    get(url, callback) {
        const res = new Response();
        callback(res);

        return {
            'status': 'ok'
        };
    },

    reset(){
        console.log('resetting http mock');
    }
};