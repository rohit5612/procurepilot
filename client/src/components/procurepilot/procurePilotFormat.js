export function formatInr(v) {
  if (v == null || v === '') return '—';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(
    Number(v)
  );
}

export function rolePolicyLabel(roleLevel, isSuperuser) {
  if (isSuperuser) return 'L1 org admin (superuser)';
  if (roleLevel != null) return `L${roleLevel} policy`;
  return 'Default policy';
}
