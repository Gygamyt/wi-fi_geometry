export function clearTerminal(): void {
    if (process.stdout.isTTY) {
        // Clear the screen and scrollback, then move the cursor to the top left.
        process.stdout.write('\u001b[2J\u001b[3J\u001b[H');
    }
}
