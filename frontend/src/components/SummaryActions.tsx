import { useState } from 'react';
import { Check, Copy, Download } from 'lucide-react';

interface Props {
  /** The rendered markdown, exactly as it was stored. */
  text: string;
  activityName: string;
  onError: (message: string) => void;
}

/**
 * Copy and download for a stored summary.
 *
 * Shared by both workflows so the file they hand in has the same name shape
 * and the same contents as the record kept on the server.
 */
export default function SummaryActions({ text, activityName, onError }: Props) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      onError('Your browser would not let the page copy to the clipboard');
    }
  };

  const download = () => {
    const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${activityName.replace(/[^\w-]+/g, '-')}-summary.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex gap-2 shrink-0">
      <button
        type="button"
        onClick={() => void copy()}
        className="btn btn-quiet px-3 py-1.5"
      >
        {copied ? (
          <Check className="h-4 w-4 text-blue-600" />
        ) : (
          <Copy className="h-4 w-4" />
        )}
        {copied ? 'Copied' : 'Copy'}
      </button>
      <button
        type="button"
        onClick={download}
        className="btn btn-quiet px-3 py-1.5"
      >
        <Download className="h-4 w-4" />
        Download
      </button>
    </div>
  );
}
