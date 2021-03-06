use super::super::ast;
use super::cache::Cache;
use super::export::{ComponentExport, Exports, Property};
use super::virt;
use crate::base::ast::{ExprSource, Location};
use crate::base::runtime::RuntimeError;
use crate::base::utils::{get_document_style_scope, is_relative_path};
use crate::core::graph::{Dependency, DependencyContent, DependencyGraph};
use crate::core::vfs::VirtualFileSystem;
use crate::css::runtime::evaluator::{evaluate as evaluate_css, EvalInfo as CSSEvalInfo};
use crate::css::runtime::export as css_export;
use crate::css::runtime::virt as css_virt;
use crate::js::ast as js_ast;
use crate::js::runtime::evaluator::evaluate as evaluate_js;
use crate::js::runtime::virt as js_virt;
use regex::Regex;
use serde::Serialize;
use std::collections::{BTreeMap, HashMap, HashSet};
use std::iter::FromIterator;

#[derive(Clone)]
pub struct Context<'a> {
  pub graph: &'a DependencyGraph,
  pub vfs: &'a VirtualFileSystem,
  pub uri: &'a String,
  pub import_ids: HashSet<&'a String>,
  pub part_ids: HashSet<&'a String>,
  pub scope: String,
  pub import_scopes: BTreeMap<String, String>,
  pub data: &'a js_virt::JsValue,
  pub render_call_stack: Vec<(String, RenderStrategy)>,
  pub import_graph: &'a HashMap<String, BTreeMap<String, Exports>>,
}

impl<'a> Context<'a> {
  pub fn get_current_render_strategy(&self) -> &(String, RenderStrategy) {
    self
      .render_call_stack
      .get(self.render_call_stack.len() - 1)
      .unwrap()
  }
}

#[derive(Clone, PartialEq, Debug)]
pub enum RenderStrategy {
  Part(String),
  Preview,
  Auto,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct EvalInfo {
  pub sheet: css_virt::CSSSheet,
  pub preview: virt::Node,
  pub exports: Exports,
}

pub fn evaluate<'a>(
  uri: &String,
  graph: &'a DependencyGraph,
  vfs: &'a VirtualFileSystem,
  import_graph: &'a HashMap<String, BTreeMap<String, Exports>>,
) -> Result<Option<EvalInfo>, RuntimeError> {
  let dep = graph.dependencies.get(uri).unwrap();
  if let DependencyContent::Node(node_expr) = &dep.content {
    let data = js_virt::JsValue::JsObject(js_virt::JsObject::new(ExprSource::new(
      uri.clone(),
      node_expr.get_location().clone(),
    )));
    let mut context = create_context(node_expr, uri, graph, vfs, &data, None, import_graph);

    let preview = wrap_as_fragment(
      evaluate_instance_node(
        node_expr,
        &mut context,
        RenderStrategy::Auto,
        false,
        0,
        None,
      )?,
      &context,
    );

    let (sheet, css_exports) = evaluate_document_sheet(uri, node_expr, &mut context)?;

    Ok(Some(EvalInfo {
      sheet,
      preview,
      exports: Exports {
        style: css_exports,
        components: collect_component_exports(&node_expr, &context)?,
      },
    }))
  } else {
    Err(RuntimeError::new(
      "Incorrect file type".to_string(),
      uri,
      &Location { start: 0, end: 0 },
    ))
  }
}

fn collect_component_exports<'a>(
  root: &ast::Node,
  context: &Context,
) -> Result<BTreeMap<String, ComponentExport>, RuntimeError> {
  let mut exports: BTreeMap<String, ComponentExport> = BTreeMap::new();

  let children = ast::get_children(root);

  if let Some(children) = children {
    for child in children.iter() {
      if let ast::Node::Element(element) = child {
        if ast::has_attribute("component", element)
          && ast::get_attribute_value("as", element) != None
        {
          let id = ast::get_attribute_value("as", element).unwrap();

          let properties = collect_node_properties(child);

          if exports.contains_key(id) {
            return Err(RuntimeError::new(
              "Component name is already declared.".to_string(),
              context.uri,
              &element.location,
            ));
          }

          exports.insert(
            id.to_string(),
            ComponentExport {
              name: id.to_string(),
              properties,
              public: ast::get_attribute("export", element) != None,
            },
          );
        }
      }
    }
  }

  Ok(exports)
}

fn collect_node_properties<'a>(node: &ast::Node) -> BTreeMap<String, Property> {
  let mut properties: BTreeMap<String, Property> = BTreeMap::new();

  node.walk(&mut |node| -> bool {
    match node {
      ast::Node::Element(element) => {
        for attr in &element.attributes {
          match attr {
            ast::Attribute::KeyValueAttribute(kv_attr) => {
              if let Some(value) = &kv_attr.value {
                match value {
                  ast::AttributeValue::Slot(slot) => {
                    add_script_property(&slot.script, &mut properties);
                  }
                  ast::AttributeValue::DyanmicString(d_string) => {
                    for val in &d_string.values {
                      match val {
                        ast::AttributeDynamicStringPart::Slot(slot) => {
                          add_script_property(&slot, &mut properties);
                        }
                        ast::AttributeDynamicStringPart::ClassNamePierce(_)
                        | ast::AttributeDynamicStringPart::Literal(_) => {}
                      }
                    }
                  }
                  ast::AttributeValue::String(_) => {}
                }
              }
            }
            ast::Attribute::SpreadAttribute(spread) => {
              add_script_property(&spread.script, &mut properties);
            }
            ast::Attribute::PropertyBoundAttribute(p_attr) => {
              add_property(&p_attr.binding_name, true, &mut properties);
            }
            ast::Attribute::ShorthandAttribute(s_attr) => {
              add_script_property(&s_attr.reference, &mut properties);
            }
          }
        }
      }
      ast::Node::Slot(slot) => {
        add_script_property(&slot.script, &mut properties);
      }
      _ => {}
    }
    true
  });

  properties
}

fn add_script_property(script: &js_ast::Statement, properties: &mut BTreeMap<String, Property>) {
  if let js_ast::Statement::Reference(reference) = script {
    let part = reference.path.get(0).unwrap();
    add_property(&part.name, part.optional, properties);
  }
}

fn add_property(name: &String, optional: bool, properties: &mut BTreeMap<String, Property>) {
  let optional = if let Some(prop) = properties.get(name) {
    prop.optional
  } else {
    optional
  };

  properties.insert(
    name.to_string(),
    Property {
      name: name.to_string(),
      optional,
    },
  );
}

fn wrap_as_fragment(node_option: Option<virt::Node>, context: &Context) -> virt::Node {
  if let Some(node) = node_option {
    match node {
      virt::Node::Fragment(fragment) => virt::Node::Fragment(fragment),
      _ => virt::Node::Fragment(virt::Fragment {
        source: node.get_source().clone(),
        children: vec![node],
      }),
    }
  } else {
    virt::Node::Fragment(virt::Fragment {
      children: vec![],
      source: ExprSource::virt(context.uri.clone()),
    })
  }
}

pub fn get_instance_target_node<'a>(
  node_expr: &'a ast::Node,
  render_strategy: &RenderStrategy,
  imported: bool,
) -> Option<&'a ast::Node> {
  let target_node_option = match render_strategy {
    RenderStrategy::Part(id) => find_child(node_expr, |child| {
      ast::get_attribute_value("as", child) == Some(&id)
        && ast::has_attribute("component", child)
        && (!imported || ast::has_attribute("export", child))
    }),
    RenderStrategy::Auto | RenderStrategy::Preview => {
      find_child(node_expr, |child| ast::has_attribute("preview", child))
    }
  };

  if let Some(target_node) = target_node_option {
    Some(target_node)
  } else if render_strategy == &RenderStrategy::Auto {
    Some(node_expr)
  } else {
    None
  }
}

fn find_child<TTest>(parent: &ast::Node, test: TTest) -> Option<&ast::Node>
where
  TTest: Fn(&ast::Element) -> bool,
{
  match ast::get_children(parent) {
    Some(children) => children.iter().find(|child| {
      if let ast::Node::Element(element) = child {
        if test(element) {
          return true;
        }
      }
      false
    }),
    None => None,
  }
}

fn evaluate_document_sheet<'a>(
  uri: &String,
  entry_expr: &ast::Node,
  context: &'a mut Context,
) -> Result<(css_virt::CSSSheet, css_export::Exports), RuntimeError> {
  let mut sheet = css_virt::CSSSheet { rules: vec![] };

  let mut css_exports: css_export::Exports = css_export::Exports::new();

  let children_option = ast::get_children(&entry_expr);
  let scope = get_document_style_scope(uri);
  if let Some(children) = children_option {
    // style elements are only allowed in root, so no need to traverse
    for child in children {
      if let ast::Node::StyleElement(style_element) = &child {
        let info = evaluate_css(
          &style_element.sheet,
          uri,
          &scope,
          context.import_scopes.clone(),
          context.vfs,
          context.graph,
          &context.import_graph,
          Some(&css_exports),
        )?;
        match info {
          CSSEvalInfo {
            sheet: child_sheet,
            exports: child_exports,
          } => {
            sheet.extend(child_sheet);
            css_exports.extend(&child_exports);
          }
        }
      }
    }
  }

  Ok((sheet, css_exports))
}

pub fn evaluate_instance_node<'a>(
  node_expr: &ast::Node,
  context: &'a mut Context,
  render_strategy: RenderStrategy,
  imported: bool,
  depth: u32,
  instance_source: Option<ExprSource>,
) -> Result<Option<virt::Node>, RuntimeError> {
  context
    .render_call_stack
    .push((context.uri.to_string(), render_strategy.clone()));
  let target_option = get_instance_target_node(node_expr, &render_strategy, imported);
  if let Some(target) = target_option {
    evaluate_node(target, true, depth, instance_source, context)
  } else {
    Ok(None)
  }
}

fn create_context<'a>(
  node_expr: &'a ast::Node,
  uri: &'a String,
  graph: &'a DependencyGraph,
  vfs: &'a VirtualFileSystem,
  data: &'a js_virt::JsValue,
  parent_option: Option<&'a Context>,
  import_graph: &'a HashMap<String, BTreeMap<String, Exports>>,
) -> Context<'a> {
  let render_call_stack = if let Some(parent) = parent_option {
    parent.render_call_stack.clone()
  } else {
    vec![]
  };

  let scope = get_document_style_scope(uri);

  Context {
    graph,
    uri,
    vfs,
    render_call_stack,
    import_graph,
    import_ids: HashSet::from_iter(ast::get_import_ids(node_expr)),
    import_scopes: get_import_scopes(graph.dependencies.get(uri).unwrap()),
    part_ids: HashSet::from_iter(ast::get_part_ids(node_expr)),
    scope,
    data,
  }
}

pub fn get_import_scopes<'a>(entry: &Dependency) -> BTreeMap<String, String> {
  let mut scopes = BTreeMap::new();
  for (id, uri) in &entry.dependencies {
    scopes.insert(id.to_string(), get_document_style_scope(uri));
  }
  scopes
}

pub fn evaluate_node<'a>(
  node_expr: &ast::Node,
  is_root: bool,
  depth: u32,
  instance_source: Option<ExprSource>,
  context: &'a mut Context,
) -> Result<Option<virt::Node>, RuntimeError> {
  match &node_expr {
    ast::Node::Element(el) => evaluate_element(&el, is_root, depth, instance_source, context),
    ast::Node::StyleElement(el) => {
      if depth != 1 {
        return Err(RuntimeError::new(
          "Style blocks needs to be defined at the root.".to_string(),
          context.uri,
          &el.location,
        ));
      }
      return evaluate_style_element(&el, context);
    }
    ast::Node::Text(text) => Ok(Some(virt::Node::Text(virt::Text {
      source: ExprSource {
        uri: context.uri.to_string(),
        location: text.location.clone(),
      },
      value: text.value.to_string(),
    }))),
    ast::Node::Slot(slot) => evaluate_slot(&slot, depth, context),
    ast::Node::Fragment(el) => evaluate_fragment(&el, depth, context),
    ast::Node::Comment(_el) => Ok(None),
  }
}

fn evaluate_element<'a>(
  element: &ast::Element,
  is_root: bool,
  depth: u32,
  instance_source: Option<ExprSource>,
  context: &'a mut Context,
) -> Result<Option<virt::Node>, RuntimeError> {
  match element.tag_name.as_str() {
    "import" => evaluate_import_element(element, context),
    "script" | "property" | "logic" => Ok(None),
    _ => {
      if ast::has_attribute("component", element) {
        if let Some(id) = ast::get_attribute_value("as", element) {
          if context.get_current_render_strategy()
            != &(
              context.uri.to_string(),
              RenderStrategy::Part(id.to_string()),
            )
          {
            if depth != 1 {
              return Err(RuntimeError::new(
                "Components need to be defined at the root.".to_string(),
                context.uri,
                &element.location,
              ));
            }
            return Ok(None);
          }
        }
      }

      let source = instance_or_element_source(element, context.uri, instance_source);

      if context.import_ids.contains(&ast::get_tag_name(&element)) {
        let result = evaluate_imported_component(element, source, depth, context);

        if Ok(None) == result {
          return Err(RuntimeError::new(
            "Unable to find component, or it's not exported.".to_string(),
            &context.uri,
            &element.open_tag_location,
          ));
        }

        result
      } else if context.part_ids.contains(&element.tag_name) {
        evaluate_part_instance_element(element, source, depth, context)
      } else {
        if element.tag_name == "fragment" {
          evaluate_children_as_fragment(&element.children, depth, &element.location, context)
        } else {
          evaluate_native_element(element, is_root, depth, source, context)
        }
      }
    }
  }
}

fn instance_or_element_source<'a>(
  element: &ast::Element,
  dep_uri: &String,
  source_option: Option<ExprSource>,
) -> Option<ExprSource> {
  if let Some(source) = source_option {
    Some(source)
  } else {
    Some(ExprSource {
      uri: dep_uri.clone(),
      location: element.location.clone(),
    })
  }
}

fn evaluate_slot<'a>(
  slot: &ast::Slot,
  depth: u32,
  context: &'a mut Context,
) -> Result<Option<virt::Node>, RuntimeError> {
  assert_slot_restrictions(&slot.location, context)?;

  let script = &slot.script;
  let mut js_value = evaluate_js(script, depth + 1, context)?;

  // if array of values, then treat as document fragment
  if let js_virt::JsValue::JsArray(ary) = &mut js_value {
    let mut children = vec![];
    for item in ary.values.drain(0..) {
      if let js_virt::JsValue::JsNode(child) = item {
        children.push(child);
      } else {
        children.push(virt::Node::Text(virt::Text {
          source: item.get_source().clone(),
          value: item.to_string(),
        }))
      }
    }

    return Ok(Some(virt::Node::Fragment(virt::Fragment {
      children,
      source: ary.source.clone(),
    })));
  } else if let js_virt::JsValue::JsNode(node) = js_value {
    return Ok(Some(node));
  }

  Ok(Some(virt::Node::Text(virt::Text {
    source: js_value.get_source().clone(),
    value: if js_value.truthy() {
      js_value.to_string()
    } else {
      "".to_string()
    },
  })))
}

pub fn evaluate_imported_component<'a>(
  element: &ast::Element,
  instance_source: Option<ExprSource>,
  depth: u32,
  context: &'a mut Context,
) -> Result<Option<virt::Node>, RuntimeError> {
  let self_dep = &context.graph.dependencies.get(context.uri).unwrap();

  let dep_uri = &self_dep
    .dependencies
    .get(&ast::get_tag_name(element))
    .unwrap();
  let namespace_option = ast::get_tag_namespace(element);
  evaluate_component_instance(
    element,
    if let Some(part) = namespace_option {
      RenderStrategy::Part(part)
    } else {
      RenderStrategy::Part("default".to_string())
    },
    true,
    depth,
    instance_source,
    dep_uri,
    context,
  )
}

fn in_render_stack<'a>(strategy: &RenderStrategy, context: &'a mut Context) -> bool {
  context
    .render_call_stack
    .iter()
    .any(|(uri, part)| uri == context.uri && part == strategy)
}

fn check_instance_loop<'a>(
  strategy: &RenderStrategy,
  element: &ast::Element,
  context: &'a mut Context,
) -> Result<(), RuntimeError> {
  let tag_option = match strategy {
    RenderStrategy::Part(id) => Some(id.to_string()),
    RenderStrategy::Preview | RenderStrategy::Auto => None,
  };

  if let Some(tag) = tag_option {
    if in_render_stack(strategy, context) {
      return Err(RuntimeError {
        uri: context.uri.to_string(),
        message: format!(
          "Can't call <{} /> here since this causes an infinite loop!",
          tag
        )
        .to_string(),
        location: element.open_tag_location.clone(),
      });
    } else {
      Ok(())
    }
  } else {
    Ok(())
  }
}

fn evaluate_part_instance_element<'a>(
  element: &ast::Element,
  instance_source: Option<ExprSource>,
  depth: u32,
  context: &'a mut Context,
) -> Result<Option<virt::Node>, RuntimeError> {
  let self_dep = &context.graph.dependencies.get(context.uri).unwrap();

  if let DependencyContent::Node(_root_node) = &self_dep.content {
    evaluate_component_instance(
      element,
      RenderStrategy::Part(element.tag_name.to_string()),
      false,
      depth,
      instance_source,
      context.uri,
      context,
    )
  } else {
    // This should _never_ happen
    Err(RuntimeError::unknown(context.uri))
  }
}

fn create_component_instance_data<'a>(
  instance_element: &ast::Element,
  depth: u32,
  context: &'a mut Context,
) -> Result<js_virt::JsValue, RuntimeError> {
  let mut data = js_virt::JsObject::new(ExprSource {
    uri: context.uri.clone(),
    location: instance_element.location.clone(),
  });

  let mut property_bound_attrs: Vec<&ast::PropertyBoundAttribute> = vec![];

  for attr_expr in &instance_element.attributes {
    let attr = &attr_expr;
    match attr {
      ast::Attribute::KeyValueAttribute(kv_attr) => {
        if kv_attr.value == None {
          data.values.insert(
            kv_attr.name.to_string(),
            js_virt::JsValue::JsBoolean(js_virt::JsBoolean {
              value: true,
              source: ExprSource::new(context.uri.clone(), kv_attr.location.clone()),
            }),
          );
        } else {
          let value = evaluate_attribute_value(
            &instance_element.tag_name,
            &kv_attr.name,
            &kv_attr.value.as_ref().unwrap(),
            false,
            depth,
            context,
          )?;

          data.values.insert(kv_attr.name.to_string(), value);
        }
      }
      ast::Attribute::SpreadAttribute(attr) => {
        assert_slot_restrictions(&attr.location, context)?;
        let attr_data = evaluate_js(&attr.script, depth + 1, context)?;
        match attr_data {
          js_virt::JsValue::JsObject(mut object) => {
            for (key, value) in object.values.drain() {
              data.values.insert(key.to_string(), value);
            }
          }
          _ => {
            return Err(RuntimeError::new(
              "Spread value must be an object.".to_string(),
              context.uri,
              &instance_element.location,
            ));
          }
        };
      }
      ast::Attribute::ShorthandAttribute(sh_attr) => {
        let name = sh_attr.get_name().map_err(|message| RuntimeError {
          uri: context.uri.to_string(),
          message: message.to_string(),
          location: Location { start: 0, end: 0 },
        })?;
        assert_attr_slot_restrictions(
          &instance_element.tag_name,
          &name.to_string(),
          &sh_attr.location,
          context,
        )?;

        data.values.insert(
          name.to_string(),
          evaluate_attribute_slot(&sh_attr.reference, depth, context)?,
        );
      }
      ast::Attribute::PropertyBoundAttribute(kv_attr) => {
        assert_attr_slot_restrictions(
          &instance_element.tag_name,
          &kv_attr.name,
          &kv_attr.location,
          context,
        )?;
        property_bound_attrs.push(kv_attr);
      }
    };
  }

  // property bound attributes happen at the end so that we ensure that they're actually
  // added
  if property_bound_attrs.len() > 0 {
    for kv_attr in property_bound_attrs {
      match context.data {
        js_virt::JsValue::JsObject(object) => {
          let value_option = object.values.get(&kv_attr.binding_name);
          if let Some(prop_value) = value_option {
            if prop_value.truthy() {
              let value = if let Some(attr_value) = &kv_attr.value {
                evaluate_attribute_value(
                  &instance_element.tag_name,
                  &kv_attr.name,
                  attr_value,
                  false,
                  depth,
                  context,
                )?
              } else {
                evaluate_attribute_key_value_string(
                  &kv_attr.name,
                  &kv_attr.binding_name,
                  &kv_attr.location,
                  false,
                  context,
                )?
              };

              let combined_value = if let Some(existing_value) = data.values.get(&kv_attr.name) {
                js_virt::JsValue::JsString(js_virt::JsString {
                  value: format!(
                    "{} {}",
                    stringify_attribute_value(&kv_attr.name, existing_value),
                    value.to_string()
                  ),
                  source: ExprSource::new(context.uri.clone(), kv_attr.location.clone()),
                })
              } else {
                value
              };

              data.values.insert(kv_attr.name.to_string(), combined_value);
            }
          }
        }
        _ => {}
      }
    }
  }

  let mut js_children = js_virt::JsArray::new(ExprSource::new(
    context.uri.clone(),
    instance_element.location.clone(),
  ));
  let children: Vec<js_virt::JsValue> =
    evaluate_children(&instance_element.children, depth, context)?
      .into_iter()
      .map(|child| js_virt::JsValue::JsNode(child))
      .collect();

  js_children.values.extend(children);

  data.values.insert(
    "children".to_string(),
    js_virt::JsValue::JsArray(js_children),
  );

  Ok(js_virt::JsValue::JsObject(data))
}

fn combine_attr_value(
  value: String,
  other_value: Option<&Option<String>>,
  separator: String,
) -> String {
  if let Some(v) = other_value {
    if let Some(v2) = v {
      return format!("{}{}{}", value, separator, v2);
    }
  }

  return value;
}

fn evaluate_component_instance<'a>(
  instance_element: &ast::Element,
  render_strategy: RenderStrategy,
  imported: bool,
  depth: u32,
  instance_source: Option<ExprSource>,
  dep_uri: &String,
  context: &'a mut Context,
) -> Result<Option<virt::Node>, RuntimeError> {
  // if matches!(&context
  //   .graph
  //   .dependencies
  //   .get(&dep_uri.to_string()), None) {
  //   panic!("UH OH!");
  // }

  let dep = &context
    .graph
    .dependencies
    .get(&dep_uri.to_string())
    .unwrap();
  let data = create_component_instance_data(instance_element, depth, context)?;

  if let DependencyContent::Node(node) = &dep.content {
    let mut instance_context = create_context(
      &node,
      dep_uri,
      context.graph,
      context.vfs,
      &data,
      Some(&context),
      context.import_graph,
    );
    check_instance_loop(&render_strategy, instance_element, &mut instance_context)?;
    // TODO: if fragment, then wrap in span. If not, then copy these attributes to root element

    let source = if let Some(source) = instance_source {
      source.clone()
    } else {
      ExprSource {
        uri: dep_uri.to_string(),
        location: instance_element.location.clone(),
      }
    };

    evaluate_instance_node(
      &node,
      &mut instance_context,
      render_strategy,
      imported,
      depth,
      Some(source),
    )
  } else {
    Err(RuntimeError::unknown(context.uri))
  }
}

fn evaluate_native_element<'a>(
  element: &ast::Element,
  is_root: bool,
  depth: u32,
  instance_source: Option<ExprSource>,
  context: &'a mut Context,
) -> Result<Option<virt::Node>, RuntimeError> {
  let mut attributes: BTreeMap<String, Option<String>> = BTreeMap::new();

  let mut tag_name = ast::get_tag_name(element);

  let mut property_bound_attrs: Vec<&ast::PropertyBoundAttribute> = vec![];

  for attr_expr in &element.attributes {
    let attr = &attr_expr;

    match attr {
      ast::Attribute::KeyValueAttribute(kv_attr) => {
        let (name, mut value_option) = if kv_attr.value == None {
          (kv_attr.name.to_string(), None)
        } else {
          let value = evaluate_attribute_value(
            &element.tag_name,
            &kv_attr.name,
            &kv_attr.value.as_ref().unwrap(),
            true,
            depth,
            context,
          )?;
          if !value.truthy() {
            continue;
          }
          (
            kv_attr.name.to_string(),
            Some(stringify_attribute_value(&kv_attr.name, &value)),
          )
        };

        if name == "export" || name == "component" || name == "as" {
          continue;
        }
        attributes.insert(name.to_string(), value_option);
      }
      ast::Attribute::PropertyBoundAttribute(kv_attr) => {
        assert_attr_slot_restrictions(
          &element.tag_name,
          &kv_attr.name,
          &kv_attr.location,
          context,
        )?;
        property_bound_attrs.push(kv_attr);
      }
      ast::Attribute::SpreadAttribute(attr) => {
        assert_slot_restrictions(&attr.location, context)?;
        let attr_data = evaluate_js(&attr.script, depth + 1, context)?;
        match attr_data {
          js_virt::JsValue::JsObject(mut object) => {
            for (key, value) in object.values.drain() {
              attributes.insert(key.to_string(), Some(value.to_string()));
            }
          }
          _ => {
            return Err(RuntimeError::new(
              "Spread value must be an object.".to_string(),
              context.uri,
              &element.location,
            ));
          }
        };
      }
      ast::Attribute::ShorthandAttribute(sh_attr) => {
        let name = sh_attr.get_name().map_err(|message| RuntimeError {
          uri: context.uri.to_string(),
          message: message.to_string(),
          location: Location { start: 0, end: 0 },
        })?;
        assert_attr_slot_restrictions(
          &element.tag_name,
          &name.to_string(),
          &sh_attr.location,
          context,
        )?;
        let mut js_value = evaluate_attribute_slot(&sh_attr.reference, depth, context)?;

        if js_value.truthy() {
          js_value = maybe_cast_attribute_js_value(name, js_value, true, context);

          attributes.insert(
            name.to_string(),
            Some(stringify_attribute_value(&name, &js_value)),
          );
        }
      }
    };
  }

  if property_bound_attrs.len() > 0 {
    for kv_attr in property_bound_attrs {
      match context.data {
        js_virt::JsValue::JsObject(object) => {
          let value_option = object.values.get(&kv_attr.binding_name);
          if let Some(prop_value) = value_option {
            if prop_value.truthy() {
              let value = if let Some(kv_value) = &kv_attr.value {
                evaluate_attribute_value(
                  &element.tag_name,
                  &kv_attr.name,
                  &kv_value,
                  true,
                  depth,
                  context,
                )?
              } else {
                evaluate_attribute_key_value_string(
                  &kv_attr.name,
                  &kv_attr.binding_name,
                  &kv_attr.location,
                  true,
                  context,
                )?
              };

              let combined_value = combine_attr_value(
                stringify_attribute_value(&kv_attr.name, &value),
                attributes.get(&kv_attr.name),
                " ".to_string(),
              );

              attributes.insert(kv_attr.name.to_string(), Some(combined_value));
            }
          }
        }
        _ => {}
      }
    }
  }

  // if is_root {
  //   if let js_virt::JsValue::JsObject(object) = &context.data {
  //     let class_key = "class".to_string();
  //     let class_option = object.values.get(&class_key);
  //     if let Some(class) = class_option {
  //       let existing_option = attributes.get(&class_key);
  //       if let Some(existing) = existing_option {
  //         if existing != &None {
  //           let combined_class = format!("{} {}", existing.clone().unwrap(), class);
  //           attributes.insert(class_key, Some(combined_class));
  //         }
  //       }
  //     }
  //   }
  // }

  let name = format!("data-pc-{}", context.scope.to_string()).to_string();

  attributes.insert(name.to_string(), None);

  // allow for tag name to be dynamically changed.
  if let Some(tag_name_attr_value_option) = attributes.get("tagName") {
    if let Some(tag_name_attr_value) = tag_name_attr_value_option {
      tag_name = tag_name_attr_value.to_string();
    }
    attributes.remove("tagName");
  }

  let children = evaluate_children(&element.children, depth, context)?;

  Ok(Some(virt::Node::Element(virt::Element {
    source: if let Some(source) = &instance_source {
      source.clone()
    } else {
      ExprSource {
        uri: context.uri.to_string(),
        location: element.location.clone(),
      }
    },
    tag_name: tag_name,
    attributes,
    children,
  })))
}

fn stringify_attribute_value(key: &String, value: &js_virt::JsValue) -> String {
  if key == "style" {
    if let js_virt::JsValue::JsObject(object) = value {
      let mut buffer = String::new();
      for (key, value) in object.values.iter() {
        buffer = format!("{}{}:{};", buffer, key.to_string(), value.to_string());
      }
      return buffer;
    }
  }

  return value.to_string();
}

fn evaluate_import_element<'a>(
  _element: &ast::Element,
  _context: &'a mut Context,
) -> Result<Option<virt::Node>, RuntimeError> {
  Ok(None)
}

fn evaluate_style_element<'a>(
  _element: &ast::StyleElement,
  _context: &'a mut Context,
) -> Result<Option<virt::Node>, RuntimeError> {
  Ok(None)
}

fn evaluate_children<'a>(
  children_expr: &Vec<ast::Node>,
  depth: u32,
  context: &'a mut Context,
) -> Result<Vec<virt::Node>, RuntimeError> {
  let mut children: Vec<virt::Node> = vec![];

  for child_expr in children_expr {
    match evaluate_node(child_expr, false, depth + 1, None, context)? {
      Some(c) => match c {
        virt::Node::Fragment(mut fragment) => {
          for child in fragment.children.drain(0..) {
            children.push(child);
          }
        }
        _ => {
          children.push(c);
        }
      },
      None => {}
    }
  }

  Ok(children)
}

fn evaluate_fragment<'a>(
  fragment: &ast::Fragment,
  depth: u32,
  context: &'a mut Context,
) -> Result<Option<virt::Node>, RuntimeError> {
  evaluate_children_as_fragment(&fragment.children, depth, &fragment.location, context)
}

fn evaluate_children_as_fragment<'a>(
  children: &Vec<ast::Node>,
  depth: u32,
  location: &Location,
  context: &'a mut Context,
) -> Result<Option<virt::Node>, RuntimeError> {
  let mut children = evaluate_children(&children, depth, context)?;
  Ok(Some(virt::Node::Fragment(virt::Fragment {
    children,
    source: ExprSource {
      uri: context.uri.clone(),
      location: location.clone(),
    },
  })))
}

fn evaluate_attribute_value<'a>(
  tag_name: &String,
  name: &String,
  value: &ast::AttributeValue,
  is_native: bool,
  depth: u32,
  context: &mut Context,
) -> Result<js_virt::JsValue, RuntimeError> {
  match value {
    ast::AttributeValue::DyanmicString(st) => {
      evaluate_attribute_dynamic_string(name, st, &st.location, is_native, depth, context)
    }
    ast::AttributeValue::String(st) => {
      evaluate_attribute_key_value_string(name, &st.value, &st.location, is_native, context)
    }
    ast::AttributeValue::Slot(value) => {
      assert_attr_slot_restrictions(tag_name, name, &value.location, context)?;
      let value = evaluate_attribute_slot(&value.script, depth, context)?;
      Ok(maybe_cast_attribute_js_value(name, value, true, context))
    }
  }
}

fn evaluate_attribute_dynamic_string<'a>(
  name: &String,
  value: &ast::AttributeDynamicStringValue,
  location: &Location,
  is_native: bool,
  depth: u32,
  context: &mut Context,
) -> Result<js_virt::JsValue, RuntimeError> {
  let mut buffer = vec![];

  for part in value.values.iter() {
    buffer.push(match part {
      ast::AttributeDynamicStringPart::Literal(value) => value.value.to_string(),
      ast::AttributeDynamicStringPart::ClassNamePierce(pierce) => {
        if pierce.class_name.contains(".") {
          let parts = pierce.class_name.split(".").collect::<Vec<&str>>();
          let imp = parts.first().unwrap().to_string();
          let dep_option = context
            .graph
            .dependencies
            .get(context.uri)
            .unwrap()
            .dependencies
            .get(&imp);

          let dep_uri = if let Some(dep_uri) = dep_option {
            dep_uri
          } else {
            return Err(RuntimeError::new(
              "Reference not found.".to_string(),
              context.uri,
              &pierce.location,
            ));
          };

          let class_name = parts.last().unwrap();
          let imports = if let Some(imports) = context.import_graph.get(context.uri) {
            imports
          } else {
            return Err(RuntimeError::unknown(context.uri));
          };

          let import_option = imports.get(&imp);

          let import = if let Some(import) = import_option {
            import
          } else {
            return Err(RuntimeError::new(
              "Reference not found.".to_string(),
              context.uri,
              &pierce.location,
            ));
          };

          let class_export_option = import.style.class_names.get(&class_name.to_string());

          let class_export = if let Some(class_export) = class_export_option {
            class_export
          } else {
            return Err(RuntimeError::new(
              "Class name not found.".to_string(),
              context.uri,
              &pierce.location,
            ));
          };

          if class_export.public {
            format!(
              "_{}_{} {}",
              get_document_style_scope(dep_uri),
              class_name,
              class_name
            )
          } else {
            return Err(RuntimeError::new(
              "This class reference is private.".to_string(),
              context.uri,
              &pierce.location,
            ));
          }
        } else {
          format!(
            "_{}_{} {}",
            context.scope, pierce.class_name, pierce.class_name
          )
        }
      }
      ast::AttributeDynamicStringPart::Slot(statement) => {
        evaluate_attribute_slot(statement, depth, context)
          .unwrap()
          .to_string()
      }
    });
  }

  let val = buffer.join("");
  // let val = value
  //   .values
  //   .iter()
  //   .map(|val|
  //   })
  //   .collect::<Vec<String>>()
  //   .join("");

  let js_value = js_virt::JsValue::JsString(js_virt::JsString {
    value: val.to_string(),
    source: ExprSource {
      uri: context.uri.clone(),
      location: location.clone(),
    },
  });

  Ok(maybe_cast_attribute_js_value(
    name, js_value, is_native, context,
  ))
}

fn is_class_attribute_name(name: &String) -> bool {
  name == "class" || name == "className"
}

fn transform_class_value<'a>(name: &String, value: &String, context: &mut Context) -> String {
  lazy_static! {
    static ref scope_re: Regex = Regex::new(r"^_\w+_").unwrap();
  }

  // if scope_re.is_match(value) {
  //   return value.to_string();
  // }

  let mut skip_next = false;

  let class_name_parts: Vec<&str> = value.split(" ").collect();
  class_name_parts
    .iter()
    .map(|class| {
      // if previous class is scoped, then skip
      if skip_next {
        skip_next = false;
        return class.to_string();
      }

      // if already scoped, then skip
      if scope_re.is_match(class) {
        skip_next = true;
        return class.to_string();
      }

      if class != &"" {
        format!("_{}_{} {}", context.scope, class, class)
      } else {
        class.to_string()
      }
    })
    .collect::<Vec<String>>()
    .join(" ")
}

fn transform_style_value<'a>(name: &String, value: &String, context: &mut Context) -> String {
  // Fixes https://github.com/crcn/paperclip/issues/336
  // Primitive but easy solution
  lazy_static! {
    static ref undefined_styles_re: Regex = Regex::new(r"[^\s]+:\s*undefined;?").unwrap();
  }

  if undefined_styles_re.is_match(value) {
    let mut new_value = value.to_string();

    for caps in undefined_styles_re.captures_iter(value.to_string().as_str()) {
      new_value = undefined_styles_re
        .replace(new_value.as_str(), "")
        .to_string();
    }

    // trim in case string is empty
    return new_value.trim().to_string();
  }

  return value.to_string();
}

fn cast_attribute_value<'a>(
  name: &String,
  value: &String,
  is_native: bool,
  context: &mut Context,
) -> Option<String> {
  if !is_native {
    return None;
  }
  if is_class_attribute_name(name) {
    Some(transform_class_value(name, value, context))
  } else if name == "style" {
    Some(transform_style_value(name, value, context))
  } else {
    None
  }
}

fn maybe_cast_attribute_js_value<'a>(
  name: &String,
  value: js_virt::JsValue,
  is_native: bool,
  context: &mut Context,
) -> js_virt::JsValue {
  let str_value = value.to_string();

  if let Some(casted_value) = cast_attribute_value(name, &str_value, is_native, context) {
    js_virt::JsValue::JsString(js_virt::JsString {
      value: casted_value.to_string(),
      source: value.get_source().clone(),
    })
  } else {
    value
  }
}

fn evaluate_attribute_key_value_string<'a>(
  name: &String,
  value: &String,
  location: &Location,
  is_native: bool,
  context: &mut Context,
) -> Result<js_virt::JsValue, RuntimeError> {
  let mut val = value.clone();

  if let Some(casted_value) = cast_attribute_value(name, value, is_native, context) {
    val = casted_value;
  } else if name == "src" {
    if is_relative_path(&value) {
      let value_option = context.vfs.resolve(context.uri, &value);
      if let Some(value) = &value_option {
        val = value.to_string();
      } else {
        return Err(RuntimeError::new(
          format!("Unable to resolve file: {} from {}", value, context.uri),
          context.uri,
          location,
        ));
      }
    }
  }

  Ok(js_virt::JsValue::JsString(js_virt::JsString {
    value: val.clone(),
    source: ExprSource {
      uri: context.uri.to_string(),
      location: location.clone(),
    },
  }))
}

fn evaluate_attribute_slot<'a>(
  script: &js_ast::Statement,
  depth: u32,
  context: &'a mut Context,
) -> Result<js_virt::JsValue, RuntimeError> {
  evaluate_js(script, depth + 1, context)
}

fn assert_attr_slot_restrictions(
  tag_name: &String,
  attr_name: &String,
  location: &Location,
  context: &Context,
) -> Result<(), RuntimeError> {
  // if tag_name == "component" {
  //   match attr_name.as_str() {
  //     "component" | "export" | "as" => {
  //       return Err(RuntimeError::new("Cannot bind to reserved attribute name.".to_string(), context.uri, location));
  //     },
  //     _ => {

  //     }
  //   }
  // }
  assert_slot_restrictions(location, context)?;

  return Ok(());
}

fn assert_slot_restrictions(location: &Location, context: &Context) -> Result<(), RuntimeError> {
  // if !in_instance(context) {
  //   return Err(RuntimeError::new(
  //     "Bindings can only be defined within components.".to_string(),
  //     context.uri,
  //     location,
  //   ));
  // }

  return Ok(());
}

fn in_instance(context: &Context) -> bool {
  for (src, strategy) in &context.render_call_stack {
    if let RenderStrategy::Part(_) = strategy {
      return true;
    }
  }
  return false;
}

#[cfg(test)]
mod tests {
  use super::super::super::parser::*;
  use super::*;

  #[test]
  fn can_evaluate_a_style() {
    let case = "<style>div { color: red; } a, b { & c { color: blue }}</style><div></div>";
    let ast = parse(case).unwrap();
    let graph = DependencyGraph::new();
    let vfs = VirtualFileSystem::new(
      Box::new(|_| "".to_string()),
      Box::new(|_| true),
      Box::new(|_, _| Some("".to_string())),
    );
    let _node = evaluate_source(case);
  }

  #[test]
  fn catches_infinite_part_loop() {
    let result = evaluate_source(
      "
      <fragment component as='test'>
        <div>
          <test a />          
        </div>
      </fragment>
      <preview>
        <test />
      </preview>
    ",
    );

    assert_eq!(
      result,
      Err(RuntimeError::new(
        "Can't call <test /> here since this causes an infinite loop!".to_string(),
        &"some-file.pc".to_string(),
        &Location { start: 62, end: 72 }
      ))
    );
  }

  #[test]
  fn catches_recursion_in_multiple_parts() {
    let result = evaluate_source(
      "
      <fragment component as='test2'>
        <div>
          <test />
        </div>
      </fragment>
      <fragment component as='test'>
        <div>
          <test2 />          
        </div>
      </fragment>
      <preview>
        <test />
      </preview>
    ",
    );

    assert_eq!(
      result,
      Err(RuntimeError::new(
        "Can't call <test /> here since this causes an infinite loop!".to_string(),
        &"some-file.pc".to_string(),
        &Location { start: 63, end: 71 }
      ))
    )
  }

  #[test]
  fn allows_self_to_be_called_in_preview() {
    evaluate_source(
      "
      Hello
      <preview>
        <self />
      </preview>
    ",
    )
    .unwrap();
  }

  fn evaluate_source<'a>(code: &'a str) -> Result<Option<EvalInfo>, RuntimeError> {
    let mut graph = DependencyGraph::new();
    let uri = "some-file.pc".to_string();
    let vfs = VirtualFileSystem::new(
      Box::new(|_| "".to_string()),
      Box::new(|_| true),
      Box::new(|_, uri| Some(uri.to_string())),
    );
    graph.dependencies.insert(
      uri.clone(),
      Dependency::from_source(code.to_string(), &uri, &vfs).unwrap(),
    );

    let mut import_graph = HashMap::new();
    import_graph.insert(uri.to_string(), BTreeMap::new());

    evaluate(&uri, &graph, &vfs, &import_graph)
  }

  #[test]
  fn can_evaluate_class_pierce() {
    let result = evaluate_source(
      "
      <div something='$something $that' />
    ",
    )
    .unwrap();
  }
}
