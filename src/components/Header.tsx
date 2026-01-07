import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { X, Menu } from "lucide-react";
import LanguageSwitcher from "./LanguageSwitcher";

const Header = () => {
  const { t } = useTranslation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();
  const isHomePage = location.pathname === "/";

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isMenuOpen]);

  const menuItems = [
    { href: isHomePage ? "#philosophy" : "/#philosophy", label: t('header.philosophy'), isAnchor: isHomePage },
    { href: "/team", label: t('header.team'), isAnchor: false },
    { href: "/membership", label: t('header.membership'), isAnchor: false },
    { href: isHomePage ? "#training" : "/#training", label: t('header.training'), isAnchor: isHomePage },
    { href: isHomePage ? "#contact" : "/#contact", label: t('header.contact'), isAnchor: isHomePage },
  ];

  const handleLinkClick = () => {
    setIsMenuOpen(false);
  };

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-sm pt-safe">
        <div className="container mx-auto px-6 md:px-12 py-4 md:py-6">
          <nav className="flex items-center justify-between">
            {/* Logo */}
            <Link to="/" className="text-sm tracking-[0.3em] uppercase font-light">
              Striker's House
            </Link>
            
            {/* Desktop Navigation */}
            <ul className="hidden md:flex items-center gap-10">
              {menuItems.map((item) => (
                <li key={item.href}>
                  {item.isAnchor ? (
                    <a href={item.href} className="nav-link">{item.label}</a>
                  ) : (
                    <Link to={item.href} className="nav-link">{item.label}</Link>
                  )}
                </li>
              ))}
            </ul>
            
            {/* Desktop CTA & Language */}
            <div className="hidden md:flex items-center gap-6">
              <LanguageSwitcher />
              <Button variant="outline" size="sm">
                {t('header.requestAccess')}
              </Button>
            </div>
            
            {/* Mobile menu button */}
            <button 
              className="md:hidden text-foreground p-2" 
              aria-label="Open menu"
              onClick={() => setIsMenuOpen(true)}
            >
              <Menu className="w-6 h-6" />
            </button>
          </nav>
        </div>
      </header>

      {/* Mobile Menu - Full Screen Overlay */}
      {isMenuOpen && (
        <div 
          className="fixed inset-0 z-[9999] md:hidden"
          style={{ 
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'hsl(0 0% 5%)',
            width: '100vw',
            height: '100vh'
          }}
        >
          {/* Close button */}
          <button 
            className="absolute top-6 right-6 text-white p-2" 
            aria-label="Close menu"
            onClick={() => setIsMenuOpen(false)}
          >
            <X className="w-6 h-6" />
          </button>

          {/* Menu Content */}
          <div className="flex flex-col items-center justify-center h-full px-6">
            <nav className="flex flex-col items-center gap-8">
              {menuItems.map((item) => (
                item.isAnchor ? (
                  <a
                    key={item.href}
                    href={item.href}
                    onClick={handleLinkClick}
                    className="text-2xl tracking-[0.2em] uppercase font-light text-white/80 hover:text-white transition-colors"
                  >
                    {item.label}
                  </a>
                ) : (
                  <Link
                    key={item.href}
                    to={item.href}
                    onClick={handleLinkClick}
                    className="text-2xl tracking-[0.2em] uppercase font-light text-white/80 hover:text-white transition-colors"
                  >
                    {item.label}
                  </Link>
                )
              ))}
              
              <div className="mt-8 flex flex-col items-center gap-6">
                <LanguageSwitcher />
                <Button 
                  variant="outline" 
                  size="lg"
                  onClick={handleLinkClick}
                  className="border-white text-white hover:bg-white hover:text-black"
                >
                  {t('header.requestAccess')}
                </Button>
              </div>
            </nav>
          </div>
        </div>
      )}
    </>
  );
};

export default Header;