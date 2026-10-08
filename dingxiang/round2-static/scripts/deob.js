// 通用"IIFE 参数数组 + 自研字符串解码器"静态解混淆器 (顶象 SDK) v2
// 用法: node deob.js <in.js> <out.js> [--diag]
// 依赖: webcrack 及其 @babel/* 依赖 (WEBRACK_NM)
const fs = require('fs');
const NM = process.env.WEBRACK_NM || '/tmp/npmwork/node_modules';
const parser = require(NM + '/@babel/parser');
const traverse = require(NM + '/@babel/traverse').default;
const generate = require(NM + '/@babel/generator').default;
const t = require(NM + '/@babel/types');
const { dataflowPass } = require(__dirname + '/dataflow.js');

const DIAG = process.argv.includes('--diag');
const GLOBALS = new Set(['String', 'parseInt', 'parseFloat', 'Math', 'Date', 'Array', 'Object',
  'Number', 'Boolean', 'undefined', 'NaN', 'Infinity', 'isNaN', 'isFinite',
  'encodeURIComponent', 'decodeURIComponent', 'unescape', 'escape', 'atob', 'btoa',
  'RegExp', 'JSON', 'Error']);
const PURE_METHODS = new Set(['join', 'split', 'slice', 'substring', 'substr', 'toUpperCase', 'toLowerCase',
  'toString', 'concat', 'charAt', 'charCodeAt', 'replace', 'trim', 'reverse', 'indexOf', 'fromCharCode', 'push']);

const inFile = process.argv[2], outFile = process.argv[3];
const code = fs.readFileSync(inFile, 'utf8');
const ast = parser.parse(code, {
  sourceType: 'script', allowReturnOutsideFunction: true, allowSuperOutsideMethod: true,
  errorRecovery: true,
  plugins: ['bigInt', 'optionalChaining', 'nullishCoalescingOperator', 'classProperties',
    'objectRestSpread', 'dynamicImport', 'numericSeparator']
});

// ---------- 纯表达式判定（白名单 AST，绝不执行任意代码） ----------
function isPure(node, ctx, depth) {
  if (!node) return false;
  if (depth > 60) return false;
  if (ctx.nodes++ > 400000) return false;
  switch (node.type) {
    case 'StringLiteral': case 'NumericLiteral': case 'BooleanLiteral': case 'NullLiteral':
      ctx.chars += (typeof node.value === 'string' ? node.value.length : 8);
      return true;
    case 'Identifier':
      return GLOBALS.has(node.name);
    case 'TemplateLiteral':
      return node.expressions.length === 0 && node.quasis.every(q => (ctx.chars += q.value.raw.length) && true);
    case 'ArrayExpression':
      return node.elements.every(e => e !== null && isPure(e, ctx, depth + 1));
    case 'ObjectExpression':
      return node.properties.every(p => t.isObjectProperty(p) && isPure(p.value, ctx, depth + 1));
    case 'UnaryExpression':
      return ['-', '+', '!', '~', 'void'].includes(node.operator) && isPure(node.argument, ctx, depth + 1);
    case 'BinaryExpression':
      return ['+', '-', '*', '/', '%', '^', '&', '|', '<<', '>>', '>>>', '==', '===', '!=', '!==', '<', '>', '<=', '>='].includes(node.operator)
        && isPure(node.left, ctx, depth + 1) && isPure(node.right, ctx, depth + 1);
    case 'LogicalExpression':
      return isPure(node.left, ctx, depth + 1) && isPure(node.right, ctx, depth + 1);
    case 'ConditionalExpression':
      return isPure(node.test, ctx, depth + 1) && isPure(node.consequent, ctx, depth + 1) && isPure(node.alternate, ctx, depth + 1);
    case 'MemberExpression': {
      if (!isPure(node.object, ctx, depth + 1)) return false;
      if (node.computed) return isPure(node.property, ctx, depth + 1);
      return t.isIdentifier(node.property) || t.isStringLiteral(node.property);
    }
    case 'CallExpression': {
      const c = node.callee;
      if (!t.isMemberExpression(c)) {
        // 只允许白名单全局函数直接调用
        return t.isIdentifier(c) && ['parseInt', 'parseFloat', 'isNaN', 'isFinite', 'encodeURIComponent',
          'decodeURIComponent', 'unescape', 'escape', 'atob', 'btoa'].includes(c.name)
          && node.arguments.every(a => isPure(a, ctx, depth + 1));
      }
      const propName = t.isIdentifier(c.property) ? c.property.name : (t.isStringLiteral(c.property) ? c.property.value : null);
      if (!propName || !PURE_METHODS.has(propName)) return false;
      if (!isPure(c.object, ctx, depth + 1)) return false;
      return node.arguments.every(a => isPure(a, ctx, depth + 1));
    }
    default:
      return false;
  }
}

function tryLiteral(p) {
  if (!p || !p.node) return null;
  const ctx = { nodes: 0, chars: 0 };
  if (!isPure(p.node, ctx, 0)) return null;
  if (ctx.chars > 4_000_000) return null;
  const src = generate(p.node, { compact: true }).code;
  if (src.length > 8_000_000) return null;
  try { return { ok: true, value: (new Function('"use strict";return (' + src + ')'))() }; }
  catch (e) { return { ok: false, err: e.message }; }
}

function toNode(v) {
  if (typeof v === 'string') return t.stringLiteral(v);
  if (typeof v === 'number') { if (!Number.isFinite(v)) return null; return t.numericLiteral(v); }
  if (typeof v === 'boolean') return t.booleanLiteral(v);
  if (v === null) return t.nullLiteral();
  return null;
}

function hasNoFreeVars(p) {
  let free = [];
  const handle = (pp) => {
    if (pp.isReferencedIdentifier && pp.isReferencedIdentifier()) {
      const name = pp.node.name;
      if (name === 'undefined' || GLOBALS.has(name)) return;
      if (pp.scope && pp.scope.hasBinding(name)) return; // 有绑定 -> 不是自由变量（可能是外层变量，调用会抛错，被捕获）
      if (pp.isMemberExpression && pp.parentPath && pp.parentPath.isMemberExpression() && pp.parentPath.node.property === pp.node) return;
      free.push(name);
    }
  };
  p.traverse({ Identifier: (pp) => handle(pp) });
  return free;
}

function collectDecoders(root) {
  const decoders = new Map();
  traverse(root, {
    Function(p) {
      const node = p.node;
      if (node.params.length !== 1) return;
      const body = generate(node.body, { compact: true }).code;
      if (!/fromCharCode/.test(body) || !/charCodeAt/.test(body)) return;
      if (body.length > 6000) return;
      if (/XMLHttpRequest|fetch\(|document|window|localStorage|sessionStorage|setTimeout|setInterval|console|Math\.random|new Promise/.test(body)) return;
      if (hasNoFreeVars(p.get('body')).length) return;
      try {
        const fn = new Function('return (' + generate(node).code + ')')();
        if (typeof fn === 'function') decoders.set(node, fn);
      } catch (e) { /* ignore */ }
    }
  });
  return decoders;
}

// ---------- 控制流平坦化还原 (obfuscator.io 风格 for+switch) ----------
function deepHasLoopJump(node) {
  // 检查 case 体内（不含嵌套函数）是否有 continue/break 指向本循环
  let found = false;
  const visit = (n) => {
    if (!n || found) return;
    if (typeof n !== 'object') return;
    if (Array.isArray(n)) { n.forEach(visit); return; }
    if (typeof n.type === 'string') {
      if (n.type === 'FunctionDeclaration' || n.type === 'FunctionExpression' || n.type === 'ArrowFunctionExpression') return;
      if (n.type === 'ContinueStatement' || n.type === 'BreakStatement') { found = true; return; }
    }
    for (const k of Object.keys(n)) {
      if (k === 'loc' || k === 'start' || k === 'end' || k === 'leadingComments' || k === 'trailingComments') continue;
      visit(n[k]);
    }
  };
  visit(node);
  return found;
}

function unflattenOnce(ast) {
  let count = 0;
  traverse(ast, {
    ForStatement(p) {
      const node = p.node;
      if (!t.isVariableDeclaration(node.init)) return;
      const decls = node.init.declarations;
      if (decls.length !== 2) return;
      const orderN = decls[0].init, idxId = decls[0].id, idxInit = decls[1].init;
      if (!t.isArrayExpression(orderN) || !t.isIdentifier(idxId) || !t.isNumericLiteral(idxInit) || idxInit.value !== 0) return;
      const nums = [];
      for (const el of orderN.elements) { if (!t.isNumericLiteral(el)) return; nums.push(el.value); }
      if (!t.isBlockStatement(node.body)) return;
      let switchStmt = null;
      for (const s of node.body.body) {
        if (t.isSwitchStatement(s)) { if (switchStmt) return; switchStmt = s; }
        else if (!t.isEmptyStatement(s) && !t.isBreakStatement(s)) return;
      }
      if (!switchStmt) return;
      const disc = switchStmt.discriminant;
      if (!t.isMemberExpression(disc) || !disc.computed) return;
      if (!t.isIdentifier(disc.object, { name: idxId.name })) return;
      const idxVarName = t.isIdentifier(decls[1].id) ? decls[1].id.name : null;
      if (!idxVarName) return;
      const prop = disc.property;
      const okProp = t.isIdentifier(prop, { name: idxVarName }) ||
        (t.isUpdateExpression(prop) && t.isIdentifier(prop.argument, { name: idxVarName }));
      if (!okProp) return;
      const caseMap = new Map();
      for (const c of switchStmt.cases) {
        if (!t.isNumericLiteral(c.test)) return;
        if (caseMap.has(c.test.value)) return;
        caseMap.set(c.test.value, c.consequent);
      }
      if (new Set(nums).size !== nums.length) return;
      if (nums.length !== caseMap.size) return;
      for (const [k, cons] of caseMap) {
        if (!cons.length) return;
        const last = cons[cons.length - 1];
        if (!t.isContinueStatement(last) && !t.isBreakStatement(last) && !t.isReturnStatement(last) && !t.isThrowStatement(last)) return;
        for (let i = 0; i < cons.length - 1; i++) {
          if (deepHasLoopJump(cons[i])) return;
        }
      }
      const newStmts = [];
      for (const n of nums) {
        const cons = caseMap.get(n);
        for (let i = 0; i < cons.length; i++) {
          const st = cons[i];
          if (i === cons.length - 1 && (t.isContinueStatement(st) || t.isBreakStatement(st))) continue;
          newStmts.push(st);
        }
      }
      p.replaceWithMultiple(newStmts);
      count++;
      p.skip();
    }
  });
  return count;
}

const stats = { arrayRef: 0, iife: 0, decodeCall: 0, pureCall: 0, constProp: 0, seq: 0, unflat: 0, dflow: 0, skip: {} };
let decoders = new Map();
let round = 0;

for (round = 0; round < 15; round++) {
  let changed = false;

  // 1) IIFE 参数数组 -> 字面量
  traverse(ast, {
    CallExpression(p) {
      const callee = p.node.callee;
      if (!t.isFunctionExpression(callee) && !t.isArrowFunctionExpression(callee)) return;
      const argPaths = p.get('arguments');
      if (!argPaths.length) return;
      const vals = [];
      let anyArr = false;
      for (const ap of argPaths) {
        const r = tryLiteral(ap);
        if (!r || !r.ok) {
          if (DIAG) console.error('IIFE arg not literal:', generate(ap.node, { compact: true }).code.slice(0, 80));
          vals.push(undefined);
          continue;
        }
        if (Array.isArray(r.value)) anyArr = true;
        vals.push(r.value);
      }
      if (!anyArr) return;
      const params = callee.params;
      let touched = false;
      const fnScope = p.get('callee').scope;
      for (let i = 0; i < params.length && i < vals.length; i++) {
        const pm = params[i];
        if (!t.isIdentifier(pm)) continue;
        const arr = vals[i];
        if (!Array.isArray(arr)) continue;
        const binding = fnScope.getBinding(pm.name) || p.scope.getBinding(pm.name);
        if (!binding) { if (DIAG) console.error('no binding for', pm.name); continue; }
        for (const ref of binding.referencePaths.slice()) {
          const parent = ref.parentPath;
          if (!parent || !parent.isMemberExpression || parent.node.object !== ref.node) continue;
          const prop = parent.node.property;
          let idx = null;
          if (t.isNumericLiteral(prop)) idx = prop.value;
          else if (t.isStringLiteral(prop) && /^\d+$/.test(prop.value)) idx = parseInt(prop.value, 10);
          if (idx === null || idx < 0 || idx >= arr.length) continue;
          const nn = toNode(arr[idx]);
          if (!nn) continue;
          parent.replaceWith(nn);
          stats.arrayRef++; touched = true; changed = true;
        }
      }
      if (touched) stats.iife++;
    }
  });

  // 2) 控制流平坦化还原
  const uf = unflattenOnce(ast);
  if (uf) { stats.unflat += uf; changed = true; }

  // 3) 常量传播 var x = <literal>
  traverse(ast, {
    VariableDeclarator(p) {
      if (!p.node.init) return;
      const r = tryLiteral(p.get('init'));
      if (!r || !r.ok) return;
      const nn = toNode(r.value);
      if (!nn) return;
      const id = p.node.id;
      if (!t.isIdentifier(id)) return;
      const binding = p.scope.getBinding(id.name);
      if (!binding || !binding.constant) return;
      if (binding.referencePaths.length > 20000) return;
      for (const ref of binding.referencePaths) { ref.replaceWith(t.cloneNode(nn, true)); stats.constProp++; changed = true; }
    }
  });

  // 3.5) 数据流常量折叠（顺序 env）
  if (decoders.size) {
    const df = dataflowPass(ast, decoders, traverse);
    const repl2 = df.repl;
    if (repl2.size) {
      traverse(ast, {
        exit(p) {
          if (repl2.has(p.node)) {
            const nn = toNode(repl2.get(p.node));
            if (nn) { p.replaceWith(nn); stats.dflow++; changed = true; p.skip(); }
          }
        }
      });
    }
  }

  // 4) 解码调用 / 纯调用折叠
  traverse(ast, {
    CallExpression(p) {
      const calleePath = p.get('callee');
      let fn = null;
      if (calleePath.isIdentifier()) {
        const b = calleePath.scope.getBinding(calleePath.node.name);
        if (b && decoders.has(b.path.node)) fn = decoders.get(b.path.node);
      } else if (calleePath.isFunction() && decoders.has(p.node.callee)) {
        fn = decoders.get(p.node.callee);
      }
      if (fn) {
        if (p.node.arguments.length !== 1) { stats.skip['decode-argc'] = (stats.skip['decode-argc'] || 0) + 1; return; }
        const r = tryLiteral(p.get('arguments.0'));
        if (!r || !r.ok) {
          stats.skip['decode-argexpr'] = (stats.skip['decode-argexpr'] || 0) + 1;
          if (DIAG && p.node.loc && stats.skip['decode-argexpr'] < 60) {
            console.error('DECODE-SKIP @' + p.node.loc.start.line + ': ' + generate(p.node, { compact: true }).code.slice(0, 160));
          }
          return;
        }
        let out;
        try { out = fn(r.value); } catch (e) { stats.skip['decode-throw'] = (stats.skip['decode-throw'] || 0) + 1; return; }
        const nn = toNode(out);
        if (!nn) { stats.skip['decode-nonlit'] = (stats.skip['decode-nonlit'] || 0) + 1; return; }
        p.replaceWith(nn); stats.decodeCall++; changed = true; return;
      }
      const r2 = tryLiteral(p);
      if (r2 && r2.ok) {
        const nn = toNode(r2.value);
        if (nn) { p.replaceWith(nn); stats.pureCall++; changed = true; }
      }
    }
  });

  // 4) SequenceExpression 折叠
  traverse(ast, {
    SequenceExpression(p) {
      if (p.node.expressions.every(e => t.isLiteral(e))) {
        const last = p.node.expressions[p.node.expressions.length - 1];
        p.replaceWith(t.cloneNode(last)); stats.seq++; changed = true;
      }
    }
  });

  if (!changed) break;
  decoders = collectDecoders(ast);
}

const out = generate(ast, { comments: true, compact: false, retainLines: false, jsescOption: { minimal: true } }).code;
fs.writeFileSync(outFile, out);
console.log(JSON.stringify({ file: inFile, rounds: round, stats, decoders: decoders.size }));
