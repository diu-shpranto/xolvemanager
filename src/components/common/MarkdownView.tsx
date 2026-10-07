import React from 'react';

interface MarkdownViewProps {
  content: string;
}

export const MarkdownView: React.FC<MarkdownViewProps> = ({ content }) => {
  // Simple, clean markdown-to-JSX parser for headings, lists, tables, bold, and paragraphs
  const renderFormattedText = (text: string) => {
    // Replace bold **text**
    const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={i} className="font-bold text-slate-900 dark:text-white">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith('*') && part.endsWith('*')) {
        return <em key={i}>{part.slice(1, -1)}</em>;
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code
            key={i}
            className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-purple-600 dark:text-purple-400 font-mono text-[11px]"
          >
            {part.slice(1, -1)}
          </code>
        );
      }
      return part;
    });
  };

  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];

  let inTable = false;
  let tableHeader: string[] = [];
  let tableRows: string[][] = [];

  const flushTable = (key: number) => {
    if (inTable && (tableHeader.length > 0 || tableRows.length > 0)) {
      elements.push(
        <div key={`table-${key}`} className="my-3 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
          <table className="w-full text-left text-xs divide-y divide-slate-200 dark:divide-slate-800">
            {tableHeader.length > 0 && (
              <thead className="bg-slate-50 dark:bg-slate-800/60 font-semibold text-slate-700 dark:text-slate-300">
                <tr>
                  {tableHeader.map((h, hi) => (
                    <th key={hi} className="px-3 py-2 text-xs">
                      {renderFormattedText(h.trim())}
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 bg-white dark:bg-slate-900">
              {tableRows.map((row, ri) => (
                <tr key={ri} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-3 py-2 text-xs text-slate-700 dark:text-slate-300">
                      {renderFormattedText(cell.trim())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      inTable = false;
      tableHeader = [];
      tableRows = [];
    }
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    // Table rows
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      // Check if it's separator row |---|---|
      if (trimmed.includes('---')) {
        inTable = true;
        return;
      }
      const cols = trimmed.slice(1, -1).split('|');
      if (!inTable) {
        inTable = true;
        tableHeader = cols;
      } else {
        tableRows.push(cols);
      }
      return;
    } else if (inTable) {
      flushTable(index);
    }

    if (!trimmed) {
      elements.push(<div key={`space-${index}`} className="h-2" />);
      return;
    }

    if (trimmed.startsWith('### ')) {
      elements.push(
        <h4 key={index} className="text-sm font-bold text-slate-900 dark:text-white mt-3 mb-1">
          {renderFormattedText(trimmed.slice(4))}
        </h4>
      );
    } else if (trimmed.startsWith('## ')) {
      elements.push(
        <h3 key={index} className="text-base font-bold text-slate-900 dark:text-white mt-4 mb-2 pb-1 border-b border-slate-100 dark:border-slate-800">
          {renderFormattedText(trimmed.slice(3))}
        </h3>
      );
    } else if (trimmed.startsWith('# ')) {
      elements.push(
        <h2 key={index} className="text-lg font-bold text-slate-900 dark:text-white mt-4 mb-2">
          {renderFormattedText(trimmed.slice(2))}
        </h2>
      );
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      elements.push(
        <div key={index} className="flex items-start gap-2 my-1 text-xs text-slate-700 dark:text-slate-300 pl-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
          <span>{renderFormattedText(trimmed.slice(2))}</span>
        </div>
      );
    } else if (/^\d+\.\s/.test(trimmed)) {
      const match = trimmed.match(/^(\d+)\.\s(.*)$/);
      if (match) {
        elements.push(
          <div key={index} className="flex items-start gap-2 my-1 text-xs text-slate-700 dark:text-slate-300 pl-1">
            <span className="font-semibold text-emerald-600 dark:text-emerald-400 font-mono text-[11px] shrink-0">
              {match[1]}.
            </span>
            <span>{renderFormattedText(match[2])}</span>
          </div>
        );
      }
    } else {
      elements.push(
        <p key={index} className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed my-1.5">
          {renderFormattedText(trimmed)}
        </p>
      );
    }
  });

  if (inTable) {
    flushTable(lines.length);
  }

  return <div className="space-y-1">{elements}</div>;
};
