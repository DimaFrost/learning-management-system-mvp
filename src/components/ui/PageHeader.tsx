import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  eyebrow?: string;
  description?: string;
  action?: ReactNode;
}

export function PageHeader({ title, eyebrow, description, action }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-2">
        {eyebrow && (
          <p className="tbo-pill bg-white text-[#373734] ring-1 ring-[#e7e6e1]">
            {eyebrow}
          </p>
        )}
        <div className="space-y-1">
          <h2 className="font-serif text-[30px] font-normal leading-[1.2] text-[#121212] sm:text-[36px]">{title}</h2>
          {description && (
            <p className="max-w-2xl text-sm leading-6 text-[#7b7974] sm:text-base">{description}</p>
          )}
        </div>
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}
