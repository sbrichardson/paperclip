import * as path from "path";
import { Engine } from "../engine";
import { expect } from "chai";
import {
  EngineEventKind,
  stringifyVirtualNode,
  EvaluatedEvent
} from "paperclip-utils";
import { createMockEngine, Graph } from "./utils";

describe(__filename + "#", () => {
  const waitForEvaluated = async (engine: Engine): Promise<EvaluatedEvent> => {
    return new Promise((resolve, reject) => {
      engine.onEvent(event => {
        if (event.kind === EngineEventKind.Error) {
          return reject(event);
        }

        if (event.kind === EngineEventKind.Evaluated) {
          resolve(event);
        }
      });
    });
  };

  [
    // basic parsing
    [
      {
        "/entry.pc": `Hello World`
      },
      {},
      `<style></style>Hello World`
    ],
    [
      {
        "/entry.pc": `<span>more text</span>`
      },
      {},
      `<style></style><span data-pc-80f4925f>more text</span>`
    ],

    // styles
    [
      {
        "/entry.pc": `
          <style>
            span {
              color: red;
            }
          </style>
          <span>more text</span>
        `
      },
      {},
      `
      <style>span[data-pc-80f4925f] { color:red; }</style><span data-pc-80f4925f>more text</span> 
      `
    ],

    // components
    [
      {
        "/button.pc": `
          <style>
            span {
              color: red;
            }
          </style>
          <span export component as="default">{children}!</span>

        `,
        "/entry.pc": `
          <import as="something" src="./button.pc" />
          <something>hello world</something>
        `
      },
      {},
      `
      <style>span[data-pc-1d7dbc06] { color:red; }</style><span data-pc-1d7dbc06>hello world!</span>`
    ],

    // basic css
    [
      {
        "/button.pc": `
          <style>
            /* indivisual selectors */
            .class { }
            .a1.b1 {}
            .a.b.c {}
            .a.b {}

            .class[a] {}
            .class1.class2 {}
            .class1 .class2 {}
            #id {}
            * {}
            element {}
            element.class {}
            [attribute] {}
            [attribute=value]  {}
            [attribute="value"]  {}
            [attribute='value']  {}
            /*[attribute~='value']  {}
            [attribute^='value']  {}
            [attribute$='value']  {}
            [attribute$='value']  {}
            [attribute*='value']  {}*/
            div[attr1][attr1]  {}
            :active {}
            ::active {}
            element::active {}
            ::after {}

            /* functions */
            ::lang(it) {}
            p::lang(it) {}
            :not(p) {}
            :nth-child(5) {}
            :placeholder {}

            /* groups */
            element1, element2 {}
            element, .class, #id.class {}

            /* descendent */
            element1 element2 {}
            element1.class element2[attr][attr2] {}
            element1.class element2[attr], #id.group {}

            /* children */
            element1 > element2 {}
            element1 > .child .descendent {}
            element1 > .child .descendent, [group-attr="something"] {}

            /* next sibling */
            element1 + element2 {}

            /* sibling */
            element1 ~ element2 {}

            /* media queries */
            @media only screen and (max-width: 600px) {
              div {
                color: red;
              }
            }

            /* keyframes */
            @keyframes mymove {
              from {top: 0px;}
              to {top: 200px;}
            }
            
          </style>
          <span export component as="default">{children}!</span>

        `,
        "/entry.pc": `
          <import as="something" src="./button.pc" />
          <something>hello world</something>
        `
      },
      {},
      `<style>._1d7dbc06_class { } ._1d7dbc06_a1._1d7dbc06_b1 { } ._1d7dbc06_a._1d7dbc06_b._1d7dbc06_c { } ._1d7dbc06_a._1d7dbc06_b { } ._1d7dbc06_class[a] { } ._1d7dbc06_class1._1d7dbc06_class2 { } ._1d7dbc06_class1 ._1d7dbc06_class2 { } #id[data-pc-1d7dbc06] { } [data-pc-1d7dbc06] { } element[data-pc-1d7dbc06] { } element._1d7dbc06_class { } [attribute][data-pc-1d7dbc06] { } [attribute="value"][data-pc-1d7dbc06] { } [attribute="value"][data-pc-1d7dbc06] { } [attribute="value"][data-pc-1d7dbc06] { } div[attr1][attr1][data-pc-1d7dbc06] { } :active { } ::active { } element[data-pc-1d7dbc06]::active { } ::after { } :lang(it) { } p[data-pc-1d7dbc06]:lang(it) { } [data-pc-1d7dbc06]:not(p[data-pc-1d7dbc06]) { } :nth-child(5) { } :placeholder { } element1[data-pc-1d7dbc06], element2[data-pc-1d7dbc06] { } element[data-pc-1d7dbc06], ._1d7dbc06_class, #id._1d7dbc06_class { } element1[data-pc-1d7dbc06] element2[data-pc-1d7dbc06] { } element1._1d7dbc06_class element2[attr][attr2][data-pc-1d7dbc06] { } element1._1d7dbc06_class element2[attr][data-pc-1d7dbc06], #id._1d7dbc06_group { } element1[data-pc-1d7dbc06] > element2[data-pc-1d7dbc06] { } element1[data-pc-1d7dbc06] > ._1d7dbc06_child ._1d7dbc06_descendent { } element1[data-pc-1d7dbc06] > ._1d7dbc06_child ._1d7dbc06_descendent, [group-attr="something"][data-pc-1d7dbc06] { } element1[data-pc-1d7dbc06] + element2[data-pc-1d7dbc06] { } element1[data-pc-1d7dbc06] ~ element2[data-pc-1d7dbc06] { } @media only screen and (max-width: 600px) { div[data-pc-1d7dbc06] { color:red; } } </style><span data-pc-1d7dbc06>hello world!</span>`

      // TODO - import css
    ],
    [
      // parse different tag names
      {
        "/entry.pc": `
          <span component as="test">
          {_someRef}
          {_some5ref}
          {_ref}
          {$$ref}
          </span>

          <test 
            _someRef="a" 
            _some5ref="b" 
            _ref="c"
            $$ref="d"
          />
        `
      },
      {},
      `<style></style><span data-pc-80f4925f>abcd</span>`
    ],
    [
      // parse different tag names
      {
        "/entry.pc": `
          <span component as="test">{a} b</span>
          <test a="c" />
        `
      },
      {},
      `<style></style><span data-pc-80f4925f>c b</span>`
    ],
    [
      // class names prefixed with scope
      {
        "/entry.pc": `
          <span component as="test" class="something something2">
          </span>
          <test />
        `
      },
      {},
      `<style></style><span class="_80f4925f_something something _80f4925f_something2 something2" data-pc-80f4925f></span>`
    ],
    [
      // class name isn't used if not explicitly defined in component
      {
        "/entry.pc": `
          <import as="Message" src="./message.pc">
          <Message class="red" />
        `,

        // ensure that root is span
        "/message.pc": `<span export component as="default" class="blue">
            message
          </span>`
      },

      {},
      `<style></style><span data-pc-1acb798 class="_1acb798_blue blue">message </span>`
    ],
    [
      // class piercing
      {
        "/entry.pc": `
          <import as="Message" src="./message.pc">
          <Message class=">>>red" />
        `,

        // ensure that root is span
        "/message.pc": `<span export component as="default" {class}>
            message
          </span>`
      },
      {},
      `<style></style><span data-pc-1acb798 class="_80f4925f_red red">message </span>`
    ],
    [
      // no class mod for components if shadow pierce operator is not defined
      {
        "/entry.pc": `
          <import as="Message" src="./message.pc">
          <Message class="red" />
        `,

        // ensure that root is span
        "/message.pc": `<span export component as="default" {class}>
            message
          </span>`
      },

      {},
      `<style></style><span class="red" data-pc-1acb798>message </span>`
    ],
    [
      // style classes prefixed with scope
      {
        "/entry.pc": `
          <style>
            .something > .something2 {

            }
          </style>
          <span component as="test" class="something2">
          </span>
          <test />
        `
      },
      {},
      `<style>._80f4925f_something > ._80f4925f_something2 { }</style><span class="_80f4925f_something2 something2" data-pc-80f4925f></span>`
    ],
    [
      // style classes prefixed with scope
      {
        "/entry.pc": `
          <span component as="test" class="a {class}">
          </span>
          <test class="b" />
          <test class=">>>b" />
        `
      },
      {},
      `<style></style><span data-pc-80f4925f class="_80f4925f_a a b"></span><span data-pc-80f4925f class="_80f4925f_a a _80f4925f_b b"></span>`
    ],
    [
      // no class mod for components if shadow pierce operator is not defined
      {
        "/entry.pc": `
          <import as="Message" src="./message.pc">
          <Message class=">>>red" />
          <span />
        `,

        // ensure that root is span
        "/message.pc": `<span export component as="default" class="blue {class}">
            message
          </span>`
      },
      {},
      `<style></style><span class="_1acb798_blue blue _80f4925f_red red" data-pc-1acb798>message </span><span data-pc-80f4925f></span>`
    ],
    [
      // nexted style declarations
      {
        "/entry.pc": `
          <style>
            :global(.a) {
              &--secondary {
                &--thirdly {
                  color: blue;
                }
              }
              color: blue;
              &:global(.c) {

              }
              display: block;
              & .d {

              }
              & > :global(.e) {
                &-f {
                  color: red;
                }
                color: blue;
              }
            }
          </style>
          <div>ok</div>
        `
      },
      {},
      `<style>.a { color:blue; display:block; } .a--secondary { } .a--secondary --thirdly { color:blue; } .a.c { } .a ._80f4925f_d { } .a > .e { color:blue; } .a > .e-f { color:red; }</style><div data-pc-80f4925f>ok</div>`
    ],
    [
      // no class mod for components if shadow pierce operator is not defined
      {
        "/entry.pc": `
          <import as="Message" src="./message.pc">
          <Message component as="test">
            {children}!
          </Message>
          <test>child</test>
        `,

        // ensure that root is span
        "/message.pc": `<span export component as="default">
            {children}
          </span>`
      },
      {},
      `<style></style><span data-pc-1acb798>child! </span>`
    ],
    [
      // no class mod for components if shadow pierce operator is not defined
      {
        "/entry.pc": `
          <style>
            .a, .b {
              &--c {
                color: blue;
              }
            }
          </style>
        `
      },
      {},
      `<style>._80f4925f_a, ._80f4925f_b { } ._80f4925f_a--c { color:blue; } ._80f4925f_b--c { color:blue; }</style>`
    ],
    [
      // no class mod for components if shadow pierce operator is not defined
      {
        "/entry.pc": `
          <style>
            :global(.a, .b) {
              &--c {
                color: blue;
              }
            }
          </style>
        `
      },
      {},
      `<style>.a, .b { } .a--c { color:blue; } .b--c { color:blue; }</style>`
    ],
    [
      // no class mod for components if shadow pierce operator is not defined
      {
        "/entry.pc": `
          <style>
            :global(.a, .b) {
              &--c {
                color: blue;
              }
            }
          </style>
        `
      },
      {},
      `<style>.a, .b { } .a--c { color:blue; } .b--c { color:blue; }</style>`
    ],
    [
      {
        "/entry.pc": `
          <style>
            @mixin a {
              color: b;
            }
            
            .a {
              @include a;
              background: c;
            }
          </style>
        `
      },
      {},
      `<style>._80f4925f_a { color:b; background:c; }</style>`
    ],
    [
      {
        "/entry.pc": `
          <style>
            @mixin a {
              color: b;
            }
            @mixin b {
              @include a;
              color: c;
            }
            
            .c {
              @include b;
              background: c;
            }
          </style>
        `
      },
      {},
      `<style>._80f4925f_c { color:b; color:c; background:c; }</style>`
    ],
    [
      {
        "/entry.pc": `
          <import as="a" src="./module.pc">
          <style>
            @export {
              .c {
                @include a.b;
                background: c;
              }
            }
          </style>
        `,
        "/module.pc": `
          <import as="a" src="./module2.pc">
          <style>
            @export {
              @mixin b {
                @include a.b;
                color: blue;
              }
            }          
          </style>
        `,
        "/module2.pc": `
          <style>
            @export {
              @mixin b {
                color: orange;
              }
            }          
          </style>
        `
      },
      {},
      `<style>._80f4925f_c { color:orange; color:blue; background:c; }</style>`
    ],
    [
      {
        "/entry.pc": `
          <import as="mod" src="./module.pc">
          <mod>
            <mod.item>a</mod.item>
            <mod.item>b</mod.item>
            <mod.item>c</mod.item>
          </mod>
        `,
        "/module.pc": `
          <div export component as="default">
            {children}
          </div>
          <span export component as="item">
            {children}
          </span>
        `
      },
      {},
      `<style></style><div data-pc-139cec8e><span data-pc-139cec8e>a</span><span data-pc-139cec8e>b</span><span data-pc-139cec8e>c</span></div>`
    ]
  ].forEach(([graph, context, expectedHTML]: [Graph, Object, string]) => {
    it(`can render "${JSON.stringify(graph)}"`, async () => {
      const engine = createMockEngine(graph);

      const p = waitForEvaluated(engine);
      engine.load("/entry.pc");
      const event = await p;
      const nodeStr = stringifyVirtualNode(event.node);
      expect(nodeStr.replace(/[\r\n\t\s]+/g, " ").trim()).to.eql(
        String(expectedHTML)
          .replace(/[\r\n\t\s]+/g, " ")
          .trim()
      );
    });
  });
});
