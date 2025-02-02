pub use hdk::prelude::*;
use hdk::hash_path::path::Component;
use std::collections::BTreeMap;
use holo_hash::{EntryHashB64, AgentPubKeyB64};

use crate::error::*;
use crate::signals::*;
use crate::tree::*;

type ProcessType = String;
type ProcessName = String;

/// Alignment entry definition
#[hdk_entry(id = "alignment")]
#[derive(Clone)]
pub struct Alignment {
    pub parents: Vec<String>, // full paths to parent nodes (remember it's a DAG)
    pub path_abbreviation: String, // max 10 char
    pub short_name: String, // max 25 char
    pub title: String,
    pub summary: String,
    pub stewards: Vec<AgentPubKeyB64>,  // people who can change this document
    pub status: i8, // index of current process
    pub processes: Vec<(ProcessType,ProcessName)>, // paths to processes to use
    pub history: BTreeMap<String, EntryHashB64>,
    pub meta: BTreeMap<String, String>, // for UI to do things    pub name: String,
}

impl Alignment {
    fn paths(&self) -> Vec<Path> {
        let mut paths = Vec::new();
        for parent in &self.parents {
            let mut path = Vec::new();
            path.push(Component::from(TREE_ROOT));
            for c in Path::from(parent).as_ref().into_iter() {
                path.push(c.clone());
            }
            path.push(Component::from(&self.path_abbreviation));
            paths.push(Path::from(path));
        };
        if paths.len() == 0 {
            let mut path = Vec::new();
            path.push(Component::from(TREE_ROOT));
            if self.path_abbreviation != "" {
                path.push(Component::from(&self.path_abbreviation));
            }
            paths.push(Path::from(path));
        }
        paths
    }
}

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct AlignmentOutput {
    pub hash: EntryHashB64,
    pub content: Alignment,
}


fn get_alignments_path() -> Path {
    Path::from("alignments")
}

#[hdk_extern]
pub fn create_alignment(input: Alignment) -> ExternResult<EntryHashB64> {
    let _header_hash = create_entry(&input)?;
    let tree_paths = input.paths();
    let hash = hash_entry(&input)?;
    emit_signal(&SignalPayload::new(hash.clone().into(), Message::NewAlignment(input)))?;
    let path = get_alignments_path();
    path.ensure()?;
    let anchor_hash = path.hash()?;
    create_link(anchor_hash, hash.clone(), ())?;   
    for path in tree_paths {
        path.ensure()?;
        create_link(path.hash()?, hash.clone(), LinkTag::new("alignment"))?;   
    }
    Ok(hash.into())
}

///
#[hdk_extern]
fn get_alignments(_: ()) -> ExternResult<Vec<AlignmentOutput>> {
    let path = get_alignments_path();
    let anchor_hash = path.hash()?;
    let alignments = get_alignments_inner(anchor_hash)?;
    Ok(alignments)
}

fn get_alignments_inner(base: EntryHash) -> HowResult<Vec<AlignmentOutput>> {
    let links = get_links(base, None)?;

    let get_input = links
        .into_iter()
        .map(|link| GetInput::new(link.target.into(), GetOptions::default()))
        .collect();

    let alignment_elements = HDK.with(|hdk| hdk.borrow().get(get_input))?;

    let alignment_entries: Vec<(Alignment, Header)> = alignment_elements
        .into_iter()
        .filter_map(|me| me)
        .filter_map(|element| match element.entry().to_app_option() {
            Ok(Some(g)) => Some((g, element.header().clone())),
            _ => None,
        })
        .collect();

    let mut alignments = vec![];
    for (a,h) in alignment_entries {
        alignments.push(AlignmentOutput {
            hash: h.entry_hash().unwrap().clone().into(),
            content: a,
        });
    }
    Ok(alignments)
}
