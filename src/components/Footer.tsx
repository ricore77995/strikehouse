import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Instagram } from "lucide-react";
import { WHATSAPP_URL } from "@/constants/contact";

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
          src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3114.5735200358586!2d-9.3301353!3d38.6816667!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0xd1ec9d93faed0c3%3A0xfb89e2a5c9ad9a8f!2sStriker%E2%80%99s%20House%20%E2%80%93%20Muay%20Thai%20%26%20MMA%20Cascais%20(Carcavelos)!5e0!3m2!1spt!2spt"
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
                  href="https://maps.app.goo.gl/a2LGEsUZM14tUJWU9"
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
                  href={WHATSAPP_URL}
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

          {/* Payment methods */}
          <div className="flex flex-wrap items-center justify-center gap-4 mb-8">
            {/* Apple Pay */}
            <svg className="h-7" viewBox="0 0 50 21" fill="white"><path d="M9.4 2.7c-.6.7-1.5 1.3-2.4 1.2-.1-1 .4-2 .9-2.6C8.5.6 9.5 0 10.3 0c.1 1-.3 2-.9 2.7zm.9 1.4c-1.3-.1-2.5.8-3.1.8-.7 0-1.7-.7-2.8-.7C2.9 4.2 1.5 5.1.8 6.5c-1.5 2.5-.4 6.3 1 8.4.7 1 1.6 2.2 2.7 2.1 1.1 0 1.5-.7 2.8-.7 1.3 0 1.6.7 2.8.7 1.2 0 1.9-1 2.6-2.1.8-1.2 1.2-2.3 1.2-2.4 0 0-2.3-.9-2.3-3.4 0-2.2 1.8-3.2 1.9-3.3-1-1.5-2.6-1.7-3.2-1.7z"/><path d="M18.9 1c3 0 5.1 2.1 5.1 5.1 0 3-2.1 5.1-5.2 5.1h-3.3v5.3H13V1h5.9zm-3.4 8.2h2.7c2.1 0 3.3-1.1 3.3-3.1s-1.2-3.1-3.3-3.1h-2.7v6.2zM24.7 13.8c0-2 1.5-3.2 4.2-3.3l3.1-.2v-.9c0-1.3-.8-2-2.3-2-1.3 0-2.2.6-2.4 1.6h-2.2c.1-2 1.9-3.5 4.7-3.5 2.7 0 4.5 1.4 4.5 3.7v7.7h-2.3v-1.8h-.1c-.7 1.2-2.1 2-3.5 2-2.2 0-3.7-1.3-3.7-3.3zm7.3-1v-.9l-2.8.2c-1.4.1-2.2.7-2.2 1.7s.9 1.6 2 1.6c1.5 0 3-1 3-2.6zM37 21c-.3 0-.6 0-.7 0v-1.9c.1 0 .5 0 .7 0 1 0 1.6-.4 1.9-1.5l.2-.7L35.3 6h2.6l2.6 8.5h0L43.1 6h2.5l-4 11.3c-.9 2.6-2 3.6-4.2 3.6-.1.1-.3.1-.4.1z"/></svg>
            {/* Google Pay */}
            <svg className="h-7" viewBox="0 0 56 24" fill="none"><path d="M25.1 11.8v7h-2.2V1.2h5.8c1.5 0 2.7.4 3.7 1.3 1.1.9 1.6 2 1.6 3.3s-.5 2.5-1.6 3.4c-1 .9-2.3 1.3-3.7 1.3h-3.6v1.3zm0-8.4v5h3.7c.9 0 1.6-.3 2.2-.9.6-.6.9-1.3.9-2.1 0-.8-.3-1.5-.9-2.1-.6-.6-1.3-.9-2.2-.9h-3.7zM37.6 6.4c1.6 0 2.9.4 3.8 1.3.9.9 1.4 2.1 1.4 3.6v7.4H40.7v-1.7h-.1c-.9 1.4-2.1 2-3.5 2-1.2 0-2.3-.4-3.1-1.1-.8-.7-1.3-1.7-1.3-2.8 0-1.2.4-2.1 1.3-2.8.9-.7 2-1 3.5-1 1.2 0 2.3.2 3 .7v-.5c0-.8-.3-1.5-.9-2-.6-.6-1.3-.8-2.1-.8-1.2 0-2.2.5-2.8 1.5l-2-1.3c1-1.5 2.4-2.5 4.4-2.5zm-2.7 9c0 .6.3 1.1.8 1.5.5.4 1.1.6 1.8.6 1 0 1.8-.4 2.5-1.1.7-.7 1.1-1.5 1.1-2.5-.6-.5-1.5-.8-2.7-.8-.9 0-1.6.2-2.2.6-.6.5-.9 1-.9 1.7h-.4zM54.1 6.7l-7.6 17.5h-2.3l2.8-6.1-5-11.4h2.4l3.6 8.7h0l3.5-8.7h2.6z" fill="white"/><path d="M20.8 10.3c0-.6-.1-1.2-.2-1.8h-8.9v3.4h5.1c-.2 1.2-.9 2.2-1.9 2.8v2.4h3.1c1.8-1.7 2.8-4.1 2.8-6.8z" fill="#4285F4"/><path d="M11.7 18.8c2.6 0 4.7-.9 6.3-2.3l-3.1-2.4c-.9.6-1.9.9-3.2.9-2.5 0-4.6-1.7-5.3-3.9H3.2v2.5c1.6 3.1 4.8 5.2 8.5 5.2z" fill="#34A853"/><path d="M6.4 11.1c-.2-.6-.3-1.2-.3-1.9s.1-1.3.3-1.9V4.8H3.2C2.4 6.3 2 8 2 9.8s.5 3.2 1.2 4.6l3.2-2.5v-.8z" fill="#FBBC05"/><path d="M11.7 4.5c1.4 0 2.6.5 3.6 1.4l2.7-2.7C16.4 1.7 14.3.8 11.7.8 8 .8 4.8 2.9 3.2 6l3.2 2.5c.7-2.3 2.8-4 5.3-4z" fill="#EA4335"/></svg>
            {/* Visa */}
            <svg className="h-6" viewBox="0 0 100 32" fill="none"><path d="M42.5 29.5l6-27.5h7.8l-6 27.5h-7.8zm31.3-26.8c-1.5-.6-3.9-1.2-6.9-1.2-7.6 0-12.9 3.8-13 9.3-.1 4 3.8 6.3 6.7 7.6 3 1.4 4 2.3 4 3.5 0 1.9-2.4 2.7-4.6 2.7-3.1 0-4.7-.4-7.2-1.5l-1-.4-1.1 6.3c1.8.8 5.1 1.5 8.5 1.5 8.1 0 13.3-3.8 13.4-9.6.1-3.2-2-5.6-6.4-7.6-2.7-1.3-4.3-2.2-4.3-3.5 0-1.2 1.4-2.4 4.4-2.4 2.5 0 4.3.5 5.7 1.1l.7.3 1-6.1zM92.3 2h-6c-1.8 0-3.2.5-4 2.3L70.9 29.5h8.1l1.6-4.2h9.9l.9 4.2H99L92.3 2zm-9.5 18.1c.6-1.6 3.1-7.8 3.1-7.8s.6-1.6 1-2.7l.5 2.4 1.8 8.1h-6.4zM36.1 2L28.7 21l-.8-3.9c-1.4-4.5-5.8-9.4-10.7-11.8l6.9 23.7h8.1L44.3 2h-8.2z" fill="white"/><path d="M21.1 2H8.7l-.1.5c9.6 2.3 16 8 18.6 14.7L24.8 4.4c-.5-1.8-1.8-2.4-3.5-2.4h-.2z" fill="#F9A533"/></svg>
            {/* Mastercard */}
            <svg className="h-7" viewBox="0 0 48 30" fill="none"><circle cx="18" cy="15" r="12" fill="#EB001B"/><circle cx="30" cy="15" r="12" fill="#F79E1B"/><path d="M24 5.4A11.9 11.9 0 0018 15a11.9 11.9 0 006 9.6A11.9 11.9 0 0030 15a11.9 11.9 0 00-6-9.6z" fill="#FF5F00"/></svg>
            {/* Amex */}
            <div className="h-7 w-11 bg-[#006FCF] rounded flex items-center justify-center">
              <span className="text-[8px] font-black text-white leading-none">AMEX</span>
            </div>
            {/* Klarna */}
            <div className="h-7 px-3 bg-[#FFB3C7] rounded flex items-center justify-center">
              <span className="text-[10px] font-black text-black">Klarna</span>
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
              <Link to="/politica-de-privacidade" className="text-xs text-muted-foreground hover:text-foreground transition-colors tracking-wider">
                {t('footer.privacy')}
              </Link>
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
