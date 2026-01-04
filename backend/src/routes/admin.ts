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

    // Step 3: Delete all 2025-related data before initialization
    logger.info('Step 3: Deleting all 2025-related data...');
    
    // Step 3.1: Get all 2025 issue IDs first
    logger.info('Step 3.1: Getting all 2025 issue IDs...');
    const existingIssues = await pool.query(
      'SELECT id FROM newspaper_issues WHERE year = 2025'
    );
    const issueIds = existingIssues.rows.map(row => row.id);
    logger.info(`Step 3.1: Found ${issueIds.length} existing 2025 issues`);
    
    // Initialize deletion counters
    let deletedFiles = 0;
    let deletedDirs = 0;
    
    if (issueIds.length > 0) {
      // Step 3.2: Delete database records FIRST (this ensures no broken links)
      logger.info('Step 3.2: Deleting database records first to prevent broken links...');
      
      // Delete extraction jobs
      const jobsResult = await pool.query(
        'DELETE FROM extraction_jobs WHERE issue_id = ANY($1::int[])',
        [issueIds]
      );
      logger.info(`Step 3.2: Deleted ${jobsResult.rowCount} extraction jobs`);
      
      // Delete events (via articles CASCADE)
      const eventsResult = await pool.query(
        `DELETE FROM events WHERE article_id IN (
          SELECT id FROM articles WHERE issue_id = ANY($1::int[])
        )`,
        [issueIds]
      );
      logger.info(`Step 3.2: Deleted ${eventsResult.rowCount} events`);
      
      // Delete article images
      const articleImagesResult = await pool.query(
        `DELETE FROM article_images WHERE article_id IN (
          SELECT id FROM articles WHERE issue_id = ANY($1::int[])
        )`,
        [issueIds]
      );
      logger.info(`Step 3.2: Deleted ${articleImagesResult.rowCount} article images`);
      
      // Delete articles
      const articlesResult = await pool.query(
        'DELETE FROM articles WHERE issue_id = ANY($1::int[])',
        [issueIds]
      );
      logger.info(`Step 3.2: Deleted ${articlesResult.rowCount} articles`);
      
      // Delete newspaper images (THIS IS CRITICAL - prevents broken links)
      const imagesResult = await pool.query(
        'DELETE FROM newspaper_images WHERE issue_id = ANY($1::int[])',
        [issueIds]
      );
      logger.info(`Step 3.2: Deleted ${imagesResult.rowCount} newspaper images from database`);
      
      // Delete newspaper issues
      const issuesResult = await pool.query(
        'DELETE FROM newspaper_issues WHERE id = ANY($1::int[])',
        [issueIds]
      );
      logger.info(`Step 3.2: Deleted ${issuesResult.rowCount} newspaper issues from database`);
      
      logger.info(`Step 3.2: Database cleanup completed - all records deleted`);
      
      // Step 3.3: Delete images from filesystem AFTER database deletion
      logger.info('Step 3.3: Deleting image files from filesystem...');
      const fs = await import('fs/promises');
      const path = await import('path');
      const imagesDir = process.env.IMAGES_DIR || '/tmp/images';
      
      logger.info(`Step 3.3: Images directory: ${imagesDir}`);
      
      // Helper function to recursively delete directory using fs.rm (Node.js 14.14.0+)
      const deleteDirectoryRecursive = async (dirPath: string): Promise<{ files: number; dirs: number }> => {
        let filesDeleted = 0;
        let dirsDeleted = 0;
        
        try {
          // First check if path exists
          try {
            await fs.access(dirPath);
          } catch (accessError: any) {
            if (accessError.code === 'ENOENT') {
              logger.info(`Step 3.2: Path does not exist: ${dirPath}`);
              return { files: 0, dirs: 0 };
            }
            throw accessError;
          }
          
          const stats = await fs.stat(dirPath);
          
          // If it's a file, delete it directly
          if (!stats.isDirectory()) {
            await fs.unlink(dirPath);
            filesDeleted++;
            logger.info(`Step 3.2: Deleted file: ${dirPath}`);
            return { files: filesDeleted, dirs: dirsDeleted };
          }
          
          // For directories, try fs.rm first (Node.js 14.14.0+)
          // Count files before deletion for accurate reporting
          try {
            const entries = await fs.readdir(dirPath, { withFileTypes: true });
            filesDeleted = entries.filter(e => !e.isDirectory()).length;
            const subDirs = entries.filter(e => e.isDirectory());
            dirsDeleted = subDirs.length;
            
            // Count files in subdirectories recursively
            for (const subDir of subDirs) {
              const subDirPath = path.join(dirPath, subDir.name);
              try {
                const subResult = await deleteDirectoryRecursive(subDirPath);
                filesDeleted += subResult.files;
                dirsDeleted += subResult.dirs;
              } catch {
                // Continue even if subdirectory counting fails
              }
            }
          } catch (countError: any) {
            logger.warn(`Step 3.2: Failed to count files before deletion: ${countError.message}`);
          }
          
          // Try fs.rm with recursive option (Node.js 14.14.0+)
          try {
            if ((fs as any).rm && typeof (fs as any).rm === 'function') {
              await (fs as any).rm(dirPath, { recursive: true, force: true });
              dirsDeleted++; // Count the main directory
              logger.info(`Step 3.2: Deleted directory using fs.rm: ${dirPath} (${filesDeleted} files, ${dirsDeleted} dirs)`);
              return { files: filesDeleted, dirs: dirsDeleted };
            }
          } catch (rmError: any) {
            logger.warn(`Step 3.2: fs.rm failed (${rmError.message}), trying manual deletion`);
          }
          
          // Reset counters for manual deletion
          filesDeleted = 0;
          dirsDeleted = 0;
          
          // Fallback: Manual recursive deletion
          logger.info(`Step 3.2: Using manual recursive deletion for: ${dirPath}`);
          const entries = await fs.readdir(dirPath, { withFileTypes: true });
          logger.info(`Step 3.2: Found ${entries.length} entries in ${dirPath}`);
          
          // Delete all entries recursively
          for (const entry of entries) {
            const entryPath = path.join(dirPath, entry.name);
            if (entry.isDirectory()) {
              const result = await deleteDirectoryRecursive(entryPath);
              filesDeleted += result.files;
              dirsDeleted += result.dirs;
            } else {
              try {
                await fs.unlink(entryPath);
                filesDeleted++;
                logger.info(`Step 3.2: Deleted file: ${entryPath}`);
              } catch (fileError: any) {
                logger.error(`Step 3.2: Failed to delete file ${entryPath}:`, fileError.message);
              }
            }
          }
          
          // Delete the directory itself
          try {
            await fs.rmdir(dirPath);
            dirsDeleted++;
            logger.info(`Step 3.2: Deleted directory: ${dirPath}`);
          } catch (dirError: any) {
            logger.error(`Step 3.2: Failed to delete directory ${dirPath}:`, dirError.message);
          }
        } catch (error: any) {
          if (error.code !== 'ENOENT') {
            logger.error(`Step 3.2: Error deleting ${dirPath}:`, error.message || error);
          }
        }
        
        return { files: filesDeleted, dirs: dirsDeleted };
      };
      
      // Delete each issue's image directory
      for (const issueId of issueIds) {
        const issueImageDir = path.join(imagesDir, `issue_${issueId}`);
        logger.info(`Step 3.2: Processing issue ${issueId} directory: ${issueImageDir}`);
        
        try {
          const result = await deleteDirectoryRecursive(issueImageDir);
          deletedFiles += result.files;
          deletedDirs += result.dirs;
          logger.info(`Step 3.2: Issue ${issueId}: Deleted ${result.files} files and ${result.dirs} directories`);
        } catch (error) {
          logger.error(`Step 3.2: Error processing issue ${issueId} directory:`, error);
        }
      }
      
      logger.info(`Step 3.3: Total deleted: ${deletedFiles} files and ${deletedDirs} directories`);
      
      // Step 3.4: Verify deletion
      logger.info('Step 3.4: Verifying deletion...');
      for (const issueId of issueIds) {
        const issueImageDir = path.join(imagesDir, `issue_${issueId}`);
        try {
          await fs.access(issueImageDir);
          logger.warn(`Step 3.4: WARNING - Directory still exists: ${issueImageDir}`);
          // Try one more time with force
          try {
            if ((fs as any).rm) {
              await (fs as any).rm(issueImageDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
              logger.info(`Step 3.4: Force deleted: ${issueImageDir}`);
            }
          } catch (forceError: any) {
            logger.error(`Step 3.4: Failed to force delete ${issueImageDir}:`, forceError.message);
          }
        } catch (verifyError: any) {
          if (verifyError.code === 'ENOENT') {
            logger.info(`Step 3.4: Verified deletion: ${issueImageDir} does not exist`);
          } else {
            logger.warn(`Step 3.4: Verification error for ${issueImageDir}:`, verifyError.message);
          }
        }
      }
      logger.info('Step 3.4: Deletion verification completed');
    } else {
      logger.info('Step 3: No existing 2025 issues to delete');
    }
    
    logger.info('Step 3: Data deletion completed');

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
      message: `2025년 호수 초기화가 완료되었습니다. 기존 데이터(이미지, 기사, 이벤트)가 모두 삭제되고 ${results.length}개의 호수가 새로 생성되었습니다.`, 
      issues: results,
      count: results.length,
      deleted: {
        issues: issueIds.length,
        images: deletedFiles || 0,
        directories: deletedDirs || 0,
      },
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

// Debug endpoint: Check extraction job status and data
router.get('/debug/extraction/:issueId', authenticateAdmin, async (req: Request, res: Response) => {
  const logger = (await import('../utils/logger')).logger;
  logger.info('[Admin Debug] ===== Extraction Debug Request =====');
  
  try {
    const { issueId } = req.params;
    const issueIdNum = parseInt(issueId, 10);
    
    if (isNaN(issueIdNum)) {
      return res.status(400).json({ error: 'Invalid issue ID' });
    }
    
    logger.info(`[Admin Debug] Checking issue ID: ${issueIdNum}`);
    
    // Get issue info
    const issueResult = await pool.query(
      'SELECT * FROM newspaper_issues WHERE id = $1',
      [issueIdNum]
    );
    
    if (issueResult.rows.length === 0) {
      return res.status(404).json({ error: 'Issue not found' });
    }
    
    const issue = issueResult.rows[0];
    
    // Get extraction jobs
    const jobsResult = await pool.query(
      'SELECT * FROM extraction_jobs WHERE issue_id = $1 ORDER BY created_at DESC',
      [issueIdNum]
    );
    
    // Get articles count
    const articlesResult = await pool.query(
      'SELECT COUNT(*) as count FROM articles WHERE issue_id = $1',
      [issueIdNum]
    );
    
    // Get events count
    const eventsResult = await pool.query(
      `SELECT COUNT(*) as count FROM events e 
       JOIN articles a ON e.article_id = a.id 
       WHERE a.issue_id = $1`,
      [issueIdNum]
    );
    
    // Get images count
    const imagesResult = await pool.query(
      'SELECT COUNT(*) as count FROM newspaper_images WHERE issue_id = $1',
      [issueIdNum]
    );
    
    // Get article images count
    const articleImagesResult = await pool.query(
      `SELECT COUNT(*) as count FROM article_images ai
       JOIN articles a ON ai.article_id = a.id
       WHERE a.issue_id = $1`,
      [issueIdNum]
    );
    
    const debugInfo = {
      issue: {
        id: issue.id,
        year: issue.year,
        month: issue.month,
        title: issue.title,
        status: issue.status,
        image_count: issue.image_count,
        url: issue.url,
      },
      extractionJobs: jobsResult.rows.map(job => ({
        id: job.id,
        status: job.status,
        progress: job.progress,
        total_items: job.total_items,
        processed_items: job.processed_items,
        error_message: job.error_message,
        created_at: job.created_at,
        updated_at: job.updated_at,
        completed_at: job.completed_at,
      })),
      dataCounts: {
        articles: parseInt(articlesResult.rows[0].count),
        events: parseInt(eventsResult.rows[0].count),
        images: parseInt(imagesResult.rows[0].count),
        articleImages: parseInt(articleImagesResult.rows[0].count),
      },
      latestJob: jobsResult.rows.length > 0 ? {
        id: jobsResult.rows[0].id,
        status: jobsResult.rows[0].status,
        progress: jobsResult.rows[0].progress,
        total_items: jobsResult.rows[0].total_items,
        processed_items: jobsResult.rows[0].processed_items,
        error_message: jobsResult.rows[0].error_message,
        created_at: jobsResult.rows[0].created_at,
        updated_at: jobsResult.rows[0].updated_at,
        completed_at: jobsResult.rows[0].completed_at,
      } : null,
    };
    
    logger.info(`[Admin Debug] Debug info:`, debugInfo);
    logger.info('[Admin Debug] ===== Extraction Debug Response =====');
    
    res.json(debugInfo);
  } catch (error) {
    logger.error('[Admin Debug] ===== Extraction Debug Error =====');
    logger.error('[Admin Debug] Error:', error);
    res.status(500).json({ 
      error: 'Failed to get debug info',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

export default router;

