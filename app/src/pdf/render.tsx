import { pdf } from '@react-pdf/renderer';
import { PdfDocument } from './PdfDocument';
import type { PdfDocumentModel } from './model';

/** Renders the PDF. Called in the Web Worker, or on the page as a fallback. */
export function renderPdf(model: PdfDocumentModel): Promise<Blob> {
  return pdf(<PdfDocument model={model} />).toBlob();
}
