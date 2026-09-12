import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  balanceOf,
  cashFlowBreakdown,
  paidOnProject,
  receivablesOf,
  expectedMovements,
  overheadPerDay,
  projectProfit,
} from './finance.js'

// Node runs these with `npm test` — no framework, no dependency to keep current.
// They exist because these are the numbers he makes decisions on: a wrong
// balance sends him to the lumber yard with money he does not have.

const settings = { opening: 1000, opening_date: '2026-08-01', rent: 1800, days_per_month: 8 }

const txs = [
  { id: 1, date: '2026-07-20', amount: -500, capital: false, adjust: false, project_id: null },
  { id: 2, date: '2026-08-02', amount: 1500, capital: false, adjust: false, project_id: 1 },
  { id: 3, date: '2026-08-03', amount: -864, capital: false, adjust: false, project_id: 1 },
  { id: 4, date: '2026-08-05', amount: 7200, capital: true, adjust: false, project_id: null },
  { id: 5, date: '2026-08-09', amount: -1800, capital: false, adjust: false, project_id: null },
  { id: 6, date: '2026-08-20', amount: -36, capital: false, adjust: true, project_id: null },
]

test('the balance ignores movements the opening figure already contains', () => {
  // the -500 on 20/07 predates the opening date and must not be counted twice
  assert.equal(balanceOf(txs, settings), 1000 + 1500 - 864 + 7200 - 1800 - 36)
})

test('with no opening date every row counts', () => {
  assert.equal(balanceOf(txs, { opening: 0, opening_date: null }), 1500 - 864 + 7200 - 1800 - 36 - 500)
})

test('the breakdown adds back up to the balance', () => {
  const parts = cashFlowBreakdown(txs, settings)
  assert.equal(parts.balance, balanceOf(txs, settings))
  assert.equal(parts.received, 1500)
  assert.equal(parts.ownCapital, 7200, 'owner capital is cash but never revenue')
  assert.equal(parts.spent, -2664)
  assert.equal(parts.adjustments, -36, 'a reconciliation row is neither income nor expense')
})

test('owner capital is not a client payment', () => {
  const rows = [
    { amount: 500, capital: false, adjust: false, project_id: 1 },
    { amount: 9000, capital: true, adjust: false, project_id: 1 },
    { amount: -40, capital: false, adjust: true, project_id: 1 },
  ]
  assert.equal(paidOnProject(rows, 1), 500)
})

test('receivables are price less what was actually paid', () => {
  const projects = [
    { id: 1, name: 'ספסל', price: 1500, due: '2026-09-10', lost: false },
    { id: 2, name: 'מדף', price: 1600, due: '2026-08-25', lost: false },
    { id: 3, name: 'שולחן', price: 900, due: null, lost: true },
    { id: 4, name: 'ללא מחיר', price: null, due: null, lost: false },
  ]
  const paid = [{ amount: 1500, capital: false, adjust: false, project_id: 1 }]
  const open = receivablesOf(projects, paid)

  assert.deepEqual(
    open.map((p) => p.name),
    ['מדף'],
    'a fully paid job, a rejected quote and a job with no price all drop out',
  )
  assert.equal(open[0].due_amount, 1600)
})

test('a project with no due date sorts last rather than first', () => {
  const projects = [
    { id: 1, name: 'ללא תאריך', price: 100, due: null, lost: false },
    { id: 2, name: 'עם תאריך', price: 100, due: '2026-09-01', lost: false },
  ]
  assert.deepEqual(
    receivablesOf(projects, []).map((p) => p.name),
    ['עם תאריך', 'ללא תאריך'],
  )
})

test('the forecast counts commitments in date order', () => {
  const receivables = [
    { id: 1, name: 'ספסל', due: '2026-09-20', due_amount: 1500 },
    { id: 2, name: 'כבר עבר', due: '2026-08-01', due_amount: 800 },
  ]
  const moves = expectedMovements({
    receivables,
    rent: 1800,
    today: '2026-09-12',
    until: '2026-10-31',
  })

  assert.deepEqual(
    moves.map((m) => [m.date, m.amount]),
    [
      ['2026-09-20', 1500],
      ['2026-10-01', -1800],
    ],
    'a date already past is not a forecast, and rent lands on the 1st',
  )
})

test('no rent set means no rent line', () => {
  const moves = expectedMovements({ receivables: [], rent: 0, today: '2026-09-12', until: '2026-12-31' })
  assert.deepEqual(moves, [])
})

test('a workshop day carries its share of the rent', () => {
  assert.equal(overheadPerDay(settings), 225)
  assert.equal(overheadPerDay({ rent: 1800, days_per_month: 0 }), 0, 'never divide by zero')
})

test('project profit is price less real costs less the rent it used', () => {
  const project = { id: 1, price: 1500, days: 4 }
  // 1500 − 864 of walnut − 4 days × 225 = −264: the number his spreadsheet hides
  assert.equal(projectProfit(project, txs, settings), 1500 - 864 - 900)
})

test('there is no profit to state before there is a price', () => {
  assert.equal(projectProfit({ id: 1, price: null, days: 2 }, txs, settings), null)
})
