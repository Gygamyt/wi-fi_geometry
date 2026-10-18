import chalk, {chalkStderr} from 'chalk';
import {parseRecordingOptions} from '../services/recording-options.ts';
import {recordMeasurements} from '../services/record-measurements.ts';

export async function runRecording(args: string[]): Promise<number> {
    let options;
    try {
        options = parseRecordingOptions(args);
    } catch (error) {
        console.error(chalkStderr.red(error instanceof Error ? error.message : String(error)));
        return 2;
    }
    const controller = new AbortController();
    const cancel = () => controller.abort();
    process.on('SIGINT', cancel);
    try {
        console.log(`Recording ${options.count} observations to ${options.outputPath}`);
        console.log(chalk.dim('netsh may return cached data. Times describe collection, not a confirmed fresh radio scan. Ctrl+C stops recording.'));
        const result = await recordMeasurements(options, controller.signal, (sample) => {
            const quality = sample.observation?.signalQualityPercent;
            console.log(`${sample.sampleIndex}/${options.count}  ${sample.completedAt}  ${sample.status}  ${quality === null || quality === undefined ? '—' : `${quality}%`}`);
            if (sample.error) {
                console.error(chalkStderr.yellow(sample.error));
            }
        });
        console.log(`Saved ${result.written} record(s); ${result.errors} error(s).`);
        return controller.signal.aborted ? 130 : result.errors > 0 ? 1 : 0;
    } catch (error) {
        console.error(chalkStderr.red(error instanceof Error ? error.message : String(error)));
        return controller.signal.aborted ? 130 : 1;
    } finally {
        process.off('SIGINT', cancel);
    }
}
