import { afterEach, expect, it, vi } from 'vitest';
import { clearTerminal } from '../../../ui/terminal.ts';

const originalTTY = Object.getOwnPropertyDescriptor(process.stdout, 'isTTY');

afterEach(() => {
    if (originalTTY) {
        Object.defineProperty(process.stdout, 'isTTY', originalTTY);
    } else {
        Reflect.deleteProperty(process.stdout, 'isTTY');
    }
});

it('clears the screen and scrollback in a terminal', () => {
    Object.defineProperty(process.stdout, 'isTTY', { value: true, configurable: true });
    const write = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    clearTerminal();
    expect(write).toHaveBeenCalledExactlyOnceWith('\u001b[2J\u001b[3J\u001b[H');
});

it('does not write terminal control codes to redirected output', () => {
    Object.defineProperty(process.stdout, 'isTTY', { value: false, configurable: true });
    const write = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    clearTerminal();
    expect(write).not.toHaveBeenCalled();
});
