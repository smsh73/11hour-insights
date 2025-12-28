import { Router, Request, Response } from 'express';
import { pool } from '../config/database';
import { extractionService } from '../services/extractionService';
import { scrapeNewspaperPage } from '../services/scraper';

const router = Router();

// Get all issues
router.get('/', async (req: Request, res: Response) => {
  try {
    const { year } = req.query;
    let query = 'SELECT * FROM newspaper_issues';
    const params: any[] = [];

    if (year) {
      query += ' WHERE year = $1';
      params.push(year);
    }

    query += ' ORDER BY year DESC, month DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
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
    await extractionService.startExtraction(parseInt(id));
    res.json({ message: 'Extraction started' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to start extraction' });
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
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT * FROM newspaper_images WHERE issue_id = $1 ORDER BY page_number',
      [id]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch images' });
  }
});

export default router;

