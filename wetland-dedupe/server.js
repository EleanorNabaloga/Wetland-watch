import express from 'express';
import multer from 'multer';
import { computeHotspots } from './hotspots.js';
import {
  submitReport, verifyReport, dismissReport, auditReport, confirmReport, getReporter, listReports,
} from './reports.js';

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

app.post('/reports', upload.single('photo'), async (req, res) => {
  try {
    if (!req.file || !req.file.mimetype.startsWith('image/'))
      return res.status(400).json({ error: 'photo (an image file) is required' });

    const lat = Number(req.body.lat), lng = Number(req.body.lng);
    const accuracyM = Number(req.body.accuracy), capturedAt = Number(req.body.capturedAt);
    const reporterId = String(req.body.reporterId || '').trim();
    if ([lat, lng, accuracyM, capturedAt].some(Number.isNaN) || !reporterId)
      return res.status(400).json({ error: 'lat, lng, accuracy, capturedAt and reporterId are required' });

    const out = await submitReport(req.file.buffer, { lat, lng, accuracyM, capturedAt, reporterId });
    res.status(out.code).json(out.body);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server error' });
  }
});

const send = (res, out) => res.status(out.code).json(out.body);

app.get('/reports', (req, res) => res.json(listReports()));
app.get('/reporters/:id', (req, res) => send(res, getReporter(req.params.id)));

app.post('/reports/:id/verify', (req, res) => send(res, verifyReport(req.params.id, String(req.query.severity || 'medium'))));
app.post('/reports/:id/dismiss', (req, res) => send(res, dismissReport(req.params.id, req.query.falseReport === 'true')));
app.post('/reports/:id/audit', (req, res) => send(res, auditReport(req.params.id, req.query.result === 'pass')));
app.post('/reports/:id/confirm', (req, res) => send(res, confirmReport(req.params.id, String(req.query.by || '').trim())));

app.get('/hotspots', (req, res) => res.json(computeHotspots(listReports())));

app.listen(4000, () => console.log('Wetland Watch API running on http://localhost:4000'));
