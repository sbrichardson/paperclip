import * as resolve from "resolve";
import { URL } from "url";
import * as chokidar from "chokidar";
import * as path from "path";
import * as fs from "fs";
import {
  PaperclipConfig,
  CompilerOptions,
  Engine,
  Node,
  Sheet,
  getPrettyMessage,
  getAllVirtSheetClassNames,
  evaluateAllFileStyles,
  stringifyCSSSheet
} from "paperclip";
import * as glob from "glob";

export type BuildOptions = {
  config: string;
  write: boolean;
  definition: boolean;
  watch: boolean;
  dropPcExtension: boolean;
  compilerName: string;
  filePatterns: string;
};

type CompileInfo = {
  ast: Node;
  classNames: string[];
};

type CompilerModule = {
  getOutputFilePath(uri: string, options: CompilerOptions): string;
  compile(info: CompileInfo, uri: string, options: any);
};

export const build = async (options: BuildOptions) => {
  let localConfig: PaperclipConfig;

  try {
    localConfig = require(resolve2(
      options.config || path.join(process.cwd(), "/pcconfig")
    ));
  } catch (e) {}

  const config: PaperclipConfig = {
    ...(localConfig || {}),
    moduleDirectories: localConfig.moduleDirectories || [],
    dropPcExtension: options.dropPcExtension || localConfig.dropPcExtension,
    filesGlob: options.filePatterns || localConfig.filesGlob,
    compilerOptions: {
      ...localConfig.compilerOptions,
      definition: options.definition || localConfig.compilerOptions.definition,
      name: options.compilerName || localConfig.compilerOptions.name
    }
  };

  const compiler = config.compilerOptions.name;
  const filesGlob = config.filesGlob;

  const compilerModulePath = resolve2(compiler);
  if (!compilerModulePath) {
    console.error('Compiler "%s" couldn\'t be found', compiler);
    process.exit();
  }

  const compileModule = require(compilerModulePath);

  if (!compileModule || !compileModule.compile) {
    console.error('Compiler "%s" does not export compile function', compiler);
    process.exit();
  }

  initBuild(process.cwd(), filesGlob, compileModule, options, config);
};

function initBuild(
  cwd,
  filesGlob: string,
  { compile, getOutputFilePath }: CompilerModule,
  options: BuildOptions,
  config: PaperclipConfig
) {
  const pcEngine = new Engine();

  function handleError(error, filePath) {
    console.error(
      getPrettyMessage(error, fs.readFileSync(filePath, "utf8"), filePath)
    );
  }

  async function compileFile(relativePath) {
    let fullPath = `file://${path
      .resolve(process.cwd(), relativePath)
      .replace(/\\/g, "/")
      .replace(":", "%3A")}`;
    const compilerOptions = config.compilerOptions;
    try {
      const ast = pcEngine.parseFile(fullPath);
      if (ast.error) {
        return handleError(ast.error, fullPath);
      }
      const sheet = pcEngine.evaluateFileStyles(fullPath);

      const styleMap = {
        [fullPath]: sheet,
        ...evaluateAllFileStyles(pcEngine, ast, fullPath)
      };
      const result = compile(
        { ast, classNames: getAllVirtSheetClassNames(styleMap) },
        fullPath,
        compilerOptions
      );
      if (options.write) {
        let outputFilePath = getOutputFilePath(fullPath, compilerOptions);
        if (config.dropPcExtension) {
          outputFilePath = outputFilePath.replace(".pc", "");
        }
        console.log("Writing %s", outputFilePath);
        fs.writeFileSync(new URL(outputFilePath), result);

        if (!compilerOptions.definition) {
          const cssFilePath = outputFilePath.replace(/\.\w+$/, ".css");
          console.log("Writing %s", cssFilePath);
          fs.writeFileSync(
            new URL(cssFilePath),
            stringifyCSSSheet(sheet, "file://")
          );
        }
      } else {
        console.log("Compiling %s", relativePath);
        console.log(result);
      }
    } catch (e) {
      console.log("Err %s", relativePath);
      console.error(e);
    }
  }
  glob(
    filesGlob,
    {
      cwd: cwd
    },
    async function(err, filePaths) {
      filePaths.map(compileFile);
    }
  );

  if (options.watch) {
    watch(cwd, filesGlob, compileFile);
  }
}

function watch(cwd, filesGlob, compileFile) {
  const watcher = chokidar.watch(filesGlob, {
    cwd: cwd
  });

  watcher.on("change", compileFile);
}

const resolve2 = module => {
  try {
    return resolve.sync(module, { basedir: process.cwd() });
  } catch (e) {
    try {
      return require.resolve(module);
    } catch (e) {
      return null;
    }
  }
};