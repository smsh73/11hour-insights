import { Router, Request, Response } from 'express';
import { pool } from '../config/database';

const router = Router();

// Get events statistics
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT 
        event_type,
        COUNT(*) as count,
        MIN(event_date) as first_event,
        MAX(event_date) as last_event
      FROM events
      WHERE event_type IS NOT NULL
      GROUP BY event_type
      ORDER BY count DESC
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch event statistics' });
  }
});

export default router;

