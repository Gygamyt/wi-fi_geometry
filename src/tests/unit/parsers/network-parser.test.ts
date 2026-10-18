import { describe, expect, it } from 'vitest';
import { parseNetworks } from '../../../parsers/network-parser.ts';

// Synthetic Windows output: no real network names or device identifiers.
const english = `Interface name : Test adapter
There are 1 networks currently visible.
SSID 1 : Lab: Example
    Authentication : WPA2-Personal
    BSSID 1 : 02:00:00:00:00:01
         Signal : 75%
         Radio type : 802.11ax
         Band : 2.4 GHz
         Channel : 3
         Basic rates (Mbps) : 1 2 5.5 11
    BSSID 2 : 02:00:00:00:00:02
         Signal : 0%
         Radio type : 802.11ac
         Band : 5 GHz
         Channel : 44
`;

describe('parseNetworks', () => {
    it('creates one observation per BSSID and retains the shared SSID', () => {
        expect(parseNetworks(english)).toEqual([
            { ssid: 'Lab: Example', bssid: '02:00:00:00:00:01', signalQualityPercent: 75, radioType: '802.11ax', bandGHz: 2.4, channel: 3 },
            { ssid: 'Lab: Example', bssid: '02:00:00:00:00:02', signalQualityPercent: 0, radioType: '802.11ac', bandGHz: 5, channel: 44 },
        ]);
    });

    it('supports Russian labels, comma decimals, nonbreaking spaces and CRLF', () => {
        const text = ['Имя интерфейса: Test adapter', 'SSID 1: Example', ' BSSID 1 : 02:00:00:00:AA:01',
            ' Сигнал : 100%', ' Тип радио : 802.11ax', ' Диапазон : 2,4\u00a0ГГц', ' Канал : 6'].join('\r\n');
        expect(parseNetworks(text)).toEqual([
            { ssid: 'Example', bssid: '02:00:00:00:aa:01', signalQualityPercent: 100, radioType: '802.11ax', bandGHz: 2.4, channel: 6 },
        ]);
    });

    it('preserves hidden names, colon-prefixed names and missing measurements', () => {
        expect(parseNetworks('SSID 1: :example\n BSSID 1: 02:00:00:00:00:01\nSSID 2:\n BSSID 1: 02:00:00:00:00:02'))
            .toEqual([
                { ssid: ':example', bssid: '02:00:00:00:00:01', signalQualityPercent: null, bandGHz: null, channel: null, radioType: null },
                { ssid: '', bssid: '02:00:00:00:00:02', signalQualityPercent: null, bandGHz: null, channel: null, radioType: null },
            ]);
    });

    it('does not carry fields into another BSSID or SSID', () => {
        const observations = parseNetworks(`${english}SSID 2: Another\n BSSID 1: 02:00:00:00:00:03`);
        expect(observations[2]).toEqual({ ssid: 'Another', bssid: '02:00:00:00:00:03', signalQualityPercent: null, bandGHz: null, channel: null, radioType: null });
    });

    it.each(['There are 0 networks currently visible.', 'Сейчас видно следующее количество сетей: 0.'])('recognizes an explicitly empty result: %s', (text) => {
        expect(parseNetworks(text)).toEqual([]);
    });

    it.each(['', 'Permission denied', 'SSID 1: Example', 'Unknown localized output'])('rejects unrecognized or incomplete output: %s', (text) => {
        expect(() => parseNetworks(text)).toThrow('No BSSID records recognized');
    });

    it.each(['BSSID 1: invalid', 'BSSID 1: 02:00:00:00:00:01'])('rejects malformed or orphan BSSID records: %s', (text) => {
        expect(() => parseNetworks(text)).toThrow('Invalid BSSID');
    });

    it('resets context at an interface boundary', () => {
        expect(() => parseNetworks(`${english}Interface name: Another\nBSSID 1: 02:00:00:00:00:03`)).toThrow('Invalid BSSID');
    });

    it.each([
        'SSID 1: There are 0 networks currently visible.',
        `${english}SSID 2: Incomplete`,
        `SSID 1: Incomplete\n${english}`,
        'SSID 1: Incomplete\nInterface name: Another\nThere are 0 networks currently visible.',
    ])('rejects incomplete SSIDs instead of silently showing a partial or empty result', (text) => {
        expect(() => parseNetworks(text)).toThrow('No BSSID records recognized');
    });

    it.each(['-1%', '101%', 'unknown', '75 dBm'])('does not turn invalid signal quality into a measurement: %s', (value) => {
        expect(parseNetworks(english.replace('75%', value))[0]?.signalQualityPercent).toBeNull();
    });

    it('leaves invalid band and channel values unknown', () => {
        const result = parseNetworks(english.replace('2.4 GHz', 'unknown').replace('Channel : 3', 'Channel : 0'));
        expect(result[0]?.bandGHz).toBeNull();
        expect(result[0]?.channel).toBeNull();
    });

    it('recognizes 6 GHz without inferring the band from the channel', () => {
        expect(parseNetworks(english.replace('2.4 GHz', '6 GHz'))[0]?.bandGHz).toBe(6);
        expect(parseNetworks(english.replace('Band : 2.4 GHz', 'Other : unknown'))[0]?.bandGHz).toBeNull();
    });
});

