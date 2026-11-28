import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from './context/AuthContext';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'SGS School Admin Dashboard',
  description: 'School Management System',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      {/*
        The dark background belongs on the body, not on each page.

        Every screen in this module is designed for a dark theme — the student
        dashboard, for instance, is text-white on text-white/60. This layout
        set no background at all, so those pages rendered white text on the
        browser's default white: the page looked completely blank while the
        markup was present and correct the whole time.

        The pages that did look right, such as the students console, were
        painting their own dark background and so did not depend on this.

        These are the colours from app/layout.js, which this file shadows —
        two root layouts exist in this folder and only this one is used.
      */}
      <body className={`${inter.className} min-h-screen bg-[#0a0a0f] text-slate-200`}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}