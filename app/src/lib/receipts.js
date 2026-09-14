import { supabase } from './supabase'

const BUCKET = 'receipts'

// A phone camera produces 3-6 MB per shot. At the free tier's 1 GB that is
// roughly 200 receipts — a single year — so every image is shrunk before it
// is uploaded. A receipt only has to be readable, not archival.
const MAX_EDGE = 1600
const QUALITY = 0.7

/**
 * Shrink a photo in the browser before it ever leaves the phone.
 *
 * Anything that is not an image — a PDF from a supplier, say — passes through
 * untouched, since there is nothing here that can re-encode one.
 */
export async function compress(file) {
  if (!file.type.startsWith('image/')) return file

  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
    // already small enough, and re-encoding would only lose detail
    if (scale === 1 && file.size < 600_000) return file

    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)

    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', QUALITY),
    )
    // if the "compressed" version came out larger, keep the original
    return blob && blob.size < file.size
      ? new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' })
      : file
  } catch {
    // an unusual format the browser cannot decode: upload it as it came
    return file
  }
}

/** Upload one receipt and return the path to store against the transaction. */
export async function uploadReceipt(file) {
  const prepared = await compress(file)
  const extension = prepared.name.split('.').pop().toLowerCase() || 'jpg'
  // foldered by month so the bucket stays browsable by hand if it ever matters
  const path = `${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}.${extension}`

  const { error } = await supabase.storage.from(BUCKET).upload(path, prepared, {
    contentType: prepared.type,
    upsert: false,
  })
  return error ? { error: error.message } : { path }
}

/**
 * A link that works for an hour.
 *
 * The bucket is private, so there is no permanent URL to store — which is the
 * point: a leaked link stops working on its own.
 */
export async function receiptUrl(path) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600)
  return error ? { error: error.message } : { url: data.signedUrl }
}

export async function deleteReceipt(path) {
  const { error } = await supabase.storage.from(BUCKET).remove([path])
  return error ? { error: error.message } : {}
}
