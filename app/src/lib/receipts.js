import { upload, signedUrl, signedUrls, remove } from './storage'

// Receipts are one photo against one transaction. The mechanics are shared with
// the project gallery; these names exist so the screens do not have to know
// which bucket they are talking to.
const BUCKET = 'receipts'

export const uploadReceipt = (file) => upload(BUCKET, file)
export const receiptUrl = (path) => signedUrl(BUCKET, path)
export const receiptUrls = (paths) => signedUrls(BUCKET, paths)
export const deleteReceipt = (path) => remove(BUCKET, path)
