/* ================================================================
     図描 (Zuhyo) — app.js
     Application state, UI management, events.
     Depends on: parser.js, highlighter.js, renderer.js
     ================================================================ */

/* ================================================================
     DEFAULT EXAMPLES
     ================================================================ */
var EXAMPLES = {
    square: [
        'ID = square',
        '',
        '// 原点O右下から、辺の半分の距離',
        '315o0.5 = a',
        '90a1 = b',
        '+90b1 = c',
        '+90c1 = d',
        '',
        'a <-> b <-> c <-> d <-> a',
        'fill: cross(45, 1, 0.5)'
    ].join('\n'),

    circle: [
        'ID = circle',
        '',
        '// 半円を2つ組み合わせて正円を作成',
        '0o1 = a',
        '180o1 = b',
        '',
        'a <->(50%, 90, 1) b',
        'b <->(50%, 270, 1) a',
        'fill: dot(0, 0, 0.5)'
    ].join('\n'),

    triangle: [
        'ID = triangle',
        '',
        '// 正三角形',
        '210o1 = a',
        '330o1 = b',
        '90o1 = c',
        '',
        'a <-> b <-> c <-> a',
        'fill: dot(0, 0, 0.3)'
    ].join('\n'),

    graph: [
        'ID = sine_wave',
        '',
        '// グラフ描画',
        'plot: sin(x) [-5, 5, 0.1]',
        '',
        '// 軸の端にラベル',
        '0o5 = endX',
        '180o5 = startX',
        'text: "x-axis" startX endX'
    ].join('\n'),


    text_label: [
        'ID = text_label([size], [content])',
        '',
        '// 地点を定義',
        '0o0 = a',
        '',
        '// 地点ラベル',
        'label: "[content]" a [size]'
    ].join('\n')
};

/* ================================================================
     STATE
     ================================================================ */
var _idCtr = 1;
function nextId(prefix) { return prefix + '_' + (_idCtr++); }

var APP = {
    project: {
        name: 'Untitled',
        structures: [],    // [{ id, name, code }]
        instances:    []     // [{ id, structId, args:{}, offsetX, offsetY }]
    },
    ui: {
        currentStructId: null,
        selectedInstId:    null,
        dirty: false
    }
};

var proj = function() { return APP.project; };
function getStruct(id)     { return proj().structures.filter(function(s) { return s.id === id; })[0] || null; }
function getInstance(id) { return proj().instances.filter(function(i)    { return i.id === id; })[0] || null; }

/* ================================================================
     UNDO / REDO
     ================================================================ */
var UNDO_STACK = [];
var REDO_STACK = [];
var MAX_UNDO     = 50;

function pushUndo() {
    var snap = JSON.stringify({
        project: APP.project,
        ui: {
            currentStructId: APP.ui.currentStructId,
            selectedInstId: APP.ui.selectedInstId
        },
        idCtr: _idCtr
    });
    
    if (UNDO_STACK.length > 0 && UNDO_STACK[UNDO_STACK.length - 1] === snap) return;
    UNDO_STACK.push(snap);
    if (UNDO_STACK.length > MAX_UNDO) UNDO_STACK.shift();
    REDO_STACK = []; // Clear redo on new action
}

function undo() {
    if (UNDO_STACK.length < 1) return;
    var current = JSON.stringify({
        project: APP.project,
        ui: {
            currentStructId: APP.ui.currentStructId,
            selectedInstId: APP.ui.selectedInstId
        },
        idCtr: _idCtr
    });
    REDO_STACK.push(current);
    var snap = JSON.parse(UNDO_STACK.pop());
    _applySnap(snap);
}

function redo() {
    if (REDO_STACK.length < 1) return;
    var current = JSON.stringify({
        project: APP.project,
        ui: {
            currentStructId: APP.ui.currentStructId,
            selectedInstId: APP.ui.selectedInstId
        },
        idCtr: _idCtr
    });
    UNDO_STACK.push(current);
    var snap = JSON.parse(REDO_STACK.pop());
    _applySnap(snap);
}

function _applySnap(snap) {
    APP.project = snap.project;
    APP.ui.currentStructId = snap.ui.currentStructId;
    APP.ui.selectedInstId = snap.ui.selectedInstId;
    renderer.selInstId = snap.ui.selectedInstId;
    _idCtr = snap.idCtr;
    
    renderAll();
    renderer.updateProject(proj());
    
    // Sync editor if visible
    if (APP.ui.currentStructId) {
        var s = getStruct(APP.ui.currentStructId);
        if (s && edEl.value !== s.code) {
            edEl.value = s.code;
            updateHL(); updateLN(); updateHints();
        }
    }
}

/* ── Project mutations ── */

function addStructure(name, code) {
    pushUndo();
    var id = nextId('s');
    name     = name || '新しい構造';
    code     = code || ('ID = ' + name + '\n\n// ここに点を定義してください\n// 例: 90o1 = a\n');
    var s    = { id: id, name: name, code: code };
    proj().structures.push(s);
    APP.ui.currentStructId = id;
    renderStructList();
    renderEditor();
    markDirty();
    return s;
}

function deleteStructure(id) {
    pushUndo();
    proj().structures = proj().structures.filter(function(s) { return s.id !== id; });
    proj().instances    = proj().instances.filter(function(i)    { return i.structId !== id; });
    if (APP.ui.currentStructId === id) {
        APP.ui.currentStructId = proj().structures[0] ? proj().structures[0].id : null;
    }
    if (APP.ui.selectedInstId && !getInstance(APP.ui.selectedInstId)) {
        APP.ui.selectedInstId = null;
        closeInspector();
    }
    renderAll();
    renderer.updateProject(proj());
    markDirty();
}

function callStructure(structId) {
    pushUndo();
    var s = getStruct(structId);
    if (!s) return;
    var header = extractHeader(s.code);
    var args     = {};
    header.params.forEach(function(p) { args[p] = 1; });
    var inst = { id: nextId('i'), structId: structId, args: args, offsetX: 0, offsetY: 0 };
    proj().instances.push(inst);
    APP.ui.selectedInstId = inst.id;
    renderer.selInstId = inst.id;
    renderer.updateProject(proj());
    renderInspector();
    markDirty();
}

function deleteInstance(id) {
    pushUndo();
    proj().instances = proj().instances.filter(function(i) { return i.id !== id; });
    if (APP.ui.selectedInstId === id) {
        APP.ui.selectedInstId = null;
        renderer.selInstId        = null;
        closeInspector();
    }
    renderer.updateProject(proj());
    markDirty();
}

function updateInstance(id, changes) {
    var inst = getInstance(id);
    if (!inst) return;
    Object.keys(changes).forEach(function(k) { inst[k] = changes[k]; });
    renderer.updateProject(proj());
    markDirty();
}

/* ================================================================
     CODE EDITOR
     ================================================================ */
var edEl        = document.getElementById('code-ed');
var hlEl        = document.getElementById('hl-layer');
var lnEl        = document.getElementById('line-nums');
var errIcon = document.getElementById('err-icon');
var errTxt    = document.getElementById('err-txt');
var HINTS_VISIBLE = true;

var _parseTimer = null;

edEl.addEventListener('input', function() {
    updateHL(); updateLN(); updateHints();
    clearTimeout(_parseTimer);
    _parseTimer = setTimeout(syncEditorToState, 80);
});

edEl.addEventListener('scroll', function() {
    hlEl.scrollTop    = edEl.scrollTop;
    hlEl.scrollLeft = edEl.scrollLeft;
    lnEl.scrollTop    = edEl.scrollTop;
});

edEl.addEventListener('keydown', function(e) {
    if (e.ctrlKey && (e.key === 'h' || e.key === 'H')) {
        e.preventDefault();
        HINTS_VISIBLE = !HINTS_VISIBLE;
        updateHints();
        return;
    }
    if (e.key !== 'Tab') return;
    e.preventDefault();
    var s     = edEl.selectionStart, end = edEl.selectionEnd;
    edEl.value = edEl.value.slice(0, s) + '        ' + edEl.value.slice(end);
    edEl.selectionStart = edEl.selectionEnd = s + 4;
    updateHL(); updateLN();
});

function getHintContainer() {
    var hintsEl = document.getElementById('code-hints');
    if (!hintsEl) {
        hintsEl = document.createElement('div');
        hintsEl.id = 'code-hints';
        hintsEl.style.cssText = 'padding:8px 12px;font-size:11px;color:#666;background:#fafafa;border-top:1px solid #ddd;font-family:monospace;user-select:none;max-height:60px;overflow-y:auto;line-height:1.4;';
        var editorSection = edEl.parentNode.parentNode.parentNode;
        var errorBar = editorSection.querySelector('.error-bar');
        if (errorBar) {
            editorSection.insertBefore(hintsEl, errorBar);
        } else {
            editorSection.appendChild(hintsEl);
        }
    }
    return hintsEl;
}

function updateHints() {
    var hints = [];
    var lines = edEl.value.split('\n');
    var pos = edEl.selectionStart;
    var lineStart = 0;
    var currentLineNum = -1;
    var recognized = false;
    
    // Find current line
    for (var i = 0; i < lines.length; i++) {
        var lineEnd = lineStart + lines[i].length + 1;
        if (pos < lineEnd) {
            currentLineNum = i;
            var line = lines[i];
            var inLinePos = pos - lineStart;
            var trimmed = line.trim();
            
            // Skip comments
            if (trimmed.startsWith('//')) {
                recognized = true;
                if (HINTS_VISIBLE) hints.push('💬 Comment (ignored during parsing)');
                break;
            }
            
            // ── ID declaration with parameters ──
            if (/^ID\s*=/.test(trimmed)) {
                recognized = true;
                if (HINTS_VISIBLE) {
                    hints.push('🏷️ Structure: ID = structureName([param1], [param2], ...)');
                    hints.push('💡 Example: ID = cylinder([radius], [height])');
                }
                break;
            }
            
            // ── [var] = math(expr) ──
            if (/^\[.*\]\s*=\s*math/i.test(trimmed)) {
                recognized = true;
                if (HINTS_VISIBLE) {
                    var mathStart = line.indexOf('(');
                    var mathEnd = line.lastIndexOf(')');
                    if (mathStart >= 0 && inLinePos > mathStart && (mathEnd < 0 || inLinePos <= mathEnd)) {
                        hints.push('🔢 Math: sin(x) | cos(x) | tan(x) | sqrt(x) | abs(x) | pow(a,b)');
                        hints.push('📊 Math: max(a,b) | min(a,b) | floor(x) | ceil(x) | round(x) | exp(x) | log(x)');
                        hints.push('⭐ Constants: pi | e');
                        hints.push('📌 Variables: [varname] | Operators: +, -, *, /, (, )');
                    } else {
                        hints.push('📐 Variable Definition: [varname] = math(expression)');
                        hints.push('💡 Example: [size] = math([radius] * 2 + 1)');
                    }
                }
                break;
            }
            
            // ── fill: style(args) ──
            if (/^fill\s*:/i.test(trimmed)) {
                recognized = true;
                if (HINTS_VISIBLE) {
                    var styleMatch = line.match(/fill\s*:\s*(\w+)/i);
                    var openParen = line.indexOf('(');
                    var closeParen = line.indexOf(')');
                    
                    if (styleMatch) {
                        var style = styleMatch[1].toLowerCase();
                        hints.push('🎨 Fill Styles: none | dot | line | hatch | cross | grid');
                    }
                    
                    if (openParen >= 0 && inLinePos > openParen && (closeParen < 0 || inLinePos <= closeParen)) {
                        if (styleMatch) {
                            var fillStyle = styleMatch[1].toLowerCase();
                            if (fillStyle === 'dot') {
                                hints.push('⭐ dot(offset, density) - offset & density adjust pattern');
                            } else if (['line', 'hatch', 'cross', 'grid'].indexOf(fillStyle) >= 0) {
                                hints.push('⭐ ' + fillStyle + '(angle, spacing, density)');
                                hints.push('     angle: 0-360° | spacing: 0.1+ | density: 0.05+');
                            } else {
                                hints.push('💡 Args: angle, spacing, density (angle-based fill)');
                            }
                        }
                    } else {
                        hints.push('💡 Example: fill: cross(45, 1.5, 1)');
                    }
                }
                break;
            }
            
            // ── Line definition: a <conn> b ──
            if (line.includes('<') && line.includes('>')) {
                var inConnector = false;
                var connStart = line.indexOf('<');
                var connEnd = line.indexOf('>');
                if (connStart < inLinePos && inLinePos <= connEnd) {
                    inConnector = true;
                }
                
                hints.push('━ Line Connectors:');
                hints.push('    -    (solid) | .. (dotted) | -- (dashed)');
                hints.push('📌 Arcs/Curves: <->(pct%, angle, dist) - Circular arc (1 ctrl)');
                hints.push('📌 Bezier: <->(c1)(c2) - Cubic Bezier (2+ ctrl)');
                
                if (inConnector) {
                    hints.push('💡 Example: a <->(50%, 90, 1) b (Arc)');
                } else {
                    hints.push('💡 Example: a <-> b    or    a <->(ctrl) b');
                }
                break;
            }
            
            // ── Midpoint: a~(pct,ang,dst)b = name ──
            if (line.includes('~') && line.includes('(')) {
                var tildeParen = /~\([^)]*\)/;
                if (tildeParen.test(line)) {
                    if (inLinePos > line.indexOf('(') - 1 && inLinePos < (line.lastIndexOf(')') + 1)) {
                        hints.push('🎯 Midpoint: a~(pct%, angle, distance)b = name');
                        hints.push('     pct: 0-100% (position on line)');
                        hints.push('     angle: direction offset from midpoint (degrees)');
                        hints.push('     distance: offset distance from midpoint');
                        hints.push('💡 Example: a~(50%, 90, 0.5)b = peak');
                    } else {
                        hints.push('🎯 Midpoint Definition: a~(pct%, angle, dist)b = newPoint');
                    }
                }
                break;
            }
            
            // ── Point definition: angle pointId distance = newId ──
            if (/^\d+[a-zA-Z_]/.test(trimmed) && trimmed.includes('=') && !trimmed.includes('<')) {
                recognized = true;
                if (HINTS_VISIBLE) {
                    hints.push('📍 Point Definition: angle pointId distance = newId');
                    hints.push('     angle: 0° right, counterclockwise');
                    hints.push('     pointId: existing point reference');
                    hints.push('     distance: units (use +/- for relative)');
                    hints.push('💡 Example: 90a1 = b    (1 unit above a)');
                    hints.push('💡 Relative: +45b1 = c    (adds 45° to last angle)');
                }
                break;
            }
            
            // ── General syntax help at start of new line ──
            if (trimmed === '' || (i > 0 && !trimmed)) {
                recognized = true;
                if (HINTS_VISIBLE) {
                    hints.push('📝 Available Syntax:');
                    hints.push('    ID = name([params])    — Structure definition');
                    hints.push('    0o1 = name    — Point definition');
                    hints.push('    name <-> name    — Line definition');
                    hints.push('    a~(50%,angle,dist)b = name    — Midpoint');
                    hints.push('    a <...>(control) b    — Line with control point');
                    hints.push('    [var] = math(expr)    — Variable calculation');
                    hints.push('    fill: style(args)    — Fill pattern');
                    hints.push('    // comment    — Comment line');
                }
                break;
            }
            
            // Default hint
            if (hints.length === 0) {
                hints.push('? Unrecognized syntax. Type an example or press Ctrl+H for help.');
            }
            
            break;
        }
        lineStart = lineEnd;
    }
    
    // Display or hide hints
    var hintsEl = getHintContainer();
    if (!HINTS_VISIBLE && recognized) {
        hintsEl.style.display = 'none';
        return;
    }
    if (hints.length > 0) {
        hintsEl.innerHTML = hints.map(function(h) { return '<div>' + h + '</div>'; }).join('');
        hintsEl.style.display = 'block';
    } else {
        hintsEl.style.display = 'none';
    }
}

    // Global Hotkeys
document.addEventListener('keydown', function(e) {
    // Undo/Redo
    if (e.ctrlKey && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
        return;
    }
    if (e.ctrlKey && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault();
        redo();
        return;
    }

    // Delete key removes selected instance
    if (e.key === 'Delete'
            && APP.ui.selectedInstId
            && document.activeElement !== edEl) {
        e.preventDefault();
        deleteInstance(APP.ui.selectedInstId);
    }
    if (e.key === 'Escape' && APP.ui.selectedInstId) {
        APP.ui.selectedInstId = null;
        renderer.selInstId        = null;
        renderer.draw();
        closeInspector();
    }
});

function updateHL() {
    hlEl.innerHTML = highlight(edEl.value) + '\n';
}

function updateLN() {
    var n        = (edEl.value.match(/\n/g) || []).length + 1;
    var html = '';
    for (var i = 1; i <= n; i++) html += '<span>' + i + '</span>';
    lnEl.innerHTML = html;
}

function syncEditorToState() {
    var id = APP.ui.currentStructId;
    if (!id) return;
    var s = getStruct(id);
    if (!s) return;

    // Snapshot before change for undo
    if (edEl.value !== s.code) {
        // We only push undo if this is the first change in a while
        // or if the parser result transitions from error to OK or vice versa
        // But for simplicity, let's just push it once per "edit session"
        // Actually, edEl already debounces 80ms. Let's push before updating.
        pushUndo();
        s.code = edEl.value;
    }

    var h    = extractHeader(s.code);
    if (h.name !== s.name) {
        s.name = h.name;
        renderStructList();
    }

    // Show parse errors
    var result = parseDotDash(s.code, {});
    if (result.errs.length === 0) {
        errIcon.style.color    = '#4a9040';
        errIcon.textContent    = '●';
        errTxt.textContent     = 'エラーなし';
        document.getElementById('sdot').className = 'sdot';
        document.getElementById('stxt').textContent = 'OK';
    } else {
        errIcon.style.color    = '#c06030';
        errIcon.textContent    = '▲';
        errTxt.textContent     = result.errs[0] + (result.errs.length > 1 ? ' (+' + (result.errs.length - 1) + ')' : '');
        document.getElementById('sdot').className = 'sdot error';
        document.getElementById('stxt').textContent = 'ERROR';
    }

    renderer.updateProject(proj());
    renderInspector();
    updateHints();
    markDirty();
}

/* ================================================================
     RENDER FUNCTIONS
     ================================================================ */
function renderAll() {
    renderStructList();
    renderEditor();
    renderInspector();
}

function renderStructList() {
    var list = document.getElementById('struct-list');
    if (!proj().structures.length) {
        list.innerHTML = '<div class="empty-msg">構造がありません<br><small>「＋ 新規」で追加</small></div>';
        return;
    }

    var html = proj().structures.map(function(s) {
        var active = s.id === APP.ui.currentStructId ? ' active' : '';
        return (
            '<div class="struct-item' + active + '" data-id="' + s.id + '">' +
                '<div class="struct-name">' +
                    '<span class="struct-icon">◈</span>' +
                    '<span class="struct-label">' + _escHtml(s.name) + '</span>' +
                '</div>' +
                '<div class="struct-btns">' +
                    '<button class="btn btn-sm s-edit" data-id="' + s.id + '">✏ 編集</button>' +
                    '<button class="btn btn-sm s-call" data-id="' + s.id + '">▶ 呼出</button>' +
                    '<button class="btn btn-sm btn-danger s-del" data-id="' + s.id + '">✕</button>' +
                '</div>' +
            '</div>'
        );
    }).join('');
    list.innerHTML = html;

    list.querySelectorAll('.s-edit').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            APP.ui.currentStructId = btn.dataset.id;
            renderStructList();
            renderEditor();
        });
    });

    list.querySelectorAll('.s-call').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            callStructure(btn.dataset.id);
        });
    });

    list.querySelectorAll('.s-del').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            deleteStructure(btn.dataset.id);
        });
    });
}

function renderEditor() {
    var id = APP.ui.currentStructId;
    var s    = id ? getStruct(id) : null;
    var titleEl = document.getElementById('editor-panel-title');
    titleEl.textContent = s ? 'コード — ' + s.name : 'エディター（未選択）';
    edEl.value = s ? s.code : '';
    edEl.disabled = !s;
    updateHL(); updateLN(); updateHints();
    // Show current error state without triggering full sync/dirty
    if (s) {
        var result = parseDotDash(s.code, {});
        if (result.errs.length === 0) {
            errIcon.style.color = '#4a9040'; errIcon.textContent = '●';
            errTxt.textContent    = 'エラーなし';
        } else {
            errIcon.style.color = '#c06030'; errIcon.textContent = '▲';
            errTxt.textContent    = result.errs[0];
        }
    } else {
        errIcon.style.color = '#a09070'; errIcon.textContent = '○';
        errTxt.textContent    = '構造を選択してください';
    }
}

function renderInspector() {
    var id     = APP.ui.selectedInstId;
    var inst = id ? getInstance(id) : null;
    if (!inst) { closeInspector(); return; }

    var s = getStruct(inst.structId);
    if (!s) { closeInspector(); return; }

    openInspector();
    document.getElementById('insp-title').textContent = 'インスペクター';

    var header = extractHeader(s.code);
    var body     = document.getElementById('insp-body');

    var argsHtml = '';
    if (header.params.length) {
        var rows = header.params.map(function(p) {
            var raw = inst.args[p] !== undefined ? inst.args[p] : 1;
            var num = parseFloat(raw);
            var isNum = !isNaN(num);
            // スライダーの範囲: 値の ±10倍 または ±10 のいずれか大きい方
            var slMin = isNum ? Math.min(-Math.abs(num) * 10, -10) : -10;
            var slMax = isNum ? Math.max(Math.abs(num) * 10,    10) :    10;
            var slStep = isNum ? (Math.abs(slMax - slMin) / 200) : 0.1;
            return (
                '<div class="insp-row insp-row-arg">' +
                    '<label class="insp-label">[' + _escHtml(p) + ']</label>' +
                    '<div class="insp-arg-controls">' +
                        '<input class="insp-slider" type="range"' +
                            ' data-param="' + _escHtml(p) + '"' +
                            ' min="' + slMin + '" max="' + slMax + '" step="' + slStep.toFixed(4) + '"' +
                            ' value="' + (isNum ? num : 1) + '"' +
                            (isNum ? '' : ' disabled') + '>' +
                        '<input class="insp-input insp-numbox" type="text"' +
                            ' data-param="' + _escHtml(p) + '"' +
                            ' value="' + _escHtml(raw) + '">' +
                    '</div>' +
                '</div>'
            );
        }).join('');
        argsHtml = (
            '<div class="insp-section">' +
                '<div class="insp-section-title">引数</div>' +
                rows +
            '</div>'
        );
    }

    body.innerHTML = (
        '<div class="insp-section">' +
            '<div class="insp-section-title">構造</div>' +
            '<div class="insp-struct-name">' + _escHtml(s.name) + '</div>' +
            '<button class="btn btn-full insp-goto-btn" id="insp-goto">✏ このコードを編集</button>' +
        '</div>' +
        argsHtml +
        '<div class="insp-section">' +
            '<div class="insp-section-title">オフセット / 位置</div>' +
            '<div class="insp-row">' +
                '<label class="insp-label">X</label>' +
                '<input class="insp-input" type="number" step="0.25" id="insp-offx" value="' + (inst.offsetX || 0) + '">' +
            '</div>' +
            '<div class="insp-row">' +
                '<label class="insp-label">Y</label>' +
                '<input class="insp-input" type="number" step="0.25" id="insp-offy" value="' + (inst.offsetY || 0) + '">' +
            '</div>' +
            '<button class="btn btn-snap" id="btn-snap">グリッドにスナップ</button>' +
        '</div>' +
        '<div class="insp-section">' +
            '<button class="btn btn-danger btn-full" id="insp-del">✕ このインスタンスを削除</button>' +
        '</div>'
    );

    // Go-to-edit
    document.getElementById('insp-goto').addEventListener('click', function() {
        APP.ui.currentStructId = inst.structId;
        renderStructList();
        renderEditor();
    });

    // Args — スライダーとテキストボックスを双方向同期
    body.querySelectorAll('.insp-row-arg').forEach(function(row) {
        var slider = row.querySelector('.insp-slider');
        var numbox = row.querySelector('.insp-numbox');
        if (!slider || !numbox) return;
        var param = numbox.dataset.param;

        function applyVal(val) {
            inst.args[param] = val;
            renderer.updateProject(proj());
            markDirty();
        }

        // スライダー操作 → テキストに反映 → リアルタイム再描画
        slider.addEventListener('input', function() {
            var v = parseFloat(slider.value);
            numbox.value = parseFloat(v.toFixed(4));
            applyVal(numbox.value);
        });

        // テキスト変更 → スライダーに反映
        numbox.addEventListener('input', function() {
            var raw = numbox.value;
            var num = parseFloat(raw);
            if (!isNaN(num)) {
                // スライダー範囲を動的に拡張
                var slMin = Math.min(parseFloat(slider.min), num - Math.abs(num) * 0.5 - 1);
                var slMax = Math.max(parseFloat(slider.max), num + Math.abs(num) * 0.5 + 1);
                slider.min = slMin;
                slider.max = slMax;
                slider.disabled = false;
                slider.value = num;
            }
            applyVal(raw);
        });
    });

    // Offset
    document.getElementById('insp-offx').addEventListener('input', function(e) {
        inst.offsetX = parseFloat(e.target.value) || 0;
        renderer.updateProject(proj());
        markDirty();
    });
    document.getElementById('insp-offy').addEventListener('input', function(e) {
        inst.offsetY = parseFloat(e.target.value) || 0;
        renderer.updateProject(proj());
        markDirty();
    });

    // Snap to grid button
    document.getElementById('btn-snap').addEventListener('click', function() {
        var gs     = renderer.gridSize || 1;
        inst.offsetX = Math.round(inst.offsetX / gs) * gs;
        inst.offsetY = Math.round(inst.offsetY / gs) * gs;
        document.getElementById('insp-offx').value = inst.offsetX;
        document.getElementById('insp-offy').value = inst.offsetY;
        renderer.updateProject(proj());
        markDirty();
    });

    // Delete
    document.getElementById('insp-del').addEventListener('click', function() {
        deleteInstance(id);
    });
}

function openInspector() {
    document.getElementById('inspector').classList.add('open');
    // Resize canvas after transition
    setTimeout(resizeCanvas, 280);
}

function closeInspector() {
    document.getElementById('inspector').classList.remove('open');
    document.getElementById('insp-body').innerHTML = '';
    setTimeout(resizeCanvas, 280);
}

/* ================================================================
     DIRTY / TITLE
     ================================================================ */
function markDirty() {
    APP.ui.dirty = true;
    document.getElementById('dirty-mark').style.display = 'inline';
    document.title = '* ' + proj().name + ' — 図描';
}

function clearDirty() {
    APP.ui.dirty = false;
    document.getElementById('dirty-mark').style.display = 'none';
    document.title = proj().name + ' — 図描';
}

/* ================================================================
     FILE I/O
     ================================================================ */
function saveProject() {
    var data = {
        format:         'zuhyo',
        version:        '1.0',
        name:             proj().name,
        structures: proj().structures,
        instances:    proj().instances
    };
    var json = JSON.stringify(data, null, 2);
    var blob = new Blob([json], { type: 'application/json' });
    var url    = URL.createObjectURL(blob);
    _dl(url, (proj().name || 'diagram') + '.zy');
    URL.revokeObjectURL(url);
    clearDirty();
}

function loadProject(jsonText) {
    try {
        var data = JSON.parse(jsonText);
        if (data.format !== 'zuhyo') throw new Error('図描プロジェクトファイルではありません');

        // Update ID counter to avoid collisions
        var allIds = (data.structures || []).concat(data.instances || []).map(function(x) { return x.id || ''; });
        allIds.forEach(function(id) {
            var m = id.match(/_(\d+)$/);
            if (m) _idCtr = Math.max(_idCtr, parseInt(m[1]) + 1);
        });

        APP.project = {
            name:             data.name || 'Untitled',
            structures: data.structures || [],
            instances:    data.instances    || []
        };
        APP.ui.currentStructId = proj().structures[0] ? proj().structures[0].id : null;
        APP.ui.selectedInstId    = null;
        renderer.selInstId         = null;
        closeInspector();
        renderAll();
        renderer.updateProject(proj());

        document.getElementById('project-name').value = proj().name;
        clearDirty();
    } catch (e) {
        alert('読み込みエラー: ' + e.message);
    }
}

function newProject() {
    pushUndo();
    APP.project = { name: 'Untitled', structures: [], instances: [] };
    APP.ui.currentStructId = null;
    APP.ui.selectedInstId    = null;
    renderer.selInstId         = null;
    _idCtr = 1;
    closeInspector();
    renderAll();
    renderer.updateProject(proj());
    document.getElementById('project-name').value = 'Untitled';
    clearDirty();
}

/* ================================================================
     RENDERER SETUP
     ================================================================ */
var renderer = new ZuhyoRenderer(document.getElementById('cv'));

renderer.onInstanceClick = function(instId) {
    APP.ui.selectedInstId = instId;
    renderer.selInstId        = instId;
    renderer.draw();
    renderInspector();
};

renderer.onInstanceDragStart = function(instId) {
    pushUndo();
};

renderer.onInstanceDrag = function(instId, ddx, ddy) {
    var inst = getInstance(instId);
    if (!inst) return;
    // Use a temporary drag state? No, let's update and re-parse.
    // To avoid heavy parsing, we could just offset existing points in renderer,
    // but for now, simple incremental update:
    inst.offsetX = (inst.offsetX || 0) + ddx;
    inst.offsetY = (inst.offsetY || 0) + ddy;
    
    // Real-time inspector update if open
    var ix = document.getElementById('insp-offx');
    var iy = document.getElementById('insp-offy');
    if (ix && iy && APP.ui.selectedInstId === instId) {
        ix.value = inst.offsetX.toFixed(2);
        iy.value = inst.offsetY.toFixed(2);
    }
    renderer.updateProject(proj(), true);
    markDirty();
};

renderer.onInstanceDragEnd = function(instId) {
    // Snap if needed? Or just final sync.
    renderer.updateProject(proj());
};

renderer.onMouseMove = function(wx, wy) {
    document.getElementById('mouse-coord').textContent =
        'x: ' + wx.toFixed(2) + '    y: ' + wy.toFixed(2);
};

renderer.onScaleChange = function(scale) {
    document.getElementById('zoom-val').textContent =
        Math.round(scale / 80 * 100) + '%';
};

/* ================================================================
     CANVAS RESIZE
     ================================================================ */
function resizeCanvas() {
    var area        = document.getElementById('canvas-area');
    var toolbar = area.querySelector('.canvas-toolbar');
    var cv            = document.getElementById('cv');
    cv.width    = area.clientWidth;
    cv.height = area.clientHeight - toolbar.offsetHeight;
    renderer.draw();
}
window.addEventListener('resize', function() { resizeCanvas(); });

/* ================================================================
     ANIMATION SYSTEM — [t] グローバル時間変数
     ================================================================ */
window._zGV = { t: 0 };                     // グローバル変数 (parseDotDash に注入される)
var _animPlaying = false;
var _animRAF         = null;
var _animLast        = null;
var ANIM_MAX_T     = 100;                        // スライダー最大値 (seconds)

function _animTick(now) {
    if (!_animPlaying) return;
    if (_animLast === null) _animLast = now;
    var dt     = (now - _animLast) / 1000;     // seconds
    _animLast = now;
    var speed = parseFloat(document.getElementById('anim-speed').value) || 1;
    window._zGV.t = (window._zGV.t + dt * speed) % ANIM_MAX_T;
    _animSyncUI();
    renderer.updateProject(proj(), true);
    _animRAF = requestAnimationFrame(_animTick);
}

function _animSyncUI() {
    var t = window._zGV.t;
    document.getElementById('anim-slider').value    = t;
    document.getElementById('anim-tlabel').textContent = 't=' + t.toFixed(2);
}

function _animPlay() {
    if (_animPlaying) return;
    _animPlaying = true;
    _animLast        = null;
    document.getElementById('btn-anim-play').textContent = '⏸';
    document.getElementById('btn-anim-play').title = '停止';
    _animRAF = requestAnimationFrame(_animTick);
}

function _animStop() {
    _animPlaying = false;
    _animLast        = null;
    if (_animRAF) { cancelAnimationFrame(_animRAF); _animRAF = null; }
    document.getElementById('btn-anim-play').textContent = '▶';
    document.getElementById('btn-anim-play').title = '再生';
}

function _animReset() {
    _animStop();
    window._zGV.t = 0;
    _animSyncUI();
    renderer.updateProject(proj(), true);
}

document.getElementById('btn-anim-play').addEventListener('click', function() {
    if (_animPlaying) _animStop(); else _animPlay();
});

document.getElementById('btn-anim-reset').addEventListener('click', _animReset);

document.getElementById('anim-slider').addEventListener('input', function() {
    _animStop();
    window._zGV.t = parseFloat(this.value);
    _animSyncUI();
    renderer.updateProject(proj(), true);
});

/* ================================================================
     THEME SYSTEM — テーマ切り替え
     ================================================================ */
var _themes = ['sepia', 'blueprint', 'dark', 'paper'];

function setTheme(name) {
    document.documentElement.setAttribute('data-theme', name);
    _themes.forEach(function(t) {
        var btn = document.getElementById('theme-' + t);
        if (btn) {
            btn.classList.toggle('active', t === name);
            btn.setAttribute('aria-checked', t === name ? 'true' : 'false');
        }
    });
    // キャンバス再描画（背景色がテーマで変わるため）
    renderer.draw();
    try { localStorage.setItem('zuhyo-theme', name); } catch(e) {}
}

_themes.forEach(function(t) {
    var btn = document.getElementById('theme-' + t);
    if (btn) btn.addEventListener('click', function() { setTheme(t); });
});

// 保存済みテーマを復元
(function() {
    var saved = 'sepia';
    try { saved = localStorage.getItem('zuhyo-theme') || 'sepia'; } catch(e) {}
    setTheme(saved);
})();

/* ================================================================
     TOOLBAR + CONTROLS
     ================================================================ */
document.getElementById('btn-reset-view').addEventListener('click', function() {
    renderer.resetView();
    document.getElementById('zoom-val').textContent = '100%';
});

document.getElementById('grid-snap').addEventListener('change', function(e) {
    // Toggle grid visibility (UI labeled "グリッド")
    renderer.showGrid = e.target.checked;
    renderer.draw();
});

document.getElementById('show-labels').addEventListener('change', function(e) {
    renderer.showLabels = e.target.checked;
    renderer.draw();
});

function setToolMode(mode) {
    renderer.toolMode = mode;
    var btnCam = document.getElementById('btn-tool-camera');
    var btnGrb = document.getElementById('btn-tool-grab');
    var cv = document.getElementById('cv');

    if (mode === 'camera') {
        btnCam.classList.add('active');
        btnCam.setAttribute('aria-pressed', 'true');
        btnGrb.classList.remove('active');
        btnGrb.setAttribute('aria-pressed', 'false');
        cv.classList.remove('grab-mode');
    } else {
        btnCam.classList.remove('active');
        btnCam.setAttribute('aria-pressed', 'false');
        btnGrb.classList.add('active');
        btnGrb.setAttribute('aria-pressed', 'true');
        cv.classList.add('grab-mode');
    }
}

document.getElementById('btn-tool-camera').addEventListener('click', function() { setToolMode('camera'); });
document.getElementById('btn-tool-grab').addEventListener('click', function() { setToolMode('grab'); });

document.getElementById('insp-close').addEventListener('click', function() {
    APP.ui.selectedInstId = null;
    renderer.selInstId        = null;
    renderer.draw();
    closeInspector();
});

/* ================================================================
     STRUCTURE PANEL ACTIONS
     ================================================================ */
document.getElementById('btn-add-struct').addEventListener('click', function() {
    var name = prompt('構造名を入力してください：', '新しい構造');
    if (name && name.trim()) addStructure(name.trim());
});

/* ================================================================
     HEADER ACTIONS
     ================================================================ */
document.getElementById('btn-new-project').addEventListener('click', newProject);
document.getElementById('btn-save').addEventListener('click', saveProject);
document.getElementById('btn-load').addEventListener('click', function() {
    document.getElementById('file-input').click();
});
document.getElementById('btn-manual').addEventListener('click', function() {
    document.getElementById('doc-title').textContent = "図描 v2.0 マニュアル";
    document.getElementById('doc-content').textContent = 
        "# 図描 (Zuhyo) 新機能ガイド\n\n" +
        "## 1. アニメーション [t]\n" +
        "再生ボタンを押すと [t] が 0 から 100 まで秒間 1 ずつ増加します。\n" +
        "例: `math([t]*60) o 1 = p` (点を回転させる)\n\n" +
        "## 2. リピート: repeat:\n" +
        "多角形や点群を一気に生成します。\n" +
        "書式: `repeat: 個数 中心 半径 [開始角度] = 名前` \n" +
        "例: `repeat: 6 o 2 [90] = v` (6角形を生成)\n\n" +
        "## 3. 交点: intersect:\n" +
        "2直線の交点を求めます。\n" +
        "書式: `intersect: p1 p2 p3 p4 = 交点名` \n\n" +
        "## 4. テーマ切り替え\n" +
        "右上のアイコン ◈ ◉ ○ でBlueprint、Dark、Paper、Sepiaを切り替えられます。";
    document.getElementById('doc-modal').style.display = 'flex';
});

window.ZuhyoAddonAPI.register({
    name: "くるくる・v2.0",
    version: "2.0",
    doc: "くるくる～するだけです",
    presets: {
        orbit: {
            name: "回転する多角形 (t + repeat)",
            code: "ID = animated_polygon\nrepeat: 6 o 2 [[t]*30] = p\nlabel: \"Rotating... [t]\" o"
        },
    }
});
document.getElementById('file-input').addEventListener('change', function(e) {
    var file = e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(ev) { loadProject(ev.target.result); };
    reader.readAsText(file);
    e.target.value = '';
});
document.getElementById('project-name').addEventListener('input', function(e) {
    proj().name = e.target.value || 'Untitled';
    markDirty();
});

/* ── Export menu ── */
document.getElementById('btn-export').addEventListener('click', function() {
    var menu = document.getElementById('export-menu');
    menu.classList.toggle('open');
});
document.addEventListener('click', function(e) {
    if (!e.target.closest('#export-wrap')) {
        document.getElementById('export-menu').classList.remove('open');
    }
});

document.getElementById('exp-png-t').addEventListener('click', function() { renderer.exportPNG(true);    });
document.getElementById('exp-png-w').addEventListener('click', function() { renderer.exportPNG(false); });
document.getElementById('exp-svg').addEventListener('click',     function() { renderer.exportSVG(); });
document.getElementById('exp-zy').addEventListener('click',        saveProject);

/* ── Plugin / Addon menu ── */
var btnPlugin = document.getElementById('btn-plugin');
if (btnPlugin) {
    btnPlugin.addEventListener('click', function() {
        var menu = document.getElementById('plugin-menu');
        var willOpen = !menu.classList.contains('open');
        if (willOpen) {
            menu.innerHTML = '';
            var addons = window.ZuhyoAddonAPI.addons || [];
            if (addons.length === 0) {
                menu.innerHTML = '<div style="padding: 12px; color: #888; font-size: 11px;">アドオンなし</div>';
            } else {
                // ── アドオンファイルのインポートボタン ──
                var importRow = document.createElement('div');
                importRow.style.cssText = 'padding: 8px 14px; border-bottom: 1px solid rgba(255,255,255,0.1); display:flex; gap:6px;';
                var importBtn = document.createElement('button');
                importBtn.textContent = '📂 .js / .zya を読み込む';
                importBtn.style.cssText = 'flex:1; font-size:11px; padding:6px 8px;';
                importBtn.addEventListener('click', function() {
                    var fi = document.createElement('input');
                    fi.type = 'file'; fi.accept = '.js,.zya,.json';
                    fi.addEventListener('change', function() {
                        if (fi.files[0]) window.ZuhyoAddonAPI.importFromFile(fi.files[0]);
                    });
                    fi.click();
                    menu.classList.remove('open');
                });
                importRow.appendChild(importBtn);
                menu.appendChild(importRow);

                addons.forEach(function(addon, index) {
                    // ── アドオンヘッダー行 ──
                    var headerRow = document.createElement('div');
                    headerRow.style.cssText = 'display:flex; align-items:center; border-bottom:1px solid var(--sepia-pale); background:rgba(255,255,255,0.05);';

                    var toggleBtn = document.createElement('button');
                    toggleBtn.title = '有効/無効';
                    toggleBtn.style.cssText = 'width:28px; padding:0; font-size:14px; border:none; background:none; cursor:pointer; flex-shrink:0;';
                    toggleBtn.textContent = addon.enabled !== false ? '✓' : '○';
                    toggleBtn.style.color    = addon.enabled !== false ? '#8dca60' : '#888';
                    toggleBtn.addEventListener('click', function(e) {
                        e.stopPropagation();
                        var next = !(addon.enabled !== false);
                        window.ZuhyoAddonAPI.setEnabled(addon.name, next);
                        addon.enabled = next;
                        toggleBtn.textContent = next ? '✓' : '○';
                        toggleBtn.style.color    = next ? '#8dca60' : '#888';
                    });
                    headerRow.appendChild(toggleBtn);

                    var expandBtn = document.createElement('button');
                    expandBtn.style.cssText = 'flex:1; font-weight:bold; color:var(--hdr-text); background:none; border:none; text-align:left; padding:10px 8px; cursor:pointer;';
                    expandBtn.innerHTML = (index === 0 ? '▼ ' : '▶ ') + addon.name +
                        (addon.version ? ' <span style="font-weight:normal;font-size:10px;color:#aaa;">v' + addon.version + '</span>' : '');
                    headerRow.appendChild(expandBtn);
                    menu.appendChild(headerRow);

                    var content = document.createElement('div');
                    content.style.display = index === 0 ? 'block' : 'none';
                    content.style.background = 'rgba(0,0,0,0.2)';

                    expandBtn.addEventListener('click', function(e) {
                        e.stopPropagation();
                        var isHidden = content.style.display === 'none';
                        content.style.display = isHidden ? 'block' : 'none';
                        expandBtn.innerHTML = (isHidden ? '▼ ' : '▶ ') + addon.name +
                            (addon.version ? ' <span style="font-weight:normal;font-size:10px;color:#aaa;">v' + addon.version + '</span>' : '');
                    });

                    if (addon.doc) {
                        var btnDoc = document.createElement('button');
                        btnDoc.textContent = '📚 ドキュメントを読む';
                        btnDoc.style.paddingLeft = '24px';
                        btnDoc.addEventListener('click', function() {
                            document.getElementById('doc-title').textContent = addon.name;
                            document.getElementById('doc-content').textContent = addon.doc;
                            document.getElementById('doc-modal').style.display = 'flex';
                            menu.classList.remove('open');
                        });
                        content.appendChild(btnDoc);
                    }

                    if (addon.commands && addon.commands.length) {
                        var clabel = document.createElement('div');
                        clabel.style.cssText = 'padding: 4px 14px 2px 24px; font-size: 10px; color: var(--sepia-light);';
                        clabel.textContent = 'コマンド: ' + addon.commands.map(function(c){return c.type;}).join(', ');
                        content.appendChild(clabel);
                    }

                    if (addon.presets) {
                        var pkeys = Object.keys(addon.presets);
                        if (pkeys.length > 0) {
                            var plabel = document.createElement('div');
                            plabel.style.cssText = 'padding: 6px 14px 2px 24px; font-size: 10px; color: var(--sepia-light);';
                            plabel.textContent = 'プリセット';
                            content.appendChild(plabel);

                            pkeys.forEach(function(pk) {
                                var pBtn = document.createElement('button');
                                pBtn.textContent = '▶ ' + addon.presets[pk].name;
                                pBtn.style.cssText = 'padding-left:24px; color:#e8d090;';
                                pBtn.addEventListener('click', function() {
                                    var p = addon.presets[pk];
                                    // 構造を追加してインスタンスを自動呼び出し (引数デフォルト=1)
                                    var s = window.addStructureRaw(p.name, p.code);
                                    if (s) {
                                        callStructure(s.id);
                                        APP.ui.currentStructId = s.id;
                                    }
                                    renderAll();
                                    menu.classList.remove('open');
                                });
                                content.appendChild(pBtn);
                            });
                        }
                    }
                    menu.appendChild(content);
                });
            }
        }
        menu.classList.toggle('open');
    });
}

document.addEventListener('click', function(e) {
    if (!e.target.closest('#plugin-wrap') && document.getElementById('plugin-menu')) {
        document.getElementById('plugin-menu').classList.remove('open');
    }
});

var docClose = document.getElementById('doc-close');
if (docClose) {
    docClose.addEventListener('click', function() {
        document.getElementById('doc-modal').style.display = 'none';
    });
}

/* ================================================================
     PANEL RESIZERS
     ================================================================ */
// Horizontal: left-panel ↔ canvas
(function() {
    var div        = document.getElementById('h-divider');
    var panel    = document.getElementById('left-panel');
    var active = false, startX = 0, startW = 0;
    div.addEventListener('mousedown', function(e) {
        active = true; startX = e.clientX; startW = panel.offsetWidth;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    });
    document.addEventListener('mousemove', function(e) {
        if (!active) return;
        var w = Math.max(180, Math.min(window.innerWidth - 280, startW + (e.clientX - startX)));
        panel.style.width = w + 'px';
        resizeCanvas();
    });
    document.addEventListener('mouseup', function() {
        if (!active) return;
        active = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
    });
})();

// Vertical: struct-panel ↕ editor-section
(function() {
    var div        = document.getElementById('v-divider');
    var top        = document.getElementById('struct-panel');
    var active = false, startY = 0, startH = 0;
    div.addEventListener('mousedown', function(e) {
        active = true; startY = e.clientY; startH = top.offsetHeight;
        document.body.style.cursor = 'row-resize';
        document.body.style.userSelect = 'none';
    });
    document.addEventListener('mousemove', function(e) {
        if (!active) return;
        var h = Math.max(48, Math.min(window.innerHeight - 180, startH + (e.clientY - startY)));
        top.style.height = h + 'px';
    });
    document.addEventListener('mouseup', function() {
        if (!active) return;
        active = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
    });
})();

/* ================================================================
     UTILITY
     ================================================================ */
function _escHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/* ================================================================
     INIT
     ================================================================ */
(function init() {
    // Load examples as initial structures
    var exKeys = ['square', 'circle', 'triangle', 'graph', 'text_label'];
    exKeys.forEach(function(key) {
        var code = EXAMPLES[key];
        var hdr    = extractHeader(code);
        var id     = nextId('s');
        proj().structures.push({ id: id, name: hdr.name, code: code });
    });

    // Start editing the first structure
    APP.ui.currentStructId = proj().structures[0].id;

    // Call square by default but don't open inspector on start
    var firstId     = proj().structures[0].id;
    var firstCode = proj().structures[0].code;
    var header        = extractHeader(firstCode);
    var args            = {};
    header.params.forEach(function(p) { args[p] = 1; });
    var inst = { id: nextId('i'), structId: firstId, args: args, offsetX: 0, offsetY: 0 };
    proj().instances.push(inst);
    // Don't select — inspector stays closed on start

    resizeCanvas();
    renderer.updateProject(proj());
    renderInspector(); 
    renderAll();
    clearDirty();
})();

/* ================================================================
     EXPORTS FOR ADDON API
     ================================================================ */
window.addStructureRaw = function(name, code) {
    pushUndo();
    var hdr    = extractHeader(code);
    var id     = nextId('s');
    // ヘッダーが 'unnamed' の場合は引数名を使用
    var sName = (hdr.name && hdr.name !== 'unnamed') ? hdr.name : name;
    var s = { id: id, name: sName, code: code };
    proj().structures.push(s);
    // エディターを自動で切り替え
    APP.ui.currentStructId = id;
    renderStructList();
    renderEditor();
    markDirty();
    return s;
};
window.getStruct                = getStruct;
window.proj                         = proj;
window.renderer                 = renderer;
window.renderStructList = renderStructList;
window.callStructure        = callStructure;
window.setTheme                 = setTheme;
window.animPlay                 = _animPlay;
window.animStop                 = _animStop;
window.animReset                = _animReset;
