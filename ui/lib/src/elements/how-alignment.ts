import {css, html, LitElement} from "lit";
import {property, query} from "lit/decorators.js";

import {contextProvided} from "@lit-labs/context";
import {StoreSubscriber} from "lit-svelte-stores";

import {sharedStyles} from "../sharedStyles";
import {Alignment, howContext, STAUTS_COMPLETED} from "../types";
import {HowStore} from "../how.store";
import { HowDocumentDialog } from "./how-document-dialog";
import {ScopedElementsMixin} from "@open-wc/scoped-elements";
import {ProfilesStore, profilesStoreContext,} from "@holochain-open-dev/profiles";
import {
  Button,
  Dialog,
  TextField,
  TextArea,
} from "@scoped-elements/material-web";

/**
 * @element how-alignment
 */
export class HowAlignment extends ScopedElementsMixin(LitElement) {
  constructor() {
    super();
  }

  @property() currentAlignmentEh = "";

  @contextProvided({ context: howContext })
  _store!: HowStore;

  @contextProvided({ context: profilesStoreContext })
  _profiles!: ProfilesStore;

  _myProfile = new StoreSubscriber(this, () => this._profiles.myProfile);
  _knownProfiles = new StoreSubscriber(this, () => this._profiles.knownProfiles);
  _alignments = new StoreSubscriber(this, () => this._store.alignments);
  _documents = new StoreSubscriber(this, () => this._store.documents);
  _documentPaths = new StoreSubscriber(this, () => this._store.documentPaths);

  @query('#document-dialog')
  _documentDialogElem!: HowDocumentDialog;

  get myNickName(): string {
    return this._myProfile.value.nickname;
  }

  handleNodelink(path: string) {
    console.log("clicked on", path)
    this.dispatchEvent(new CustomEvent('select-node', { detail: path, bubbles: true, composed: true }));
  }

  getPath() : string {
    if (!this.currentAlignmentEh) {
      return ""
    }
    const alignment: Alignment = this._alignments.value[this.currentAlignmentEh];
    return alignment.parents.length > 0 ? `${alignment.parents[0]}.${alignment.path_abbreviation}` : alignment.path_abbreviation
  }

  addDoc(document_type: string ) {
    this._documentDialogElem.open(this.getPath(), document_type);
  }

  render() {
    if (!this.currentAlignmentEh) {
      return;
    }
    /** Get current alignment*/
    const alignment: Alignment = this._alignments.value[this.currentAlignmentEh]

    /** the list of documents for this alignment */
    const path = this.getPath()
    const docs = this._documentPaths.value[path]
    const documents = docs ? docs.map(doc => html`<b>${doc.content.document_type}</b>${doc.content.content.map(({name, content, content_type})=>html`<h3>${name}</h3><div>${content}</div>`)}`) : undefined

    const processActions = []
    const processes = []
     for (const [procType, procName] of alignment.processes) {
        const path = `${procType}.${procName}`
        const elems = procType.split(".")
        const typeName = elems[elems.length-1]
        processActions.push(html`<mwc-button icon="add_circle"  @click=${()=>this.addDoc(path)}>${typeName}</mwc-button>`)
        processes.push(html`<li>${typeName}: <span class="node-link" @click=${()=>this.handleNodelink(path)}>${procName}</span></li>`)
      }

    /** Render layout */
    return html`
      <div class="alignment">
       <h4> ${alignment.short_name} </h4>
       <li> Parents: ${alignment.parents.map((path) => html`<span class="node-link" @click=${()=>this.handleNodelink(path)}>${path}</span>`)}</li>
       <li> Path Abbrev: ${alignment.path_abbreviation}</li>
       <li> Title: ${alignment.title}</li>
       <li> Summary: ${alignment.summary}</li>
       <li> Stewards: ${alignment.stewards.map((agent: string)=>html`<span class="agent" title="${agent}">${this._knownProfiles.value[agent].nickname}</span>`)}</li>
       <li> Status: ${alignment.status == STAUTS_COMPLETED ? "Completed" : alignment.processes[alignment.status][1]}
       ${processes}
       <li> Documents:
        <ul>${documents} 
        </ul>
         ${processActions}
      </li>
      </div>
      <how-document-dialog id="document-dialog">
      </how-document-dialog>
    `;
  }


  static get scopedElements() {
    return {
      "mwc-button": Button,
      "how-document-dialog": HowDocumentDialog,
    };
  }
  static get styles() {
    return [
      sharedStyles,
      css`
      .alignment {
        border: solid .1em #666;
        border-radius: .2em;
        margin-left: 20px;
        padding: 10px;
      }
      .alignment h4 {
        margin-top: 0px;
        margin-bottom: 5px;
      }
      .alignment li {
        list-style: none;
        line-height: 1.5em;
      }
      .node-link {
        cursor: pointer;
        background-color: white;
        border: solid .1em #666;
        border-radius: .2em;
        padding: 0 6px 0 6px;
      }
      `,
    ];
  }
}
