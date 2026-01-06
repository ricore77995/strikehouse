import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import LanguageSwitcher from "./LanguageSwitcher";

const Header = () => {
  const { t } = useTranslation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const menuItems = [
    { href: "#philosophy", label: t('header.philosophy') },
    { href: "#training", label: t('header.training') },
    { href: "#contact", label: t('header.contact') },
  ];

  const handleLinkClick = () => {
    setIsMenuOpen(false);
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-sm">
      <div className="container mx-auto px-6 md:px-12 py-6">
        <nav className="flex items-center justify-between">
          {/* Logo */}
          <a href="#" className="text-sm tracking-[0.3em] uppercase font-light">
            Striker's House
          </a>
          
          {/* Desktop Navigation */}
          <ul className="hidden md:flex items-center gap-10">
            {menuItems.map((item) => (
              <li key={item.href}>
                <a href={item.href} className="nav-link">{item.label}</a>
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
            className="md:hidden text-foreground p-2 relative z-50" 
            aria-label={isMenuOpen ? "Close menu" : "Open menu"}
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            <div className="w-5 h-5 relative">
              <motion.span
                className="absolute left-0 w-full h-[1px] bg-foreground"
                animate={{
                  top: isMenuOpen ? "50%" : "25%",
                  rotate: isMenuOpen ? 45 : 0,
                  translateY: isMenuOpen ? "-50%" : 0,
                }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
              />
              <motion.span
                className="absolute left-0 top-1/2 w-full h-[1px] bg-foreground -translate-y-1/2"
                animate={{
                  opacity: isMenuOpen ? 0 : 1,
                  scaleX: isMenuOpen ? 0 : 1,
                }}
                transition={{ duration: 0.2 }}
              />
              <motion.span
                className="absolute left-0 w-full h-[1px] bg-foreground"
                animate={{
                  top: isMenuOpen ? "50%" : "75%",
                  rotate: isMenuOpen ? -45 : 0,
                  translateY: isMenuOpen ? "-50%" : 0,
                }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
              />
            </div>
          </button>
        </nav>
      </div>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 bg-background z-40 md:hidden"
          >
            <div className="flex flex-col items-center justify-center h-full">
              <motion.nav
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{ duration: 0.3, delay: 0.1 }}
                className="flex flex-col items-center gap-8"
              >
                {menuItems.map((item, index) => (
                  <motion.a
                    key={item.href}
                    href={item.href}
                    onClick={handleLinkClick}
                    className="text-2xl tracking-[0.2em] uppercase font-light text-foreground/80 hover:text-foreground transition-colors"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    transition={{ duration: 0.3, delay: 0.15 + index * 0.05 }}
                  >
                    {item.label}
                  </motion.a>
                ))}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  transition={{ duration: 0.3, delay: 0.3 }}
                  className="mt-4 flex flex-col items-center gap-6"
                >
                  <LanguageSwitcher />
                  <Button 
                    variant="outline" 
                    size="lg"
                    onClick={handleLinkClick}
                  >
                    {t('header.requestAccess')}
                  </Button>
                </motion.div>
              </motion.nav>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};

export default Header;
