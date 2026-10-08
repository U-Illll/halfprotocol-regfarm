// 数据流常量折叠（顺序扫描 env + 作用域回溯），用于顶象混淆 SDK 解码调用还原
// 导出函数: dataflowPass(ast, decoders) -> Map<node, value>
const t = require((process.env.WEBRACK_NM || '/tmp/npmwork/node_modules') + '/@babel/types');

const SKIPV = Symbol('SKIP');
const GLOBALS = new Set(['String', 'parseInt', 'parseFloat', 'Math', 'Array', 'Object', 'Number',
  'Boolean', 'undefined', 'NaN', 'Infinity', 'isNaN', 'isFinite', 'encodeURIComponent',
  'decodeURIComponent', 'unescape', 'escape', 'atob', 'btoa', 'RegExp', 'JSON']);
const ALLOWED_METHODS = new Set(['join', 'split', 'slice', 'substring', 'substr', 'toUpperCase',
  'toLowerCase', 'toString', 'concat', 'charAt', 'replace', 'trim', 'reverse', 'indexOf', 'fromCharCode', 'charCodeAt']);

function isLit(v) {
  return typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean';
}

function patternNames(node, out) {
  out = out || new Set();
  if (!node) return out;
  switch (node.type) {
    case 'Identifier': out.add(node.name); break;
    case 'ObjectPattern': for (const p of node.properties) patternNames(p.value || p.argument, out); break;
    case 'ArrayPattern': for (const e of node.elements) patternNames(e, out); break;
    case 'AssignmentPattern': patternNames(node.left, out); break;
    case 'RestElement': patternNames(node.argument, out); break;
  }
  return out;
}

function collectAssignedNames(node) {
  const names = new Set();
  const visit = (n) => {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) { n.forEach(visit); return; }
    const type = n.type;
    if (type === 'FunctionDeclaration' || type === 'FunctionExpression' || type === 'ArrowFunctionExpression') return;
    if (type === 'VariableDeclarator') { patternNames(n.id, names); visit(n.init); return; }
    if (type === 'AssignmentExpression') { patternNames(n.left, names); visit(n.right); return; }
    if (type === 'UpdateExpression') { patternNames(n.argument, names); return; }
    for (const k of Object.keys(n)) {
      if (k === 'loc' || k === 'start' || k === 'end' || k === 'range' || k === 'comments') continue;
      if (k.startsWith('leading') || k.startsWith('trailing') || k.startsWith('inner')) continue;
      visit(n[k]);
    }
  };
  visit(node);
  return names;
}

function makeEval(scope, env, decoders) {
  function lookup(name, ctx) {
    if (env.has(name)) return env.get(name);
    if (name === 'undefined') return undefined;
    if (GLOBALS.has(name)) {
      const g = globalThis[name];
      if (typeof g !== 'undefined') return g;
    }
    const b = scope && scope.getBinding(name);
    if (b && b.constant) {
      const bp = b.path;
      if (bp.isFunctionDeclaration() || bp.isFunctionExpression()) {
        const fn = decoders.get(bp.node);
        if (fn) return fn;
        throw SKIPV;
      }
      if (bp.isVariableDeclarator() && bp.node.init) {
        if (ctx.depth > 6) throw SKIPV;
        return ev(bp.node.init, { depth: ctx.depth + 1 });
      }
    }
    throw SKIPV;
  }

  function ev(node, ctx) {
    if (!node) throw SKIPV;
    if (!ctx) ctx = { depth: 0, call: 0, scope: scope };
    switch (node.type) {
      case 'StringLiteral': case 'NumericLiteral': case 'BooleanLiteral': return node.value;
      case 'NullLiteral': return null;
      case 'Identifier': return lookup(node.name, ctx);
      case 'ArrayExpression':
        return node.elements.map(e => e === null ? undefined : ev(e, ctx));
      case 'ObjectExpression': {
        const o = {};
        for (const p of node.properties) {
          if (!t.isObjectProperty(p)) throw SKIPV;
          const k = p.computed ? ev(p.key, ctx) : (t.isIdentifier(p.key) ? p.key.name : p.key.value);
          o[k] = ev(p.value, ctx);
        }
        return o;
      }
      case 'UnaryExpression': {
        if (node.operator === 'typeof') throw SKIPV;
        const v = ev(node.argument, ctx);
        switch (node.operator) {
          case '-': return -v; case '+': return +v; case '!': return !v; case '~': return ~v; case 'void': return undefined;
        }
        throw SKIPV;
      }
      case 'BinaryExpression': {
        const l = ev(node.left, ctx), r = ev(node.right, ctx);
        switch (node.operator) {
          case '+': return l + r; case '-': return l - r; case '*': return l * r; case '/': return l / r;
          case '%': return l % r; case '^': return l ^ r; case '&': return l & r; case '|': return l | r;
          case '<<': return l << r; case '>>': return l >> r; case '>>>': return l >>> r;
          case '==': return l == r; case '===': return l === r; case '!=': return l != r; case '!==': return l !== r;
          case '<': return l < r; case '>': return l > r; case '<=': return l <= r; case '>=': return l >= r;
        }
        throw SKIPV;
      }
      case 'LogicalExpression': {
        const l = ev(node.left, ctx);
        if (node.operator === '&&') return l ? ev(node.right, ctx) : l;
        if (node.operator === '||') return l ? l : ev(node.right, ctx);
        if (node.operator === '??') return l === null || l === undefined ? ev(node.right, ctx) : l;
        throw SKIPV;
      }
      case 'ConditionalExpression':
        return ev(node.test, ctx) ? ev(node.consequent, ctx) : ev(node.alternate, ctx);
      case 'MemberExpression': {
        const o = ev(node.object, ctx);
        const k = node.computed ? ev(node.property, ctx) : (t.isIdentifier(node.property) ? node.property.name : node.property.value);
        if (o === null || o === undefined) throw SKIPV;
        const v = o[k];
        if (typeof v === 'function') throw SKIPV;
        return v;
      }
      case 'CallExpression': {
        if (ctx.call > 4) throw SKIPV;
        const cctx = { depth: ctx.depth, call: ctx.call + 1, scope: ctx.scope };
        const args = node.arguments.map(a => t.isSpreadElement(a) ? (() => { throw SKIPV; })() : ev(a, cctx));
        const c = node.callee;
        if (t.isMemberExpression(c)) {
          const o = ev(c.object, cctx);
          const k = c.computed ? ev(c.property, cctx) : (t.isIdentifier(c.property) ? c.property.name : c.property.value);
          if (!ALLOWED_METHODS.has(k)) throw SKIPV;
          if (o === null || o === undefined) throw SKIPV;
          const fn = o[k];
          if (typeof fn !== 'function') throw SKIPV;
          return fn.apply(o, args);
        }
        if (t.isIdentifier(c)) {
          const fn = lookup(c.name, cctx);
          if (typeof fn !== 'function') throw SKIPV;
          return fn.apply(undefined, args);
        }
        throw SKIPV;
      }
      default: throw SKIPV;
    }
  }
  return (node, depth) => { try { return ev(node, depth === undefined ? undefined : { depth: depth, call: 0, scope: scope }); } catch (e) { return SKIPV; } };
}

function dataflowPass(ast, decoders, traverse) {
  const repl = new Map();
  const stats = { scanned: 0, folded: 0 };

  function scanSeq(stmts, scope, env) {
    for (const st of stmts) scanStmt(st, scope, env);
  }

  function scanStmt(st, scope, env) {
    if (!st) return;
    const ev = makeEval(scope, env, decoders);
    switch (st.type) {
      case 'FunctionDeclaration': return;
      case 'ClassDeclaration': return;
      case 'VariableDeclaration': {
        for (const d of st.declarations) {
          if (d.init) foldExpr(d.init, scope, env);
          if (t.isIdentifier(d.id)) {
            if (d.init) {
              const v = ev(d.init);
              if (v !== SKIPV && isLit(v)) env.set(d.id.name, v); else env.delete(d.id.name);
            } else env.delete(d.id.name);
          } else { for (const n of patternNames(d.id)) env.delete(n); }
        }
        return;
      }
      case 'ExpressionStatement': {
        foldExpr(st.expression, scope, env);
        const e = st.expression;
        if (t.isAssignmentExpression(e) && e.operator === '=' && t.isIdentifier(e.left) && !e.left.__isPattern) {
          const evr = makeEval(scope, env, decoders);
          const v = evr(e.right);
          if (v !== SKIPV && isLit(v)) env.set(e.left.name, v); else env.delete(e.left.name);
        } else if (t.isCallExpression(e) && t.isIdentifier(e.callee)) {
          // 可能是直接调用（无副作用）——不动 env
        } else {
          for (const n of collectAssignedNames(e)) env.delete(n);
        }
        return;
      }
      case 'BlockStatement': {
        scanSeq(st.body, scope, new Map(env));
        for (const n of collectAssignedNames(st)) env.delete(n);
        return;
      }
      case 'IfStatement': {
        foldExpr(st.test, scope, env);
        scanStmt(st.consequent, scope, new Map(env));
        if (st.alternate) scanStmt(st.alternate, scope, new Map(env));
        for (const n of collectAssignedNames(st)) env.delete(n);
        return;
      }
      case 'ForStatement': case 'WhileStatement': case 'DoWhileStatement':
      case 'ForInStatement': case 'ForOfStatement': case 'LabeledStatement': {
        if (st.init) scanStmt(st.init, scope, new Map(env));
        if (st.test) foldExpr(st.test, scope, env);
        if (st.update) foldExpr(st.update, scope, env);
        if (st.body) scanStmt(st.body, scope, new Map(env));
        for (const n of collectAssignedNames(st)) env.delete(n);
        return;
      }
      case 'SwitchStatement': {
        foldExpr(st.discriminant, scope, env);
        for (const c of st.cases) {
          if (c.test) foldExpr(c.test, scope, env);
          scanSeq(c.consequent, scope, new Map(env));
        }
        for (const n of collectAssignedNames(st)) env.delete(n);
        return;
      }
      case 'TryStatement': {
        scanStmt(st.block, scope, new Map(env));
        if (st.handler) scanStmt(st.handler.body, scope, new Map(env));
        if (st.finalizer) scanStmt(st.finalizer, scope, new Map(env));
        for (const n of collectAssignedNames(st)) env.delete(n);
        return;
      }
      default: {
        for (const n of collectAssignedNames(st)) env.delete(n);
        return;
      }
    }
  }

  // 在表达式树中查找可折叠的调用
  function foldExpr(node, scope, env) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(n => foldExpr(n, scope, env)); return; }
    const type = node.type;
    if (type === 'FunctionExpression' || type === 'ArrowFunctionExpression' || type === 'FunctionDeclaration') return;
    if (type === 'CallExpression') {
      stats.scanned++;
      const ev = makeEval(scope, env, decoders);
      const v = ev(node);
      if (v !== SKIPV && isLit(v)) { repl.set(node, v); stats.folded++; return; }
    }
    for (const k of Object.keys(node)) {
      if (k === 'loc' || k === 'start' || k === 'end' || k === 'range' || k === 'comments') continue;
      if (k.startsWith('leading') || k.startsWith('trailing') || k.startsWith('inner')) continue;
      foldExpr(node[k], scope, env);
    }
  }

  function env0(scope) {
    const env = new Map();
    return env;
  }

  traverse(ast, {
    Function(p) {
      if (!t.isBlockStatement(p.node.body)) return;
      scanSeq(p.node.body.body, p.scope, env0(p.scope));
    },
    Program(p) {
      scanSeq(p.node.body, p.scope, env0(p.scope));
    }
  });

  return { repl, stats };
}

module.exports = { dataflowPass, SKIPV };
