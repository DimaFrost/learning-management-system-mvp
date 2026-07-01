import type { ReactNode } from 'react';

interface ResponsiveTableProps {
  children: ReactNode;
  scrollHint?: boolean;
}

export function ResponsiveTable({ children, scrollHint = true }: ResponsiveTableProps) {
  return (
    <div className="space-y-2">
      {scrollHint && (
        <p className="text-xs text-gray-500 md:hidden">Swipe horizontally to see more →</p>
      )}
      <div className="-mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto">
        {children}
      </div>
    </div>
  );
}
