import { pool } from '../config/database';
import { scrapeNewspaperPage } from './scraper';
import { downloadImage } from './imageDownloader';
import { aiService } from './aiService';
import { logger } from '../utils/logger';
import * as path from 'path';
import * as fs from 'fs/promises';

export interface ExtractionProgress {
  issueId: number;
  status: 'pending' | 'scraping' | 'downloading' | 'processing' | 'analyzing' | 'completed' | 'failed';
  progress: number;
  totalItems: number;
  processedItems: number;
  errorMessage?: string;
}

export class ExtractionService {
  async startExtraction(issueId: number): Promise<void> {
    logger.info('========================================');
    logger.info('===== START EXTRACTION REQUEST =====');
    logger.info(`Issue ID: ${issueId}`);
    logger.info(`Timestamp: ${new Date().toISOString()}`);
    
    const client = await pool.connect();
    
    try {
      logger.info('Step 1: Beginning database transaction...');
      await client.query('BEGIN');
      logger.info('Step 1: Transaction started');

      // Get issue information
      logger.info('Step 2: Fetching issue information...');
      const issueResult = await client.query(
        'SELECT * FROM newspaper_issues WHERE id = $1',
        [issueId]
      );

      if (issueResult.rows.length === 0) {
        logger.error(`Step 2: Issue ${issueId} not found`);
        throw new Error('Issue not found');
      }

      const issue = issueResult.rows[0];
      logger.info(`Step 2: Issue found:`, {
        id: issue.id,
        year: issue.year,
        month: issue.month,
        title: issue.title,
        url: issue.url,
        status: issue.status,
        image_count: issue.image_count,
      });

      // Create extraction job
      logger.info('Step 3: Creating extraction job...');
      const jobResult = await client.query(
        `INSERT INTO extraction_jobs (issue_id, status, started_at)
         VALUES ($1, 'scraping', CURRENT_TIMESTAMP)
         RETURNING id`,
        [issueId]
      );
      const jobId = jobResult.rows[0].id;
      logger.info(`Step 3: Extraction job created with ID: ${jobId}`);

      // Update issue status
      logger.info('Step 4: Updating issue status to processing...');
      await client.query(
        'UPDATE newspaper_issues SET status = $1 WHERE id = $2',
        ['processing', issueId]
      );
      logger.info('Step 4: Issue status updated to processing');

      logger.info('Step 5: Committing transaction...');
      await client.query('COMMIT');
      logger.info('Step 5: Transaction committed successfully');
      logger.info('===== START EXTRACTION SUCCESS =====');
      logger.info('========================================');

      // Start async extraction
      logger.info(`Step 6: Starting async extraction process...`);
      logger.info(`Step 6: Issue ID: ${issueId}, Job ID: ${jobId}, URL: ${issue.url}`);
      this.processExtraction(issueId, jobId, issue.url).catch((error) => {
        logger.error('========================================');
        logger.error('===== ASYNC EXTRACTION FAILED =====');
        logger.error(`Issue ID: ${issueId}, Job ID: ${jobId}`);
        logger.error('Error:', error);
        logger.error('========================================');
      });

    } catch (error) {
      logger.error('========================================');
      logger.error('===== START EXTRACTION ERROR =====');
      logger.error(`Issue ID: ${issueId}`);
      logger.error('Error type:', error instanceof Error ? error.constructor.name : typeof error);
      logger.error('Error message:', error instanceof Error ? error.message : String(error));
      logger.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
      logger.error('========================================');
      
      await client.query('ROLLBACK');
      logger.error(`Transaction rolled back for issue ${issueId}`);
      throw error;
    } finally {
      client.release();
      logger.info('Database connection released');
    }
  }

  private async processExtraction(
    issueId: number,
    jobId: number,
    boardUrl: string
  ): Promise<void> {
    logger.info('========================================');
    logger.info('===== PROCESS EXTRACTION START =====');
    logger.info(`Issue ID: ${issueId}`);
    logger.info(`Job ID: ${jobId}`);
    logger.info(`URL: ${boardUrl}`);
    logger.info(`Timestamp: ${new Date().toISOString()}`);
    logger.info('========================================');
    
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
      logger.info(`===== Step 2: Downloading Images =====`);
      logger.info(`Step 2: Total images to download: ${images.length}`);
      await this.updateJobStatus(jobId, 'downloading', 0, images.length, 0);
      
      // Azure App Service uses /tmp for temporary files (read-only filesystem for /app)
      const imagesDir = path.join(process.env.IMAGES_DIR || '/tmp/images', `issue_${issueId}`);
      logger.info(`Step 2: Creating images directory: ${imagesDir}`);
      await fs.mkdir(imagesDir, { recursive: true });
      logger.info(`Step 2: Images directory created: ${imagesDir}`);

      const downloadedImages = [];
      let successCount = 0;
      let failCount = 0;
      
      for (let i = 0; i < images.length; i++) {
        const image = images[i];
        const savePath = path.join(imagesDir, image.fileName);
        logger.info(`Step 2.${i + 1}: ===== Downloading Image ${i + 1}/${images.length} =====`);
        logger.info(`Step 2.${i + 1}: Source URL: ${image.url}`);
        logger.info(`Step 2.${i + 1}: Target path: ${savePath}`);
        logger.info(`Step 2.${i + 1}: Page number: ${image.pageNumber}`);
        logger.info(`Step 2.${i + 1}: File name: ${image.fileName}`);

        try {
          const downloadStartTime = Date.now();
          const downloadResult = await downloadImage(image.url, savePath);
          const downloadDuration = Date.now() - downloadStartTime;
          
          logger.info(`Step 2.${i + 1}: Download successful in ${downloadDuration}ms`);
          logger.info(`Step 2.${i + 1}: File size: ${downloadResult.fileSize} bytes`);
          logger.info(`Step 2.${i + 1}: MIME type: ${downloadResult.mimeType}`);
          logger.info(`Step 2.${i + 1}: Local path: ${downloadResult.localPath}`);
          
          // Verify file exists
          try {
            const fileStats = await fs.stat(downloadResult.localPath);
            logger.info(`Step 2.${i + 1}: File verified: exists, size=${fileStats.size} bytes`);
          } catch (statError) {
            logger.error(`Step 2.${i + 1}: File verification failed:`, statError);
          }
          
          logger.info(`Step 2.${i + 1}: Inserting image record into database...`);
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

          const imageId = imageResult.rows[0].id;
          logger.info(`Step 2.${i + 1}: Image record inserted with ID: ${imageId}`);

          downloadedImages.push({
            id: imageId,
            pageNumber: image.pageNumber,
            localPath: downloadResult.localPath,
          });

          successCount++;
          logger.info(`Step 2.${i + 1}: ===== Image ${i + 1} Download Complete =====`);
          await this.updateJobStatus(jobId, 'downloading', i + 1, images.length, i + 1);
        } catch (error) {
          failCount++;
          logger.error(`Step 2.${i + 1}: ===== Image ${i + 1} Download Failed =====`);
          logger.error(`Step 2.${i + 1}: Error type:`, error instanceof Error ? error.constructor.name : typeof error);
          logger.error(`Step 2.${i + 1}: Error message:`, error instanceof Error ? error.message : String(error));
          logger.error(`Step 2.${i + 1}: Error stack:`, error instanceof Error ? error.stack : 'No stack');
          logger.error(`Step 2.${i + 1}: Failed to download image ${image.url}`);
        }
      }
      
      logger.info(`===== Step 2: Download Summary =====`);
      logger.info(`Step 2: Total images: ${images.length}`);
      logger.info(`Step 2: Successfully downloaded: ${successCount}`);
      logger.info(`Step 2: Failed: ${failCount}`);
      logger.info(`Step 2: Downloaded images array length: ${downloadedImages.length}`);
      logger.info(`===== Step 2: Download Complete =====`);

      // Step 3: Process images with AI (OCR + Article Extraction)
      logger.info(`Step 3: Processing ${downloadedImages.length} images with AI`);
      await this.updateJobStatus(jobId, 'processing', 0, downloadedImages.length, 0);

      let processedCount = 0;
      let failedCount = 0;
      
      for (let i = 0; i < downloadedImages.length; i++) {
        const image = downloadedImages[i];
        logger.info(`===== Processing image ${i + 1}/${downloadedImages.length} =====`);
        logger.info(`Page: ${image.pageNumber}, Path: ${image.localPath}`);

        try {
          // Extract text with OCR
          logger.info(`[Image ${i + 1}] Starting OCR extraction...`);
          const ocrResult = await aiService.extractTextFromImage(image.localPath);
          logger.info(`[Image ${i + 1}] OCR completed: ${ocrResult.text.length} characters extracted`);
          
          if (!ocrResult.text || ocrResult.text.trim().length === 0) {
            logger.warn(`[Image ${i + 1}] OCR returned empty text, skipping article extraction`);
            failedCount++;
            await this.updateJobStatus(jobId, 'processing', i + 1, downloadedImages.length, i + 1);
            continue;
          }

          // Extract article information
          logger.info(`[Image ${i + 1}] Starting article extraction from OCR text...`);
          const articleExtraction = await aiService.extractArticleFromText(
            ocrResult.text,
            image.pageNumber
          );
          logger.info(`[Image ${i + 1}] Article extraction completed:`, {
            title: articleExtraction.title || 'No title',
            articleType: articleExtraction.articleType || 'No type',
            author: articleExtraction.author || 'No author',
            contentLength: articleExtraction.content?.length || 0,
            summaryLength: articleExtraction.summary?.length || 0,
            eventsCount: articleExtraction.events?.length || 0,
            imagesCount: articleExtraction.images?.length || 0,
          });

          // Validate required fields - at least content or summary should exist
          const hasContent = articleExtraction.content && articleExtraction.content.trim().length > 0;
          const hasSummary = articleExtraction.summary && articleExtraction.summary.trim().length > 0;
          
          if (!hasContent && !hasSummary) {
            logger.warn(`[Image ${i + 1}] Article extraction returned no content or summary, skipping save`);
            failedCount++;
            await this.updateJobStatus(jobId, 'processing', i + 1, downloadedImages.length, i + 1);
            continue;
          }

          // Use content if available, otherwise use summary
          const finalContent = hasContent ? articleExtraction.content : (articleExtraction.summary || '');
          const finalSummary = articleExtraction.summary || (hasContent ? articleExtraction.content.substring(0, 500) : '');

          // Save article
          logger.info(`[Image ${i + 1}] Saving article to database...`);
          logger.info(`[Image ${i + 1}] Article data:`, {
            title: articleExtraction.title || `Page ${image.pageNumber}`,
            articleType: articleExtraction.articleType || '기타',
            author: articleExtraction.author || null,
            contentLength: finalContent.length,
            summaryLength: finalSummary.length,
          });
          
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
              articleExtraction.title || `Page ${image.pageNumber}`,
              finalSummary,
              finalContent,
              articleExtraction.articleType || '기타',
              articleExtraction.author || null,
              JSON.stringify({
                ocrConfidence: ocrResult.confidence,
                language: ocrResult.language,
              }),
            ]
          );

          const articleId = articleResult.rows[0].id;
          logger.info(`[Image ${i + 1}] Article saved with ID: ${articleId}`);

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
            logger.info(`[Image ${i + 1}] Saving ${articleExtraction.events.length} events...`);
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
            logger.info(`[Image ${i + 1}] All events saved successfully`);
          } else {
            logger.info(`[Image ${i + 1}] No events to save`);
          }

          processedCount++;
          logger.info(`[Image ${i + 1}] Successfully processed and saved`);
          await this.updateJobStatus(jobId, 'processing', i + 1, downloadedImages.length, i + 1);
        } catch (error) {
          failedCount++;
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.error(`[Image ${i + 1}] ===== Processing Failed =====`);
          logger.error(`[Image ${i + 1}] Error type:`, error instanceof Error ? error.constructor.name : typeof error);
          logger.error(`[Image ${i + 1}] Error message:`, errorMessage);
          logger.error(`[Image ${i + 1}] Error stack:`, error instanceof Error ? error.stack : 'No stack');
          logger.error(`[Image ${i + 1}] Failed to process image: ${image.localPath}`);
          logger.error(`[Image ${i + 1}] ===== Processing Failed End =====`);
          
          // Continue processing other images even if one fails
          await this.updateJobStatus(jobId, 'processing', i + 1, downloadedImages.length, i + 1);
        }
      }
      
      logger.info(`===== Step 3: AI Processing Summary =====`);
      logger.info(`Total images: ${downloadedImages.length}`);
      logger.info(`Successfully processed: ${processedCount}`);
      logger.info(`Failed: ${failedCount}`);
      logger.info(`===== Step 3: AI Processing Complete =====`);

      // Step 4: Generate and validate insights
      logger.info(`Step 4: Generating and validating insights for issue ${issueId}`);
      await this.updateJobStatus(jobId, 'analyzing', downloadedImages.length, downloadedImages.length + 1, downloadedImages.length);
      
      try {
        // Validate that articles and events were created
        const articleCount = await client.query(
          'SELECT COUNT(*) as count FROM articles WHERE issue_id = $1',
          [issueId]
        );
        const eventCount = await client.query(
          'SELECT COUNT(*) as count FROM events e JOIN articles a ON e.article_id = a.id WHERE a.issue_id = $1',
          [issueId]
        );
        
        logger.info(`Step 4: Validation results for issue ${issueId}:`, {
          articles: parseInt(articleCount.rows[0].count),
          events: parseInt(eventCount.rows[0].count),
        });

        // Calculate and log insights statistics
        const insightsStats = await this.calculateInsightsForIssue(issueId, client);
        logger.info(`Step 4: Insights calculated for issue ${issueId}:`, insightsStats);

        await this.updateJobStatus(jobId, 'analyzing', downloadedImages.length + 1, downloadedImages.length + 1, downloadedImages.length + 1);
      } catch (insightsError) {
        logger.error(`Step 4: Failed to generate insights for issue ${issueId}:`, insightsError);
        // Don't fail the entire extraction if insights generation fails
        // Insights can be calculated on-demand later
      }

      // Complete
      logger.info(`Extraction completed successfully for issue ${issueId}: ${downloadedImages.length} images processed`);
      await this.updateJobStatus(jobId, 'completed', downloadedImages.length + 1, downloadedImages.length + 1, downloadedImages.length + 1);
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

  /**
   * Calculate insights statistics for a specific issue
   * This validates that articles and events were properly extracted
   */
  private async calculateInsightsForIssue(issueId: number, client: any): Promise<{
    articles: number;
    events: number;
    articleTypes: Array<{ type: string; count: number }>;
    authors: number;
    eventTypes: Array<{ type: string; count: number }>;
  }> {
    // Get article count
    const articleResult = await client.query(
      'SELECT COUNT(*) as count FROM articles WHERE issue_id = $1',
      [issueId]
    );
    const articleCount = parseInt(articleResult.rows[0].count);

    // Get event count
    const eventResult = await client.query(
      `SELECT COUNT(*) as count 
       FROM events e 
       JOIN articles a ON e.article_id = a.id 
       WHERE a.issue_id = $1`,
      [issueId]
    );
    const eventCount = parseInt(eventResult.rows[0].count);

    // Get article type distribution
    const articleTypeResult = await client.query(
      `SELECT article_type, COUNT(*) as count
       FROM articles
       WHERE issue_id = $1 AND article_type IS NOT NULL
       GROUP BY article_type
       ORDER BY count DESC`,
      [issueId]
    );

    // Get unique authors count
    const authorResult = await client.query(
      `SELECT COUNT(DISTINCT author) as count
       FROM articles
       WHERE issue_id = $1 AND author IS NOT NULL AND author != ''`,
      [issueId]
    );
    const authorCount = parseInt(authorResult.rows[0].count);

    // Get event type distribution
    const eventTypeResult = await client.query(
      `SELECT e.event_type, COUNT(*) as count
       FROM events e
       JOIN articles a ON e.article_id = a.id
       WHERE a.issue_id = $1 AND e.event_type IS NOT NULL
       GROUP BY e.event_type
       ORDER BY count DESC`,
      [issueId]
    );

    return {
      articles: articleCount,
      events: eventCount,
      articleTypes: articleTypeResult.rows.map((row: any) => ({
        type: row.article_type,
        count: parseInt(row.count),
      })),
      authors: authorCount,
      eventTypes: eventTypeResult.rows.map((row: any) => ({
        type: row.event_type,
        count: parseInt(row.count),
      })),
    };
  }
}

export const extractionService = new ExtractionService();

