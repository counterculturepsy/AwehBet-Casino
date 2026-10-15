import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AwehBet | South African Slots Experience',
  description: 'Explore the AwehBet demo slots lobby. Real-money play is not available.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en-ZA"><body>{children}</body></html>;
}
