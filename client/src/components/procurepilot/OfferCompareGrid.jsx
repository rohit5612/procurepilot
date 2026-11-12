import { useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { useAgTheme } from '../../hooks/useAgTheme';

function formatInr(v) {
  if (v == null) return '—';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(
    Number(v)
  );
}

/**
 * @param {{
 *   offers: object[];
 *   policyOffers: object[];
 *   recommendedOfferId?: string | null;
 *   onSelect?: (row: object) => void;
 *   onFocus?: (row: object) => void;
 *   selectedId?: string | null;
 * }} props
 */
export default function OfferCompareGrid({
  offers,
  policyOffers,
  recommendedOfferId,
  onSelect,
  onFocus,
  selectedId
}) {
  const { gridTheme } = useAgTheme();
  const policyById = useMemo(() => {
    const map = new Map();
    for (const p of policyOffers || []) {
      map.set(p.offer_id, p);
    }
    return map;
  }, [policyOffers]);

  const rowData = useMemo(
    () =>
      (offers || []).map((o) => {
        const pol = policyById.get(o.id);
        return {
          id: o.id,
          supplier_name: o.supplier_name,
          price: o.price,
          delivery_date: o.delivery_date,
          purchase_url: o.purchase_url,
          product_title: o.product_title,
          image_url: o.image_url,
          source: o.source,
          delivery_verified: o.delivery_verified,
          eligible: pol?.eligible ?? false,
          status: pol?.eligible ? 'Eligible' : 'Rejected',
          reason: pol?.violations?.[0]?.message || pol?.decision_code || '—',
          recommended: o.id === recommendedOfferId
        };
      }),
    [offers, policyById, recommendedOfferId]
  );

  const columnDefs = useMemo(
    () => [
      {
        field: 'product_title',
        headerName: 'Product',
        flex: 1.2,
        minWidth: 160,
        valueFormatter: (p) => p.value || '—'
      },
      { field: 'supplier_name', headerName: 'Retailer', flex: 1, minWidth: 120 },
      {
        field: 'price',
        headerName: 'Price',
        width: 120,
        valueFormatter: (p) => formatInr(p.value)
      },
      {
        field: 'delivery_date',
        headerName: 'Delivery',
        width: 120,
        valueFormatter: (p) =>
          p.data?.delivery_verified === false && p.data?.source === 'channel3' ? 'Unverified' : p.value || '—'
      },
      {
        field: 'purchase_url',
        headerName: 'Listing',
        width: 90,
        cellRenderer: (p) =>
          p.data?.purchase_url ? (
            <a href={p.data.purchase_url} target="_blank" rel="noreferrer" className="text-primary text-xs underline">
              View
            </a>
          ) : (
            '—'
          )
      },
      {
        field: 'status',
        headerName: 'Policy',
        width: 100,
        cellClass: (p) => (p.data?.eligible ? 'text-emerald-700 font-semibold' : 'text-red-600 font-semibold')
      },
      {
        field: 'reason',
        headerName: 'Why',
        flex: 1.4,
        minWidth: 200,
        wrapText: true,
        autoHeight: true,
        cellClass: 'text-xs leading-snug'
      },
      {
        field: 'recommended',
        headerName: 'Rank',
        width: 90,
        valueFormatter: (p) => (p.value ? '★ Best' : '')
      }
    ],
    []
  );

  const gridHeight = Math.min(520, 52 + Math.max(rowData.length, 1) * 56);

  return (
    <div className="w-full rounded-xl border border-border overflow-hidden" style={{ height: gridHeight }}>
      <AgGridReact
        theme={gridTheme}
        rowData={rowData}
        columnDefs={columnDefs}
        getRowId={(p) => p.data.id}
        rowSelection={{ mode: 'singleRow', enableClickSelection: true }}
        domLayout="normal"
        onRowClicked={(e) => {
          if (e.data && onFocus) onFocus(e.data);
          if (e.data?.eligible && onSelect) onSelect(e.data);
        }}
        getRowClass={(p) => {
          if (p.data?.id === selectedId) return 'bg-primary/10';
          if (!p.data?.eligible) return 'opacity-70';
          return '';
        }}
        suppressCellFocus
        defaultColDef={{ sortable: true, resizable: true }}
      />
    </div>
  );
}
