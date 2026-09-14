import { test } from 'node:test'
import assert from 'node:assert/strict'

import { toCsv } from './csv.js'

// A backup that quietly corrupts one column is worse than no backup, because it
// is only discovered on the day it is needed.

test('a comma inside a value does not become a new column', () => {
  const csv = toCsv([{ description: 'מחסן עצים, אגוז', amount: -864 }])
  assert.equal(csv, 'description,amount\r\n"מחסן עצים, אגוז",-864')
})

test('a quote inside a value is doubled, as CSV requires', () => {
  const csv = toCsv([{ note: 'לוח 50 מ"מ' }])
  assert.equal(csv, 'note\r\n"לוח 50 מ""מ"')
})

test('a newline inside a value stays inside its cell', () => {
  const csv = toCsv([{ note: 'שורה\nשנייה' }])
  assert.equal(csv, 'note\r\n"שורה\nשנייה"')
})

test('columns are collected across every row, not taken from the first', () => {
  // the first row has no `phone`; taking its keys would drop the column entirely
  const csv = toCsv([{ name: 'מאיה' }, { name: 'יואב', phone: '050' }])
  assert.equal(csv, 'name,phone\r\nמאיה,\r\nיואב,050')
})

test('null and undefined are empty cells, not the words null and undefined', () => {
  const csv = toCsv([{ a: null, b: undefined, c: 0 }])
  assert.equal(csv, 'a,b,c\r\n,,0')
})

test('no rows means no file rather than a stray header', () => {
  assert.equal(toCsv([]), '')
})
