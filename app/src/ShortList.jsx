// The first few rows of a list, and a link to the screen that holds all of it.
//
// Two earlier attempts are worth remembering, because both failed for reasons
// that look obvious only afterwards. Expand-in-place put the collapse control
// below every row, so undoing it meant scrolling the page. A fixed window with
// its own scrollbar then made the dashboard hard to scroll at all on a phone,
// which is the documented cost of nesting two scrollers on the same axis —
// users do not reliably grasp scroll-inside-scroll, and it breaks magnifier and
// screen-reader navigation outright.
//
// So: no second scroller, no height that changes under the user. The dashboard
// shows a glance and hands off to the full screen.
export default function ShortList({ items, rows = 4, onAll, allLabel, children }) {
  const rest = items.length - rows
  return (
    <>
      <ul className="rows">{items.slice(0, rows).map(children)}</ul>
      {onAll && rest > 0 && (
        <button type="button" className="all-btn" onClick={onAll}>
          {allLabel} ({rest} נוספים) ←
        </button>
      )}
    </>
  )
}
