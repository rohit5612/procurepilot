import PolicySectionNav from '../../components/procurepilot/PolicySectionNav';
import PolicySpendAuditPanel from '../../components/procurepilot/PolicySpendAuditPanel';
import PageToolbar from '../../components/layout/PageToolbar';

export default function PolicyPayPalAuditPage() {
  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-10">
      <PageToolbar description="Verify PayPal captures, reservations, and monthly budget ledger after AI Buy checkouts.">
        <PolicySectionNav />
      </PageToolbar>

      <div className="page-panel p-6 bg-gradient-to-br from-card to-sky-500/5">
        <h2 className="text-lg font-semibold text-fg">Payments & commitments</h2>
        <p className="text-sm text-muted mt-2 leading-relaxed max-w-2xl">
          Separate from the role spend matrix: actual PayPal events and open budget reservations for this period.
        </p>
      </div>

      <PolicySpendAuditPanel variant="full" />
    </div>
  );
}
