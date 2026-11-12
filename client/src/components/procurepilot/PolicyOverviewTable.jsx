import { Pencil, Shield } from 'lucide-react';
import { formatInr, parseCategories } from '../../utils/procurePilotPolicyForm';
import { ROLE_LEVELS } from '../../utils/procurePilotAccess';

/**
 * @typedef {import('../../types/procurePilotPolicy').RolePolicyRecord} RolePolicyRecord
 */

/**
 * @param {{
 *   rows: RolePolicyRecord[];
 *   onEdit: (roleLevel: number) => void;
 * }} props
 */
export default function PolicyOverviewTable({ rows, onEdit }) {
  const byLevel = new Map(rows.map((r) => [Number(r.role_level), r]));

  return (
    <div className="card overflow-hidden">
      <div className="card-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" aria-hidden />
          <div>
            <h3 className="text-base font-semibold text-fg">Role policy matrix</h3>
            <p className="text-xs text-muted">Enforced on every offer comparison and checkout path</p>
          </div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-4 py-3 font-medium">Level</th>
              <th className="px-4 py-3 font-medium">Per transaction</th>
              <th className="px-4 py-3 font-medium">Monthly budget</th>
              <th className="px-4 py-3 font-medium hidden md:table-cell">Segments</th>
              <th className="px-4 py-3 font-medium hidden lg:table-cell">Auto-approve</th>
              <th className="px-4 py-3 font-medium w-[1%]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {ROLE_LEVELS.map((meta) => {
              const row = byLevel.get(meta.level);
              const allowed = parseCategories(row?.allowed_categories);
              const auto = parseCategories(row?.auto_approve_categories);
              return (
                <tr
                  key={meta.level}
                  className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-fg">L{meta.level}</div>
                    <div className="text-xs text-muted max-w-[12rem]">{meta.label.replace(/^L\d+\s*—\s*/, '')}</div>
                  </td>
                  <td className="px-4 py-3 tabular-nums">{formatInr(row?.max_per_transaction)}</td>
                  <td className="px-4 py-3 tabular-nums">{formatInr(row?.max_monthly_budget)}</td>
                  <td className="px-4 py-3 hidden md:table-cell text-muted">
                    {allowed.length ? `${allowed.length} segment${allowed.length === 1 ? '' : 's'}` : '—'}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-muted">
                    {auto.length ? auto.join(', ') : 'None'}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm inline-flex items-center gap-1.5"
                      onClick={() => onEdit(meta.level)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
