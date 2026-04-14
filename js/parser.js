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
    const m  = ln.match(/^ID\s*=\s*([a-zA-Z_]+)(?:\(([^)]*)\))?/);
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
  pts._vars  = vars; // Make variables accessible via pts
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
        const style = m[1].toLowerCase();
        const rawArgs = m[2]
          ? m[2].split(',').map(s => s.trim()).filter(Boolean)
          : [];
        
        // Validate fill style
        const validStyles = ['none', 'dot', 'line', 'cross', 'hatch', 'grid'];
        if (validStyles.indexOf(style) < 0) {
          errs.push('L' + (li + 1) + ': unknown fill style "' + style + '"');
          continue;
        }
        
        // Parse and validate arguments
        const args = [];
        for (let ai = 0; ai < rawArgs.length; ai++) {
          const val = parseFloat(rawArgs[ai]);
          if (isNaN(val)) {
            errs.push('L' + (li + 1) + ': fill argument ' + (ai + 1) + ' is not a number: "' + rawArgs[ai] + '"');
            continue;
          }
          args.push(val);
        }
        
        // Validate arg count and ranges
        if (style === 'none') {
          if (args.length > 0) errs.push('L' + (li + 1) + ': "' + style + '" takes no arguments');
        } else if (style === 'dot') {
          if (args.length > 3) errs.push('L' + (li + 1) + ': "' + style + '" takes at most 3 arguments (offsetX, offsetY, density)');
        } else if (['line', 'hatch', 'cross', 'grid'].indexOf(style) >= 0) {
          if (args.length > 3) errs.push('L' + (li + 1) + ': "' + style + '" takes at most 3 arguments (angle, spacing, density)');
          if (args.length > 0 && args[1] !== undefined && args[1] < 0.1) {
            errs.push('L' + (li + 1) + ': spacing must be >= 0.1');
          }
          if (args.length > 1 && args[2] !== undefined && args[2] < 0.05) {
            errs.push('L' + (li + 1) + ': density must be >= 0.05');
          }
        }
        
        cmds.push({ type: 'fill', style: style, args: args });
      }
      continue;
    }

    // ── [var] = math(expr) ──
    const mathM = ln.match(/^\[([a-zA-Z_]+)\]\s*=\s*math\((.+)\)$/);
    if (mathM) {
      const expr = mathM[2].replace(/\[([a-zA-Z_]+)\]/g,
        function(_, v) { return vars[v] !== undefined ? String(vars[v]) : '0'; });
      try {
        vars[mathM[1]] = _evalMath(expr, vars);
      } catch (e) {
        errs.push('L' + (li + 1) + ': math error — ' + e.message);
      }
      continue;
    }

    // ── Command with colon check (Prioritize these) ──
    const isCmd = /:/.test(ln);
    if (isCmd) {
      // plot: f(x) [start, end, step]
      if (/^plot\s*:/i.test(ln)) {
        const m = ln.match(/^plot\s*:\s*(.+?)\s*\[\s*([^,]+)\s*,\s*([^,]+)\s*(?:,\s*([^\]]+))?\s*\]$/i);
        if (m) {
          const expr = m[1], startExpr = m[2], endExpr = m[3], stepExpr = m[4] || "0.1";
          try {
            const start = _evalMath(startExpr.replace(/\[([a-zA-Z_]+)\]/g, (_, v) => vars[v] || 0));
            const end   = _evalMath(endExpr.replace(/\[([a-zA-Z_]+)\]/g, (_, v) => vars[v] || 0));
            const step  = _evalMath(stepExpr.replace(/\[([a-zA-Z_]+)\]/g, (_, v) => vars[v] || 0));
            cmds.push({ type: 'plot', expr: expr, start: start, end: end, step: step, vars: Object.assign({}, vars) });
          } catch (e) { errs.push('L' + (li + 1) + ': plot error — ' + e.message); }
        } else {
          errs.push('L' + (li + 1) + ': invalid plot syntax. Use "plot: f(x) [start, end, step]"');
        }
        continue;
      }

      // text: "Content" pa pb (Rect fit)
      if (/^text\s*:/i.test(ln)) {
        // Improved regex to handle quoted content or single words followed by two point IDs
        const m = ln.match(/^text\s*:\s*(?:"([^"]+)"|(\S+))\s+([a-zA-Z_]+)\s+([a-zA-Z_]+)\s*$/i);
        if (m) {
          cmds.push({ type: 'text', content: m[1] || m[2], p1: m[3], p2: m[4] });
        } else {
          // Fallback for more complex content without quotes
          const m2 = ln.match(/^text\s*:\s*(.+?)\s+([a-zA-Z_]+)\s+([a-zA-Z_]+)\s*$/i);
          if (m2) {
            let content = m2[1].trim();
            if (content.startsWith('"') && content.endsWith('"')) content = content.slice(1, -1);
            cmds.push({ type: 'text', content: content, p1: m2[2], p2: m2[3] });
          } else {
            errs.push('L' + (li + 1) + ': invalid text syntax. Use text: "Content" pa pb');
          }
        }
        continue;
      }

      // label: "Content" pa size (Single point)
      if (/^label\s*:/i.test(ln)) {
        // Similar improvement for label
        const m = ln.match(/^label\s*:\s*(?:"([^"]+)"|(\S+))\s+([a-zA-Z_]+)(?:\s+(.+))?\s*$/i);
        if (m) {
          try {
            const sz = m[4] ? _evalMath(m[4].trim(), vars) : 0.4;
            cmds.push({ type: 'label', content: m[1] || m[2], p1: m[3], size: sz });
          } catch(e) { errs.push('L' + (li + 1) + ': label error — ' + e.message); }
        } else {
          const m2 = ln.match(/^label\s*:\s*(.+?)\s+([a-zA-Z_]+)(?:\s+(.+))?\s*$/i);
          if (m2) {
             let content = m2[1].trim();
             if (content.startsWith('"') && content.endsWith('"')) content = content.slice(1, -1);
             try {
               const sz = m2[3] ? _evalMath(m2[3].trim(), vars) : 0.4;
               cmds.push({ type: 'label', content: content, p1: m2[2], size: sz });
             } catch(e) { errs.push('L' + (li + 1) + ': label error — ' + e.message); }
          } else {
            errs.push('L' + (li + 1) + ': invalid label syntax. Use label: "Content" pa [size]');
          }
        }
        continue;
      }
    }

    // ── Point definition: [+]angle  pointId  [+|-]dist  [=]  newId ──
    // Matches patterns like: 90o1, 45 a 2 = b, [ang]o[dst]=c
    const pdM = ln.match(/^([+-]?\s*.+?)([a-zA-Z_]+)\s*([+-]?\s*[^=]+?)(?:\s*=\s*|)([a-zA-Z_]+)$/);
    if (pdM && !ln.includes('<') && !ln.includes('~') && !isCmd) {
      const angS = pdM[1].trim(), fromId = pdM[2], dstS = pdM[3].trim(), toId = pdM[4];
      try {
        const ang = (angS[0] === '+') 
          ? lastAng + _evalMath(angS.slice(1), vars)
          : _evalMath(angS, vars);
        const dst = (dstS[0] === '+')
          ? lastDst + _evalMath(dstS.slice(1), vars)
          : _evalMath(dstS, vars);
        const from = pts[fromId];
        if (!from) {
          errs.push('L' + (li + 1) + ': undefined point \'' + fromId + '\'');
          continue;
        }
        const rad = ang * Math.PI / 180;
        pts[toId] = { x: from.x + dst * Math.cos(rad), y: from.y + dst * Math.sin(rad) };
        lastAng = ang; lastDst = Math.abs(dst);
        cmds.push({ type: 'pt_def', id: toId, x: pts[toId].x, y: pts[toId].y });
      } catch (e) {
        errs.push('L' + (li + 1) + ': point error — ' + e.message);
      }
      continue;
    }

    // ── Midpoint: a~(pct,ang,dst)b = [name] ──
    const mpM = ln.match(/^([a-zA-Z_]+)~(?:\(([^)]*)\))?([a-zA-Z_]+)\s*=\s*\[?([a-zA-Z_]+)\]?$/);
    if (mpM) {
      const idA = mpM[1], ctrlS = mpM[2], idB = mpM[3], newId = mpM[4];
      if (pts[idA] && pts[idB]) {
        try {
          const parts = _smartSplit(ctrlS || "");
          const tRaw = (parts[0] || "50").replace('%', '');
          const t    = _evalMath(tRaw, vars) / 100;
          const oAng = parts[1] ? _evalMath(parts[1], vars) : 0;
          const oDst = parts[2] ? _evalMath(parts[2], vars) : 0;
          const mx   = pts[idA].x + (pts[idB].x - pts[idA].x) * t;
          const my   = pts[idA].y + (pts[idB].y - pts[idA].y) * t;
          const rad  = oAng * Math.PI / 180;
          pts[newId] = { x: mx + oDst * Math.cos(rad), y: my + oDst * Math.sin(rad) };
          cmds.push({ type: 'pt_def', id: newId, x: pts[newId].x, y: pts[newId].y });
        } catch(e) { errs.push('L' + (li + 1) + ': midpoint error — ' + e.message); }
      }
      continue;
    }

    // ── Line statement: pt <conn>(ctrl) pt ... ──
    if (ln.includes('<') && ln.includes('>')) {
      _parseLineStmt(ln, pts, cmds, vars, errs, li);
      continue;
    }


    if (ln) {
      // If it looks like a command with a colon, ensure it matches one of ours
      const isCmd = /^[a-z]+\s*:/i.test(ln);
      if (isCmd && !/^(fill|text|label|plot|ID)\s*:/i.test(ln)) {
         errs.push('L' + (li + 1) + ': unknown command: "' + ln + '"');
      } else {
         // Standard line/point statement
         _parseLineStmt(ln, pts, cmds, vars, errs, li);
      }
    }
  }

  return { pts, cmds, errs };
}

function _evalMath(expr, vars) {
  vars = vars || {};
  var cleanExpr = expr.trim();
  if (!cleanExpr) return 0;
  if (cleanExpr.toLowerCase().startsWith('math(') && cleanExpr.endsWith(')')) {
    cleanExpr = cleanExpr.substring(5, cleanExpr.length - 1);
  } else if (cleanExpr.startsWith('{') && cleanExpr.endsWith('}')) {
    cleanExpr = cleanExpr.substring(1, cleanExpr.length - 1);
  }

  // 1. Replace bracketed variables [var] with value
  // Note: Following the strict no-numbers rule, we changed the regex here too.
  var processed = cleanExpr.replace(/\[([a-zA-Z_]+)\]/g, function(_, v) {
    return vars[v] !== undefined ? String(vars[v]) : '0';
  });
  
  // 2. Identify all potential variable/function names (identifiers)
  // and replace them if they are in `vars` but were not bracketed
  processed = processed.replace(/\b([a-zA-Z_]+)\b/g, function(match) {
    // If it's a known Math function or constant, keep it (will be handled in next step)
    var mathFuncs = ['sin','cos','tan','sqrt','abs','pow','max','min','floor','ceil','round','exp','log','pi','e','x'];
    if (mathFuncs.indexOf(match.toLowerCase()) >= 0) return match;
    
    // If it's in vars, substitute it
    if (vars[match] !== undefined) return String(vars[match]);
    
    // Otherwise keep as is for now (it might still be a math function we handle next)
    return match;
  });

  // 3. Replace function names with Math equivalents
  var safe = processed
    .replace(/\bsin\b/g, 'Math.sin')
    .replace(/\bcos\b/g, 'Math.cos')
    .replace(/\btan\b/g, 'Math.tan')
    .replace(/\bsqrt\b/g, 'Math.sqrt')
    .replace(/\babs\b/g, 'Math.abs')
    .replace(/\bpow\b/g, 'Math.pow')
    .replace(/\bmax\b/g, 'Math.max')
    .replace(/\bmin\b/g, 'Math.min')
    .replace(/\bfloor\b/g, 'Math.floor')
    .replace(/\bceil\b/g, 'Math.ceil')
    .replace(/\bround\b/g, 'Math.round')
    .replace(/\bexp\b/g, 'Math.exp')
    .replace(/\blog\b/g, 'Math.log')
    .replace(/\bpi\b/gi, 'Math.PI')
    .replace(/\be\b/g, 'Math.E');
  
  // 4. Final check: any remaining identifiers that are not Math functions?
  // We treat them as 0 to avoid ReferenceError.
  safe = safe.replace(/\b([a-zA-Z_]+)\b/g, function(match) {
    if (match.startsWith('Math.')) return match;
    if (match === 'x') return 'x'; // Keep 'x' for plot expressions
    return '0';
  });

  // Validate characters
  // Relaxed validation to allow non-ASCII characters (like Japanese) to pass through 
  // without being zeroed if they happen to reach here.
  if (!/^[0-9+\-*/()\[\]a-zA-Z_.,\sMath.PIE\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff66-\uff9f]*$/.test(safe)) {
    return 0;
  }
  
  try {
    // eslint-disable-next-line no-new-func
    return Function('"use strict"; return (' + safe + ')')();
  } catch (e) {
    console.warn('Math evaluation error:', e, safe);
    return 0;
  }
}

function _parseLineStmt(line, pts, cmds, vars, errs, li) {
  const toks = [];
  // Tokenize points and connectors, then manually find control point blocks
  const re = /([a-zA-Z_]+)|(<[^>]*>)/g;
  let m;
  while ((m = re.exec(line)) !== null) {
    if (m[1]) {
      toks.push({ k: 'pt', id: m[1] });
    } else if (m[2]) {
      // Found a connector. Now look ahead for one or more (ctrl) blocks
      let ctrlStr = "";
      let lastIndex = re.lastIndex;
      while (lastIndex < line.length) {
        // Skip whitespace
        while (lastIndex < line.length && /\s/.test(line[lastIndex])) lastIndex++;
        if (line[lastIndex] !== '(') break;

        // Found a paren block, find its balance
        let start = lastIndex;
        let depth = 0;
        for (let i = start; i < line.length; i++) {
          if (line[i] === '(') depth++;
          else if (line[i] === ')') depth--;
          if (depth === 0) {
            ctrlStr += line.substring(start, i + 1);
            lastIndex = i + 1;
            break;
          }
        }
      }
      re.lastIndex = lastIndex; // Advance the global regex
      toks.push({
        k:    'conn',
        lt:   _lineType(m[2].slice(1, -1)),
        ctrl: _parseCtrl(ctrlStr)
      });
    }
  }

  // pt conn pt conn pt …
  for (let i = 0; i + 2 < toks.length; i += 2) {
    const A = toks[i], C = toks[i + 1], B = toks[i + 2];
    if (!A || !C || !B || A.k !== 'pt' || C.k !== 'conn' || B.k !== 'pt') continue;
    if (!pts[A.id]) { errs.push('L' + (li+1) + ': undefined \'' + A.id + '\''); continue; }
    if (!pts[B.id]) { errs.push('L' + (li+1) + ': undefined \'' + B.id + '\''); continue; }
    
    // Evaluate control points with vars
    try {
      const resolvedCtrl = C.ctrl.map(cp => ({
        pct: _evalMath(cp.pctRaw.replace('%', ''), pts._vars) / 100,
        ang: _evalMath(cp.angRaw, pts._vars),
        dst: _evalMath(cp.dstRaw, pts._vars)
      }));
      cmds.push({ type: 'line', from: A.id, to: B.id, lt: C.lt, ctrl: resolvedCtrl });
    } catch(e) { errs.push('L' + (li+1) + ': line error — ' + e.message); }
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
  var ctrl = [], depth = 0, start = -1;
  for (var i = 0; i < str.length; i++) {
    if (str[i] === '(') {
      if (depth === 0) start = i + 1;
      depth++;
    } else if (str[i] === ')') {
      depth--;
      if (depth === 0 && start !== -1) {
        var p = _smartSplit(str.substring(start, i));
        ctrl.push({
          pctRaw: p[0] || "50",
          angRaw: p[1] || "0",
          dstRaw: p[2] || "0"
        });
        start = -1;
      }
    }
  }
  return ctrl;
}

function _smartSplit(str) {
  var parts = [], cur = '', depth = 0;
  for (var i = 0; i < str.length; i++) {
    var c = str[i];
    if (c === '(') depth++;
    else if (c === ')') depth--;
    if (depth === 0 && (c === ',')) {
      parts.push(cur.trim()); cur = '';
    } else { cur += c; }
  }
  parts.push(cur.trim());
  return parts.filter(Boolean);
}
