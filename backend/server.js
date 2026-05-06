import serverless from 'serverless-http';
import express from 'express';

const app = express();
app.use(express.json());

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(',');

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Register one async handler per command.
// Each receives (content, userId) and returns a plain object.
const handlers = {
  // my_command: async (content, userId) => ({ result: 'ok' }),
};

app.post('/msg', async (req, res) => {
  const { command, payload } = req.body ?? {};
  const handler = handlers[command];
  if (!handler) return res.status(400).json({ error: 'Unknown command' });
  try {
    res.json(await handler(payload?.content, req.userId));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export const handler = serverless(app);
