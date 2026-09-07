import { describe, expect, it } from 'vitest';
import type { ScheduledClass } from '@/hooks/useYogoClasses';
import { isTrialClass, slotKey } from '@/hooks/useYogoClasses';
import { buildWeekGrid, seatsLeft } from '@/components/schedule/weekGrid';

let nextId = 1;
function cls(date: string, startTime: string, name: string, over: Partial<ScheduledClass> = {}): ScheduledClass {
  return {
    id: nextId++,
    date,
    startTime,
    endTime: '19:30',
    name,
    classTypeId: 1,
    teacher: 'Head Coach (Marcelo) Damasceno',
    room: 'Carcavelos',
    seats: 20,
    seatsTaken: 2,
    ...over,
  };
}

// One real week of the Striker's House timetable, as the API returns it.
const week: ScheduledClass[] = [
  cls('2026-09-07', '08:30', 'GIRL POWER'),
  cls('2026-09-07', '17:30', 'KIDS', { seats: 16, seatsTaken: 0 }),
  cls('2026-09-07', '18:30', 'Striking'),
  cls('2026-09-07', '19:30', 'Striking'),
  cls('2026-09-07', '20:30', 'Striking', { seats: 30, seatsTaken: 3 }),
  cls('2026-09-08', '08:00', 'Striking'),
  cls('2026-09-08', '18:30', 'GIRL POWER'),
  cls('2026-09-08', '20:30', 'Boxing', { teacher: 'Egor Alexandrovichh' }),
  cls('2026-09-12', '10:00', 'Striking'),
];

describe('isTrialClass', () => {
  it('matches the shadow trial by name, whatever its id', () => {
    // Yogo recreates class types, so the id alone is not dependable.
    expect(isTrialClass('Experimental (Trial)', 99999)).toBe(true);
    expect(isTrialClass('Experimental', null)).toBe(true);
    expect(isTrialClass('', 21792)).toBe(true);
  });

  it('leaves real classes alone', () => {
    expect(isTrialClass('Striking', 1)).toBe(false);
    expect(isTrialClass('GIRL POWER', 2)).toBe(false);
    expect(isTrialClass('KIDS', 3)).toBe(false);
  });
});

describe('buildWeekGrid', () => {
  const trials = new Set([slotKey('2026-09-07', '18:30'), slotKey('2026-09-12', '10:00')]);
  const grid = buildWeekGrid(week, trials, 'pt', '2026-09-07');

  it('gives one column per date, in order', () => {
    expect(grid.days.map((d) => d.date)).toEqual(['2026-09-07', '2026-09-08', '2026-09-12']);
    expect(grid.days.map((d) => d.dayOfMonth)).toEqual([7, 8, 12]);
  });

  it('marks today', () => {
    expect(grid.days.filter((d) => d.isToday).map((d) => d.date)).toEqual(['2026-09-07']);
  });

  it('lists distinct start times ascending', () => {
    expect(grid.times).toEqual(['08:00', '08:30', '10:00', '17:30', '18:30', '19:30', '20:30']);
  });

  it('places each class in its own day/time cell', () => {
    expect(grid.cellAt('2026-09-08', '20:30')?.classes[0].name).toBe('Boxing');
    expect(grid.cellAt('2026-09-07', '17:30')?.classes[0].name).toBe('KIDS');
  });

  it('leaves empty slots empty rather than inventing a class', () => {
    expect(grid.cellAt('2026-09-12', '18:30')).toBeNull();
    expect(grid.cellAt('2026-09-08', '17:30')).toBeNull();
  });

  it('flags the slots that run a free trial', () => {
    expect(grid.cellAt('2026-09-07', '18:30')?.hasTrial).toBe(true);
    expect(grid.cellAt('2026-09-07', '19:30')?.hasTrial).toBe(false);
  });

  it('groups two classes sharing one slot into the same cell', () => {
    const shared = buildWeekGrid(
      [cls('2026-09-07', '18:30', 'Striking'), cls('2026-09-07', '18:30', 'Boxing')],
      new Set(),
      'pt'
    );
    expect(shared.cellAt('2026-09-07', '18:30')?.classes.map((c) => c.name))
      .toEqual(['Striking', 'Boxing']);
  });

  it('reports how far the free trial reaches, so a useless marker can be dropped', () => {
    expect(grid.trialCoverage).toBe('some');
    const everySlot = new Set(week.map((c) => slotKey(c.date, c.startTime)));
    expect(buildWeekGrid(week, everySlot, 'pt').trialCoverage).toBe('all');
    expect(buildWeekGrid(week, new Set(), 'pt').trialCoverage).toBe('none');
  });

  it('reads as empty when there is nothing to show', () => {
    expect(buildWeekGrid([], new Set(), 'pt').isEmpty).toBe(true);
    expect(grid.isEmpty).toBe(false);
  });

  it('derives weekday labels from the locale, not from translation keys', () => {
    // 2026-09-07 is a Monday.
    expect(buildWeekGrid(week, trials, 'en', '2026-09-07').days[0].label).toBe('Mon');
    expect(buildWeekGrid(week, trials, 'pt', '2026-09-07').days[0].label).toMatch(/seg/i);
  });
});

describe('seatsLeft', () => {
  it('subtracts signups', () => {
    expect(seatsLeft(cls('2026-09-07', '18:30', 'Striking'))).toBe(18);
  });

  it('never goes negative when a class is overbooked', () => {
    expect(seatsLeft(cls('2026-09-07', '18:30', 'Striking', { seats: 4, seatsTaken: 6 }))).toBe(0);
  });
});
