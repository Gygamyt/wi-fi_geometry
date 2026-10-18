import type {NetworkObservation} from './network.ts';

export type Measurement = {
    schemaVersion: 1;
    source: 'netsh';
    targetBssid: string;
    sampleIndex: number;
    startedAt: string;
    completedAt: string;
    status: 'observed' | 'missing' | 'error';
    observation: NetworkObservation | null;
    exitCode: number | null;
    error: string | null;
    raw: {stdoutBase64: string; stderrBase64: string};
};
