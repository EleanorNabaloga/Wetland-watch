import { loadWetlands, checkLocation } from './geocheck.js';

const wetlands = loadWetlands();
const now = Date.now();
const show = (label, r) => console.log(label.padEnd(30), '->', r.status, r.reason ?? '', r.detail ?? '');

show('1. inside, good GPS, fresh',    checkLocation({ lat: 0.335, lng: 32.535,    accuracyM: 8,   capturedAt: now - 20000 }, wetlands));
show('2. far outside the wetland',    checkLocation({ lat: 0.350, lng: 32.560,    accuracyM: 8,   capturedAt: now - 20000 }, wetlands));
show('3. just outside the edge',      checkLocation({ lat: 0.335, lng: 32.540135, accuracyM: 20,  capturedAt: now - 20000 }, wetlands));
show('4. inside but poor GPS',        checkLocation({ lat: 0.335, lng: 32.535,    accuracyM: 120, capturedAt: now - 20000 }, wetlands));
show('5. inside but photo 30 min old',checkLocation({ lat: 0.335, lng: 32.535,    accuracyM: 8,   capturedAt: now - 30 * 60000 }, wetlands));
