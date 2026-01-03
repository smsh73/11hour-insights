import { Router, Request, Response } from 'express';
import { pool } from '../config/database';
import { extractionService } from '../services/extractionService';
import { scrapeNewspaperPage } from '../services/scraper';

const router = Router();

// Get all issues with actual extraction job status
router.get('/', async (req: Request, res: Response) => {
  try {
    const { year } = req.query;
    let query = `
      SELECT 
        ni.*,
        COALESCE(
          (SELECT ej.status 
           FROM extraction_jobs ej 
           WHERE ej.issue_id = ni.id 
           ORDER BY ej.created_at DESC 
           LIMIT 1),
          ni.status
        ) as actual_status,
        (SELECT ej.updated_at 
         FROM extraction_jobs ej 
         WHERE ej.issue_id = ni.id 
         ORDER BY ej.created_at DESC 
         LIMIT 1) as last_job_updated
      FROM newspaper_issues ni
    `;
    const params: any[] = [];

    if (year) {
      query += ' WHERE ni.year = $1';
      params.push(year);
    }

    query += ' ORDER BY ni.year DESC, ni.month DESC';

    const result = await pool.query(query, params);
    
    // Update issue status if it's "processing" but no active job exists
    const updates = [];
    const now = new Date();
    
    for (const row of result.rows) {
      if (row.status === 'processing') {
        let shouldReset = false;
        let newStatus = 'pending';
        
        // Case 1: No job exists at all
        if (!row.actual_status) {
          shouldReset = true;
          console.log(`Issue ${row.id}: No extraction job found, resetting to pending`);
        }
        // Case 2: Job exists but is completed/failed
        else if (row.actual_status === 'completed') {
          shouldReset = true;
          newStatus = 'completed';
          console.log(`Issue ${row.id}: Job completed, updating status to completed`);
        } else if (row.actual_status === 'failed') {
          shouldReset = true;
          newStatus = 'failed';
          console.log(`Issue ${row.id}: Job failed, updating status to failed`);
        }
        // Case 3: Job exists but is stale (older than 10 minutes)
        else if (row.last_job_updated) {
          const lastUpdated = new Date(row.last_job_updated);
          const minutesSinceUpdate = (now.getTime() - lastUpdated.getTime()) / (1000 * 60);
          
          // If job is older than 10 minutes and not in active state, reset
          if (minutesSinceUpdate > 10 && 
              row.actual_status !== 'scraping' && 
              row.actual_status !== 'downloading' && 
              row.actual_status !== 'processing') {
            shouldReset = true;
            console.log(`Issue ${row.id}: Job stale (${Math.round(minutesSinceUpdate)} minutes old), resetting to pending`);
          }
        }
        // Case 4: Job status is not in active processing states
        else if (row.actual_status !== 'scraping' && 
                 row.actual_status !== 'downloading' && 
                 row.actual_status !== 'processing') {
          shouldReset = true;
          console.log(`Issue ${row.id}: Job status is '${row.actual_status}', resetting to pending`);
        }
        
        if (shouldReset) {
          updates.push(
            pool.query('UPDATE newspaper_issues SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [newStatus, row.id])
          );
          row.status = newStatus;
        }
      }
    }
    
    // Execute updates in parallel
    if (updates.length > 0) {
      await Promise.all(updates);
    }
    
    // Return issues with corrected status
    const issues = result.rows.map(row => ({
      ...row,
      status: row.status, // Use corrected status
    }));
    
    res.json(issues);
  } catch (error) {
    console.error('Failed to fetch issues:', error);
    res.status(500).json({ error: 'Failed to fetch issues' });
  }
});

// Get single issue
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT * FROM newspaper_issues WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Issue not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch issue' });
  }
});

// Create or update issue
router.post('/', async (req: Request, res: Response) => {
  try {
    const { year, month, board_id, url, title, published_date } = req.body;

    // First, scrape to get image count
    const images = await scrapeNewspaperPage(url);

    const result = await pool.query(
      `INSERT INTO newspaper_issues 
       (year, month, board_id, url, title, published_date, image_count)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (year, month) 
       DO UPDATE SET 
         board_id = $3, url = $4, title = $5, 
         published_date = $6, image_count = $7, updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [year, month, board_id, url, title, published_date, images.length]
    );

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create/update issue' });
  }
});

// Start extraction for issue
router.post('/:id/extract', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const issueId = parseInt(id);
    
    if (isNaN(issueId)) {
      return res.status(400).json({ error: 'Invalid issue ID' });
    }
    
    console.log(`Starting extraction for issue ${issueId}`);
    await extractionService.startExtraction(issueId);
    console.log(`Extraction started successfully for issue ${issueId}`);
    res.json({ message: 'Extraction started', issueId });
  } catch (error: any) {
    console.error('Failed to start extraction:', error);
    const errorMessage = error.message || 'Failed to start extraction';
    res.status(500).json({ error: errorMessage });
  }
});

// Get extraction progress
router.get('/:id/progress', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const progress = await extractionService.getExtractionProgress(parseInt(id));
    
    if (!progress) {
      return res.status(404).json({ error: 'No extraction job found' });
    }

    res.json(progress);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get progress' });
  }
});

// Get images for issue
router.get('/:id/images', async (req: Request, res: Response) => {
  const logger = (await import('../utils/logger')).logger;
  logger.info(`[Issues API] ===== Get Images Request =====`);
  logger.info(`[Issues API] Issue ID: ${req.params.id}`);
  
  try {
    const { id } = req.params;
    const issueId = parseInt(id, 10);
    
    if (isNaN(issueId) || issueId <= 0) {
      logger.warn(`[Issues API] Invalid issue ID: ${id}`);
      return res.status(400).json({ error: 'Invalid issue ID' });
    }
    
    // First check if issue exists
    const issueCheck = await pool.query(
      'SELECT id, year, month, title, status FROM newspaper_issues WHERE id = $1',
      [issueId]
    );
    
    if (issueCheck.rows.length === 0) {
      logger.warn(`[Issues API] Issue not found: ${issueId}`);
      return res.status(404).json({ error: 'Issue not found' });
    }
    
    logger.info(`[Issues API] Issue found:`, issueCheck.rows[0]);
    
    // Get images
    const result = await pool.query(
      'SELECT id, issue_id, image_url, local_path, page_number, file_name, status FROM newspaper_images WHERE issue_id = $1 ORDER BY page_number',
      [issueId]
    );
    
    logger.info(`[Issues API] Images found: ${result.rows.length} images`);
    if (result.rows.length > 0) {
      result.rows.forEach((img, index) => {
        logger.info(`[Issues API] Image ${index + 1}:`, {
          id: img.id,
          page_number: img.page_number,
          file_name: img.file_name,
          has_local_path: !!img.local_path && img.local_path.trim() !== '',
          has_image_url: !!img.image_url && img.image_url.trim() !== '',
          local_path: img.local_path,
          image_url: img.image_url,
          status: img.status,
        });
      });
    } else {
      logger.warn(`[Issues API] No images found for issue ${issueId}`);
      // Check if images exist for other issues
      const totalImages = await pool.query('SELECT COUNT(*) as count FROM newspaper_images');
      logger.info(`[Issues API] Total images in database: ${totalImages.rows[0].count}`);
    }
    
    logger.info(`[Issues API] ===== Get Images Response =====`);
    res.json(result.rows);
  } catch (error) {
    logger.error(`[Issues API] ===== Get Images Error =====`);
    logger.error(`[Issues API] Error:`, error);
    logger.error(`[Issues API] ===== Get Images Error End =====`);
    res.status(500).json({ error: 'Failed to fetch images' });
  }
});

export default router;

