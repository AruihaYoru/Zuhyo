/* ================================================================
     図描 (Zuhyo) — parser.js
     Formal parser using Peggy (PEG.js) to generate an AST.
     ================================================================ */

(function() {
    const ZUHYO_GRAMMAR = `
Program
  = statements:Statement* {
      return {
        type: "Program",
        body: statements.filter(s => s !== null)
      };
    }

Statement
  = _ cmd:Command _ ("\\n" / EOF) { return cmd; }
  / _ def:PointDefinition _ ("\\n" / EOF) { return def; }
  / _ conn:LineConnection _ ("\\n" / EOF) { return conn; }
  / _ mid:Midpoint _ ("\\n" / EOF) { return mid; }
  / _ assign:Assignment _ ("\\n" / EOF) { return assign; }
  / _ comment:Comment _ ("\\n" / EOF) { return null; }
  / _ "\\n" { return null; }

Assignment
  = "ID" _ "=" _ id:Identifier params:(_ "(" _ p:ParameterList _ ")" { return p; })? {
      return {
        type: "IDAssignment",
        id: id,
        params: params || []
      };
    }
  / "[" _ id:Identifier _ "]" _ "=" _ "math(" _ expr:MathExpression _ ")" {
      return {
        type: "MathAssignment",
        varName: id,
        expression: expr
      };
    }

ParameterList
  = head:Identifier tail:(_ "," _ i:Identifier { return i; })* {
      return [head, ...tail];
    }
  / "" { return []; }

Command
  = "fill" _ ":" _ style:Identifier args:(_ "(" _ a:ArgumentList _ ")" { return a; })? {
      return {
        type: "Command",
        name: "fill",
        style: style,
        args: args || []
      };
    }
  / "repeat" _ ":" _ n:MathExpression _ from:Identifier _ dist:MathExpression _ start:("[" _ e:MathExpression _ "]" { return e; })? _ "=" _ prefix:Identifier {
      return {
        type: "Command",
        name: "repeat",
        n: n,
        from: from,
        dist: dist,
        startAngle: start || "0",
        prefix: prefix
      };
    }
  / "intersect" _ ":" _ p1:Identifier _ p2:Identifier _ p3:Identifier _ p4:Identifier _ "=" _ newPt:Identifier {
      return {
        type: "Command",
        name: "intersect",
        points: [p1, p2, p3, p4],
        target: newPt
      };
    }
  / "plot" _ ":" _ expr:MathExpression _ "[" _ start:MathExpression _ "," _ end:MathExpression _ ("," _ step:MathExpression { return step; })? _ "]" {
      return {
        type: "Command",
        name: "plot",
        expression: expr,
        range: { start: start, end: end, step: step || "0.1" }
      };
    }
  / "text" _ ":" _ content:StringLiteral _ p1:Identifier _ p2:Identifier {
      return {
        type: "Command",
        name: "text",
        content: content,
        p1: p1,
        p2: p2
      };
    }
  / "label" _ ":" _ content:StringLiteral _ p1:Identifier _ size:MathExpression? {
      return {
        type: "Command",
        name: "label",
        content: content,
        p1: p1,
        size: size || "0.4"
      };
    }

PointDefinition
  = ang:MathExpression _ from:Identifier _ dist:MathExpression _ "="? _ target:Identifier {
      return {
        type: "PointDefinition",
        angle: ang,
        from: from,
        distance: dist,
        target: target
      };
    }

LineConnection
  = head:Identifier tail:(_ op:ConnectionOperator _ target:Identifier ctrl:(_ c:ControlPointList { return c; })? { 
      return { operator: op, target: target, controls: ctrl || [] }; 
    })+ {
      return {
        type: "LineConnection",
        base: head,
        segments: tail
      };
    }

Midpoint
  = p1:Identifier _ "~" _ ctrl:("(" _ c:ControlPoint _ ")" { return c; })? _ p2:Identifier _ "=" _ target:Identifier {
      return {
        type: "Midpoint",
        p1: p1,
        p2: p2,
        control: ctrl,
        target: target
      };
    }

ConnectionOperator
  = "<" inner:[.\\-]* ">" { return inner.join(""); }
  / "-" inner:[.\\-]* "-" { return "-" + inner.join("") + "-"; }
  / "--" { return "--"; }
  / ".." { return ".."; }
  / "-" { return "-"; }

ControlPointList
  = head:ControlPoint tail:(_ c:ControlPoint { return c; })* {
      return [head, ...tail];
    }

ControlPoint
  = "(" _ p:MathExpression _ "," _ a:MathExpression _ "," _ d:MathExpression _ ")" {
      return { pct: p, ang: a, dst: d };
    }
  / "(" _ p:MathExpression _ ")" {
      return { pct: p, ang: "0", dst: "0" };
    }

ArgumentList
  = head:MathExpression tail:(_ "," _ e:MathExpression { return e; })* {
      return [head, ...tail];
    }

MathExpression
  = chars:[^ \\n\\t\\r,\\]\\)=]+ { return chars.join(""); }

StringLiteral
  = "\\"" chars:[^\\"]* "\\"" { return chars.join(""); }
  / chars:[^ \\n\\t\\r]+ { return chars.join(""); }

Identifier
  = chars:[a-zA-Z_][a-zA-Z0-9_]* { return chars.join(""); }

Comment
  = "//" [^\\n]*

_ "whitespace"
  = [ \\t]*

EOF
  = !.
`;

    let _generatedParser = null;
    function getParser() {
        if (!_generatedParser && window.peggy) {
            try {
                _generatedParser = peggy.generate(ZUHYO_GRAMMAR);
            } catch (e) {
                console.error("Failed to generate Peggy parser:", e);
            }
        }
        return _generatedParser;
    }

    /* ── Legacy Compat ── */
    function extractHeader(code) {
        const lines = code.split('\n');
        for (const raw of lines) {
            const ln = raw.replace(/\/\/.*$/, '').trim();
            const m = ln.match(/^ID\s*=\s*([a-zA-Z_]+)(?:\(([^)]*)\))?/);
            if (m) {
                const name = m[1];
                const params = m[2] ? m[2].split(',').map(s => s.trim().replace(/^\[|\]$/g, '')).filter(Boolean) : [];
                return { name, params };
            }
        }
        return { name: 'unnamed', params: [] };
    }

    function parseDotDash(code, argVals) {
        argVals = argVals || {};
        if (window._zGV) {
            argVals = Object.assign({}, window._zGV, argVals);
        }

        // Variable substitution (legacy)
        let src = code;
        for (const [k, v] of Object.entries(argVals)) {
            src = src.replace(new RegExp('\\\\[' + k + '\\\\]', 'g'), String(v));
        }

        const parser = getParser();
        if (!parser) {
            return { pts: { o: { x: 0, y: 0 } }, cmds: [], errs: ["Parser not initialized (Peggy missing?)"] };
        }

        try {
            const ast = parser.parse(src);
            return transformAST(ast, argVals);
        } catch (e) {
            const loc = e.location ? `L${e.location.start.line}:${e.location.start.column}` : "Parse Error";
            return {
                pts: { o: { x: 0, y: 0 } },
                cmds: [],
                errs: [`${loc}: ${e.message}`]
            };
        }
    }

    function _toAlpha(n) {
        let s = '', chars = 'abcdefghijklmnopqrstuvwxyz';
        do { s = chars[n % 26] + s; n = Math.floor(n / 26) - 1; } while (n >= 0);
        return s;
    }

    /* ── AST Transformer ── */
    function transformAST(ast, argVals) {
        const pts = { o: { x: 0, y: 0 } };
        const vars = Object.assign({}, argVals);
        pts._vars = vars;
        const cmds = [];
        const errs = [];
        let lastAng = 0, lastDst = 1;

        ast.body.forEach((stmt) => {
            if (!stmt) return;

            switch (stmt.type) {
                case "IDAssignment":
                    cmds.push({ type: 'id', raw: stmt.id });
                    break;

                case "MathAssignment":
                    try {
                        vars[stmt.varName] = _evalMath(stmt.expression, vars);
                    } catch (e) {
                        errs.push(`Math error: ${e.message}`);
                    }
                    break;

                case "PointDefinition":
                    try {
                        const angVal = stmt.angle[0] === '+' ? lastAng + _evalMath(stmt.angle.slice(1), vars) : _evalMath(stmt.angle, vars);
                        const dstVal = stmt.distance[0] === '+' ? lastDst + _evalMath(stmt.distance.slice(1), vars) : _evalMath(stmt.distance, vars);
                        const from = pts[stmt.from];
                        if (!from) {
                            errs.push(`Undefined point '${stmt.from}'`);
                        } else {
                            const rad = angVal * Math.PI / 180;
                            pts[stmt.target] = {
                                x: from.x + dstVal * Math.cos(rad),
                                y: from.y + dstVal * Math.sin(rad)
                            };
                            lastAng = angVal;
                            lastDst = Math.abs(dstVal);
                            cmds.push({ type: 'pt_def', id: stmt.target, x: pts[stmt.target].x, y: pts[stmt.target].y });
                        }
                    } catch (e) {
                        errs.push(`Point definition error: ${e.message}`);
                    }
                    break;

                case "LineConnection":
                    let currentId = stmt.base;
                    stmt.segments.forEach((seg) => {
                        const A = pts[currentId];
                        const B = pts[seg.target];
                        if (!A) errs.push(`Undefined point '${currentId}'`);
                        else if (!B) errs.push(`Undefined point '${seg.target}'`);
                        else {
                            const lt = _lineType(seg.operator);
                            const resolvedCtrl = seg.controls.map(cp => ({
                                pct: _evalMath(cp.pct.replace('%', ''), vars) / 100,
                                ang: _evalMath(cp.ang, vars),
                                dst: _evalMath(cp.dst, vars)
                            }));
                            cmds.push({
                                type: 'line',
                                from: currentId,
                                to: seg.target,
                                lt: lt,
                                ctrl: resolvedCtrl
                            });
                        }
                        currentId = seg.target;
                    });
                    break;

                case "Midpoint":
                    const p1 = pts[stmt.p1], p2 = pts[stmt.p2];
                    if (p1 && p2) {
                        try {
                            const t = stmt.control ? _evalMath(stmt.control.pct.replace('%', ''), vars) / 100 : 0.5;
                            const oAng = stmt.control ? _evalMath(stmt.control.ang, vars) : 0;
                            const oDst = stmt.control ? _evalMath(stmt.control.dst, vars) : 0;
                            const mx = p1.x + (p2.x - p1.x) * t;
                            const my = p1.y + (p2.y - p1.y) * t;
                            const rad = oAng * Math.PI / 180;
                            pts[stmt.target] = {
                                x: mx + oDst * Math.cos(rad),
                                y: my + oDst * Math.sin(rad)
                            };
                            cmds.push({ type: 'pt_def', id: stmt.target, x: pts[stmt.target].x, y: pts[stmt.target].y });
                        } catch (e) {
                            errs.push(`Midpoint error: ${e.message}`);
                        }
                    } else {
                        errs.push(`Midpoint: undefined point(s)`);
                    }
                    break;

                case "Command":
                    handleCommand(stmt, pts, vars, cmds, errs);
                    break;
            }
        });

        return { pts, cmds, errs };
    }

    function handleCommand(cmd, pts, vars, cmds, errs) {
        switch (cmd.name) {
            case "fill":
                cmds.push({
                    type: 'fill',
                    style: cmd.style.toLowerCase(),
                    args: cmd.args.map(a => _evalMath(a, vars))
                });
                break;
            case "repeat":
                try {
                    let N = Math.round(_evalMath(cmd.n, vars));
                    if (N > 1000) N = 1000; // Safety limit
                    if (N < 1) N = 1;
                    const from = pts[cmd.from];
                    const dist = _evalMath(cmd.dist, vars);
                    const startAng = _evalMath(cmd.startAngle, vars);
                    if (from) {
                        const step = 360 / N;
                        for (let ri = 0; ri < N; ri++) {
                            const ang = startAng + step * ri;
                            const rad = ang * Math.PI / 180;
                            const nId = cmd.prefix + '_' + _toAlpha(ri);
                            pts[nId] = { x: from.x + dist * Math.cos(rad), y: from.y + dist * Math.sin(rad) };
                            cmds.push({ type: 'pt_def', id: nId, x: pts[nId].x, y: pts[nId].y });
                            if (ri > 0) {
                                const prevId = cmd.prefix + '_' + _toAlpha(ri - 1);
                                cmds.push({ type: 'line', from: prevId, to: nId, lt: { style: 'solid', dash: [] }, ctrl: [] });
                            }
                        }
                        const first = cmd.prefix + '_' + _toAlpha(0), last = cmd.prefix + '_' + _toAlpha(N - 1);
                        if (pts[first] && pts[last]) {
                            cmds.push({ type: 'line', from: last, to: first, lt: { style: 'solid', dash: [] }, ctrl: [] });
                        }
                    }
                } catch (e) { errs.push(`Repeat error: ${e.message}`); }
                break;
            case "intersect":
                const pA = pts[cmd.points[0]], pB = pts[cmd.points[1]], pC = pts[cmd.points[2]], pD = pts[cmd.points[3]];
                if (pA && pB && pC && pD) {
                    const dx1 = pB.x - pA.x, dy1 = pB.y - pA.y;
                    const dx2 = pD.x - pC.x, dy2 = pD.y - pC.y;
                    const denom = dx1 * dy2 - dy1 * dx2;
                    if (Math.abs(denom) > 1e-10) {
                        const t = ((pC.x - pA.x) * dy2 - (pC.y - pA.y) * dx2) / denom;
                        pts[cmd.target] = { x: pA.x + t * dx1, y: pA.y + t * dy1 };
                        cmds.push({ type: 'pt_def', id: cmd.target, x: pts[cmd.target].x, y: pts[cmd.target].y });
                    }
                }
                break;
            case "plot":
                let start = _evalMath(cmd.range.start, vars);
                let end = _evalMath(cmd.range.end, vars);
                let step = Math.abs(_evalMath(cmd.range.step, vars));
                
                // Safety: prevent infinite loops or excessive iterations
                if (step < 0.0001) step = 0.1; 
                if (Math.abs(end - start) / step > 5000) {
                    step = Math.abs(end - start) / 5000;
                }

                cmds.push({
                    type: 'plot',
                    expr: cmd.expression,
                    start: start,
                    end: end,
                    step: (end > start ? step : -step),
                    vars: Object.assign({}, vars)
                });
                break;
            case "text":
                cmds.push({ type: 'text', content: cmd.content, p1: cmd.p1, p2: cmd.p2 });
                break;
            case "label":
                cmds.push({ type: 'label', content: cmd.content, p1: cmd.p1, size: _evalMath(cmd.size, vars) });
                break;
        }
    }

    function _evalMath(expr, vars) {
        vars = vars || {};
        let cleanExpr = String(expr).trim();
        if (!cleanExpr) return 0;
        
        // Unwrap math() or {}
        if (cleanExpr.toLowerCase().startsWith('math(') && cleanExpr.endsWith(')')) {
            cleanExpr = cleanExpr.substring(5, cleanExpr.length - 1);
        } else if (cleanExpr.startsWith('{') && cleanExpr.endsWith('}')) {
            cleanExpr = cleanExpr.substring(1, cleanExpr.length - 1);
        }

        // Replace variables [var]
        let processed = cleanExpr.replace(/\[([a-zA-Z_]+)\]/g, (_, v) => vars[v] !== undefined ? String(vars[v]) : '0');
        
        // Add Math. prefix to common functions
        const mathFuncs = ['sin', 'cos', 'tan', 'sqrt', 'abs', 'pow', 'max', 'min', 'floor', 'ceil', 'round', 'exp', 'log', 'pi', 'e', 'x'];
        processed = processed.replace(/\b([a-zA-Z_]+)\b/g, (match) => {
            const low = match.toLowerCase();
            if (mathFuncs.includes(low)) {
                if (low === 'pi') return 'Math.PI';
                if (low === 'e') return 'Math.E';
                if (low === 'x') return 'x';
                return 'Math.' + low;
            }
            if (vars[match] !== undefined) return String(vars[match]);
            return '0';
        });

        if (!/^[0-9+\-*/()\[\]a-zA-Z_.,\sMath.PIE]*$/.test(processed)) return 0;
        try {
            return Function('"use strict"; return (' + processed + ')')();
        } catch (e) {
            console.warn('Math evaluation error:', e, processed);
            return 0;
        }
    }

    function _lineType(inner) {
        const map = {
            '-': { style: 'solid', dash: [] },
            '..': { style: 'dotted', dash: [2, 5] },
            '--': { style: 'dashed', dash: [9, 6] },
            '-.-': { style: 'dashdot', dash: [10, 4, 2, 4] },
            '-..-': { style: 'dashdot2', dash: [10, 4, 2, 4, 2, 4] },
            '': { style: 'invis', dash: null }
        };
        // PEG.js might return < - > with spaces or just the inner part
        const clean = inner.replace(/[<>]/g, '');
        return map[clean] || { style: 'solid', dash: [] };
    }

    // Export globally
    window.ZuhyoMath = {
        eval: _evalMath,
        parseDotDash: parseDotDash,
        extractHeader: extractHeader,
        evalExpr: (expr, vars) => _evalMath(expr, vars || {})
    };
    window.parseDotDash = parseDotDash; // Legacy global
    window.extractHeader = extractHeader; // Legacy global
})();
