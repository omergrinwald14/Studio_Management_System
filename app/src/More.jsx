// The hub for everything that does not deserve a tab of its own. It exists so
// the bottom bar stays at four thumb-sized targets however much the system grows.
const ITEMS = [
  { id: 'search', title: 'חיפוש', note: 'בכל המערכת בבת אחת — לקוחות, תנועות, לקחים' },
  { id: 'quotes', title: 'הצעות מחיר', note: 'תמחור פרויקט חדש ומעקב אחרי תשובות' },
  { id: 'receipts', title: 'קבלות', note: 'כל הקבלות שצילמת, מסודרות לפי חודש' },
  { id: 'stock', title: 'שאריות בסדנה', note: 'מה כבר יש לך, לפני שאתה קונה' },
  { id: 'clients', title: 'לקוחות', note: 'פרטי קשר וכל מה שנבנה עבורם' },
  { id: 'suppliers', title: 'ספקים', note: 'אנשי קשר, ומה למדת על כל אחד מהם' },
  { id: 'lessons', title: 'לקחים', note: 'מה למדת, מכל הפרויקטים, עם חיפוש ותגיות' },
  { id: 'settings', title: 'הגדרות', note: 'יתרת פתיחה, שכירות, ימי סדנה, תעריף יום' },
  { id: 'backup', title: 'גיבוי וייצוא', note: 'הורדת עותק של כל הנתונים, וקבצים לרואה החשבון' },
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
