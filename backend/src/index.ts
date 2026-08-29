import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { loadWorkflows, listWorkflows } from './services/workflow/loader';
import { registerAdapter, listAdapters } from './adapters/registry';
import { GovernmentAdapter } from './adapters/government';
import { HealthcareAdapter } from './adapters/healthcare';
import { casesRouter, workflowsRouter } from './routes/cases';
import { voiceRouter } from './routes/voice';
import { sessionRouter } from './routes/session';
import { isVoiceConfigured } from './services/voice/elevenlabs';
import { isAiConfigured } from './services/orchestrator';
import { isOriginAllowed, parseAllowedOrigins } from './lib/cors';

const app = express();
const PORT = parseInt(process.env.PORT || '4000', 10);

registerAdapter(new GovernmentAdapter());
registerAdapter(new HealthcareAdapter());

// Workflows are parsed, validated, and cached once at startup so no request
// pays for disk access or YAML parsing.
const { loaded, errors } = loadWorkflows();
if (errors.length > 0) {
  console.error('Workflow validation failed:');
  for (const error of errors) console.error(`  - ${error}`);
  // A malformed workflow would strand real cases, so refuse to serve traffic.
  process.exit(1);
}
console.log(`Loaded ${loaded} workflows and ${listAdapters().length} adapters`);

const allowedOrigins = parseAllowedOrigins(
  process.env.CORS_ORIGIN ?? 'http://localhost:43123,http://127.0.0.1:43123'
);

app.use(
  cors({
    origin(origin, callback) {
      // Same-origin and server-to-server requests carry no Origin header.
      if (!origin || isOriginAllowed(origin, allowedOrigins)) return callback(null, true);
      // Reject without throwing: an exception here surfaces as a 500 and hides
      // the real cause, which is almost always a misconfigured CORS_ORIGIN.
      console.warn(
        `[cors] blocked ${origin}. CORS_ORIGIN currently allows: ${allowedOrigins.join(', ') || '(nothing)'}`
      );
      callback(null, false);
    },
    credentials: true,
  })
);
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    version: '0.2.2',
    timestamp: new Date().toISOString(),
    workflows: listWorkflows().map((w) => w.id),
    adapters: listAdapters().map((a) => a.id),
    capabilities: {
      languageModel: isAiConfigured(),
      voice: isVoiceConfigured(),
    },
    // Surfaced so a misconfigured deployment is diagnosable without log access.
    allowedOrigins,
  });
});

app.use('/api/session', sessionRouter);
app.use('/api/cases', casesRouter);
app.use('/api/workflows', workflowsRouter);
app.use('/api/voice', voiceRouter);

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Waypoint API listening on http://0.0.0.0:${PORT}`);
});

export default app;
