import type { Metadata } from 'next';
import { Poppins } from 'next/font/google';
import './globals.css';
import NavBar from '@/components/NavBar';

const poppins = Poppins({
  weight: ['400', '500', '600', '700'],
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'ResWave - AI Resume Optimizer',
  description: 'Optimize your resume with AI-powered suggestions',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={poppins.className}>
        <NavBar />
        <main className="container mx-auto px-4 py-8 mt-8 relative z-10">
          <div className="bg-white/80 backdrop-blur-sm rounded-lg shadow-lg p-6">
            {children}
          </div>
        </main>
      </body>
    </html>
  );
}
