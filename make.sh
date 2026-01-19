npm run build

rm demo/lib/o_spreadsheet.css
cp build/o_spreadsheet.css demo/lib/o_spreadsheet.css
rm demo/lib/o_spreadsheet.xml
cp build/o_spreadsheet.xml demo/lib/o_spreadsheet.xml
rm demo/lib/o_spreadsheet.iife.js
cp build/o_spreadsheet.iife.js demo/lib/o_spreadsheet.iife.js
