import { describe, expect, it } from 'vitest';
import { descriptionLines } from '@/hooks/useYogoClassTypes';
import { commonSignoffHours, signoffHours } from '@/hooks/useYogoClasses';

describe('descriptionLines', () => {
  it('keeps the class content and drops the shared arrival notice', () => {
    // Every YOGO class description ends with this notice; repeating it on each of six
    // modality cards is noise, so it lives once in the "first class" block instead.
    expect(
      descriptionLines(
        'Muay Thai • Kickboxing\nStrength • Conditioning • Technique\n⚠️ Chega 15 minutos antes.\nA aula começa na hora e quem chega preparado, treina melhor.'
      )
    ).toEqual(['Muay Thai • Kickboxing', 'Strength • Conditioning • Technique']);
  });

  it('returns nothing when the description is only the notice', () => {
    // This is GIRL POWER's real description — the card falls back to its name alone.
    expect(
      descriptionLines('⚠️ Chega 15 minutos antes.\nA aula começa na hora e quem chega preparado, treina melhor.')
    ).toEqual([]);
  });

  it('handles an empty or missing description', () => {
    expect(descriptionLines('')).toEqual([]);
    expect(descriptionLines(null)).toEqual([]);
    expect(descriptionLines(undefined)).toEqual([]);
  });

  it('strips leading emoji and bullets', () => {
    expect(descriptionLines('🥊 Footwork • Precision')).toEqual(['Footwork • Precision']);
    expect(descriptionLines('— Strength')).toEqual(['Strength']);
  });
});

describe('signoffHours', () => {
  it('reads both sides as gym wall-clock time', () => {
    // 2026-09-07 06:30 Europe/Lisbon (UTC+1) for a class starting 08:30 → 2 hours.
    expect(signoffHours('08:30', 1788759000000)).toBe(2);
  });

  it('is null when there is no deadline', () => {
    expect(signoffHours('08:30', null)).toBeNull();
    expect(signoffHours('08:30', undefined)).toBeNull();
  });

  it('ignores a deadline that fell on the previous day', () => {
    // 00:30 class with a deadline at 22:30 the night before would compute negative.
    expect(signoffHours('00:30', 1788759000000)).toBeNull();
  });
});

describe('commonSignoffHours', () => {
  it('takes the offset the gym actually uses, ignoring outliers', () => {
    expect(commonSignoffHours([2, 2, 2, 4, null])).toBe(2);
  });

  it('is null when nothing usable came back', () => {
    expect(commonSignoffHours([])).toBeNull();
    expect(commonSignoffHours([null, null])).toBeNull();
  });
});
