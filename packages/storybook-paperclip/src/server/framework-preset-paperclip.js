"use strict";
var __assign =
  (this && this.__assign) ||
  function() {
    __assign =
      Object.assign ||
      function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
          s = arguments[i];
          for (var p in s)
            if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
        }
        return t;
      };
    return __assign.apply(this, arguments);
  };
var __spreadArrays =
  (this && this.__spreadArrays) ||
  function() {
    for (var s = 0, i = 0, il = arguments.length; i < il; i++)
      s += arguments[i].length;
    for (var r = Array(s), k = 0, i = 0; i < il; i++)
      for (var a = arguments[i], j = 0, jl = a.length; j < jl; j++, k++)
        r[k] = a[j];
    return r;
  };
exports.__esModule = true;
exports.webpack = void 0;
function webpack(config) {
  console.log(process.cwd());
  return __assign(__assign({}, config), {
    module: __assign(__assign({}, config.module), {
      rules: __spreadArrays(config.module.rules, [
        ,
        {
          test: /\.pc$/,
          loader: "paperclip-loader",
          exclude: [/node_modules/],
          options: {
            compilerOptions: {
              name: "paperclip-compiler-react"
            },
            moduleDirectories: ["./src"],
            filesGlob: "./src/**/*.pc"
          }
        }
      ])
    }),
    resolve: __assign(__assign({}, config.resolve), {
      extensions: __spreadArrays(config.resolve.extensions, [".pc"]),
      alias: config.resolve.alias
    })
  });
}
exports.webpack = webpack;
