import { Button } from "@/components/ui/button";
import logo from "@/assets/logo.jpg";

const Header = () => {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/50">
      <div className="container mx-auto px-6 py-4">
        <nav className="flex items-center justify-between">
          <a href="#" className="flex items-center gap-3">
            <img 
              src={logo} 
              alt="Striker's House" 
              className="h-14 w-auto"
            />
          </a>
          
          <ul className="hidden md:flex items-center gap-8">
            <li>
              <a 
                href="#about" 
                className="text-sm uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors"
              >
                About
              </a>
            </li>
            <li>
              <a 
                href="#disciplines" 
                className="text-sm uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors"
              >
                Disciplines
              </a>
            </li>
            <li>
              <a 
                href="#contact" 
                className="text-sm uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors"
              >
                Contact
              </a>
            </li>
          </ul>
          
          <Button variant="outline" size="sm" className="hidden md:inline-flex">
            Book Trial
          </Button>
          
          {/* Mobile menu button */}
          <button className="md:hidden text-foreground p-2">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </nav>
      </div>
    </header>
  );
};

export default Header;
