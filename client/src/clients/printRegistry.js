import PRPrint from '../components/procurement/PRPrint.jsx';
import POPrint from '../components/procurement/POPrint.jsx';
import GRNPrint from '../components/inventory/GRNPrint.jsx';

export function getPRPrintComponent() {
  return PRPrint;
}

export function getPOPrintComponent() {
  return POPrint;
}

export function getGRNPrintComponent() {
  return GRNPrint;
}

export default { getPRPrintComponent, getPOPrintComponent, getGRNPrintComponent };
