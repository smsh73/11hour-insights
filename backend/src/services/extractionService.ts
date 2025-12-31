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
    logger.info(`Starting extraction for issue ${issueId}`);
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Get issue information
      const issueResult = await client.query(
        'SELECT * FROM newspaper_issues WHERE id = $1',
        [issueId]
      );

      if (issueResult.rows.length === 0) {
        logger.error(`Issue ${issueId} not found`);
        throw new Error('Issue not found');
      }

      const issue = issueResult.rows[0];
      logger.info(`Found issue ${issueId}: ${issue.year}년 ${issue.month}월호, URL: ${issue.url}`);

      // Create extraction job
      const jobResult = await client.query(
        `INSERT INTO extraction_jobs (issue_id, status, started_at)
         VALUES ($1, 'scraping', CURRENT_TIMESTAMP)
         RETURNING id`,
        [issueId]
      );
      const jobId = jobResult.rows[0].id;
      logger.info(`Created extraction job ${jobId} for issue ${issueId}`);

      // Update issue status
      await client.query(
        'UPDATE newspaper_issues SET status = $1 WHERE id = $2',
        ['processing', issueId]
      );

      await client.query('COMMIT');
      logger.info(`Committed transaction for issue ${issueId}`);

      // Start async extraction
      logger.info(`Starting async extraction process for issue ${issueId}, job ${jobId}`);
      this.processExtraction(issueId, jobId, issue.url).catch((error) => {
        logger.error(`Extraction failed for issue ${issueId}, job ${jobId}:`, error);
      });

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`Failed to start extraction for issue ${issueId}:`, error);
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
    logger.info(`Processing extraction for issue ${issueId}, job ${jobId}, URL: ${boardUrl}`);
    const client = await pool.connect();

    try {
      // Step 1: Scrape images
      logger.info(`Step 1: Scraping images from ${boardUrl}`);
      await this.updateJobStatus(jobId, 'scraping', 0, 0, 0);
      const images = await scrapeNewspaperPage(boardUrl);
      logger.info(`Scraped ${images.length} images from ${boardUrl}`);

      await client.query(
        'UPDATE newspaper_issues SET image_count = $1 WHERE id = $2',
        [images.length, issueId]
      );

      // Step 2: Download images
      logger.info(`Step 2: Downloading ${images.length} images`);
      await this.updateJobStatus(jobId, 'downloading', 0, images.length, 0);
      
      // Azure App Service uses /tmp for temporary files (read-only filesystem for /app)
      const imagesDir = path.join(process.env.IMAGES_DIR || '/tmp/images', `issue_${issueId}`);
      logger.info(`Creating images directory: ${imagesDir}`);
      await fs.mkdir(imagesDir, { recursive: true });
      logger.info(`Images directory created: ${imagesDir}`);

      const downloadedImages = [];
      for (let i = 0; i < images.length; i++) {
        const image = images[i];
        const savePath = path.join(imagesDir, image.fileName);
        logger.info(`Downloading image ${i + 1}/${images.length}: ${image.url} -> ${savePath}`);

        try {
          const downloadResult = await downloadImage(image.url, savePath);
          logger.info(`Successfully downloaded image ${i + 1}/${images.length}: ${savePath} (${downloadResult.fileSize} bytes)`);
          
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
      logger.info(`Step 3: Processing ${downloadedImages.length} images with AI`);
      await this.updateJobStatus(jobId, 'processing', 0, downloadedImages.length, 0);

      for (let i = 0; i < downloadedImages.length; i++) {
        const image = downloadedImages[i];
        logger.info(`Processing image ${i + 1}/${downloadedImages.length}: page ${image.pageNumber}, path: ${image.localPath}`);

        try {
          // Extract text with OCR
          logger.info(`Extracting text from image ${i + 1}/${downloadedImages.length} using OCR`);
          const ocrResult = await aiService.extractTextFromImage(image.localPath);
          logger.info(`OCR completed for image ${i + 1}/${downloadedImages.length}: ${ocrResult.text.length} characters extracted`);

          // Extract article information
          logger.info(`Extracting article information from OCR text for image ${i + 1}/${downloadedImages.length}`);
          const articleExtraction = await aiService.extractArticleFromText(
            ocrResult.text,
            image.pageNumber
          );
          logger.info(`Article extraction completed for image ${i + 1}/${downloadedImages.length}: ${articleExtraction.title}`);

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

          // Save article images
          if (articleExtraction.images && articleExtraction.images.length > 0) {
            for (let imgIndex = 0; imgIndex < articleExtraction.images.length; imgIndex++) {
              const img = articleExtraction.images[imgIndex];
              await client.query(
                `INSERT INTO article_images 
                 (article_id, image_url, description, position_in_article)
                 VALUES ($1, $2, $3, $4)`,
                [
                  articleId,
                  img.url || null,
                  img.description || null,
                  imgIndex + 1,
                ]
              );
            }
          }

          // Save events
          if (articleExtraction.events && articleExtraction.events.length > 0) {
            for (const event of articleExtraction.events) {
              await client.query(
                `INSERT INTO events 
                 (article_id, event_type, event_date, event_title, description, location, participants)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [
                  articleId,
                  event.type,
                  event.date || null,
                  event.title,
                  event.description,
                  (event as any).location || null,
                  (event as any).participants && (event as any).participants.length > 0 
                    ? (event as any).participants 
                    : null,
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
      logger.info(`Extraction completed successfully for issue ${issueId}: ${downloadedImages.length} images processed`);
      await this.updateJobStatus(jobId, 'completed', downloadedImages.length, downloadedImages.length, downloadedImages.length);
      await client.query(
        'UPDATE newspaper_issues SET status = $1 WHERE id = $2',
        ['completed', issueId]
      );
      logger.info(`Issue ${issueId} status updated to completed`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.updateJobStatus(jobId, 'failed', 0, 0, 0, errorMessage);
      
      // Update issue status to failed
      const updateClient = await pool.connect();
      try {
        await updateClient.query(
          'UPDATE newspaper_issues SET status = $1 WHERE id = $2',
          ['failed', issueId]
        );
      } finally {
        updateClient.release();
      }
      
      logger.error(`Extraction failed for issue ${issueId}:`, error);
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

