/**
 * Non-routable demo contact values for seeds and test scripts.
 * PO issue does not email suppliers; auth/notification mail respects EMAIL_ENABLED.
 */
export const DEMO_SUPPLIER_EMAIL_DOMAIN = 'mail.procurepilot.test';

export const DEMO_SUPPLIER_CONTACTS = {
  'SUP-RJ-ELC': { email: 'sup-rj-elc@mail.procurepilot.test', phone: '9000000001' },
  'SUP-DL-SAF': { email: 'sup-dl-saf@mail.procurepilot.test', phone: '9000000002' },
  'SUP-IN-MRO': { email: 'sup-in-mro@mail.procurepilot.test', phone: '9000000003' }
};

/** Optional single inbox when normalizing all suppliers (see scripts/set_supplier_test_contacts.sql). */
export const DEMO_SUPPLIER_INBOX = 'suppliers@mail.procurepilot.test';
export const DEMO_SUPPLIER_PHONE = '9000000099';

export const DEMO_SITE_CONTACTS = {
  'PP-JAI-01': { email: 'site-jai@mail.procurepilot.test', phone: '9000000101' },
  'PP-DEL-01': { email: 'site-del@mail.procurepilot.test', phone: '9000000102' }
};

export const DEMO_WAREHOUSE_CONTACTS = {
  'WH-JAI-01': { email: 'wh-jai@mail.procurepilot.test', phone: '9000000201' },
  'WH-DEL-01': { email: 'wh-del@mail.procurepilot.test', phone: '9000000202' }
};
