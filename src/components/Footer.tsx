import logo from "@/assets/logo.jpg";

const Footer = () => {
  return (
    <footer id="contact" className="py-16 md:py-24 bg-background border-t border-border">
      <div className="container mx-auto px-6">
        <div className="grid md:grid-cols-3 gap-12 md:gap-8">
          {/* Logo & Description */}
          <div className="space-y-6">
            <img src={logo} alt="Striker's House" className="h-20 w-auto" />
            <p className="text-muted-foreground text-sm leading-relaxed">
              Premium MMA training facility in the heart of Cascais. 
              Where passion meets precision.
            </p>
          </div>
          
          {/* Contact */}
          <div className="space-y-6">
            <h3 className="font-display text-xl tracking-wide">Contact</h3>
            <ul className="space-y-3 text-muted-foreground text-sm">
              <li className="flex items-start gap-3">
                <span className="text-primary">📍</span>
                <span>Rua Example 123<br />2750-123 Cascais, Portugal</span>
              </li>
              <li className="flex items-center gap-3">
                <span className="text-primary">📞</span>
                <span>+351 XXX XXX XXX</span>
              </li>
              <li className="flex items-center gap-3">
                <span className="text-primary">✉️</span>
                <span>info@strikershouse.pt</span>
              </li>
            </ul>
          </div>
          
          {/* Hours */}
          <div className="space-y-6">
            <h3 className="font-display text-xl tracking-wide">Training Hours</h3>
            <ul className="space-y-2 text-muted-foreground text-sm">
              <li className="flex justify-between">
                <span>Monday - Friday</span>
                <span className="text-foreground">07:00 - 22:00</span>
              </li>
              <li className="flex justify-between">
                <span>Saturday</span>
                <span className="text-foreground">09:00 - 18:00</span>
              </li>
              <li className="flex justify-between">
                <span>Sunday</span>
                <span className="text-foreground">10:00 - 16:00</span>
              </li>
            </ul>
          </div>
        </div>
        
        {/* Bottom Bar */}
        <div className="mt-16 pt-8 border-t border-border flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-muted-foreground text-sm">
            © 2026 Striker's House. All rights reserved.
          </p>
          <div className="flex gap-6">
            <a href="#" className="text-muted-foreground hover:text-primary transition-colors text-sm">
              Instagram
            </a>
            <a href="#" className="text-muted-foreground hover:text-primary transition-colors text-sm">
              Facebook
            </a>
            <a href="#" className="text-muted-foreground hover:text-primary transition-colors text-sm">
              YouTube
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
