import type { Diagram } from '../types/model';
import { downloadBlob, withExtension } from '../exchange/csv';
import { exportFileName } from '../exchange/format';
import type { CourtStyle } from './courtStyle';
import { diagramScene, sceneToSvg, svgToPng } from './primitives';

/** Width of a downloaded PNG; sharp enough to print at A4 width. */
export const PNG_WIDTH = 2000;

/** Downloads one drawing as SVG (vector) or PNG (SPEC.md section 7, "Övrig export"). Returns the file name. */
export async function downloadDiagram(diagram: Diagram, format: 'svg' | 'png', style: CourtStyle, title: string): Promise<string> {
  const scene = diagramScene(diagram, { style });
  const svg = sceneToSvg(scene, PNG_WIDTH, diagram.caption || title);
  const name = withExtension(exportFileName(title), format);
  if (format === 'svg') {
    downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), name);
  } else {
    const height = Math.round((PNG_WIDTH * scene.bounds.height) / scene.bounds.width);
    downloadBlob(await svgToPng(svg, PNG_WIDTH, height), name);
  }
  return name;
}
