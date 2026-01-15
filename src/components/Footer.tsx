import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Instagram } from "lucide-react";

// WhatsApp icon component
const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

const Footer = () => {
  const { t } = useTranslation();

  return (
    <footer id="contact" className="bg-background border-t border-border">
      {/* Map Section */}
      <div className="w-full h-[300px] md:h-[400px]">
        <iframe
          src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3114.5735200358586!2d-9.332699823984026!3d38.68166835940425!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0xd1ec8dc6b8f548f%3A0x5f750a9b57923b01!2sR.%20It%C3%A1lia%202a%201%20andar%20sala%20G%2C%202775-604%20Carcavelos!5e0!3m2!1sen!2spt!4v1768486945464!5m2!1sen!2spt"
          width="100%"
          height="100%"
          style={{ border: 0 }}
          allowFullScreen
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          title="Striker's House Location"
        />
      </div>

      <div className="py-16 md:py-20">
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
                <a
                  href="https://maps.app.goo.gl/DSA4ELchDnkmHdRB6"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-accent transition-colors"
                >
                  {t('footer.city')}
                </a>
              </div>
            </div>

            {/* Contact */}
            <div className="space-y-4">
              <p className="text-xs tracking-[0.2em] uppercase text-muted-foreground">
                {t('footer.contact')}
              </p>
              <div className="text-sm font-light space-y-3">
                <a
                  href="mailto:admin@strikershouse.com"
                  className="block hover:text-accent transition-colors"
                >
                  admin@strikershouse.com
                </a>
                <a
                  href="https://wa.me/351913378459"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-muted-foreground hover:text-accent transition-colors"
                >
                  <WhatsAppIcon className="w-4 h-4" />
                  <span>+351 913 378 459</span>
                </a>
              </div>
            </div>
          </div>

          {/* Bottom */}
          <div className="pt-8 border-t border-border flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-xs text-muted-foreground tracking-wider">
              {t('footer.copyright')}
            </p>
            <div className="flex gap-8 items-center">
              <a
                href="https://www.instagram.com/strikershouseportugal"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors tracking-wider"
              >
                <Instagram className="w-4 h-4" />
                {t('footer.instagram')}
              </a>
              <Link to="/login" className="text-xs text-muted-foreground hover:text-foreground transition-colors tracking-wider uppercase">
                Área Restrita
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
