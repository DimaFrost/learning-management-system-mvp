import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  action?: ReactNode;
}

export function PageHeader({ title, action }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <h2 className="text-xl sm:text-2xl font-bold text-gray-900">{title}</h2>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}
