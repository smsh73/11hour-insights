import { Router, Request, Response } from 'express';
import * as path from 'path';
import * as fs from 'fs/promises';
import { pool } from '../config/database';
import { logger } from '../utils/logger';

const router = Router();

// Check image statistics
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const stats = await pool.query(`
      SELECT 
        COUNT(*) as total_images,
        COUNT(CASE WHEN local_path IS NOT NULL AND local_path != '' THEN 1 END) as images_with_local_path,
        COUNT(CASE WHEN (local_path IS NULL OR local_path = '') AND image_url IS NOT NULL THEN 1 END) as images_with_url_only,
        COUNT(CASE WHEN local_path IS NOT NULL AND local_path != '' AND image_url IS NOT NULL THEN 1 END) as images_with_both
      FROM newspaper_images
    `);
    
    const issueStats = await pool.query(`
      SELECT 
        ni.id,
        ni.year,
        ni.month,
        ni.title,
        COUNT(nmi.id) as image_count,
        COUNT(CASE WHEN nmi.local_path IS NOT NULL AND nmi.local_path != '' THEN 1 END) as images_with_local_path
      FROM newspaper_issues ni
      LEFT JOIN newspaper_images nmi ON ni.id = nmi.issue_id
      WHERE ni.year = 2025
      GROUP BY ni.id, ni.year, ni.month, ni.title
      ORDER BY ni.year DESC, ni.month DESC
    `);
    
    res.json({
      overall: stats.rows[0],
      byIssue: issueStats.rows,
    });
  } catch (error) {
    logger.error('Failed to get image stats:', error);
    res.status(500).json({ error: 'Failed to get image stats' });
  }
});

// Serve image by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    logger.info(`[Images API] Requesting image ID: ${id}`);
    
    const result = await pool.query(
      'SELECT local_path, image_url FROM newspaper_images WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      logger.warn(`[Images API] Image not found in database: ${id}`);
      return res.status(404).json({ error: 'Image not found' });
    }

    const imageRecord = result.rows[0];
    const imagePath = imageRecord.local_path;
    const imageUrl = imageRecord.image_url;
    
    logger.info(`[Images API] Image found: local_path=${imagePath}, image_url=${imageUrl}`);

    // local_path가 있으면 파일 시스템에서 제공
    if (imagePath) {
      // Azure App Service에서는 /tmp/images를 사용
      const fullPath = path.isAbsolute(imagePath) 
        ? imagePath 
        : path.resolve(imagePath);
      
      logger.info(`[Images API] Attempting to serve file: ${fullPath}`);
      
      try {
        await fs.access(fullPath);
        logger.info(`[Images API] File exists, sending: ${fullPath}`);
        res.sendFile(fullPath);
        return;
      } catch (error) {
        logger.warn(`[Images API] File not found at ${fullPath}, trying image_url fallback`);
        // 파일이 없으면 원본 URL로 리다이렉트
        if (imageUrl) {
          logger.info(`[Images API] Redirecting to image_url: ${imageUrl}`);
          return res.redirect(imageUrl);
        }
      }
    }
    
    // local_path가 없거나 파일이 없으면 원본 URL 사용
    if (imageUrl) {
      logger.info(`[Images API] Redirecting to image_url: ${imageUrl}`);
      return res.redirect(imageUrl);
    }

    logger.error(`[Images API] No image path or URL available for ID: ${id}`);
    res.status(404).json({ error: 'Image file not found' });
  } catch (error) {
    logger.error(`[Images API] Error serving image:`, error);
    res.status(500).json({ error: 'Failed to serve image' });
  }
});

export default router;

