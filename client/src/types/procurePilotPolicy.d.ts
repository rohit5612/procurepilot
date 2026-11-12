export type ProcurementCategoryId =
  | 'office'
  | 'mro'
  | 'steel'
  | 'infra'
  | 'electrical'
  | 'ppe'
  | 'other';

export interface PolicyCategoryOption {
  id: ProcurementCategoryId | string;
  label: string;
}

export interface PolicyCatalogData {
  categories: PolicyCategoryOption[];
  role_levels?: Array<{ level: number; label: string; policyHint?: string }>;
  default_role_policy?: Record<string, RolePolicyRecord>;
}

export interface RolePolicyRecord {
  id?: number | null;
  role_level: number;
  max_per_transaction: number | string;
  max_monthly_budget: number | string;
  auto_approve_max_amount?: number | string | null;
  approval_required_above?: number | string | null;
  allowed_categories: ProcurementCategoryId[] | string | unknown;
  auto_approve_categories: ProcurementCategoryId[] | string | unknown;
  notes?: string | null;
  currency?: string;
  source?: string;
}

/** Editable form state (string fields for controlled inputs). */
export interface PolicyFormDraft {
  max_per_transaction: string;
  max_monthly_budget: string;
  auto_approve_max_amount: string;
  approval_required_above: string;
  allowed_categories: ProcurementCategoryId[];
  auto_approve_categories: ProcurementCategoryId[];
  notes: string;
}

export interface PolicyValidationResult {
  valid: boolean;
  errors: Partial<Record<keyof PolicyFormDraft | 'form', string>>;
  warnings: Partial<Record<keyof PolicyFormDraft | 'form', string>>;
}

export interface PolicySavePayload {
  max_per_transaction: number;
  max_monthly_budget: number;
  auto_approve_max_amount: number;
  approval_required_above: number | null;
  allowed_categories: ProcurementCategoryId[];
  auto_approve_categories: ProcurementCategoryId[];
  notes: string;
}

export interface PolicySimulatorOffer {
  id: string;
  price: number;
  delivery_date: string;
}

export interface PolicySimulatorRequest {
  maximum_budget: number;
  delivery_deadline: string;
  procurement_category: ProcurementCategoryId;
}
