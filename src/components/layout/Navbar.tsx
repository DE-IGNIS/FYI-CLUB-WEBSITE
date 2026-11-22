import React, { useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { CLUB_META } from '../../data/clubData';
import logoUrl from '../../assets/fyi-logo.webp';

export const Navbar: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // One route list drives both desktop links and the mobile drawer.
  const navItems = [
    { label: 'Home', path: '/' },
    { label: 'About', path: '/about' },
    { label: 'Projects', path: '/projects' },
    { label: 'Events', path: '/events' },
    { label: 'Team', path: '/team' },
    { label: 'Gallery', path: '/gallery' },
  ];

  return (
    <header className="sticky top-0 left-0 w-full z-50 bg-[#F6F3EB]/95 backdrop-blur-md border-b-2 border-primary transition-all">
      <div className="h-20 sm:h-22 max-w-7xl mx-auto px-3 sm:px-4 md:px-8 flex items-center justify-between gap-2 sm:gap-4">
        {/* Brand & Official Logo Lockup */}
        <Link to="/" className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3 md:gap-4 group select-none whitespace-nowrap lg:flex-none">
          <div className="relative w-14 h-14 sm:w-16 sm:h-16 bg-white border-2 border-primary brutal-shadow-sm rounded-lg flex items-center justify-center p-1.5 group-hover:-rotate-2 transition-transform duration-200 overflow-hidden flex-shrink-0">
            <img
              src={logoUrl}
              alt="FYI Logo"
              className="w-full h-full object-contain"
            />
          </div>
          <div className="flex min-w-0 flex-col justify-center">
            <div className="flex items-center gap-1.5">
              <span className="truncate font-mono font-black text-xs sm:text-sm md:text-base tracking-tight text-primary lowercase">
                fyi<span className="text-brand-orange">.</span>vitbhopal
              </span>
              <span className="hidden sm:inline-flex bg-brand-cyan text-primary border border-primary px-1.5 py-0.5 text-[9px] font-mono font-black leading-none uppercase tracking-wider">
                CHAPTER
              </span>
            </div>
            <span className="hidden sm:block font-mono text-[9px] text-brand-muted tracking-wider uppercase mt-0.5">
              student innovation guild
            </span>
          </div>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden lg:flex items-center gap-6">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `font-headline font-bold text-sm uppercase tracking-wide transition-colors ${
                  isActive
                    ? 'text-brand-orange underline decoration-wavy decoration-brand-yellow decoration-2 underline-offset-4'
                    : 'text-primary hover:text-brand-orange hover:underline decoration-2 underline-offset-4'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Status & CTA */}
        <div className="ml-auto flex shrink-0 items-center gap-3 lg:ml-0">
          <div className="hidden xl:inline-flex items-center gap-2 bg-white border-2 border-primary brutal-shadow-sm px-3 py-1.5 rounded-full">
            <span className="w-2.5 h-2.5 rounded-full bg-brand-orange animate-pulse" />
            <span className="font-mono text-xs font-bold uppercase tracking-tight">
              {CLUB_META.status}
            </span>
          </div>

          <Link
            to="/join"
            className="magnetic-btn btn-elastic hidden lg:inline-flex items-center justify-center bg-primary text-white hover:bg-brand-orange hover:text-primary font-mono text-xs md:text-sm px-4 md:px-5 py-2.5 rounded border-2 border-primary brutal-shadow font-extrabold tracking-wider uppercase transition-all"
          >
            JOIN FYI ↗
          </Link>

          {/* Mobile Menu Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden flex h-11 w-11 shrink-0 items-center justify-center rounded border-2 border-primary bg-white p-0 text-primary brutal-shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange"
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-site-navigation"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="block h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              {mobileMenuOpen
                ? <path d="M6 6l12 12M18 6L6 18" />
                : <path d="M3 6h18M3 12h18M3 18h18" />}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <nav id="mobile-site-navigation" aria-label="Mobile navigation" className="lg:hidden bg-[#F6F3EB] border-b-2 border-primary px-6 py-6 flex flex-col gap-4 font-headline font-bold text-lg uppercase">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => setMobileMenuOpen(false)}
              className={({ isActive }) =>
                `py-2 border-b border-primary/20 ${
                  isActive ? 'text-brand-orange' : 'hover:text-brand-orange'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
          <Link
            to="/join"
            onClick={() => setMobileMenuOpen(false)}
            className="py-2.5 text-center bg-brand-orange text-white border-2 border-primary brutal-shadow font-mono text-sm uppercase font-black"
          >
            APPLY TO GUILD ↗
          </Link>
          <div className="flex items-center justify-center gap-3 pt-2 font-mono text-[11px] font-bold">
            <a
              href={CLUB_META.socials.instagram}
              target="_blank"
              rel="noreferrer"
              className="text-primary hover:text-brand-orange underline underline-offset-2"
            >
              @fyivitbhopal
            </a>
            <span className="opacity-30">•</span>
            <a
              href={CLUB_META.socials.github}
              target="_blank"
              rel="noreferrer"
              className="text-primary hover:text-brand-orange underline underline-offset-2"
            >
              GitHub
            </a>
            <span className="opacity-30">•</span>
            <a
              href={CLUB_META.socials.linkedin}
              target="_blank"
              rel="noreferrer"
              className="text-primary hover:text-brand-orange underline underline-offset-2"
            >
              LinkedIn
            </a>
          </div>
        </nav>
      )}
    </header>
  );
};

