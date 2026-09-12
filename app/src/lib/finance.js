// Every money calculation in the system, in one place and free of React.
//
// They live here rather than inside the screens for two reasons. A figure like
// the balance appears on the dashboard and again in the ledger's breakdown, and
// two copies of a formula drift apart. And a function that takes rows and
// returns a number can be tested; the same arithmetic inside a component cannot.

import { monthStartsBetween } from './format.js' // Node needs the extension; Vite accepts it too

/** Rows that the opening balance does not already contain. */
export function countableTxs(txs, openingDate) {
  return openingDate ? txs.filter((tx) => tx.date >= openingDate) : txs
}

/**
 * The liquid balance of the business current account.
 * Every row moves the account, reconciliation rows included: an adjustment
 * exists precisely to bring this number back to what the bank says (D14).
 */
export function balanceOf(txs, settings) {
  return countableTxs(txs, settings.opening_date).reduce(
    (total, tx) => total + Number(tx.amount),
    Number(settings.opening) || 0,
  )
}

/**
 * The balance split into the lines it is made of. The four categories are
 * mutually exclusive by construction, so they always add back up to the total.
 */
export function cashFlowBreakdown(txs, settings) {
  const rows = countableTxs(txs, settings.opening_date)
  const opening = Number(settings.opening) || 0
  const received = sum(rows.filter((tx) => tx.amount > 0 && !tx.capital && !tx.adjust))
  const ownCapital = sum(rows.filter((tx) => tx.capital && !tx.adjust))
  const spent = sum(rows.filter((tx) => tx.amount < 0 && !tx.adjust))
  const adjustments = sum(rows.filter((tx) => tx.adjust))
  return {
    opening,
    received,
    ownCapital,
    spent,
    adjustments,
    balance: opening + received + ownCapital + spent + adjustments,
  }
}

/**
 * What a client has actually paid on a job: money in, on that project, from him.
 * An owner capital injection is cash but it is not a payment, and a bank
 * adjustment belongs to no project at all.
 */
export function paidOnProject(txs, projectId) {
  return sum(
    txs.filter((tx) => tx.project_id === projectId && tx.amount > 0 && !tx.capital && !tx.adjust),
  )
}

/** Open projects with money still owed, soonest collection date first. */
export function receivablesOf(projects, txs) {
  return projects
    .filter((project) => project.price != null && !project.lost)
    .map((project) => ({
      ...project,
      due_amount: Number(project.price) - paidOnProject(txs, project.id),
    }))
    .filter((project) => project.due_amount > 0)
    .sort((a, b) => (a.due || '9999-12-31').localeCompare(b.due || '9999-12-31'))
}

/**
 * Movements expected between today and `until`: money owed on jobs, at the date
 * it is due, and the rent on the 1st of each month. Commitments only — a
 * pending quote is not money and is deliberately left out.
 */
export function expectedMovements({ receivables, rent, today, until, labelFor }) {
  const fromJobs = receivables
    .filter((project) => project.due && project.due > today && project.due <= until)
    .map((project) => ({
      key: `r${project.id}`,
      date: project.due,
      label: project.name,
      note: labelFor ? labelFor(project) : '',
      amount: project.due_amount,
    }))

  const fromRent =
    Number(rent) > 0
      ? monthStartsBetween(today, until).map((date) => ({
          key: `rent${date}`,
          date,
          label: 'שכירות סדנה',
          note: 'הוצאה קבועה',
          amount: -Number(rent),
        }))
      : []

  return [...fromJobs, ...fromRent].sort((a, b) => a.date.localeCompare(b.date))
}

/** What a workshop day costs before he has touched a board. */
export function overheadPerDay(settings) {
  const days = Number(settings.days_per_month) || 0
  return days > 0 ? Number(settings.rent) / days : 0
}

/**
 * The calculation his spreadsheet cannot produce (D10): the price, less what the
 * job actually cost, less its share of the rent. `spent` is already negative, so
 * it is added rather than subtracted. Returns null with no agreed price — there
 * is no profit to state before there is a price.
 */
export function projectProfit(project, txs, settings) {
  if (project.price == null) return null
  const spent = sum(txs.filter((tx) => tx.project_id === project.id && tx.amount < 0))
  const overhead = Number(project.days) * overheadPerDay(settings)
  return Number(project.price) + spent - overhead
}

export function sum(rows) {
  return rows.reduce((total, tx) => total + Number(tx.amount), 0)
}
