#!/usr/bin/env node
/**
 * Ingests 30-seconds-of-code snippets into:
 * 1. Obsidian Vault: 04 - SKILL-LIBRARY/Utility/{lang}/
 * 2. Claude skills: ~/.claude/skills/utility-{tag}.md (top 60 by tag)
 *
 * Flags:
 *   --include-unlisted   Also ingest listed:false snippets (needed for Python)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SRC = path.join(__dirname, '../30-seconds-of-code/content/snippets');
const obsidianVault = process.env.OBSIDIAN_VAULT || 'C:/Users/profs/Desktop/Sandbox';
const OBSIDIAN_OUT = path.join(obsidianVault, 'Hermes OS/04 - SKILL-LIBRARY/Utility');
const SKILLS_OUT = 'C:/Users/profs/.claude/skills';

const LANGS = ['js', 'react', 'python', 'css'];
const INCLUDE_UNLISTED = process.argv.includes('--include-unlisted');

// Tag priority — these map directly to Hermes agent needs
const HIGH_VALUE_TAGS = [
  'array', 'object', 'string', 'function', 'promise', 'async',
  'hooks', 'effect', 'memoization', 'performance', 'date',
  'browser', 'node', 'type', 'math', 'regex'
];

function parseFrontmatter(content) {
  // Normalize CRLF → LF
  const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const match = normalized.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return null;
  const meta = {};
  match[1].split('\n').forEach(line => {
    const [k, ...v] = line.split(':');
    if (k && k.trim()) meta[k.trim()] = v.join(':').trim().replace(/[\[\]"]/g, '');
  });
  meta.body = match[2].trim();
  return meta;
}

function hasCodeBlock(body) {
  return /```/.test(body);
}

function toSkillFormat(meta, lang) {
  const tags = meta.tags ? meta.tags.split(',').map(t => t.trim()) : [];
  return `---
skill: utility-${lang}-${meta.shortTitle?.toLowerCase().replace(/\s+/g, '-') || 'snippet'}
type: utility
language: ${lang}
tags: [${tags.join(', ')}]
source: 30-seconds-of-code
dateIndexed: ${new Date().toISOString().split('T')[0]}
---

# ${meta.title || meta.shortTitle}

> ${meta.excerpt || ''}

${meta.body}
`;
}

function toObsidianFormat(meta, lang) {
  const tags = meta.tags ? meta.tags.split(',').map(t => t.trim()) : [];
  return `---
title: "${meta.title || ''}"
shortTitle: "${meta.shortTitle || ''}"
language: ${lang}
tags: [${tags.join(', ')}]
source: 30-seconds-of-code
indexed: ${new Date().toISOString().split('T')[0]}
---

# ${meta.title || meta.shortTitle}

> **${meta.excerpt || ''}**

${meta.body}
`;
}

let obsidianCount = 0;
let skillCount = 0;
const skillIndex = [];
// Per-language skill caps — Python gets all of it, others capped to keep skills/ lean
const SKILL_CAPS = { js: 60, react: 20, python: Infinity, css: 20 };
const langSkillCount = { js: 0, react: 0, python: 0, css: 0 };

for (const lang of LANGS) {
  const snippetDir = path.join(SRC, lang, 's');
  if (!fs.existsSync(snippetDir)) continue;

  const files = fs.readdirSync(snippetDir).filter(f => f.endsWith('.md'));
  const obsidianDir = path.join(OBSIDIAN_OUT, lang);
  fs.mkdirSync(obsidianDir, { recursive: true });

  for (const file of files) {
    const raw = fs.readFileSync(path.join(snippetDir, file), 'utf8');
    const meta = parseFrontmatter(raw);
    if (!meta) continue;
    if (meta.listed === 'false' && !INCLUDE_UNLISTED) continue;
    if (!hasCodeBlock(meta.body)) continue;

    const slug = file.replace('.md', '');

    // 1. Write to Obsidian vault (all snippets)
    const obsidianPath = path.join(obsidianDir, file);
    fs.writeFileSync(obsidianPath, toObsidianFormat(meta, lang));
    obsidianCount++;

    // 2. Write to Claude skills — Python gets everything; others filtered by HIGH_VALUE_TAGS
    const tags = meta.tags ? meta.tags.split(',').map(t => t.trim()) : [];
    const isHighValue = lang === 'python' || tags.some(t => HIGH_VALUE_TAGS.includes(t));
    const underCap = langSkillCount[lang] < (SKILL_CAPS[lang] ?? 30);
    if (isHighValue && underCap) {
      const skillSlug = `utility-${lang}-${slug}`;
      const skillPath = path.join(SKILLS_OUT, `${skillSlug}.md`);
      fs.writeFileSync(skillPath, toSkillFormat(meta, lang));
      skillIndex.push({ skill: skillSlug, lang, tags, title: meta.shortTitle || meta.title });
      langSkillCount[lang]++;
      skillCount++;
    }
  }
}

// Write index files
const obsidianIndex = `---
type: index
updated: ${new Date().toISOString().split('T')[0]}
total: ${obsidianCount}
---

# Utility Snippet Library

Ingested from [30-seconds-of-code](https://github.com/Chalarangelo/30-seconds-of-code).

## Coverage
${LANGS.map(l => {
  const dir = path.join(OBSIDIAN_OUT, l);
  const count = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.md')).length : 0;
  return `- **${l.toUpperCase()}**: ${count} snippets`;
}).join('\n')}

## Usage
Agents: search this folder semantically via \`obsidian_search_notes\` with query + language tag.
n8n Code nodes: reference snippets by shortTitle before writing custom logic.
Jack of Clubs: pull React/hooks snippets before building UI components.
`;

fs.writeFileSync(path.join(OBSIDIAN_OUT, 'INDEX.md'), obsidianIndex);

const manifestAddition = skillIndex.map(s =>
  `| ${s.skill} | utility | ${s.lang} | ${s.tags.slice(0,2).join(', ')} | 30s-of-code |`
).join('\n');

fs.writeFileSync(
  path.join(SKILLS_OUT, 'utility-manifest.md'),
  `# Utility Skills Manifest\n\n| Skill | Type | Lang | Tags | Source |\n|-------|------|------|------|--------|\n${manifestAddition}\n`
);

console.log(`✅ Obsidian: ${obsidianCount} snippets written to SKILL-LIBRARY/Utility/`);
console.log(`✅ Claude skills: ${skillCount} high-value snippets written to ~/.claude/skills/`);
console.log(`✅ Manifests: INDEX.md + utility-manifest.md`);
