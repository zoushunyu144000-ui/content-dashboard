import type { InsightGroupDraft } from '@/lib/research/ai/tasks/insight-merge';
import { canonicalLabel, snakeLabel, titleCaseLabel } from '@/lib/research/labels';

export const MAX_GROUPS_PER_KIND = 8;

export type InsightKind = InsightGroupDraft['kind'];

export interface InsightSourceCount {
  kind: InsightKind;
  label: string;
  count: number;
}

export interface FinalInsightGroup {
  kind: InsightKind;
  label: string;
  summary: string;
  source_labels: string[];
}

const KINDS: InsightKind[] = ['pain_point', 'hook', 'structure', 'emotion', 'topic'];
const ENUM_KINDS = new Set<InsightKind>(['hook', 'structure', 'emotion']);

export function sourceKey(kind: InsightKind, label: string | null | undefined): string | null {
  if (!label) return null;
  if (kind === 'pain_point' || kind === 'topic') return snakeLabel(label);
  const snake = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return snake || null;
}

/** Display label for a cluster. Single enum sources keep the canonical form (how_to → "How-to"). */
export function clusterDisplayLabel(kind: InsightKind, proposed: string, sourceLabels: string[]): string {
  if (sourceLabels.length === 1 && ENUM_KINDS.has(kind)) {
    const canonical = canonicalLabel(sourceLabels[0]);
    if (canonical) return canonical;
  }
  const proposedKey = sourceKey(kind === 'pain_point' || kind === 'topic' ? 'topic' : kind, proposed);
  if (proposedKey === 'other') return 'Other';
  if (proposedKey && ENUM_KINDS.has(kind) && !proposed.includes(' ')) {
    const canonical = canonicalLabel(proposedKey);
    if (canonical) return canonical;
  }
  const raw = proposed.replace(/_/g, ' ');
  const titled = titleCaseLabel(raw);
  return titled.slice(0, 80) || 'Other';
}

/** Videos in the group divided by analyzed videos. The model never supplies this. */
export function groupShare(videoCount: number, analyzedCount: number): number {
  if (!Number.isFinite(videoCount) || !Number.isFinite(analyzedCount) || analyzedCount <= 0 || videoCount <= 0) return 0;
  return videoCount / analyzedCount;
}

export function asNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (value == null || value === '') return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Turn model groups into at most 8 display groups per kind.
 * Every known source label is mapped. Labels the model skipped go to "Other".
 * A missing or empty model response falls back to humanized tag counts, still capped at 8.
 */
export function finalizeInsightGroups(
  counts: InsightSourceCount[],
  modelGroups: InsightGroupDraft[] | null,
): { groups: FinalInsightGroup[]; usedModel: boolean } {
  const byKind = new Map<InsightKind, Map<string, number>>();
  for (const kind of KINDS) byKind.set(kind, new Map());
  for (const item of counts) {
    const key = sourceKey(item.kind, item.label);
    if (!key) continue;
    const map = byKind.get(item.kind);
    if (!map) continue;
    map.set(key, (map.get(key) || 0) + (Number.isFinite(item.count) ? item.count : 0));
  }

  let usedModel = false;
  const groups: FinalInsightGroup[] = [];
  for (const kind of KINDS) {
    const sources = byKind.get(kind) || new Map<string, number>();
    if (sources.size === 0) continue;
    const drafted = modelGroups ? fromModel(kind, sources, modelGroups) : null;
    if (drafted && drafted.claimed > 0) {
      usedModel = true;
      groups.push(...capKind(drafted.groups, sources));
    } else {
      groups.push(...capKind(tagGroups(kind, sources), sources));
    }
  }
  return { groups, usedModel };
}

function fromModel(
  kind: InsightKind,
  sources: Map<string, number>,
  drafts: InsightGroupDraft[],
): { groups: FinalInsightGroup[]; claimed: number } {
  const claimed = new Set<string>();
  const groups: FinalInsightGroup[] = [];
  for (const draft of drafts) {
    if (draft.kind !== kind) continue;
    const labels: string[] = [];
    const rawLabels = Array.isArray(draft.source_labels) ? draft.source_labels : [];
    for (const raw of rawLabels) {
      const key = sourceKey(kind, raw);
      if (!key || !sources.has(key) || claimed.has(key)) continue;
      claimed.add(key);
      labels.push(key);
    }
    if (labels.length === 0) continue;
    groups.push({
      kind,
      label: clusterDisplayLabel(kind, draft.label || '', labels),
      summary: (draft.summary || '').trim().slice(0, 500),
      source_labels: labels,
    });
  }
  const missed = Array.from(sources.keys()).filter((key) => !claimed.has(key));
  if (missed.length > 0) {
    groups.push({ kind, label: 'Other', summary: '', source_labels: missed });
  }
  return { groups, claimed: claimed.size };
}

function tagGroups(kind: InsightKind, sources: Map<string, number>): FinalInsightGroup[] {
  return Array.from(sources.keys()).map((label) => ({
    kind,
    label: clusterDisplayLabel(kind, label, [label]),
    summary: '',
    source_labels: [label],
  }));
}

function weight(group: FinalInsightGroup, sources: Map<string, number>): number {
  return group.source_labels.reduce((sum, label) => sum + (sources.get(label) || 0), 0);
}

function collapseLabels(groups: FinalInsightGroup[]): FinalInsightGroup[] {
  const order: string[] = [];
  const byLabel = new Map<string, FinalInsightGroup>();
  for (const group of groups) {
    const label = group.label.trim() || 'Other';
    const key = label.toLowerCase();
    const existing = byLabel.get(key);
    if (!existing) {
      byLabel.set(key, { ...group, label: key === 'other' ? 'Other' : label, source_labels: group.source_labels.slice() });
      order.push(key);
      continue;
    }
    for (const source of group.source_labels) {
      if (!existing.source_labels.includes(source)) existing.source_labels.push(source);
    }
    if (!existing.summary && group.summary) existing.summary = group.summary;
  }
  return order.map((key) => byLabel.get(key)!).filter((group) => group.source_labels.length > 0);
}

function capKind(groups: FinalInsightGroup[], sources: Map<string, number>): FinalInsightGroup[] {
  const collapsed = collapseLabels(groups);
  const byWeight = (left: FinalInsightGroup, right: FinalInsightGroup) =>
    weight(right, sources) - weight(left, sources) || left.label.localeCompare(right.label);
  if (collapsed.length <= MAX_GROUPS_PER_KIND) return collapsed.slice().sort(byWeight);

  const other = collapsed.find((group) => group.label.toLowerCase() === 'other') || {
    kind: collapsed[0].kind,
    label: 'Other',
    summary: '',
    source_labels: [] as string[],
  };
  const rest = collapsed.filter((group) => group.label.toLowerCase() !== 'other').sort(byWeight);
  const keep = rest.slice(0, MAX_GROUPS_PER_KIND - 1);
  const fold = rest.slice(MAX_GROUPS_PER_KIND - 1);
  const folded = other.source_labels.slice();
  for (const group of fold) {
    for (const source of group.source_labels) {
      if (!folded.includes(source)) folded.push(source);
    }
  }
  const otherGroup: FinalInsightGroup = {
    kind: other.kind,
    label: 'Other',
    summary: other.summary || '',
    source_labels: folded,
  };
  const kept = otherGroup.source_labels.length > 0 ? keep.concat(otherGroup) : keep;
  return kept.sort(byWeight);
}
