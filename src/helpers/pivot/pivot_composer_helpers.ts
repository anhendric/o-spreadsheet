import { tokenColors } from "@odoo/o-spreadsheet-engine/constants";
import { EnrichedToken } from "@odoo/o-spreadsheet-engine/formulas/composer_tokenizer";
import { Granularity, PivotField, PivotMeasure } from "@odoo/o-spreadsheet-engine/types/pivot";

/**
 * Create a proposal entry for the composer autocomplete
 * to insert a field name string in a formula.
 */
export function makeFieldProposal(field: PivotField, granularity?: Granularity) {
  const groupBy = granularity ? `${field.name}:${granularity}` : field.name;
  const quotedGroupBy = `"${groupBy}"`;
  const fuzzySearchKey =
    field.string !== field.name
      ? field.string + quotedGroupBy // search on translated name and on technical name
      : quotedGroupBy;
  return {
    text: quotedGroupBy,
    description: field.string + (field.help ? ` (${field.help})` : ""),
    htmlContent: [{ value: quotedGroupBy, color: tokenColors.STRING }],
    fuzzySearchKey,
  };
}

export function makeMeasureProposal(measure: PivotMeasure) {
  const quotedMeasure = `"${measure.id}"`;
  const fuzzySearchKey = measure.displayName + measure.fieldName + quotedMeasure;
  return {
    text: quotedMeasure,
    description: measure.displayName,
    htmlContent: [{ value: quotedMeasure, color: tokenColors.STRING }],
    fuzzySearchKey,
  };
}

/**
 * Extract the pivot id (always the first argument) from the function
 * context of the given token.
 */
export function extractFormulaIdFromToken(tokenAtCursor: EnrichedToken) {
  const idAst = tokenAtCursor.functionContext?.args[0];
  if (!idAst || !["STRING", "NUMBER"].includes(idAst.type)) {
    return;
  }
  return idAst.value;
}
