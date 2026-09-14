import { upload, signedUrl, remove } from './storage'

// Receipts are one photo against one transaction. The mechanics are shared with
// the project gallery; these three names exist so the ledger does not have to
// know which bucket it is talking to.
const BUCKET = 'receipts'

export const uploadReceipt = (file) => upload(BUCKET, file)
export const receiptUrl = (path) => signedUrl(BUCKET, path)
export const deleteReceipt = (path) => remove(BUCKET, path)
