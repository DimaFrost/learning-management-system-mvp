import fs from 'fs';
import path from 'path';

const root = path.resolve('src');
const outMd = path.resolve('missing-bulgarian-translations.md');
const outCsv = path.resolve('missing-bulgarian-translations.csv');

const files = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else if (/\.(tsx|ts)$/.test(entry.name)) files.push(p);
  }
}
walk(root);

const skipPathParts = [
  `${path.sep}i18n${path.sep}`,
  `${path.sep}types${path.sep}`,
  `${path.sep}lib${path.sep}`,
  'vite-env.d.ts',
];

function shouldSkip(file) {
  return skipPathParts.some((s) => file.includes(s));
}

function isHookFile(file) {
  return file.replace(/\\/g, '/').includes('/hooks/');
}

function isUtilFile(file) {
  const rel = file.replace(/\\/g, '/');
  return rel.includes('/utils/') || rel.includes('/lib/');
}

/** @type {Map<string, Set<string>>} */
const strings = new Map();

function add(text, file) {
  const cleaned = text
    .replace(/\s+/g, ' ')
    .replace(/^['"`]+|['"`]+$/g, '')
    .trim();
  if (!cleaned || isNoise(cleaned)) return;
  if (!strings.has(cleaned)) strings.set(cleaned, new Set());
  strings.get(cleaned).add(file);
}

function isNoise(t) {
  if (t.length < 2 || t.length > 220) return true;
  if (!/[A-Za-z]/.test(t)) return true;
  if (/[А-Яа-яЁё]/.test(t)) return true;
  if (/^https?:/i.test(t)) return true;
  if (/^[.#@][\w/-]+$/.test(t)) return true;
  if (/^\d+$/.test(t)) return true;
  if (/^[A-Z0-9_]+$/.test(t) && t.includes('_')) return true;
  if (/^(true|false|null|undefined|NaN|ok|id)$/i.test(t)) return true;
  if (t.includes('=>') || t.includes('===') || t.includes('!==')) return true;
  if (/^\$\{/.test(t)) return true;
  if (/^[a-z_]+(\.[a-z_0-9]+)+$/i.test(t)) return true;
  if (/\.(ts|tsx|js|jsx|css|png|jpg|jpeg|svg|webp|md|json|sql)$/i.test(t)) return true;
  if (/^(flex|grid|hidden|block|absolute|relative|fixed|sticky)\b/.test(t)) return true;
  if (/^(w-|h-|p-|m-|text-|bg-|border|rounded|gap-|space-|items-|justify-|col-|row-|min-|max-)/.test(t)) return true;
  if (/^(px|py|pt|pb|pl|pr|mx|my|mt|mb|ml|mr)-/.test(t)) return true;
  if (/^(sm|md|lg|xl|2xl|hover|focus|active|disabled|group|dark):/.test(t)) return true;
  if (/^(supabase|postgres|uuid|jwt|VITE_)/i.test(t)) return true;
  if (/^#[0-9a-fA-F]{3,8}$/.test(t)) return true;
  if (/^rgb[a]?\(/.test(t)) return true;
  if (/^[\w.-]+@[\w.-]+$/.test(t)) return true;
  if (/^[\d.]+(px|rem|em|vh|vw|%)$/.test(t)) return true;
  if (/^[\w-]+\/[\w/-]+$/.test(t) && !/\s/.test(t)) return true;
  if (/\b(await|const|let|var|return|function|import|export|from\(|\.from\(|supabase|throw new|setError\(|console\.|useState|useEffect)\b/.test(t)) return true;
  if (/[{};]/.test(t)) return true;
  if (/, err\)|, error\)|, updateError\)|, upsertError\)/.test(t)) return true;
  if (/^\W/.test(t) && !/^[“"'(]/.test(t)) return true;
  if (/^[a-z]+Error\b/.test(t)) return true;
  if (/^\.\.\.|^\.\w/.test(t)) return true;
  if (/^[A-Za-z]+Modal$|^[A-Za-z]+View$|^[A-Za-z]+Panel$/.test(t)) return true;
  if (/^[a-z]+(_[a-z]+)+$/.test(t)) return true;
  return false;
}

function looksLikeUiCopy(t) {
  const s = t.trim();
  if (/\s/.test(s)) return true;
  if (/[.!?:…]$/.test(s)) return true;
  if (/^[A-Z]/.test(s) && s.length >= 2) return true;
  return false;
}

const propNames =
  'placeholder|title|aria-label|aria-labelledby|aria-describedby|label|alt|helperText|description|emptyMessage|buttonLabel|confirmLabel|cancelLabel|heading|subtitle|tooltip|statusText|actionLabel';

for (const file of files) {
  if (shouldSkip(file)) continue;
  const content = fs.readFileSync(file, 'utf8');
  const rel = path.relative(process.cwd(), file).replace(/\\/g, '/');
  const withoutT = content.replace(/\bt\(\s*['"][^'"]+['"]\s*\)/g, 't(/*i18n*/)');

  if (!isHookFile(file) && !isUtilFile(file) && file.endsWith('.tsx')) {
    const jsxTextRe = />\s*([A-Za-z][^<>{}\n]{1,200}?)\s*</g;
    let m;
    while ((m = jsxTextRe.exec(withoutT)) !== null) {
      if (!looksLikeUiCopy(m[1].trim())) continue;
      add(m[1], rel);
    }
  }

  if (!isUtilFile(file)) {
    const propRe = new RegExp(`(?:${propNames})=\\{?["']([^"']{2,200})["']`, 'g');
    let m;
    while ((m = propRe.exec(withoutT)) !== null) {
      add(m[1], rel);
    }
  }

  {
    const fieldRe =
      /\b(?:label|title|description|placeholder|emptyText|emptyMessage|buttonText|confirmText|cancelText|heading|subtitle|message|helper|hint|tooltip|badge|statusLabel|actionLabel|tabLabel|sectionTitle|pageTitle|caption)\s*:\s*["']([^"']{2,200})["']/g;
    let m;
    while ((m = fieldRe.exec(withoutT)) !== null) {
      if (!looksLikeUiCopy(m[1].trim())) continue;
      add(m[1], rel);
    }
  }

  {
    const callRe =
      /\b(?:toast(?:\.(?:success|error|info|warning))?|alert|confirm|prompt|setError|setSuccess|setMessage|setStatus|setInfo|showError|showSuccess|showToast|notify)\(\s*["']([^"']{2,200})["']/g;
    let m;
    while ((m = callRe.exec(withoutT)) !== null) {
      add(m[1], rel);
    }
  }

  if (isHookFile(file)) {
    const throwRe = /throw new Error\(\s*["']([^"']{2,200})["']/g;
    let m;
    while ((m = throwRe.exec(withoutT)) !== null) {
      add(m[1], rel);
    }
    const errObjRe = /\berror\s*:\s*["']([^"']{2,200})["']/g;
    while ((m = errObjRe.exec(withoutT)) !== null) {
      if (looksLikeUiCopy(m[1].trim())) add(m[1], rel);
    }
  }
}

const langFile = path.resolve('src/i18n/LanguageContext.tsx');
const langSrc = fs.readFileSync(langFile, 'utf8');
const enBlock = langSrc.match(/en:\s*\{([\s\S]*?)\},\s*bg:/)?.[1] ?? '';
const bgBlock = langSrc.match(/bg:\s*\{([\s\S]*?)\},\s*\};/)?.[1] ?? '';

function parseTranslations(block) {
  /** @type {Map<string, string>} */
  const map = new Map();
  const re = /'([^']+)'\s*:\s*'((?:\\'|[^'])*)'/g;
  let m;
  while ((m = re.exec(block)) !== null) {
    map.set(m[1], m[2].replace(/\\'/g, "'"));
  }
  return map;
}

const en = parseTranslations(enBlock);
const bg = parseTranslations(bgBlock);
const sameAsEnglish = [];
for (const [key, enVal] of en) {
  const bgVal = bg.get(key);
  if (bgVal === enVal && /[A-Za-z]/.test(enVal) && !/^\d+$/.test(enVal)) {
    sameAsEnglish.push({ key, en: enVal });
  }
}

const sorted = [...strings.entries()].sort((a, b) =>
  a[0].localeCompare(b[0], 'en', { sensitivity: 'base' })
);

function areaOf(fileList) {
  const score = {
    'Layout (header / sidebar)': 0,
    Components: 0,
    Modals: 0,
    'Shared views': 0,
    'Admin views': 0,
    'Student views': 0,
    'Mentor views': 0,
    'Team leader views': 0,
    'Teacher / translator views': 0,
    'Hooks (errors / search labels)': 0,
    'Dev tools': 0,
    Other: 0,
  };
  for (const file of fileList) {
    const f = file.replace(/\\/g, '/');
    if (f.includes('/components/layout/')) score['Layout (header / sidebar)'] += 3;
    else if (f.includes('/components/modals/')) score.Modals += 3;
    else if (f.includes('/components/dev/')) score['Dev tools'] += 3;
    else if (f.includes('/components/')) score.Components += 2;
    else if (f.includes('/views/admin/')) score['Admin views'] += 2;
    else if (f.includes('/views/student/')) score['Student views'] += 2;
    else if (f.includes('/views/mentor/')) score['Mentor views'] += 2;
    else if (f.includes('/views/teamLeader/')) score['Team leader views'] += 2;
    else if (f.includes('/views/translator/') || f.includes('/views/teacher/')) score['Teacher / translator views'] += 2;
    else if (f.includes('/views/shared/')) score['Shared views'] += 2;
    else if (f.includes('/hooks/')) score['Hooks (errors / search labels)'] += 1;
    else score.Other += 1;
  }
  return Object.entries(score).sort((a, b) => b[1] - a[1])[0][0];
}

const areaOrder = [
  'Layout (header / sidebar)',
  'Components',
  'Modals',
  'Shared views',
  'Admin views',
  'Student views',
  'Mentor views',
  'Team leader views',
  'Teacher / translator views',
  'Hooks (errors / search labels)',
  'Dev tools',
  'Other',
];

/** @type {Map<string, Array<[string, string[]]>>} */
const byArea = new Map();
for (const [text, fileSet] of sorted) {
  const filesList = [...fileSet].sort();
  const area = areaOf(filesList);
  if (!byArea.has(area)) byArea.set(area, []);
  byArea.get(area).push([text, filesList]);
}

function csvEscape(value) {
  const s = String(value ?? '');
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

const csvRows = [['#', 'Area', 'English', 'Bulgarian', 'Sources']];
const md = [];
md.push('# Missing Bulgarian translations');
md.push('');
md.push('English UI strings that are **not** wired through `t()` in `src/i18n/LanguageContext.tsx`, so they stay English when the app language is Bulgarian.');
md.push('');
md.push('Fill in the **BG** lines below (or use `missing-bulgarian-translations.csv` in Excel / Google Sheets).');
md.push('');
md.push(`Generated: ${new Date().toISOString().slice(0, 10)}`);
md.push(`Total unique strings: **${sorted.length}**`);
md.push('');
md.push('Already translated in i18n (omitted here): sidebar workspace chrome, stream list basics, live-session banner, mentorship check-in modal.');
md.push('');
md.push('---');
md.push('');

let n = 1;
for (const area of areaOrder) {
  const items = byArea.get(area);
  if (!items?.length) continue;
  md.push(`## ${area} (${items.length})`);
  md.push('');
  for (const [text, filesList] of items) {
    md.push(`${n}. ${text}`);
    md.push(`   - BG:`);
    md.push(`   - Sources: \`${filesList.join('`, `')}\``);
    md.push('');
    csvRows.push([
      String(n),
      area,
      text,
      '',
      filesList.join('; '),
    ]);
    n += 1;
  }
}

md.push('---');
md.push('');
md.push('## i18n keys where Bulgarian equals English');
md.push('');
if (sameAsEnglish.length === 0) {
  md.push('_None_');
} else {
  for (const item of sameAsEnglish) {
    md.push(`- \`${item.key}\`: "${item.en}"`);
  }
}
md.push('');
md.push('---');
md.push('');
md.push('## Notes');
md.push('');
md.push('- Dynamic template strings (backticks with variables) are mostly not listed — check those when translating a screen.');
md.push('- Knowledge Base admin documentation strings are included.');
md.push('- Dev tools (`DevRolePanel`) are included; skip if you do not need them translated.');
md.push('- User-authored content (announcement text, course titles, etc.) is data and is not listed.');
md.push('- Regenerate: `node scripts/extract-untranslated-strings.mjs`');
md.push('');

fs.writeFileSync(outMd, md.join('\n'), 'utf8');
fs.writeFileSync(outCsv, csvRows.map((r) => r.map(csvEscape).join(',')).join('\n') + '\n', 'utf8');
console.log(`Wrote ${outMd}`);
console.log(`Wrote ${outCsv}`);
console.log(`Total: ${sorted.length}`);
for (const area of areaOrder) {
  const c = byArea.get(area)?.length ?? 0;
  if (c) console.log(`  ${area}: ${c}`);
}
