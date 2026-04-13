/* ================================================================
   図描 (Zuhyo) — highlighter.js
   Syntax highlighter for Zuhyo drawing language code.
   Returns HTML string with <span class="hl-*"> tags.
   ================================================================ */

/**
 * Highlight a full code string.
 * @param {string} code
 * @returns {string} HTML
 */
function highlight(code) {
  return code.split('\n').map(_hlLine).join('\n');
}

function _hlLine(raw) {
  var ci      = raw.indexOf('//');
  var codePart    = ci >= 0 ? raw.slice(0, ci) : raw;
  var commentPart = ci >= 0 ? raw.slice(ci)    : '';

  var result = _hlCode(codePart);
  if (commentPart) {
    result += '<span class="hl-comment">' + _esc(commentPart) + '</span>';
  }
  return result;
}

function _esc(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function _hlCode(raw) {
  var trimmed = raw.trim();

  // ── ID declaration ──
  if (/^ID\s*=/.test(trimmed)) {
    return _esc(raw)
      .replace(/(ID)/, '<span class="hl-kw">$1</span>')
      .replace(/\[([a-zA-Z_]+)\]/g, '<span class="hl-var">[$1]</span>');
  }

  // ── fill: style(args) ──
  if (/^fill\s*:/i.test(trimmed)) {
    return _esc(raw)
      .replace(/(fill)/i, '<span class="hl-kw">$1</span>')
      .replace(/(:\s*)(\w+)(?:\(([^)]*)\))?/i,
        function(_, colon, style, args) {
          var res = colon + '<span class="hl-fill">' + style + '</span>';
          if (args !== undefined) {
            res += '<span class="hl-ctrl">(' + args + ')</span>';
          }
          return res;
        });
  }

  // ── [var] = math(...) ──
  if (/^\s*\[/.test(trimmed)) {
    return _esc(raw)
      .replace(/\[([a-zA-Z_]+)\]/g, '<span class="hl-var">[$1]</span>')
      .replace(/\b(math)\b/, '<span class="hl-kw">$1</span>');
  }

  var e = _esc(raw);

  // ── Point definition: [+]angle  pointId  [+]dist  =  newId ──
  var pdRe = /^(\s*)([+\-]?\d+(?:\.\d+)?)([a-zA-Z_][a-zA-Z_]*)([+\-]?\d+(?:\.\d+)?)(\s*=\s*)([a-zA-Z_][a-zA-Z_]*)(\s*)$/;
  if (pdRe.test(e)) {
    return e.replace(pdRe, function(_, lead, ang, pt, dst, eq, npt, trail) {
      return lead
        + '<span class="hl-num">'  + ang  + '</span>'
        + '<span class="hl-pt">'   + pt   + '</span>'
        + '<span class="hl-num">'  + dst  + '</span>'
        + '<span class="hl-op">'   + eq   + '</span>'
        + '<span class="hl-pt">'   + npt  + '</span>'
        + trail;
    });
  }

  // ── Line statement (contains &lt; ... &gt;) ──
  if (e.includes('&lt;') && e.includes('&gt;')) {
    var placeholders = [];
    e = e.replace(
      /(&lt;[^&]*?&gt;)((?:\s*\([^)]*\))*)/g,
      function(_, conn, ctrls) {
        var token = '§ZHHL' + placeholders.length + '§';
        placeholders.push('<span class="hl-conn">' + conn + '</span>'
          + (ctrls ? '<span class="hl-ctrl">' + ctrls + '</span>' : ''));
        return token;
      }
    );
    // Highlight point names (words not followed by HTML entity)
    e = e.replace(/\b([a-zA-Z_][a-zA-Z_]*)\b(?!;)/g, function(m, w) {
      if (['fill', 'ID', 'math'].indexOf(w) >= 0) {
        return '<span class="hl-kw">' + w + '</span>';
      }
      return '<span class="hl-pt">' + w + '</span>';
    });
    placeholders.forEach(function(html, idx) {
      e = e.replace('§ZHHL' + idx + '§', html);
    });
    return e;
  }

  return e;
}
