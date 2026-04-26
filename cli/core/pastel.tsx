import process from 'node:process';
import { useEffect, useRef, useState } from 'react';
import { useApp } from 'ink';
import { Spinner, StatusMessage } from '@inkjs/ui';
import {
  createPrinter,
  maybeCheckUpdates,
  type CommandLike,
  type OptionValueSource,
} from './shared';
import { renderPanel } from './ui';

type RunCommandProps = {
  action: (command: CommandLike) => Promise<void>;
  label?: string;
  quiet?: boolean;
  json?: boolean;
  updateCheck?: boolean;
  skipUpdateCheck?: boolean;
};

function toFlagName(key: string): string {
  return key.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
}

export function createArgvCommand(argv = process.argv): CommandLike {
  const args = argv.slice(2);

  return {
    getOptionValueSource(key: string): OptionValueSource | undefined {
      const flag = toFlagName(key);
      return args.some((arg) => arg === `--${flag}` || arg.startsWith(`--${flag}=`) || arg === `--no-${flag}`)
        ? 'cli'
        : undefined;
    },
  };
}

export function RunCommand({
  action,
  label = 'Running',
  quiet = false,
  json = false,
  updateCheck = true,
  skipUpdateCheck = false,
}: RunCommandProps) {
  const app = useApp();
  const started = useRef(false);
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    if (started.current) {
      return;
    }

    started.current = true;

    void (async () => {
      try {
        const command = createArgvCommand();
        if (!skipUpdateCheck) {
          const color = process.stdout.isTTY;
          await maybeCheckUpdates(updateCheck, createPrinter(color, quiet || json));
        }

        await action(command);
        setComplete(true);
        setTimeout(() => app.exit(), 0);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        renderPanel({
          title: 'bri error',
          enableColor: process.stderr.isTTY,
          rows: [{ label: 'error', value: message, tone: 'warn' }],
          stderr: true,
        });
        process.exitCode = 1;
        setComplete(true);
        setTimeout(() => app.exit(error instanceof Error ? error : new Error(message)), 0);
      }
    })();
  }, [action, app, json, quiet, skipUpdateCheck, updateCheck]);

  if (quiet || json || complete) {
    return null;
  }

  return <Spinner label={label} />;
}

export function Done({ children }: { children: string }) {
  return <StatusMessage variant="success">{children}</StatusMessage>;
}
