import type { Options as RehypePrettyCodeOptions } from 'rehype-pretty-code';
import githubLight from 'shiki/themes/github-light.mjs';
import vesper from 'shiki/themes/vesper.mjs';

export const prettyCodeThemeName = 'vesper';

export const prettyCodeOptions: RehypePrettyCodeOptions = {
  theme: {
    dark: vesper,
    light: githubLight,
  },
  keepBackground: false,
};
