import { pool } from '../config/database';
import { scrapeNewspaperPage } from './scraper';
import { downloadImage } from './imageDownloader';
import { aiService } from './aiService';
import { logger } from '../utils/logger';
import * as path from 'path';
import * as fs from 'fs/promises';

export interface ExtractionProgress {
  issueId: number;
  status: 'pending' | 'scraping' | 'downloading' | 'processing' | 'completed' | 'failed';
  progress: number;
  totalItems: number;
  processedItems: number;
  errorMessage?: string;
}

export class ExtractionService {
  async startExtraction(issueId: number): Promise<void> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Get issue information
      const issueResult = await client.query(
        'SELECT * FROM newspaper_issues WHERE id = $1',
        [issueId]
      );

      if (issueResult.rows.length === 0) {
        throw new Error('Issue not found');
      }

      const issue = issueResult.rows[0];

      // Create extraction job
      const jobResult = await client.query(
        `INSERT INTO extraction_jobs (issue_id, status, started_at)
         VALUES ($1, 'scraping', CURRENT_TIMESTAMP)
         RETURNING id`,
        [issueId]
      );
      const jobId = jobResult.rows[0].id;

      // Update issue status
      await client.query(
        'UPDATE newspaper_issues SET status = $1 WHERE id = $2',
        ['processing', issueId]
      );

      await client.query('COMMIT');

      // Start async extraction
      this.processExtraction(issueId, jobId, issue.url).catch((error) => {
        logger.error(`Extraction failed for issue ${issueId}:`, error);
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private async processExtraction(
    issueId: number,
    jobId: number,
    boardUrl: string
  ): Promise<void> {
    const client = await pool.connect();

    try {
      // Step 1: Scrape images
      await this.updateJobStatus(jobId, 'scraping', 0, 0, 0);
      const images = await scrapeNewspaperPage(boardUrl);

      await client.query(
        'UPDATE newspaper_issues SET image_count = $1 WHERE id = $2',
        [images.length, issueId]
      );

      // Step 2: Download images
      await this.updateJobStatus(jobId, 'downloading', 0, images.length, 0);
      const imagesDir = path.join(process.env.IMAGES_DIR || './images', `issue_${issueId}`);
      await fs.mkdir(imagesDir, { recursive: true });

      const downloadedImages = [];
      for (let i = 0; i < images.length; i++) {
        const image = images[i];
        const savePath = path.join(imagesDir, image.fileName);

        try {
          const downloadResult = await downloadImage(image.url, savePath);
          
          const imageResult = await client.query(
            `INSERT INTO newspaper_images 
             (issue_id, image_url, local_path, page_number, file_name, file_size, mime_type, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 'downloaded')
             RETURNING id`,
            [
              issueId,
              image.url,
              downloadResult.localPath,
              image.pageNumber,
              image.fileName,
              downloadResult.fileSize,
              downloadResult.mimeType,
            ]
          );

          downloadedImages.push({
            id: imageResult.rows[0].id,
            pageNumber: image.pageNumber,
            localPath: downloadResult.localPath,
          });

          await this.updateJobStatus(jobId, 'downloading', i + 1, images.length, i + 1);
        } catch (error) {
          logger.error(`Failed to download image ${image.url}:`, error);
        }
      }

      // Step 3: Process images with AI
      await this.updateJobStatus(jobId, 'processing', 0, downloadedImages.length, 0);

      for (let i = 0; i < downloadedImages.length; i++) {
        const image = downloadedImages[i];

        try {
          // Extract text with OCR
          const ocrResult = await aiService.extractTextFromImage(image.localPath);

          // Extract article information
          const articleExtraction = await aiService.extractArticleFromText(
            ocrResult.text,
            image.pageNumber
          );

          // Save article
          const articleResult = await client.query(
            `INSERT INTO articles 
             (issue_id, image_id, page_number, title, content_summary, full_content, 
              article_type, author, metadata)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING id`,
            [
              issueId,
              image.id,
              image.pageNumber,
              articleExtraction.title,
              articleExtraction.summary,
              articleExtraction.content,
              articleExtraction.articleType,
              articleExtraction.author,
              JSON.stringify({
                ocrConfidence: ocrResult.confidence,
                language: ocrResult.language,
              }),
            ]
          );

          const articleId = articleResult.rows[0].id;

          // Save events
          if (articleExtraction.events && articleExtraction.events.length > 0) {
            for (const event of articleExtraction.events) {
              await client.query(
                `INSERT INTO events 
                 (article_id, event_type, event_date, event_title, description)
                 VALUES ($1, $2, $3, $4, $5)`,
                [
                  articleId,
                  event.type,
                  event.date || null,
                  event.title,
                  event.description,
                ]
              );
            }
          }

          await this.updateJobStatus(jobId, 'processing', i + 1, downloadedImages.length, i + 1);
        } catch (error) {
          logger.error(`Failed to process image ${image.localPath}:`, error);
        }
      }

      // Complete
      await this.updateJobStatus(jobId, 'completed', downloadedImages.length, downloadedImages.length, downloadedImages.length);
      await client.query(
        'UPDATE newspaper_issues SET status = $1 WHERE id = $2',
        ['completed', issueId]
      );

    } catch (error) {
      await this.updateJobStatus(jobId, 'failed', 0, 0, 0, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    } finally {
      client.release();
    }
  }

  private async updateJobStatus(
    jobId: number,
    status: string,
    processedItems: number,
    totalItems: number,
    progress: number,
    errorMessage?: string
  ): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query(
        `UPDATE extraction_jobs 
         SET status = $1::VARCHAR, progress = $2, total_items = $3, 
         processed_items = $4, error_message = $5, updated_at = CURRENT_TIMESTAMP,
         completed_at = CASE WHEN $1::VARCHAR IN ('completed', 'failed') THEN CURRENT_TIMESTAMP ELSE completed_at END
         WHERE id = $6`,
        [status, progress, totalItems, processedItems, errorMessage || null, jobId]
      );
    } finally {
      client.release();
    }
  }

  async getExtractionProgress(issueId: number): Promise<ExtractionProgress | null> {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT * FROM extraction_jobs 
         WHERE issue_id = $1 
         ORDER BY created_at DESC 
         LIMIT 1`,
        [issueId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const job = result.rows[0];
      return {
        issueId,
        status: job.status,
        progress: job.progress,
        totalItems: job.total_items,
        processedItems: job.processed_items,
        errorMessage: job.error_message,
      };
    } finally {
      client.release();
    }
  }
}

export const extractionService = new ExtractionService();

