import { _t } from "@odoo/o-spreadsheet-engine/translation";
import { downloadFile } from "../components/helpers/dom_helpers";
import { ActionSpec } from "./action";

declare const JSZip: any;

/**
 * Save the spreadsheet data to a file.
 * Proposes both .json (JSON) and .xlsx (Excel) formats.
 * Uses the File System Access API if available, fallback to download.
 */
export const saveAs: ActionSpec = {
  name: _t("Save As..."),
  sequence: 10,
  icon: "o-spreadsheet-Icon.EXPORT_XLSX",
  isReadonlyAllowed: true,
  execute: async (env) => {
    const filename = "spreadsheet";

    if ("showSaveFilePicker" in window) {
      try {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: filename,
          types: [
            {
              description: "JSON File",
              accept: { "application/json": [".json"] },
            },
            {
              description: "Excel Workbook",
              accept: {
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
              },
            },
            {
              description: "CSV File",
              accept: { "text/csv": [".csv"] },
            },
          ],
        });

        const chosenFile = await handle.getFile();
        const extension = chosenFile.name.split(".").pop()?.toLowerCase();

        let blob: Blob;
        if (extension === "xlsx") {
          blob = await createXLSXBlob(env);
        } else if (extension === "csv") {
          blob = createCSVBlob(env);
        } else {
          const data = env.model.exportData();
          blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        }

        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
      } catch (e) {
        if (e.name !== "AbortError") {
          console.error(e);
          env.notifyUser({
            type: "warning",
            text: _t("An error occurred while saving the file."),
            sticky: false,
          });
        }
      }
    } else {
      // Fallback for browsers without File System Access API
      const data = env.model.exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      downloadFile(url, `${filename}.json`);
      URL.revokeObjectURL(url);
    }
  },
};

/**
 * Helper to create an XLSX Blob using JSZip.
 */
async function createXLSXBlob(env: any): Promise<Blob> {
  if (typeof JSZip === "undefined") {
    throw new Error("JSZip is not loaded");
  }
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
  return await zip.generateAsync({ type: "blob" });
}

/**
 * Helper to create a CSV Blob for the active sheet.
 */
function createCSVBlob(env: any): Blob {
  const sheetId = env.model.getters.getActiveSheetId();
  const rows: string[] = [];

  // Find the last non-empty row and column to avoid exporting thousands of empty cells
  let lastCol = -1;
  let lastRow = -1;
  const evaluatedPositions = env.model.getters.getEvaluatedCellsPositions(sheetId);
  for (const pos of evaluatedPositions) {
    if (pos.col > lastCol) {
      lastCol = pos.col;
    }
    if (pos.row > lastRow) {
      lastRow = pos.row;
    }
  }

  if (lastCol === -1 || lastRow === -1) {
    return new Blob([""], { type: "text/csv" });
  }

  for (let r = 0; r <= lastRow; r++) {
    const row: string[] = [];
    for (let c = 0; c <= lastCol; c++) {
      const cell = env.model.getters.getEvaluatedCell({ sheetId, col: c, row: r });
      row.push(escapeCSV(cell.formattedValue));
    }
    rows.push(row.join(","));
  }
  const csvContent = rows.join("\n");
  return new Blob([csvContent], { type: "text/csv" });
}

function escapeCSV(value: any): string {
  if (value === null || value === undefined) {
    return "";
  }
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Export the spreadsheet to an XLSX file directly.
 */
export const downloadXLSX: ActionSpec = {
  name: _t("Download as XLSX"),
  sequence: 20,
  icon: "o-spreadsheet-Icon.DOWNLOAD",
  isReadonlyAllowed: true,
  execute: async (env) => {
    try {
      const blob = await createXLSXBlob(env);
      const url = URL.createObjectURL(blob);
      downloadFile(url, "spreadsheet.xlsx");
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      env.notifyUser({
        type: "warning",
        text: _t("An error occurred while exporting to XLSX."),
        sticky: false,
      });
    }
  },
};
