-- 2026 NFL weeks seeded from ESPN schedule
-- Generated: 2026-08-11T22:15:21.643Z
-- Source: https://www.espn.com/nfl/schedule/_/year/2026/seasontype/2
-- reveal_at = betting opens (4 days before first kickoff of the week)

delete from public.weeks;

insert into public.weeks (week_number, phase, allowance, reveal_at)
values
  (0, 'futures', 300, '2026-06-12 00:20:00+00'), -- Futures window opens ~90 days before Week 1
  (1, 'regular', 100, '2026-09-06 17:00:00+00'), -- Week 1: first game 2026-09-10T00:20:00.000Z
  (2, 'regular', 100, '2026-09-14 17:00:00+00'), -- Week 2: first game 2026-09-18T00:15:00.000Z
  (3, 'regular', 100, '2026-09-21 17:00:00+00'), -- Week 3: first game 2026-09-25T00:15:00.000Z
  (4, 'regular', 100, '2026-09-28 17:00:00+00'), -- Week 4: first game 2026-10-02T00:15:00.000Z
  (5, 'regular', 100, '2026-10-05 17:00:00+00'), -- Week 5: first game 2026-10-09T00:15:00.000Z
  (6, 'regular', 100, '2026-10-12 17:00:00+00'), -- Week 6: first game 2026-10-16T00:15:00.000Z
  (7, 'regular', 100, '2026-10-19 17:00:00+00'), -- Week 7: first game 2026-10-23T00:15:00.000Z
  (8, 'regular', 100, '2026-10-26 17:00:00+00'), -- Week 8: first game 2026-10-30T00:15:00.000Z
  (9, 'regular', 100, '2026-11-02 17:00:00+00'), -- Week 9: first game 2026-11-06T01:15:00.000Z
  (10, 'regular', 100, '2026-11-09 17:00:00+00'), -- Week 10: first game 2026-11-13T01:15:00.000Z
  (11, 'regular', 100, '2026-11-16 17:00:00+00'), -- Week 11: first game 2026-11-20T01:15:00.000Z
  (12, 'regular', 100, '2026-11-22 17:00:00+00'), -- Week 12: first game 2026-11-26T01:00:00.000Z
  (13, 'regular', 100, '2026-11-30 17:00:00+00'), -- Week 13: first game 2026-12-04T01:15:00.000Z
  (14, 'regular', 100, '2026-12-07 17:00:00+00'), -- Week 14: first game 2026-12-11T01:15:00.000Z
  (15, 'regular', 100, '2026-12-14 17:00:00+00'), -- Week 15: first game 2026-12-18T01:15:00.000Z
  (16, 'regular', 100, '2026-12-21 17:00:00+00'), -- Week 16: first game 2026-12-25T01:15:00.000Z
  (17, 'regular', 100, '2026-12-28 17:00:00+00'), -- Week 17: first game 2027-01-01T01:15:00.000Z
  (18, 'regular', 100, '2027-01-06 17:00:00+00'), -- Week 18: first game 2027-01-10T05:00:00.000Z
  (19, 'playoff', 200, '2027-01-12 17:00:00+00'), -- Wild Card: first game 2027-01-16T05:00:00.000Z
  (20, 'playoff', 200, '2027-01-19 17:00:00+00'), -- Divisional: first game 2027-01-23T05:00:00.000Z
  (21, 'playoff', 200, '2027-01-27 17:00:00+00'); -- Conference Championships: first game 2027-01-31T05:00:00.000Z
