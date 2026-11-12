import pkg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Ensure we load the .env from the server directory explicitly
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const { Pool } = pkg;

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || 'nuvorn_axis',
  user: typeof process.env.DB_USER === 'string' ? process.env.DB_USER : String(process.env.DB_USER || 'postgres'),
  password: typeof process.env.DB_PASSWORD === 'string' ? process.env.DB_PASSWORD : String(process.env.DB_PASSWORD || ''),
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
};

// Create connection pool
const pool = new Pool(dbConfig);

// Database connection function
export async function connectDatabase() {
  try {
    const client = await pool.connect();
    console.log('Database connection established');
    
    // Test the connection
    const result = await client.query('SELECT NOW()');
    console.log('Database connection test successful:', result.rows[0].now);
    
    client.release();
    return pool;
  } catch (error) {
    console.error('Database connection failed:', error);
    throw error;
  }
}

// Query function with error handling and optional user context for RLS
export async function query(text, params, userContext = null) {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    
    if (process.env.NODE_ENV === 'development') {
      console.log('Executed query', { text, duration, rows: result.rowCount });
    }
    
    return result;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
}

// Query function with user context for Row Level Security
export async function queryWithUserContext(text, params, userId) {
  const client = await pool.connect();
  const start = Date.now();
  
  try {
    // Set application user context for RLS
    if (userId) {
      await client.query('SELECT set_config($1, $2, true)', ['app.current_user_id', userId.toString()]);
    }
    
    const result = await client.query(text, params);
    const duration = Date.now() - start;
    
    if (process.env.NODE_ENV === 'development') {
      console.log('Executed query with user context', { 
        userId, 
        text: text.substring(0, 100) + '...', 
        duration, 
        rows: result.rowCount 
      });
    }
    
    return result;
  } catch (error) {
    console.error('Database query error (with user context):', error);
    throw error;
  } finally {
    client.release();
  }
}

// Transaction function
export async function transaction(callback) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Transaction function with user context for RLS
export async function transactionWithUserContext(callback, userId) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Set application user context for RLS
    if (userId) {
      await client.query('SELECT set_config($1, $2, true)', ['app.current_user_id', userId.toString()]);
    }
    
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Get pool instance
export function getPool() {
  return pool;
}

// Return configured database name for logging/observability
export function getDatabaseName() {
  return dbConfig.database;
}

// Close all connections
export async function closeDatabase() {
  await pool.end();
  console.log('Database connections closed');
}

export default pool;
