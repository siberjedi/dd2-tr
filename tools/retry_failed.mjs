#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const getArg = (name, def) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : def;
};

const INPUT = getArg('--input', '');
const CACHE = getArg('--cache', 'work/cache.jsonl');
const FAILED = getArg('--failed', path.join(path.dirname(CACHE), 'failed.jsonl'));

const API = process.env.OPENCODE_API_URL || 'https://opencode.ai/inference/go/openai/v1/chat/completions';
const MODEL = process.env.OPENCODE_MODEL || 'deepseek-v4.1-flash';
const KEY = process.env.OPENCODE_API_KEY || '';
const SESS = process.env.OPENCODE_SESSION || 'dd2-tr-build';

if (!INPUT || !KEY) {
  console.error('usage: OPENCODE_API_KEY=... node retry_failed.mjs --input <natives root> [--cache work/cache.jsonl] [--failed path]');
  process.exit(1);
}

const SYS = [
  "You are a professional video-game localizer translating English strings to Turkish for Dragon's Dogma 2 (medieval fantasy RPG).",
  'Reply with ONLY a JSON array of strings, same count and order as the input array.',
  'CRITICAL: every inline tag (<lf>, any <...> token, {x}, %s, backslash escapes) must appear in your output the SAME NUMBER OF TIMES as in the source, spelled identically. You may reposition <lf> within the sentence, but counts must match exactly.',
  "Keep Dragon's Dogma setting terms untranslated: Arisen, Pawn, Wakestone, Ferrystone, Brine, Rift, vocation and skill names, place and character names.",
  'Natural, readable Turkish in the source register. No markdown, no explanations.'
].join('\n');

const TOK = /<[^<>]+>|%[a-zA-Z0-9]|\{[^}]*\}|\\[nrt]/g;
const toks = s => ((s || '').match(TOK) || []).slice().sort().join('|');

async function callModel(items, temperature, thinking) {
  const bodyObj = {
    model: MODEL,
    temperature,
    messages: [
      { role: 'system', content: SYS },
      { role: 'user', content: JSON.stringify(items) }
    ]
  };
  if (!thinking) bodyObj.thinking = { type: 'disabled' };
  const res = await fetch(API, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${KEY}`,
      'Content-Type': 'application/json',
      'User-Agent': 'dd2-tr-tool/1.0',
      'x-opencode-session': SESS
    },
    body: JSON.stringify(bodyObj),
    signal: AbortSignal.timeout(240000)
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const j = await res.json();
  let txt = (j.choices?.[0]?.message?.content || '').trim();
  txt = txt.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  const arr = JSON.parse(txt);
  if (!Array.isArray(arr) || arr.length !== items.length) throw new Error('bad length');
  return arr;
}

if (!fs.existsSync(FAILED)) {
  console.log('no failed.jsonl, nothing to do');
  process.exit(0);
}

const failed = fs.readFileSync(FAILED, 'utf8').split('\n').filter(l => l.trim()).map(l => JSON.parse(l));
console.log(`failed=${failed.length}`);

const fixed = new Map();
const unresolved = [];

for (const f of failed) {
  const src = f.s;
  let out = null;
  for (let attempt = 0; attempt < 2 && out === null; attempt++) {
    try {
      const r = await callModel([src], 0.2, attempt === 1);
      if (toks(r[0]) === toks(src)) out = r[0];
    } catch {}
  }
  if (out === null) {
    const parts = src.split('<lf>');
    if (parts.length > 1) {
      try {
        const r = await callModel(parts, 0.2, false);
        if (Array.isArray(r) && r.length === parts.length) {
          const safe = parts.map((p, i) => (toks(r[i]) === toks(p) ? r[i] : p));
          const joined = safe.join('<lf>');
          if (toks(joined) === toks(src)) out = joined;
        }
      } catch {}
    }
  }
  if (out !== null) fixed.set(src, out);
  else unresolved.push(src);
  process.stdout.write('.');
}
console.log(`\nfixed=${fixed.size} unresolved=${unresolved.length}`);

if (fixed.size) {
  fs.mkdirSync(path.dirname(CACHE), { recursive: true });
  fs.appendFileSync(CACHE, [...fixed.entries()].map(([s, d]) => JSON.stringify({ s, d })).join('\n') + '\n');

  const nlRe = /^<string>(\s*)([\s\S]*?)(\s*)$/;
  let changedFiles = 0;
  let changedLines = 0;
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => {
    const p = path.join(d, e.name);
    return e.isDirectory() ? walk(p) : (e.name.endsWith('.msg.24.txt') ? [p] : []);
  });
  for (const fp of walk(INPUT)) {
    const raw = fs.readFileSync(fp, 'utf8');
    const nl = raw.includes('\r\n') ? '\r\n' : '\n';
    let touched = false;
    const outLines = raw.split(/\r?\n/).map(line => {
      if (!line.startsWith('<string>')) return line;
      const m = line.match(nlRe);
      const core = m[2];
      if (fixed.has(core)) {
        touched = true;
        changedLines++;
        return '<string>' + m[1] + fixed.get(core) + m[3];
      }
      return line;
    });
    if (touched) {
      fs.writeFileSync(fp, outLines.join(nl), 'utf8');
      changedFiles++;
    }
  }
  console.log(`patched files=${changedFiles} lines=${changedLines}`);
}
if (unresolved.length) {
  fs.writeFileSync(path.join(path.dirname(CACHE), 'unresolved.jsonl'), unresolved.map(s => JSON.stringify({ s })).join('\n') + '\n', 'utf8');
  console.log('unresolved saved to unresolved.jsonl');
}
