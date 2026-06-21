import '../styles/globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'ORBIT — Social network that works for you',
  description: 'AI-native, anti-addiction, portable-identity. The social network that works for you, not on you.',
  keywords: ['social network', 'AI', 'privacy', 'portable identity', 'anti-addiction'],
  authors: [{ name: 'ORBIT' }],
  openGraph: {
    title: 'ORBIT',
    description: 'Social network that works for you, not on you.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-body antialiased">
        {children}
      </body>
    </html>
  );
}
