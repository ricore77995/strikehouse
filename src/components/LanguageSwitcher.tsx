import { useLanguage } from '@/hooks/useLanguage';

const LanguageSwitcher = () => {
  const { currentLanguage, setLanguage } = useLanguage();

  return (
    <div className="flex items-center gap-1 text-xs tracking-[0.15em]">
      <button
        onClick={() => setLanguage('en')}
        className={`transition-colors ${
          currentLanguage === 'en' 
            ? 'text-foreground' 
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        EN
      </button>
      <span className="text-muted-foreground/50">|</span>
      <button
        onClick={() => setLanguage('pt')}
        className={`transition-colors ${
          currentLanguage === 'pt' 
            ? 'text-foreground' 
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        PT
      </button>
    </div>
  );
};

export default LanguageSwitcher;
