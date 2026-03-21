import express from 'express';
import { supabase, supabaseAdmin } from './lib/supabase.js';
import { initializeQueue } from './lib/queue.js';
import { createAuthMiddleware, createRequireRole } from './middleware/auth.js';
import { createAuthRouter, createUsersRouter } from './routes/auth.js';
import { createWebhooksRouter } from './routes/webhooks.js';

const app = express();
const port = process.env.PORT ?? '3001';

// Initialize queue before setting up routes
initializeQueue().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Failed to initialize queue:', err);
  process.exit(1);
});

app.use(express.json());

const authMiddleware = createAuthMiddleware(supabase);
const requireRole = createRequireRole(supabaseAdmin);

// Routes exempt from auth: /health, /webhooks/*, /api/v1/auth/register
const EXEMPT_PREFIXES = ['/health', '/webhooks', '/api/v1/auth/register'];

app.use((req, res, next) => {
  if (EXEMPT_PREFIXES.some(prefix => req.path === prefix || req.path.startsWith(prefix + '/'))) {
    return next();
  }
  return authMiddleware(req, res, next);
});

app.get('/health', (_req, res) => {
  res.status(200).json({ ok: true, service: 'api' });
});

app.use('/api/v1/auth', createAuthRouter(supabaseAdmin, requireRole));
app.use('/api/v1/users', createUsersRouter(supabaseAdmin, requireRole));
app.use('/api/v1/webhooks', createWebhooksRouter({
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
  businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '',
  accessToken: process.env.WHATSAPP_ACCESS_TOKEN || '',
  appSecret: process.env.WHATSAPP_APP_SECRET || '',
  webhookVerifyToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || '',
}));

app.listen(Number(port), () => {
  // eslint-disable-next-line no-console
  console.log(`API listening on :${port}`);
});