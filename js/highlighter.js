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
  var e = _esc(raw);

  // Skip empty
  if (!trimmed) return e;

  // 1. ID declaration
  if (/^ID\s*=/.test(trimmed)) {
    return e.replace(/ID/, '<span class="hl-kw">ID</span>')
            .replace(/\[([a-zA-Z_]+)\]/g, '<span class="hl-var">[$1]</span>');
  }

  // 2. Plot: plot: f(x) [start, end, step]
  if (/^plot\s*:/i.test(trimmed)) {
    return e.replace(/(plot)/i, '<span class="hl-kw">$1</span>')
            .replace(/(\[.*?\])/, '<span class="hl-ctrl">$1</span>');
  }

  // 3. Text: text: "Content" p1 p2
  if (/^text\s*:/i.test(trimmed)) {
    // Escape then use a token-based approach for keywords to avoid internal tag matching
    var res = e.replace(/(text)/i, '<span class="hl-kw">$1</span>');
    res = res.replace(/(&quot;[^&]*?&quot;)/, '<span class="hl-fill">$1</span>');
    // Highlight remainig words as points, excluding already highlighted parts
    var parts = res.split(/(<[^>]*>)/);
    for (var i = 0; i < parts.length; i++) {
      if (parts[i][0] !== '<') {
        parts[i] = parts[i].replace(/\b([a-zA-Z_]+)\b(?!;)/g, function(m, w) {
          return '<span class="hl-pt">' + w + '</span>';
        });
      }
    }
    return parts.join('');
  }

  // 4. Fill: fill: style(args)
  if (/^fill\s*:/i.test(trimmed)) {
    return e.replace(/(fill)/i, '<span class="hl-kw">$1</span>')
            .replace(/(:\s*)(\w+)(?:\(([^)]*)\))?/i,
              function(_, colon, style, args) {
                var res = colon + '<span class="hl-fill">' + style + '</span>';
                if (args !== undefined) res += '<span class="hl-ctrl">(' + args + ')</span>';
                return res;
              });
  }

  // 5. Math variables: [var] = math(...) or [var] = { ... }
  if (/^\s*\[/.test(trimmed)) {
    return e.replace(/\[([a-zA-Z_]+)\]/g, '<span class="hl-var">[$1]</span>')
            .replace(/\b(math)\b/, '<span class="hl-kw">$1</span>')
            .replace(/(\{.*?\})/g, '<span class="hl-ctrl">$1</span>');
  }

  // 6. Circle: command removed

  // 7. Label: label: "text" p1 size
  if (/^label\s*:/i.test(trimmed)) {
    var colonIdx = e.indexOf(':');
    var kwPart = e.substring(0, colonIdx);
    var rest   = e.substring(colonIdx);
    kwPart = kwPart.replace(/(label)/i, '<span class="hl-kw">$1</span>');
    // Match quoted content explicitly, others will be handled as symbols/points
    rest   = rest.replace(/&quot;([^&]*?)&quot;/g, '<span class="hl-str">&quot;$1&quot;</span>');
    rest   = rest.replace(/(\{.*?\})/g, '<span class="hl-ctrl">$1</span>');
    rest   = _hlSymbols(rest);
    return kwPart + rest;
  }

  // 8. Line statement (<->)
  if (e.includes('&lt;') && e.includes('&gt;')) {
    var placeholders = [];
    var temp = e.replace(/(&lt;[^&]*?&gt;)((?:\s*\([^)]*\))*)/g, function(_, conn, ctrls) {
      var token = '\u0001' + placeholders.length + '\u0002';
      var hlCtrls = ctrls.replace(/(\{.*?\})/g, '<span class="hl-ctrl">$1</span>');
      placeholders.push('<span class="hl-conn">' + conn + '</span>' + hlCtrls);
      return token;
    });
    temp = _hlSymbols(temp);
    placeholders.forEach(function(html, idx) {
      temp = temp.replace('\u0001' + idx + '\u0002', html);
    });
    return temp;
  }

  // 7. Point definition (regex based)
  var pdRe = /^(\s*)([+\-]?\d+(?:\.\d+)?)([a-zA-Z_]+?)([+\-]?\d+(?:\.\d+)?)(\s*=\s*)?([a-zA-Z_]+)(\s*)$/;
  if (pdRe.test(e)) {
    return e.replace(pdRe, function(_, lead, ang, pt, dst, eq, npt, trail) {
      return lead
        + '<span class="hl-num">'  + ang  + '</span>'
        + '<span class="hl-pt">'   + pt   + '</span>'
        + '<span class="hl-num">'  + dst  + '</span>'
        + '<span class="hl-op">'   + (eq || '') + '</span>'
        + '<span class="hl-pt">'   + npt  + '</span>'
        + trail;
    });
  }

  return e;
}

/**
 * Highlights point IDs while ignoring existing HTML tags.
 */
function _hlSymbols(html) {
  var parts = html.split(/(<[^>]*>)/);
  for (var i = 0; i < parts.length; i++) {
    if (parts[i] && parts[i][0] !== '<') {
      parts[i] = parts[i].replace(/\b([a-zA-Z_]+)\b(?!;)/g, '<span class="hl-pt">$1</span>');
    }
  }
  return parts.join('');
}
