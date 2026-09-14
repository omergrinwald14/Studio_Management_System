import { supabase } from './supabase'

// Shared by receipts and by the project gallery: both put a phone photo in a
// private bucket and read it back through a link that expires.

// A phone camera produces 3-6 MB per shot. The free tier gives 1 GB in total,
// so every image is shrunk before it leaves the phone — a receipt has to be
// readable and a gallery photo has to look right on a screen, neither has to be
// archival. At this size a picture costs roughly 300 KB.
const MAX_EDGE = 1600
const QUALITY = 0.7

/**
 * Shrink a photo in the browser before uploading it.
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

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALITY))
    // if the "compressed" version came out larger, keep the original
    return blob && blob.size < file.size
      ? new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' })
      : file
  } catch {
    // an unusual format the browser cannot decode: upload it as it came
    return file
  }
}

/** Upload one file and return the path to store against the row that owns it. */
export async function upload(bucket, file, prefix = '') {
  const prepared = await compress(file)
  const extension = prepared.name.split('.').pop().toLowerCase() || 'jpg'
  // foldered by month so the bucket stays browsable by hand if it ever matters
  const folder = prefix || new Date().toISOString().slice(0, 7)
  const path = `${folder}/${crypto.randomUUID()}.${extension}`

  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, prepared, { contentType: prepared.type, upsert: false })
  return error ? { error: error.message } : { path }
}

/**
 * A link that works for an hour.
 *
 * The buckets are private, so there is no permanent URL to store — which is the
 * point: a leaked link stops working on its own.
 */
export async function signedUrl(bucket, path, seconds = 3600) {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, seconds)
  return error ? { error: error.message } : { url: data.signedUrl }
}

/** Signed links for many files at once — one request instead of one per tile. */
export async function signedUrls(bucket, paths, seconds = 3600) {
  if (!paths.length) return { urls: {} }
  const { data, error } = await supabase.storage.from(bucket).createSignedUrls(paths, seconds)
  if (error) return { error: error.message }
  const urls = {}
  data.forEach((item) => {
    if (item.signedUrl) urls[item.path] = item.signedUrl
  })
  return { urls }
}

export async function remove(bucket, paths) {
  const list = Array.isArray(paths) ? paths : [paths]
  if (!list.length) return {}
  const { error } = await supabase.storage.from(bucket).remove(list)
  return error ? { error: error.message } : {}
}
