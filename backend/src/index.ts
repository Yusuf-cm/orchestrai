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

const allowedOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:43123,http://127.0.0.1:43123')
  .split(',')
  .map((o) => o.trim().replace(/\/$/, ''))
  .filter(Boolean);

/**
 * Matches an origin against the allow-list. Entries may use a wildcard for the
 * subdomain, as in `https://*.onrender.com`, because hosting platforms append
 * generated suffixes to service names and a hardcoded hostname breaks on every
 * redeploy.
 */
function isOriginAllowed(origin: string): boolean {
  return allowedOrigins.some((allowed) => {
    if (allowed === origin) return true;
    if (!allowed.includes('*')) return false;
    const pattern = new RegExp(
      `^${allowed.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[a-z0-9-]+')}$`,
      'i'
    );
    return pattern.test(origin);
  });
}

app.use(
  cors({
    origin(origin, callback) {
      // Same-origin and server-to-server requests carry no Origin header.
      if (!origin || isOriginAllowed(origin)) return callback(null, true);
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
    version: '0.2.0',
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
