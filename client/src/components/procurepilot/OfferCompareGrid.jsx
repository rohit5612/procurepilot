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
 *   selectedId?: string | null;
 * }} props
 */
export default function OfferCompareGrid({
  offers,
  policyOffers,
  recommendedOfferId,
  onSelect,
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
      { field: 'supplier_name', headerName: 'Supplier', flex: 1, minWidth: 140 },
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
        width: 110,
        cellClass: (p) => (p.data?.eligible ? 'text-emerald-700 font-medium' : 'text-red-600 font-medium')
      },
      { field: 'reason', headerName: 'Reason', flex: 1.2, minWidth: 180 },
      {
        field: 'recommended',
        headerName: 'Rank',
        width: 90,
        valueFormatter: (p) => (p.value ? '★ Best' : '')
      }
    ],
    []
  );

  return (
    <div className="w-full rounded-lg border border-border overflow-hidden" style={{ height: 280 }}>
      <AgGridReact
        theme={gridTheme}
        rowData={rowData}
        columnDefs={columnDefs}
        getRowId={(p) => p.data.id}
        rowSelection={{ mode: 'singleRow', enableClickSelection: true }}
        onRowClicked={(e) => {
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
