import {cancel, confirm, intro, log, outro, select} from '@clack/prompts';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {runSession} from '../../../ui/session.ts';
import {clearTerminal} from '../../../ui/terminal.ts';

vi.mock('../../../ui/terminal.ts', () => ({clearTerminal: vi.fn()}));

vi.mock('@clack/prompts', () => ({
    intro: vi.fn(),
    outro: vi.fn(),
    cancel: vi.fn(),
    select: vi.fn(),
    confirm: vi.fn(),
    isCancel: (value: unknown) => typeof value === 'symbol',
    log: {info: vi.fn(), step: vi.fn(), success: vi.fn(), warn: vi.fn()},
}));

beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.mocked(confirm).mockResolvedValue(true);
});

describe('interactive session', () => {
    it('offers the available commands and exits when Exit is selected', async () => {
        vi.mocked(select).mockResolvedValue('exit');
        const execute = vi.fn();
        await runSession(execute);
        expect(intro).toHaveBeenCalledOnce();
        expect(select).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
            options: [
                expect.objectContaining({value: 'drivers'}),
                expect.objectContaining({value: 'interfaces'}),
                expect.objectContaining({value: 'networks'}),
                expect.objectContaining({value: 'toggle-output'}),
                expect.objectContaining({value: 'exit'}),
            ],
        }));
        expect(execute).not.toHaveBeenCalled();
        expect(outro).toHaveBeenCalledOnce();
        expect(cancel).not.toHaveBeenCalled();
    });

    it('runs multiple commands in order and returns to the menu', async () => {
        vi.mocked(select)
            .mockResolvedValueOnce('drivers')
            .mockResolvedValueOnce('interfaces')
            .mockResolvedValueOnce('networks')
            .mockResolvedValueOnce('exit');
        const execute = vi.fn().mockResolvedValue(0);
        await runSession(execute);
        expect(execute.mock.calls).toEqual([['drivers'], ['interfaces'], ['networks']]);
        expect(select).toHaveBeenCalledTimes(4);
        expect(log.success).toHaveBeenCalledTimes(3);
        expect(log.warn).not.toHaveBeenCalled();
    });

    it('waits for the command to finish before reopening the menu', async () => {
        vi.mocked(select).mockResolvedValueOnce('networks').mockResolvedValueOnce('exit');
        let finish!: (code: number) => void;
        const execute = vi.fn(() => new Promise<number>((resolve) => { finish = resolve; }));
        const session = runSession(execute);
        await vi.waitFor(() => expect(execute).toHaveBeenCalledOnce());
        expect(select).toHaveBeenCalledOnce();
        finish(0);
        await session;
        expect(select).toHaveBeenCalledTimes(2);
    });

    it('allows another command after a command failure', async () => {
        vi.mocked(select)
            .mockResolvedValueOnce('networks')
            .mockResolvedValueOnce('drivers')
            .mockResolvedValueOnce('exit');
        const execute = vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(0);
        await runSession(execute);
        expect(execute.mock.calls).toEqual([['networks'], ['drivers']]);
        expect(log.warn).toHaveBeenCalledOnce();
        expect(log.success).toHaveBeenCalledOnce();
    });

    it('ends the session when the menu is cancelled', async () => {
        vi.mocked(select).mockResolvedValue(Symbol('cancel'));
        const execute = vi.fn();
        await runSession(execute);
        expect(cancel).toHaveBeenCalledOnce();
        expect(outro).not.toHaveBeenCalled();
        expect(execute).not.toHaveBeenCalled();
    });

    it('keeps results visible until the user returns to the menu in clean mode', async () => {
        vi.mocked(select).mockResolvedValueOnce('drivers').mockResolvedValueOnce('exit');
        let resume!: (value: boolean) => void;
        vi.mocked(confirm).mockImplementationOnce(() => new Promise<boolean>((resolve) => { resume = resolve; }));
        const session = runSession(vi.fn().mockResolvedValue(0));
        await vi.waitFor(() => expect(confirm).toHaveBeenCalledOnce());
        expect(clearTerminal).toHaveBeenCalledTimes(2);
        expect(select).toHaveBeenCalledOnce();
        resume(true);
        await session;
        expect(clearTerminal).toHaveBeenCalledTimes(3);
    });

    it('never clears the terminal or pauses in history mode', async () => {
        vi.mocked(select).mockResolvedValueOnce('drivers').mockResolvedValueOnce('exit');
        await runSession(vi.fn().mockResolvedValue(0), 'history');
        expect(clearTerminal).not.toHaveBeenCalled();
        expect(confirm).not.toHaveBeenCalled();
    });

    it('switches from history to clean mode in the menu', async () => {
        vi.mocked(select).mockResolvedValueOnce('toggle-output').mockResolvedValueOnce('exit');
        await runSession(vi.fn(), 'history');
        expect(clearTerminal).toHaveBeenCalledOnce();
        expect(select).toHaveBeenLastCalledWith(expect.objectContaining({
            options: expect.arrayContaining([expect.objectContaining({value: 'toggle-output', label: 'Output mode: clean'})]),
        }));
    });

    it('switches from clean to history without clearing again', async () => {
        vi.mocked(select).mockResolvedValueOnce('toggle-output').mockResolvedValueOnce('drivers').mockResolvedValueOnce('exit');
        await runSession(vi.fn().mockResolvedValue(0));
        expect(clearTerminal).toHaveBeenCalledOnce();
        expect(confirm).not.toHaveBeenCalled();
    });

    it.each([false, Symbol('cancel')])('ends the session when the result prompt returns %s', async (answer) => {
        vi.mocked(select).mockResolvedValueOnce('drivers');
        vi.mocked(confirm).mockResolvedValueOnce(answer as Awaited<ReturnType<typeof confirm>>);
        await runSession(vi.fn().mockResolvedValue(0));
        expect(select).toHaveBeenCalledOnce();
        if (typeof answer === 'symbol') {
            expect(cancel).toHaveBeenCalledOnce();
        } else {
            expect(outro).toHaveBeenCalledOnce();
        }
    });
});
