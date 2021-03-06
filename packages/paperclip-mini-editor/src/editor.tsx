// import React, { useState, useEffect } from "react";
import * as ui from "./ui.pc";
import { createEngine, Engine } from "paperclip/browser";

import SimpleEditor from "react-simple-code-editor";

import Highlight, { Prism } from "prism-react-renderer";
// import { languages } from "prismjs/components/prism-core";
import { Renderer } from "paperclip-web-renderer";
import memoize from "fast-memoize";

// import "prismjs/components/prism-clike";
// import "prismjs/components/prism-css";
// import "prismjs/components/prism-markup";
// import "prismjs/components/prism-javascript";
// import "./prism.css";
import { render } from "react-dom";

export const createComponentClass = ({
  React,
  useState,
  useEffect,
  useRef
}: any) => {
  const usePaperclipEngine = initialGraph => {
    const [engine, setEngine] = useState(null);
    useEffect(() => {
      createEngine({
        io: {
          readFile(uri) {
            return initialGraph[uri];
          },
          resolveFile(from, to) {
            return to.replace("./", "");
          },
          fileExists(uri) {
            return Boolean(initialGraph[uri]);
          }
        }
      }).then(v => {
        setEngine(v);
      });
    }, [initialGraph]);
    return engine;
  };

  const cachedGraph = memoize(graph => graph, {
    serializer: graph => JSON.stringify(graph)
  });

  const Editor = ({
    graph,
    defaultUri,
    theme,
    previewStyle,
    responsive = true
  }) => {
    const initialGraph = cachedGraph(graph);
    const [currentGraph, setGraph] = useState(initialGraph);
    const [currentUri, setCurrentUri] = useState(defaultUri);

    const code = currentGraph[currentUri];

    const engine = usePaperclipEngine(initialGraph);

    const onCodeChange = code => {
      setGraph({
        ...currentGraph,
        [currentUri]: code
      });

      if (engine) {
        engine.updateVirtualFileContent(currentUri, code);
      }
    };

    const baseTheme =
      theme && typeof theme.plain === "object" ? theme.plain : {};

    return (
      <ui.Editor
        responsive={responsive}
        style={{
          "--background": theme.plain?.backgroundColor
        }}
      >
        <ui.CodePane
          tabs={
            <>
              {Object.keys(currentGraph).map(uri => {
                return (
                  <ui.Tab
                    selected={uri === currentUri}
                    onClick={() => setCurrentUri(uri)}
                  >
                    {uri}
                  </ui.Tab>
                );
              })}
            </>
          }
        >
          <SimpleEditor
            value={code}
            style={{
              width: "100%",
              minHeight: "100%",
              padding: "8px",
              ...baseTheme
            }}
            preClassName="language-html"
            onValueChange={onCodeChange}
            highlight={code => highlight(code, "html", theme)}
          />
        </ui.CodePane>
        <Preview engine={engine} style={previewStyle} currentUri={currentUri} />
      </ui.Editor>
    );
  };

  const highlight = (code, language, theme) => {
    return (
      <Highlight Prism={Prism} code={code} theme={theme} language={language}>
        {({ tokens, getLineProps, getTokenProps }) => (
          <>
            {tokens.map((line, i) => (
              // eslint-disable-next-line react/jsx-key
              <div {...getLineProps({ line, key: i })}>
                {line.map((token, key) => (
                  // eslint-disable-next-line react/jsx-key
                  <span {...getTokenProps({ token, key })} />
                ))}
              </div>
            ))}
          </>
        )}
      </Highlight>
    );
  };

  type PreviewProps = {
    engine?: Engine;
    currentUri: string;
    style: any;
  };

  const Preview = ({ engine, currentUri, style }: PreviewProps) => {
    const [iframeBody, setIframeBody] = useState();
    let renderer: Renderer;
    const iframeRef = useRef();

    useEffect(() => {
      if (!engine || !iframeBody) {
        return;
      }
      let disposeListener;
      renderer = new Renderer("http://", currentUri);

      const init = async () => {
        try {
          renderer.initialize(await engine.run(currentUri));
          disposeListener = engine.onEvent(event => {
            renderer.handleEngineEvent(event);
          });
        } catch (e) {
          console.warn(e);

          // wait for something to happen, then retry
          const dispose = engine.onEvent(event => {
            dispose();
            init();
          });
        }
      };

      init();

      iframeBody.appendChild(renderer.mount);
      return () => {
        if (disposeListener) {
          disposeListener();
        }
        iframeBody.removeChild(renderer.mount);
      };
    }, [engine, currentUri, iframeBody]);

    useEffect(() => {
      if (iframeBody) {
        return;
      }

      const timer = setInterval(() => {
        if (iframeRef.current?.contentDocument?.body) {
          const body = iframeRef.current.contentDocument.body;
          const style = body.ownerDocument.createElement("style");
          style.textContent = `html, body { margin: 0; padding: 0 }`;
          body.appendChild(style);
          setIframeBody(body);
        }
      }, 500);

      return () => {
        clearInterval(timer);
      };
    }, [iframeBody]);

    return <ui.PreviewPane style={style} iframeRef={iframeRef} />;
  };

  return Editor;
};
