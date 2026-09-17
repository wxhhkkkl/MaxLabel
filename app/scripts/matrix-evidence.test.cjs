#!/usr/bin/env node
/**
 * parity 矩阵证据完整性校验（防「引用了不存在的证据」这类缺陷）
 *
 * 背景：round-98 发现 E-01/E-06~E-10 的证据列都写「见 app/docs/labelshop-compatibility-audit.md
 * 的单一版本策略」，但该文档里根本没有这一节 —— 引用了不存在的证据。本脚本把「证据必须真实存在」
 * 变成可回归的断言，覆盖以下 7 类：
 *   1. `已实现` / `部分` 的行必须有非空证据（与 tools/parity/Check-Matrix.ps1 同口径）
 *   2. 证据里引用的源码 / 脚本 / 文档 / 目录路径必须存在（相对仓库根或 app/ 均可）
 *   3. 证据里引用的 `ui-vNN.cjs` 必须已登记进 app/scripts/run-regression.ps1
 *   4. 证据里引用的 `npm run test:xxx` 必须在 app/package.json 的 scripts 里存在
 *   5. 证据里引用的真机/复刻截图必须存在于 parity/reference/{labelshop,maxlabel}/
 *   6. 证据里「app/docs/<file>.md 的「<小节>」」形式的小节引用必须真的能在该文档里找到
 *   7. 证据里引用的 `parity/*.md` 文档必须存在
 *
 * 用法：npm run test:evidence
 */
'use strict';

const fs = require('fs');
const path = require('path');

const APP = path.resolve(__dirname, '..');
const ROOT = path.resolve(APP, '..');

const MATRIX = path.join(ROOT, 'parity', 'matrix.md');
const REGRESSION = path.join(APP, 'scripts', 'run-regression.ps1');
const PKG = JSON.parse(fs.readFileSync(path.join(APP, 'package.json'), 'utf8'));
const pkgScripts = new Set(Object.keys(PKG.scripts || {}));

const failures = [];
const fail = (kind, id, detail) => failures.push({ kind, id, detail });

// ---------------------------------------------------------------- parse matrix
function parseRows() {
  const text = fs.readFileSync(MATRIX, 'utf8');
  const rows = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.startsWith('|')) continue;
    const cells = line.split('|');
    if (cells.length < 8) continue;
    const id = cells[1].trim();
    if (!/^[A-E]-\d+$/.test(id)) continue;
    rows.push({ id, status: cells[5].trim(), evidence: cells.slice(6).join('|').trim() });
  }
  return rows;
}

const rows = parseRows();
if (rows.length === 0) {
  console.error('FAIL: 未能从 parity/matrix.md 解析出任何条目行');
  process.exit(1);
}

// ------------------------------------------------------- 1. evidence presence
const EVIDENCE_REQUIRED = new Set(['已实现', '部分']);
for (const r of rows) {
  if (EVIDENCE_REQUIRED.has(r.status) && r.evidence.length < 8) {
    fail('缺少证据', r.id, `状态为 ${r.status} 但证据列为空或过短`);
  }
  if (!['已实现', '部分', '未实现', '待核'].includes(r.status)) {
    fail('非法状态', r.id, `状态 "${r.status}" 不在允许取值内`);
  }
}

// --------------------------------------------------- 2. code spans in evidence
const CODE_SPAN = /`([^`]+)`/g;

// 形如 `app/docs/xxx.md` 的「小节名」
const SECTION_REF = /`(app\/docs\/[^`]+?\.md)`\s*的\s*[「"]([^」"]+)[」"]/g;

function isProse(t) {
  if (!/[\/\\]/.test(t)) return true; // 无路径分隔符
  if (/[\s*<>|（）]/.test(t)) return true; // 含空白/通配/中文括号 → 散文
  if (/^\d/.test(t)) return true; // 1/3 这类分数
  if (/^\/\w/.test(t)) return true; // /api/version 这类 URL 路径
  if (/^\w\/\d/.test(t)) return true; // n/3 这类页数写法
  if (/^(dongle|演示|保存|文件|新建)/.test(t)) return true; // 散文枚举
  if (/\.(check|structure|capacity|origin|charset|reading|specialOptions|note)(\/|$)/.test(t)) return true; // 符号名
  return false;
}

// 证据里的路径可能写成仓库根相对、app/ 相对，或省略 app/src 前缀的简写；
// 只要能在其中之一唯一解析即视为存在，全部落空才算引用错误。
const BASES = [
  '',
  'app/',
  'app/src/',
  'app/scripts/',
  'app/src/renderer/src/',
  'app/src/main/',
  'app/src/preload/',
  'app/docs/',
];

function resolves(t) {
  const clean = t.replace(/\\/g, '/').replace(/^\.\//, '');
  return BASES.some((b) => fs.existsSync(path.join(ROOT, b + clean)));
}

const registered = new Set(
  [...fs.readFileSync(REGRESSION, 'utf8').matchAll(/ui-v\d+\.cjs/g)].map((m) => m[0]),
);

const shotDirs = ['parity/reference/labelshop', 'parity/reference/maxlabel'];
function shotExists(name) {
  return shotDirs.some((d) => fs.existsSync(path.join(ROOT, d, name)));
}

for (const r of rows) {
  const ev = r.evidence;
  let m;

  // 2a. 小节引用
  SECTION_REF.lastIndex = 0;
  while ((m = SECTION_REF.exec(ev))) {
    const docPath = path.join(ROOT, m[1]);
    const section = m[2];
    if (!fs.existsSync(docPath)) {
      fail('引用了不存在的文档', r.id, `${m[1]} 不存在`);
      continue;
    }
    const body = fs.readFileSync(docPath, 'utf8');
    // 小节名可能是标题片段，按「标题或正文包含该串」判定
    if (!body.includes(section)) {
      fail('引用了文档中不存在的小节', r.id, `${m[1]} 里找不到「${section}」`);
    }
  }

  // 2b/3/4/5/6/7. 反引号内的路径
  CODE_SPAN.lastIndex = 0;
  while ((m = CODE_SPAN.exec(ev))) {
    const t = m[1].trim();

    // npm run test:xxx
    const npm = /^npm run ([\w:.-]+)$/.exec(t);
    if (npm) {
      if (!pkgScripts.has(npm[1])) fail('引用了不存在的 npm 脚本', r.id, `npm run ${npm[1]}`);
      continue;
    }
    // MAXLABEL_UI_SCRIPT=ui-vNN.cjs npm run test:ui
    const envUi = /^MAXLABEL_UI_SCRIPT=(ui-v\d+\.cjs)/.exec(t);
    if (envUi) {
      if (!registered.has(envUi[1])) fail('ui 脚本未登记进门禁', r.id, envUi[1]);
      continue;
    }
    if (/^ui-v\d+\.cjs( [\d]+|$)/.test(t)) {
      const name = t.split(/\s/)[0];
      if (!fs.existsSync(path.join(APP, 'scripts', name))) {
        fail('引用了不存在的 ui 脚本', r.id, name);
      } else if (!registered.has(name)) {
        fail('ui 脚本未登记进门禁', r.id, `app/scripts/${name} 未出现在 run-regression.ps1`);
      }
      continue;
    }
    // 截图名（*.png，无路径）
    if (/^[\w.\-]+\.png$/.test(t)) {
      if (!shotExists(t)) fail('引用了不存在的截图', r.id, t);
      continue;
    }
    // 带路径的截图
    if (/\.png$/.test(t) && !isProse(t)) {
      if (!resolves(t) && !shotExists(path.basename(t))) {
        fail('引用了不存在的截图', r.id, t);
      }
      continue;
    }
    // 其它路径
    if (!isProse(t) && !/\.png$/.test(t)) {
      if (!resolves(t)) fail('引用了不存在的路径', r.id, t);
      // 引用的 .cjs / .test.ts 脚本应登记进门禁
      const base = path.basename(t.replace(/\\/g, '/'));
      if (/^ui-v\d+\.cjs$/.test(base) && !registered.has(base)) {
        fail('ui 脚本未登记进门禁', r.id, base);
      }
    }
  }
}

// ------------------------------------------------------------------- reporting
const byKind = new Map();
for (const f of failures) {
  if (!byKind.has(f.kind)) byKind.set(f.kind, []);
  byKind.get(f.kind).push(f);
}

if (failures.length === 0) {
  console.log(`matrix evidence check passed (${rows.length} rows scanned)`);
  process.exit(0);
}

console.error(`FAIL: ${failures.length} 条证据问题，涉及 ${byKind.size} 类\n`);
for (const [kind, list] of byKind) {
  console.error(`【${kind}】${list.length} 条`);
  for (const f of list.slice(0, 40)) console.error(`  ${f.id}: ${f.detail}`);
  if (list.length > 40) console.error(`  ... 其余 ${list.length - 40} 条省略`);
  console.error('');
}
process.exit(1);
