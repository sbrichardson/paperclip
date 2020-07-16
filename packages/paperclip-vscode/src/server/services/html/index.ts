import * as fs from "fs";
import { BaseEngineLanguageService, ASTInfo } from "../base";
import {
  Rule,
  Node,
  Sheet,
  getImportById,
  Element,
  NodeKind,
  StyleDeclarationKind,
  IncludeDeclarationPart,
  StyleDeclaration,
  getParts,
  RuleKind,
  getImports,
  AS_ATTR_NAME,
  ConditionRule,
  MixinRule,
  KeyValueDeclaration,
  IncludeDeclaration,
  EngineEvent,
  getImportIds,
  EngineEventKind,
  getStyleElements,
  StyleRule,
  getAttributeValue,
  DependencyNodeContent,
  getChildren,
  AttributeValueKind,
  getAttributeStringValue,
  AttributeKind,
  resolveImportFile,
  StatementKind,
  resolveImportUri,
  getMixins,
  ExportRule,
  DEFAULT_PART_ID
} from "paperclip";

import CSS_COLOR_NAMES from "./css-color-names";
import { Engine } from "paperclip";
import {
  getSuggestionContext,
  SuggestContextKind
} from "paperclip-autocomplete";
import { PCAutocomplete } from "./autocomplete";
import { CompletionItem } from "vscode-languageclient";
import { PCCompletionItem } from "./utils";
import { PCExports, LoadedData } from "paperclip";
import { connect } from "http2";
const CSS_COLOR_NAME_LIST = Object.keys(CSS_COLOR_NAMES);
const CSS_COLOR_NAME_REGEXP = new RegExp(
  `\\b(?<![-_])(${CSS_COLOR_NAME_LIST.join("|")})(?![-_])\\b`,
  "g"
);

/**
 * Main HTML language service. Contains everything for now.
 */

type HandleContext = {
  root: Node;
  uri: string;
  importIds: string[];
  data?: LoadedData;
  partIds: string[];
  info: ASTInfo;
};

export class PCHTMLLanguageService extends BaseEngineLanguageService<Node> {
  private _autocomplete = new PCAutocomplete();
  supports(uri: string) {
    return /\.pc$/.test(uri);
  }
  protected _handleEngineEvent(event: EngineEvent) {
    if (
      event.kind === EngineEventKind.Evaluated ||
      event.kind === EngineEventKind.Diffed
    ) {
      this.clear(event.uri);
    }
  }
  protected _getAST(uri): Node {
    return this._engine.getLoadedAst(uri) as DependencyNodeContent;
  }
  public getCompletionItems(uri: string, text: string): any {
    return this._autocomplete.getSuggestions(
      uri,
      text,
      this._engine.getLoadedData(uri)
    );
  }
  public resolveCompletionItem(item: PCCompletionItem): CompletionItem {
    return this._autocomplete.resolveCompletionItem(item);
  }
  protected _createASTInfo(root: Node, uri: string, data: LoadedData) {
    const context: HandleContext = {
      root,
      uri,
      importIds: getImportIds(root),
      data,
      partIds: getParts(root)
        .map(part => getAttributeStringValue(AS_ATTR_NAME, part))
        .filter(Boolean),
      info: {
        colors: [],
        links: [],
        definitions: []
      }
    };
    this._handleStyles(context);
    this._handleDocument(context);

    return context.info;
  }

  private _handleStyles(context: HandleContext) {
    const styleElements = getStyleElements(context.root);
    for (const { sheet } of styleElements) {
      this._handleSheet(sheet, context);
    }
  }

  private _handleSheet(sheet: Sheet, context: HandleContext) {
    this._handleRules(sheet.rules, context);
  }

  private _handleRules(rules: Rule[], context: HandleContext) {
    for (const rule of rules) {
      switch (rule.kind) {
        case RuleKind.Style: {
          this._handleStyleRule(rule, context);
          break;
        }
        case RuleKind.Media: {
          this._handleMediaRule(rule, context);
          break;
        }
        case RuleKind.Mixin: {
          this._handleMixinRule(rule, context);
          break;
        }
        case RuleKind.Export: {
          this._handleExportRule(rule, context);
          break;
        }
      }
    }
  }

  private _handleMediaRule(rule: ConditionRule, context: HandleContext) {
    for (const child of rule.rules) {
      this._handleStyleRule(child, context);
    }
  }

  private _handleExportRule(rule: ExportRule, context: HandleContext) {
    this._handleRules(rule.rules, context);
  }

  private _handleMixinRule(rule: MixinRule, context: HandleContext) {
    this._handleDeclarations(rule.declarations, context);
  }

  private _handleDeclarations(
    declarations: StyleDeclaration[],
    context: HandleContext
  ) {
    for (const declaration of declarations) {
      switch (declaration.declarationKind) {
        case StyleDeclarationKind.KeyValue: {
          this._handleKeyValueDeclaration(declaration, context);
          break;
        }
        case StyleDeclarationKind.Include: {
          this._handleIncludeDeclaration(declaration, context);
          break;
        }
      }
    }
  }

  private _handleStyleRule(rule: StyleRule, context: HandleContext) {
    this._handleDeclarations(rule.declarations, context);
    for (const child of rule.children) {
      this._handleStyleRule(child, context);
    }
  }
  private _handleKeyValueDeclaration(
    declaration: KeyValueDeclaration,
    context: HandleContext
  ) {
    const colors =
      matchColor(declaration.value) ||
      declaration.value.match(/\#[^\s,;]+|(var)\(.*?\)/g) ||
      [];

    for (const color of colors) {
      let colorValue;
      if (/var\(.*?\)/.test(color)) {
        const name = color.match(/var\((.*?)\)/)[1];
        const value = getVariableValue(name, context.data);
        if (value) {
          const match = matchColor(value);
          if (match) {
            colorValue = match[0];
          }
        }
      } else {
        colorValue = color;
      }

      if (!colorValue) {
        continue;
      }

      const colorIndex = declaration.value.indexOf(color);

      // Color(color)
      // const {color: [r, g, b], valpha: a } = Color(color);
      const colorStart = declaration.valueLocation.start + colorIndex;

      context.info.colors.push({
        color: colorValue,
        location: { start: colorStart, end: colorStart + color.length }
      });
    }
  }

  private _handleIncludeDeclaration(
    declaration: IncludeDeclaration,
    context: HandleContext
  ) {
    const mixins = getMixins(context.root);
    for (const mixinRef of declaration.mixins) {
      // @include local-ref;
      if (mixinRef.parts.length === 1) {
        const ref = mixinRef.parts[0];
        const mixin = mixins[ref.name];
        if (mixin) {
          this._handleMixinRef(ref, mixin, context.uri, context);
        }
      } else if (mixinRef.parts.length === 2) {
        const impRef = mixinRef.parts[0];
        const ref = mixinRef.parts[1];

        if (context.importIds.includes(impRef.name)) {
          const [imp, impAst, impUri] = getImportSourceAst(
            impRef.name,
            context.root,
            context.uri,
            this._engine
          );

          if (impAst) {
            context.info.definitions.push({
              sourceUri: context.uri,
              sourceLocation: imp.openTagLocation,
              sourceDefinitionLocation: imp.openTagLocation,
              instanceLocation: impRef.location
            });
            const mixin = getMixins(impAst)[ref.name];
            if (mixin) {
              this._handleMixinRef(ref, mixin, impUri, context);
            }
          }
        }
      }
    }
  }

  private _handleMixinRef(
    name: IncludeDeclarationPart,
    mixin: MixinRule,
    sourceUri: string,
    context: HandleContext
  ) {
    context.info.definitions.push({
      sourceUri,
      sourceLocation: mixin.name.location,
      sourceDefinitionLocation: mixin.name.location,
      instanceLocation: name.location
    });
  }

  private _handleDocument(context: HandleContext) {
    this._handleImports(context);
    this._handleMainTemplate(context);
    this._handleParts(context);
  }

  private _handleImports(context: HandleContext) {
    const { root: node, uri } = context;
    const imports = getImports(node);
    for (const imp of imports) {
      const srcAttr = getAttributeValue("src", imp);
      if (srcAttr.attrValueKind === AttributeValueKind.String) {
        context.info.links.push({
          uri: resolveImportUri(fs)(uri, srcAttr.value),
          location: srcAttr.location
        });
      }
    }
  }

  private _handleMainTemplate(context: HandleContext) {
    for (const child of getChildren(context.root)) {
      this._handleNode(child, context);
    }
  }

  private _handleParts(context: HandleContext) {
    for (const child of getParts(context.root)) {
      this._handleNode(child, context);
    }
  }

  private _handleNode(node: Node, context: HandleContext) {
    if (node.kind === NodeKind.Element) {
      this._handleElement(node, context);
    }
    for (const child of getChildren(node)) {
      this._handleNode(child, context);
    }
  }

  private _handleElement(element: Element, context: HandleContext) {
    const tagParts = element.tagName.split(".");
    const namespace = tagParts[0];
    const name = tagParts[tagParts.length - 1];
    this._handleAttributes(element, context);
    if (context.partIds.indexOf(namespace) !== -1) {
      this._handlePartInstance(
        element,
        namespace,
        context.root,
        context.uri,
        context
      );
    } else if (context.importIds.indexOf(namespace) !== -1) {
      const [imp, impAst, impUri] = getImportSourceAst(
        namespace,
        context.root,
        context.uri,
        this._engine
      );

      if (impAst) {
        if (tagParts.length === 2) {
          this._handlePartInstance(element, name, impAst, impUri, context);
        } else {
          this._handlePartInstance(
            element,
            DEFAULT_PART_ID,
            impAst,
            impUri,
            context
          );
        }
      }
    }
  }

  private _handleAttributes(element: Element, context: HandleContext) {
    for (const attr of element.attributes) {
      if (attr.kind === AttributeKind.KeyValueAttribute && attr.value) {
        if (attr.value.attrValueKind === AttributeValueKind.Slot) {
          if (attr.value.script.jsKind === StatementKind.Node) {
            this._handleNode((attr.value as any) as Node, context);
          }
        } else if (
          attr.value.attrValueKind === AttributeValueKind.String &&
          attr.name === "src"
        ) {
          context.info.links.push({
            uri: resolveUri(context.uri, attr.value.value),
            location: attr.value.location
          });
        }
      }
    }
  }

  private _handlePartInstance(
    element: Element,
    name: string,
    sourceRoot: Node,
    sourceUri: string,
    context: HandleContext
  ) {
    const part = getParts(sourceRoot).find(part => {
      return getAttributeStringValue(AS_ATTR_NAME, part) === name;
    });

    if (part) {
      context.info.definitions.push({
        sourceUri,
        sourceLocation: part.openTagLocation,
        sourceDefinitionLocation: part.location,
        instanceLocation: element.tagNameLocation
      });
    }
  }
}

const resolveUri = resolveImportFile(fs);

const getImportSourceAst = (
  id: string,
  root: Node,
  uri: string,
  engine: Engine
): [Element, DependencyNodeContent, string] => {
  const imp = getImportById(id, root);

  if (!imp) {
    return [null, null, null];
  }

  const impUri = resolveImportFile(fs)(
    uri,
    getAttributeStringValue("src", imp)
  );

  return [imp, engine.getLoadedAst(impUri) as DependencyNodeContent, impUri];
};

const getVariableValue = (name: string, data: LoadedData) => {
  if (!data) {
    return null;
  }
  const v = data.exports.style.variables[name];
  if (v) return v.value;

  for (const id in data.imports) {
    const v = data.imports[id].style.variables[name];
    if (v) {
      return v.value;
    }
  }
};

const matchColor = (value: string) => {
  return (
    value.match(/\#[a-zA-Z0-9]+|(rgba|rgb|hsl|hsla|var)\(.*?\)/g) ||
    value.match(CSS_COLOR_NAME_REGEXP)
  );
};
