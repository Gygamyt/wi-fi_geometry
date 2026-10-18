import { stripVTControlCharacters } from 'node:util';
import { chalkStderr } from 'chalk';
import { captureNetworks } from '../collectors/netsh.ts';
import { decodeNetshOutput } from '../collectors/encoding.ts';
import { parseNetworks } from '../parsers/network-parser.ts';

function safeLabel(value: string): string {
    // Network names are external input and must not control the terminal.
    return stripVTControlCharacters(value).replace(/[\p{Cc}\p{Cf}]/gu, '\uFFFD') || '(non-printable)';
}

export async function showNetworks(): Promise<number> {
    const result = await captureNetworks();
    if (result.exitCode !== 0) {
        process.stdout.write(result.stdout);
        process.stderr.write(result.stderr);
        return result.exitCode;
    }
    if (result.stderr.length) {
        process.stderr.write(result.stderr);
    }
    try {
        const observations = parseNetworks(decodeNetshOutput(result.stdout));
        if (observations.length === 0) {
            console.log('No networks are currently visible.');
        } else {
            console.table(observations.map((network) => ({
                SSID: network.ssid === '' ? '(hidden)' : safeLabel(network.ssid),
                BSSID: network.bssid,
                Signal: network.signalQualityPercent === null ? '—' : `${network.signalQualityPercent}%`,
                Band: network.bandGHz === null ? '—' : `${network.bandGHz} GHz`,
                Channel: network.channel ?? '—',
                Radio: network.radioType === null ? '—' : safeLabel(network.radioType),
            })));
            console.log(`${observations.length} BSSID record(s). Signal is quality in percent, not measured RSSI in dBm.`);
        }
        return 0;
    } catch (error) {
        process.stdout.write(result.stdout);
        console.error(chalkStderr.yellow(error instanceof Error ? error.message : String(error)));
        console.error(chalkStderr.yellow('Showing raw output instead. No structured result was produced.'));
        return 1;
    }
}
