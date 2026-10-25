import { formatPrice } from "@/data/products";

export function RevenueBars({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ period: string; revenueInPaise: number; orderCount?: number }>;
}) {
  const max = Math.max(1, ...rows.map((row) => row.revenueInPaise));
  return (
    <section className="border border-gold/30 bg-white p-5">
      <h3 className="font-display text-lg text-maroon">{title}</h3>
      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-brown/65">Not enough real sales data for this chart yet.</p>
      ) : (
        <>
          <div
            role="img"
            aria-label={`${title} bar chart`}
            className="mt-6 flex h-44 items-end gap-1 overflow-x-auto border-b border-l border-gold/40 px-2"
          >
            {rows.map((row) => (
              <div
                key={row.period}
                title={`${row.period}: ${formatPrice(row.revenueInPaise)}`}
                className="min-w-5 flex-1 bg-maroon/80 hover:bg-maroon"
                style={{ height: `${Math.max(3, (row.revenueInPaise / max) * 100)}%` }}
              />
            ))}
          </div>
          <details className="mt-4 text-sm">
            <summary className="cursor-pointer font-medium text-maroon">View chart data</summary>
            <div className="mt-3 max-h-52 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr>
                    <th className="py-1">Period</th>
                    <th className="py-1 text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.period} className="border-t border-gold/20">
                      <td className="py-2">{row.period}</td>
                      <td className="py-2 text-right">{formatPrice(row.revenueInPaise)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </section>
  );
}

export function OrderBars({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ period: string; orderCount?: number }>;
}) {
  const max = Math.max(1, ...rows.map((row) => row.orderCount ?? 0));
  return (
    <section className="border border-gold/30 bg-white p-5">
      <h3 className="font-display text-lg text-maroon">{title}</h3>
      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-brown/65">Not enough real order data for this chart yet.</p>
      ) : (
        <>
          <div
            role="img"
            aria-label={`${title} bar chart`}
            className="mt-6 flex h-44 items-end gap-1 overflow-x-auto border-b border-l border-gold/40 px-2"
          >
            {rows.map((row) => (
              <div
                key={row.period}
                title={`${row.period}: ${row.orderCount ?? 0} orders`}
                className="min-w-5 flex-1 bg-gold/80 hover:bg-gold"
                style={{ height: `${Math.max(3, ((row.orderCount ?? 0) / max) * 100)}%` }}
              />
            ))}
          </div>
          <ul className="sr-only">
            {rows.map((row) => (
              <li key={row.period}>{row.period}: {row.orderCount ?? 0} orders</li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
