import type { DocumentProps } from '@react-pdf/renderer';
import { createElement, type ReactElement } from 'react';

import { reportFileName, type StudentReport } from './reportData';

// Builds the PDF and saves it. The PDF library is large, so it's loaded here,
// on the first download, not with the app: teachers who never download never pay for it.
export async function downloadStudentReport(report: StudentReport): Promise<void> {
  const [{ pdf }, { default: StudentReportPdf }] = await Promise.all([
    import('@react-pdf/renderer'),
    import('./StudentReportPdf'),
  ]);

  // pdf() is typed for a bare <Document>; ours returns one, wrapped in a component.
  const element = createElement(StudentReportPdf, {
    report,
  }) as unknown as ReactElement<DocumentProps>;
  const blob = await pdf(element).toBlob();
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = reportFileName(report);
  document.body.append(link);
  link.click();
  link.remove();

  // Freed a moment later: some browsers still read it just after the click.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
