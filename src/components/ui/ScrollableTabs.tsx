import type { ReactNode } from 'react';

export interface ScrollableTab {
  id: string;
  label: string;
  icon?: ReactNode;
}

interface ScrollableTabsProps {
  tabs: ScrollableTab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  ariaLabel?: string;
  activeClassName?: string;
  inactiveClassName?: string;
}

export function ScrollableTabs({
  tabs,
  activeTab,
  onTabChange,
  ariaLabel = 'Tabs',
  activeClassName = 'border-blue-500 text-blue-600',
  inactiveClassName = 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
}: ScrollableTabsProps) {
  return (
    <div className="border-b border-gray-200 -mx-4 px-4 sm:mx-0 sm:px-0">
      <nav
        className="-mb-px flex gap-4 sm:gap-6 overflow-x-auto scrollbar-hide"
        aria-label={ariaLabel}
      >
        {tabs.map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={`flex items-center gap-2 py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap shrink-0 transition-colors ${
              activeTab === tab.id ? activeClassName : inactiveClassName
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
