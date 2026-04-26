import { option } from 'pastel';
import zod from 'zod';

export const colorOption = zod.boolean().default(true).describe('Color output');
export const updateCheckOption = zod.boolean().default(true).describe("Don't check for CLI updates");
export const jsonOption = zod.boolean().describe('Output machine readable JSON');
export const quietOption = zod.boolean().describe(option({ description: 'Reduce non-essential logs', alias: 'q' }));
export const endpointOption = zod.string().optional().describe('API endpoint override');

export const commonOptions = {
  color: colorOption,
  updateCheck: updateCheckOption,
};

export const jsonColorOptions = {
  json: jsonOption,
  color: colorOption,
  updateCheck: updateCheckOption,
};
