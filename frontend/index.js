// Three.js Background Animation
let scene, camera, renderer, particlesMesh, globe;
let walletAddress = '';
let provider, signer, contract;
const contractAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const API_URL = "http://localhost:3000/api";
let abi;

function initThreeJS() {
    const canvas = document.getElementById('threejs-canvas');
    
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a1a0a);
    
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 5;
    
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, canvas });
    renderer.setSize(window.innerWidth, window.innerHeight);
    
    // Green particles
    const particlesGeometry = new THREE.BufferGeometry();
    const particlesCount = 1500;
    const posArray = new Float32Array(particlesCount * 3);
    
    for (let i = 0; i < particlesCount * 3; i++) {
        posArray[i] = (Math.random() - 0.5) * 25;
    }
    
    particlesGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    
    const particlesMaterial = new THREE.PointsMaterial({
        size: 0.02,
        color: 0x00ff88,
        transparent: true,
        opacity: 0.7
    });
    
    particlesMesh = new THREE.Points(particlesGeometry, particlesMaterial);
    scene.add(particlesMesh);
    
    // Earth globe
    const globeGeometry = new THREE.SphereGeometry(1.5, 32, 32);
    const globeMaterial = new THREE.MeshPhongMaterial({
        color: 0x22ff88,
        wireframe: true,
        transparent: true,
        opacity: 0.2
    });
    
    globe = new THREE.Mesh(globeGeometry, globeMaterial);
    scene.add(globe);
    
    // Lighting
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
        
        // Floating animation
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

async function loadStats() {
    try {
        const response = await fetch(`${API_URL}/stats`);
        if (!response.ok) throw new Error('Failed to load stats');
        
        const data = await response.json();
        if (data.success) {
            return data.stats;
        }
        return null;
    } catch (error) {
        console.error('Error loading platform stats:', error);
        return null;
    }
}

// ==================== PLATFORM STATS ====================
async function loadPlatformStats() {
    try {
        const stats = await loadStats();
        
        if (stats) {
            // Format numbers
            const formatNumber = (num) => {
                if (num > 1000000) return (num / 1000000).toFixed(1) + 'M';
                if (num > 1000) return (num / 1000).toFixed(1) + 'K';
                return num;
            };
            
            // Update DOM elements
            document.getElementById('totalProjects').textContent = formatNumber(stats.totalProjects);
            document.getElementById('totalInvestors').textContent = formatNumber(stats.uniqueInvestors);
            
            // Convert Wei to ETH and format
            if (stats.totalFundsRaised) {
                const ethAmount = parseFloat(ethers.formatEther(stats.totalFundsRaised));
                document.getElementById('totalETH').textContent = ethAmount.toFixed(1);
            }
        } else {
            // Set default values
            document.getElementById('totalProjects').textContent = '25+';
            document.getElementById('totalETH').textContent = '50+';
            document.getElementById('totalInvestors').textContent = '100+';
        }
    } catch (error) {
        console.error('Error loading platform stats:', error);
        // Set default values
        document.getElementById('totalProjects').textContent = '25+';
        document.getElementById('totalETH').textContent = '50+';
        document.getElementById('totalInvestors').textContent = '100+';
    }
}

// ==================== WALLET CONNECTION ====================
async function connectWallet() {
    const connectButton = document.getElementById('connectButton');
    const statusMessage = document.getElementById('statusMessage');
    
    // Check if MetaMask is installed
    if (typeof window.ethereum === 'undefined') {
        showStatus('Please install MetaMask to continue', 'error');
        alert('MetaMask is not installed. Please install it to use GreenFi.');
        return;
    }
    
    try {
        connectButton.disabled = true;
        showStatus('Connecting to MetaMask...', 'info');
        
        // Request account access
        const accounts = await window.ethereum.request({ 
            method: 'eth_requestAccounts' 
        });
        
        // Get the first account (MetaMask usually returns the selected one)
        walletAddress = accounts[0];
        
        // Create provider and signer (Ethers v6)
        provider = new ethers.BrowserProvider(window.ethereum);
        signer = await provider.getSigner();
        
        // Load ABI and create contract instance
        try {
            const response = await fetch('abi.json');
            abi = await response.json();
            contract = new ethers.Contract(contractAddress, abi, signer);
            console.log("✅ Contract connected successfully");
        } catch (err) {
            console.warn("⚠ Could not load ABI, continuing without contract:", err);
        }
        
        // Update UI
        updateWalletUI(walletAddress);
        showStatus('✅ Wallet connected successfully!', 'success');
        
        // Store wallet address for dashboard
        localStorage.setItem('greenfi_wallet_address', walletAddress);
        localStorage.setItem('greenfi_provider_setup', 'true');
        
    } catch (error) {
        console.error('Connection error:', error);
        showStatus('Failed to connect wallet: ' + error.message, 'error');
        connectButton.disabled = false;
    }
}

// ==================== FORCE ACCOUNT SELECTION ====================
async function forceMetaMaskAccountSelection() {
    try {
        // Check if MetaMask is installed
        if (typeof window.ethereum === 'undefined') {
            showStatus('Please install MetaMask to continue', 'error');
            return;
        }
        
        // Try to get all accounts
        const allAccounts = await window.ethereum.request({
            method: 'eth_accounts'
        });
        
        // If already connected, show account selector
        if (allAccounts.length > 0) {
            showAccountSelector(allAccounts);
            return;
        }
        
        // If no accounts connected, proceed normally
        await connectWallet();
        
    } catch (error) {
        console.error('Force account selection error:', error);
        // Fallback to normal connection
        await connectWallet();
    }
}

// ==================== ACCOUNT SELECTOR MODAL ====================
function showAccountSelector(accounts) {
    // Create modal element
    const modal = document.createElement('div');
    modal.className = 'account-selector-modal';
    modal.innerHTML = `
        <div class="account-selector-content">
            <h3 class="account-selector-title">Select Wallet Account</h3>
            <div class="account-list" id="accountList">
                ${accounts.map(acc => `
                    <div class="account-item" data-address="${acc}">
                        ${acc}
                    </div>
                `).join('')}
            </div>
            <div class="account-selector-buttons">
                <button id="selectDifferent" class="selector-btn different-account-btn">
                    🔄 Different Account
                </button>
                <button id="cancelSelect" class="selector-btn cancel-btn">
                    ✕ Cancel
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Handle account selection
    const accountItems = modal.querySelectorAll('.account-item');
    let selectedAccount = null;
    
    accountItems.forEach(item => {
        item.addEventListener('click', async () => {
            // Remove previous selection
            accountItems.forEach(i => i.classList.remove('selected'));
            // Add selection to clicked item
            item.classList.add('selected');
            selectedAccount = item.dataset.address;
            
            // Automatically select after short delay
            setTimeout(async () => {
                walletAddress = selectedAccount;
                document.body.removeChild(modal);
                
                // Update provider and signer
                provider = new ethers.BrowserProvider(window.ethereum);
                signer = await provider.getSigner();
                if (abi) {
                    contract = new ethers.Contract(contractAddress, abi, signer);
                }
                
                updateWalletUI(walletAddress);
                showStatus('✅ Account selected successfully!', 'success');
                localStorage.setItem('greenfi_wallet_address', walletAddress);
                localStorage.setItem('greenfi_provider_setup', 'true');
            }, 300);
        });
    });
    
    // Handle different account button
    modal.querySelector('#selectDifferent').addEventListener('click', async () => {
        document.body.removeChild(modal);
        try {
            // Force MetaMask to show account picker
            await window.ethereum.request({
                method: 'wallet_requestPermissions',
                params: [{ eth_accounts: {} }]
            });
            
            // Get the new accounts
            const newAccounts = await window.ethereum.request({
                method: 'eth_requestAccounts'
            });
            
            if (newAccounts.length > 0) {
                walletAddress = newAccounts[0];
                
                // Update provider and signer
                provider = new ethers.BrowserProvider(window.ethereum);
                signer = await provider.getSigner();
                if (abi) {
                    contract = new ethers.Contract(contractAddress, abi, signer);
                }
                
                updateWalletUI(walletAddress);
                showStatus('✅ Account changed successfully!', 'success');
                localStorage.setItem('greenfi_wallet_address', walletAddress);
                localStorage.setItem('greenfi_provider_setup', 'true');
            }
        } catch (error) {
            console.error('Error changing account:', error);
            showStatus('Failed to change account', 'error');
        }
    });
    
    // Handle cancel
    modal.querySelector('#cancelSelect').addEventListener('click', () => {
        document.body.removeChild(modal);
    });
    
    // Handle click outside modal
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            document.body.removeChild(modal);
        }
    });
    
    // Handle Enter key for selection
    modal.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.body.removeChild(modal);
        }
    });
}

// ==================== UPDATE WALLET UI ====================
function updateWalletUI(address) {
    const walletAddressSpan = document.getElementById('walletAddress');
    const walletInfo = document.getElementById('walletInfo');
    const enterButton = document.getElementById('enterButton');
    const connectButton = document.getElementById('connectButton');
    
    if (address) {
        walletAddressSpan.textContent = `${address.slice(0, 6)}...${address.slice(-4)}`;
        walletInfo.style.display = 'block';
        enterButton.style.display = 'inline-block';
        connectButton.style.display = 'none';
    } else {
        walletInfo.style.display = 'none';
        enterButton.style.display = 'none';
        connectButton.style.display = 'inline-block';
    }
}

// ==================== DISCONNECT WALLET ====================
function disconnectWallet() {
    provider = null;
    signer = null;
    contract = null;
    walletAddress = '';
    
    updateWalletUI('');
    showStatus('Wallet disconnected', 'info');
    localStorage.removeItem('greenfi_wallet_address');
    localStorage.removeItem('greenfi_provider_setup');
}

// ==================== STATUS MESSAGES ====================
function showStatus(message, type = 'info') {
    const statusMessage = document.getElementById('statusMessage');
    statusMessage.textContent = message;
    statusMessage.className = 'status-message';
    
    if (type === 'success') {
        statusMessage.classList.add('status-success');
    } else if (type === 'error') {
        statusMessage.classList.add('status-error');
    }
    
    statusMessage.style.display = 'block';
    
    // Auto-hide success messages after 5 seconds
    if (type === 'success') {
        setTimeout(() => {
            statusMessage.style.display = 'none';
        }, 5000);
    }
}

// ==================== INITIALIZE ====================
async function loadABI() {
    try {
        const response = await fetch('abi.json');
        abi = await response.json();
        console.log("✅ ABI loaded successfully");
    } catch (err) {
        console.warn("⚠ Could not load ABI file:", err);
    }
}

async function checkExistingConnection() {
    const savedAddress = localStorage.getItem('greenfi_wallet_address');
    const isProviderSetup = localStorage.getItem('greenfi_provider_setup') === 'true';
    
    if (savedAddress && window.ethereum && isProviderSetup) {
        try {
            const provider = new ethers.BrowserProvider(window.ethereum);
            const accounts = await provider.send('eth_accounts', []);
            
            if (accounts.length > 0 && accounts[0].toLowerCase() === savedAddress.toLowerCase()) {
                // Auto-show wallet info
                walletAddress = savedAddress;
                
                // Re-create provider and signer
                provider = new ethers.BrowserProvider(window.ethereum);
                signer = await provider.getSigner();
                
                // Load ABI and create contract instance if available
                if (abi) {
                    contract = new ethers.Contract(contractAddress, abi, signer);
                }
                
                updateWalletUI(savedAddress);
                console.log('✅ Auto-connected to wallet');
            }
        } catch (error) {
            console.log('Auto-connect failed:', error);
            // Clear invalid connection data
            localStorage.removeItem('greenfi_wallet_address');
            localStorage.removeItem('greenfi_provider_setup');
        }
    }
}

function setupAccountChangeListeners() {
    if (window.ethereum) {
        window.ethereum.on('accountsChanged', (accounts) => {
            if (accounts.length === 0) {
                // User disconnected
                disconnectWallet();
            } else {
                // User switched accounts
                walletAddress = accounts[0];
                
                // Update provider and signer
                provider = new ethers.BrowserProvider(window.ethereum);
                signer = provider.getSigner();
                if (abi) {
                    contract = new ethers.Contract(contractAddress, abi, signer);
                }
                
                updateWalletUI(accounts[0]);
                showStatus('Account changed to: ' + accounts[0].slice(0, 6) + '...' + accounts[0].slice(-4), 'success');
                localStorage.setItem('greenfi_wallet_address', accounts[0]);
                localStorage.setItem('greenfi_provider_setup', 'true');
            }
        });
        
        window.ethereum.on('chainChanged', () => {
            console.log("🔄 Chain changed - reloading");
            location.reload();
        });
    }
}

// ==================== MAIN INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🌿 GreenFi Landing Page Initializing...');
    
    // Initialize Three.js
    initThreeJS();
    
    // Load ABI
    await loadABI();
    
    // Load platform stats
    await loadPlatformStats();
    
    // Setup connect button
    document.getElementById('connectButton').addEventListener('click', forceMetaMaskAccountSelection);
    
    // Setup change account button
    const changeAccountBtn = document.getElementById('changeAccountBtn');
    if (changeAccountBtn) {
        changeAccountBtn.addEventListener('click', forceMetaMaskAccountSelection);
    }
    
    // Check if already connected
    await checkExistingConnection();
    
    // Setup account change listeners
    setupAccountChangeListeners();
    
    // Try to auto-connect if previously connected
    if (window.ethereum?.selectedAddress) {
        console.log("🔄 Auto-connecting to previously connected wallet...");
        setTimeout(() => {
            const connectButton = document.getElementById('connectButton');
            if (connectButton && !walletAddress) {
                connectButton.click();
            }
        }, 1000);
    }
    
    console.log('✅ Landing page ready');
});

// ==================== EXPORT FUNCTIONS FOR DASHBOARD ====================
window.getWalletAddress = () => walletAddress;
window.getProvider = () => provider;
window.getSigner = () => signer;
window.getContract = () => contract;
window.getContractAddress = () => contractAddress;
window.getABI = () => abi;
window.getAPI_URL = () => API_URL;

// Export API functions for dashboard use
window.saveProjectToDb = saveProjectToDb;
window.saveStakeToDb = saveStakeToDb;
window.loadAllProjects = loadAllProjects;
window.loadUserProjects = loadUserProjects;
window.loadUserStakes = loadUserStakes;
window.loadStats = loadStats;
window.showStatus = showStatus;