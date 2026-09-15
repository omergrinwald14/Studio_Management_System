// A short confirmation that something worked, shown just above the tab bar.
// Changes that happen somewhere else on the screen — a photo landing at the
// bottom of a gallery he has scrolled away from — are easy to miss, and silence
// after a tap reads as "did it work?". Paired with useFlash, which clears it.
export default function Toast({ message }) {
  if (!message) return null
  // role="status" makes VoiceOver read it out without moving focus
  return (
    <div className="toast" role="status" key={message}>
      {message}
    </div>
  )
}
