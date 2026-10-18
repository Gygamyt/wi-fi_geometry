export function decodeNetshOutput(data: Buffer, encoding = process.env.WIFI_MAPPER_ENCODING || 'utf-8'): string {
    if (data[0] === 0xff && data[1] === 0xfe) {
        encoding = 'utf-16le';
    } else if (data[0] === 0xfe && data[1] === 0xff) {
        encoding = 'utf-16be';
    }
    try {
        return new TextDecoder(encoding, { fatal: true }).decode(data);
    } catch {
        throw new Error(`Cannot decode netsh output as ${encoding}. Set WIFI_MAPPER_ENCODING to the actual encoding (for example ibm866 or windows-1251), or use networks --raw.`);
    }
}

