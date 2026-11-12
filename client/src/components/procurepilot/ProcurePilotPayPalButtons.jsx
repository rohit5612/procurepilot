import { useMemo } from 'react';
import { PayPalButtons, PayPalScriptProvider } from '@paypal/react-paypal-js';
import { procurePilotPayPalApi } from '../../utils/api';

/**
 * @param {{
 *   clientId: string;
 *   currency?: string;
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
  purchaseRequestId,
  offerId,
  disabled,
  onPaid,
  onError
}) {
  const options = useMemo(
    () => ({
      clientId,
      currency,
      intent: 'capture',
      components: 'buttons'
    }),
    [clientId, currency]
  );

  if (!clientId) {
    return (
      <p className="text-sm text-muted">
        PayPal client ID missing. Set <code className="text-xs">VITE_PAYPAL_CLIENT_ID</code> and enable PayPal on the server.
      </p>
    );
  }

  return (
    <PayPalScriptProvider options={options}>
      <PayPalButtons
        disabled={disabled}
        style={{ layout: 'vertical', shape: 'rect', label: 'pay' }}
        createOrder={async () => {
          const res = await procurePilotPayPalApi.createOrder({
            purchase_request_id: purchaseRequestId,
            offer_id: offerId
          });
          const json = await res.json();
          if (!res.ok) throw new Error(json.message || 'Could not create PayPal order');
          return json.data.id;
        }}
        onApprove={async (data) => {
          const res = await procurePilotPayPalApi.capture({ orderId: data.orderID });
          const json = await res.json();
          if (!res.ok) throw new Error(json.message || 'Capture failed');
          onPaid?.(json.data);
        }}
        onError={(err) => onError?.(err?.message || 'PayPal error')}
      />
    </PayPalScriptProvider>
  );
}
