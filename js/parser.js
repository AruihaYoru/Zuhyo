/* ================================================================
   図描 (Zuhyo) — parser.js
   Parses Zuhyo drawing language. Shared by renderer and app.
   ================================================================ */

/**
 * Extract the structure name and parameter names from code.
 * Looks for: ID = name([p1], [p2], ...)
 * @param {string} code
 * @returns {{ name: string, params: string[] }}
 */
function extractHeader(code) {
  for (const raw of code.split('\n')) {
    const ln = raw.replace(/\/\/.*$/, '').trim();
    const m  = ln.match(/^ID\s*=\s*([a-zA-Z_][a-zA-Z_]*)(?:\(([^)]*)\))?/);
    if (m) {
      const name   = m[1];
      const params = m[2]
        ? m[2].split(',')
              .map(s => s.trim().replace(/^\[|\]$/g, ''))
              .filter(Boolean)
        : [];
      return { name, params };
    }
  }
  return { name: 'unnamed', params: [] };
}

/**
 * Parse a Zuhyo code block with argument substitution.
 * @param {string} code       - Structure source code
 * @param {Object} argVals    - { paramName: number } substitutions
 * @returns {{ pts: Object, cmds: Array, errs: string[] }}
 */
function parseDotDash(code, argVals) {
  argVals = argVals || {};

  // Substitute [param] → value (text preprocessing)
  let src = code;
  for (const [k, v] of Object.entries(argVals)) {
    src = src.replace(new RegExp('\\[' + k + '\\]', 'g'), String(v));
  }

  const pts  = { o: { x: 0, y: 0 } };
  const vars = {};
  const cmds = [];
  const errs = [];
  let lastAng = 0, lastDst = 1;

  const lines = src.split('\n');
  for (let li = 0; li < lines.length; li++) {
    const ln = lines[li].replace(/\/\/.*$/, '').trim();

    if (!ln) {
      cmds.push({ type: 'sep' });
      continue;
    }

    // ── ID declaration ──
    if (/^ID\s*=/.test(ln)) {
      const m = ln.match(/^ID\s*=\s*(.+)$/);
      if (m) cmds.push({ type: 'id', raw: m[1].trim() });
      continue;
    }

    // ── fill: style[(args)] ──
    if (/^fill\s*:/i.test(ln)) {
      const m = ln.match(/^fill\s*:\s*(\w+)(?:\(([^)]*)\))?/i);
      if (m) {
        const args = m[2]
          ? m[2].split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n))
          : [];
        cmds.push({ type: 'fill', style: m[1].toLowerCase(), args });
      }
      continue;
    }

    // ── [var] = math(expr) ──
    const mathM = ln.match(/^\[([a-zA-Z_]+)\]\s*=\s*math\((.+)\)$/);
    if (mathM) {
      const expr = mathM[2].replace(/\[([a-zA-Z_]+)\]/g,
        function(_, v) { return vars[v] !== undefined ? String(vars[v]) : '0'; });
      try {
        vars[mathM[1]] = _evalMath(expr);
      } catch (e) {
        errs.push('L' + (li + 1) + ': math error — ' + e.message);
      }
      continue;
    }

    // ── Point definition: [+]angle  pointId  [+|-]dist  =  newId ──
    // Relative prefix (+): add to last angle/dist value
    const pdM = ln.match(/^([+\-]?\d+(?:\.\d+)?)([a-zA-Z_][a-zA-Z_]*)([+\-]?\d+(?:\.\d+)?)\s*=\s*([a-zA-Z_][a-zA-Z_]*)$/);
    if (pdM) {
      const angS = pdM[1], fromId = pdM[2], dstS = pdM[3], toId = pdM[4];

      const ang = (angS[0] === '+')
        ? lastAng + parseFloat(angS.slice(1))
        : parseFloat(angS);

      const dst = (dstS[0] === '+')
        ? lastDst + parseFloat(dstS.slice(1))
        : parseFloat(dstS);

      const from = pts[fromId];
      if (!from) {
        errs.push('L' + (li + 1) + ': undefined point \'' + fromId + '\'');
        continue;
      }

      const rad = ang * Math.PI / 180;
      // 0°=East, CCW; math y-axis (y up)
      pts[toId] = {
        x: from.x + dst * Math.cos(rad),
        y: from.y + dst * Math.sin(rad)
      };
      lastAng = ang;
      lastDst = Math.abs(dst);
      cmds.push({ type: 'pt_def', id: toId, x: pts[toId].x, y: pts[toId].y });
      continue;
    }

    // ── Midpoint: a~(pct,ang,dst)b = [name] ──
    const mpM = ln.match(/^([a-zA-Z_]+)~(?:\(([^)]*)\))?([a-zA-Z_]+)\s*=\s*\[?([a-zA-Z_]+)\]?$/);
    if (mpM) {
      const idA = mpM[1], ctrlS = mpM[2], idB = mpM[3], newId = mpM[4];
      if (pts[idA] && pts[idB]) {
        const parts = ctrlS ? ctrlS.split(/[,\s]+/).filter(Boolean) : [];
        const t    = parts[0] ? parseFloat(parts[0]) / 100 : 0.5;
        const oAng = parts[1] ? parseFloat(parts[1]) : 0;
        const oDst = parts[2] ? parseFloat(parts[2]) : 0;
        const mx   = pts[idA].x + (pts[idB].x - pts[idA].x) * t;
        const my   = pts[idA].y + (pts[idB].y - pts[idA].y) * t;
        const rad  = oAng * Math.PI / 180;
        pts[newId] = { x: mx + oDst * Math.cos(rad), y: my + oDst * Math.sin(rad) };
        cmds.push({ type: 'pt_def', id: newId, x: pts[newId].x, y: pts[newId].y });
      }
      continue;
    }

    // ── Line statement: pt <conn>(ctrl) pt ... ──
    if (ln.includes('<') && ln.includes('>')) {
      _parseLineStmt(ln, pts, cmds, errs, li);
      continue;
    }

    if (ln) {
      errs.push('L' + (li + 1) + ': unknown syntax: "' + ln + '"');
    }
  }

  return { pts, cmds, errs };
}

// ── Helpers ──

function _evalMath(expr) {
  var safe = expr
    .replace(/\bsin\b/g, 'Math.sin')
    .replace(/\bcos\b/g, 'Math.cos')
    .replace(/\btan\b/g, 'Math.tan')
    .replace(/\bsqrt\b/g, 'Math.sqrt')
    .replace(/\babs\b/g, 'Math.abs')
    .replace(/\bpi\b/gi, 'Math.PI');
  // eslint-disable-next-line no-new-func
  return Function('"use strict"; return (' + safe + ')')();
}

function _parseLineStmt(line, pts, cmds, errs, li) {
  const toks = [];
  const re   = /([a-zA-Z_][a-zA-Z_]*)|(<[^>]*>)((?:\s*\([^)]*\))*)/g;
  let m;
  while ((m = re.exec(line)) !== null) {
    if (m[1]) {
      toks.push({ k: 'pt', id: m[1] });
    } else if (m[2]) {
      toks.push({
        k:    'conn',
        lt:   _lineType(m[2].slice(1, -1)),
        ctrl: _parseCtrl(m[3] || '')
      });
    }
  }

  // pt conn pt conn pt …
  for (let i = 0; i + 2 < toks.length; i += 2) {
    const A = toks[i], C = toks[i + 1], B = toks[i + 2];
    if (A.k !== 'pt' || C.k !== 'conn' || B.k !== 'pt') continue;
    if (!pts[A.id]) { errs.push('L' + (li+1) + ': undefined \'' + A.id + '\''); continue; }
    if (!pts[B.id]) { errs.push('L' + (li+1) + ': undefined \'' + B.id + '\''); continue; }
    cmds.push({ type: 'line', from: A.id, to: B.id, lt: C.lt, ctrl: C.ctrl });
  }
}

function _lineType(inner) {
  var map = {
    '-':    { style: 'solid',    dash: [] },
    '..':   { style: 'dotted',   dash: [2, 5] },
    '--':   { style: 'dashed',   dash: [9, 6] },
    '-.-':  { style: 'dashdot',  dash: [10, 4, 2, 4] },
    '-..-': { style: 'dashdot2', dash: [10, 4, 2, 4, 2, 4] },
    '':     { style: 'invis',    dash: null }
  };
  return map[inner] || { style: 'solid', dash: [] };
}

function _parseCtrl(str) {
  var ctrl = [], re = /\(([^)]*)\)/g, m;
  while ((m = re.exec(str)) !== null) {
    var p = m[1].split(/[,\s]+/).filter(Boolean);
    ctrl.push({
      pct: parseFloat(p[0]) / 100,
      ang: p.length >= 2 ? parseFloat(p[1]) : 0,
      dst: p.length >= 3 ? parseFloat(p[2]) : 0
    });
  }
  return ctrl;
}
