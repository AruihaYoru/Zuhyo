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
    'fill: cross'
  ].join('\n'),

  circle: [
    'ID = circle([radius])',
    '',
    '// 左右に定義',
    '0o[radius] = a',
    '180o[radius] = b',
    '',
    '// 上下の半円で合成',
    'a <->(50%, 90,[radius]) b <->(50%, 270,[radius]) a',
    'fill: dot'
  ].join('\n'),

  cylinder: [
    'ID = cylinder',
    '',
    '0o1 = a',
    '180o1 = b',
    '',
    '// 上面楕円',
    'a <->(50%, 90,0.5) b',
    'b <->(50%, 270,0.5) a',
    'fill: none',
    '',
    '// 下面',
    '270a3 = c',
    '270b3 = d',
    '',
    'c <->(50%, 90,0.5) d',
    'd <..>(50%, 270,0.5) c',
    'fill: line',
    '',
    '// 縦線',
    'a <-> c',
    'b <-> d'
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
    'fill: dot'
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
    structures: [],  // [{ id, name, code }]
    instances:  []   // [{ id, structId, args:{}, offsetX, offsetY }]
  },
  ui: {
    currentStructId: null,
    selectedInstId:  null,
    dirty: false
  }
};

var proj = function() { return APP.project; };
function getStruct(id)   { return proj().structures.filter(function(s) { return s.id === id; })[0] || null; }
function getInstance(id) { return proj().instances.filter(function(i)  { return i.id === id; })[0] || null; }

/* ── Project mutations ── */

function addStructure(name, code) {
  var id = nextId('s');
  name   = name || '新しい構造';
  code   = code || ('ID = ' + name + '\n\n// ここに点を定義してください\n// 例: 90o1 = a\n');
  var s  = { id: id, name: name, code: code };
  proj().structures.push(s);
  APP.ui.currentStructId = id;
  renderStructList();
  renderEditor();
  markDirty();
  return s;
}

function deleteStructure(id) {
  proj().structures = proj().structures.filter(function(s) { return s.id !== id; });
  proj().instances  = proj().instances.filter(function(i)  { return i.structId !== id; });
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
  var s = getStruct(structId);
  if (!s) return;
  var header = extractHeader(s.code);
  var args   = {};
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
  proj().instances = proj().instances.filter(function(i) { return i.id !== id; });
  if (APP.ui.selectedInstId === id) {
    APP.ui.selectedInstId = null;
    renderer.selInstId    = null;
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
var edEl    = document.getElementById('code-ed');
var hlEl    = document.getElementById('hl-layer');
var lnEl    = document.getElementById('line-nums');
var errIcon = document.getElementById('err-icon');
var errTxt  = document.getElementById('err-txt');

var _parseTimer = null;

edEl.addEventListener('input', function() {
  updateHL(); updateLN(); updateHints();
  clearTimeout(_parseTimer);
  _parseTimer = setTimeout(syncEditorToState, 80);
});

edEl.addEventListener('scroll', function() {
  hlEl.scrollTop  = edEl.scrollTop;
  hlEl.scrollLeft = edEl.scrollLeft;
  lnEl.scrollTop  = edEl.scrollTop;
});

edEl.addEventListener('keydown', function(e) {
  if (e.key !== 'Tab') return;
  e.preventDefault();
  var s   = edEl.selectionStart, end = edEl.selectionEnd;
  edEl.value = edEl.value.slice(0, s) + '    ' + edEl.value.slice(end);
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
        hints.push('💬 Comment (ignored during parsing)');
        break;
      }
      
      // ── ID declaration with parameters ──
      if (/^ID\s*=/.test(trimmed)) {
        hints.push('🏷️ Structure: ID = structureName([param1], [param2], ...)');
        hints.push('💡 Example: ID = cylinder([radius], [height])');
        break;
      }
      
      // ── [var] = math(expr) ──
      if (/^\[.*\]\s*=\s*math/i.test(trimmed)) {
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
        break;
      }
      
      // ── fill: style(args) ──
      if (/^fill\s*:/i.test(trimmed)) {
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
              hints.push('   angle: 0-360° | spacing: 0.1+ | density: 0.05+');
            } else {
              hints.push('💡 Args: angle, spacing, density (angle-based fill)');
            }
          }
        } else {
          hints.push('💡 Example: fill: cross(45, 1.5, 1)');
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
        hints.push('  -  (solid) | .. (dotted) | -- (dashed) | -.- (dash-dot) | -..- (dash-dot-dot)');
        hints.push('📌 Control Points: <...>(pct%, angle, distance) — offset midpoint');
        
        if (inConnector) {
          hints.push('💡 Example: a <->(50%, 90, 0.5) b');
        } else {
          hints.push('💡 Example: a <-> b  or  a <..>(ctrl) b');
        }
        break;
      }
      
      // ── Midpoint: a~(pct,ang,dst)b = name ──
      if (line.includes('~') && line.includes('(')) {
        var tildeParen = /~\([^)]*\)/;
        if (tildeParen.test(line)) {
          if (inLinePos > line.indexOf('(') - 1 && inLinePos < (line.lastIndexOf(')') + 1)) {
            hints.push('🎯 Midpoint: a~(pct%, angle, distance)b = name');
            hints.push('   pct: 0-100% (position on line)');
            hints.push('   angle: direction offset from midpoint (degrees)');
            hints.push('   distance: offset distance from midpoint');
            hints.push('💡 Example: a~(50%, 90, 0.5)b = peak');
          } else {
            hints.push('🎯 Midpoint Definition: a~(pct%, angle, dist)b = newPoint');
          }
        }
        break;
      }
      
      // ── Point definition: angle pointId distance = newId ──
      if (/^\d+[a-zA-Z_]/.test(trimmed) && trimmed.includes('=') && !trimmed.includes('<')) {
        hints.push('📍 Point Definition: angle pointId distance = newId');
        hints.push('   angle: 0° right, counterclockwise');
        hints.push('   pointId: existing point reference');
        hints.push('   distance: units (use +/- for relative)');
        hints.push('💡 Example: 90a1 = b  (1 unit above a)');
        hints.push('💡 Relative: +45b1 = c  (adds 45° to last angle)');
        break;
      }
      
      // ── General syntax help at start of new line ──
      if (trimmed === '' || (i > 0 && !trimmed)) {
        hints.push('📝 Available Syntax:');
        hints.push('  ID = name([params])  — Structure definition');
        hints.push('  0o1 = name  — Point definition');
        hints.push('  name <-> name  — Line definition');
        hints.push('  a~(50%,angle,dist)b = name  — Midpoint');
        hints.push('  a <...>(control) b  — Line with control point');
        hints.push('  [var] = math(expr)  — Variable calculation');
        hints.push('  fill: style(args)  — Fill pattern');
        hints.push('  // comment  — Comment line');
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
  if (hints.length > 0) {
    hintsEl.innerHTML = hints.map(function(h) { return '<div>' + h + '</div>'; }).join('');
    hintsEl.style.display = 'block';
  } else {
    hintsEl.style.display = 'none';
  }
}

// Delete key removes selected instance
document.addEventListener('keydown', function(e) {
  if ((e.key === 'Delete' || e.key === 'Backspace')
      && APP.ui.selectedInstId
      && document.activeElement !== edEl) {
    e.preventDefault();
    deleteInstance(APP.ui.selectedInstId);
  }
  if (e.key === 'Escape' && APP.ui.selectedInstId) {
    APP.ui.selectedInstId = null;
    renderer.selInstId    = null;
    renderer.draw();
    closeInspector();
  }
});

function updateHL() {
  hlEl.innerHTML = highlight(edEl.value) + '\n';
}

function updateLN() {
  var n    = (edEl.value.match(/\n/g) || []).length + 1;
  var html = '';
  for (var i = 1; i <= n; i++) html += '<span>' + i + '</span>';
  lnEl.innerHTML = html;
}

function syncEditorToState() {
  var id = APP.ui.currentStructId;
  if (!id) return;
  var s = getStruct(id);
  if (!s) return;

  s.code = edEl.value;
  var h  = extractHeader(s.code);
  if (h.name !== s.name) {
    s.name = h.name;
    renderStructList();
  }

  // Show parse errors
  var result = parseDotDash(s.code, {});
  if (result.errs.length === 0) {
    errIcon.style.color  = '#4a9040';
    errIcon.textContent  = '●';
    errTxt.textContent   = 'エラーなし';
    document.getElementById('sdot').className = 'sdot';
    document.getElementById('stxt').textContent = 'OK';
  } else {
    errIcon.style.color  = '#c06030';
    errIcon.textContent  = '▲';
    errTxt.textContent   = result.errs[0] + (result.errs.length > 1 ? ' (+' + (result.errs.length - 1) + ')' : '');
    document.getElementById('sdot').className = 'sdot error';
    document.getElementById('stxt').textContent = 'ERROR';
  }

  renderer.updateProject(proj());
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
      var s = getStruct(btn.dataset.id);
      if (s && confirm('「' + s.name + '」を削除しますか？\n（このインスタンスもすべて削除されます）')) {
        deleteStructure(btn.dataset.id);
      }
    });
  });
}

function renderEditor() {
  var id = APP.ui.currentStructId;
  var s  = id ? getStruct(id) : null;
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
      errTxt.textContent  = 'エラーなし';
    } else {
      errIcon.style.color = '#c06030'; errIcon.textContent = '▲';
      errTxt.textContent  = result.errs[0];
    }
  } else {
    errIcon.style.color = '#a09070'; errIcon.textContent = '○';
    errTxt.textContent  = '構造を選択してください';
  }
}

function renderInspector() {
  var id   = APP.ui.selectedInstId;
  var inst = id ? getInstance(id) : null;
  if (!inst) { closeInspector(); return; }

  var s = getStruct(inst.structId);
  if (!s) { closeInspector(); return; }

  openInspector();
  document.getElementById('insp-title').textContent = 'インスペクター';

  var header = extractHeader(s.code);
  var body   = document.getElementById('insp-body');

  var argsHtml = '';
  if (header.params.length) {
    var rows = header.params.map(function(p) {
      var val = inst.args[p] !== undefined ? inst.args[p] : 1;
      return (
        '<div class="insp-row">' +
          '<label class="insp-label">[' + _escHtml(p) + ']</label>' +
          '<input class="insp-input" type="number" step="0.1" data-param="' + _escHtml(p) + '" value="' + val + '">' +
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

  // Args
  body.querySelectorAll('.insp-input[data-param]').forEach(function(inp) {
    inp.addEventListener('input', function() {
      inst.args[inp.dataset.param] = parseFloat(inp.value) || 0;
      renderer.updateProject(proj());
      markDirty();
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
    var gs   = renderer.gridSize || 1;
    inst.offsetX = Math.round(inst.offsetX / gs) * gs;
    inst.offsetY = Math.round(inst.offsetY / gs) * gs;
    document.getElementById('insp-offx').value = inst.offsetX;
    document.getElementById('insp-offy').value = inst.offsetY;
    renderer.updateProject(proj());
    markDirty();
  });

  // Delete
  document.getElementById('insp-del').addEventListener('click', function() {
    if (confirm('このインスタンスを削除しますか？')) deleteInstance(id);
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
    format:     'zuhyo',
    version:    '1.0',
    name:       proj().name,
    structures: proj().structures,
    instances:  proj().instances
  };
  var json = JSON.stringify(data, null, 2);
  var blob = new Blob([json], { type: 'application/json' });
  var url  = URL.createObjectURL(blob);
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
      name:       data.name || 'Untitled',
      structures: data.structures || [],
      instances:  data.instances  || []
    };
    APP.ui.currentStructId = proj().structures[0] ? proj().structures[0].id : null;
    APP.ui.selectedInstId  = null;
    renderer.selInstId     = null;
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
  if (APP.ui.dirty && !confirm('保存されていない変更があります。新規プロジェクトを作成しますか？')) return;
  APP.project = { name: 'Untitled', structures: [], instances: [] };
  APP.ui.currentStructId = null;
  APP.ui.selectedInstId  = null;
  renderer.selInstId     = null;
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
  renderer.selInstId    = instId;
  renderer.draw();
  renderInspector();
};

renderer.onInstanceDragStart = function(instId) {
  // Option: stop auto-rendering or highlights?
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
  renderer.updateProject(proj());
  markDirty();
};

renderer.onInstanceDragEnd = function(instId) {
  // Snap if needed? Or just final sync.
  renderer.updateProject(proj());
};

renderer.onMouseMove = function(wx, wy) {
  document.getElementById('mouse-coord').textContent =
    'x: ' + wx.toFixed(2) + '  y: ' + wy.toFixed(2);
};

renderer.onScaleChange = function(scale) {
  document.getElementById('zoom-val').textContent =
    Math.round(scale / 80 * 100) + '%';
};

/* ================================================================
   CANVAS RESIZE
   ================================================================ */
function resizeCanvas() {
  var area    = document.getElementById('canvas-area');
  var toolbar = area.querySelector('.canvas-toolbar');
  var cv      = document.getElementById('cv');
  cv.width  = area.clientWidth;
  cv.height = area.clientHeight - toolbar.offsetHeight;
  renderer.draw();
}
window.addEventListener('resize', function() { resizeCanvas(); });

/* ================================================================
   TOOLBAR + CONTROLS
   ================================================================ */
document.getElementById('btn-reset-view').addEventListener('click', function() {
  renderer.resetView();
  document.getElementById('zoom-val').textContent = '100%';
});

document.getElementById('grid-snap').addEventListener('change', function(e) {
  renderer.gridSnap = e.target.checked;
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
    btnGrb.classList.remove('active');
    cv.classList.remove('grab-mode');
  } else {
    btnCam.classList.remove('active');
    btnGrb.classList.add('active');
    cv.classList.add('grab-mode');
  }
}

document.getElementById('btn-tool-camera').addEventListener('click', function() { setToolMode('camera'); });
document.getElementById('btn-tool-grab').addEventListener('click', function() { setToolMode('grab'); });

document.getElementById('insp-close').addEventListener('click', function() {
  APP.ui.selectedInstId = null;
  renderer.selInstId    = null;
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

document.getElementById('exp-png-t').addEventListener('click', function() { renderer.exportPNG(true);  });
document.getElementById('exp-png-w').addEventListener('click', function() { renderer.exportPNG(false); });
document.getElementById('exp-svg').addEventListener('click',   function() { renderer.exportSVG(); });
document.getElementById('exp-zy').addEventListener('click',    saveProject);

/* ================================================================
   PANEL RESIZERS
   ================================================================ */
// Horizontal: left-panel ↔ canvas
(function() {
  var div    = document.getElementById('h-divider');
  var panel  = document.getElementById('left-panel');
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
  var div    = document.getElementById('v-divider');
  var top    = document.getElementById('struct-panel');
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
  var exKeys = ['square', 'circle', 'cylinder', 'triangle'];
  exKeys.forEach(function(key) {
    var code = EXAMPLES[key];
    var hdr  = extractHeader(code);
    var id   = nextId('s');
    proj().structures.push({ id: id, name: hdr.name, code: code });
  });

  // Start editing the first structure
  APP.ui.currentStructId = proj().structures[0].id;

  // Call square by default but don't open inspector on start
  var firstId   = proj().structures[0].id;
  var firstCode = proj().structures[0].code;
  var header    = extractHeader(firstCode);
  var args      = {};
  header.params.forEach(function(p) { args[p] = 1; });
  var inst = { id: nextId('i'), structId: firstId, args: args, offsetX: 0, offsetY: 0 };
  proj().instances.push(inst);
  // Don't select — inspector stays closed on start

  resizeCanvas();
  renderer.updateProject(proj());
  renderAll();
  clearDirty();
})();
