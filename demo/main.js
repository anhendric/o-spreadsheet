import { currenciesData } from "./currencies.js";
import { FileStore } from "./file_store.js";
import { geoJsonService } from "./geo_json/geo_json_service.js";

const {
  xml,
  Component,
  whenReady,
  onWillStart,
  onMounted,
  useState,
  useExternalListener,
  onError,
  markRaw,
} = owl;

const { Spreadsheet, Model } = o_spreadsheet;
const { topbarMenuRegistry } = o_spreadsheet.registries;
const { useStoreProvider } = o_spreadsheet.stores;

const uuidGenerator = new o_spreadsheet.helpers.UuidGenerator();

topbarMenuRegistry.addChild("xlsx", ["file"], {
  name: "Download file",
  sequence: 20,
  execute: async (env) => {
    const doc = await env.model.exportXLSX();
    const zip = new JSZip();
    for (const file of doc.files) {
      if (file.imageSrc) {
        const fetchedImage = await fetch(file.imageSrc).then((response) => response.blob());
        zip.file(file.path, fetchedImage);
      } else {
        zip.file(file.path, file.content.replaceAll(` xmlns=""`, ""));
      }
    }
    zip.generateAsync({ type: "blob" }).then(function (blob) {
      saveAs(blob, doc.name);
    });
  },
  icon: "o-spreadsheet-Icon.EXPORT_XLSX",
});

let start;

class Demo extends Component {
  setup() {
    this.state = useState({ key: 0, colorScheme: "light" });
    this.stateUpdateMessages = [];
    this.client = {
      id: uuidGenerator.uuidv4(),
      name: "Local",
    };
    this.fileStore = new FileStore();

    topbarMenuRegistry.addChild("clear", ["file"], {
      name: "New",
      sequence: 10.5,
      execute: async () => {
        stores.resetStores();
        await this.initiateConnection({});
        this.state.key = this.state.key + 1;
      },
      icon: "o-spreadsheet-Icon.CLEAR_AND_RELOAD",
    });

    topbarMenuRegistry.addChild("dark_mode", ["view"], {
      name: "Toggle dark mode",
      sequence: 12.5,
      isReadonlyAllowed: true,
      execute: () =>
        (this.state.colorScheme = this.state.colorScheme === "dark" ? "light" : "dark"),
      icon: "o-spreadsheet-Icon.DARK_MODE",
    });

    topbarMenuRegistry.addChild("xlsxImport", ["file"], {
      name: "Open file",
      sequence: 18.5,
      execute: async (env) => {
        const input = document.createElement("input");
        input.setAttribute("type", "file");
        input.setAttribute("style", "display: none");
        document.body.appendChild(input);
        input.addEventListener("change", async () => {
          if (input.files.length <= 0) {
            return false;
          }
          const myjszip = new JSZip();
          const zip = await myjszip.loadAsync(input.files[0]);
          const files = Object.keys(zip.files);
          const images = [];
          const contents = await Promise.all(
            files.map((file) => {
              if (file.includes("media/image")) {
                images.push(file);
                return zip.files[file].async("blob");
              }
              return zip.files[file].async("text");
            })
          );
          const inputFiles = {};
          for (let i = 0; i < contents.length; i++) {
            inputFiles[files[i]] = contents[i];
          }
          for (let i = 0; i < images.length; i++) {
            const blob = inputFiles[images[i]];
            const file = new File([blob], images[i].split("/").at(-1));
            const imageSrc = await this.fileStore.upload(file);
            inputFiles[images[i]] = { imageSrc };
          }
          await this.initiateConnection(inputFiles);
          stores.resetStores();
          this.state.key = this.state.key + 1;
          input.remove();
        });
        input.click();
      },
      icon: "o-spreadsheet-Icon.IMPORT_XLSX",
    });

    const stores = useStoreProvider();

    useExternalListener(window, "unhandledrejection", this.notifyError.bind(this));
    useExternalListener(window, "error", (ev) => {
      console.error("Global error caught: ", ev.error || ev.message);
      this.notifyError();
    });

    onWillStart(() => this.initiateConnection());

    onMounted(() => console.log("Mounted: ", Date.now() - start));
    onError((error) => {
      console.error(error.cause || error);
      this.notifyError();
    });
  }

  notifyError() {
    this.notifyUser({
      text: "An unexpected error occurred. Open the developer console for details.",
      sticky: true,
      type: "warning",
    });
  }

  async initiateConnection(data = undefined) {
    this.stateUpdateMessages = [];
    this.createModel(data || {});
  }

  createModel(data) {
    this.model = new Model(
      data,
      {
        external: {
          loadCurrencies: async () => currenciesData,
          fileStore: this.fileStore,
          geoJsonService: geoJsonService,
        },
        custom: {},
        transportService: undefined,
        client: this.client,
        mode: "normal",
      },
      this.stateUpdateMessages
    );
    markRaw(this.model);
    this.activateFirstSheet();
  }

  activateFirstSheet() {
    const sheetId = this.model.getters.getActiveSheetId();
    const firstSheetId = this.model.getters.getSheetIds()[0];
    if (firstSheetId !== sheetId) {
      this.model.dispatch("ACTIVATE_SHEET", { sheetIdFrom: sheetId, sheetIdTo: firstSheetId });
    }
  }

  notifyUser(notification) {
    const div = document.createElement("div");
    const text = document.createTextNode(notification.text);
    div.appendChild(text);
    div.classList.add(
      "o-test-notification",
      "bg-white",
      "p-3",
      "shadow",
      "rounded",
      notification.type
    );
    const element = document.querySelector(".o-spreadsheet") || document.body; // if we crash on launch, the spreadsheet is not mounted yet
    div.onclick = () => {
      element.removeChild(div);
    };
    element.appendChild(div);

    if (!notification.sticky) {
      setTimeout(() => {
        if (document.body.contains(div)) {
          element.removeChild(div);
        }
      }, 5000);
    }
  }
}

Demo.template = xml/* xml */ `
  <div class="w-100 h-100">
    <Spreadsheet model="model" t-key="state.key" notifyUser="notifyUser" colorScheme="state.colorScheme"/>
  </div>
`;
Demo.components = { Spreadsheet };
Demo.props = {};

// Setup code
async function setup() {
  const templates = await (await fetch("lib/o_spreadsheet.xml")).text();
  start = Date.now();

  const rootApp = new owl.App(Demo, { dev: true, warnIfNoStaticProps: true });
  rootApp.addTemplates(templates);
  rootApp.mount(document.body);
}

whenReady(setup);
