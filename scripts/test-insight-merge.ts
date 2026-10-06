import { PROMPT_VERSION } from '../lib/research/ai/tasks/insight-merge';
import { humanize } from '../lib/client/format';
import { isOffTopic } from '../lib/research/relevance';
import {
  asNumber,
  clusterDisplayLabel,
  finalizeInsightGroups,
  groupShare,
  type InsightSourceCount,
} from '../lib/research/insight-groups';

function assert(condition: unknown, message: string): void {
  if (!condition) {
    console.error('FAIL', message);
    process.exitCode = 1;
  } else {
    console.log('ok', message);
  }
}

const pains: InsightSourceCount[] = Array.from({ length: 24 }, (_, index) => ({
  kind: 'pain_point' as const,
  label: `pain_label_${index}`,
  count: index === 0 ? 5 : 1,
}));

const model = [
  {
    kind: 'pain_point' as const,
    label: 'customer acquisition',
    summary: 'Finding clients.',
    source_labels: pains.slice(0, 8).map((item) => item.label),
  },
  {
    kind: 'pain_point' as const,
    label: 'Website Conversion',
    summary: 'Turning visits into leads.',
    source_labels: pains.slice(8, 16).map((item) => item.label),
  },
  {
    kind: 'pain_point' as const,
    label: 'AI Tools Anxiety',
    summary: 'Tools feel risky.',
    source_labels: pains.slice(16, 21).map((item) => item.label),
  },
];

const merged = finalizeInsightGroups(
  pains.concat([
    { kind: 'hook', label: 'how_to', count: 4 },
    { kind: 'structure', label: 'before_after', count: 2 },
    { kind: 'structure', label: 'mythbust', count: 1 },
    { kind: 'topic', label: 'web_design', count: 3 },
  ]),
  model,
);

const painGroups = merged.groups.filter((group) => group.kind === 'pain_point');
assert(PROMPT_VERSION === 'im-v2', 'prompt version is im-v2');
assert(merged.usedModel, 'partial model coverage still counts as a model merge');
assert(painGroups.length <= 8, 'pain groups are capped at 8');
assert(painGroups.length >= 4 && painGroups.length <= 8, 'partial pain merge stays in the 4-8 band');
assert(painGroups.some((group) => group.label === 'Customer Acquisition'), 'snake group titles become Title Case');
assert(painGroups.some((group) => group.label === 'Website Conversion'), 'Title Case titles are kept');
assert(painGroups.some((group) => group.label === 'AI Tools Anxiety'), 'acronyms stay uppercase');
assert(!painGroups.some((group) => /^[a-z0-9_]+$/.test(group.label)), 'cluster labels are not snake_case');
const other = painGroups.find((group) => group.label === 'Other');
assert(other?.source_labels.slice().sort().join() === 'pain_label_21,pain_label_22,pain_label_23', 'labels the model skipped go to Other');
const mapped = painGroups.flatMap((group) => group.source_labels);
assert(new Set(mapped).size === 24 && mapped.length === 24, 'every pain source maps to exactly one group');

const hooks = merged.groups.filter((group) => group.kind === 'hook');
assert(hooks.length === 1 && hooks[0].label === 'How-to', 'how_to displays as How-to');
assert(clusterDisplayLabel('structure', 'before_after', ['before_after']) === 'Before/After', 'before_after displays as Before/After');
assert(clusterDisplayLabel('structure', 'mythbust', ['mythbust']) === 'Myth-bust', 'mythbust displays as Myth-bust');

const tooMany = Array.from({ length: 12 }, (_, index) => ({
  kind: 'topic' as const,
  label: `Topic ${index}`,
  summary: '',
  source_labels: [`topic_${index}`],
}));
const capped = finalizeInsightGroups(
  tooMany.map((group) => ({ kind: 'topic' as const, label: group.source_labels[0], count: 12 - Number(group.label.slice(6)) })),
  tooMany,
);
const topicGroups = capped.groups.filter((group) => group.kind === 'topic');
assert(topicGroups.length === 8, 'more than 8 model groups collapse to 8');
assert(topicGroups.some((group) => group.label === 'Other'), 'overflow groups fold into Other');
assert(
  topicGroups.flatMap((group) => group.source_labels).length === 12,
  'capped topic groups still cover every source',
);

const emotions = ['curiosity', 'fear', 'aspiration', 'frustration', 'humor', 'urgency', 'trust', 'surprise', 'other'].map(
  (label, index) => ({ kind: 'emotion' as const, label, count: index + 1 }),
);
const emotionGroups = finalizeInsightGroups(emotions, null).groups;
assert(emotionGroups.length === 8, 'nine enum values cap at 8 when the model is absent');
assert(emotionGroups.some((group) => group.label === 'Other'), 'the smallest enum values fold into Other');
assert(emotionGroups.every((group) => !group.label.includes('_')), 'fallback labels are human readable');

assert(groupShare(10, 30) === 10 / 30, 'percent is mapped videos over analyzed videos');
assert(groupShare(0, 30) === 0 && groupShare(3, 0) === 0, 'empty groups and empty runs are 0');
assert(asNumber('0.25') === 0.25 && asNumber(null) === 0 && asNumber('nope') === 0, 'cluster percent strings become numbers');
assert(humanize('how_to') === 'How-to', 'feed and insight chips render how_to as How-to');
assert(humanize('How-to') === 'How-to' && humanize('Before/After') === 'Before/After', 'display labels are not re-split');
assert(humanize('Customer Acquisition') === 'Customer Acquisition', 'Title Case labels stay as written');

const doubled = finalizeInsightGroups(
  [
    { kind: 'topic', label: 'pricing', count: 2 },
    { kind: 'topic', label: 'fees', count: 1 },
  ],
  [
    { kind: 'topic', label: 'Pricing', summary: 'Money.', source_labels: ['pricing', 'fees'] },
    { kind: 'topic', label: 'pricing', summary: 'Duplicate.', source_labels: ['pricing'] },
  ],
);
const pricing = doubled.groups.filter((group) => group.kind === 'topic');
assert(pricing.length === 1 && pricing[0].source_labels.slice().sort().join() === 'fees,pricing', 'duplicate titles and repeated sources collapse');

assert(isOffTopic(39) && !isOffTopic(40) && !isOffTopic(null) && !isOffTopic(undefined), 'relevance under 40 is off-topic and missing scores stay relevant');

if (process.exitCode) process.exit(process.exitCode);
console.log('insight merge ok');
