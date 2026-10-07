import fs from 'fs';

function patch(file, edits) {
  let s = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  for (const [from, to, label] of edits) {
    if (s.includes(to)) { console.log(file + ': "' + label + '" already applied'); continue; }
    if (!s.includes(from)) { console.log(file + ': COULD NOT FIND "' + label + '" - tell Claude'); continue; }
    s = s.replace(from, to);
    console.log(file + ': applied "' + label + '"');
  }
  fs.writeFileSync(file, s);
}

patch('reports.js', [
  [
    "export function verifyReport(id) {\n",
    "export function verifyReport(id, severity = 'medium') {\n  if (!['low', 'medium', 'high', 'critical'].includes(severity))\n    return { code: 400, body: { error: 'severity must be low, medium, high or critical' } };\n",
    'severity check',
  ],
  [
    "  r.status = 'verified';\n",
    "  r.status = 'verified';\n  r.severity = severity;\n",
    'save severity',
  ],
]);

if (fs.existsSync('server.js')) patch('server.js', [
  [
    "import multer from 'multer';\n",
    "import multer from 'multer';\nimport { computeHotspots } from './hotspots.js';\n",
    'hotspots import',
  ],
  [
    "send(res, verifyReport(req.params.id))",
    "send(res, verifyReport(req.params.id, String(req.query.severity || 'medium')))",
    'severity in verify route',
  ],
  [
    "app.listen(4000",
    "app.get('/hotspots', (req, res) => res.json(computeHotspots(listReports())));\n\napp.listen(4000",
    'hotspots route',
  ],
]);
