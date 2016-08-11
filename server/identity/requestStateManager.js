/**
 * Created by valev on 2016-05-05.
 */

var activeRequests = new Map(),
    code2StateMap = new Map();

function addRequest(request, state) {
    code2StateMap.set(request.code, state);
    activeRequests.set(state, request);
}

function deleteRequestByState(state) {
    var cached = activeRequests.get(state);
    if (cached) {
        activeRequests.delete(state);
        code2StateMap.delete(cached.code);
    }
}

function deleteRequestByCode(code) {
    var state = code2StateMap.get(code) || '';
    activeRequests.delete(state);
    code2StateMap.delete(code);
}

function getRequestByState(state) {
    return activeRequests.get(state);
}

function getOrCreateRequestByState(state, payload) {
    var cached = getRequestByState(state);
    if (!cached) {
        addRequest(payload, state);
    }

    return payload;
}

function getRequestByCode(code) {
    var state = code2StateMap.get(code) || '';
    return activeRequests.get(state);
}

module.exports = {
    addRequest: addRequest,
    deleteRequestByState: deleteRequestByState,
    deleteRequestByCode: deleteRequestByCode,
    getRequestByState: getRequestByState,
    getOrCreateRequestByState: getOrCreateRequestByState,
    getRequestByCode: getRequestByCode
};