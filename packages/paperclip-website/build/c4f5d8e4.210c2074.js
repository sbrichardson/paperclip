(window.webpackJsonp = window.webpackJsonp || []).push([
  [30],
  {
    131: function(e, t, a) {
      "use strict";
      a.r(t);
      var n = a(2),
        l = a(0),
        r = a.n(l),
        c = a(160),
        i = a(175),
        s = a(156),
        o = a(148),
        m = a(170),
        u = a(132),
        p = a.n(u);
      const d = [
        {
          title: r.a.createElement(r.a.Fragment, null, "Just the primitives"),
          description: r.a.createElement(
            r.a.Fragment,
            null,
            "Paperclip just covers basic HTML, CSS, and primitive components that you can use in your React code."
          )
        },
        {
          title: r.a.createElement(r.a.Fragment, null, "Visual programming"),
          description: r.a.createElement(
            r.a.Fragment,
            null,
            "Watch your changes live, directly within VS Code."
          )
        },
        {
          title: r.a.createElement(
            r.a.Fragment,
            null,
            "Visual regression testing"
          ),
          description: r.a.createElement(
            r.a.Fragment,
            null,
            "Paperclip allows you to test for visual regressions right out of the box. Just run ",
            r.a.createElement("code", null, "percy-paperclip")
          )
        }
      ];
      function E({ imageUrl: e, title: t, description: a }) {
        const n = Object(m.a)(e);
        return r.a.createElement(
          "div",
          { className: Object(c.a)("col col--4", p.a.feature) },
          n &&
            r.a.createElement(
              "div",
              { className: "text--center" },
              r.a.createElement("img", {
                className: p.a.featureImage,
                src: n,
                alt: t
              })
            ),
          r.a.createElement("h3", null, t),
          r.a.createElement("p", null, a)
        );
      }
      t.default = function() {
        const e = Object(o.a)(),
          { siteConfig: t = {} } = e;
        return r.a.createElement(
          i.a,
          {
            title: "Hello from " + t.title,
            description: "Description will go into a meta tag in <head />"
          },
          r.a.createElement(
            "header",
            { className: Object(c.a)("hero hero--primary", p.a.heroBanner) },
            r.a.createElement(
              "div",
              { className: "container" },
              r.a.createElement("h1", { className: "hero__title" }, t.title),
              r.a.createElement(
                "p",
                { className: "hero__subtitle" },
                t.tagline
              ),
              r.a.createElement(
                "div",
                { className: p.a.buttons },
                r.a.createElement(
                  s.a,
                  {
                    className: Object(c.a)(
                      "button button--outline button--secondary button--lg",
                      p.a.getStarted
                    ),
                    to: Object(m.a)("docs/")
                  },
                  "Get Started"
                )
              )
            )
          ),
          r.a.createElement(
            "main",
            null,
            d &&
              d.length > 0 &&
              r.a.createElement(
                "section",
                { className: p.a.features },
                r.a.createElement(
                  "div",
                  { className: "container" },
                  r.a.createElement(
                    "div",
                    { className: "row" },
                    d.map((e, t) =>
                      r.a.createElement(E, Object(n.a)({ key: t }, e))
                    )
                  )
                )
              )
          )
        );
      };
    }
  }
]);
