// dashboard.js - Main Dashboard Logic (FULLY CORRECTED)
const API_URL = 'http://localhost:3000/api';
const CONTRACT_ADDRESS = '0x5FbDB2315678afecb367f032d93F642f64180aa3';

let provider, signer, contract, abi;
let walletAddress = '';
let currentProjects = [];
let currentInvestingProject = null;

// Three.js Background
function initThreeJS() {
    const canvas = document.getElementById('threejs-canvas');
    if (!canvas) {
        console.warn('Three.js canvas not found');
        return;
    }
    
    try {
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x0a1a0a);
        
        const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.z = 5;
        
        const renderer = new THREE.WebGLRenderer({ 
            antialias: true, 
            alpha: true, 
            canvas: canvas 
        });
        renderer.setSize(window.innerWidth, window.innerHeight);
        
        // Particles
        const particlesGeometry = new THREE.BufferGeometry();
        const particlesCount = 800;
        const posArray = new Float32Array(particlesCount * 3);
        
        for (let i = 0; i < particlesCount * 3; i++) {
            posArray[i] = (Math.random() - 0.5) * 20;
        }
        
        particlesGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
        
        const particlesMaterial = new THREE.PointsMaterial({
            size: 0.02,
            color: 0x00ff88,
            transparent: true,
            opacity: 0.6
        });
        
        const particlesMesh = new THREE.Points(particlesGeometry, particlesMaterial);
        scene.add(particlesMesh);
        
        // Animate
        function animate() {
            requestAnimationFrame(animate);
            
            particlesMesh.rotation.y += 0.001;
            particlesMesh.rotation.x += 0.0005;
            
            renderer.render(scene, camera);
        }
        
        animate();
        
        window.addEventListener('resize', () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        });
    } catch (error) {
        console.error('Three.js initialization error:', error);
    }
}

// Load ABI
async function loadABI() {
    try {
        const response = await fetch('abi.json');
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Failed to load ABI:', error);
        showStatus('Failed to load contract ABI. Please refresh the page.', 'error');
        return null;
    }
}

// Initialize Wallet
async function initializeWallet() {
    try {
        // Check if wallet is connected
        const savedAddress = localStorage.getItem('greenfi_wallet_address');
        if (!savedAddress || !window.ethereum) {
            window.location.href = 'index.html';
            return;
        }

        // Setup provider and signer
        provider = new ethers.BrowserProvider(window.ethereum);
        signer = await provider.getSigner();
        walletAddress = await signer.getAddress();

        // Verify address matches
        if (walletAddress.toLowerCase() !== savedAddress.toLowerCase()) {
            localStorage.removeItem('greenfi_wallet_address');
            window.location.href = 'index.html';
            return;
        }

        // Update UI
        document.getElementById('connectedAddress').textContent = 
            `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;

        // Load ABI and contract
        abi = await loadABI();
        if (!abi) {
            showStatus('Failed to load contract ABI', 'error');
            return;
        }

        contract = new ethers.Contract(CONTRACT_ADDRESS, abi, signer);

        // Load wallet balance
        await loadWalletBalance();

        // Load initial data
        await refreshAllData();

    } catch (error) {
        console.error('Wallet initialization error:', error);
        showStatus(`Wallet error: ${error.message}`, 'error');
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 3000);
    }
}

// Load wallet balance
async function loadWalletBalance() {
    try {
        const balance = await provider.getBalance(walletAddress);
        const ethBalance = ethers.formatEther(balance);
        document.getElementById('walletBalance').textContent = 
            `Balance: ${parseFloat(ethBalance).toFixed(4)} ETH`;
    } catch (error) {
        console.error('Error loading balance:', error);
        document.getElementById('walletBalance').textContent = 'Balance: Error';
    }
}

// Load dashboard stats
async function loadDashboardStats() {
    try {
        const response = await fetch(`${API_URL}/stats`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        
        if (data.success) {
            const stats = data.stats;
            const statsHTML = `
                <div class="stat-card">
                    <div class="stat-icon">🌍</div>
                    <div class="stat-value">${stats.totalProjects || 0}</div>
                    <div class="stat-label">Total Projects</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">💰</div>
                    <div class="stat-value">${parseFloat(ethers.formatEther(stats.totalFundsRaised || '0')).toFixed(1)}</div>
                    <div class="stat-label">ETH Raised</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">👥</div>
                    <div class="stat-value">${stats.uniqueInvestors || 0}</div>
                    <div class="stat-label">Investors</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">📈</div>
                    <div class="stat-value">${stats.totalStakes || 0}</div>
                    <div class="stat-label">Investments</div>
            </div>
        `;
        document.getElementById('dashboardStats').innerHTML = statsHTML;
        }
    } catch (error) {
        console.error('Error loading stats:', error);
        document.getElementById('dashboardStats').innerHTML = `
            <div class="stat-card">
                <div class="stat-icon">⚠️</div>
                <div class="stat-value">Error</div>
                <div class="stat-label">Failed to load</div>
            </div>
        `;
    }
}

// Load all projects
async function loadAllProjects() {
    try {
        const response = await fetch(`${API_URL}/projects`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        
        if (data.success) {
            currentProjects = data.projects;
            displayProjects(data.projects, 'allProjectsList', false);
        }
    } catch (error) {
        console.error('Error loading projects:', error);
        document.getElementById('allProjectsList').innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">⚠️</div>
                <p>Failed to load projects. Please try again.</p>
            </div>
        `;
    }
}

// Load user projects
async function loadUserProjects() {
    try {
        const response = await fetch(`${API_URL}/projects/owner/${walletAddress}`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        
        if (data.success && data.projects.length > 0) {
            displayProjects(data.projects, 'myProjectsList', true);
        } else {
            document.getElementById('myProjectsList').innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🏗️</div>
                    <p>You haven't created any projects yet.</p>
                    <p style="margin-top: 10px;">Create your first sustainable project!</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading user projects:', error);
        document.getElementById('myProjectsList').innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">⚠️</div>
                <p>Failed to load your projects.</p>
            </div>
        `;
    }
}

// Load user investments
async function loadUserInvestments() {
    try {
        const response = await fetch(`${API_URL}/stakes/user/${walletAddress}`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        
        if (data.success && data.stakes.length > 0) {
            displayInvestments(data.stakes);
        } else {
            document.getElementById('myInvestmentsList').innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">💰</div>
                    <p>You haven't invested in any projects yet.</p>
                    <p style="margin-top: 10px;">Browse projects and make your first investment!</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading investments:', error);
        document.getElementById('myInvestmentsList').innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">⚠️</div>
                <p>Failed to load investments.</p>
            </div>
        `;
    }
}

// Display projects
function displayProjects(projects, containerId, isOwner = false) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.warn(`Container ${containerId} not found`);
        return;
    }

    if (!projects || projects.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📭</div>
                <p>No projects found</p>
            </div>
        `;
        return;
    }

    const projectsHTML = projects.map(project => {
        const fundsEth = project.funds ? parseFloat(ethers.formatEther(project.funds)).toFixed(4) : '0';
        const ownerDisplay = project.owner ? 
            `${project.owner.slice(0, 6)}...${project.owner.slice(-4)}` : 'Unknown';
        
        const isProjectOwner = walletAddress && project.owner && 
            walletAddress.toLowerCase() === project.owner.toLowerCase();
        
        // Check if investment button should be shown
        const showInvestButton = !isProjectOwner;
        
        return `
            <div class="project-card" data-project-id="${project.id}">
                <div class="project-header">
                    <div>
                        <h3 class="project-title">${project.name || `Project #${project.id}`}</h3>
                        <div style="color: #88ffcc; font-size: 0.9em;">
                            ${project.description ? project.description.substring(0, 100) + '...' : 'No description'}
                        </div>
                    </div>
                    <div class="project-id">#${project.id}</div>
                </div>
                
                <div class="project-stats">
                    <div class="project-stat">
                        <span class="project-stat-value">${fundsEth} ETH</span>
                        <span class="project-stat-label">Raised</span>
                    </div>
                    <div class="project-stat">
                        <span class="project-stat-value">${project.staker_count || 0}</span>
                        <span class="project-stat-label">Backers</span>
                    </div>
                    <div class="project-stat">
                        <span class="project-stat-value">${project.milestone_reached ? '✅' : '⏳'}</span>
                        <span class="project-stat-label">Milestone</span>
                    </div>
                </div>
                
                <div class="project-footer">
                    <div class="project-owner">
                        Owner: ${ownerDisplay}
                        ${isProjectOwner ? ' (You)' : ''}
                    </div>
                    <div class="project-actions">
                        ${showInvestButton ? 
                            `<button class="action-btn invest-btn" onclick="openInvestmentModal(${project.id})">
                                💰 Invest
                            </button>` : ''
                        }
                        <button class="action-btn view-btn" onclick="viewProjectDetails(${project.id})">
                            👁️ View
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = projectsHTML;
}

// Display investments
function displayInvestments(stakes) {
    const container = document.getElementById('myInvestmentsList');
    if (!container) {
        console.warn('Investments container not found');
        return;
    }

    const investmentsHTML = stakes.map(stake => {
        const amountEth = stake.amount ? parseFloat(ethers.formatEther(stake.amount)).toFixed(4) : '0';
        
        return `
            <div class="project-card">
                <div class="project-header">
                    <div>
                        <h3 class="project-title">${stake.project_name || `Project #${stake.project_id}`}</h3>
                    </div>
                    <div class="project-id">Investment</div>
                </div>
                
                <div class="project-stats">
                    <div class="project-stat">
                        <span class="project-stat-value">${amountEth} ETH</span>
                        <span class="project-stat-label">Amount</span>
                    </div>
                    <div class="project-stat">
                        <span class="project-stat-value">${new Date(stake.created_at).toLocaleDateString()}</span>
                        <span class="project-stat-label">Date</span>
                    </div>
                    <div class="project-stat">
                        <span class="project-stat-value">${stake.project_milestone_reached ? '✅' : '⏳'}</span>
                        <span class="project-stat-label">Status</span>
                    </div>
                </div>
                
                <div class="project-footer">
                    <div style="color: #88ffcc; font-size: 0.9em;">
                        TX: ${stake.tx_hash ? stake.tx_hash.slice(0, 10) + '...' : 'N/A'}
                    </div>
                    <button class="action-btn view-btn" onclick="viewProjectDetails(${stake.project_id})">
                        👁️ View Project
                    </button>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = investmentsHTML;
}

// Search projects
function setupSearch() {
    const searchInput = document.getElementById('projectSearch');
    if (!searchInput) {
        console.warn('Search input not found');
        return;
    }

    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        
        if (!searchTerm) {
            displayProjects(currentProjects, 'allProjectsList', false);
            return;
        }

        const filteredProjects = currentProjects.filter(project => {
            return (
                (project.name && project.name.toLowerCase().includes(searchTerm)) ||
                (project.description && project.description.toLowerCase().includes(searchTerm)) ||
                (project.owner && project.owner.toLowerCase().includes(searchTerm)) ||
                project.id.toString().includes(searchTerm)
            );
        });

        displayProjects(filteredProjects, 'allProjectsList', false);
    });
}

// Tab switching
function setupTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    if (tabButtons.length === 0 || tabContents.length === 0) {
        console.warn('Tabs not found in DOM');
        return;
    }

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.getAttribute('data-tab');
            
            // Update active button
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            // Show selected tab
            tabContents.forEach(content => {
                content.classList.remove('active');
                if (content.id === tabId) {
                    content.classList.add('active');
                }
            });
            
            // Load data for specific tabs
            if (tabId === 'my-projects') {
                loadUserProjects();
            } else if (tabId === 'my-investments') {
                loadUserInvestments();
            }
        });
    });
}

// Create project
async function setupCreateProject() {
    const createBtn = document.getElementById('createProjectBtn');
    if (!createBtn) {
        console.warn('Create project button not found');
        return;
    }

    createBtn.addEventListener('click', async () => {
        const name = document.getElementById('projectName').value.trim();
        const description = document.getElementById('projectDescription').value.trim();

        if (!name || !description) {
            showStatus('Please enter project name and description', 'error', 'createStatus');
            return;
        }

        if (!contract) {
            showStatus('Wallet not connected', 'error', 'createStatus');
            return;
        }

        try {
            createBtn.disabled = true;
            createBtn.textContent = 'Creating...';
            showStatus('Creating project... Please confirm in MetaMask', 'info', 'createStatus');

            // Send transaction to smart contract
            const tx = await contract.createProject();
            console.log('TX Hash:', tx.hash);
            showStatus(`Transaction sent: ${tx.hash.slice(0,10)}...`, 'info', 'createStatus');

            const receipt = await tx.wait();
            console.log('TX Confirmed:', receipt);

            // 🔥 Extract projectId from event (MOST RELIABLE)
            let projectId = null;
            for (const event of receipt.logs) {
                try {
                    const parsed = contract.interface.parseLog(event);
                    if (parsed.name === "ProjectCreated") {
                        projectId = Number(parsed.args.projectId);
                        break;
                    }
                } catch {}
            }

            // Fallback: use projectCount() if event not found
            if (projectId === null) {
                const count = await contract.projectCount();
                projectId = Number(count) - 1;
            }

            console.log("🔥 Final projectId:", projectId);

            if (isNaN(projectId)) {
                throw new Error("Could not determine project ID from blockchain");
            }

            // SAVE PROJECT IN DATABASE
            const projectData = {
                id: projectId,                 // 💥 MUST match blockchain ID
                owner: walletAddress.toLowerCase(),
                name: name,
                description: description,
                funds: "0",
                goal:document.getElementById('projectGoal').value.trim(),
                milestone_reached: false,
                tx_hash: tx.hash,
                block_number: receipt.blockNumber
            };

            console.log("Saving to backend:", projectData);

            const saveResponse = await fetch(`${API_URL}/projects`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(projectData)
            });

            const responseJson = await saveResponse.json();
            console.log("Backend responded:", responseJson);

            if (!saveResponse.ok || !responseJson.success) {
                throw new Error(responseJson.error || "Failed to save project to DB");
            }

            showStatus(`✅ Project created successfully! ID: ${projectId}`, 'success', 'createStatus');

            // Clear form
            document.getElementById('projectName').value = '';
            document.getElementById('projectDescription').value = '';

            // Refresh UI
            await refreshAllData();

        } catch (error) {
            console.error("Create project error:", error);
            showStatus(`Failed: ${error.message}`, 'error', 'createStatus');
        } finally {
            createBtn.disabled = false;
            createBtn.textContent = "Create Project";
        }
    });
}

// Withdraw funds
async function setupWithdraw() {
    const withdrawBtn = document.getElementById('withdrawBtn');
    if (!withdrawBtn) return console.warn('Withdraw button not found');

    withdrawBtn.addEventListener('click', async () => {
        const projectIdInput = document.getElementById('withdrawProjectId').value;
        const projectId = parseInt(projectIdInput);

        if (isNaN(projectId)) {
            showStatus('Please enter a valid project ID (number)', 'error', 'withdrawStatus');
            return;
        }

        if (!contract) {
            showStatus('Wallet not connected', 'error', 'withdrawStatus');
            return;
        }

        try {
            withdrawBtn.disabled = true;
            withdrawBtn.textContent = 'Processing...';
            showStatus('Checking project ownership...', 'info', 'withdrawStatus');

            // Get project info from contract
            const project = await contract.projects(projectId);

            if (project.owner.toLowerCase() !== walletAddress.toLowerCase()) {
                showStatus('You are not the owner of this project', 'error', 'withdrawStatus');
                withdrawBtn.disabled = false;
                withdrawBtn.textContent = 'Withdraw Funds';
                return;
            }

            // Always mark milestone first (onlyOwner function)
            showStatus('Marking milestone...', 'info', 'withdrawStatus');
            console.log(await contract.markMilestone(0));

            const markTx = await contract.markMilestone(projectId);
            await markTx.wait();
            console.log('Milestone marked successfully');

            // Withdraw funds
            showStatus('Withdrawing funds... Please confirm transaction', 'info', 'withdrawStatus');
            const tx = await contract.withdraw(projectId);
            showStatus(`Transaction sent: ${tx.hash.slice(0, 10)}...`, 'info', 'withdrawStatus');
            const receipt = await tx.wait();
            console.log('Withdrawal confirmed:', receipt);

            // Record withdrawal in backend
            const withdrawalData = {
                project_id: projectId,
                withdrawer: walletAddress.toLowerCase(),
                amount: project.funds.toString(),
                milestone_marked: true,
                tx_hash: tx.hash,
                block_number: receipt.blockNumber
            };

            await fetch(`${API_URL}/withdrawals`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(withdrawalData)
            });

            showStatus('✅ Funds withdrawn successfully!', 'success', 'withdrawStatus');

            // Clear form
            document.getElementById('withdrawProjectId').value = '';

            // Refresh data
            await refreshAllData();

        } catch (error) {
            console.error('Withdraw error:', error);
            let errorMessage = error.message || 'Unknown error';
            if (error.code === 4001) errorMessage = 'Transaction rejected in MetaMask';
            showStatus(`Failed: ${errorMessage}`, 'error', 'withdrawStatus');
        } finally {
            withdrawBtn.disabled = false;
            withdrawBtn.textContent = 'Withdraw Funds';
        }
    });
}


// Investment modal
window.openInvestmentModal = function(projectId) {
    console.log('Opening investment modal for project:', projectId);
    
    const project = currentProjects.find(p => p.id == projectId);
    if (!project) {
        console.warn(`Project ${projectId} not found in currentProjects`);
        // Try to fetch the project
        fetch(`${API_URL}/projects/${projectId}`)
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    currentInvestingProject = data.project;
                    showInvestmentModal(data.project);
                } else {
                    alert('Project not found in database. Please create it first.');
                }
            })
            .catch(err => {
                console.error('Error fetching project:', err);
                alert('Error loading project details');
            });
        return;
    }

    currentInvestingProject = project;
    showInvestmentModal(project);
};

function showInvestmentModal(project) {
    const modal = document.getElementById('investmentModal');
    const modalTitle = document.getElementById('modalProjectTitle');
    const modalDetails = document.getElementById('modalProjectDetails');
    
    if (!modal || !modalTitle || !modalDetails) {
        console.warn('Modal elements not found');
        return;
    }
    
    modalTitle.textContent = project.name || `Project #${project.id}`;
    modalDetails.innerHTML = `
        <div style="margin-bottom: 10px;">
            <strong>Current Funding:</strong> ${project.funds ? parseFloat(ethers.formatEther(project.funds)).toFixed(4) : '0'} ETH
        </div>
        <div style="margin-bottom: 10px;">
            <strong>Backers:</strong> ${project.staker_count || 0}
        </div>
        <div style="margin-bottom: 10px;">
            <strong>Owner:</strong> ${project.owner ? `${project.owner.slice(0, 6)}...${project.owner.slice(-4)}` : 'Unknown'}
        </div>
        <div style="color: #aaa; font-size: 0.9em;">
            ${project.description ? project.description.substring(0, 200) + '...' : 'No description available'}
        </div>
    `;
    
    modal.style.display = 'flex';
    
    // Focus on amount input
    setTimeout(() => {
        const amountInput = document.getElementById('investmentAmount');
        if (amountInput) {
            amountInput.focus();
            amountInput.value = ''; // Clear previous value
        }
    }, 100);
}

window.viewProjectDetails = function(projectId) {
    localStorage.setItem('greenfi_current_project', projectId);
    window.location.href = `project.html?project=${projectId}`;
};

// Close modal
function setupModal() {
    const modal = document.getElementById('investmentModal');
    const cancelBtn = document.getElementById('cancelInvestBtn');
    const confirmBtn = document.getElementById('confirmInvestBtn');
    const amountInput = document.getElementById('investmentAmount');
    const modalStatus = document.getElementById('modalStatus');

    if (!modal || !cancelBtn || !confirmBtn || !amountInput) {
        console.warn('Modal elements not found');
        return;
    }

    // Close modal on cancel button click
    cancelBtn.addEventListener('click', () => {
        closeInvestmentModal();
    });

    // Close modal on background click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeInvestmentModal();
        }
    });

    // Confirm investment - FINAL FIXED VERSION
    confirmBtn.addEventListener('click', async () => {
        const amount = amountInput.value;
        
        if (!amount || parseFloat(amount) <= 0) {
            showStatus('Please enter a valid amount', 'error', 'modalStatus');
            return;
        }

        if (!currentInvestingProject || !contract) {
            showStatus('Investment failed: No project selected or wallet not connected', 'error', 'modalStatus');
            return;
        }

        try {
            confirmBtn.disabled = true;
            confirmBtn.textContent = 'Processing...';
            showStatus('Processing investment... Please confirm transaction', 'info', 'modalStatus');

            // Convert project ID to NUMBER
            const projectId = parseInt(currentInvestingProject.id);
            if (isNaN(projectId)) {
                throw new Error(`Invalid project ID: ${currentInvestingProject.id}`);
            }
            
            const amountWei = ethers.parseEther(amount);
            
            console.log('=== INVESTMENT START ===');
            console.log('Project ID (number):', projectId, '(type:', typeof projectId, ')');
            console.log('Amount:', amount, 'ETH');
            console.log('Amount in Wei:', amountWei.toString());
            console.log('Wallet:', walletAddress);
            
            // DEBUG: First check if the API endpoint is accessible
            console.log('🔍 Testing API endpoint...');
            try {
                const testResponse = await fetch(`${API_URL}/health`);
                const testData = await testResponse.json();
                console.log('API health check:', testData);
            } catch (apiError) {
                console.error('API not accessible:', apiError);
            }
            
            // Verify project exists in database BEFORE investing
            console.log('🔍 Checking if project exists in database...');
            try {
                const projectCheck = await fetch(`${API_URL}/projects/${projectId}`);
                const projectData = await projectCheck.json();
                console.log('Project check result:', projectData);
                
                if (!projectData.success) {
                    console.error('❌ Project not found in database!');
                    throw new Error(`Project #${projectId} not found in database. Please create the project first.`);
                }
                console.log('✅ Project found in database:', projectData.project.name);
            } catch (checkError) {
                console.error('Error checking project:', checkError);
                throw new Error('Cannot verify project in database. Please try again.');
            }
            
            // Call stake function with project ID (as number)
            console.log('📝 Calling contract.stake()...');
            const tx = await contract.stake(projectId, { value: amountWei });
            showStatus(`Transaction sent: ${tx.hash.slice(0, 10)}...`, 'info', 'modalStatus');
            console.log('Transaction hash:', tx.hash);

            const receipt = await tx.wait();
            console.log('✅ Transaction confirmed in block:', receipt.blockNumber);
            
            // Prepare stake data - MUST match backend expectations exactly
            const stakeData = {
                project_id: projectId, // MUST be number
                staker: walletAddress.toLowerCase(),
                amount: amountWei.toString(),
                tx_hash: tx.hash,
                block_number: receipt.blockNumber
            };
            
            console.log('💾 Saving stake to backend:', JSON.stringify(stakeData, null, 2));
            
            // Save to database with detailed error handling
            const saveResponse = await fetch(`${API_URL}/stakes`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(stakeData)
            });

            console.log('📥 Save response status:', saveResponse.status, saveResponse.statusText);
            
            // Get response text first
            let responseText;
            try {
                responseText = await saveResponse.text();
                console.log('Backend response text:', responseText);
            } catch (textError) {
                console.error('Error reading response text:', textError);
                responseText = 'Could not read response';
            }
            
            // Try to parse as JSON
            let responseData;
            try {
                responseData = JSON.parse(responseText);
                console.log('Parsed response data:', responseData);
            } catch (parseError) {
                console.error('Failed to parse response as JSON:', parseError);
                console.error('Raw response:', responseText);
                responseData = { 
                    success: false, 
                    error: `Invalid JSON response: ${responseText.substring(0, 100)}...` 
                };
            }
            
            if (!saveResponse.ok) {
                // Check for specific error patterns
                let errorMsg = 'Unknown error';
                
                if (responseData && responseData.error) {
                    errorMsg = responseData.error;
                    console.error('Backend error message:', errorMsg);
                    
                    // Check if it's the "missing fields" error
                    if (errorMsg.includes('Missing required fields')) {
                        console.error('❌ BACKEND IS NOT RECEIVING THE FIELDS PROPERLY!');
                        console.error('Stake data sent:', stakeData);
                        
                        // Show what fields we think we're sending
                        const sentFields = Object.keys(stakeData).join(', ');
                        errorMsg = `${errorMsg}. We sent fields: ${sentFields}. Check browser Network tab for details.`;
                    }
                } else {
                    errorMsg = `HTTP ${saveResponse.status}: ${responseText.substring(0, 200)}`;
                }
                
                throw new Error(`Failed to save investment to database: ${errorMsg}`);
            }

            if (responseData && responseData.success !== false) {
                showStatus('✅ Investment successful!', 'success', 'modalStatus');
                console.log('🎉 Investment saved to database successfully!');
                
                // Update wallet balance
                await loadWalletBalance();
                
                // Close modal after delay
                setTimeout(() => {
                    closeInvestmentModal();
                    
                    // Refresh data
                    refreshAllData();
                }, 2000);
            } else {
                const errorMsg = responseData?.error || 'Unknown database error';
                console.error('Backend reported failure:', errorMsg);
                throw new Error(`Backend error: ${errorMsg}`);
            }

        } catch (error) {
            console.error('❌ Investment error:', error);
            console.error('Error stack:', error.stack);
            
            let errorMessage = error.message;
            let showAlert = false;
            
            if (error.code === 4001) {
                errorMessage = 'Transaction was rejected by MetaMask';
                showAlert = true;
            } else if (error.code === -32603) {
                errorMessage = 'Transaction failed. Check contract execution.';
            } else if (error.reason) {
                errorMessage = error.reason;
            } else if (error.message.includes('insufficient funds')) {
                errorMessage = 'Insufficient ETH balance for this transaction';
                showAlert = true;
            }
            
            // If it's the database error, add more context
            if (error.message.includes('Missing required fields')) {
                errorMessage += '\n\nCheck browser console (F12) → Network tab to see the actual request.';
                showAlert = true;
            }
            
            if (showAlert) {
                alert(`❌ ${errorMessage}`);
            }
            
            showStatus(`Failed: ${errorMessage}`, 'error', 'modalStatus');
        } finally {
            confirmBtn.disabled = false;
            confirmBtn.textContent = 'Confirm Investment';
        }
    });

    function closeInvestmentModal() {
        modal.style.display = 'none';
        currentInvestingProject = null;
        amountInput.value = '';
        if (modalStatus) {
            modalStatus.style.display = 'none';
        }
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Confirm Investment';
    }
}

// Status display
function showStatus(message, type = 'info', containerId = null) {
    let container;
    if (containerId) {
        container = document.getElementById(containerId);
    }
    
    if (!container) {
        // Create a temporary notification
        container = document.createElement('div');
        container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 8px;
            z-index: 1000;
            font-family: 'Segoe UI', sans-serif;
            font-size: 14px;
            max-width: 300px;
            word-wrap: break-word;
        `;
        
        if (type === 'success') {
            container.style.backgroundColor = '#00ff8833';
            container.style.color = '#88ffcc';
            container.style.border = '1px solid #00ff88';
        } else if (type === 'error') {
            container.style.backgroundColor = '#ff000033';
            container.style.color = '#ff8888';
            container.style.border = '1px solid #ff0000';
        } else {
            container.style.backgroundColor = '#0088ff33';
            container.style.color = '#88aaff';
            container.style.border = '1px solid #0088ff';
        }
        
        container.textContent = message;
        document.body.appendChild(container);
        
        // Auto-hide
        setTimeout(() => {
            if (container.parentNode) {
                container.parentNode.removeChild(container);
            }
        }, 5000);
        return;
    }
    
    container.textContent = message;
    container.className = 'status-container';
    
    if (type === 'success') {
        container.classList.add('status-success');
    } else if (type === 'error') {
        container.classList.add('status-error');
    } else {
        container.classList.add('status-info');
    }
    
    container.style.display = 'block';
    
    // Auto-hide success/info messages
    if (type !== 'error') {
        setTimeout(() => {
            container.style.display = 'none';
        }, 5000);
    }
}

// Refresh all data
async function refreshAllData() {
    try {
        await Promise.all([
            loadDashboardStats(),
            loadAllProjects(),
            loadUserProjects(),
            loadUserInvestments(),
            loadWalletBalance()
        ]);
        
        console.log('✅ All data refreshed');
        
    } catch (error) {
        console.error('Refresh error:', error);
    }
}

// Disconnect wallet
function setupDisconnect() {
    const disconnectBtn = document.getElementById('disconnectBtn');
    if (!disconnectBtn) {
        console.warn('Disconnect button not found');
        return;
    }

    disconnectBtn.addEventListener('click', () => {
        localStorage.removeItem('greenfi_wallet_address');
        window.location.href = 'index.html';
    });
}

// Refresh button
function setupRefresh() {
    const refreshBtn = document.getElementById('refreshBtn');
    if (!refreshBtn) {
        console.warn('Refresh button not found');
        return;
    }

    refreshBtn.addEventListener('click', refreshAllData);
}

// Initialize everything
async function initDashboard() {
    console.log('🌿 GreenFi Dashboard Initializing...');
    
    try {
        // Check if Three.js is available
        if (typeof THREE !== 'undefined') {
            // Initialize Three.js background
            initThreeJS();
        } else {
            console.warn('Three.js not loaded');
        }
        
        // Check if ethers is available
        if (typeof ethers === 'undefined') {
            throw new Error('Ethers.js not loaded. Please check your script tags.');
        }
        
        console.log('Ethers version:', ethers.version);
        
        // Check if contract ABI is available
        if (!abi) {
            abi = await loadABI();
            if (!abi) {
                throw new Error('Failed to load contract ABI');
            }
        }
        
        // Initialize wallet and contract
        await initializeWallet();
        
        // Setup UI components
        setupTabs();
        setupSearch();
        setupCreateProject();
        setupWithdraw();
        setupModal();
        setupDisconnect();
        setupRefresh();
        
        console.log('✅ Dashboard ready');
        
        // Show welcome message
        setTimeout(() => {
            showStatus('Welcome to GreenFi Dashboard! Connect your wallet to start.', 'info');
        }, 1000);
        
    } catch (error) {
        console.error('Dashboard initialization failed:', error);
        showStatus(`Initialization failed: ${error.message}`, 'error');
    }
}

// Start when page loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDashboard);
} else {
    initDashboard();
}