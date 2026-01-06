import { useTranslation } from "react-i18next";

const Footer = () => {
  const { t } = useTranslation();

  return (
    <footer id="contact" className="py-20 md:py-24 bg-background border-t border-border">
      <div className="container mx-auto px-6 md:px-12">
        <div className="grid md:grid-cols-4 gap-12 md:gap-8 mb-16">
          {/* Brand */}
          <div className="md:col-span-2 space-y-6">
            <p className="text-sm tracking-[0.3em] uppercase font-light">
              Striker's House
            </p>
            <p className="text-muted-foreground text-sm font-light leading-relaxed max-w-sm">
              {t('footer.description')}
            </p>
          </div>
          
          {/* Location */}
          <div className="space-y-4">
            <p className="text-xs tracking-[0.2em] uppercase text-muted-foreground">
              {t('footer.location')}
            </p>
            <div className="text-sm font-light leading-relaxed">
              <p>{t('footer.city')}</p>
              <p className="text-muted-foreground mt-2">{t('footer.byAppointment')}</p>
            </div>
          </div>
          
          {/* Contact */}
          <div className="space-y-4">
            <p className="text-xs tracking-[0.2em] uppercase text-muted-foreground">
              {t('footer.contact')}
            </p>
            <div className="text-sm font-light space-y-2">
              <p>info@strikershouse.pt</p>
              <p className="text-muted-foreground">+351 XXX XXX XXX</p>
            </div>
          </div>
        </div>
        
        {/* Bottom */}
        <div className="pt-8 border-t border-border flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs text-muted-foreground tracking-wider">
            {t('footer.copyright')}
          </p>
          <div className="flex gap-8">
            <a href="#" className="text-xs text-muted-foreground hover:text-foreground transition-colors tracking-wider">
              {t('footer.instagram')}
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
