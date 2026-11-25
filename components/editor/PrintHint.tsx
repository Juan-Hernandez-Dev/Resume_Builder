/**
 * The print dialog settings that make its PDF match the preview. Shown next
 * to Export PDF in the web build, where the dialog is the export, and in the
 * local app when direct export failed and the dialog is the way out.
 */
export function PrintHint({ className = "" }: { className?: string }) {
  return (
    <p className={className}>
      Chrome: Print &gt; Save as PDF, Margins: None, Background graphics off,
      Headers and footers off.
    </p>
  );
}
