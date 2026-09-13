// The hub for everything that does not deserve a tab of its own. It exists so
// the bottom bar stays at four thumb-sized targets however much the system grows.
const ITEMS = [
  { id: 'quotes', title: 'הצעות מחיר', note: 'תמחור פרויקט חדש ומעקב אחרי תשובות' },
  { id: 'stock', title: 'שאריות בסדנה', note: 'מה כבר יש לך, לפני שאתה קונה' },
  { id: 'clients', title: 'לקוחות', note: 'פרטי קשר וכל מה שנבנה עבורם' },
  { id: 'settings', title: 'הגדרות', note: 'יתרת פתיחה, שכירות, ימי סדנה, תעריף יום' },
]

export default function More({ go }) {
  return (
    <ul className="rows">
      {ITEMS.map((item) => (
        <li key={item.id}>
          <button type="button" className="row-btn" onClick={() => go(item.id)}>
            <span className="what">
              <span className="desc">{item.title}</span>
              <span className="cat">{item.note}</span>
            </span>
            <span className="chev" aria-hidden="true">
              ‹
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}
