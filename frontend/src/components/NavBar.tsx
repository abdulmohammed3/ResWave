'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/nextjs';

export default function NavBar() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  const isActive = (path: string) => pathname === path;

  const navItems = [
    { name: 'Home', path: '/' },
    { name: 'Resume Manager', path: '/files' },
    { name: 'Doc Optimizer', path: '/optimizer' },
    { name: 'Pricing', path: '/pricing' },
  ];

  return (
    <nav className="relative bg-transparent shadow-lg">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center">
          <SignedOut>
              <SignInButton />
            </SignedOut>
            <SignedIn>
              <UserButton />
            </SignedIn>
            <Link href="/" className="text-2xl font-bold text-[#4A90A0] hover:text-gray-800 transition-colors duration-300">
              ResWave
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-2">
            {navItems.map((item) => (
              <Link
                key={item.path}
                href={item.path}
                className={`
                  px-4 py-2 rounded-md text-sm font-medium transition-all duration-300
                  ${isActive(item.path)
                    ? 'bg-white text-[#4A90A0] shadow-sm'
                    : 'text-gray-700 hover:bg-white/50'
                  }
                `}
              >
                {item.name}
              </Link>
            ))}
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="p-2 rounded-md text-gray-700 hover:bg-white/50 focus:outline-none transition-colors duration-300"
            >
              {isOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isOpen && (
          <div className="md:hidden absolute inset-x-0 top-16 z-50">
            <div className="px-2 pt-2 pb-3 space-y-1 bg-white/95 backdrop-blur-sm shadow-lg rounded-b-lg">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  href={item.path}
                  onClick={() => setIsOpen(false)}
                  className={`
                    block px-4 py-2 rounded-md text-base font-medium transition-colors duration-300
                    ${isActive(item.path)
                      ? 'bg-[#A8D8EA] text-gray-800'
                      : 'text-gray-700 hover:bg-[#A8D8EA]/30'
                    }
                  `}
                >
                  {item.name}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
