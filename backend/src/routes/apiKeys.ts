import { Router, Request, Response } from 'express';
import { pool } from '../config/database';
import { authenticateAdmin } from '../middleware/auth';

const router = Router();

// Get all API keys (admin only)
router.get('/', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT id, provider, is_active, created_at, updated_at FROM api_keys ORDER BY provider'
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch API keys' });
  }
});

// Update API key (admin only)
router.put('/:provider', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const { provider } = req.params;
    const { api_key, is_active } = req.body;

    const result = await pool.query(
      `INSERT INTO api_keys (provider, api_key, is_active, updated_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
       ON CONFLICT (provider) 
       DO UPDATE SET api_key = $2, is_active = $3, updated_at = CURRENT_TIMESTAMP
       RETURNING id, provider, is_active, created_at, updated_at`,
      [provider, api_key, is_active !== false]
    );

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update API key' });
  }
});

// Get active API key for provider
export async function getApiKey(provider: string): Promise<string | null> {
  try {
    const result = await pool.query(
      'SELECT api_key FROM api_keys WHERE provider = $1 AND is_active = true',
      [provider]
    );
    return result.rows[0]?.api_key || null;
  } catch (error) {
    return null;
  }
}

export default router;

