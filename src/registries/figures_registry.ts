import { Registry } from "@odoo/o-spreadsheet-engine/registries/registry";
import { SpreadsheetChildEnv } from "@odoo/o-spreadsheet-engine/types/spreadsheet_env";
import { Action } from "../actions/action";
import {
  getCarouselMenuActions,
  getChartMenuActions,
  getImageMenuActions,
} from "../actions/figure_menu_actions";
import { getLatexMenuActions } from "../actions/latex_menu_actions";
import { CarouselFigure } from "../components/figures/figure_carousel/figure_carousel";
import { ChartFigure } from "../components/figures/figure_chart/figure_chart";
import { ImageFigure } from "../components/figures/figure_image/figure_image";
import { LatexFigure } from "../components/figures/figure_latex/figure_latex";
import { UID } from "../types";

//------------------------------------------------------------------------------
// Figure Registry
//------------------------------------------------------------------------------

/**
 * This registry is intended to map a type of figure (tag) to a class of
 * component, that will be used in the UI to represent the figure.
 *
 * The most important type of figure will be the Chart
 */

export interface FigureContent {
  Component: any;
  menuBuilder: (figureId: UID, env: SpreadsheetChildEnv) => Action[];
  SidePanelComponent?: string;
  keepRatio?: boolean;
  minFigSize?: number;
  borderWidth?: number;
}

export const figureRegistry = new Registry<FigureContent>();
figureRegistry.add("chart", {
  Component: ChartFigure,
  SidePanelComponent: "ChartPanel",
  menuBuilder: getChartMenuActions,
});
figureRegistry.add("image", {
  Component: ImageFigure,
  keepRatio: true,
  minFigSize: 20,
  borderWidth: 0,
  menuBuilder: getImageMenuActions,
});
figureRegistry.add("latex", {
  Component: LatexFigure,
  menuBuilder: getLatexMenuActions,
  minFigSize: 100,
  borderWidth: 0,
});
figureRegistry.add("carousel", {
  Component: CarouselFigure,
  menuBuilder: getCarouselMenuActions,
});
