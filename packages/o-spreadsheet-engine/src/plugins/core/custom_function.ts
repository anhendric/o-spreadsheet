import { functionRegistry } from "../../functions/function_registry";
import { CommandResult } from "../../types/commands";
import { AddFunctionDescription } from "../../types/functions";
import { CorePlugin } from "../core_plugin";

export interface CustomFunctionDefinition {
  name: string;
  description: string;
  args: {
    name: string;
    type: string;
    repeating?: boolean;
    optional?: boolean;
    acceptMatrix?: boolean;
  }[];
  body: string;
}

interface CustomFunctionState {
  customFunctions: Record<string, CustomFunctionDefinition>;
}

export class CustomFunctionPlugin extends CorePlugin<CustomFunctionState> {
  static getters = ["getCustomFunctions", "getCustomFunction"] as const;

  private customFunctions: Record<string, CustomFunctionDefinition> = {};

  // ---------------------------------------------------------------------------
  // Getters
  // ---------------------------------------------------------------------------

  getCustomFunctions(): Record<string, CustomFunctionDefinition> {
    return this.customFunctions;
  }

  getCustomFunction(name: string): CustomFunctionDefinition | undefined {
    return this.customFunctions[name];
  }

  // ---------------------------------------------------------------------------
  // Command Handling
  // ---------------------------------------------------------------------------

  allowDispatch(cmd: any) {
    switch (cmd.type) {
      case "ADD_CUSTOM_FUNCTION":
      case "REMOVE_CUSTOM_FUNCTION":
      case "RENAME_CUSTOM_FUNCTION":
        return CommandResult.Success;
    }
    return CommandResult.Success;
  }

  handle(cmd: any) {
    switch (cmd.type) {
      case "ADD_CUSTOM_FUNCTION":
        this.addCustomFunction(cmd.functionDefinition);
        break;
      case "REMOVE_CUSTOM_FUNCTION":
        this.removeCustomFunction(cmd.functionName);
        break;
      case "RENAME_CUSTOM_FUNCTION":
        this.renameCustomFunction(cmd.oldName, cmd.newName);
        break;
    }
  }

  // ---------------------------------------------------------------------------
  // Import/Export
  // ---------------------------------------------------------------------------

  import(data: any) {
    if (data.customFunctions) {
      for (const func of Object.values(data.customFunctions) as CustomFunctionDefinition[]) {
        try {
          this.addCustomFunction(func);
        } catch (e) {
          console.warn(`Could not register custom function ${func.name}: ${e.message}`);
        }
      }
    }
  }

  export(data: any) {
    data.customFunctions = this.customFunctions;
  }

  // ---------------------------------------------------------------------------
  // Private methods
  // ---------------------------------------------------------------------------

  private addCustomFunction(definition: CustomFunctionDefinition) {
    this.customFunctions[definition.name] = definition;
    this.registerFunction(definition);
  }

  private removeCustomFunction(name: string) {
    delete this.customFunctions[name];
    functionRegistry.remove(name);
  }

  private renameCustomFunction(oldName: string, newName: string) {
    const definition = this.customFunctions[oldName];
    if (definition) {
      this.removeCustomFunction(oldName);
      definition.name = newName;
      this.addCustomFunction(definition);
    }
  }

  private registerFunction(definition: CustomFunctionDefinition) {
    const { name, description, args, body } = definition;

    const compute = function (...values: any[]) {
      const args = values.map((val) => {
        if (Array.isArray(val)) {
          return val.map((row) =>
            row.map((cell) =>
              cell && typeof cell === "object" && "value" in cell ? cell.value : cell
            )
          );
        }
        return val && typeof val === "object" && "value" in val ? val.value : val;
      });
      const userFn = new Function("args", body);
      try {
        return userFn(args);
      } catch (e) {
        console.warn("CustomFunction execution error:", e);
        throw e;
      }
    };

    const functionDescription: AddFunctionDescription = {
      description,
      args: args.map((arg) => ({
        name: arg.name,
        description: "",
        type: ["ANY"],
        repeating: arg.repeating,
        optional: arg.optional,
        acceptMatrix: arg.acceptMatrix,
      })),
      compute,
      category: "Custom",
    };

    if (functionRegistry.contains(name)) {
      functionRegistry.replace(name, functionDescription);
    } else {
      functionRegistry.add(name, functionDescription);
    }
  }
}
