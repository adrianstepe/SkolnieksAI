"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { LogoWordmark } from "@/components/LogoWordmark";
import { Menu } from "lucide-react";

export function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? "bg-base/80 backdrop-blur-md border-b border-border py-3"
          : "bg-transparent py-5"
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
        <LogoWordmark size="md" />
        <div className="hidden md:flex items-center gap-8">
          <Link
            href="/login"
            className="text-sm font-medium text-white/60 hover:text-primary transition-colors"
          >
            Ieiet
          </Link>
          <Link
            href="/signup"
            className="bg-primary hover:bg-primary-hover text-white px-5 py-2.5 rounded-full text-sm font-semibold transition-all shadow-lg glow-primary"
          >
            Reģistrēties
          </Link>
        </div>
        <button className="md:hidden text-white" aria-label="Atvērt izvēlni">
          <Menu size={24} />
        </button>
      </div>
    </nav>
  );
}
