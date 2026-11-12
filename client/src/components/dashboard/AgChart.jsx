import { AllCommunityModule, ModuleRegistry } from 'ag-charts-community';
import { AgCharts } from 'ag-charts-react';

ModuleRegistry.registerModules([AllCommunityModule]);

/** AG Charts wrapper that guarantees community modules are registered before first render. */
export default function AgChart(props) {
  return <AgCharts {...props} />;
}
