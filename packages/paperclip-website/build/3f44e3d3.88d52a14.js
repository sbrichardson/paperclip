(window.webpackJsonp = window.webpackJsonp || []).push([
  [13],
  {
    115: function(e, t, n) {
      "use strict";
      n.r(t),
        n.d(t, "frontMatter", function() {
          return o;
        }),
        n.d(t, "metadata", function() {
          return c;
        }),
        n.d(t, "rightToc", function() {
          return l;
        }),
        n.d(t, "default", function() {
          return s;
        });
      var r = n(2),
        a = n(6),
        i = (n(0), n(143)),
        o = {
          id: "getting-started-vscode",
          title: "Installing the VS Code extension",
          sidebar_label: "Installing the VS Code extension"
        },
        c = {
          id: "getting-started-vscode",
          isDocsHomePage: !1,
          title: "Installing the VS Code extension",
          description: "The VS Code Extension enables you to visually",
          source: "@site/docs/getting-started-vscode.md",
          permalink: "/docs/getting-started-vscode",
          editUrl:
            "https://github.com/crcn/paperclip/packages/edit/master/website/docs/getting-started-vscode.md",
          sidebar_label: "Installing the VS Code extension",
          sidebar: "docs",
          previous: { title: "Installing Paperclip", permalink: "/docs/" },
          next: {
            title: "Using Paperclip in React apps",
            permalink: "/docs/usage-react"
          }
        },
        l = [],
        p = { rightToc: l };
      function s(e) {
        var t = e.components,
          n = Object(a.a)(e, ["components"]);
        return Object(i.b)(
          "wrapper",
          Object(r.a)({}, p, n, { components: t, mdxType: "MDXLayout" }),
          Object(i.b)(
            "p",
            null,
            "The ",
            Object(i.b)(
              "a",
              Object(r.a)(
                { parentName: "p" },
                {
                  href:
                    "https://marketplace.visualstudio.com/items?itemName=crcn.paperclip"
                }
              ),
              "VS Code Extension"
            ),
            " enables you to visually\ncreate your Paperclip files in realtime. "
          ),
          Object(i.b)(
            "p",
            null,
            Object(i.b)(
              "img",
              Object(r.a)(
                { parentName: "p" },
                { src: "assets/realtime-demo.gif", alt: "alt Realtime editing" }
              )
            )
          ),
          Object(i.b)(
            "p",
            null,
            "After installing the extension, you'll be prompted to open the live preview whenever you open a Paperclip file (",
            Object(i.b)("inlineCode", { parentName: "p" }, "*.pc"),
            "). "
          ),
          Object(i.b)("h4", { id: "command-palette" }, "Command Palette"),
          Object(i.b)(
            "p",
            null,
            "Can be opened via ",
            Object(i.b)("inlineCode", { parentName: "p" }, "cmd + shift + p"),
            "."
          ),
          Object(i.b)(
            "ul",
            null,
            Object(i.b)(
              "li",
              { parentName: "ul" },
              Object(i.b)(
                "inlineCode",
                { parentName: "li" },
                "Paperclip: Open Live Preview"
              ),
              " - opens a live preview of Paperclip file that's currently opened."
            ),
            Object(i.b)(
              "li",
              { parentName: "ul" },
              Object(i.b)(
                "inlineCode",
                { parentName: "li" },
                "Paperclip: Give Feedback"
              ),
              " - Provide some feedback if you want! Feature requests, reporting bugs, etc."
            )
          )
        );
      }
      s.isMDXComponent = !0;
    },
    143: function(e, t, n) {
      "use strict";
      n.d(t, "a", function() {
        return u;
      }),
        n.d(t, "b", function() {
          return m;
        });
      var r = n(0),
        a = n.n(r);
      function i(e, t, n) {
        return (
          t in e
            ? Object.defineProperty(e, t, {
                value: n,
                enumerable: !0,
                configurable: !0,
                writable: !0
              })
            : (e[t] = n),
          e
        );
      }
      function o(e, t) {
        var n = Object.keys(e);
        if (Object.getOwnPropertySymbols) {
          var r = Object.getOwnPropertySymbols(e);
          t &&
            (r = r.filter(function(t) {
              return Object.getOwnPropertyDescriptor(e, t).enumerable;
            })),
            n.push.apply(n, r);
        }
        return n;
      }
      function c(e) {
        for (var t = 1; t < arguments.length; t++) {
          var n = null != arguments[t] ? arguments[t] : {};
          t % 2
            ? o(Object(n), !0).forEach(function(t) {
                i(e, t, n[t]);
              })
            : Object.getOwnPropertyDescriptors
            ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(n))
            : o(Object(n)).forEach(function(t) {
                Object.defineProperty(
                  e,
                  t,
                  Object.getOwnPropertyDescriptor(n, t)
                );
              });
        }
        return e;
      }
      function l(e, t) {
        if (null == e) return {};
        var n,
          r,
          a = (function(e, t) {
            if (null == e) return {};
            var n,
              r,
              a = {},
              i = Object.keys(e);
            for (r = 0; r < i.length; r++)
              (n = i[r]), t.indexOf(n) >= 0 || (a[n] = e[n]);
            return a;
          })(e, t);
        if (Object.getOwnPropertySymbols) {
          var i = Object.getOwnPropertySymbols(e);
          for (r = 0; r < i.length; r++)
            (n = i[r]),
              t.indexOf(n) >= 0 ||
                (Object.prototype.propertyIsEnumerable.call(e, n) &&
                  (a[n] = e[n]));
        }
        return a;
      }
      var p = a.a.createContext({}),
        s = function(e) {
          var t = a.a.useContext(p),
            n = t;
          return e && (n = "function" == typeof e ? e(t) : c(c({}, t), e)), n;
        },
        u = function(e) {
          var t = s(e.components);
          return a.a.createElement(p.Provider, { value: t }, e.children);
        },
        b = {
          inlineCode: "code",
          wrapper: function(e) {
            var t = e.children;
            return a.a.createElement(a.a.Fragment, {}, t);
          }
        },
        d = a.a.forwardRef(function(e, t) {
          var n = e.components,
            r = e.mdxType,
            i = e.originalType,
            o = e.parentName,
            p = l(e, ["components", "mdxType", "originalType", "parentName"]),
            u = s(n),
            d = r,
            m = u["".concat(o, ".").concat(d)] || u[d] || b[d] || i;
          return n
            ? a.a.createElement(m, c(c({ ref: t }, p), {}, { components: n }))
            : a.a.createElement(m, c({ ref: t }, p));
        });
      function m(e, t) {
        var n = arguments,
          r = t && t.mdxType;
        if ("string" == typeof e || r) {
          var i = n.length,
            o = new Array(i);
          o[0] = d;
          var c = {};
          for (var l in t) hasOwnProperty.call(t, l) && (c[l] = t[l]);
          (c.originalType = e),
            (c.mdxType = "string" == typeof e ? e : r),
            (o[1] = c);
          for (var p = 2; p < i; p++) o[p] = n[p];
          return a.a.createElement.apply(null, o);
        }
        return a.a.createElement.apply(null, n);
      }
      d.displayName = "MDXCreateElement";
    }
  }
]);
