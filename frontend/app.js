// app.js - GreenFi DApp with Enhanced Features (Ethers v6)
const contractAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const API_URL = "http://localhost:3000/api";

let provider, signer, contract, abi;
let walletAddress = '';
let scene, camera, renderer, particlesMesh, globe;

// ==================== THREE.JS SETUP ====================
function initThreeJS() {
  const canvas = document.getElementById('threejs-canvas');
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a1a0a);
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.z = 5;
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, canvas });
  renderer.setSize(window.innerWidth, window.innerHeight);

  const particlesGeometry = new THREE.BufferGeometry();
  const particlesCount = 1000;
  const posArray = new Float32Array(particlesCount * 3);
  for (let i = 0; i < particlesCount * 3; i++) {
    posArray[i] = (Math.random() - 0.5) * 20;
  }
  particlesGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
  const particlesMaterial = new THREE.PointsMaterial({
    size: 0.02, color: 0x00ff88, transparent: true, opacity: 0.8
  });
  particlesMesh = new THREE.Points(particlesGeometry, particlesMaterial);
  scene.add(particlesMesh);

  const globeGeometry = new THREE.SphereGeometry(1, 32, 32);
  const globeMaterial = new THREE.MeshPhongMaterial({
    color: 0x22ff88, wireframe: true, transparent: true, opacity: 0.3
  });
  globe = new THREE.Mesh(globeGeometry, globeMaterial);
  scene.add(globe);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);
  const pointLight = new THREE.PointLight(0x00ff88, 1);
  pointLight.position.set(5, 5, 5);
  scene.add(pointLight);

  animate();
}

function animate() {
  requestAnimationFrame(animate);
  if (particlesMesh && globe) {
    particlesMesh.rotation.y += 0.001;
    particlesMesh.rotation.x += 0.0005;
    globe.rotation.y += 0.002;
    globe.rotation.x += 0.001;
    const positions = particlesMesh.geometry.attributes.position.array;
    for (let i = 1; i < positions.length; i += 3) {
      positions[i] += Math.sin(Date.now() * 0.001 + i) * 0.001;
    }
    particlesMesh.geometry.attributes.position.needsUpdate = true;
  }
  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  if (camera && renderer) {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
});

// ==================== DATABASE API FUNCTIONS ====================
async function saveProjectToDb(projectData) {
  try {
    const response = await fetch(`${API_URL}/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(projectData)
    });
    return await response.json();
  } catch (error) {
    console.error('Error saving project to DB:', error);
    return { success: false, error: error.message };
  }
}

async function saveStakeToDb(stakeData) {
  try {
    const response = await fetch(`${API_URL}/stakes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(stakeData)
    });
    return await response.json();
  } catch (error) {
    console.error('Error saving stake to DB:', error);
    return { success: false, error: error.message };
  }
}

async function saveWithdrawalToDb(withdrawalData) {
  try {
    const response = await fetch(`${API_URL}/withdrawals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(withdrawalData)
    });
    return await response.json();
  } catch (error) {
    console.error('Error saving withdrawal to DB:', error);
    return { success: false, error: error.message };
  }
}

async function loadAllProjects() {
  try {
    const response = await fetch(`${API_URL}/projects`);
    const data = await response.json();
    return data.success ? data.projects : [];
  } catch (error) {
    console.error('Error loading projects:', error);
    return [];
  }
}

async function loadUserProjects(address) {
  try {
    const response = await fetch(`${API_URL}/projects/owner/${address}`);
    const data = await response.json();
    return data.success ? data.projects : [];
  } catch (error) {
    console.error('Error loading user projects:', error);
    return [];
  }
}

async function loadUserStakes(address) {
  try {
    const response = await fetch(`${API_URL}/stakes/user/${address}`);
    const data = await response.json();
    return data.success ? data.stakes : [];
  } catch (error) {
    console.error('Error loading user stakes:', error);
    return [];
  }
}

async function loadUserWithdrawals(address) {
  try {
    const response = await fetch(`${API_URL}/withdrawals/user/${address}`);
    const data = await response.json();
    return data.success ? data.withdrawals : [];
  } catch (error) {
    console.error('Error loading user withdrawals:', error);
    return [];
  }
}

async function loadStats() {
  try {
    const response = await fetch(`${API_URL}/stats`);
    const data = await response.json();
    return data.success ? data.stats : null;
  } catch (error) {
    console.error('Error loading stats:', error);
    return null;
  }
}

// ==================== UI FUNCTIONS ====================
function showStatus(elementId, message, type = 'info') {
  const statusEl = document.getElementById(elementId);
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.style.display = 'block';
  statusEl.classList.remove('status-success', 'status-error', 'status-info');
  if (type === 'success') statusEl.classList.add('status-success');
  else if (type === 'error') statusEl.classList.add('status-error');
  else statusEl.classList.add('status-info');
  if (type !== 'error') {
    setTimeout(() => { statusEl.style.display = 'none'; }, 8000);
  }
}

function enableUI() {
  const els = ['createProjectButton', 'projectName', 'projectDescription', 'stakeProjectId', 'stakeAmount', 'stakeButton', 'withdrawProjectId', 'withdrawButton'];
  els.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.disabled = false;
  });
}

function disableUI() {
  const els = ['createProjectButton', 'projectName', 'projectDescription', 'stakeProjectId', 'stakeAmount', 'stakeButton', 'withdrawProjectId', 'withdrawButton'];
  els.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.disabled = true;
  });
}

function disconnectWallet() {
  provider = null;
  signer = null;
  contract = null;
  walletAddress = '';
  const walletAddressDiv = document.getElementById('walletAddress');
  const addressText = document.getElementById('addressText');
  if (walletAddressDiv) walletAddressDiv.style.display = 'none';
  if (addressText) addressText.textContent = '';
  const connectButton = document.getElementById('connectButton');
  const disconnectButton = document.getElementById('disconnectButton');
  if (connectButton) connectButton.style.display = 'flex';
  if (disconnectButton) disconnectButton.style.display = 'none';
  disableUI();
  
  // Clear all dynamic content
  document.getElementById('myProjectsList').innerHTML = '<p style="color: #888;">Connect wallet to view your projects</p>';
  document.getElementById('myStakesList').innerHTML = '<p style="color: #888;">Connect wallet to view your investments</p>';
  document.getElementById('myWithdrawalsList').innerHTML = '<p style="color: #888;">Connect wallet to view your withdrawals</p>';
  document.getElementById('dashboardStats').innerHTML = '<p style="color: #888;">Connect wallet to view dashboard</p>';
  
  console.log("✅ Wallet disconnected");
}

function displayProjects(projects, containerId, isOwner = false) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!projects || projects.length === 0) {
    container.innerHTML = '<p style="color: #888;">No projects found</p>';
    return;
  }

  container.innerHTML = projects.map(project => {
    const fundsEth = project.funds ? ethers.formatEther(project.funds) : '0';
    const ownerDisplay = project.owner ? 
      `${project.owner.slice(0, 6)}...${project.owner.slice(-4)}` : 
      'Unknown';
    
    return `
    <div class="project-card">
      <h3>${project.name || `Project #${project.id}`}</h3>
      <p class="project-description">${project.description || 'No description provided'}</p>
      <div class="project-stats">
        <div class="stat">
          <span class="stat-label">Total Raised</span>
          <span class="stat-value">${parseFloat(fundsEth).toFixed(4)} ETH</span>
        </div>
        <div class="stat">
          <span class="stat-label">Backers</span>
          <span class="stat-value">${project.staker_count || 0}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Milestone</span>
          <span class="stat-value">${project.milestone_reached ? '✅' : '⏳'}</span>
        </div>
      </div>
      <div class="project-footer">
        <small>Owner: ${ownerDisplay}</small>
        <small>ID: ${project.id}</small>
        <small>Created: ${new Date(project.created_at).toLocaleDateString()}</small>
      </div>
      ${!isOwner && walletAddress && project.owner && 
        walletAddress.toLowerCase() !== project.owner.toLowerCase() ? 
        `<button class="invest-btn" onclick="investInProject(${project.id})">💰 Invest in Project</button>` : ''}
    </div>`;
  }).join('');
}

function displayStakes(stakes) {
  const container = document.getElementById('myStakesList');
  if (!container) return;

  if (!stakes || stakes.length === 0) {
    container.innerHTML = '<p style="color: #888;">No investments yet</p>';
    return;
  }

  container.innerHTML = stakes.map(stake => {
    const amountEth = stake.amount ? ethers.formatEther(stake.amount) : '0';
    return `
    <div class="stake-card">
      <div class="stake-header">
        <h4>${stake.project_name || `Project #${stake.project_id}`}</h4>
        <span class="stake-badge">Invested</span>
      </div>
      <div class="stake-info">
        <span>💰 Amount: ${parseFloat(amountEth).toFixed(4)} ETH</span>
        <span>📅 ${new Date(stake.created_at).toLocaleDateString()}</span>
      </div>
      <div class="stake-extra">
        <small>TX: ${stake.tx_hash ? stake.tx_hash.slice(0, 10) + '...' : 'N/A'}</small>
        <small>Block: ${stake.block_number || 'N/A'}</small>
      </div>
    </div>`;
  }).join('');
}

function displayWithdrawals(withdrawals) {
  const container = document.getElementById('myWithdrawalsList');
  if (!container) return;

  if (!withdrawals || withdrawals.length === 0) {
    container.innerHTML = '<p style="color: #888;">No withdrawals yet</p>';
    return;
  }

  container.innerHTML = withdrawals.map(withdrawal => {
    const amountEth = withdrawal.amount ? ethers.formatEther(withdrawal.amount) : '0';
    return `
    <div class="withdrawal-card">
      <div class="withdrawal-header">
        <h4>${withdrawal.project_name || `Project #${withdrawal.project_id}`}</h4>
        <span class="withdrawal-badge">Withdrawn</span>
      </div>
      <div class="withdrawal-info">
        <span>💰 Amount: ${parseFloat(amountEth).toFixed(4)} ETH</span>
        <span>📅 ${new Date(withdrawal.created_at).toLocaleDateString()}</span>
      </div>
      <div class="withdrawal-extra">
        <small>TX: ${withdrawal.tx_hash ? withdrawal.tx_hash.slice(0, 10) + '...' : 'N/A'}</small>
        <small>Block: ${withdrawal.block_number || 'N/A'}</small>
      </div>
    </div>`;
  }).join('');
}

function displayDashboardStats(stats, userProjects, userStakes, userWithdrawals) {
  const container = document.getElementById('dashboardStats');
  if (!container || !stats) return;

  // Calculate user-specific stats
  const userTotalProjects = userProjects.length;
  const userTotalInvested = userStakes.reduce((sum, stake) => {
    return sum + parseFloat(ethers.formatEther(stake.amount || '0'));
  }, 0);
  const userTotalWithdrawn = userWithdrawals.reduce((sum, withdrawal) => {
    return sum + parseFloat(ethers.formatEther(withdrawal.amount || '0'));
  }, 0);
  
  const userActiveProjects = userProjects.filter(p => !p.milestone_reached).length;

  container.innerHTML = `
    <div class="dashboard-grid">
      <div class="stat-card green">
        <div class="stat-icon">📊</div>
        <div class="stat-content">
          <h3>${stats.totalProjects || 0}</h3>
          <p>Total Projects</p>
        </div>
      </div>
      <div class="stat-card blue">
        <div class="stat-icon">💰</div>
        <div class="stat-content">
          <h3>${parseFloat(ethers.formatEther(stats.totalFundsRaised || '0')).toFixed(2)} ETH</h3>
          <p>Total Raised</p>
        </div>
      </div>
      <div class="stat-card purple">
        <div class="stat-icon">👥</div>
        <div class="stat-content">
          <h3>${stats.uniqueInvestors || 0}</h3>
          <p>Unique Investors</p>
        </div>
      </div>
      <div class="stat-card orange">
        <div class="stat-icon">📈</div>
        <div class="stat-content">
          <h3>${stats.totalStakes || 0}</h3>
          <p>Total Investments</p>
        </div>
      </div>
    </div>
    
    <div class="user-stats-grid">
      <div class="user-stat-card">
        <h3>Your Portfolio</h3>
        <div class="user-stat-item">
          <span class="stat-label">Your Projects:</span>
          <span class="stat-value">${userTotalProjects}</span>
        </div>
        <div class="user-stat-item">
          <span class="stat-label">Active Projects:</span>
          <span class="stat-value">${userActiveProjects}</span>
        </div>
        <div class="user-stat-item">
          <span class="stat-label">Total Invested:</span>
          <span class="stat-value">${userTotalInvested.toFixed(4)} ETH</span>
        </div>
        <div class="user-stat-item">
          <span class="stat-label">Total Withdrawn:</span>
          <span class="stat-value">${userTotalWithdrawn.toFixed(4)} ETH</span>
        </div>
      </div>
      
      <div class="quick-actions-card">
        <h3>Quick Actions</h3>
        <button class="quick-action-btn" onclick="switchToTab('create')">➕ Create Project</button>
        <button class="quick-action-btn" onclick="switchToTab('stake')">💰 Invest</button>
        <button class="quick-action-btn" onclick="switchToTab('withdraw')">💸 Withdraw</button>
        <button class="quick-action-btn" onclick="refreshAllData()">🔄 Refresh Data</button>
      </div>
    </div>
  `;
}

// Global functions
window.investInProject = function(projectId) {
  const stakeProjectId = document.getElementById('stakeProjectId');
  if (stakeProjectId) {
    stakeProjectId.value = projectId;
    switchToTab('stake');
  }
};

window.switchToTab = function(tabId) {
  document.querySelectorAll('.tabs a').forEach(tab => tab.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
  
  const tab = document.querySelector(`a[href="#${tabId}"]`);
  const content = document.getElementById(tabId);
  
  if (tab) tab.classList.add('active');
  if (content) content.classList.add('active');
  
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.refreshAllData = async function() {
  if (!walletAddress) {
    showStatus('dashboardStatus', 'Please connect wallet first', 'error');
    return;
  }
  
  showStatus('dashboardStatus', '🔄 Refreshing data...', 'info');
  await refreshProjectData();
  showStatus('dashboardStatus', '✅ Data refreshed successfully!', 'success');
  
  setTimeout(() => {
    const statusEl = document.getElementById('dashboardStatus');
    if (statusEl) statusEl.style.display = 'none';
  }, 3000);
};

async function refreshProjectData() {
  if (!walletAddress) return;

  console.log('🔄 Refreshing project data...');
  try {
    const [myProjects, myStakes, myWithdrawals, allProjects, stats] = await Promise.all([
      loadUserProjects(walletAddress),
      loadUserStakes(walletAddress),
      loadUserWithdrawals(walletAddress),
      loadAllProjects(),
      loadStats()
    ]);

    displayProjects(myProjects, 'myProjectsList', true);
    displayStakes(myStakes);
    displayWithdrawals(myWithdrawals);
    
    const otherProjects = allProjects.filter(p => 
      p.owner && p.owner.toLowerCase() !== walletAddress.toLowerCase()
    );
    displayProjects(otherProjects, 'allProjectsList', false);
    
    displayDashboardStats(stats, myProjects, myStakes, myWithdrawals);
    
    console.log('✅ Project data refreshed');
  } catch (error) {
    console.error('Error refreshing project data:', error);
  }
}

// ==================== MAIN ====================
document.addEventListener('DOMContentLoaded', async () => {
  console.log("🚀 GreenFi DApp initializing...");
  
  // Debug: Check if ethers is loaded
  if (typeof ethers === 'undefined') {
    console.error("❌ Ethers.js v6 not loaded!");
    showStatus('createStatus', 'Error: Ethers.js library not loaded. Please refresh.', 'error');
    return;
  }
  
  console.log("✅ Ethers.js v6 loaded, version:", ethers.version);
  
  // Initialize Three.js
  initThreeJS();

  // Load ABI
  try {
    const response = await fetch('abi.json');
    abi = await response.json();
    console.log("✅ ABI loaded successfully");
  } catch (err) {
    console.error("❌ Failed to load ABI:", err);
    showStatus('createStatus', 'Failed to load ABI. Check console.', 'error');
    return;
  }

  // Get DOM elements
  const connectButton = document.getElementById('connectButton');
  const disconnectButton = document.getElementById('disconnectButton');
  const createProjectButton = document.getElementById('createProjectButton');
  const stakeButton = document.getElementById('stakeButton');
  const withdrawButton = document.getElementById('withdrawButton');
  const projectName = document.getElementById('projectName');
  const projectDescription = document.getElementById('projectDescription');
  const stakeProjectId = document.getElementById('stakeProjectId');
  const stakeAmount = document.getElementById('stakeAmount');
  const withdrawProjectId = document.getElementById('withdrawProjectId');
  const walletAddressDiv = document.getElementById('walletAddress');
  const addressText = document.getElementById('addressText');

  // Load all projects and stats on page load
  console.log('📊 Loading initial data...');
  try {
    const [allProjects, stats] = await Promise.all([
      loadAllProjects(),
      loadStats()
    ]);
    displayProjects(allProjects, 'allProjectsList', false);
    
    // Display platform stats in dashboard even when not connected
    if (stats) {
      const dashboardStats = document.getElementById('dashboardStats');
      if (dashboardStats) {
        dashboardStats.innerHTML = `
          <div class="platform-stats">
            <h3>Platform Overview</h3>
            <div class="stats-grid">
              <div class="stat-item">
                <span class="stat-number">${stats.totalProjects || 0}</span>
                <span class="stat-label">Total Projects</span>
              </div>
              <div class="stat-item">
                <span class="stat-number">${parseFloat(ethers.formatEther(stats.totalFundsRaised || '0')).toFixed(1)} ETH</span>
                <span class="stat-label">Total Raised</span>
              </div>
              <div class="stat-item">
                <span class="stat-number">${stats.uniqueInvestors || 0}</span>
                <span class="stat-label">Investors</span>
              </div>
            </div>
            <p class="connect-prompt">Connect your wallet to see your personal dashboard</p>
          </div>
        `;
      }
    }
  } catch (error) {
    console.error('Error loading initial data:', error);
  }

  // ==================== CONNECT WALLET ====================
  connectButton.addEventListener("click", async () => {
    console.log("🔗 Connecting wallet...");
    
    if (typeof window.ethereum === 'undefined') {
      showStatus('createStatus', 'Please install MetaMask!', 'error');
      alert("Please install MetaMask!");
      return;
    }

    try {
      // Request account access
      await window.ethereum.request({ method: "eth_requestAccounts" });
      
      // Create provider and signer (Ethers v6)
      provider = new ethers.BrowserProvider(window.ethereum);
      signer = await provider.getSigner();
      contract = new ethers.Contract(contractAddress, abi, signer);
      
      // Get wallet address
      walletAddress = await signer.getAddress();
      console.log("✅ Wallet connected:", walletAddress);

      // Update UI
      connectButton.style.display = 'none';
      disconnectButton.style.display = 'flex';
      
      if (walletAddressDiv) {
        walletAddressDiv.style.display = 'block';
      }
      
      if (addressText) {
        addressText.textContent = `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;
      }

      enableUI();
      
      // Refresh project data
      await refreshProjectData();
      
      showStatus('createStatus', '✅ Wallet connected successfully!', 'success');
      
      // Auto-switch to dashboard
      setTimeout(() => switchToTab('dashboard'), 500);
    } catch (err) {
      console.error("❌ Failed to connect wallet:", err);
      const errorMsg = err.message || err;
      showStatus('createStatus', 'Failed to connect wallet: ' + errorMsg, 'error');
      alert("Failed to connect wallet: " + errorMsg);
    }
  });

  // ==================== DISCONNECT WALLET ====================
  disconnectButton.addEventListener('click', () => {
    disconnectWallet();
    showStatus('createStatus', 'Wallet disconnected', 'info');
  });

  // ==================== ACCOUNT & CHAIN LISTENERS ====================
  if (window.ethereum) {
    window.ethereum.on("accountsChanged", async (accounts) => {
      console.log("🔄 Account changed:", accounts);
      if (accounts.length === 0) {
        disconnectWallet();
        return;
      }
      
      // Update provider, signer and contract
      if (window.ethereum) {
        try {
          provider = new ethers.BrowserProvider(window.ethereum);
          signer = await provider.getSigner();
          contract = new ethers.Contract(contractAddress, abi, signer);
          walletAddress = accounts[0];
          
          if (addressText) {
            addressText.textContent = `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;
          }
          
          await refreshProjectData();
          showStatus('createStatus', '🔄 Account changed', 'info');
        } catch (error) {
          console.error("Error updating account:", error);
        }
      }
    });

    window.ethereum.on("chainChanged", () => {
      console.log("🔄 Chain changed - reloading");
      location.reload();
    });

    // Try to auto-connect if already authorized
    if (window.ethereum.selectedAddress) {
      console.log("🔄 Auto-connecting to previously connected wallet...");
      setTimeout(() => connectButton.click(), 1000);
    }
  }

  // ==================== CREATE PROJECT ====================
  createProjectButton.addEventListener('click', async () => {
    if (!contract) {
      alert("Connect wallet first");
      return;
    }

    const name = projectName.value.trim();
    const description = projectDescription.value.trim();

    if (!name) {
      alert("Please enter a project name");
      return;
    }

    try {
      showStatus('createStatus', '⏳ Creating project... Please confirm transaction', 'info');
      console.log('📝 Creating project:', name);
      
      // Call smart contract
      const tx = await contract.createProject();
      showStatus('createStatus', `⏳ Transaction sent: ${tx.hash.slice(0, 10)}...`, 'info');
      console.log('Transaction hash:', tx.hash);
      
      // Wait for confirmation (Ethers v6: wait() returns receipt)
      const receipt = await tx.wait();
      console.log('✅ Transaction confirmed', receipt);

      // Extract project ID from event
      let projectIdFromEvent = null;
      if (receipt.logs && receipt.logs.length > 0) {
        for (let i = 0; i < receipt.logs.length; i++) {
          try {
            const parsedLog = contract.interface.parseLog(receipt.logs[i]);
            if (parsedLog && parsedLog.name === "ProjectCreated") {
              projectIdFromEvent = parsedLog.args.projectId;
              console.log('🎉 Project ID from event:', projectIdFromEvent.toString());
              break;
            }
          } catch (e) {
            // Skip logs that can't be parsed
          }
        }
      }

      // Get final project ID
      const projectCount = await contract.projectCount();
      const finalProjectId = projectIdFromEvent ? 
        projectIdFromEvent.toString() : 
        (Number(projectCount) - 1).toString();

      console.log('🎊 FINAL PROJECT ID:', finalProjectId);

      // Save to database
      console.log('💾 Saving to database...');
      const dbResult = await saveProjectToDb({
        id: finalProjectId,
        owner: walletAddress.toLowerCase(),
        name: name,
        description: description,
        funds: '0',
        milestone_reached: false,
        tx_hash: tx.hash,
        block_number: receipt.blockNumber
      });

      if (dbResult.success) {
        console.log('✅ Project saved to database');
      } else {
        console.warn('⚠ Project created but failed to save to DB:', dbResult.error);
      }

      // Update UI
      showStatus('createStatus', `✅ Project created! ID: ${finalProjectId}`, 'success');
      projectName.value = '';
      projectDescription.value = '';
      
      // Auto-fill stake field
      if (stakeProjectId) {
        stakeProjectId.value = finalProjectId;
      }
      
      // Refresh data
      await refreshProjectData();
      console.log('✅ Project creation complete');
      
    } catch (err) {
      console.error("❌ Error creating project:", err);
      const errorMsg = err.reason || err.message || err;
      showStatus('createStatus', "Failed to create project: " + errorMsg, 'error');
      alert("Failed to create project: " + errorMsg);
    }
  });

  // ==================== STAKE ETH ====================
  stakeButton.addEventListener('click', async () => {
    if (!contract) {
      alert("Connect wallet first");
      return;
    }

    const projectId = stakeProjectId.value;
    const amount = stakeAmount.value;

    if (!projectId || !amount) {
      alert("Please enter project ID and amount");
      return;
    }

    if (parseFloat(amount) <= 0) {
      alert("Please enter a positive amount");
      return;
    }

    try {
      showStatus('stakeStatus', '⏳ Staking... Please confirm transaction', 'info');
      console.log('💰 Staking', amount, 'ETH in project', projectId);
      
      // Convert ETH to Wei (Ethers v6)
      const amountWei = ethers.parseEther(amount);
      
      // Call smart contract
      const tx = await contract.stake(projectId, { value: amountWei });
      
      showStatus('stakeStatus', "Staking... Tx: " + tx.hash.slice(0, 10) + "...", 'info');
      console.log('Transaction hash:', tx.hash);
      
      // Wait for confirmation
      const receipt = await tx.wait();
      console.log('✅ Transaction confirmed', receipt);

      // Save to database
      console.log('💾 Saving stake to database...');
      const dbResult = await saveStakeToDb({
        project_id: projectId,
        staker: walletAddress.toLowerCase(),
        amount: amountWei.toString(),
        tx_hash: tx.hash,
        block_number: receipt.blockNumber
      });

      if (dbResult.success) {
        console.log('✅ Stake saved to database');
      } else {
        console.warn('⚠ Stake recorded but failed to save to DB:', dbResult.error);
      }

      showStatus('stakeStatus', "✅ Staked successfully!", 'success');
      stakeAmount.value = '';
      
      await refreshProjectData();
      console.log('✅ Stake complete');
      
    } catch (err) {
      console.error("❌ Stake error:", err);
      const errorMsg = err.reason || err.message || err;
      showStatus('stakeStatus', "Failed to stake: " + errorMsg, 'error');
      alert("Failed to stake: " + errorMsg);
    }
  });

  // ==================== WITHDRAW FUNDS ====================
  withdrawButton.addEventListener('click', async () => {
    if (!contract) {
      alert("Connect wallet first");
      return;
    }

    const projectId = withdrawProjectId.value;
    if (!projectId) {
      alert("Enter project ID");
      return;
    }

    try {
      console.log('🔍 Checking project ownership...');
      
      // Get project info
      const project = await contract.projects(projectId);
      const userAddress = await signer.getAddress();

      console.log('Project owner:', project.owner);
      console.log('User address:', userAddress);

      if (project.owner.toLowerCase() !== userAddress.toLowerCase()) {
        alert("You are not the project owner!");
        return;
      }

      console.log('✅ Ownership verified');

      // Try to mark milestone (optional step)
      let milestoneMarked = false;
      try {
        showStatus('withdrawStatus', '⏳ Marking milestone...', 'info');
        console.log('📝 Marking milestone...');
        const markTx = await contract.markMilestone(projectId);
        await markTx.wait();
        milestoneMarked = true;
        console.log('✅ Milestone marked');
        showStatus('withdrawStatus', '✅ Milestone marked', 'success');
      } catch (err) {
        console.warn("⚠ Could not mark milestone (may already be marked):", err.message);
        // Continue anyway
      }

      // Withdraw funds
      showStatus('withdrawStatus', '⏳ Withdrawing... Please confirm transaction', 'info');
      console.log('💸 Withdrawing funds...');
      
      const tx = await contract.withdraw(projectId);
      showStatus('withdrawStatus', "Withdrawing... Tx: " + tx.hash.slice(0, 10) + "...", 'info');
      console.log('Transaction hash:', tx.hash);
      
      const receipt = await tx.wait();
      console.log('✅ Withdrawal confirmed');
      
      // Save withdrawal to database
      console.log('💾 Saving withdrawal to database...');
      const dbResult = await saveWithdrawalToDb({
        project_id: projectId,
        withdrawer: walletAddress.toLowerCase(),
        amount: project.funds.toString(), // Amount withdrawn
        milestone_marked: milestoneMarked,
        tx_hash: tx.hash,
        block_number: receipt.blockNumber
      });

      if (dbResult.success) {
        console.log('✅ Withdrawal saved to database');
      }

      showStatus('withdrawStatus', "✅ Withdrawal successful!", 'success');
      
      await refreshProjectData();
      console.log('✅ Withdrawal complete');
      
    } catch (err) {
      console.error("❌ Withdraw error:", err);
      const errorMsg = err.reason || err.message || err;
      showStatus('withdrawStatus', "Failed to withdraw: " + errorMsg, 'error');
      alert("Failed to withdraw: " + errorMsg);
    }
  });

  // Initial UI state
  disableUI();
  if (disconnectButton) disconnectButton.style.display = 'none';
  
  console.log("✅ GreenFi DApp ready!");
});