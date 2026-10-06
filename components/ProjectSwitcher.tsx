'use client';

import { useProject } from './ProjectProvider';

export default function ProjectSwitcher() {
  const { projects, project, loading, error, setProjectId } = useProject();

  return (
    <label className="block px-2">
      <span className="mb-1 block px-1 text-[10px] font-semibold uppercase tracking-[1.4px] text-muted">
        Project
      </span>
      <select
        value={project?.id || ''}
        onChange={(event) => setProjectId(event.target.value)}
        disabled={loading || projects.length === 0}
        className="field"
        aria-label="Project"
      >
        {loading ? <option value="">Loading…</option> : null}
        {!loading && projects.length === 0 ? <option value="">No projects</option> : null}
        {projects.map((item) => (
          <option key={item.id} value={item.id}>{item.name}</option>
        ))}
      </select>
      {error ? <span className="mt-1 block px-1 text-[11px] text-red">{error}</span> : null}
    </label>
  );
}
