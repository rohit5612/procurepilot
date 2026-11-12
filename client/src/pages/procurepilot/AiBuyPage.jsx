import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CreditCard, Loader2, Sparkles, Wand2, ShieldCheck, AlertCircle, CheckCircle2 } from 'lucide-react';
import PageToolbar from '../../components/layout/PageToolbar';
import OfferCompareGrid from '../../components/procurepilot/OfferCompareGrid';
import ProcurePilotPayPalButtons from '../../components/procurepilot/ProcurePilotPayPalButtons';
import SpendSnapshotPanel from '../../components/procurepilot/SpendSnapshotPanel';
import { procurePilotAiBuyApi } from '../../utils/api';
import { usePermissions } from '../../hooks/usePermissions';

const STEPS = ['Describe', 'Confirm', 'Compare', 'Checkout'];

function formatInr(v) {
  if (v == null || v === '') return '—';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(
    Number(v)
  );
}

export default function AiBuyPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { hasPermission } = usePermissions();
  const canSubmitPr = hasPermission('procurepilot.ai_buy.submit');
  const [step, setStep] = useState(0);
  const [text, setText] = useState(
    '12 ergonomic office chairs for Dehradun office, budget ₹80,000, delivery by Friday.'
  );
  const [draft, setDraft] = useState(null);
  const [compareResult, setCompareResult] = useState(null);
  const [selectedOfferId, setSelectedOfferId] = useState(null);
  const [llmStatus, setLlmStatus] = useState(null);
  const [paypalConfig, setPaypalConfig] = useState(null);
  const [channel3Status, setChannel3Status] = useState(null);
  const [purchaseRequestId, setPurchaseRequestId] = useState(null);
  const [paymentSuccess, setPaymentSuccess] = useState(null);
  const [prCreated, setPrCreated] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const paypalClientId = useMemo(
    () => import.meta.env.VITE_PAYPAL_CLIENT_ID || paypalConfig?.clientId || '',
    [paypalConfig]
  );
  const paypalEnabled =
    import.meta.env.VITE_PAYPAL_ENABLED === 'true' ||
    (paypalConfig?.enabled && Boolean(paypalClientId));

  const loadStatus = useCallback(async () => {
    try {
      const res = await procurePilotAiBuyApi.getStatus();
      const json = await res.json();
      if (res.ok) {
        setLlmStatus(json.data?.llm);
        setPaypalConfig(json.data?.paypal);
        setChannel3Status(json.data?.channel3);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    if (searchParams.get('paypal') === 'success') {
      setPaymentSuccess({ message: 'Payment completed — thank you.' });
    }
  }, [searchParams]);

  const runExtract = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await procurePilotAiBuyApi.extract(text);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || json.message || 'Extraction failed');
      setDraft(json.data);
      setStep(1);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const runCompare = async () => {
    if (!draft) return;
    setLoading(true);
    setError('');
    try {
      const res = await procurePilotAiBuyApi.compare({ request: draft });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Compare failed');
      setCompareResult(json.data);
      setSelectedOfferId(json.data.policy?.recommended_offer_id || null);
      setPurchaseRequestId(json.data.purchase_request_id || null);
      setPaymentSuccess(null);
      setPrCreated(null);
      setStep(2);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const updateDraft = (key, value) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const selectedOffer = compareResult?.offers?.find((o) => String(o.id) === String(selectedOfferId));

  const goCheckout = () => {
    if (!selectedOfferId) {
      setError('Select an eligible offer first.');
      return;
    }
    setError('');
    setStep(3);
  };

  const submitAiPr = async () => {
    if (!purchaseRequestId || !selectedOfferId) {
      setError('Missing session — run policy compare again.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await procurePilotAiBuyApi.submitPr({
        purchase_request_id: purchaseRequestId,
        offer_id: selectedOfferId
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Could not create PR');
      setPrCreated(json.data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl space-y-6">
      <PageToolbar description="Natural language → structured requirements → policy-checked offer comparison.">
        <div className="flex flex-wrap gap-2 justify-end">
          {llmStatus && (
            <span
              className={`text-xs px-2.5 py-1 rounded-full border ${
                llmStatus.ok ? 'border-emerald-300 text-emerald-800 bg-emerald-50' : 'border-amber-300 text-amber-900 bg-amber-50'
              }`}
            >
              AI: {llmStatus.provider} — {llmStatus.message || (llmStatus.ok ? 'ready' : 'check config')}
            </span>
          )}
          {paypalEnabled ? (
            <span className="text-xs px-2.5 py-1 rounded-full border border-sky-300 text-sky-900 bg-sky-50">
              PayPal: {paypalConfig?.mode || 'sandbox'}
            </span>
          ) : (
            <span className="text-xs px-2.5 py-1 rounded-full border border-border text-muted">PayPal off</span>
          )}
        </div>
      </PageToolbar>

      <div className="flex gap-2 text-xs font-medium">
        {STEPS.map((label, i) => (
          <span
            key={label}
            className={`px-3 py-1 rounded-full ${
              i === step ? 'bg-primary text-primary-foreground' : i < step ? 'bg-secondary text-secondary-foreground' : 'text-muted border border-border'
            }`}
          >
            {i + 1}. {label}
          </span>
        ))}
      </div>

      {error && (
        <div className="page-panel p-4 text-sm text-destructive flex gap-2 items-start" role="alert">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      <SpendSnapshotPanel />

      {step === 0 && (
        <div className="space-y-4">
          <div className="page-panel p-6 flex gap-4">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shrink-0">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-fg">Describe what you need</h2>
              <p className="text-sm text-muted mt-1">
                The server calls your configured LLM (Ollama in dev). Output is validated before policy runs.
              </p>
            </div>
          </div>
          <label className="block page-panel p-5">
            <span className="text-sm font-medium text-fg flex items-center gap-2 mb-3">
              <Wand2 size={16} className="text-primary" />
              Purchase request
            </span>
            <textarea
              className="input min-h-[160px] resize-y bg-card text-sm leading-relaxed w-full"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="btn btn-primary inline-flex items-center gap-2"
            disabled={loading || !text.trim()}
            onClick={runExtract}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Analyze with AI
          </button>
        </div>
      )}

      {step === 1 && draft && (
        <div className="page-panel p-6 space-y-4">
          <h3 className="font-semibold text-fg">Confirm requirements</h3>
          <p className="text-xs text-muted">Edit fields before policy comparison. AI cannot override caps.</p>
          <div className="grid sm:grid-cols-2 gap-4 text-sm">
            <label className="block sm:col-span-2">
              <span className="form-label">Item</span>
              <input className="input w-full" value={draft.item || ''} onChange={(e) => updateDraft('item', e.target.value)} />
            </label>
            <label className="block">
              <span className="form-label">Quantity</span>
              <input
                type="number"
                className="input w-full"
                value={draft.quantity ?? ''}
                onChange={(e) => updateDraft('quantity', e.target.value === '' ? null : Number(e.target.value))}
              />
            </label>
            <label className="block">
              <span className="form-label">Max budget (INR)</span>
              <input
                type="number"
                className="input w-full"
                value={draft.maximum_budget ?? ''}
                onChange={(e) =>
                  updateDraft('maximum_budget', e.target.value === '' ? null : Number(e.target.value))
                }
              />
              <span className="text-xs text-muted">{formatInr(draft.maximum_budget)}</span>
            </label>
            <label className="block">
              <span className="form-label">Delivery deadline</span>
              <input
                type="date"
                className="input w-full"
                value={draft.delivery_deadline || ''}
                onChange={(e) => updateDraft('delivery_deadline', e.target.value || null)}
              />
            </label>
            <label className="block">
              <span className="form-label">Segment</span>
              <select
                className="input w-full"
                value={draft.procurement_category || 'office'}
                onChange={(e) => updateDraft('procurement_category', e.target.value)}
              >
                {['office', 'mro', 'steel', 'infra', 'electrical', 'ppe', 'other'].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="block sm:col-span-2">
              <span className="form-label">Location</span>
              <input
                className="input w-full"
                value={draft.delivery_location || ''}
                onChange={(e) => updateDraft('delivery_location', e.target.value)}
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-secondary" onClick={() => setStep(0)} disabled={loading}>
              Back
            </button>
            <button type="button" className="btn btn-primary inline-flex items-center gap-2" onClick={runCompare} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              Run policy compare
            </button>
          </div>
        </div>
      )}

      {step === 2 && compareResult && (
        <div className="space-y-4">
          {compareResult.offer_source === 'channel3' && compareResult.offer_meta?.disclaimer && (
            <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              {compareResult.offer_meta.disclaimer}
            </p>
          )}
          {compareResult.offer_source === 'channel3' && (
            <p className="text-xs text-muted px-1">Offers from Channel3 product search (INR totals estimated from list prices).</p>
          )}
          {compareResult.demo_data && (
            <p className="text-xs text-muted px-1">Showing demonstration supplier offers (not live catalog).</p>
          )}
          {channel3Status?.enabled === false && !compareResult.demo_data && compareResult.offer_source !== 'channel3' && (
            <p className="text-xs text-muted px-1">
              Channel3 is off — enable <code className="text-xs">CHANNEL3_ENABLED=true</code> for live product listings.
            </p>
          )}
          <OfferCompareGrid
            offers={compareResult.offers}
            policyOffers={compareResult.policy?.offers || []}
            recommendedOfferId={compareResult.policy?.recommended_offer_id}
            selectedId={selectedOfferId}
            onSelect={(row) => setSelectedOfferId(row.id)}
          />
          <div className="page-panel p-5 space-y-3">
            <h3 className="font-semibold text-fg text-sm">AI summary</h3>
            <pre className="text-sm text-muted whitespace-pre-wrap font-sans leading-relaxed">
              {compareResult.explanation}
            </pre>
            {compareResult.policy?.approval?.required && (
              <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                Approval required ({compareResult.policy.approval.reason}) before checkout.
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <button type="button" className="btn btn-secondary" onClick={() => setStep(1)}>
              Edit requirements
            </button>
            <button
              type="button"
              className="btn btn-primary inline-flex items-center gap-2"
              disabled={!selectedOfferId}
              onClick={goCheckout}
            >
              <CreditCard className="h-4 w-4" />
              Continue to checkout
            </button>
          </div>
        </div>
      )}

      {step === 3 && compareResult && (
        <div className="space-y-4">
          {paymentSuccess && (
            <div className="page-panel p-4 flex gap-3 items-start text-emerald-800 bg-emerald-50 border border-emerald-200">
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              <div>
                <p className="font-medium">Payment recorded</p>
                <p className="text-sm">{paymentSuccess.message || 'PayPal capture succeeded.'}</p>
              </div>
            </div>
          )}

          {prCreated && (
            <div className="page-panel p-4 flex gap-3 items-start text-primary bg-primary/5 border border-primary/20">
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              <div>
                <p className="font-medium">Purchase requisition {prCreated.requisition_number} created</p>
                <button
                  type="button"
                  className="text-sm underline mt-1"
                  onClick={() => navigate(`/procurement/pr/requisition-details/${prCreated.requisition_id}`)}
                >
                  Open PR
                </button>
              </div>
            </div>
          )}

          <div className="page-panel p-6 space-y-4">
            <h3 className="font-semibold text-fg flex items-center gap-2">
              <CreditCard size={18} />
              Checkout
            </h3>
            {selectedOffer ? (
              <dl className="grid sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-muted">Supplier</dt>
                  <dd className="font-medium">{selectedOffer.supplier_name}</dd>
                </div>
                <div>
                  <dt className="text-muted">Amount (INR)</dt>
                  <dd className="font-medium">{formatInr(selectedOffer.price)}</dd>
                </div>
              </dl>
            ) : (
              <p className="text-sm text-muted">No offer selected.</p>
            )}

            {compareResult.policy?.approval?.required ? (
              <div className="space-y-3">
                <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  Policy requires approval before payment ({compareResult.policy.approval.reason}). Convert this AI session into a PR for your approval workflow.
                </p>
                {canSubmitPr && purchaseRequestId && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={loading || !selectedOfferId}
                    onClick={submitAiPr}
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin inline" /> : 'Create PR from AI Buy'}
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {paypalEnabled && purchaseRequestId && selectedOfferId && !paymentSuccess ? (
                  <>
                    <p className="text-xs text-muted">
                      PayPal charges in {paypalConfig?.currency || 'USD'} (INR offer amounts are converted server-side for sandbox).
                    </p>
                    <ProcurePilotPayPalButtons
                      clientId={paypalClientId}
                      currency={paypalConfig?.currency || 'USD'}
                      purchaseRequestId={purchaseRequestId}
                      offerId={String(selectedOfferId)}
                      onPaid={(data) =>
                        setPaymentSuccess({
                          message: `Order ${data.orderId} captured.`,
                          ...data
                        })
                      }
                      onError={(msg) => setError(msg)}
                    />
                  </>
                ) : !purchaseRequestId ? (
                  <p className="text-sm text-muted">
                    Session not persisted (set <code>PROCUREPILOT_PERSIST_AI_BUY=true</code> on server) to enable PayPal checkout.
                  </p>
                ) : (
                  <p className="text-sm text-muted">
                    Enable PayPal: set <code>PAYPAL_ENABLED=true</code> and client credentials on the server, plus <code>VITE_PAYPAL_CLIENT_ID</code> in the client.
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-secondary" onClick={() => setStep(2)}>
              Back to compare
            </button>
            <Link to="/procurement/pr/create-requisition" className="btn btn-ghost text-sm">
              Manual PR instead
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
