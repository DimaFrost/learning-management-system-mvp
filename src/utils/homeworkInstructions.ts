type HomeworkInstructionDetails = {
  topic?: string;
  submission?: string;
  resources: string[];
};

export function parseHomeworkInstructions(value: string | null | undefined): {
  instructions: string | null;
  details: HomeworkInstructionDetails;
} {
  const source = (value ?? '').trim();
  if (!source) {
    return { instructions: null, details: { resources: [] } };
  }

  const marker = /\n-{3,}\nAssignment details\n/i;
  const match = source.match(marker);
  if (!match || match.index === undefined) {
    return { instructions: source, details: { resources: [] } };
  }

  const instructions = source.slice(0, match.index).trim() || null;
  const detailsText = source.slice(match.index + match[0].length).trim();
  const details: HomeworkInstructionDetails = { resources: [] };
  const lines = detailsText.split(/\r?\n/);
  let readingResources = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.toLowerCase().startsWith('topic:')) {
      details.topic = trimmed.slice('topic:'.length).trim();
      readingResources = false;
      continue;
    }

    if (trimmed.toLowerCase().startsWith('submission:')) {
      details.submission = trimmed.slice('submission:'.length).trim();
      readingResources = false;
      continue;
    }

    if (trimmed.toLowerCase() === 'resources:') {
      readingResources = true;
      continue;
    }

    if (readingResources && trimmed.startsWith('-')) {
      details.resources.push(trimmed.slice(1).trim());
    }
  }

  return { instructions, details };
}
