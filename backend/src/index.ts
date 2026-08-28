import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { loadWorkflows } from './services/workflow/loader';
import { registerAdapter } from './adapters/registry';
import { GovernmentAdapter } from './adapters/government';
import { HealthcareAdapter } from './adapters/healthcare';
import { casesRouter, workflowsRouter } from './routes/cases';
import { voiceRouter } from './routes/voice';

const app = express();
const PORT = parseInt(process.env.PORT || '4000', 10);

// Initialize adapters and workflows at startup (cached for speed)
loadWorkflows();
registerAdapter(new GovernmentAdapter());
registerAdapter(new HealthcareAdapter());

app.use(
  cors({
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:43123', 'http://127.0.0.1:43123'],
    credentials: true,
  })
);
app.use(express.json({ limit: '10mb' }));

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
    workflows: 2,
    adapters: 2,
  });
});

app.use('/api/cases', casesRouter);
app.use('/api/workflows', workflowsRouter);
app.use('/api/voice', voiceRouter);

// Serve uploaded files in dev
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Waypoint API running on http://0.0.0.0:${PORT}`);
});

export default app;
