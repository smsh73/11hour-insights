import { Router, Request, Response } from 'express';
import { pool } from '../config/database';

const router = Router();

// Get timeline events
router.get('/', async (req: Request, res: Response) => {
  const logger = (await import('../utils/logger')).logger;
  logger.info('[Timeline API] ===== Timeline Events Request =====');
  logger.info('[Timeline API] Query params:', req.query);
  
  try {
    const { start_date, end_date, event_type } = req.query;

    let query = `
      SELECT 
        e.id,
        e.event_type,
        e.event_date,
        e.event_title,
        e.description,
        e.location,
        e.participants,
        e.article_id,
        a.title as article_title,
        a.page_number,
        ni.year,
        ni.month
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
      logger.info(`[Timeline API] Filter: start_date >= ${start_date}`);
    }

    if (end_date) {
      paramCount++;
      query += ` AND e.event_date <= $${paramCount}`;
      params.push(end_date);
      logger.info(`[Timeline API] Filter: end_date <= ${end_date}`);
    }

    if (event_type) {
      paramCount++;
      query += ` AND e.event_type = $${paramCount}`;
      params.push(event_type);
      logger.info(`[Timeline API] Filter: event_type = ${event_type}`);
    }

    query += ' ORDER BY e.event_date DESC, e.id DESC LIMIT 200';
    
    logger.info(`[Timeline API] Executing query: ${query}`);
    logger.info(`[Timeline API] Query params:`, params);

    const result = await pool.query(query, params);
    
    logger.info(`[Timeline API] Query result: ${result.rows.length} events found`);
    if (result.rows.length > 0) {
      logger.info(`[Timeline API] First event:`, {
        id: result.rows[0].id,
        event_type: result.rows[0].event_type,
        event_date: result.rows[0].event_date,
        event_title: result.rows[0].event_title,
      });
    } else {
      // Check if events table has any data
      const countResult = await pool.query('SELECT COUNT(*) as count FROM events');
      logger.info(`[Timeline API] Total events in database: ${countResult.rows[0].count}`);
      
      // Check if articles exist
      const articleCount = await pool.query('SELECT COUNT(*) as count FROM articles');
      logger.info(`[Timeline API] Total articles in database: ${articleCount.rows[0].count}`);
    }
    
    logger.info('[Timeline API] ===== Timeline Events Response =====');
    res.json(result.rows);
  } catch (error) {
    logger.error('[Timeline API] ===== Timeline Events Error =====');
    logger.error('[Timeline API] Error:', error);
    logger.error('[Timeline API] ===== Timeline Events Error End =====');
    res.status(500).json({ error: 'Failed to fetch timeline events' });
  }
});

export default router;

