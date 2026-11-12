import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  CreditCard,
  Loader2,
  Sparkles,
  Wand2,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Search,
  Radio,
  ChevronRight
} from 'lucide-react';
import PageToolbar from '../../components/layout/PageToolbar';
import OfferCompareGrid from '../../components/procurepilot/OfferCompareGrid';
import OfferCompareCards from '../../components/procurepilot/OfferCompareCards';
import Channel3PreviewPanel from '../../components/procurepilot/Channel3PreviewPanel';
import OfferDetailCard from '../../components/procurepilot/OfferDetailCard';
import ProcurePilotPayPalButtons from '../../components/procurepilot/ProcurePilotPayPalButtons';
import SpendSnapshotPanel from '../../components/procurepilot/SpendSnapshotPanel';
import PolicyCompareSummary from '../../components/procurepilot/PolicyCompareSummary';
import AiBuyPolicyContext from '../../components/procurepilot/AiBuyPolicyContext';
import { procurePilotAiBuyApi } from '../../utils/api';
import { usePermissions } from '../../hooks/usePermissions';

const STEPS = [
  { id: 'describe', label: 'Describe' },
  { id: 'confirm', label: 'Confirm' },
  { id: 'compare', label: 'Compare' },
  { id: 'checkout', label: 'Checkout' }
];

const EXAMPLE_PROMPTS = [
  '12 ergonomic office chairs for Jaipur office, budget ₹80,000, delivery in 2 weeks.',
  'Industrial MRO: 200 nitrile gloves and 50 safety goggles, ship to Delhi NCR.',
  '5 laptops for managers, max ₹6,00,000 total, need delivery by month end.'
];

function formatInr(v) {
  if (v == null || v === '') return '—';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(
    Number(v)
  );
}

function StepIndicator({ step }) {
  return (
    <nav aria-label="Progress" className="flex flex-wrap items-center gap-2">
      {STEPS.map((s, i) => {
        const done = i < step;
        const active = i === step;
        return (
          <div key={s.id} className="flex items-center gap-2">
            {i > 0 && <ChevronRight className="h-4 w-4 text-muted hidden sm:block" aria-hidden />}
            <span
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                active
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : done
                    ? 'bg-secondary text-secondary-foreground'
                    : 'border border-border text-muted'
              }`}
            >
              <span
                className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] ${
                  active ? 'bg-primary-foreground/20' : done ? 'bg-fg/10' : 'bg-muted'
                }`}
              >
                {done ? '✓' : i + 1}
              </span>
              {s.label}
            </span>
          </div>
        );
      })}
    </nav>
  );
}

function IntegrationsCard({ llmStatus, paypalEnabled, paypalConfig, channel3Status }) {
  return (
    <div className="page-panel p-4 space-y-3 text-sm">
      <h3 className="font-semibold text-fg text-sm">Connected services</h3>
      <ul className="space-y-2 text-xs">
        <li className="flex justify-between gap-2">
          <span className="text-muted">AI extraction</span>
          <span className={llmStatus?.ok ? 'text-emerald-700' : 'text-amber-800'}>
            {llmStatus?.provider || '—'} {llmStatus?.ok ? '· ready' : '· check env'}
          </span>
        </li>
        <li className="flex justify-between gap-2">
          <span className="text-muted">Channel3</span>
          <span className={channel3Status?.enabled ? 'text-emerald-700' : 'text-muted'}>
            {channel3Status?.enabled ? 'Live search' : 'Off / demo offers'}
          </span>
        </li>
        <li className="flex justify-between gap-2">
          <span className="text-muted">PayPal</span>
          <span className={paypalEnabled ? 'text-sky-800' : 'text-muted'}>
            {paypalEnabled ? paypalConfig?.mode || 'sandbox' : 'Disabled'}
          </span>
        </li>
      </ul>
    </div>
  );
}

export default function AiBuyPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { hasPermission } = usePermissions();
  const canSubmitPr = hasPermission('procurepilot.ai_buy.submit');
  const [step, setStep] = useState(0);
  const [text, setText] = useState(EXAMPLE_PROMPTS[0]);
  const [draft, setDraft] = useState(null);
  const [extractMeta, setExtractMeta] = useState(null);
  const [compareResult, setCompareResult] = useState(null);
  const [selectedOfferId, setSelectedOfferId] = useState(null);
  const [focusedRow, setFocusedRow] = useState(null);
  const [flowStatus, setFlowStatus] = useState(null);
  const [llmStatus, setLlmStatus] = useState(null);
  const [paypalConfig, setPaypalConfig] = useState(null);
  const [channel3Status, setChannel3Status] = useState(null);
  const [activitySnapshot, setActivitySnapshot] = useState(null);
  const [purchaseRequestId, setPurchaseRequestId] = useState(null);
  const [paymentSuccess, setPaymentSuccess] = useState(null);
  const [prCreated, setPrCreated] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [c3Preview, setC3Preview] = useState({ offers: [], meta: null, error: '', loading: false });
  const [showC3Preview, setShowC3Preview] = useState(false);

  const paypalClientId = useMemo(
    () => import.meta.env.VITE_PAYPAL_CLIENT_ID || paypalConfig?.clientId || '',
    [paypalConfig]
  );
  const paypalEnabled =
    import.meta.env.VITE_PAYPAL_ENABLED === 'true' ||
    (paypalConfig?.enabled && Boolean(paypalClientId));

  const channel3Live = channel3Status?.enabled === true;

  const loadStatus = useCallback(async () => {
    try {
      const res = await procurePilotAiBuyApi.getStatus();
      const json = await res.json();
      if (res.ok) {
        setFlowStatus(json.data);
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
    (async () => {
      try {
        const res = await procurePilotAiBuyApi.getActivity();
        const json = await res.json();
        if (res.ok) setActivitySnapshot(json.data);
      } catch {
        /* ignore */
      }
    })();
  }, [compareResult]);

  useEffect(() => {
    if (searchParams.get('paypal') === 'success') {
      setPaymentSuccess({ message: 'Payment completed — thank you.' });
    }
  }, [searchParams]);

  const runExtract = async () => {
    setLoading(true);
    setError('');
    setC3Preview({ offers: [], meta: null, error: '', loading: false });
    setShowC3Preview(false);
    try {
      const res = await procurePilotAiBuyApi.extract(text);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || json.message || 'Extraction failed');
      const fields = json.data;
      if (!fields?.item) throw new Error('Could not determine an item — try adding quantity and product name.');
      setDraft(fields);
      setExtractMeta(json.meta || null);
      setStep(1);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const runChannel3Preview = async () => {
    if (!draft?.item) {
      setError('Fill in at least an item description before previewing.');
      return;
    }
    setShowC3Preview(true);
    setC3Preview((p) => ({ ...p, loading: true, error: '' }));
    try {
      const res = await procurePilotAiBuyApi.previewChannel3(draft);
      const json = await res.json();
      const data = json.data || json;
      if (!res.ok && !data?.offers?.length) {
        throw new Error(json.message || data?.error || 'Preview failed');
      }
      setC3Preview({
        offers: data.offers || [],
        meta: data.meta,
        error: data.offers?.length ? '' : data.error || json.message || '',
        loading: false
      });
    } catch (e) {
      setC3Preview({ offers: [], meta: null, error: e.message, loading: false });
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
      const rec = json.data.policy?.recommended_offer_id;
      setSelectedOfferId(rec || null);
      setFocusedRow(null);
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

  const focusedOffer = useMemo(() => {
    if (!compareResult?.offers) return selectedOffer;
    const id = focusedRow?.id ?? selectedOfferId;
    return compareResult.offers.find((o) => String(o.id) === String(id)) || selectedOffer;
  }, [compareResult, focusedRow, selectedOfferId, selectedOffer]);

  const handleOfferFocus = (row) => {
    const full = compareResult?.offers?.find((o) => String(o.id) === String(row?.id));
    setFocusedRow(full || row);
  };

  const focusedPolicy = useMemo(() => {
    if (!focusedOffer || !compareResult?.policy?.offers) return null;
    return compareResult.policy.offers.find((p) => String(p.offer_id) === String(focusedOffer.id));
  }, [focusedOffer, compareResult]);

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
    <div className="max-w-7xl mx-auto space-y-6 pb-10">
      <PageToolbar description="Turn plain-language needs into policy-checked offers — compare, approve, or pay.">
        <StepIndicator step={step} />
      </PageToolbar>

      <div className="grid lg:grid-cols-[1fr_minmax(260px,300px)] gap-6 items-start">
        <div className="space-y-4 min-w-0">
          {error && (
            <div className="page-panel p-4 text-sm text-destructive flex gap-2 items-start" role="alert">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          {step === 0 && (
            <section className="space-y-4" aria-labelledby="ai-buy-describe">
              <div className="page-panel p-6 flex gap-4 bg-gradient-to-br from-card to-primary/5">
                <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shrink-0 shadow-sm">
                  <Sparkles className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h2 id="ai-buy-describe" className="text-lg font-semibold text-fg">
                    What do you need to buy?
                  </h2>
                  <p className="text-sm text-muted mt-1 leading-relaxed">
                    Describe quantity, location, budget, and timing. We structure the request and run spend policy before checkout.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {EXAMPLE_PROMPTS.map((ex) => (
                  <button
                    key={ex.slice(0, 24)}
                    type="button"
                    className="text-xs px-3 py-1.5 rounded-full border border-border hover:border-primary/50 hover:bg-primary/5 transition-colors text-left max-w-full truncate"
                    onClick={() => setText(ex)}
                  >
                    {ex.length > 56 ? `${ex.slice(0, 56)}…` : ex}
                  </button>
                ))}
              </div>

              <label className="block page-panel p-5">
                <span className="text-sm font-medium text-fg flex items-center gap-2 mb-3">
                  <Wand2 size={16} className="text-primary" />
                  Your request
                </span>
                <textarea
                  className="input min-h-[140px] resize-y bg-card text-sm leading-relaxed w-full"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="e.g. 50 Allen keys for warehouse, budget ₹12,000…"
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
            </section>
          )}

          {step === 1 && draft && (
            <section className="space-y-4">
              <div className="page-panel p-6 space-y-4">
                <div>
                  <h3 className="font-semibold text-fg">Confirm requirements</h3>
                  <p className="text-xs text-muted mt-1">
                    Edit fields before policy comparison. Caps below are enforced server-side on every offer.
                  </p>
                  {extractMeta?.source && extractMeta.source !== 'llm' && (
                    <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-2">
                      Filled using backup rules
                      {extractMeta.llm_error ? ` (model: ${extractMeta.llm_error.slice(0, 80)}…)` : ''}. You can edit any
                      field.
                    </p>
                  )}
                </div>
                {flowStatus?.policy_context && (
                  <AiBuyPolicyContext
                    policy={{
                      ...flowStatus.policy_context,
                      is_superuser: flowStatus.policy_context.is_superuser
                    }}
                    ledger={activitySnapshot?.ledger}
                    compact
                  />
                )}
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
                    <span className="form-label">Category</span>
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
                    <span className="form-label">Delivery location</span>
                    <input
                      className="input w-full"
                      value={draft.delivery_location || ''}
                      onChange={(e) => updateDraft('delivery_location', e.target.value)}
                    />
                  </label>
                </div>
                <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
                  <button type="button" className="btn btn-secondary" onClick={() => setStep(0)} disabled={loading}>
                    Back
                  </button>
                  <button type="button" className="btn btn-primary inline-flex items-center gap-2" onClick={runCompare} disabled={loading}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                    Run policy compare
                  </button>
                  {channel3Live && (
                    <button
                      type="button"
                      className="btn btn-secondary inline-flex items-center gap-2"
                      onClick={runChannel3Preview}
                      disabled={c3Preview.loading}
                    >
                      {c3Preview.loading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Search className="h-4 w-4" />
                      )}
                      Preview Channel3 listings
                    </button>
                  )}
                </div>
              </div>

              {showC3Preview && (
                <div className="page-panel p-5 space-y-3">
                  <h4 className="text-sm font-semibold text-fg flex items-center gap-2">
                    <Radio className="h-4 w-4 text-primary" />
                    Channel3 recommendations (preview only)
                  </h4>
                  <p className="text-xs text-muted">
                    Not policy-filtered yet. Run &quot;Run policy compare&quot; to score offers against your spend caps.
                  </p>
                  <Channel3PreviewPanel
                    offers={c3Preview.offers}
                    meta={c3Preview.meta}
                    loading={c3Preview.loading}
                    error={c3Preview.error}
                  />
                </div>
              )}
            </section>
          )}

          {step === 2 && compareResult && (
            <section className="space-y-5">
              <div className="flex flex-wrap gap-2 text-xs">
                {compareResult.offer_source === 'channel3' && (
                  <span className="px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-900 border border-indigo-200">
                    Source: Channel3
                  </span>
                )}
                {compareResult.demo_data && (
                  <span className="px-2.5 py-1 rounded-full bg-muted text-muted border border-border">Demo catalog</span>
                )}
                {compareResult.explanation_source === 'llm' && (
                  <span className="px-2.5 py-1 rounded-full bg-violet-50 text-violet-900 border border-violet-200">
                    AI narrative
                  </span>
                )}
              </div>

              <PolicyCompareSummary
                draft={draft}
                compareResult={compareResult}
                activityPolicy={{
                  role_level: activitySnapshot?.role_level,
                  is_superuser: activitySnapshot?.is_superuser,
                  max_per_transaction: compareResult.policy?.effective_policy?.max_per_transaction,
                  max_monthly_budget: compareResult.policy?.effective_policy?.max_monthly_budget
                }}
                activityLedger={activitySnapshot?.ledger}
              />

              <div className="page-panel p-4 sm:p-5 space-y-4">
                <h3 className="font-semibold text-fg text-sm">Pick an offer</h3>
                <OfferCompareCards
                  offers={compareResult.offers}
                  policyOffers={compareResult.policy?.offers || []}
                  recommendedOfferId={compareResult.policy?.recommended_offer_id}
                  selectedId={selectedOfferId}
                  maxPerTransaction={compareResult.policy?.effective_policy?.max_per_transaction}
                  onSelect={(row) => setSelectedOfferId(row.id)}
                  onFocus={handleOfferFocus}
                />
                <div>
                  <p className="text-xs font-medium text-muted uppercase tracking-wide mb-2">Full comparison table</p>
                  <OfferCompareGrid
                    offers={compareResult.offers}
                    policyOffers={compareResult.policy?.offers || []}
                    recommendedOfferId={compareResult.policy?.recommended_offer_id}
                    selectedId={selectedOfferId}
                    onSelect={(row) => setSelectedOfferId(row.id)}
                    onFocus={handleOfferFocus}
                  />
                </div>
              </div>

              <div className="grid xl:grid-cols-[1fr_300px] gap-4 items-start">
                <div className="page-panel p-5 space-y-3">
                  <h3 className="font-semibold text-fg text-sm">Why this ranking?</h3>
                  <p className="text-sm text-fg/90 whitespace-pre-wrap leading-relaxed border-l-2 border-primary/40 pl-4">
                    {compareResult.explanation}
                  </p>
                  {compareResult.policy?.approval?.required && (
                    <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                      Approval required ({compareResult.policy.approval.reason}) before checkout.
                    </p>
                  )}
                </div>
                <div className="space-y-2 xl:sticky xl:top-4">
                  <p className="text-xs font-medium text-muted uppercase tracking-wide">Listing detail</p>
                  <OfferDetailCard
                    offer={focusedOffer}
                    policy={focusedPolicy}
                    recommended={focusedOffer?.id === compareResult.policy?.recommended_offer_id}
                  />
                </div>
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
            </section>
          )}

          {step === 3 && compareResult && (
            <section className="space-y-4">
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

              <div className="grid md:grid-cols-2 gap-4">
                <div className="page-panel p-6 space-y-4">
                  <h3 className="font-semibold text-fg flex items-center gap-2">
                    <CreditCard size={18} />
                    Checkout
                  </h3>
                  {selectedOffer ? (
                    <OfferDetailCard
                      offer={selectedOffer}
                      policy={compareResult.policy?.offers?.find(
                        (p) => String(p.offer_id) === String(selectedOffer.id)
                      )}
                      recommended
                    />
                  ) : (
                    <p className="text-sm text-muted">No offer selected.</p>
                  )}

                  {compareResult.policy?.approval?.required ? (
                    <div className="space-y-3">
                      <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                        Policy requires approval before payment ({compareResult.policy.approval.reason}). Convert this session into a PR.
                      </p>
                      {canSubmitPr && purchaseRequestId && (
                        <button
                          type="button"
                          className="btn btn-primary w-full"
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
                            PayPal charges in {paypalConfig?.currency || 'USD'} (INR amounts converted server-side for sandbox).
                          </p>
                          <ProcurePilotPayPalButtons
                            clientId={paypalClientId}
                            currency={paypalConfig?.currency || 'USD'}
                            mode={paypalConfig?.mode || 'sandbox'}
                            purchaseRequestId={purchaseRequestId}
                            offerId={String(selectedOfferId)}
                            onPaid={(data) =>
                              setPaymentSuccess({
                                message: data.purchase_order?.po_number
                                  ? `Payment captured — direct PO ${data.purchase_order.po_number} created.`
                                  : `Order ${data.orderId} captured.`,
                                ...data
                              })
                            }
                            onError={(msg) => setError(msg)}
                          />
                        </>
                      ) : !purchaseRequestId ? (
                        <p className="text-sm text-muted">
                          Enable <code className="text-xs">PROCUREPILOT_PERSIST_AI_BUY=true</code> on the server for checkout sessions.
                        </p>
                      ) : (
                        <p className="text-sm text-muted">Configure PayPal env vars to enable payment buttons.</p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn btn-secondary" onClick={() => setStep(2)}>
                  Back to compare
                </button>
                <Link to="/procurement/pr/create-requisition" className="btn btn-ghost text-sm">
                  Manual PR instead
                </Link>
              </div>
            </section>
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-4">
          <IntegrationsCard
            llmStatus={llmStatus}
            paypalEnabled={paypalEnabled}
            paypalConfig={paypalConfig}
            channel3Status={channel3Status}
          />
          <SpendSnapshotPanel />
        </aside>
      </div>
    </div>
  );
}
