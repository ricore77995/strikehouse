import { Button } from "@/components/ui/button";

const Header = () => {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-sm">
      <div className="container mx-auto px-6 md:px-12 py-6">
        <nav className="flex items-center justify-between">
          {/* Logo */}
          <a href="#" className="text-sm tracking-[0.3em] uppercase font-light">
            Striker's House
          </a>
          
          {/* Navigation */}
          <ul className="hidden md:flex items-center gap-10">
            <li>
              <a href="#philosophy" className="nav-link">Philosophy</a>
            </li>
            <li>
              <a href="#training" className="nav-link">Training</a>
            </li>
            <li>
              <a href="#contact" className="nav-link">Contact</a>
            </li>
          </ul>
          
          {/* CTA */}
          <Button variant="outline" size="sm" className="hidden md:inline-flex">
            Request Access
          </Button>
          
          {/* Mobile menu */}
          <button className="md:hidden text-foreground p-2" aria-label="Menu">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </nav>
      </div>
    </header>
  );
};

export default Header;
