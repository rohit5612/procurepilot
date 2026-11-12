import { query } from '../../database/connection.js';

export class SupplierNotQualifiedError extends Error {
  constructor(message = 'Supplier is not qualified for purchase orders') {
    super(message);
    this.name = 'SupplierNotQualifiedError';
    this.code = 'SUPPLIER_NOT_QUALIFIED';
  }
}

class SupplierQualificationService {
  async assertSupplierQualified(client, supplierId) {
    if (!supplierId) return;
    const runner = client ? client.query.bind(client) : query;
    let rows;
    try {
      ({ rows } = await runner(
        `SELECT id, name, qualification_status, qualified_until
         FROM suppliers WHERE id = $1`,
        [supplierId]
      ));
    } catch (err) {
      if (err.code === '42703') return;
      throw err;
    }
    if (rows.length === 0) throw new Error('Supplier not found');
    const s = rows[0];
    const status = (s.qualification_status || 'qualified').toLowerCase();
    if (status === 'blocked' || status === 'disqualified') {
      throw new SupplierNotQualifiedError(`Supplier "${s.name}" is ${status} and cannot receive POs`);
    }
    if (s.qualified_until) {
      const until = new Date(s.qualified_until);
      if (!Number.isNaN(until.getTime()) && until < new Date()) {
        throw new SupplierNotQualifiedError(`Supplier "${s.name}" qualification expired on ${s.qualified_until}`);
      }
    }
  }
}

export default new SupplierQualificationService();
