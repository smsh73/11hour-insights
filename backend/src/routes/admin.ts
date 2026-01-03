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
  const logger = (await import('../utils/logger')).logger;
  
  logger.info('========================================');
  logger.info('===== INIT-2025 ENDPOINT START =====');
  logger.info('Timestamp:', new Date().toISOString());
  logger.info('Request body:', req.body);
  logger.info('Request user:', (req as any).user);
  
  try {
    // Step 1: Import scraper service
    logger.info('Step 1: Importing scraper service...');
    const { scrapeNewspaperPage } = await import('../services/scraper');
    logger.info('Step 1: Scraper service imported successfully');
    
    // Step 2: Define issues array
    logger.info('Step 2: Defining issues array...');
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
      { year: 2025, month: 2, board_id: 59924, url: 'https://anyangjeil.org/Board/Detail/66/59924' },
      { year: 2025, month: 1, board_id: 59460, url: 'https://anyangjeil.org/Board/Detail/66/59460' },
    ];
    logger.info(`Step 2: Defined ${issues.length} issues to process`);

    // Step 3: Reset all 2025 issues status to 'pending' before initialization
    logger.info('Step 3: Resetting 2025 issues status to pending...');
    const resetResult = await pool.query(
      `UPDATE newspaper_issues 
       SET status = 'pending', updated_at = CURRENT_TIMESTAMP 
       WHERE year = 2025 AND status = 'processing'`
    );
    logger.info(`Step 3: Reset ${resetResult.rowCount} issues from processing to pending`);

    // Step 4: Process each issue
    logger.info('Step 4: Processing each issue...');
    const results = [];
    for (let i = 0; i < issues.length; i++) {
      const issue = issues[i];
      logger.info(`Step 4.${i + 1}: Processing issue ${i + 1}/${issues.length}: ${issue.year}년 ${issue.month}월호`);
      logger.info(`Step 4.${i + 1}: URL: ${issue.url}`);
      
      try {
        // Step 4.1: Scrape images
        logger.info(`Step 4.${i + 1}.1: Scraping images from ${issue.url}...`);
        const scrapeStartTime = Date.now();
        const images = await scrapeNewspaperPage(issue.url);
        const scrapeDuration = Date.now() - scrapeStartTime;
        logger.info(`Step 4.${i + 1}.1: Scraped ${images.length} images in ${scrapeDuration}ms`);
        
        // Step 4.2: Insert/Update database
        logger.info(`Step 4.${i + 1}.2: Inserting/updating database record...`);
        const dbStartTime = Date.now();
        const result = await pool.query(
          `INSERT INTO newspaper_issues (year, month, board_id, url, title, image_count, status)
           VALUES ($1, $2, $3, $4, $5, $6, 'pending')
           ON CONFLICT (year, month) 
           DO UPDATE SET 
             board_id = $3, 
             url = $4, 
             title = $5,
             image_count = $6,
             status = 'pending',
             updated_at = CURRENT_TIMESTAMP
           RETURNING *`,
          [issue.year, issue.month, issue.board_id, issue.url, `${issue.year}년 ${issue.month}월호`, images.length]
        );
        const dbDuration = Date.now() - dbStartTime;
        logger.info(`Step 4.${i + 1}.2: Database operation completed in ${dbDuration}ms`);
        logger.info(`Step 4.${i + 1}.2: Issue ID: ${result.rows[0].id}, Status: ${result.rows[0].status}`);
        
        results.push(result.rows[0]);
        logger.info(`Step 4.${i + 1}: Successfully initialized ${issue.year}년 ${issue.month}월호`);
      } catch (error) {
        logger.error(`Step 4.${i + 1}: Failed to scrape ${issue.year}년 ${issue.month}월호:`, error);
        logger.error(`Step 4.${i + 1}: Error type:`, error instanceof Error ? error.constructor.name : typeof error);
        logger.error(`Step 4.${i + 1}: Error message:`, error instanceof Error ? error.message : String(error));
        logger.error(`Step 4.${i + 1}: Error stack:`, error instanceof Error ? error.stack : 'No stack');
        
        // If scraping fails, still insert with 0 image count
        logger.info(`Step 4.${i + 1}: Inserting with 0 image count as fallback...`);
        try {
          const result = await pool.query(
            `INSERT INTO newspaper_issues (year, month, board_id, url, title, image_count, status)
             VALUES ($1, $2, $3, $4, $5, 0, 'pending')
             ON CONFLICT (year, month) 
             DO UPDATE SET board_id = $3, url = $4, title = $5, status = 'pending', updated_at = CURRENT_TIMESTAMP
             RETURNING *`,
            [issue.year, issue.month, issue.board_id, issue.url, `${issue.year}년 ${issue.month}월호`]
          );
          results.push(result.rows[0]);
          logger.info(`Step 4.${i + 1}: Fallback insert successful for ${issue.year}년 ${issue.month}월호`);
        } catch (dbError) {
          logger.error(`Step 4.${i + 1}: Fallback insert also failed:`, dbError);
          throw dbError;
        }
      }
    }

    // Step 5: Return success response
    logger.info('Step 5: Preparing success response...');
    logger.info(`2025 issues initialization completed: ${results.length} issues processed`);
    logger.info('===== INIT-2025 ENDPOINT SUCCESS =====');
    logger.info('========================================');
    
    res.json({ 
      message: '2025 issues initialized', 
      issues: results,
      count: results.length,
    });
  } catch (error) {
    logger.error('========================================');
    logger.error('===== INIT-2025 ENDPOINT ERROR =====');
    logger.error('Error type:', error instanceof Error ? error.constructor.name : typeof error);
    logger.error('Error message:', error instanceof Error ? error.message : String(error));
    logger.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
    logger.error('Full error object:', error);
    logger.error('========================================');
    
    res.status(500).json({ 
      error: 'Failed to initialize issues',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

// Reset all processing issues to pending
router.post('/reset-processing', authenticateAdmin, async (req: Request, res: Response) => {
  const logger = (await import('../utils/logger')).logger;
  logger.info('Resetting all processing issues to pending');
  
  try {
    const { year } = req.body;
    
    let query = `UPDATE newspaper_issues SET status = 'pending', updated_at = CURRENT_TIMESTAMP WHERE status = 'processing'`;
    const params: any[] = [];
    
    if (year) {
      query += ' AND year = $1';
      params.push(year);
    }
    
    const result = await pool.query(query, params);
    logger.info(`Reset ${result.rowCount} issues from processing to pending`);
    
    res.json({ 
      message: `Reset ${result.rowCount} issues to pending`,
      count: result.rowCount 
    });
  } catch (error) {
    logger.error('Failed to reset processing issues:', error);
    res.status(500).json({ error: 'Failed to reset processing issues' });
  }
});

export default router;

