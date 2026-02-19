import { CustomFunctionDefinition } from "@odoo/o-spreadsheet-engine/plugins/core/custom_function";
import { _t } from "@odoo/o-spreadsheet-engine/translation";
import { Component, useState } from "@odoo/owl";
import { SidePanel } from "../side_panel/side_panel";

const TEMPLATE = "o-spreadsheet-CustomFunctionPanel";

interface Props {}

interface State {
  mode: "list" | "edit";
  editingFunction: CustomFunctionDefinition | null;
  tempName: string;
  tempDescription: string;
  tempBody: string;
  acceptMatrix: boolean;
  error: string;
}

import { TextInput } from "../../text_input/text_input";
import { ValidationMessages } from "../../validation_messages/validation_messages";
import { Checkbox } from "../components/checkbox/checkbox";
import { Section } from "../components/section/section";

export class CustomFunctionPanel extends Component<Props> {
  static template = TEMPLATE;
  static components = { SidePanel, Section, ValidationMessages, Checkbox, TextInput };
  static props = {
    onCloseSidePanel: { type: Function, optional: true },
  };

  state!: State;

  setup() {
    this.state = useState({
      mode: "list" as "list" | "edit",
      editingFunction: null as CustomFunctionDefinition | null,
      tempName: "",
      tempDescription: "",
      tempBody: "",
      acceptMatrix: false,
      error: "",
    });
  }

  get customFunctions() {
    return this.env.model.getters.getCustomFunctions();
  }

  get customFunctionList() {
    return Object.values(this.customFunctions);
  }

  addFunction() {
    this.state.mode = "edit";
    this.state.editingFunction = null;
    this.state.tempName = "MYFUNCTION";
    this.state.tempDescription = "";
    this.state.tempBody = "return args[0]";
    this.state.acceptMatrix = false;
    this.state.error = "";
  }

  editFunction(func: CustomFunctionDefinition) {
    this.state.mode = "edit";
    this.state.editingFunction = func;
    this.state.tempName = func.name;
    this.state.tempDescription = func.description;
    this.state.tempBody = func.body;
    this.state.acceptMatrix = func.args[0]?.acceptMatrix || false;
    this.state.error = "";
  }

  deleteFunction(name: string) {
    this.env.model.dispatch("REMOVE_CUSTOM_FUNCTION", { functionName: name });
  }

  saveFunction() {
    try {
      // Basic validation
      if (!this.state.tempName) {
        throw new Error(_t("Name is required"));
      }

      // Test compilation
      new Function("args", this.state.tempBody);

      const definition: CustomFunctionDefinition = {
        name: this.state.tempName.toUpperCase(),
        description: this.state.tempDescription,
        args: [
          {
            name: "args",
            description: "Any arguments",
            type: ["ANY"],
            repeating: true,
            optional: true,
            acceptMatrix: this.state.acceptMatrix,
          } as any,
        ],
        body: this.state.tempBody,
      };

      if (this.state.editingFunction && this.state.editingFunction.name !== definition.name) {
        this.env.model.dispatch("RENAME_CUSTOM_FUNCTION", {
          oldName: this.state.editingFunction.name,
          newName: definition.name,
        });
      }

      this.env.model.dispatch("ADD_CUSTOM_FUNCTION", { functionDefinition: definition });
      this.state.mode = "list";
    } catch (e) {
      this.state.error = e.message;
    }
  }

  cancelEdit() {
    this.state.mode = "list";
    this.state.editingFunction = null;
  }
}
