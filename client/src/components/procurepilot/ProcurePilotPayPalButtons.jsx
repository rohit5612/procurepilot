import { useMemo, useRef, useState } from 'react';
import { PayPalButtons, PayPalScriptProvider } from '@paypal/react-paypal-js';
import { procurePilotPayPalApi } from '../../utils/api';

/**
 * @param {{
 *   clientId: string;
 *   currency?: string;
 *   mode?: string;
 *   purchaseRequestId: number;
 *   offerId: string;
 *   disabled?: boolean;
 *   onPaid?: (payload: object) => void;
 *   onError?: (message: string) => void;
 * }} props
 */
export default function ProcurePilotPayPalButtons({
  clientId,
  currency = 'USD',
  mode = 'sandbox',
  purchaseRequestId,
  offerId,
  disabled,
  onPaid,
  onError
}) {
  const creatingRef = useRef(false);
  const [statusNote, setStatusNote] = useState('');

  const options = useMemo(
    () => ({
      clientId,
      currency,
      intent: 'capture',
      components: 'buttons',
      // Helps sandbox popups; harmless in sandbox mode with sandbox client id
      'data-page-type': 'checkout'
    }),
    [clientId, currency]
  );

  if (!clientId) {
    return (
      <p className="text-sm text-muted">
        PayPal client ID missing. Set <code className="text-xs">VITE_PAYPAL_CLIENT_ID</code> and enable PayPal on the
        server.
      </p>
    );
  }

  const handleCreateOrder = async () => {
    if (creatingRef.current) {
      throw new Error('PayPal order already in progress');
    }
    creatingRef.current = true;
    setStatusNote('Creating order…');
    try {
      const res = await procurePilotPayPalApi.createOrder({
        purchase_request_id: purchaseRequestId,
        offer_id: offerId
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || json.error || 'Could not create PayPal order');
      }
      const orderId = json.data?.id || json.data?.orderId;
      if (!orderId) throw new Error('Server did not return a PayPal order id');
      setStatusNote('');
      return orderId;
    } catch (e) {
      setStatusNote('');
      throw e;
    } finally {
      creatingRef.current = false;
    }
  };

  const handleCapture = async (data) => {
    setStatusNote('Capturing payment…');
    try {
      const res = await procurePilotPayPalApi.capture({ orderId: data.orderID });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || json.error || 'Capture failed');
      setStatusNote('');
      onPaid?.(json.data);
    } catch (e) {
      setStatusNote('');
      throw e;
    }
  };

  return (
    <div className="space-y-3">
      {mode === 'sandbox' && (
        <div className="text-xs text-muted leading-relaxed rounded-lg border border-border bg-muted/40 px-3 py-2">
          <strong className="text-fg font-medium">Sandbox checkout</strong>
          <ul className="mt-1.5 list-disc pl-4 space-y-0.5">
            <li>
              Use the app at the same origin you signed in from (e.g.{' '}
              <strong>localhost:5173</strong> or{' '}
              <strong>procurepilot-01w3.onrender.com</strong>) — not 127.0.0.1.
            </li>
            <li>
              Log in with a <strong>Sandbox personal (buyer)</strong> account from{' '}
              <a href="https://developer.paypal.com/dashboard/accounts" className="text-primary underline" target="_blank" rel="noreferrer">
                PayPal Developer → Accounts
              </a>
              , not your real PayPal login.
            </li>
            <li>Temporarily disable ad blockers / privacy extensions on this tab if the popup fails.</li>
          </ul>
        </div>
      )}
      {statusNote && <p className="text-xs text-muted">{statusNote}</p>}
      <PayPalScriptProvider options={options} deferLoading={false}>
        <PayPalButtons
          disabled={disabled}
          style={{ layout: 'vertical', shape: 'rect', label: 'pay', height: 45 }}
          createOrder={handleCreateOrder}
          onApprove={handleCapture}
          onCancel={() => setStatusNote('Payment cancelled.')}
          onError={(err) => {
            const msg =
              err?.message ||
              (typeof err === 'string' ? err : null) ||
              'PayPal checkout error — try sandbox buyer login or refresh the page.';
            setStatusNote('');
            onError?.(msg);
          }}
        />
      </PayPalScriptProvider>
    </div>
  );
}
