use crate::base::ast::Location;
use crate::pc::ast as pc_ast;
use serde::Serialize;
use std::fmt;

#[derive(Debug, PartialEq, Serialize, Clone)]
#[serde(tag = "jsKind")]
pub enum Statement {
  Reference(Reference),
  Boolean(Boolean),
  String(Str),
  Number(Number),
  Array(Array),
  Object(Object),
  Node(Box<pc_ast::Node>),
}

#[derive(Debug, PartialEq, Serialize, Clone)]
pub struct Str {
  pub value: String,
  pub location: Location,
}

#[derive(Debug, PartialEq, Serialize, Clone)]
pub struct Number {
  pub value: String,
  pub location: Location,
}

#[derive(Debug, PartialEq, Serialize, Clone)]
pub struct Boolean {
  pub value: bool,
  pub location: Location,
}

impl fmt::Display for Statement {
  fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
    match self {
      Statement::Reference(reference) => write!(f, "{}", reference.to_string()),
      Statement::Node(node) => write!(f, "{}", node.to_string()),
      Statement::String(value) => write!(f, "\"{}\"", value.value.to_string()),
      Statement::Boolean(value) => write!(f, "{}", value.value.to_string()),
      Statement::Number(value) => write!(f, "{}", value.value.to_string()),
      Statement::Array(value) => write!(f, "{}", value.to_string()),
      Statement::Object(value) => value.fmt(f),
    }
  }
}

impl Statement {
  pub fn get_location(&self) -> &Location {
    match self {
      Statement::Reference(value) => &value.location,
      Statement::Node(value) => value.get_location(),
      Statement::String(value) => &value.location,
      Statement::Boolean(value) => &value.location,
      Statement::Number(value) => &value.location,
      Statement::Array(value) => &value.location,
      Statement::Object(value) => &value.location,
    }
  }
}

#[derive(Debug, PartialEq, Serialize, Clone)]
pub struct Array {
  pub values: Vec<Statement>,
  pub location: Location,
}

impl fmt::Display for Array {
  fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
    let buffer: Vec<String> = self.values.iter().map(|value| value.to_string()).collect();
    write!(f, "{}", format!("[{}]", buffer.join(", ")))
  }
}

#[derive(Debug, PartialEq, Serialize, Clone)]
pub struct Object {
  pub properties: Vec<Property>,
  pub location: Location,
}

impl fmt::Display for Object {
  fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
    let buffer: Vec<String> = self
      .properties
      .iter()
      .map(|value| value.to_string())
      .collect();
    write!(f, "{}", format!("{{{}}}", buffer.join(", ")))
  }
}

#[derive(Debug, PartialEq, Serialize, Clone)]
pub struct Property {
  pub key: String,
  pub value: Statement,
}

impl fmt::Display for Property {
  fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
    write!(
      f,
      "{}",
      format!("{}:{}", self.key.to_string(), self.value.to_string())
    )
  }
}

#[derive(Debug, PartialEq, Serialize, Clone)]
pub struct Reference {
  pub location: Location,
  pub path: Vec<ReferencePart>,
}

impl fmt::Display for Reference {
  fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
    write!(
      f,
      "{}",
      self
        .path
        .iter()
        .map(|part| { part.to_string() })
        .collect::<Vec<String>>()
        .join(".Statement")
    )
  }
}

#[derive(Debug, PartialEq, Serialize, Clone)]
pub struct ReferencePart {
  pub optional: bool,
  pub name: String,
}

impl fmt::Display for ReferencePart {
  fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
    write!(f, "{}", self.name);
    if self.optional {
      write!(f, "?");
    }
    Ok(())
  }
}
