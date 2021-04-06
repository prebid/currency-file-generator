const https = require('https');
const {requestJSONData, requestXMLData} = require('../src/ajax.js');

// Mock for https.get callback argument: response
const resp = {
    eventHandlers: {},
    data(chunk) {
        return (resp.eventHandlers['data']) ? resp.eventHandlers['data'](chunk) : function (chunk) {
            throw Error('on.data downloadPublish does not exist:', chunk);
        };
    },
    end() {
        return (resp.eventHandlers['end']) ? resp.eventHandlers['end']() : function () {
            throw Error('on.end downloadPublish does not exist');
        };
    },
    error(e) {
        return (resp.eventHandlers['error']) ? resp.eventHandlers['error'](e) : function (e) {
            throw Error('on.error downloadPublish does not exist', e);
        };
    },
    on(eventType, downloadPublish) {
        resp.eventHandlers[eventType] = downloadPublish;
    },
    reset() {
        Object.keys(resp.eventHandlers).forEach(key => {
            resp.eventHandlers[key] = undefined;
        });
    }
};

beforeEach(() => {
    resp.reset();
    jest.resetAllMocks()
});

describe('Integration tests', () => {
    test('requestJsonData', () => {
        // Mock https get and requestCurrencyFile callback
        const httpGetSpy = jest.spyOn(https, 'get').mockImplementation((url, callback) => {
            callback(resp);
            switch (url) {
                case 'fileSuccess':
                    resp.data('{');
                    resp.data('"body":"content"');
                    resp.data('}');
                    resp.end();
                    break;
                case 'fileEnd':
                    resp.end();
                    break;
                case 'fileError':
                    resp.error(new Error('Error: https could not be parsed'));
                    break;
                case 'fileBroken':
                    resp.data('{');
                    resp.data('"body":"content"');
                    resp.end();
                    break;
            }
        });
        const mockResolve = jest.fn();
        const mockReject = jest.fn();

        requestJSONData('fileSuccess', mockResolve, mockReject);
        expect(mockResolve).toBeCalledWith({body: 'content'});

        requestJSONData('fileEnd', mockResolve, mockReject);
        expect(mockReject).toBeCalledWith(expect.any(Error));

        requestJSONData('fileError', mockResolve, mockReject);
        expect(mockReject).toBeCalledWith('Error: response body is empty');

        requestJSONData('fileBroken', mockResolve, mockReject);
        expect(mockReject).toBeCalledWith(expect.any(Error));

        httpGetSpy.mockRestore();
    })
    test('requestXmlData', () => {
        // Mock https get and requestCurrencyFile callback
        const httpGetSpy = jest.spyOn(https, 'get').mockImplementation((url, callback) => {
            callback(resp);
            switch (url) {
                case 'fileSuccess':
                    resp.data('<body>content</body>');
                    resp.end();
                    break;
                case 'fileEnd':
                    resp.end();
                    break;
                case 'fileError':
                    resp.error(new Error('Error: https could not be parsed'));
                    break;
                case 'fileBroken':
                    resp.data('{');
                    resp.data('"body":"content"');
                    resp.end();
                    break;
            }
        });
        const mockResolve = jest.fn();
        const mockReject = jest.fn();

        requestXMLData('fileSuccess', mockResolve, mockReject);
        expect(mockResolve).toBeCalledWith({body: 'content'});

        requestXMLData('fileEnd', mockResolve, mockReject);
        expect(mockReject).toBeCalledWith('Error: response body is empty');

        requestXMLData('fileError', mockResolve, mockReject);
        expect(mockReject).toBeCalledWith('Error: response body is empty');

        requestXMLData('fileBroken', mockResolve, mockReject);
        expect(mockReject).toBeCalledWith(expect.any(Error));

        httpGetSpy.mockRestore();
    })
});
