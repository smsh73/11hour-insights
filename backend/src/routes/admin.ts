import { Router, Request, Response } from 'express';
import { pool } from '../config/database';
import { authenticateAdmin } from '../middleware/auth';

const router = Router();

// Get dashboard statistics
router.get('/dashboard', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const [issues, articles, events, types] = await Promise.all([
      pool.query('SELECT COUNT(*) as count FROM newspaper_issues'),
      pool.query('SELECT COUNT(*) as count FROM articles'),
      pool.query('SELECT COUNT(*) as count FROM events'),
      pool.query(`
        SELECT article_type, COUNT(*) as count
        FROM articles
        WHERE article_type IS NOT NULL
        GROUP BY article_type
        ORDER BY count DESC
        LIMIT 10
      `),
    ]);

    res.json({
      issues: parseInt(issues.rows[0].count),
      articles: parseInt(articles.rows[0].count),
      events: parseInt(events.rows[0].count),
      topArticleTypes: types.rows,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

// Initialize 2025 issues
router.post('/init-2025', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const issues = [
      { year: 2025, month: 12, board_id: 65505, url: 'https://anyangjeil.org/Board/Detail/66/65505' },
      { year: 2025, month: 11, board_id: 64788, url: 'https://anyangjeil.org/Board/Detail/66/64788' },
      { year: 2025, month: 10, board_id: 64332, url: 'https://anyangjeil.org/Board/Detail/66/64332' },
      { year: 2025, month: 9, board_id: 64032, url: 'https://anyangjeil.org/Board/Detail/66/64032' },
      { year: 2025, month: 8, board_id: 63278, url: 'https://anyangjeil.org/Board/Detail/66/63278' },
      { year: 2025, month: 7, board_id: 62861, url: 'https://anyangjeil.org/Board/Detail/66/62861' },
      { year: 2025, month: 6, board_id: 62388, url: 'https://anyangjeil.org/Board/Detail/66/62388' },
      { year: 2025, month: 5, board_id: 61675, url: 'https://anyangjeil.org/Board/Detail/66/61675' },
      { year: 2025, month: 4, board_id: 61334, url: 'https://anyangjeil.org/Board/Detail/66/61334' },
      { year: 2025, month: 3, board_id: 60828, url: 'https://anyangjeil.org/Board/Detail/66/60828' },
      { year: 2025, month: 2, board_id: 59924, url: 'https://anyangjeil.org/root/Board/Detail/66/59924' },
      { year: 2025, month: 1, board_id: 59460, url: 'https://anyangjeil.org/Board/Detail/66/59460' },
    ];

    const results = [];
    for (const issue of issues) {
      const result = await pool.query(
        `INSERT INTO newspaper_issues (year, month, board_id, url, title)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (year, month) 
         DO UPDATE SET board_id = $3, url = $4, updated_at = CURRENT_TIMESTAMP
         RETURNING *`,
        [issue.year, issue.month, issue.board_id, issue.url, `${issue.year}년 ${issue.month}월호`]
      );
      results.push(result.rows[0]);
    }

    res.json({ message: '2025 issues initialized', issues: results });
  } catch (error) {
    res.status(500).json({ error: 'Failed to initialize issues' });
  }
});

export default router;

