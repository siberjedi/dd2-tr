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
const DRY = parseInt(getArg('--dry', '0'), 10);
const CONC = parseInt(getArg('--concurrency', '5'), 10);
const MAXITEMS = parseInt(getArg('--batch', '60'), 10);
const MAXCHARS = parseInt(getArg('--chars', '4200'), 10);
const NOTHINK = argv.includes('--nothink');

const API = process.env.OPENCODE_API_URL || 'https://opencode.ai/inference/go/openai/v1/chat/completions';
const MODEL = process.env.OPENCODE_MODEL || 'deepseek-v4.1-flash';
const KEY = process.env.OPENCODE_API_KEY || '';
const SESS = process.env.OPENCODE_SESSION || 'dd2-tr-build';

if (!INPUT) {
  console.error('usage: node translate.mjs --input <extracted natives root> [--cache work/cache.jsonl] [--concurrency 5] [--nothink] [--dry N]');
  process.exit(1);
}
if (!KEY) {
  console.error('OPENCODE_API_KEY is not set');
  process.exit(1);
}

const SYS = [
  "You are a professional video-game localizer translating English strings to Turkish for Dragon's Dogma 2, a medieval fantasy RPG with a slightly archaic tone.",
  'Rules:',
  '1. Reply with ONLY a JSON array of strings, same count and order as the input array.',
  '2. Preserve every inline tag and placeholder exactly as-is: <lf>, any <...> tokens, {..}, %s, %d, backslash escapes. Never translate, move, remove or alter them.',
  '3. Place <lf> at a natural line-break position in the Turkish sentence.',
  "4. Keep Dragon's Dogma setting terms untranslated: Arisen, Pawn, Wakestone, Ferrystone, Brine, Rift, vocation and skill names, place and character names.",
  "5. Use natural, readable Turkish suitable for the source's register (NPC gossip, quest text, UI labels, battle shouts).",
  '6. If a string is a symbol, number, name or already Turkish, return it unchanged.',
  '7. No markdown, no code fences, no explanations.'
].join('\n');

const TOK = /<[^<>]+>|%[a-zA-Z0-9]|\{[^}]*\}|\\[nrt]/g;
const toks = s => ((s || '').match(TOK) || []).slice().sort().join('|');

const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => {
  const p = path.join(d, e.name);
  return e.isDirectory() ? walk(p) : (e.name.endsWith('.msg.24.txt') ? [p] : []);
});

const files = walk(INPUT);
const uniques = new Set();
const fileLines = new Map();

for (const fp of files) {
  const raw = fs.readFileSync(fp, 'utf8');
  const lines = raw.split(/\r?\n/);
  fileLines.set(fp, lines);
  for (const line of lines) {
    if (!line.startsWith('<string>')) continue;
    const core = line.slice(8).trim();
    if (!core || core.startsWith('<REF')) continue;
    if (!/[A-Za-z]/.test(core)) continue;
    uniques.add(core);
  }
}

fs.mkdirSync(path.dirname(CACHE), { recursive: true });
const cache = new Map();
if (fs.existsSync(CACHE)) {
  for (const line of fs.readFileSync(CACHE, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      const o = JSON.parse(line);
      if (o && o.s && o.d) cache.set(o.s, o.d);
    } catch {}
  }
}

const todo = [...uniques].filter(s => !cache.has(s));
console.log(`files=${files.length} unique=${uniques.size} cached=${cache.size} todo=${todo.length}`);

const batches = [];
if (DRY > 0) {
  for (let i = 0; i < todo.length && batches.length < DRY; i += MAXITEMS) {
    batches.push(todo.slice(i, i + MAXITEMS));
  }
} else {
  let cur = [];
  let curLen = 0;
  for (const s of todo) {
    if (cur.length >= MAXITEMS || (cur.length > 0 && curLen + s.length > MAXCHARS)) {
      batches.push(cur);
      cur = [];
      curLen = 0;
    }
    cur.push(s);
    curLen += s.length;
  }
  if (cur.length) batches.push(cur);
}

const usage = { in: 0, out: 0 };
const failed = [];
const appendCache = entries => {
  fs.appendFileSync(CACHE, entries.map(e => JSON.stringify({ s: e.s, d: e.d })).join('\n') + '\n');
};

async function callModel(items) {
  const bodyObj = {
    model: MODEL,
    temperature: 0.2,
    messages: [
      { role: 'system', content: SYS },
      { role: 'user', content: JSON.stringify(items) }
    ]
  };
  if (NOTHINK) bodyObj.thinking = { type: 'disabled' };
  const res = await fetch(API, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${KEY}`,
      'Content-Type': 'application/json',
      'User-Agent': 'dd2-tr-tool/1.0',
      'x-opencode-session': SESS
    },
    body: JSON.stringify(bodyObj),
    signal: AbortSignal.timeout(180000)
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} ${t.slice(0, 160)}`);
  }
  const j = await res.json();
  usage.in += j.usage?.prompt_tokens || 0;
  usage.out += j.usage?.completion_tokens || 0;
  let txt = (j.choices?.[0]?.message?.content || '').trim();
  txt = txt.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  const arr = JSON.parse(txt);
  if (!Array.isArray(arr) || arr.length !== items.length) throw new Error('bad array length');
  for (let i = 0; i < items.length; i++) {
    if (typeof arr[i] !== 'string') throw new Error(`nonstring at ${i}`);
    if (/[\r\n]/.test(arr[i])) throw new Error(`raw newline at ${i}`);
    if (toks(items[i]) !== toks(arr[i])) throw new Error(`token mismatch at ${i}`);
  }
  return arr;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function translateBatch(items, attempt = 0) {
  try {
    const out = await callModel(items);
    const entries = items.map((s, i) => ({ s, d: out[i] }));
    for (const e of entries) cache.set(e.s, e.d);
    appendCache(entries);
  } catch (err) {
    if (attempt < 2) {
      await sleep(2000 * (attempt + 1));
      return translateBatch(items, attempt + 1);
    }
    if (items.length > 1) {
      const mid = Math.ceil(items.length / 2);
      await translateBatch(items.slice(0, mid), 0);
      await translateBatch(items.slice(mid), 0);
      return;
    }
    failed.push({ s: items[0], err: String(err).slice(0, 160) });
    cache.set(items[0], items[0]);
    appendCache([{ s: items[0], d: items[0] }]);
  }
}

let done = 0;
let idx = 0;
const samples = [];

async function worker() {
  while (true) {
    const i = idx++;
    if (i >= batches.length) return;
    const b = batches[i];
    await translateBatch(b);
    done++;
    if (DRY > 0 && samples.length < 8) {
      for (const s of b) {
        if (samples.length < 8) samples.push([s, cache.get(s)]);
      }
    }
    if (done % 20 === 0 || done === batches.length) {
      console.log(`[${new Date().toISOString()}] batches ${done}/${batches.length} cache=${cache.size} in=${usage.in} out=${usage.out}`);
    }
  }
}

await Promise.all(Array.from({ length: Math.min(CONC, batches.length || 1) }, worker));

if (DRY > 0) {
  console.log('DRY SAMPLES:');
  for (const [s, d] of samples) console.log(JSON.stringify({ s, d }));
  process.exit(0);
}

let replaced = 0;
let written = 0;
const backupDir = path.join(path.dirname(CACHE), 'orig_txt');
for (const [fp, lines] of fileLines) {
  const rel = path.relative(INPUT, fp);
  const bkp = path.join(backupDir, rel);
  if (!fs.existsSync(bkp)) {
    fs.mkdirSync(path.dirname(bkp), { recursive: true });
    fs.copyFileSync(fp, bkp);
  }
  const raw = fs.readFileSync(fp, 'utf8');
  const nl = raw.includes('\r\n') ? '\r\n' : '\n';
  const out = lines.map(line => {
    if (!line.startsWith('<string>')) return line;
    const m = line.match(/^<string>(\s*)([\s\S]*?)(\s*)$/);
    const sp = m[1];
    const core = m[2];
    const tp = m[3];
    if (!core || core.startsWith('<REF')) return line;
    if (!/[A-Za-z]/.test(core)) return line;
    const hit = cache.get(core);
    const tr = hit != null ? hit.replace(/\r?\n/g, '<lf>') : null;
    if (tr && tr !== core) replaced++;
    return '<string>' + sp + (tr != null ? tr : core) + tp;
  }).join(nl);
  fs.writeFileSync(fp, out, 'utf8');
  written++;
}

console.log(`DONE written=${written} replaced=${replaced} failed=${failed.length} in=${usage.in} out=${usage.out}`);
if (failed.length) {
  const failPath = path.join(path.dirname(CACHE), 'failed.jsonl');
  fs.writeFileSync(failPath, failed.map(f => JSON.stringify(f)).join('\n') + '\n', 'utf8');
  console.log(`failed entries: ${failPath}`);
}
