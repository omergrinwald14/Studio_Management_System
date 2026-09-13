import { test } from 'node:test'
import assert from 'node:assert/strict'

import { formatMonth, formatDay, formatDate, monthStartsBetween, monthlyDatesBetween } from './format.js'

test('a bare date keeps its own day', () => {
  // new Date('2026-01-01') is parsed as UTC and lands on 31/12 in our timezone.
  // These helpers split the string instead, so the day cannot slip backwards.
  assert.equal(formatDate('2026-01-01'), '01/01/2026')
  assert.equal(formatDay('2026-01-01'), '1.1')
  assert.equal(formatMonth('2026-01'), 'ינואר 2026')
})

test('rent lands on the 1st of every month inside the window', () => {
  assert.deepEqual(monthStartsBetween('2026-09-12', '2026-12-15'), [
    '2026-10-01',
    '2026-11-01',
    '2026-12-01',
  ])
})

test('the window can cross a year', () => {
  assert.deepEqual(monthStartsBetween('2026-11-20', '2027-02-01'), [
    '2026-12-01',
    '2027-01-01',
    '2027-02-01',
  ])
})

test('a window shorter than a month has no rent in it', () => {
  assert.deepEqual(monthStartsBetween('2026-09-12', '2026-09-30'), [])
})

test('the 1st of the starting month is behind us, not ahead', () => {
  assert.deepEqual(monthStartsBetween('2026-09-01', '2026-09-30'), [])
})

test('a day other than the 1st is honoured each month', () => {
  assert.deepEqual(monthlyDatesBetween('2026-09-12', '2026-11-20', 15), [
    '2026-09-15',
    '2026-10-15',
    '2026-11-15',
  ])
})
