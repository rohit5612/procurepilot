// Simple client print registry. Later, this can switch by env or tenant.
import PRPrintVRPower from './vr_power/PRPrint.jsx';

export function getPRPrintComponent() {
  // Default client: VR Power Equipments
  return PRPrintVRPower;
}

export default { getPRPrintComponent };

























