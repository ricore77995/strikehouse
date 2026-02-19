# META PIXEL IMPLEMENTATION PLAN

**Data:** 2026-02-17
**Status:** Pendente - Aguardando Pixel ID

---

## OBJECTIVO

Instalar Meta Pixel (Facebook Pixel) na landing page para tracking de visitantes e conversões.

**Eventos a implementar:**
| Evento | Trigger | Descrição |
|--------|---------|-----------|
| `PageView` | Carregamento página | Automático pelo Pixel |
| `ViewContent` | Página pública carregada | `/`, `/team`, `/membership` |
| `Lead` | Clicou WhatsApp CTA | Interesse em agendar aula |

---

## PRÉ-REQUISITO

### Obter Meta Pixel ID

1. Ir a [Meta Events Manager](https://business.facebook.com/events_manager)
2. Criar novo Pixel ou usar existente
3. Copiar Pixel ID (15-16 dígitos, ex: `123456789012345`)

**Substituir `YOUR_PIXEL_ID_HERE` nos ficheiros abaixo pelo ID real.**

---

## FICHEIROS A CRIAR/MODIFICAR

| Ficheiro | Acção | Descrição |
|----------|-------|-----------|
| `src/components/MetaPixel.tsx` | CRIAR | Componente de tracking |
| `src/lib/metaPixel.ts` | CRIAR | Funções helper |
| `src/components/CTA.tsx` | MODIFICAR | onClick tracking |
| `src/components/Footer.tsx` | MODIFICAR | onClick tracking |
| `src/pages/Membership.tsx` | MODIFICAR | onClick tracking |
| `src/pages/TheTeam.tsx` | MODIFICAR | onClick tracking |
| `src/App.tsx` | MODIFICAR | Montar componente |

---

## PASSO 1: Criar MetaPixel.tsx

```tsx
// src/components/MetaPixel.tsx
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const META_PIXEL_ID = 'YOUR_PIXEL_ID_HERE'; // <-- SUBSTITUIR

const PUBLIC_ROUTES = ['/', '/team', '/membership', '/login'];

declare global {
  interface Window {
    fbq: ((...args: unknown[]) => void) & {
      callMethod?: (...args: unknown[]) => void;
      queue: unknown[];
      loaded: boolean;
      version: string;
      push: (...args: unknown[]) => void;
    };
    _fbq: unknown;
  }
}

export function MetaPixel() {
  const location = useLocation();

  const isPublicRoute = () => {
    if (PUBLIC_ROUTES.includes(location.pathname)) return true;
    if (location.pathname.startsWith('/m/')) return true;
    return false;
  };

  useEffect(() => {
    // Só em produção
    if (!import.meta.env.PROD) return;
    if (!isPublicRoute()) return;

    // Evita duplicação
    if (document.querySelector('script[src*="connect.facebook.net"]')) {
      if (window.fbq) {
        window.fbq('track', 'ViewContent', { content_name: location.pathname });
      }
      return;
    }

    // Inicializar fbq (código oficial Meta)
    const fbq = function (...args: unknown[]) {
      if (fbq.callMethod) {
        fbq.callMethod.apply(fbq, args);
      } else {
        fbq.queue.push(args);
      }
    } as Window['fbq'];

    fbq.queue = [];
    fbq.loaded = true;
    fbq.version = '2.0';
    fbq.push = fbq;

    window.fbq = fbq;
    if (!window._fbq) window._fbq = fbq;

    window.fbq('init', META_PIXEL_ID);
    window.fbq('track', 'PageView');

    // Carregar script
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://connect.facebook.net/en_US/fbevents.js';
    document.head.appendChild(script);
  }, [location.pathname]);

  return null;
}
```

---

## PASSO 2: Criar metaPixel.ts

```tsx
// src/lib/metaPixel.ts

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

/**
 * Track Lead event - quando utilizador mostra interesse
 */
export function trackLead(contentName?: string) {
  if (typeof window !== 'undefined' && window.fbq) {
    window.fbq('track', 'Lead', {
      content_name: contentName || 'WhatsApp CTA Click',
    });
  }
}

/**
 * Track Contact event
 */
export function trackContact(method: string = 'WhatsApp') {
  if (typeof window !== 'undefined' && window.fbq) {
    window.fbq('track', 'Contact', {
      content_name: method,
    });
  }
}

/**
 * Track custom event
 */
export function trackCustomEvent(eventName: string, params?: Record<string, unknown>) {
  if (typeof window !== 'undefined' && window.fbq) {
    window.fbq('trackCustom', eventName, params);
  }
}
```

---

## PASSO 3: Modificar CTA.tsx

```diff
// src/components/CTA.tsx
+ import { trackLead } from '@/lib/metaPixel';

// No botão WhatsApp (linha ~56-70):
  <a
    href="https://wa.me/351913378459"
    target="_blank"
    rel="noopener noreferrer"
+   onClick={() => trackLead('CTA Section - Agendar Aula')}
  >
```

---

## PASSO 4: Modificar Footer.tsx

```diff
// src/components/Footer.tsx
+ import { trackLead } from '@/lib/metaPixel';

// No link WhatsApp:
  <a
    href="https://wa.me/351913378459"
+   onClick={() => trackLead('Footer - WhatsApp')}
  >
```

---

## PASSO 5: Modificar Membership.tsx

```diff
// src/pages/Membership.tsx
+ import { trackLead } from '@/lib/metaPixel';

// No CTA WhatsApp (bottom da página):
  <a
    href="https://wa.me/351913378459"
+   onClick={() => trackLead('Membership - CTA')}
  >
```

---

## PASSO 6: Modificar TheTeam.tsx

```diff
// src/pages/TheTeam.tsx
+ import { trackLead } from '@/lib/metaPixel';

// No CTA WhatsApp:
  <a
    href="https://wa.me/351913378459"
+   onClick={() => trackLead('Team Page - CTA')}
  >
```

---

## PASSO 7: Montar em App.tsx

```diff
// src/App.tsx
  import { GoogleAnalytics } from '@/components/GoogleAnalytics';
+ import { MetaPixel } from '@/components/MetaPixel';

// Dentro do Router (logo após GoogleAnalytics):
  <Router>
    <GoogleAnalytics />
+   <MetaPixel />
    {/* resto do app */}
  </Router>
```

---

## VERIFICAÇÃO

### 1. Instalar Meta Pixel Helper
[Chrome Extension](https://chrome.google.com/webstore/detail/meta-pixel-helper)

### 2. Testar em Produção
1. Visitar landing page
2. Abrir Meta Pixel Helper
3. Verificar eventos:
   - ✅ `PageView` (automático ao carregar)
   - ✅ `ViewContent` (automático ao carregar)
   - ✅ `Lead` (ao clicar WhatsApp)

### 3. Verificar no Events Manager
1. [Meta Events Manager](https://business.facebook.com/events_manager)
2. Ver eventos em tempo real
3. Confirmar que Lead está a disparar

---

## NOTAS

### Rotas com Tracking
- `/` - Landing page
- `/team` - Equipa
- `/membership` - Planos
- `/m/:qrCode` - QR público

### CTAs Rastreados
| Local | Evento |
|-------|--------|
| CTA Section (homepage) | Lead: "CTA Section - Agendar Aula" |
| Footer WhatsApp | Lead: "Footer - WhatsApp" |
| Membership CTA | Lead: "Membership - CTA" |
| Team Page CTA | Lead: "Team Page - CTA" |

### Privacidade
Considerar:
- Cookie consent (se não existir)
- Actualizar política de privacidade
- GDPR compliance

---

## CHECKLIST

- [ ] Obter Meta Pixel ID
- [ ] Substituir `YOUR_PIXEL_ID_HERE` em MetaPixel.tsx
- [ ] Criar `src/components/MetaPixel.tsx`
- [ ] Criar `src/lib/metaPixel.ts`
- [ ] Modificar `src/components/CTA.tsx`
- [ ] Modificar `src/components/Footer.tsx`
- [ ] Modificar `src/pages/Membership.tsx`
- [ ] Modificar `src/pages/TheTeam.tsx`
- [ ] Modificar `src/App.tsx`
- [ ] Deploy
- [ ] Testar com Meta Pixel Helper
- [ ] Verificar no Events Manager
