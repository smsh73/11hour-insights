import { pool } from './database';
import { logger } from '../utils/logger';
import bcrypt from 'bcrypt';

export async function initializeDatabase() {
  const client = await pool.connect();
  
  try {
    // Create users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role VARCHAR(50) DEFAULT 'admin',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS api_keys (
        id SERIAL PRIMARY KEY,
        provider VARCHAR(50) NOT NULL UNIQUE,
        api_key TEXT NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS newspaper_issues (
        id SERIAL PRIMARY KEY,
        year INTEGER NOT NULL,
        month INTEGER NOT NULL,
        board_id INTEGER NOT NULL,
        url TEXT NOT NULL,
        title TEXT,
        published_date DATE,
        image_count INTEGER DEFAULT 0,
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(year, month)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS newspaper_images (
        id SERIAL PRIMARY KEY,
        issue_id INTEGER REFERENCES newspaper_issues(id) ON DELETE CASCADE,
        image_url TEXT NOT NULL,
        local_path TEXT,
        page_number INTEGER,
        file_name TEXT,
        file_size BIGINT,
        mime_type VARCHAR(100),
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS articles (
        id SERIAL PRIMARY KEY,
        issue_id INTEGER REFERENCES newspaper_issues(id) ON DELETE CASCADE,
        image_id INTEGER REFERENCES newspaper_images(id) ON DELETE SET NULL,
        page_number INTEGER NOT NULL,
        title TEXT,
        content_summary TEXT,
        full_content TEXT,
        article_type VARCHAR(100),
        author TEXT,
        extracted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS article_images (
        id SERIAL PRIMARY KEY,
        article_id INTEGER REFERENCES articles(id) ON DELETE CASCADE,
        image_url TEXT,
        local_path TEXT,
        description TEXT,
        position_in_article INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS extraction_jobs (
        id SERIAL PRIMARY KEY,
        issue_id INTEGER REFERENCES newspaper_issues(id) ON DELETE CASCADE,
        status VARCHAR(50) DEFAULT 'pending',
        progress INTEGER DEFAULT 0,
        total_items INTEGER DEFAULT 0,
        processed_items INTEGER DEFAULT 0,
        error_message TEXT,
        started_at TIMESTAMP,
        completed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS events (
        id SERIAL PRIMARY KEY,
        article_id INTEGER REFERENCES articles(id) ON DELETE CASCADE,
        event_type VARCHAR(100),
        event_date DATE,
        event_title TEXT,
        description TEXT,
        participants TEXT[],
        location TEXT,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_articles_issue_id ON articles(issue_id);
      CREATE INDEX IF NOT EXISTS idx_articles_page_number ON articles(page_number);
      CREATE INDEX IF NOT EXISTS idx_articles_article_type ON articles(article_type);
    `);

    // Create full-text search indexes with error handling
    // Use 'simple' instead of 'korean' as Azure PostgreSQL doesn't have korean text search by default
    try {
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_articles_title ON articles USING gin(to_tsvector('simple', COALESCE(title, '')));
      `);
    } catch (error) {
      logger.warn('Failed to create title full-text index, continuing without it:', error);
    }

    try {
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_articles_content ON articles USING gin(to_tsvector('simple', COALESCE(full_content, '')));
      `);
    } catch (error) {
      logger.warn('Failed to create content full-text index, continuing without it:', error);
    }

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_events_event_date ON events(event_date);
      CREATE INDEX IF NOT EXISTS idx_events_event_type ON events(event_type);
      CREATE INDEX IF NOT EXISTS idx_newspaper_issues_year_month ON newspaper_issues(year, month);
    `);

    // Create default admin user if it doesn't exist
    try {
      const adminUsername = process.env.ADMIN_USERNAME || 'admin';
      const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@2025';
      const passwordHash = await bcrypt.hash(adminPassword, 10);

      const adminResult = await client.query(
        `INSERT INTO users (username, password_hash, role)
         VALUES ($1, $2, 'admin')
         ON CONFLICT (username) 
         DO UPDATE SET password_hash = $2, updated_at = CURRENT_TIMESTAMP
         RETURNING id, username, role`,
        [adminUsername, passwordHash]
      );

      if (adminResult.rows.length > 0) {
        logger.info('Default admin user created/updated:', adminResult.rows[0].username);
      }
    } catch (adminError) {
      logger.warn('Failed to create default admin user:', adminError);
      // Don't throw - admin user creation failure shouldn't prevent server startup
    }

    logger.info('Database tables initialized');
  } catch (error) {
    logger.error('Error initializing database:', error);
    throw error;
  } finally {
    client.release();
  }
}

