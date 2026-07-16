import fs from 'fs';
import path from 'path';
import type { jsPDF } from 'jspdf';

export const PO_PDF_FONT_FAMILY = 'Aptos';

type FontStyle = 'normal' | 'bold' | 'italic';

const FONT_FILES: Record<FontStyle, string> = {
  normal: 'Aptos.ttf',
  bold: 'Aptos-Bold.ttf',
  italic: 'Aptos-Italic.ttf',
};

function aptosFontCandidates(fileName: string): string[] {
  const cwd = process.cwd();
  return [
    path.join(cwd, 'public', 'fonts', 'aptos', fileName),
    `/Applications/Microsoft Excel.app/Contents/Resources/DFonts/${fileName}`,
    `/Applications/Microsoft Word.app/Contents/Resources/DFonts/${fileName}`,
    `C:\\Program Files\\Microsoft Office\\root\\Office16\\DFonts\\${fileName}`,
    `C:\\Program Files (x86)\\Microsoft Office\\root\\Office16\\DFonts\\${fileName}`,
  ];
}

function readFontBase64(fileName: string): string | null {
  for (const candidate of aptosFontCandidates(fileName)) {
    try {
      if (fs.existsSync(candidate)) {
        return fs.readFileSync(candidate).toString('base64');
      }
    } catch {
      /* try next path */
    }
  }
  return null;
}

/** Register Aptos regular / bold / italic on a jsPDF instance. */
export function registerAptosFonts(pdf: jsPDF): boolean {
  const fontList = pdf.getFontList() as Record<string, unknown>;
  if (fontList[PO_PDF_FONT_FAMILY]) return true;

  let registered = 0;
  for (const [style, fileName] of Object.entries(FONT_FILES) as Array<[FontStyle, string]>) {
    const base64 = readFontBase64(fileName);
    if (!base64) continue;
    try {
      pdf.addFileToVFS(fileName, base64);
      pdf.addFont(fileName, PO_PDF_FONT_FAMILY, style);
      registered += 1;
    } catch (error) {
      console.error(`Failed to register Aptos font ${fileName}:`, error);
    }
  }

  return registered > 0;
}

export function setPoPdfFont(
  pdf: jsPDF,
  style: FontStyle,
  fontSize: number,
  aptosAvailable: boolean
): void {
  pdf.setFontSize(fontSize);
  if (aptosAvailable) {
    const resolvedStyle = style === 'bold' || style === 'italic' ? style : 'normal';
    pdf.setFont(PO_PDF_FONT_FAMILY, resolvedStyle);
    return;
  }

  if (style === 'bold') {
    pdf.setFont('helvetica', 'bold');
  } else if (style === 'italic') {
    pdf.setFont('helvetica', 'italic');
  } else {
    pdf.setFont('helvetica', 'normal');
  }
}
