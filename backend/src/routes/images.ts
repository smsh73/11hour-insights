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
  const startTime = Date.now();
  try {
    const { id } = req.params;
    logger.info(`[Images API] ===== Image Request Start =====`);
    logger.info(`[Images API] Image ID: ${id}`);
    logger.info(`[Images API] Request headers:`, req.headers);
    
    // Validate ID
    const imageId = parseInt(id, 10);
    if (isNaN(imageId) || imageId <= 0) {
      logger.warn(`[Images API] Invalid image ID: ${id}`);
      return res.status(400).json({ error: 'Invalid image ID' });
    }
    
    // Query database
    logger.info(`[Images API] Querying database for image ID: ${imageId}`);
    const result = await pool.query(
      'SELECT id, issue_id, local_path, image_url, file_name, page_number, status FROM newspaper_images WHERE id = $1',
      [imageId]
    );

    if (result.rows.length === 0) {
      logger.warn(`[Images API] Image not found in database: ${imageId}`);
      return res.status(404).json({ error: 'Image not found in database' });
    }

    const imageRecord = result.rows[0];
    const imagePath = imageRecord.local_path;
    const imageUrl = imageRecord.image_url;
    
    logger.info(`[Images API] Image found in database:`, {
      id: imageRecord.id,
      issue_id: imageRecord.issue_id,
      file_name: imageRecord.file_name,
      page_number: imageRecord.page_number,
      status: imageRecord.status,
      has_local_path: !!imagePath,
      has_image_url: !!imageUrl,
      local_path: imagePath,
      image_url: imageUrl,
    });

    // Strategy 1: Try to serve from local_path if available
    if (imagePath) {
      // Azure App Service에서는 /tmp/images를 사용
      const fullPath = path.isAbsolute(imagePath) 
        ? imagePath 
        : path.resolve(imagePath);
      
      logger.info(`[Images API] Strategy 1: Attempting to serve from local_path: ${fullPath}`);
      
      try {
        // Check if file exists
        await fs.access(fullPath);
        const stats = await fs.stat(fullPath);
        logger.info(`[Images API] File exists: ${fullPath}, size: ${stats.size} bytes`);
        
        // Set appropriate content type
        const ext = path.extname(fullPath).toLowerCase();
        const contentTypeMap: { [key: string]: string } = {
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.png': 'image/png',
          '.gif': 'image/gif',
          '.webp': 'image/webp',
        };
        const contentType = contentTypeMap[ext] || 'image/jpeg';
        
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Length', stats.size);
        res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 year cache
        
        logger.info(`[Images API] Sending file: ${fullPath}, Content-Type: ${contentType}`);
        res.sendFile(fullPath);
        
        const duration = Date.now() - startTime;
        logger.info(`[Images API] ===== Image Request Success (${duration}ms) =====`);
        return;
      } catch (fileError) {
        const errorMessage = fileError instanceof Error ? fileError.message : String(fileError);
        logger.warn(`[Images API] File access failed: ${fullPath}, error: ${errorMessage}`);
        logger.info(`[Images API] Falling back to image_url`);
      }
    }
    
    // Strategy 2: Redirect to image_url if available
    if (imageUrl) {
      logger.info(`[Images API] Strategy 2: Redirecting to image_url: ${imageUrl}`);
      res.redirect(302, imageUrl);
      
      const duration = Date.now() - startTime;
      logger.info(`[Images API] ===== Image Request Redirect (${duration}ms) =====`);
      return;
    }

    // Strategy 3: No valid image source
    logger.error(`[Images API] No valid image source available for ID: ${imageId}`);
    logger.error(`[Images API] local_path: ${imagePath || 'null'}, image_url: ${imageUrl || 'null'}`);
    
    const duration = Date.now() - startTime;
    logger.error(`[Images API] ===== Image Request Failed (${duration}ms) =====`);
    res.status(404).json({ 
      error: 'Image file not found',
      imageId: imageId,
      hasLocalPath: !!imagePath,
      hasImageUrl: !!imageUrl,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error(`[Images API] ===== Image Request Error (${duration}ms) =====`);
    logger.error(`[Images API] Error type:`, error instanceof Error ? error.constructor.name : typeof error);
    logger.error(`[Images API] Error message:`, error instanceof Error ? error.message : String(error));
    logger.error(`[Images API] Error stack:`, error instanceof Error ? error.stack : 'No stack');
    logger.error(`[Images API] Full error:`, error);
    
    res.status(500).json({ 
      error: 'Failed to serve image',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

export default router;

