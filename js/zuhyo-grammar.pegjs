/*
 * Zuhyo PEG.js Grammar
 * Used to generate an AST for the Zuhyo language.
 */

Program
  = statements:Statement* {
      return {
        type: "Program",
        body: statements.filter(s => s !== null)
      };
    }

Statement
  = _ cmd:Command _ ("\n" / EOF) { return cmd; }
  / _ def:PointDefinition _ ("\n" / EOF) { return def; }
  / _ conn:LineConnection _ ("\n" / EOF) { return conn; }
  / _ mid:Midpoint _ ("\n" / EOF) { return mid; }
  / _ assign:Assignment _ ("\n" / EOF) { return assign; }
  / _ comment:Comment _ ("\n" / EOF) { return null; }
  / _ "\n" { return null; }

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
  = "<" inner:[.\-]* ">" { return inner.join(""); }
  / "-" inner:[.\-]* "-" { return "-" + inner.join("") + "-"; }
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
  = chars:[^ \n\t\r,\]\)=]+ { return chars.join(""); }

StringLiteral
  = "\"" chars:[^\"]* "\"" { return chars.join(""); }
  / chars:[^ \n\t\r]+ { return chars.join(""); }

Identifier
  = chars:[a-zA-Z_][a-zA-Z0-9_]* { return chars.join(""); }

Comment
  = "//" [^\n]*

_ "whitespace"
  = [ \t]*

EOF
  = !.
