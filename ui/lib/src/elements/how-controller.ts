import { html, css, LitElement } from "lit";
import { state, property, query } from "lit/decorators.js";

import { contextProvided } from "@lit-labs/context";
import { StoreSubscriber } from "lit-svelte-stores";
import { Unsubscriber } from "svelte/store";

import { sharedStyles } from "../sharedStyles";
import {howContext, Alignment, Dictionary, Initialization, DOC_TEMPLATE, ProcessType, ProcessName,STAUTS_COMPLETED} from "../types";
import { HowStore } from "../how.store";
import { HowAlignment } from "./how-alignment";
import { HowTree } from "./how-tree";
import { HowAlignmentDialog } from "./how-alignment-dialog";
import { SlAvatar } from '@scoped-elements/shoelace';
import { ScopedElementsMixin } from "@open-wc/scoped-elements";
import {
  ListItem,
  Select,
  IconButton,
  Button, TextField, TopAppBar, Drawer, List, Icon, Switch, Formfield, Menu,
} from "@scoped-elements/material-web";
import {
  profilesStoreContext,
  ProfilesStore,
  Profile,
} from "@holochain-open-dev/profiles";
import {EntryHashB64} from "@holochain-open-dev/core-types";

/**
 * @element how-controller
 */
export class HowController extends ScopedElementsMixin(LitElement) {
  constructor() {
    super();
  }

  /** Public attributes */
  @property({ type: Boolean, attribute: 'dummy' })
  canLoadDummy = false;

  /** Dependencies */

  @contextProvided({ context: howContext })
  _store!: HowStore;

  @contextProvided({ context: profilesStoreContext })
  _profiles!: ProfilesStore;

  _myProfile = new StoreSubscriber(this, () => this._profiles.myProfile);
  _knownProfiles = new StoreSubscriber(this, () => this._profiles.knownProfiles);
  _alignments = new StoreSubscriber(this, () => this._store.alignments);
  _alignmentsPath = new StoreSubscriber(this, () => this._store.alignmentsPath);

  /** Private properties */

  @query('#my-drawer')
  private _drawer!: Drawer;

  @query('#tree')
  private _tree!: HowTree;

  @state() _currentAlignmentEh = "";

  private initialized = false;
  private initializing = false;


  async createDummyProfile() {
    const nickname = "Cam";
    const avatar = "https://cdn3.iconfinder.com/data/icons/avatars-9/145/Avatar_Cat-512.png";

    try {
      const fields: Dictionary<string> = {};
       if (avatar) {
         fields['avatar'] = avatar;
       }
      await this._profiles.createProfile({
        nickname,
        fields,
      });

    } catch (e) {
      //this._existingUsernames[nickname] = true;
      //this._nicknameField.reportValidity();
    }
  }


  get myNickName(): string {
    return this._myProfile.value.nickname;
  }
  get myAvatar(): string {
    return this._myProfile.value.fields.avatar;
  }

  getPath() : string {
    if (!this._currentAlignmentEh) {
      return ""
    }
    const alignment: Alignment = this._alignments.value[this._currentAlignmentEh];
    return alignment.parents.length > 0 ? `${alignment.parents[0]}.${alignment.path_abbreviation}` : alignment.path_abbreviation
  }

  private subscribeProfile() {
    let unsubscribe: Unsubscriber;
    unsubscribe = this._profiles.myProfile.subscribe(async (profile) => {
      if (profile) {
        await this.checkInit();
      }
      // unsubscribe()
    });
  }

  async firstUpdated() {
    if (this.canLoadDummy) {
      await this.createDummyProfile()
    }
    this.subscribeProfile()
  }
 
  private _getFirst(alignments: Dictionary<Alignment>): EntryHashB64 {
    if (Object.keys(alignments).length == 0) {
      return "";
    }
    for (let alignmentEh in alignments) {
//      const alignment = alignments[alignmentEh]
//      if (alignment.visible) {
        return alignmentEh
//      }
    }
    return "";
  }

  async checkInit() {
    if (this.initialized || this.initializing) {
      this.initialized = true;
      return;
    }
    this.initializing = true  // because checkInit gets call whenever profiles changes...
    let alignments = await this._store.pullAlignments();
    await this._store.pullTree();

    /** load up a alignment if there are none */
    if (Object.keys(alignments).length == 0) {
      console.log("no alignments found, initializing")
      await this.addHardcodedAlignments();
      alignments = await this._store.pullAlignments();
      await this._store.pullTree();
    }
    if (Object.keys(alignments).length == 0) {
      console.error("No alignments found")
    }
   // this._currentAlignmentEh = this._getFirst(alignments);

    //console.log("   current alignment: ",  alignments[this._currentAlignmentEh].short_name, this._currentAlignmentEh);

    // request the update so the drawer will be findable
    await this.requestUpdate();

    /** Drawer */
    if (this._drawer) {
      const container = this._drawer.parentNode!;
      container.addEventListener('MDCTopAppBar:nav', () => {
        this._drawer.open = !this._drawer.open;
      });
    }
    /** Menu */
    const menu = this.shadowRoot!.getElementById("top-menu") as Menu;
    const button = this.shadowRoot!.getElementById("menu-button") as IconButton;
    menu.anchor = button
    // - Done
    this.initializing = false
    this.initialized = true
  }

  async addHardcodedAlignments() {
    const std_procs: Array<[ProcessType, ProcessName]> = [["soc_proto.process.define","declaration"], ["soc_proto.process.refine", "prototyped"], ["soc_proto.process.align", "consensus"]]
    const init:Initialization = {
    alignments: [
      {
        parents: [], // full paths to parent nodes (remember it's a DAG)
        path_abbreviation: "", // max 10 char
        short_name: "Holochain Standards", // max 25 char
        title: "Holochain Community Standards",
        summary: "All the protocols and process and standards used by the holochain community",
        stewards: [this._store.myAgentPubKey],  // people who can change this document
      status: STAUTS_COMPLETED,
        processes: std_procs, // paths to process template to use
        history: {},
        meta: {}
      },
      {
      parents: [], // full paths to parent nodes (remember it's a DAG)
      path_abbreviation: "soc_proto", // max 10 char
      short_name: "Social Protocols", // max 25 char
      title: "Social Protocols used by the Holochain Community",
      summary: "The holochain community uses social protocols to get its work done.",
      stewards: [this._store.myAgentPubKey],  // people who can change this document
      status: STAUTS_COMPLETED,
      processes: std_procs, // paths to process template to use
      history: {},
      meta: {}
    },
    {
      parents: ["soc_proto"], // full paths to parent nodes (remember it's a DAG)
      path_abbreviation: "process", // max 10 char
      short_name: "How Processes", // max 25 charAgent
      title: "Processes types used for making changes to this tree",
      summary: "blah blah",
      stewards: [this._store.myAgentPubKey],  // people who can change this document
      status: STAUTS_COMPLETED,
      processes: std_procs, // paths to process template to use
      history: {},
      meta: {}
    },
    {
      parents: ["soc_proto.process"], // full paths to parent nodes (remember it's a DAG)
      path_abbreviation: "define", // max 10 char
      short_name: "Proposal procesess", // max 25 char
      title: "",
      summary: "blah blah",
      stewards: [this._store.myAgentPubKey],  // people who can change this document
      status: STAUTS_COMPLETED,
      processes: std_procs, // paths to process template to use
      history: {},
      meta: {}
    },
    {
      parents: ["soc_proto.process.define"], // full paths to parent nodes (remember it's a DAG)
      path_abbreviation: "declaration", // max 10 char
      short_name: "Declaration", // max 25 char
      title: "Making a proposal via declaration",
      summary: "blah blah",
      stewards: [this._store.myAgentPubKey],  // people who can change this document
      status: STAUTS_COMPLETED,
      processes: std_procs, // paths to process template to use
      history: {},
      meta: {}
    },
    {
      parents: ["soc_proto.process.define"], // full paths to parent nodes (remember it's a DAG)
      path_abbreviation: "petition", // max 10 char
      short_name: "Petition", // max 25 char
      title: "Making a proposal via petition",
      summary: "blah blah",
      stewards: [this._store.myAgentPubKey],  // people who can change this document
      status: STAUTS_COMPLETED,
      processes: std_procs, // paths to process template to use
      history: {},
      meta: {}
    },
    {
      parents: ["soc_proto.process"], // full paths to parent nodes (remember it's a DAG)
      path_abbreviation: "refine", // max 10 char
      short_name: "Refinement Processes", // max 25 char
      title: "Processes for reviewing proposals",
      summary: "blah blah",
      stewards: [this._store.myAgentPubKey],  // people who can change this document
      status: STAUTS_COMPLETED,
      processes: std_procs, // paths to process template to use
      history: {},
      meta: {}
    },
    {
      parents: ["soc_proto.process.refine"], // full paths to parent nodes (remember it's a DAG)
      path_abbreviation: "prototyped", // max 10 char
      short_name: "Prototyped refinements", // max 25 char
      title: "Refining a standard with prototypes",
      summary: "blah blah",
      stewards: [this._store.myAgentPubKey],  // people who can change this document
      status: STAUTS_COMPLETED,
      processes: std_procs, // paths to process template to use
      history: {},
      meta: {}
    },    {
      parents: ["soc_proto.process"], // full paths to parent nodes (remember it's a DAG)
      path_abbreviation: "align", // max 10 char
      short_name: "Alignment Processes", // max 25 char
      title: "Processes for approving proposals",
      summary: "blah blah",
      stewards: [this._store.myAgentPubKey],  // people who can change this document
      status: STAUTS_COMPLETED,
      processes: std_procs, // paths to process template to use
      history: {},
      meta: {}
    },
    {
      parents: ["soc_proto.process.align"], // full paths to parent nodes (remember it's a DAG)
      path_abbreviation: "vote", // max 10 char
      short_name: "Voting", // max 25 char
      title: "Process for approving reviewed proposals by voting",
      summary: "blah blah",
      stewards: [this._store.myAgentPubKey],  // people who can change this document
      status: STAUTS_COMPLETED,
      processes: std_procs, // paths to process template to use
      history: {},
      meta: {}
    },
    {
      parents: ["soc_proto.process.align"], // full paths to parent nodes (remember it's a DAG)
      path_abbreviation: "consensus", // max 10 char
      short_name: "Consensus", // max 25 char
      title: "Process for approving reviewed proposals by consensus",
      summary: "blah blah",
      stewards: [this._store.myAgentPubKey],  // people who can change this document
      status: STAUTS_COMPLETED,
      processes: std_procs, // paths to process template to use
      history: {},
      meta: {}
    },
    {
      parents: ["soc_proto.process.align"], // full paths to parent nodes (remember it's a DAG)
      path_abbreviation: "sortition", // max 10 char
      short_name: "Sortition", // max 25 char
      title: "Process for approving reviewed proposals by sortition",
      summary: "blah blah",
      stewards: [this._store.myAgentPubKey],  // people who can change this document
      status: STAUTS_COMPLETED,
      processes: std_procs, // paths to process template to use
      history: {},
      meta: {}
    },
    {
      parents: [], // full paths to parent nodes (remember it's a DAG)
      path_abbreviation: "hc_system", // max 10 char
      short_name: "Holochain System", // max 25 char
      title: "Holochain complete system",
      summary: "blah blah",
      stewards: [this._store.myAgentPubKey],  // people who can change this document
      status: STAUTS_COMPLETED,
      processes: std_procs, // paths to process template to use
      history: {},
      meta: {}
    },
    {
      parents: ["hc_system"], // full paths to parent nodes (remember it's a DAG)
      path_abbreviation: "conductor", // max 10 char
      short_name: "Holochain Conductor", // max 25 char
      title: "Holochain Conductor",
      summary: "blah blah",
      stewards: [this._store.myAgentPubKey],  // people who can change this document
      status: STAUTS_COMPLETED,
      processes: std_procs, // paths to process template to use
      history: {},
      meta: {}
    },
    {
      parents: ["hc_system.conductor"], // full paths to parent nodes (remember it's a DAG)
      path_abbreviation: "api", // max 10 char
      short_name: "Holochain Conductor API", // max 25 char
      title: "specification of the holochain conductor api",
      summary: "blah blah",
      stewards: [this._store.myAgentPubKey],  // people who can change this document
      status: STAUTS_COMPLETED,
      processes: std_procs, // paths to process template to use
      history: {},
      meta: {}
    }],
    documents: [
    {
      path: "soc_proto.process.define.petition",
      document: {  
        document_type: DOC_TEMPLATE,
        content: [
          {name: "title", content: "petition", content_type:"text/plain"},
        ],
        editors: [this._store.myAgentPubKey],
        meta: {}
      }
    },
    {
      path: "soc_proto.process.define.declaration",
      document: {  
        document_type: DOC_TEMPLATE,
        content: [
          {name: "title", content: "Declaration", content_type:"text/plain"},
          {name: "summary", content: "{}", content_type:"text/plain"},
        ],
        editors: [this._store.myAgentPubKey],
        meta: {}
      }
    },
    {
      path: "soc_proto.process.refine.prototyped",
      document: {  
        document_type: DOC_TEMPLATE,
        content: [
          {name: "title", content: "Prototyped", content_type:"text/plain"},
          {name: "summary", content: "{}", content_type:"text/plain"},
        ],
        editors: [this._store.myAgentPubKey],
        meta: {}
      }
    },
    {
      path: "soc_proto.process.align.vote",
      document: {  
        document_type: DOC_TEMPLATE,
        content: [
          {name: "title", content: "Voting", content_type:"text/plain"},
          {name: "summary", content: "{}", content_type:"text/plain"},
        ],
        editors: [this._store.myAgentPubKey],
        meta: {}
      }
    },
    {
      path: "soc_proto.process.align.consensus",
      document: {  
        document_type: DOC_TEMPLATE,
        content: [
          {name: "title", content: "Consensus", content_type:"text/plain"},
          {name: "summary", content: "{}", content_type:"text/plain"},
        ],
        editors: [this._store.myAgentPubKey],
        meta: {}
      }
    },
    {
      path: "soc_proto.process.align.sortition",
      document: {  
        document_type: DOC_TEMPLATE,
        content: [
          {name: "title", content: "Sortition", content_type:"text/plain"},
          {name: "summary", content: "{}", content_type:"text/plain"},
        ],
        editors: [this._store.myAgentPubKey],
        meta: {}
      }
    },
    ]}
    await this._store.initilize(init);
  }

  async refresh() {
    console.log("refresh: Pulling data from DHT")
    await this._store.pullAlignments();
    await this._store.pullTree();
    await this._profiles.fetchAllProfiles()
  }

  get alignmentElem(): HowAlignment {
    return this.shadowRoot!.getElementById("how-alignment") as HowAlignment;
  }

  async openAlignmentDialog(parent?: any) {
    this.alignmentDialogElem.open(parent);
  }

  get alignmentDialogElem() : HowAlignmentDialog {
    return this.shadowRoot!.getElementById("alignment-dialog") as HowAlignmentDialog;
  }

  private async handleAlignmentSelect(alignmentEh: string): Promise<void> {
    this._currentAlignmentEh = alignmentEh;
    this.alignmentElem.currentAlignmentEh = alignmentEh;
    this._tree.currentNode = alignmentEh;
  }

  handleNodeSelected(event: any) {
    const alignmentEh = event.detail
    if (this._alignments.value[alignmentEh]) {
      this.handleAlignmentSelect(alignmentEh)
      this._store.pullDocuments(this.getPath())
    }
  }

  handleAddChild(event: any) {
    const alignmentEh = event.detail
    this.openAlignmentDialog(alignmentEh)
  }

  openTopMenu() {
    const menu = this.shadowRoot!.getElementById("top-menu") as Menu;
    menu.open = true;
  }

  handleMenuSelect(e: any) {
    const menu = e.currentTarget as Menu;
    console.log("handleMenuSelect: " + menu)
    const selected = menu.selected as ListItem;
    console.log({selected})
    switch (e.originalTarget.innerHTML) {
      case "Duplicate Alignment":
        this.openAlignmentDialog(this._currentAlignmentEh)
        break;
      default:
        break;
    }
  }

  render() {
    return html`
<!--  DRAWER -->
<mwc-drawer type="dismissible" id="my-drawer">
  <div>
    <mwc-list>
    <mwc-list-item twoline graphic="avatar" noninteractive>
      <span>${this.myNickName}</span>
      <span slot="secondary">${this._profiles.myAgentPubKey}</span>
      <sl-avatar style="margin-left:-22px;" slot="graphic" .image=${this.myAvatar}></sl-avatar>
    </mwc-list-item>
    <li divider role="separator"></li>
    </mwc-list>

  </div>
<!-- END DRAWER -->

  <div slot="appContent">
    <!-- TOP APP BAR -->
    <mwc-top-app-bar id="app-bar" dense style="position: relative;">
      <mwc-icon-button icon="menu" slot="navigationIcon"></mwc-icon-button>
      <div slot="title">How ${this._currentAlignmentEh ? ` - ${this._alignments.value[this._currentAlignmentEh].short_name}` : ''}</div>
      <mwc-icon-button slot="actionItems" icon="autorenew" @click=${() => this.refresh()} ></mwc-icon-button>
      <mwc-icon-button id="menu-button" slot="actionItems" icon="more_vert" @click=${() => this.openTopMenu()}></mwc-icon-button>
      <mwc-menu id="top-menu" corner="BOTTOM_LEFT" @click=${this.handleMenuSelect}>
        <mwc-list-item graphic="icon" value="fork_alignment"><span>Duplicate Alignment</span><mwc-icon slot="graphic">edit</mwc-icon></mwc-list-item>
      </mwc-menu>
    </mwc-top-app-bar>

    <div class="appBody">
      <how-tree id="tree"
      @node-selected=${this.handleNodeSelected}
      @add-child=${this.handleAddChild}
      ></how-tree>
      <how-alignment id="how-alignment" .currentAlignmentEh=${this._currentAlignmentEh}
      @document-added=${(e:any)=>{this.refresh();}}
      @select-node=${(e: any)=>{const hash = this._alignmentsPath.value[e.detail]; this.handleAlignmentSelect(hash)}}></how-alignment>
    </div>

    <how-alignment-dialog id="alignment-dialog"
                        .myProfile=${this._myProfile.value}
                        @alignment-added=${(e:any)=>{this.handleNodeSelected(e); this.refresh();}}>
    </how-alignment-dialog>
  </div>
</mwc-drawer>

`;
  }


  static get scopedElements() {
    return {
      "mwc-menu": Menu,
      "mwc-switch": Switch,
      "mwc-drawer": Drawer,
      "mwc-top-app-bar": TopAppBar,
      "mwc-textfield": TextField,
      "mwc-select": Select,
      "mwc-list": List,
      "mwc-list-item": ListItem,
      "mwc-icon": Icon,
      "mwc-icon-button": IconButton,
      "mwc-button": Button,
      "how-alignment-dialog" : HowAlignmentDialog,
      "how-alignment": HowAlignment,
      "how-tree": HowTree,
      "mwc-formfield": Formfield,
      'sl-avatar': SlAvatar,
    };
  }

  static get styles() {
    return [
      sharedStyles,
      css`
        :host {
          margin: 10px;
        }

        .mdc-drawer__header {
          display:none;
        }

        mwc-top-app-bar {
          /**--mdc-theme-primary: #00ffbb;*/
          /**--mdc-theme-on-primary: black;*/
        }

        #app-bar {
          /*margin-top: -15px;*/
        }

        #my-drawer {
          margin-top: -15px;
        }

        .appBody {
          width: 100%;
          margin-top: 2px;
          display:flex;
        }

        mwc-textfield.rounded {
          --mdc-shape-small: 20px;
          width: 7em;
          margin-top:10px;
        }

        mwc-textfield label {
          padding: 0px;
        }

        @media (min-width: 640px) {
          main {
            max-width: none;
          }
        }
      `,
    ];
  }
}
