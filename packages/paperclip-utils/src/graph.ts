import { Node } from "./ast";
import { Sheet } from "./css-ast";

export enum DependencyContentKind {
  Node = "Node",
  Stylsheet = "Stylesheet"
}

export type BaeDependencyContent<TKind> = {
  contentKind: TKind;
};

export type DependencyNodeContent = BaeDependencyContent<
  DependencyContentKind.Node
> &
  Node;
export type DependencyStyleSheetContent = BaeDependencyContent<
  DependencyContentKind.Stylsheet
> &
  Sheet;
export type DependencyContent =
  | DependencyNodeContent
  | DependencyStyleSheetContent;
