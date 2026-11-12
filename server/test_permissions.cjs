const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD
});

async function testPermissions() {
  try {
    console.log('🔍 Checking user permissions...');
    
    // Get a test user
    const userResult = await pool.query(`
      SELECT id, email, first_name, last_name, status
      FROM users 
      WHERE status = 'active' AND email_verified = true
      LIMIT 1
    `);
    
    if (userResult.rows.length === 0) {
      console.log('❌ No active users found');
      return;
    }
    
    const user = userResult.rows[0];
    console.log(`\n👤 Testing with user: ${user.first_name} ${user.last_name} (${user.email})`);
    
    // Check if user has procurement.supplier_management.read permission
    const permissionResult = await pool.query(`
      SELECT p.permission_name, p.module, p.feature, p.action
      FROM user_permissions up
      JOIN permissions p ON up.permission_id = p.id
      JOIN users u ON up.user_id = u.id
      WHERE u.id = $1 
        AND p.module = 'procurement' 
        AND p.feature = 'supplier_management' 
        AND p.action = 'read'
    `, [user.id]);
    
    console.log(`\n🔐 Permission check result:`);
    if (permissionResult.rows.length > 0) {
      console.log('✅ User has procurement.supplier_management.read permission');
      permissionResult.rows.forEach(perm => {
        console.log(`   Module: ${perm.module}, Feature: ${perm.feature}, Action: ${perm.action}`);
      });
    } else {
      console.log('❌ User does NOT have procurement.supplier_management.read permission');
      
      // Show what permissions the user does have
      const allPermsResult = await pool.query(`
        SELECT p.permission_name, p.module, p.feature, p.action
        FROM user_permissions up
        JOIN permissions p ON up.permission_id = p.id
        WHERE up.user_id = $1
        ORDER BY p.module, p.feature, p.action
      `, [user.id]);
      
      console.log(`\n📋 User's current permissions (${allPermsResult.rows.length} total):`);
      allPermsResult.rows.forEach(perm => {
        console.log(`   ${perm.module}.${perm.feature}.${perm.action}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error checking permissions:', error.message);
  } finally {
    await pool.end();
  }
}

testPermissions();
