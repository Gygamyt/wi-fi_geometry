import { describe, expect, it } from 'vitest';
import { decodeNetshOutput } from '../../../collectors/encoding.ts';

describe('decodeNetshOutput', () => {
    it('decodes UTF-8 without losing non-ASCII names', () => {
        expect(decodeNetshOutput(Buffer.from('Example: тест'), 'utf-8')).toBe('Example: тест');
    });

    it('recognizes a UTF-16LE byte-order mark', () => {
        expect(decodeNetshOutput(Buffer.from('\uFEFFExample: тест', 'utf16le'))).toBe('Example: тест');
    });

    it('recognizes a UTF-16BE byte-order mark', () => {
        expect(decodeNetshOutput(Buffer.from([0xfe, 0xff, 0, 65]))).toBe('A');
    });

    it('supports an explicit OEM encoding', () => {
        expect(decodeNetshOutput(Buffer.from([0x92, 0xa5, 0xe1, 0xe2]), 'ibm866')).toBe('Тест');
    });

    it.each([['utf-8', Buffer.from([0xff])], ['invalid-encoding', Buffer.from('Example')]])('fails explicitly when decoding with %s is impossible', (encoding, data) => {
        expect(() => decodeNetshOutput(data, encoding)).toThrow('WIFI_MAPPER_ENCODING');
    });
});
