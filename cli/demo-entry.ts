import process from 'node:process';
import { main } from './bri';

main(process.argv.slice(2), import.meta).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
