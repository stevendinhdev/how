use std::collections::BTreeMap;

use futures::future;
use hdk::prelude::*;
// use holochain::sweettest::SweetConductor;
use holochain::sweettest::*;
use holochain::test_utils::consistency_10s;
use holo_hash::{EntryHashB64, AgentPubKeyB64};

use how::alignment::*;
use how::document::*;
use how::tree::*;
use how::*;

const DNA_FILEPATH: &str = "../../workdir/dna/how.dna";

#[tokio::test(flavor = "multi_thread")]
pub async fn test_basics() {
    let (conductors, _agents, apps) = setup_conductors(2).await;

    let conductor_alice = &conductors[0];
    let _conductor_bob = &conductors[1];

    let cells = apps.cells_flattened();
    let cell_alice = cells[0];
    let cell_bob = cells[1];

    /*
    let tree: Tree<(String, String)> = Tree::new_from

    let _ = conductor_alice
    .call(&cell_alice.zome("how"), "init", tree)
    .await;

    let tree_result: Tree = conductor_alice
    .call(&cell_alice.zome("how"), "get_tree", ())
    .await;
 */

    let aligment1 = Alignment {
        parents: vec!["hc_system".into()], // full paths to parent nodes (remember it's a DAG)
        path_abbreviation: "conductor".into(), // max 10 char
        short_name: "conductor".into(), // max 25 char
        title: "specification of the holochain conductor".into(),
        summary: "blah blah".into(),
        stewards: vec![],  // people who can change this document
        status: 0,
        processes: vec![("soc_proto.process.define".into(),"petition".into())], // paths to process template to use
        history: BTreeMap::new(),
        meta: BTreeMap::new(),
    };

    let input= Initialization {alignments: vec![aligment1], documents: vec![]};

    let _:() = conductor_alice
        .call(&cell_alice.zome("how"), "initialize", input.clone())
        .await;

    let alignment2 = Alignment {
        parents: vec!["hc_system.conductor.api".into()], // full paths to parent nodes (remember it's a DAG)
        path_abbreviation: "app".into(), // max 10 char
        short_name: "application".into(), // max 25 char
        title: "specification of the holochain conductor api for application access".into(),
        summary: "blah blah".into(),
        stewards: vec![AgentPubKeyB64::from(cell_alice.agent_pubkey().clone())],  // people who can change this document
        status: 0,
        processes: vec![("soc_proto.process.define".into(),"petition".into())], // paths to process template to use
        history: BTreeMap::new(),
        meta: BTreeMap::new(),
    };
    
    let hash: EntryHashB64 = conductor_alice
    .call(&cell_alice.zome("how"), "create_alignment", alignment2.clone())
    .await;

    consistency_10s(&[&cell_alice, &cell_bob]).await; 

    let alignments : Vec<AlignmentOutput> = conductor_alice
        .call(
            &cell_alice.zome("how"),
            "get_alignments",
            (),
        )
        .await;
    assert_eq!(alignments[1].hash, hash);
    assert_eq!(alignments.len(), 2);
    debug!("{:#?}", alignments);

    let content  = vec![Section::new("summary", "text/markdown", "blah blah")];
    let document = Document {
      document_type: String::from(DOC_TEMPLATE), // template path (i.e. a process template) or "_comment" "_reply", "_template"(or other reserved types which start with _)
      editors: vec![AgentPubKeyB64::from(cell_alice.agent_pubkey().clone())],  // people who can change this document, if empty anyone can
      content, // semantically identified content components
      meta: BTreeMap::new(), // semantically identified meta
    };

    let hash: EntryHashB64 = conductor_alice
    .call(&cell_alice.zome("how"), "create_document", 
DocumentInput {
            path: "hc_system.conductor.api".into(),
            document,
        })
    .await;

    let output:Vec<DocumentOutput> = conductor_alice
    .call(&cell_alice.zome("how"), "get_documents", "hc_system.conductor.api".to_string())
    .await;
    assert_eq!(output[0].hash, hash);

    let output:Tree<Content> = conductor_alice
    .call(&cell_alice.zome("how"), "get_tree", ())
    .await;

    debug!("TREE: {:?}", output);

}

// UTILS:

async fn setup_conductors(n: usize) -> (SweetConductorBatch, Vec<AgentPubKey>, SweetAppBatch) {
    let dna = SweetDnaFile::from_bundle(std::path::Path::new(DNA_FILEPATH))
        .await
        .unwrap();

    let mut conductors = SweetConductorBatch::from_standard_config(n).await;

    let all_agents: Vec<AgentPubKey> =
        future::join_all(conductors.iter().map(|c| SweetAgents::one(c.keystore()))).await;
    let apps = conductors
        .setup_app_for_zipped_agents("app", &all_agents, &[dna])
        .await
        .unwrap();

    conductors.exchange_peer_info().await;
    (conductors, all_agents, apps)
}