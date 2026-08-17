// MV3 has no persistent background page, so this service worker's only job
// is a daily alarm that keeps the cached Klipy key fresh (see
// js/remoteConfig.js). It does nothing else and holds nothing else.
import { refreshKlipyKey } from './remoteConfig.js';

const ALARM_NAME = 'gifgo-refresh-klipy-key';

chrome.runtime.onInstalled.addListener(() => {
    chrome.alarms.create(ALARM_NAME, { periodInMinutes: 60 * 24 });
});

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ALARM_NAME) refreshKlipyKey();
});
