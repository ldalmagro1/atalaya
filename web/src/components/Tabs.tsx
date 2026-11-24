import { useId, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';

export interface TabItem {
  id: string;
  label: string;
  content: ReactNode;
}

export function Tabs({ tabs, initialId }: { tabs: TabItem[]; initialId?: string }) {
  const base = useId();
  const [activeId, setActiveId] = useState(initialId ?? tabs[0]?.id);

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next = index;
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    else return;
    event.preventDefault();
    const tab = tabs[next];
    if (!tab) return;
    setActiveId(tab.id);
    document.getElementById(`${base}-tab-${tab.id}`)?.focus();
  };

  return (
    <div>
      <div role="tablist" className="flex gap-1 border-b border-background-300">
        {tabs.map((tab, index) => {
          const selected = tab.id === activeId;
          return (
            <button
              key={tab.id}
              id={`${base}-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`${base}-panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActiveId(tab.id)}
              onKeyDown={(event) => onKeyDown(event, index)}
              className={`-mb-px rounded-t-xl border-b-2 px-4 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 ${
                selected
                  ? 'border-accent-600 font-bold text-text-900'
                  : 'border-transparent text-text-600 hover:bg-background-200'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          id={`${base}-panel-${tab.id}`}
          role="tabpanel"
          aria-labelledby={`${base}-tab-${tab.id}`}
          hidden={tab.id !== activeId}
          className="pt-4"
        >
          {tab.id === activeId ? tab.content : null}
        </div>
      ))}
    </div>
  );
}
