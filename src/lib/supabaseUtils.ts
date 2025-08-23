import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Type definitions for our database schema
export interface LevelData {
  level_number: number;
  level_data: Record<string, any>; // JSONB data as JavaScript object
  created_at?: string;
  updated_at?: string;
  [key: string]: any; // Allow for additional fields
}

export interface DatabaseSchema {
  public: {
    Tables: {
      levels: {
        Row: LevelData;
        Insert: Omit<LevelData, 'created_at' | 'updated_at'>;
        Update: Partial<Omit<LevelData, 'created_at' | 'updated_at'>>;
      };
    };
  };
}

// Supabase client instance (singleton pattern)
let supabaseClient: SupabaseClient<DatabaseSchema> | null = null;

/**
 * Initialize and return the Supabase client instance
 * Uses environment variables for configuration
 * 
 * @returns {SupabaseClient} The Supabase client instance
 * @throws {Error} If required environment variables are missing
 */
export function getSupabaseClient(): SupabaseClient<DatabaseSchema> {
  // Return existing instance if already initialized
  if (supabaseClient) {
    return supabaseClient;
  }

  // Get environment variables
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  // Validate environment variables
  if (!supabaseUrl) {
    throw new Error(
      'Missing VITE_SUPABASE_URL environment variable. ' +
      'Please set VITE_SUPABASE_URL in your environment.'
    );
  }

  if (!supabaseAnonKey) {
    throw new Error(
      'Missing VITE_SUPABASE_ANON_KEY environment variable. ' +
      'Please set VITE_SUPABASE_ANON_KEY in your environment.'
    );
  }

  // Validate URL format
  try {
    new URL(supabaseUrl);
  } catch (error) {
    throw new Error(`Invalid VITE_SUPABASE_URL format: ${supabaseUrl}`);
  }

  // Create and cache the client instance
  supabaseClient = createClient<DatabaseSchema>(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
    db: {
      schema: 'public',
    },
    global: {
      headers: {
        'X-Client-Info': 'supabase-client-module',
      },
    },
  });

  return supabaseClient;
}

/**
 * Fetch level data for a specific level number
 * 
 * @param {number} levelNumber - The level number to fetch
 * @returns {Promise<Record<string, any> | null>} The level data as a JavaScript object, or null if not found
 * @throws {Error} If the database query fails or validation errors occur
 */
export async function fetchLevelData(levelNumber: number): Promise<Record<string, any> | null> {
  // Validate input
  if (!Number.isInteger(levelNumber) || levelNumber < 1) {
    throw new Error(`Invalid level number: ${levelNumber}. Level number must be a positive integer.`);
  }

  try {
    // Get the Supabase client
    const client = getSupabaseClient();

    // Query the levels table
    const { data, error } = await client
      .from('levels')
      .select('level_data')
      .eq('level_number', levelNumber)
      .single(); // Expect only one result

    // Handle database errors
    if (error) {
      // Handle "not found" error specifically
      if (error.code === 'PGRST116') {
        return null; // No data found for this level number
      }
      
      throw new Error(`Database query failed: ${error.message}`);
    }

    // Return the level_data JSONB as a JavaScript object
    return data?.level_data || null;

  } catch (error) {
    // Re-throw our custom errors
    if (error instanceof Error && error.message.startsWith('Invalid level number')) {
      throw error;
    }
    
    if (error instanceof Error && error.message.startsWith('Database query failed')) {
      throw error;
    }

    // Handle unexpected errors
    throw new Error(`Failed to fetch level data: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Fetch multiple levels data within a range
 * 
 * @param {number} startLevel - Starting level number (inclusive)
 * @param {number} endLevel - Ending level number (inclusive)
 * @returns {Promise<LevelData[]>} Array of level data objects
 * @throws {Error} If the database query fails or validation errors occur
 */
export async function fetchLevelDataRange(startLevel: number, endLevel: number): Promise<LevelData[]> {
  // Validate inputs
  if (!Number.isInteger(startLevel) || startLevel < 1) {
    throw new Error(`Invalid start level: ${startLevel}. Must be a positive integer.`);
  }
  
  if (!Number.isInteger(endLevel) || endLevel < 1) {
    throw new Error(`Invalid end level: ${endLevel}. Must be a positive integer.`);
  }
  
  if (startLevel > endLevel) {
    throw new Error(`Start level (${startLevel}) cannot be greater than end level (${endLevel}).`);
  }

  try {
    const client = getSupabaseClient();

    const { data, error } = await client
      .from('levels')
      .select('*')
      .gte('level_number', startLevel)
      .lte('level_number', endLevel)
      .order('level_number', { ascending: true });

    if (error) {
      throw new Error(`Database query failed: ${error.message}`);
    }

    return data || [];

  } catch (error) {
    if (error instanceof Error && (
      error.message.startsWith('Invalid start level') ||
      error.message.startsWith('Invalid end level') ||
      error.message.startsWith('Start level') ||
      error.message.startsWith('Database query failed')
    )) {
      throw error;
    }

    throw new Error(`Failed to fetch level data range: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Check if a level exists in the database
 * 
 * @param {number} levelNumber - The level number to check
 * @returns {Promise<boolean>} True if the level exists, false otherwise
 * @throws {Error} If the database query fails
 */
export async function levelExists(levelNumber: number): Promise<boolean> {
  if (!Number.isInteger(levelNumber) || levelNumber < 1) {
    return false;
  }

  try {
    const client = getSupabaseClient();

    const { data, error } = await client
      .from('levels')
      .select('level_number')
      .eq('level_number', levelNumber)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return false; // No data found
      }
      throw new Error(`Database query failed: ${error.message}`);
    }

    return data !== null;

  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Database query failed')) {
      throw error;
    }

    throw new Error(`Failed to check level existence: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get the total number of levels in the database
 * 
 * @returns {Promise<number>} The total count of levels
 * @throws {Error} If the database query fails
 */
export async function getLevelCount(): Promise<number> {
  try {
    const client = getSupabaseClient();

    const { count, error } = await client
      .from('levels')
      .select('*', { count: 'exact', head: true });

    if (error) {
      throw new Error(`Database query failed: ${error.message}`);
    }

    return count || 0;

  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Database query failed')) {
      throw error;
    }

    throw new Error(`Failed to get level count: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Reset the Supabase client instance (useful for testing or environment changes)
 */
export function resetSupabaseClient(): void {
  supabaseClient = null;
}

// Export types for external use
export type { SupabaseClient } from '@supabase/supabase-js';