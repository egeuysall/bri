import { type AppProps } from 'pastel';
import { ThemeProvider, defaultTheme, extendTheme } from '@inkjs/ui';

const theme = extendTheme(defaultTheme, {
  components: {
    Badge: {
      styles: {
        label: () => ({
          color: '#211814',
          backgroundColor: '#D77757',
          bold: true,
        }),
      },
    },
    Spinner: {
      styles: {
        frame: () => ({
          color: '#D77757',
        }),
        label: () => ({
          color: '#f0c7b7',
        }),
      },
    },
    StatusMessage: {
      styles: {
        text: () => ({
          color: '#f0c7b7',
        }),
      },
    },
  },
});

export default function App({ Component, commandProps }: AppProps) {
  return (
    <ThemeProvider theme={theme}>
      <Component {...commandProps} />
    </ThemeProvider>
  );
}
