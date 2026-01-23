import { featurePluginRegistry } from "@odoo/o-spreadsheet-engine/plugins";
import { ScenarioPlugin } from "../components/side_panel/scenario/scenario_store";
import { SolverPlugin } from "../components/side_panel/solver/solver_plugin";
import { DataCleanupPlugin } from "./ui_feature";

featurePluginRegistry.add("data_cleanup", DataCleanupPlugin);
featurePluginRegistry.add("scenario", ScenarioPlugin);
featurePluginRegistry.add("solver", SolverPlugin);
