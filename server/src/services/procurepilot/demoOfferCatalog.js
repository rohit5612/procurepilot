/**
 * Demonstration supplier offers (labeled demo data per product spec).
 * @param {object} request - confirmed extraction
 */
export function buildDemoOffers(request) {
  const budget = request.maximum_budget ?? 100000;
  const deadline = request.delivery_deadline;
  const friday = deadline || nextFridayIso();
  const thursday = shiftDays(friday, -1);
  const late = shiftDays(friday, 4);

  const base = [
    {
      id: 'demo-a',
      supplier_name: 'Supplier A (demo)',
      price: Math.round(budget * 0.95),
      delivery_date: friday,
      notes: 'Standard lead time'
    },
    {
      id: 'demo-b',
      supplier_name: 'Supplier B (demo)',
      price: Math.round(budget * 1.05),
      delivery_date: thursday,
      notes: 'Faster delivery, over budget'
    },
    {
      id: 'demo-c',
      supplier_name: 'Supplier C (demo)',
      price: Math.round(budget * 0.9),
      delivery_date: late,
      notes: 'Best price, misses deadline'
    }
  ];

  if (/chair/i.test(request.item || '')) {
    return [
      { id: 'A', supplier_name: 'Supplier A', price: 76000, delivery_date: friday },
      { id: 'B', supplier_name: 'Supplier B', price: 84000, delivery_date: thursday },
      { id: 'C', supplier_name: 'Supplier C', price: 72000, delivery_date: late }
    ];
  }

  return base;
}

function nextFridayIso() {
  const now = new Date();
  const day = now.getDay();
  const add = (5 - day + 7) % 7 || 7;
  const d = new Date(now);
  d.setDate(d.getDate() + add);
  return d.toISOString().slice(0, 10);
}

function shiftDays(isoDate, delta) {
  const d = new Date(isoDate);
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}
