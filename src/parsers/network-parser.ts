import type {NetworkObservation} from '../models/network.ts';

export function parseNetworks(text: string): NetworkObservation[] {
    const observations: NetworkObservation[] = [];
    let ssid: string | undefined;
    let current: NetworkObservation | undefined;

    function checkSSIDComplete() {
        if (ssid !== undefined && !current) {
            throw new Error('No BSSID records recognized for an SSID.');
        }
    }

    for (const line of text.replace(/^\uFEFF/, '').split(/\r?\n/)) {
        if (/^\s*(?:Interface name|Имя интерфейса)\s*:/i.test(line)) {
            checkSSIDComplete();
            ssid = undefined;
            current = undefined;
        }
        const ssidMatch = /^\s*SSID\s+\d+\s*:[ \t]?(.*)$/i.exec(line);
        if (ssidMatch) {
            checkSSIDComplete();
            ssid = ssidMatch[1] ?? '';
            current = undefined;
            continue;
        }
        const bssidMatch = /^\s*BSSID\s+\d+\s*:\s*(.*?)\s*$/i.exec(line);
        if (bssidMatch) {
            const bssid = bssidMatch[1] ?? '';
            if (ssid === undefined || !/^(?:[\da-f]{2}:){5}[\da-f]{2}$/i.test(bssid)) {
                throw new Error('Invalid BSSID record in netsh output.');
            }
            current = {ssid, bssid: bssid.toLowerCase(), signalQualityPercent: null, bandGHz: null, channel: null, radioType: null};
            observations.push(current);
            continue;
        }
        if (!current) {
            continue;
        }
        const field = /^\s*([^:]+):\s*(.*?)\s*$/.exec(line);
        if (!field) {
            continue;
        }
        const label = field[1]?.trim().toLowerCase();
        const value = field[2] ?? '';
        if (label === 'signal' || label === 'сигнал') {
            const match = /^(\d{1,3})\s*%$/.exec(value);
            const quality = match ? Number(match[1]) : NaN;
            current.signalQualityPercent = quality >= 0 && quality <= 100 ? quality : null;
        } else if (label === 'band' || label === 'диапазон') {
            const match = /^(2[.,]4|5|6)\s*(?:GHz|ГГц)$/i.exec(value);
            current.bandGHz = match ? Number(match[1]?.replace(',', '.')) : null;
        } else if (label === 'channel' || label === 'канал') {
            current.channel = /^\d+$/.test(value) && Number(value) > 0 ? Number(value) : null;
        } else if (label === 'radio type' || label === 'тип радио') {
            current.radioType = value || null;
        }
    }

    checkSSIDComplete();
    if (observations.length === 0 && !/^\s*(?:There are\s+0\s+networks currently visible\.?|Сейчас видно следующее количество сетей\s*:\s*0\.?)\s*$/im.test(text)) {
        throw new Error('No BSSID records recognized. Only English and Russian netsh network output is supported.');
    }
    return observations;
}
