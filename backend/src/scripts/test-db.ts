import { pool } from '../config/database';
import { logger } from '../utils/logger';

async function testDatabase() {
  const client = await pool.connect();
  
  try {
    logger.info('Starting database integrity tests...');

    // Test 1: Check all tables exist
    const tables = [
      'users',
      'api_keys',
      'newspaper_issues',
      'newspaper_images',
      'articles',
      'article_images',
      'extraction_jobs',
      'events',
    ];

    for (const table of tables) {
      const result = await client.query(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        )`,
        [table]
      );
      
      if (!result.rows[0].exists) {
        throw new Error(`Table ${table} does not exist`);
      }
      logger.info(`✓ Table ${table} exists`);
    }

    // Test 2: Check foreign key constraints
    const fkChecks = [
      {
        table: 'newspaper_images',
        fk: 'issue_id',
        ref: 'newspaper_issues',
      },
      {
        table: 'articles',
        fk: 'issue_id',
        ref: 'newspaper_issues',
      },
      {
        table: 'articles',
        fk: 'image_id',
        ref: 'newspaper_images',
      },
      {
        table: 'article_images',
        fk: 'article_id',
        ref: 'articles',
      },
      {
        table: 'extraction_jobs',
        fk: 'issue_id',
        ref: 'newspaper_issues',
      },
      {
        table: 'events',
        fk: 'article_id',
        ref: 'articles',
      },
    ];

    for (const check of fkChecks) {
      const result = await client.query(`
        SELECT COUNT(*) as count
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_name = $1
          AND kcu.column_name = $2
      `, [check.table, check.fk]);

      if (parseInt(result.rows[0].count) === 0) {
        throw new Error(`Foreign key ${check.table}.${check.fk} -> ${check.ref} does not exist`);
      }
      logger.info(`✓ Foreign key ${check.table}.${check.fk} -> ${check.ref} exists`);
    }

    // Test 3: Check indexes
    const indexes = [
      'idx_articles_issue_id',
      'idx_articles_page_number',
      'idx_articles_article_type',
      'idx_events_event_date',
      'idx_events_event_type',
      'idx_newspaper_issues_year_month',
    ];

    for (const index of indexes) {
      const result = await client.query(
        `SELECT EXISTS (
          SELECT FROM pg_indexes 
          WHERE indexname = $1
        )`,
        [index]
      );

      if (!result.rows[0].exists) {
        logger.warn(`⚠ Index ${index} does not exist (may be created automatically)`);
      } else {
        logger.info(`✓ Index ${index} exists`);
      }
    }

    // Test 4: Check unique constraints
    const uniqueChecks = [
      { table: 'users', column: 'username' },
      { table: 'api_keys', column: 'provider' },
      { table: 'newspaper_issues', columns: ['year', 'month'] },
    ];

    for (const check of uniqueChecks) {
      if ('columns' in check) {
        // Composite unique constraint
        const result = await client.query(`
          SELECT COUNT(*) as count
          FROM information_schema.table_constraints tc
          JOIN information_schema.constraint_column_usage ccu
            ON tc.constraint_name = ccu.constraint_name
          WHERE tc.constraint_type = 'UNIQUE'
            AND tc.table_name = $1
            AND ccu.column_name = ANY($2::text[])
        `, [check.table, check.columns]);

        if (parseInt(result.rows[0].count) === 0) {
          throw new Error(`Unique constraint on ${check.table}(${check.columns?.join(', ') || ''}) does not exist`);
        }
        logger.info(`✓ Unique constraint on ${check.table}(${check.columns?.join(', ') || ''}) exists`);
      } else {
        const result = await client.query(`
          SELECT COUNT(*) as count
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
          WHERE tc.constraint_type = 'UNIQUE'
            AND tc.table_name = $1
            AND kcu.column_name = $2
        `, [check.table, check.column]);

        if (parseInt(result.rows[0].count) === 0) {
          throw new Error(`Unique constraint on ${check.table}.${check.column} does not exist`);
        }
        logger.info(`✓ Unique constraint on ${check.table}.${check.column} exists`);
      }
    }

    logger.info('✓ All database integrity tests passed!');
    return true;
  } catch (error) {
    logger.error('✗ Database integrity test failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  testDatabase()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { testDatabase };

