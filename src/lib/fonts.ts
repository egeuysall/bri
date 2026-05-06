import { Geist_Mono, Noto_Sans_Math } from 'next/font/google';

export const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
});

export const notoSansMath = Noto_Sans_Math({
  subsets: ['math'],
  weight: '400',
  variable: '--font-noto-sans-math',
});
