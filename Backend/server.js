// backend/server.js - Backend API for GreenFi DApp (Fixed Wildcard Route)
require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// MySQL Connection Pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'greenfi_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Helper function to check if milestone should be reached - ADDED
async function checkAndUpdateMilestone(projectId) {
  try {
    // Get project details
    const [projects] = await pool.query(
      `SELECT funds, Funding_Goal, milestone_reached FROM projects WHERE id = ?`,
      [projectId]
    );
    
    if (projects.length > 0) {
      const project = projects[0];
      const currentFunds = BigInt(project.funds || '0');
      const fundingGoal = BigInt(project.Funding_Goal || '0');
      const milestoneReached = project.milestone_reached;
      
      // If funds >= funding_goal and milestone not already reached, update it
      if (currentFunds >= fundingGoal && fundingGoal > 0 && !milestoneReached) {
        await pool.query(
          `UPDATE projects SET milestone_reached = TRUE WHERE id = ?`,
          [projectId]
        );
        console.log(`✅ Milestone automatically reached for project ${projectId}!`);
        return true;
      }
    }
    return false;
  } catch (error) {
    console.error('Error checking milestone:', error);
    return false;
  }
}

// Test database connection
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('✅ MySQL connection successful');
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ MySQL connection failed:', error.message);
    console.error('Please check your .env file and MySQL server');
    return false;
  }
}

// Initialize Database
async function initDatabase() {
  try {
    const connection = await pool.getConnection();
    console.log('🔧 Initializing database tables...');
    
    // Create projects table - UPDATED to ensure Funding_Goal column exists
    await connection.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id BIGINT PRIMARY KEY,
        owner VARCHAR(42) NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        funds VARCHAR(100) DEFAULT '0',
        milestone_reached BOOLEAN DEFAULT FALSE,
        tx_hash VARCHAR(66),
        Funding_Goal VARCHAR(100) DEFAULT '0', -- Added DEFAULT value
        block_number BIGINT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_owner (owner),
        INDEX idx_created (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    
    // Check and add Funding_Goal column if it doesn't exist
    try {
      await connection.query('SELECT Funding_Goal FROM projects LIMIT 1');
    } catch (error) {
      console.log('Adding Funding_Goal column to projects table...');
      await connection.query('ALTER TABLE projects ADD COLUMN Funding_Goal VARCHAR(100) DEFAULT "0"');
    }
    
    console.log('✅ Projects table ready');

    // Create stakes table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS stakes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        project_id BIGINT NOT NULL,
        staker VARCHAR(42) NOT NULL,
        amount VARCHAR(100) NOT NULL,
        tx_hash VARCHAR(66),
        block_number BIGINT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_project (project_id),
        INDEX idx_staker (staker),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log('✅ Stakes table ready');

    // Create withdrawals table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS withdrawals (
        id INT AUTO_INCREMENT PRIMARY KEY,
        project_id BIGINT NOT NULL,
        withdrawer VARCHAR(42) NOT NULL,
        amount VARCHAR(100) NOT NULL,
        milestone_marked BOOLEAN DEFAULT FALSE,
        tx_hash VARCHAR(66),
        block_number BIGINT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_withdrawer (withdrawer),
        INDEX idx_project (project_id),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log('✅ Withdrawals table ready');

    connection.release();
    console.log('✅ Database initialized successfully');
  } catch (error) {
    console.error('❌ Database initialization error:', error.message);
    console.error('Please check your MySQL connection settings in .env file');
  }
}

// ==================== API ENDPOINTS ====================

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'GreenFi API is running',
    timestamp: new Date().toISOString()
  });
});

// NEW: Check milestone status for a project
app.get('/api/check-milestone/:projectId', async (req, res) => {
  try {
    const projectId = req.params.projectId;
    
    // Run the automatic milestone check
    await checkAndUpdateMilestone(projectId);
    
    // Get the updated project status
    const [projects] = await pool.query(
      `SELECT milestone_reached, funds, Funding_Goal FROM projects WHERE id = ?`,
      [projectId]
    );
    
    if (projects.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Project not found' 
      });
    }
    
    const project = projects[0];
    const currentFunds = BigInt(project.funds || '0');
    const fundingGoal = BigInt(project.Funding_Goal || '0');
    const progress = fundingGoal > 0 ? Number(currentFunds) / Number(fundingGoal) : 0;
    
    res.json({ 
      success: true,
      milestone_reached: project.milestone_reached,
      current_funds: currentFunds.toString(),
      funding_goal: fundingGoal.toString(),
      progress: Math.min(progress * 100, 100)
    });
    
  } catch (error) {
    console.error('Error checking milestone:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// Create or update project - UPDATED to include Funding_Goal
app.post('/api/projects', async (req, res) => {
  try {
    const { id, owner, name, description, funds, milestone_reached, tx_hash, block_number, funding_goal } = req.body;

    // Validation
    if (id === undefined || !owner || !name) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: id, owner, name' 
      });
    }

    console.log('📝 Saving project:', { 
      id, 
      owner: owner.slice(0, 6) + '...', 
      name,
      funding_goal: funding_goal || '0'
    });

    const [result] = await pool.query(
      `INSERT INTO projects 
        (id, owner, name, description, funds, milestone_reached, tx_hash, block_number, funding_goal)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         funds = VALUES(funds),
         milestone_reached = VALUES(milestone_reached),
         funding_goal = VALUES(funding_goal),
         updated_at = CURRENT_TIMESTAMP`,
      [
        id, 
        owner.toLowerCase(), 
        name, 
        description || '', 
        funds || '0', 
        milestone_reached ? 1 : 0, // store boolean as 1/0
        tx_hash || null, 
        block_number || null,
        funding_goal || '0'
      ]
    );

    // Optionally check/update milestone after saving project
    await checkAndUpdateMilestone(id);

    console.log('✅ Project saved successfully');
    res.json({ 
      success: true, 
      message: 'Project saved successfully',
      projectId: id
    });
  } catch (error) {
    console.error('❌ Error saving project:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all projects with aggregated data - UPDATED to include Funding_Goal
app.get('/api/projects', async (req, res) => {
  try {
    const [projects] = await pool.query(
      `SELECT p.*, 
              COALESCE(SUM(CAST(s.amount AS DECIMAL(65,0))), 0) as total_staked,
              COUNT(DISTINCT s.staker) as staker_count,
              COUNT(DISTINCT w.id) as withdrawal_count,
              COALESCE(SUM(CAST(w.amount AS DECIMAL(65,0))), 0) as total_withdrawn
       FROM projects p
       LEFT JOIN stakes s ON p.id = s.project_id
       LEFT JOIN withdrawals w ON p.id = w.project_id
       GROUP BY p.id
       ORDER BY p.created_at DESC`
    );

    console.log(`📊 Fetched ${projects.length} projects`);
    res.json({ success: true, projects });
  } catch (error) {
    console.error('❌ Error fetching projects:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get projects by owner
app.get('/api/projects/owner/:address', async (req, res) => {
  try {
    const { address } = req.params;
    
    const [projects] = await pool.query(
      `SELECT p.*, 
              COALESCE(SUM(CAST(s.amount AS DECIMAL(65,0))), 0) as total_staked,
              COUNT(DISTINCT s.staker) as staker_count,
              COUNT(DISTINCT w.id) as withdrawal_count,
              COALESCE(SUM(CAST(w.amount AS DECIMAL(65,0))), 0) as total_withdrawn
       FROM projects p
       LEFT JOIN stakes s ON p.id = s.project_id
       LEFT JOIN withdrawals w ON p.id = w.project_id
       WHERE LOWER(p.owner) = LOWER(?)
       GROUP BY p.id
       ORDER BY p.created_at DESC`,
      [address]
    );

    console.log(`📊 Fetched ${projects.length} projects for owner ${address.slice(0, 6)}...`);
    res.json({ success: true, projects });
  } catch (error) {
    console.error('❌ Error fetching user projects:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single project
app.get('/api/projects/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const [projects] = await pool.query(
      `SELECT p.*, 
              COALESCE(SUM(CAST(s.amount AS DECIMAL(65,0))), 0) as total_staked,
              COUNT(DISTINCT s.staker) as staker_count,
              COUNT(DISTINCT w.id) as withdrawal_count,
              COALESCE(SUM(CAST(w.amount AS DECIMAL(65,0))), 0) as total_withdrawn
       FROM projects p
       LEFT JOIN stakes s ON p.id = s.project_id
       LEFT JOIN withdrawals w ON p.id = w.project_id
       WHERE p.id = ?
       GROUP BY p.id`,
      [id]
    );

    if (projects.length === 0) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    console.log(`📊 Fetched project #${id}`);
    res.json({ success: true, project: projects[0] });
  } catch (error) {
    console.error('❌ Error fetching project:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Record stake - UPDATED to check milestone automatically
app.post('/api/stakes', async (req, res) => {
  try {
    console.log(req.body);
    const { project_id, staker, amount, tx_hash, block_number } = req.body;
    
    // Validation
    if (project_id === undefined || project_id === null ||
    !staker ||
    !amount) {

  return res.status(400).json({
    success: false,
    error: 'Missing required fields: project_id, staker, amount'
  });
}
    console.log('💰 Recording stake:', { 
      project_id, 
      staker: staker.slice(0, 6) + '...', 
      amount 
    });

    // Check if project exists
    const [projects] = await pool.query('SELECT id FROM projects WHERE id = ?', [project_id]);
    if (projects.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Project not found' 
      });
    }

    // Insert stake
    await pool.query(
      `INSERT INTO stakes (project_id, staker, amount, tx_hash, block_number)
       VALUES (?, ?, ?, ?, ?)`,
      [project_id, staker.toLowerCase(), amount, tx_hash, block_number]
    );

    // Update project funds
    await pool.query(
      `UPDATE projects 
       SET funds = (SELECT COALESCE(SUM(CAST(amount AS DECIMAL(65,0))), 0) FROM stakes WHERE project_id = ?)
       WHERE id = ?`,
      [project_id, project_id]
    );

    // NEW: Check and update milestone after stake
    await checkAndUpdateMilestone(project_id);

    console.log('✅ Stake recorded successfully');
    res.json({ success: true, message: 'Stake recorded successfully' });
  } catch (error) {
    console.error('❌ Error recording stake:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get stakes for a project
app.get('/api/stakes/project/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const [stakes] = await pool.query(
      `SELECT * FROM stakes 
       WHERE project_id = ? 
       ORDER BY created_at DESC`,
      [id]
    );

    console.log(`💰 Fetched ${stakes.length} stakes for project #${id}`);
    res.json({ success: true, stakes });
  } catch (error) {
    console.error('❌ Error fetching stakes:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get stakes by user - UPDATED to include funding_goal
app.get('/api/stakes/user/:address', async (req, res) => {
  try {
    const { address } = req.params;
    
    const [stakes] = await pool.query(
      `SELECT s.*, p.name as project_name, p.owner as project_owner,
              p.milestone_reached as project_milestone_reached,
              p.Funding_Goal as project_funding_goal
       FROM stakes s
       JOIN projects p ON s.project_id = p.id
       WHERE LOWER(s.staker) = LOWER(?)
       ORDER BY s.created_at DESC`,
      [address]
    );

    console.log(`💰 Fetched ${stakes.length} stakes for user ${address.slice(0, 6)}...`);
    res.json({ success: true, stakes });
  } catch (error) {
    console.error('❌ Error fetching user stakes:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Record withdrawal
app.post('/api/withdrawals', async (req, res) => {
  try {
    const { project_id, withdrawer, amount,milestone, tx_hash, block_number } = req.body;

    // Validation
    if (project_id==undefined || withdrawer==undefined || amount==undefined) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: project_id, withdrawer, amount' 
      });
    }

    console.log('💸 Recording withdrawal:', { 
      project_id, 
      withdrawer: withdrawer.slice(0, 6) + '...', 
      amount 
    });

    // Check if project exists
    const [projects] = await pool.query('SELECT id FROM projects WHERE id = ?', [project_id]);
    if (projects.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Project not found' 
      });
    }
    if (milestone) {
      await pool.query(
        'UPDATE projects SET milestone_reached = TRUE WHERE id = ?',
        [project_id]
      );
    }
    // Insert withdrawal
    await pool.query(
      `INSERT INTO withdrawals (project_id, withdrawer, amount, milestone_marked, tx_hash, block_number)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [project_id, withdrawer.toLowerCase(), amount, milestone || false, tx_hash, block_number]
    );

    // Update project milestone status if marked
    

    console.log('✅ Withdrawal recorded successfully');
    res.json({ success: true, message: 'Withdrawal recorded successfully' });
  } catch (error) {
    console.error('❌ Error recording withdrawal:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get withdrawals by user
app.get('/api/withdrawals/user/:address', async (req, res) => {
  try {
    const { address } = req.params;
    
    const [withdrawals] = await pool.query(
      `SELECT w.*, p.name as project_name, p.owner as project_owner
       FROM withdrawals w
       JOIN projects p ON w.project_id = p.id
       WHERE LOWER(w.withdrawer) = LOWER(?)
       ORDER BY w.created_at DESC`,
      [address]
    );

    console.log(`💸 Fetched ${withdrawals.length} withdrawals for user ${address.slice(0, 6)}...`);
    res.json({ success: true, withdrawals });
  } catch (error) {
    console.error('❌ Error fetching user withdrawals:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get withdrawals for a project
app.get('/api/withdrawals/project/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const [withdrawals] = await pool.query(
      `SELECT * FROM withdrawals 
       WHERE project_id = ? 
       ORDER BY created_at DESC`,
      [id]
    );

    console.log(`💸 Fetched ${withdrawals.length} withdrawals for project #${id}`);
    res.json({ success: true, withdrawals });
  } catch (error) {
    console.error('❌ Error fetching project withdrawals:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get comprehensive statistics - UPDATED with funding goal stats
app.get('/api/stats', async (req, res) => {
  try {
    // Get basic stats
    const [projectCount] = await pool.query('SELECT COUNT(*) as count FROM projects');
    const [stakeCount] = await pool.query('SELECT COUNT(*) as count FROM stakes');
    const [totalFunds] = await pool.query(
      'SELECT COALESCE(SUM(CAST(amount AS DECIMAL(65,0))), 0) as total FROM stakes'
    );
    const [uniqueStakers] = await pool.query('SELECT COUNT(DISTINCT staker) as count FROM stakes');
    const [withdrawalCount] = await pool.query('SELECT COUNT(*) as count FROM withdrawals');
    const [totalWithdrawn] = await pool.query(
      'SELECT COALESCE(SUM(CAST(amount AS DECIMAL(65,0))), 0) as total FROM withdrawals'
    );
    
    // Get active projects (not milestone reached)
    const [activeProjects] = await pool.query(
      'SELECT COUNT(*) as count FROM projects WHERE milestone_reached = FALSE'
    );
    
    // Get completed projects (milestone reached)
    const [completedProjects] = await pool.query(
      'SELECT COUNT(*) as count FROM projects WHERE milestone_reached = TRUE'
    );

    // Get total funding goal
    const [totalGoal] = await pool.query(
      'SELECT COALESCE(SUM(CAST(Funding_Goal AS DECIMAL(65,0))), 0) as total FROM projects'
    );

    res.json({
      success: true,
      stats: {
        totalProjects: projectCount[0].count,
        activeProjects: activeProjects[0].count,
        completedProjects: completedProjects[0].count,
        totalStakes: stakeCount[0].count,
        totalFundsRaised: totalFunds[0].total,
        totalFundingGoal: totalGoal[0].total,
        fundingProgress: totalGoal[0].total > 0 ? 
          (Number(BigInt(totalFunds[0].total || 0)) / Number(BigInt(totalGoal[0].total || 1)) * 100).toFixed(2) : 0,
        totalWithdrawals: withdrawalCount[0].count,
        totalWithdrawn: totalWithdrawn[0].total,
        netFunds: (BigInt(totalFunds[0].total || 0) - BigInt(totalWithdrawn[0].total || 0)).toString(),
        uniqueInvestors: uniqueStakers[0].count,
        avgInvestment: stakeCount[0].count > 0 ? 
          (BigInt(totalFunds[0].total || 0) / BigInt(stakeCount[0].count)).toString() : '0'
      }
    });
  } catch (error) {
    console.error('❌ Error fetching stats:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get user statistics
app.get('/api/stats/user/:address', async (req, res) => {
  try {
    const { address } = req.params;
    
    // Get user projects
    const [userProjects] = await pool.query(
      'SELECT COUNT(*) as count FROM projects WHERE LOWER(owner) = LOWER(?)',
      [address]
    );
    
    // Get user stakes
    const [userStakes] = await pool.query(
      'SELECT COUNT(*) as count, COALESCE(SUM(CAST(amount AS DECIMAL(65,0))), 0) as total FROM stakes WHERE LOWER(staker) = LOWER(?)',
      [address]
    );
    
    // Get user withdrawals
    const [userWithdrawals] = await pool.query(
      'SELECT COUNT(*) as count, COALESCE(SUM(CAST(amount AS DECIMAL(65,0))), 0) as total FROM withdrawals WHERE LOWER(withdrawer) = LOWER(?)',
      [address]
    );
    
    // Get user active projects
    const [activeProjects] = await pool.query(
      'SELECT COUNT(*) as count FROM projects WHERE LOWER(owner) = LOWER(?) AND milestone_reached = FALSE',
      [address]
    );

    res.json({
      success: true,
      stats: {
        userProjects: userProjects[0].count,
        activeProjects: activeProjects[0].count,
        totalInvestments: userStakes[0].count,
        totalInvested: userStakes[0].total,
        totalWithdrawals: userWithdrawals[0].count,
        totalWithdrawn: userWithdrawals[0].total,
        netContribution: (BigInt(userStakes[0].total || 0) - BigInt(userWithdrawals[0].total || 0)).toString()
      }
    });
  } catch (error) {
    console.error('❌ Error fetching user stats:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Search projects
app.get('/api/projects/search/:query', async (req, res) => {
  try {
    const { query } = req.params;
    const searchTerm = `%${query}%`;
    
    const [projects] = await pool.query(
      `SELECT p.*, 
              COALESCE(SUM(CAST(s.amount AS DECIMAL(65,0))), 0) as total_staked,
              COUNT(DISTINCT s.staker) as staker_count
       FROM projects p
       LEFT JOIN stakes s ON p.id = s.project_id
       WHERE p.name LIKE ? OR p.description LIKE ? OR p.owner LIKE ?
       GROUP BY p.id
       ORDER BY p.created_at DESC`,
      [searchTerm, searchTerm, searchTerm]
    );

    console.log(`🔍 Found ${projects.length} projects for search: "${query}"`);
    res.json({ success: true, projects });
  } catch (error) {
    console.error('❌ Error searching projects:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get recent activity
app.get('/api/activity/recent', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    
    // Get recent stakes
    const [recentStakes] = await pool.query(
      `SELECT s.*, p.name as project_name, 
              'stake' as activity_type,
              CONCAT('Staked ', FORMAT(CAST(s.amount AS DECIMAL(65,0)) / 1e18, 4), ' ETH') as description
       FROM stakes s
       JOIN projects p ON s.project_id = p.id
       ORDER BY s.created_at DESC
       LIMIT ?`,
      [limit]
    );
    
    // Get recent withdrawals
    const [recentWithdrawals] = await pool.query(
      `SELECT w.*, p.name as project_name,
              'withdrawal' as activity_type,
              CONCAT('Withdrew ', FORMAT(CAST(w.amount AS DECIMAL(65,0)) / 1e18, 4), ' ETH') as description
       FROM withdrawals w
       JOIN projects p ON w.project_id = p.id
       ORDER BY w.created_at DESC
       LIMIT ?`,
      [limit]
    );
    
    // Get recent projects
    const [recentProjects] = await pool.query(
      `SELECT p.*, 'project_created' as activity_type,
              CONCAT('Created project: ', p.name) as description
       FROM projects p
       ORDER BY p.created_at DESC
       LIMIT ?`,
      [limit]
    );
    
    // Combine and sort by timestamp
    const allActivities = [
      ...recentStakes.map(s => ({ ...s, timestamp: s.created_at })),
      ...recentWithdrawals.map(w => ({ ...w, timestamp: w.created_at })),
      ...recentProjects.map(p => ({ ...p, timestamp: p.created_at }))
    ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, limit);

    console.log(`📈 Fetched ${allActivities.length} recent activities`);
    res.json({ success: true, activities: allActivities });
  } catch (error) {
    console.error('❌ Error fetching recent activity:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== SPA ROUTE HANDLING ====================
// Handle all non-API routes by serving the frontend
// This must be after all API routes

// Define a function to check if request is for an API endpoint
function isApiRequest(req) {
  return req.path.startsWith('/api');
}

// Middleware to handle SPA routing
app.use((req, res, next) => {
  // If it's an API request, continue to error handlers
  if (isApiRequest(req)) {
    return next();
  }
  
  // Otherwise, serve the frontend for SPA routing
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// API 404 handler
app.use('/api', (req, res) => {
  res.status(404).json({ 
    success: false, 
    error: 'API endpoint not found' 
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('💥 Unhandled error:', err);
  res.status(500).json({ 
    success: false, 
    error: 'Internal server error' 
  });
});

// Start server
async function startServer() {
  console.log('🌿 ================================');
  console.log('🌿 GreenFi Backend Server');
  console.log('🌿 ================================');
  
  // Test database connection first
  const connected = await testConnection();
  if (!connected) {
    console.error('❌ Cannot start server without database connection');
    console.error('Please check your .env file and ensure MySQL is running');
    process.exit(1);
  }

  // Initialize database tables
  await initDatabase();

  // Start Express server
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📁 Serving frontend from: ${path.join(__dirname, '../frontend')}`);
    console.log(`🗄️  Database: ${process.env.DB_NAME || 'greenfi_db'}`);
    console.log('✅ Server ready!');
    console.log('🌿 ================================');
    console.log('');
    console.log('📍 Available endpoints:');
    console.log('   GET  /api/health');
    console.log('   GET  /api/check-milestone/:projectId'); // NEW ENDPOINT
    console.log('   GET  /api/projects');
    console.log('   POST /api/projects');
    console.log('   GET  /api/projects/:id');
    console.log('   GET  /api/projects/owner/:address');
    console.log('   GET  /api/projects/search/:query');
    console.log('   POST /api/stakes');
    console.log('   GET  /api/stakes/project/:id');
    console.log('   GET  /api/stakes/user/:address');
    console.log('   POST /api/withdrawals');
    console.log('   GET  /api/withdrawals/user/:address');
    console.log('   GET  /api/withdrawals/project/:id');
    console.log('   GET  /api/stats');
    console.log('   GET  /api/stats/user/:address');
    console.log('   GET  /api/activity/recent');
    console.log('');
  });
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  await pool.end();
  console.log('✅ Database connections closed');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  await pool.end();
  console.log('✅ Database connections closed');
  process.exit(0);
});

// Start the server
startServer().catch(error => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});