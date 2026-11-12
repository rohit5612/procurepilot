/**
 * @typedef {import('../types/procurePilotPolicy').PolicyCatalogData} PolicyCatalogData
 * @typedef {import('../types/procurePilotPolicy').RolePolicyRecord} RolePolicyRecord
 * @typedef {import('../types/procurePilotPolicy').PolicySavePayload} PolicySavePayload
 */

import { procurePilotPolicyApi } from '../utils/api';

export class PolicyApiError extends Error {
  /**
   * @param {string} message
   * @param {number} [status]
   */
  constructor(message, status) {
    super(message);
    this.name = 'PolicyApiError';
    this.status = status;
  }
}

/**
 * @template T
 * @param {Response} res
 * @returns {Promise<T>}
 */
async function parseJsonResponse(res) {
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new PolicyApiError(json.message || json.error || 'Request failed', res.status);
  }
  return json;
}

/**
 * @returns {Promise<{ catalog: PolicyCatalogData; rolePolicies: RolePolicyRecord[] }>}
 */
export async function loadPolicyAdminData() {
  const [catRes, rolesRes] = await Promise.all([
    procurePilotPolicyApi.getCatalog(),
    procurePilotPolicyApi.listRolePolicies()
  ]);
  const catJson = await parseJsonResponse(catRes);
  const rolesJson = await parseJsonResponse(rolesRes);
  return {
    catalog: catJson.data || { categories: [] },
    rolePolicies: rolesJson.data || []
  };
}

/**
 * @param {number} roleLevel
 * @param {PolicySavePayload} payload
 */
export async function saveRolePolicy(roleLevel, payload) {
  const res = await procurePilotPolicyApi.updateRolePolicy(roleLevel, payload);
  const json = await parseJsonResponse(res);
  return json.data;
}

/**
 * @param {{ request: object; offers: object[] }} body
 */
export async function evaluatePolicy(body) {
  const res = await procurePilotPolicyApi.evaluate(body);
  const json = await parseJsonResponse(res);
  return json.data;
}
