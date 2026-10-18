import {runNetsh} from './netsh.ts';
import type {WifiCommand} from './netsh.ts';

const help = `Wi-Fi Mapper — v0.1, исходный вывод netsh

Запуск: node src/cli.ts <команда>

  drivers      Адаптер, драйвер, поддерживаемые стандарты и диапазоны
  interfaces   Состояние адаптера и текущего подключения
  networks     Видимые сети с деталями по BSSID
  --help       Справка

Данные и сообщения Windows выводятся без разбора и преобразований.
`;

const args = process.argv.slice(2);
const command = args[0];

if (args.length === 0 || (args.length === 1 && (command === '--help' || command === '-h'))) {
    console.log(help);
} else if (
    args.length !== 1 ||
    (command !== 'drivers' && command !== 'interfaces' && command !== 'networks')
) {
    console.error('Укажите одну команду: drivers, interfaces или networks. Справка: --help.');
    process.exitCode = 2;
} else {
    try {
        const exitCode = await runNetsh(command satisfies WifiCommand);
        process.exitCode = exitCode;
        if (exitCode !== 0) {
            console.error(`netsh завершился с кодом ${exitCode}. Причина указана в сообщении Windows выше.`);
        }
    } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
    }
}
