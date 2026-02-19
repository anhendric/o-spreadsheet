import { CustomFunctionDefinition } from "@odoo/o-spreadsheet-engine/plugins/core/custom_function";
import { _t } from "@odoo/o-spreadsheet-engine/translation";
import { SpreadsheetChildEnv } from "@odoo/o-spreadsheet-engine/types/spreadsheet_env";
import { Component, useState } from "@odoo/owl";
import { CodeEditor } from "./code_editor";

interface Props {
  functionName: string;
}

export class CustomFunctionFullEditor extends Component<Props, SpreadsheetChildEnv> {
  static template = "o-spreadsheet-CustomFunctionFullEditor";
  static props = {
    functionName: String,
  };
  static components = { CodeEditor };

  state = useState({
    body: "",
  });

  setup() {
    this.loadFunctionData();
  }

  loadFunctionData() {
    const customFunction = this.env.model.getters.getCustomFunction(this.props.functionName);
    if (customFunction) {
      this.state.body = customFunction.body || "";
    }
  }

  get func(): CustomFunctionDefinition | undefined {
    return this.env.model.getters.getCustomFunction(this.props.functionName);
  }

  onCodeChange(newCode: string) {
    this.state.body = newCode;
  }

  save() {
    const customFunction = this.func;
    if (customFunction) {
      this.env.model.dispatch("ADD_CUSTOM_FUNCTION", {
        functionDefinition: {
          ...customFunction,
          body: this.state.body,
        },
      });
      this.env.notifyUser({
        text: _t("Custom function '%s' saved.", customFunction.name),
        type: "info",
        sticky: false,
      });
    }
  }
}
