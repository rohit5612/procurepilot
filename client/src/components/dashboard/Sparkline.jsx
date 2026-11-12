import { useMemo } from 'react';
import AgChart from './AgChart';
import { useAgTheme } from '../../hooks/useAgTheme';

const hiddenAxis = {
  label: { enabled: false },
  line: { enabled: false },
  tick: { enabled: false },
  gridLine: { enabled: false }
};

/**
 * @param {{
 *   data: object[];
 *   yKey: string;
 *   name: string;
 *   color: string;
 *   format?: (v: number) => string;
 *   type?: 'area' | 'bar';
 *   height?: number;
 * }} props
 */
export default function Sparkline({ data, yKey, name, color, format = String, type = 'area', height = 44 }) {
  const { chartTheme } = useAgTheme();

  const options = useMemo(
    () => ({
      theme: chartTheme,
      data,
      height,
      padding: { top: 4, right: 0, bottom: 0, left: 0 },
      legend: { enabled: false },
      animation: { enabled: false },
      axes: {
        x: { type: 'category', position: 'bottom', ...hiddenAxis, ...(type === 'bar' ? { paddingInner: 0.3 } : {}) },
        y: { type: 'number', position: 'left', ...hiddenAxis }
      },
      series: [
        type === 'bar'
          ? {
              type: 'bar',
              xKey: 'label',
              yKey,
              yName: name,
              fill: color,
              fillOpacity: 0.85,
              cornerRadius: 2,
              tooltip: {
                renderer: ({ datum }) => ({ heading: datum.label, data: [{ label: name, value: format(datum[yKey]) }] })
              }
            }
          : {
              type: 'area',
              xKey: 'label',
              yKey,
              yName: name,
              fill: color,
              fillOpacity: 0.14,
              stroke: color,
              strokeWidth: 2,
              interpolation: { type: 'smooth', tension: 0.35 },
              marker: { enabled: false },
              tooltip: {
                renderer: ({ datum }) => ({ heading: datum.label, data: [{ label: name, value: format(datum[yKey]) }] })
              }
            }
      ]
    }),
    [chartTheme, data, yKey, name, color, format, type, height]
  );

  return <AgChart options={options} style={{ height, width: '100%' }} />;
}
