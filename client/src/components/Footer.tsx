import { Link } from "wouter";
import { Mail, MapPin } from "lucide-react";

/** Site-wide footer, rendered once at the bottom of every page. */
export default function Footer() {
  return (
    <footer className="bg-[#0b1830] text-white/70 mt-auto">
      <div className="container py-10 grid gap-8 sm:grid-cols-3">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="h-9 w-9 rounded-full ring-2 ring-[#c9a227]/70 overflow-hidden shrink-0">
              <img src="/logo.jpg" alt="Golden West Colleges seal" className="h-full w-full object-cover" />
            </div>
            <span className="text-white font-bold">Capstone Archive</span>
          </div>
          <p className="text-sm">
            A digital repository of BSIT capstone projects, research, and academic work at Golden West Colleges, Inc.
          </p>
        </div>

        <div>
          <h3 className="text-white text-sm font-semibold mb-3 uppercase tracking-wide">Quick Links</h3>
          <ul className="space-y-2 text-sm">
            <li><Link href="/browse" className="hover:text-[#f3d77a] no-underline">Browse Projects</Link></li>
            <li><Link href="/login" className="hover:text-[#f3d77a] no-underline">Login</Link></li>
            <li><Link href="/signup" className="hover:text-[#f3d77a] no-underline">Sign Up</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="text-white text-sm font-semibold mb-3 uppercase tracking-wide">Contact</h3>
          <ul className="space-y-2 text-sm">
            <li className="flex items-center gap-2"><MapPin className="h-4 w-4 text-[#f3d77a] shrink-0" /> Alaminos, Pangasinan</li>
            <li className="flex items-center gap-2"><Mail className="h-4 w-4 text-[#f3d77a] shrink-0" /> bsit@goldenwest.edu.ph</li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="container py-4 text-center text-xs">
          <p>&copy; {new Date().getFullYear()} Golden West Colleges, Inc. — Capstone Archive Management System</p>
          <p className="mt-1">BSIT Department</p>
        </div>
      </div>
    </footer>
  );
}
