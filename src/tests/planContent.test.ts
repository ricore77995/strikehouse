import { describe, expect, it } from 'vitest';
import {
  cleanPlanName,
  derivePlanContent,
  isMostPopular,
  stripLeadingOrnament,
} from '@/components/pricing/planContent';

// Descriptions as the gym actually typed them into Yogo.
const HERO = `(Apenas 5,58€ por aula:) * Most Popular
Ritmo de Evolução: Perfeito para quem treina 2x por semana + Sábado Fixo.
BÓNUS EXTRA: 1 Passe de Amigo grátis por mês para trazeres quem quiseres.`;

const PREMIUM = `(Treina sem limites, quando quiseres)
VIP Perks:
🎁 Inscrição GRÁTIS
🥇 2 Passes de Amigo por mês
💧 1 Garrafa de água por dia de treino
📅 2 Guest Passes exclusivos para os Sábados
⚡ O acesso total e sem limites está a apenas 8€ de distância.`;

const CONTENDER = `(Apenas 6,87€ por aula)
Treinos de Sábado: Usa as manhãs de sábado para compensar faltas da semana útil.`;

describe('isMostPopular', () => {
  it('finds the marker inside the description, not only the name', () => {
    expect(isMostPopular({ name: 'Plano Hero', description: HERO })).toBe(true);
    expect(isMostPopular({ name: '⭐ Plan - Most Popular', description: '' })).toBe(true);
    expect(isMostPopular({ name: 'KIDS', description: '' })).toBe(false);
  });
});

describe('cleanPlanName', () => {
  it('drops leading emoji, the popular suffix and the quota parenthetical', () => {
    // The quota moves to the card eyebrow, so repeating it in the title only makes
    // the name wrap and pushes the price rows out of alignment.
    expect(cleanPlanName('🔥 Plano Hero (12 passes)')).toBe('Plano Hero');
    expect(cleanPlanName('👑 PREMIUM (UNLIMITED)')).toBe('PREMIUM');
    expect(cleanPlanName('🥊 Contender (8 passes)')).toBe('Contender');
    expect(cleanPlanName('⭐ Striker - Most Popular')).toBe('Striker');
  });

  it('keeps a long parenthetical, which is unlikely to be a quota', () => {
    expect(cleanPlanName('Plan (includes two guest passes per month)'))
      .toBe('Plan (includes two guest passes per month)');
  });
});

describe('stripLeadingOrnament', () => {
  it('removes emoji, bullets and dashes', () => {
    expect(stripLeadingOrnament('🎁 Inscrição GRÁTIS')).toBe('Inscrição GRÁTIS');
    expect(stripLeadingOrnament('— Aulas ilimitadas')).toBe('Aulas ilimitadas');
  });
});

describe('derivePlanContent', () => {
  it('turns a headed emoji list into plain bullets and unwraps the lead line', () => {
    expect(derivePlanContent(PREMIUM)).toEqual({
      subtitle: 'Treina sem limites, quando quiseres',
      bullets: [
        'Inscrição GRÁTIS',
        '2 Passes de Amigo por mês',
        '1 Garrafa de água por dia de treino',
      ],
    });
  });

  it('drops hand-typed per-class claims, which contradict the computed price', () => {
    // Contender's copy says 6,87€/aula while 60€ / 8 passes is 7,50€.
    const content = derivePlanContent(CONTENDER);
    expect(JSON.stringify(content)).not.toContain('6,87');
    expect(content.subtitle).toBe(
      'Treinos de Sábado: Usa as manhãs de sábado para compensar faltas da semana útil.'
    );
    expect(content.bullets).toEqual([]);
  });

  it('strips the popular marker out of the copy', () => {
    const content = derivePlanContent(HERO);
    expect(JSON.stringify(content)).not.toMatch(/most popular/i);
    expect(content.subtitle).toContain('Ritmo de Evolução');
    expect(content.bullets[0]).toContain('BÓNUS EXTRA');
  });

  it('demotes an over-long lead line to a bullet instead of a subtitle', () => {
    const long = 'x'.repeat(120);
    expect(derivePlanContent(long).subtitle).toBeNull();
    expect(derivePlanContent(long).bullets[0]).toMatch(/…$/);
  });

  it('handles an empty description', () => {
    expect(derivePlanContent('')).toEqual({ subtitle: null, bullets: [] });
  });

  it('caps the bullet count', () => {
    expect(derivePlanContent(PREMIUM, { maxBullets: 2 }).bullets).toHaveLength(2);
  });
});
