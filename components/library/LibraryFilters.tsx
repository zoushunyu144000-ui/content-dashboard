'use client';

import { useState } from 'react';
import {
  LIBRARY_FILTERS,
  LIBRARY_FILTER_PARAMS,
  facetOptions,
  labelOf,
  type LibraryFacets,
  type LibraryFilterParam,
} from './shared';

interface LibraryFiltersProps {
  values: Record<LibraryFilterParam, string>;
  facets: LibraryFacets;
  onChange: (key: LibraryFilterParam, value: string) => void;
  onClear: () => void;
}

const selectClass = 'mt-1 w-full rounded-lg border border-border bg-surface px-2 py-2 text-base text-cream outline-none md:py-1.5 md:text-[13px]';

export default function LibraryFilters({ values, facets, onChange, onClear }: LibraryFiltersProps) {
  const [open, setOpen] = useState(false);
  const active = LIBRARY_FILTER_PARAMS.filter((key) => values[key]).length;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2 md:hidden">
        <button
          type="button"
          className="btn-ghost"
          aria-expanded={open}
          aria-controls="library-filters"
          onClick={() => setOpen((current) => !current)}
        >
          {open ? '收起筛选' : '筛选'}{active > 0 ? `（${active}）` : ''}
        </button>
        {active > 0 ? (
          <button type="button" className="text-[12px] text-muted hover:text-cream" onClick={onClear}>
            清除筛选
          </button>
        ) : null}
      </div>
      <div id="library-filters" className={`${open ? 'grid' : 'hidden'} grid-cols-2 gap-2 md:grid md:grid-cols-4 xl:grid-cols-5`}>
        {LIBRARY_FILTERS.map((filter) => {
          const selected = values[filter.param];
          const options = facetOptions(filter.labels, facets[filter.facet], selected);
          return (
            <label key={filter.param} className="block text-[11px] text-muted">
              {filter.label}
              <select
                className={selectClass}
                value={selected}
                onChange={(event) => onChange(filter.param, event.target.value)}
              >
                <option value="">全部</option>
                {options.map((option) => (
                  <option key={option.key} value={option.key}>
                    {labelOf(filter.labels, option.key)}
                    {option.count == null ? '' : `（${option.count}）`}
                  </option>
                ))}
              </select>
            </label>
          );
        })}
        <label className="block text-[11px] text-muted">
          分析
          <select
            className={selectClass}
            value={values.analyzed}
            onChange={(event) => onChange('analyzed', event.target.value)}
          >
            <option value="">全部</option>
            <option value="yes">已分析</option>
            <option value="no">未分析</option>
          </select>
        </label>
        <label className="flex items-center gap-2 self-end rounded-lg border border-border px-2 py-2 text-[13px] text-cream md:py-1.5">
          <input
            type="checkbox"
            className="h-4 w-4 accent-[var(--accent)]"
            checked={values.high_potential === '1'}
            onChange={(event) => onChange('high_potential', event.target.checked ? '1' : '')}
          />
          仅高潜力
        </label>
        {active > 0 ? (
          <button type="button" className="btn-ghost hidden self-end md:inline-flex" onClick={onClear}>
            清除筛选
          </button>
        ) : null}
      </div>
    </div>
  );
}
