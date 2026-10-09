import { JetBrains_Mono, Manrope } from 'next/font/google';

// Tipografías de la landing. next/font las descarga al compilar y las sirve desde el
// propio sitio: el visitante no hace pedidos a Google. Las dos son variables, así que
// cubren 400-800 (Manrope) y 400-700 (JetBrains Mono) con un solo archivo cada una.
export const manrope = Manrope({
  variable: '--lp-font-manrope',
  subsets: ['latin'],
  display: 'swap',
});

export const jetbrainsMono = JetBrains_Mono({
  variable: '--lp-font-jetbrains',
  subsets: ['latin'],
  display: 'swap',
});
