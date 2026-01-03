import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { pool } from './config/database';
import { initializeDatabase } from './config/init-db';
import apiRoutes from './routes';
import { errorHandler } from './middleware/errorHandler';
import { logger } from './utils/logger';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

// Middleware - CORS must be before other middleware
// Azure App Service 환경: Azure 프론트엔드만 허용
const corsOptions = {
  origin: [
    'https://11hour-frontend.azurewebsites.net',
    // 환경 변수로 추가 origin 설정 가능
    ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : []),
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Length', 'X-Foo', 'X-Bar'],
  preflightContinue: false,
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));

// Handle preflight requests explicitly
app.options('*', cors(corsOptions));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files
// Azure App Service에서는 /tmp/images를 사용하므로 정적 파일 서빙 대신 API 엔드포인트 사용
// app.use('/images', express.static('images')); // 주석 처리 - /api/images/:id 엔드포인트 사용
app.use('/uploads', express.static('uploads'));

// Routes
app.use('/api', apiRoutes);

// Health check
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch (error) {
    res.status(500).json({ status: 'error', database: 'disconnected' });
  }
});

// Error handler
app.use(errorHandler);

// Initialize database and start server
async function startServer() {
  try {
    console.log('Starting server initialization...');
    console.log(`Database config: ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`);
    console.log(`User: ${process.env.DB_USER}`);
    logger.info('Starting server initialization...');
    logger.info(`Database config: ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`);
    
    // Test database connection first with retry
    let dbConnected = false;
    const maxRetries = 10;
    const retryDelay = 10000; // 10 seconds
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        console.log(`Attempting database connection (${i + 1}/${maxRetries})...`);
        const testResult = await pool.query('SELECT NOW()');
        console.log('Database connection test successful:', testResult.rows[0]);
        dbConnected = true;
        break;
      } catch (dbError) {
        const errorMessage = dbError instanceof Error ? dbError.message : String(dbError);
        console.error(`Database connection test failed (attempt ${i + 1}/${maxRetries}):`, errorMessage);
        logger.error(`Database connection test failed (attempt ${i + 1}/${maxRetries}):`, errorMessage);
        
        if (i < maxRetries - 1) {
          console.log(`Retrying in ${retryDelay / 1000} seconds...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        } else {
          console.error('All database connection attempts failed. Server will exit.');
          throw dbError;
        }
      }
    }
    
    if (!dbConnected) {
      throw new Error(`Failed to connect to database after ${maxRetries} attempts`);
    }
    
    await initializeDatabase();
    console.log('Database initialized successfully');
    logger.info('Database initialized successfully');
    
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on port ${PORT}`);
      logger.info(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    logger.error('Failed to start server:', error);
    // Don't exit immediately, wait a bit for logs to flush
    setTimeout(() => process.exit(1), 5000);
  }
}

startServer().catch((error) => {
  console.error('Unhandled error in startServer:', error);
  setTimeout(() => process.exit(1), 5000);
});

