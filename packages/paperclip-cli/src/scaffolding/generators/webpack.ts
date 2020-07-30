import * as fsa from "fs-extra";
import * as path from "path";
import { GeneratorKind } from "./base";
import { FILES_DIR } from "./utils";

const WEBPACK_CONTENT = fsa.readFileSync(
  path.join(FILES_DIR, "webpack.config-js"),
  "utf8"
);

export const webpack = {
  kind: GeneratorKind.Webpack,
  prepare() {
    return {
      [GeneratorKind.Node]: {
        devDependencies: [
          "webpack",
          "webpack-dev-server",
          "paperclip-loader",
          "html-webpack-plugin",
          "webpack-cli",
          "css-loader",
          "style-loader",
          "file-loader",
          "ts-loader"
        ],
        scripts: {
          build: ["webpack"],
          "build:watch": ["webpack --watch"],
          start: ["webpack-dev-server"]
        }
      }
    };
  },
  generate({ rules, entry }) {
    return {
      "webpack.config.js": WEBPACK_CONTENT.replace("{{ENTRY}}", entry).replace(
        "{{RULES}}",
        rules && rules.length ? rules + "," : ""
      )
    };
  }
};