import { Router, Request, Response } from 'express';
import { pool } from '../config/database';

const router = Router();

// Get timeline events
router.get('/', async (req: Request, res: Response) => {
  try {
    const { start_date, end_date, event_type } = req.query;

    let query = `
      SELECT e.*, a.title as article_title, ni.year, ni.month
      FROM events e
      LEFT JOIN articles a ON e.article_id = a.id
      LEFT JOIN newspaper_issues ni ON a.issue_id = ni.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramCount = 0;

    if (start_date) {
      paramCount++;
      query += ` AND e.event_date >= $${paramCount}`;
      params.push(start_date);
    }

    if (end_date) {
      paramCount++;
      query += ` AND e.event_date <= $${paramCount}`;
      params.push(end_date);
    }

    if (event_type) {
      paramCount++;
      query += ` AND e.event_type = $${paramCount}`;
      params.push(event_type);
    }

    query += ' ORDER BY e.event_date DESC, e.id DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch timeline events' });
  }
});

export default router;

