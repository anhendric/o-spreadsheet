const fs = require("fs");
const path = require("path");

function buildStandalone() {
  const rootDir = path.resolve(__dirname, "..");

  let html = fs.readFileSync(path.join(rootDir, "demo", "index.html"), "utf-8");

  // Inline CSS
  const mainCss = fs.readFileSync(path.join(rootDir, "demo", "main.css"), "utf-8");
  const osCss = fs.readFileSync(path.join(rootDir, "demo", "lib", "o_spreadsheet.css"), "utf-8");

  html = html.replace(
    '<link rel="stylesheet" href="main.css" />',
    () => `<style>\n${mainCss}\n</style>`
  );
  html = html.replace(
    '<link rel="stylesheet" href="lib/o_spreadsheet.css" />',
    () => `<style>\n${osCss}\n</style>`
  );

  // Inline favicon
  try {
    const faviconPath = path.join(rootDir, "demo", "favicon.png");
    if (fs.existsSync(faviconPath)) {
      const faviconB64 = fs.readFileSync(faviconPath).toString("base64");
      const faviconDataUri = `data:image/png;base64,${faviconB64}`;
      html = html.replace("./favicon.png", () => faviconDataUri);
    }
  } catch (e) {
    console.error("Error inlining favicon", e);
  }

  // Inline o_spreadsheet.iife.js
  let osJs = fs.readFileSync(path.join(rootDir, "demo", "lib", "o_spreadsheet.iife.js"), "utf-8");
  // Escape script tags
  osJs = osJs.replace(/<\/script>/gi, "<\\/script>");
  html = html.replace(
    '<script src="lib/o_spreadsheet.iife.js"></script>',
    () => `<script>\n${osJs}\n</script>`
  );

  // Read local JS files
  let currenciesJs = fs
    .readFileSync(path.join(rootDir, "demo", "currencies.js"), "utf-8")
    .replace("export const currenciesData", "const currenciesData");
  let fileStoreJs = fs
    .readFileSync(path.join(rootDir, "demo", "file_store.js"), "utf-8")
    .replace("export class FileStore", "class FileStore");
  let geoJsonServiceJs = fs
    .readFileSync(path.join(rootDir, "demo", "geo_json", "geo_json_service.js"), "utf-8")
    .replace("export const geoJsonService", "const geoJsonService");

  // Inject GeoJSON files
  const geoJsonDir = path.join(rootDir, "demo", "geo_json");
  const geoJsonFiles = fs.readdirSync(geoJsonDir).filter((f) => f.endsWith(".json"));
  const geoJsonMap = {};
  for (const f of geoJsonFiles) {
    geoJsonMap[`./geo_json/${f}`] = JSON.parse(fs.readFileSync(path.join(geoJsonDir, f), "utf-8"));
  }

  const preloadSnippet = `const PRELOADED_GEOJSON = ${JSON.stringify(geoJsonMap)};\n`;

  // Rewrite getResource function
  const replacementFunc = `
async function getResource(url) {
  if (PRELOADED_GEOJSON[url]) return PRELOADED_GEOJSON[url];
  if (cache.has(url)) return cache.get(url);
  if (currentPromises.has(url)) return currentPromises.get(url);
  const promise = fetch(url, { method: "GET" }).then(res => res.json()).then(json => { cache.set(url, json); return json; }).finally(() => currentPromises.delete(url));
  currentPromises.set(url, promise);
  return promise;
}
  `;
  geoJsonServiceJs = geoJsonServiceJs.replace(
    /async function getResource\(url\) \{[\s\S]*?\n\}/,
    replacementFunc
  );

  let mainJs = fs.readFileSync(path.join(rootDir, "demo", "main.js"), "utf-8");
  mainJs = mainJs.replace(/import \{.*?\} from ".*?";\n/g, "");

  let xmlContent = fs.readFileSync(path.join(rootDir, "demo", "lib", "o_spreadsheet.xml"), "utf-8");
  // Make xmlContent safe for template literal and avoid breaking out of script tag
  xmlContent = xmlContent.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
  xmlContent = xmlContent.replace(/<\/script>/gi, "<\\/script>");

  mainJs = mainJs.replace(
    'const templates = await (await fetch("lib/o_spreadsheet.xml")).text();',
    () => `const templates = \`${xmlContent}\`;`
  );

  let finalJs = `
<script>
(() => {
${currenciesJs}
${fileStoreJs}
${preloadSnippet}
${geoJsonServiceJs}
${mainJs}
})();
</script>
  `;

  html = html.replace('<script src="main.js" type="module"></script>', () => finalJs);

  const outputPath = path.join(rootDir, "demo", "standalone.html");
  fs.writeFileSync(outputPath, html);
  console.log("standalone.html created successfully at", outputPath);
}

buildStandalone();
