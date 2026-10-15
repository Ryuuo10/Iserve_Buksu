const CATEGORY_LABEL_ALIASES = {
  'academic issues': 'Academic Issues',
  'teaching and grading issues': 'Academic Issues',
  'administrative concerns': 'Administrative Concerns',
  'academic advising issues': 'Administrative Concerns',
  'facility problems': 'Facility Problems',
  'financial matters': 'Financial Matters',
  'harassment/discrimination': 'Harassment/Discrimination',
  'harassment discrimination': 'Harassment/Discrimination',
  'unfair treatment': 'Unfair Treatment',
  'service quality': 'Service Quality',
  'policy enforcement': 'Policy Enforcement',
  'general feedback': 'Other',
  other: 'Other',
  general: 'Other',
};

export const isPredefinedAiAnalysis = (analysis) => !!analysis && (
  /fallback/i.test(String(analysis.source || '')) ||
  ['category', 'urgency', 'sentiment'].some((key) =>
    /fallback|safety_override/i.test(String(analysis[key]?.rawLabel || ''))
  )
);

export const getModelAnalysisForDisplay = (analysis) => isPredefinedAiAnalysis(analysis) ? null : analysis;

export const normalizeAiCategoryLabel = (value, fallback = '--') => {
  const raw = String(value || '').trim();
  if (!raw) {
    return fallback;
  }

  const key = raw
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return CATEGORY_LABEL_ALIASES[key] || raw.replace(/\b\w/g, (match) => match.toUpperCase());
};
