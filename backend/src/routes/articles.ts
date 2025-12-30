import { Router, Request, Response } from 'express';
import { pool } from '../config/database';

const router = Router();

// Search articles
router.get('/search', async (req: Request, res: Response) => {
  try {
    const { q, type, year, month, page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = `
      SELECT a.*, ni.year, ni.month, ni.title as issue_title
      FROM articles a
      JOIN newspaper_issues ni ON a.issue_id = ni.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramCount = 0;

    if (q) {
      paramCount++;
      query += ` AND (a.title ILIKE $${paramCount} OR a.full_content ILIKE $${paramCount} OR a.content_summary ILIKE $${paramCount})`;
      params.push(`%${q}%`);
    }

    if (type) {
      paramCount++;
      query += ` AND a.article_type = $${paramCount}`;
      params.push(type);
    }

    if (year) {
      paramCount++;
      query += ` AND ni.year = $${paramCount}`;
      params.push(year);
    }

    if (month) {
      paramCount++;
      query += ` AND ni.month = $${paramCount}`;
      params.push(month);
    }

    query += ` ORDER BY ni.year DESC, ni.month DESC, a.page_number LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(Number(limit), offset);

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to search articles' });
  }
});

// Get article by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT a.*, ni.year, ni.month, ni.title as issue_title
       FROM articles a
       JOIN newspaper_issues ni ON a.issue_id = ni.id
       WHERE a.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Article not found' });
    }

    // Get related images
    const imagesResult = await pool.query(
      'SELECT * FROM article_images WHERE article_id = $1 ORDER BY position_in_article',
      [id]
    );

    // Get related events
    const eventsResult = await pool.query(
      'SELECT * FROM events WHERE article_id = $1 ORDER BY event_date',
      [id]
    );

    res.json({
      ...result.rows[0],
      images: imagesResult.rows,
      events: eventsResult.rows,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch article' });
  }
});

// Get articles by issue
router.get('/issue/:issueId', async (req: Request, res: Response) => {
  try {
    const { issueId } = req.params;
    const result = await pool.query(
      'SELECT * FROM articles WHERE issue_id = $1 ORDER BY page_number',
      [issueId]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch articles' });
  }
});

// Get article types statistics
router.get('/stats/types', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT article_type, COUNT(*) as count
       FROM articles
       WHERE article_type IS NOT NULL
       GROUP BY article_type
       ORDER BY count DESC`
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// Get monthly statistics
router.get('/stats/monthly', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT 
        ni.year,
        ni.month,
        COUNT(DISTINCT a.id) as article_count,
        COUNT(DISTINCT e.id) as event_count,
        COUNT(DISTINCT CASE WHEN a.article_type = '행사' THEN a.id END) as event_article_count,
        COUNT(DISTINCT CASE WHEN a.article_type = '간증' THEN a.id END) as testimony_count,
        COUNT(DISTINCT CASE WHEN a.article_type = '선교' THEN a.id END) as mission_count,
        COUNT(DISTINCT CASE WHEN a.article_type = '말씀' THEN a.id END) as sermon_count,
        COUNT(DISTINCT a.author) as author_count
      FROM newspaper_issues ni
      LEFT JOIN articles a ON ni.id = a.issue_id
      LEFT JOIN events e ON a.id = e.article_id
      GROUP BY ni.year, ni.month
      ORDER BY ni.year DESC, ni.month DESC
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch monthly statistics' });
  }
});

// Get detailed insights
router.get('/stats/insights', async (req: Request, res: Response) => {
  try {
    const [topAuthors, topEventTypes, monthlyTrends, articleTypeDistribution] = await Promise.all([
      // Top authors
      pool.query(`
        SELECT author, COUNT(*) as count
        FROM articles
        WHERE author IS NOT NULL AND author != ''
        GROUP BY author
        ORDER BY count DESC
        LIMIT 10
      `),
      // Top event types
      pool.query(`
        SELECT event_type, COUNT(*) as count
        FROM events
        WHERE event_type IS NOT NULL
        GROUP BY event_type
        ORDER BY count DESC
        LIMIT 10
      `),
      // Monthly trends
      pool.query(`
        SELECT 
          ni.year,
          ni.month,
          COUNT(DISTINCT a.id) as article_count,
          COUNT(DISTINCT e.id) as event_count,
          COUNT(DISTINCT a.author) as author_count
        FROM newspaper_issues ni
        LEFT JOIN articles a ON ni.id = a.issue_id
        LEFT JOIN events e ON a.id = e.article_id
        GROUP BY ni.year, ni.month
        ORDER BY ni.year DESC, ni.month DESC
        LIMIT 12
      `),
      // Article type distribution
      pool.query(`
        SELECT 
          article_type,
          COUNT(*) as count,
          ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM articles WHERE article_type IS NOT NULL), 2) as percentage
        FROM articles
        WHERE article_type IS NOT NULL
        GROUP BY article_type
        ORDER BY count DESC
      `)
    ]);

    res.json({
      topAuthors: topAuthors.rows,
      topEventTypes: topEventTypes.rows,
      monthlyTrends: monthlyTrends.rows,
      articleTypeDistribution: articleTypeDistribution.rows,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch insights' });
  }
});

// Get event timeline
router.get('/stats/timeline', async (req: Request, res: Response) => {
  try {
    const { year, month } = req.query;
    let query = `
      SELECT 
        e.id,
        e.event_type,
        e.event_date,
        e.event_title,
        e.description,
        e.location,
        e.participants,
        a.title as article_title,
        a.page_number,
        ni.year as issue_year,
        ni.month as issue_month
      FROM events e
      JOIN articles a ON e.article_id = a.id
      JOIN newspaper_issues ni ON a.issue_id = ni.id
      WHERE e.event_date IS NOT NULL
    `;
    const params: any[] = [];
    
    if (year) {
      query += ` AND ni.year = $${params.length + 1}`;
      params.push(parseInt(year as string));
    }
    if (month) {
      query += ` AND ni.month = $${params.length + 1}`;
      params.push(parseInt(month as string));
    }
    
    query += ` ORDER BY e.event_date DESC, ni.year DESC, ni.month DESC LIMIT 100`;
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch timeline' });
  }
});

export default router;

