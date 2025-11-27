// app.js - GreenFi DApp with Three.js + Full Smart Contract Integration
// Contract Configuration
const contractAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

let provider;
let signer;
let contract;
let abi;
let walletAddress = ''; // short displayed address text

// Three.js variables
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

  // Particles
  const particlesGeometry = new THREE.BufferGeometry();
  const particlesCount = 1000;
  const posArray = new Float32Array(particlesCount * 3);
  for (let i = 0; i < particlesCount * 3; i++) {
    posArray[i] = (Math.random() - 0.5) * 20;
  }
  particlesGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
  const particlesMaterial = new THREE.PointsMaterial({
    size: 0.02,
    color: 0x00ff88,
    transparent: true,
    opacity: 0.8
  });
  particlesMesh = new THREE.Points(particlesGeometry, particlesMaterial);
  scene.add(particlesMesh);

  // Globe
  const globeGeometry = new THREE.SphereGeometry(1, 32, 32);
  const globeMaterial = new THREE.MeshPhongMaterial({
    color: 0x22ff88,
    wireframe: true,
    transparent: true,
    opacity: 0.3
  });
  globe = new THREE.Mesh(globeGeometry, globeMaterial);
  scene.add(globe);

  // Lights
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

// ==================== UI HELPERS ====================
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
    setTimeout(() => {
      statusEl.style.display = 'none';
    }, 8000);
  }
}

function enableUI() {
  const els = ['createProjectButton', 'stakeProjectId', 'stakeAmount', 'stakeButton', 'withdrawProjectId', 'withdrawButton'];
  els.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.disabled = false;
  });
}

function disableUI() {
  const els = ['createProjectButton', 'stakeProjectId', 'stakeAmount', 'stakeButton', 'withdrawProjectId', 'withdrawButton'];
  els.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.disabled = true;
  });
}

// Centralized disconnect logic (keeps UI consistent)
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
  console.log("✅ Wallet disconnected");
}

// ==================== DOM CONTENT LOADED (main) ====================
document.addEventListener('DOMContentLoaded', async () => {
  console.log("🚀 GreenFi DApp initializing...");

  // Initialize Three.js immediately
  initThreeJS();

  // Load ABI (same as old structure: try/catch, bail out if missing)
  try {
    const response = await fetch('abi.json');
    abi = await response.json();
    console.log("✅ ABI loaded successfully");
  } catch (err) {
    console.error("❌ Failed to load ABI:", err);
    alert("Failed to load ABI. Please ensure abi.json is in the same directory.");
    return;
  }

  // Element refs (keeps same ordering/style as previous code)
  const connectButton = document.getElementById('connectButton');
  const disconnectButton = document.getElementById('disconnectButton');
  const createProjectButton = document.getElementById('createProjectButton');
  const stakeButton = document.getElementById('stakeButton');
  const withdrawButton = document.getElementById('withdrawButton');

  const stakeProjectId = document.getElementById('stakeProjectId');
  const stakeAmount = document.getElementById('stakeAmount');
  const withdrawProjectId = document.getElementById('withdrawProjectId');

  const walletAddressDiv = document.getElementById('walletAddress');
  const addressText = document.getElementById('addressText');

  // ----------------- CONNECT WALLET -----------------
  connectButton.addEventListener("click", async () => {
    console.log("🔗 Connecting wallet...");

    if (!window.ethereum) {
      alert("Please install MetaMask!");
      return;
    }

    try {
      await window.ethereum.request({ method: "eth_requestAccounts" });
      provider = new ethers.BrowserProvider(window.ethereum);
      signer = await provider.getSigner();
      contract = new ethers.Contract(contractAddress, abi, signer);

      walletAddress = await signer.getAddress();

      // Update UI (keeps connect/disconnect elements like new UI)
      connectButton.style.display = 'none';
      disconnectButton.style.display = 'flex';
      if (walletAddressDiv) walletAddressDiv.style.display = 'block';
      if (addressText) addressText.textContent = `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;

      enableUI();
      showStatus('createStatus', '✅ Wallet connected successfully!', 'success');
      console.log("✅ Wallet connected:", walletAddress);
    } catch (err) {
      console.error("❌ Failed to connect wallet:", err);
      alert("Failed to connect wallet");
    }
  });

  // ----------------- DISCONNECT WALLET -----------------
  disconnectButton.addEventListener('click', () => {
    disconnectWallet();
    alert("Wallet disconnected!");
  });

  // ----------------- ACCOUNT SWITCH & CHAIN LISTENERS -----------------
  if (window.ethereum) {
    window.ethereum.on("accountsChanged", async (accounts) => {
      console.log("🔄 accountsChanged:", accounts);
      if (accounts.length === 0) {
        disconnectWallet();
        return;
      }
      // keep provider/signer updated
      signer = await provider.getSigner();
      contract = new ethers.Contract(contractAddress, abi, signer);
      walletAddress = accounts[0];
      if (addressText) addressText.textContent = `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;
      showStatus('createStatus', '🔄 Account changed', 'info');
    });

    window.ethereum.on("chainChanged", () => {
      console.log("🔄 chainChanged - reloading");
      location.reload();
    });
  }

  // ----------------- CREATE PROJECT -----------------
  // reorganized to follow old structure but preserve new advanced logging & event parsing
  createProjectButton.addEventListener('click', async () => {
    console.log("🎯 Create Project button clicked");

    if (!contract) {
      console.log("❌ Contract not initialized");
      alert("Connect wallet first");
      return;
    }

    try {
      console.log("📊 Step 1: Getting current project count...");
      const currentProjectCount = await contract.projectCount();
      console.log("Current project count:", currentProjectCount.toString());
      const expectedProjectId = currentProjectCount;
      console.log("Expected new project ID:", expectedProjectId.toString());

      showStatus('createStatus', '⏳ Creating project... Please confirm transaction', 'info');

      console.log("📝 Step 2: Sending createProject transaction...");
      const tx = await contract.createProject();
      console.log("Transaction object:", tx);
      console.log("Transaction hash:", tx.hash);

      showStatus('createStatus', `⏳ Transaction sent: ${tx.hash.slice(0, 10)}...`, 'info');

      console.log("⏳ Step 3: Waiting for transaction confirmation...");
      const receipt = await tx.wait();
      console.log("Transaction receipt:", receipt);

      if (!receipt) {
        console.log("❌ No receipt received");
        showStatus('createStatus', '❌ Transaction failed', 'error');
        return;
      }

      console.log("✅ Transaction confirmed! Block:", receipt.blockNumber);
      // gasUsed may be BigNumber - handle gracefully
      if (receipt.gasUsed) console.log("Gas used:", receipt.gasUsed.toString());

      console.log("🔍 Step 4: Checking for ProjectCreated event...");
      let projectIdFromEvent = null;

      if (receipt.logs && receipt.logs.length > 0) {
        console.log("Found", receipt.logs.length, "logs in receipt");
        for (let i = 0; i < receipt.logs.length; i++) {
          const log = receipt.logs[i];
          console.log(`Log ${i}:`, log);
          try {
            // parseLog can throw if log isn't from this contract
            const parsedLog = contract.interface.parseLog(log);
            console.log(`Parsed log ${i}:`, parsedLog);
            if (parsedLog && parsedLog.name === "ProjectCreated") {
              projectIdFromEvent = parsedLog.args.projectId;
              console.log("🎉 Found ProjectCreated event! Project ID:", projectIdFromEvent.toString());
              console.log("Project owner:", parsedLog.args.owner);
              console.log("Project name:", parsedLog.args.name);
              break;
            }
          } catch (parseError) {
            // Not from this interface, ignore
            // keep console small but informative
            // console.log(`Could not parse log ${i}:`, parseError.message);
          }
        }
      } else {
        console.log("No logs found in receipt");
      }

      console.log("📊 Step 5: Getting updated project count...");
      const newProjectCount = await contract.projectCount();
      console.log("New project count:", newProjectCount.toString());

      // compute final id (handle BigInt/BigNumber)
      const finalProjectId = projectIdFromEvent ? projectIdFromEvent : (BigInt(newProjectCount.toString()) - 1n);
      console.log("🎊 FINAL PROJECT ID:", finalProjectId.toString());

      // Update UI & autofill
      showStatus('createStatus', `✅ Project created! ID: ${finalProjectId}`, 'success');
      if (stakeProjectId) stakeProjectId.value = finalProjectId.toString();
      console.log("✅ UI updated with project ID");

      // Try to read the project (best-effort)
      console.log("🔍 Step 6: Reading project data from blockchain...");
      try {
        const project = await contract.projects(finalProjectId);
        console.log("Project data from blockchain:", {
          id: finalProjectId.toString(),
          owner: project.owner,
          name: project.name,
          funds: ethers.formatEther(project.funds) + " ETH",
          milestoneReached: project.milestoneReached
        });
      } catch (readError) {
        console.log("❌ Could not read project data:", readError.message);
      }

    } catch (err) {
      console.error("💥 ERROR in createProject:", err);
      // try to show structured error info
      showStatus('createStatus', "Failed to create project: " + (err.reason || err.message || err), 'error');
      alert("Failed to create project: " + (err.reason || err.message || err));
    }
  });

  // ----------------- STAKE ETH -----------------
  stakeButton.addEventListener('click', async () => {
    console.log("💰 Stake button clicked");

    if (!contract) {
      alert("Connect wallet first");
      return;
    }

    const projectId = stakeProjectId.value;
    const amount = stakeAmount.value;

    if (!projectId || !amount) {
      alert("Enter all fields");
      return;
    }

    try {
      showStatus('stakeStatus', '⏳ Staking... Please confirm transaction', 'info');

      const tx = await contract.stake(projectId, {
        value: ethers.parseEther(amount)
      });

      showStatus('stakeStatus', "Staking... Tx: " + tx.hash.slice(0, 10) + "...", 'info');
      await tx.wait();
      showStatus('stakeStatus', "✅ Staked successfully!", 'success');
    } catch (err) {
      console.error("❌ Stake error:", err);
      showStatus('stakeStatus', "Failed to stake: " + (err.reason || err.message || err), 'error');
      alert("Failed to stake: " + (err.reason || err.message || err));
    }
  });

  // ----------------- WITHDRAW FUNDS -----------------
  withdrawButton.addEventListener('click', async () => {
    console.log("🚀 Withdraw button clicked");

    if (!contract) {
      console.log("❌ Contract not initialized");
      alert("Connect wallet first");
      return;
    }

    const projectId = withdrawProjectId.value;
    console.log("📌 Project ID entered:", projectId);
    if (!projectId) {
      alert("Enter project ID");
      return;
    }

    let userAddress;
    try {
      userAddress = await signer.getAddress();
      console.log("🧑 Connected wallet address:", userAddress);
    } catch (err) {
      console.error("❌ Failed to get signer address:", err);
      alert("Could not get your wallet address");
      return;
    }

    let project;
    try {
      project = await contract.projects(projectId);
      console.log("📊 Project data fetched:", {
        owner: project.owner,
        funds: project.funds.toString(),
        milestoneReached: project.milestoneReached
      });
    } catch (err) {
      console.error("❌ Failed to read project from blockchain:", err);
      alert("Could not fetch project info");
      return;
    }

    console.log("🔍 Checking if user is project owner...");
    if (project.owner.toLowerCase() !== userAddress.toLowerCase()) {
      console.log("❌ User is not project owner. Owner is:", project.owner);
      alert("You are not the project owner!");
      return;
    }
    console.log("✅ User is project owner");

    // Try to mark milestone (best-effort; may revert if not allowed)
    try {
      showStatus('withdrawStatus', '⏳ Marking milestone...', 'info');
      const markTx = await contract.markMilestone(projectId);
      console.log("📄 markMilestone transaction sent:", markTx.hash);
      await markTx.wait();
      console.log("✅ Milestone marked successfully!");
      showStatus('withdrawStatus', '✅ Milestone marked', 'success');
      alert("Milestone marked successfully!");
    } catch (err) {
      console.warn("⚠ Could not mark milestone (maybe not owner or already marked):", err);
      // Not fatal—proceed to withdraw attempt
    }

    // Attempt withdraw
    try {
      showStatus('withdrawStatus', '⏳ Withdrawing... Please confirm transaction', 'info');
      const tx = await contract.withdraw(projectId);
      console.log("📄 Withdraw transaction sent:", tx.hash);
      showStatus('withdrawStatus', "Withdrawing... Tx: " + tx.hash.slice(0, 10) + "...", 'info');
      const receipt = await tx.wait();
      console.log("✅ Withdrawal confirmed! Receipt:", receipt);
      showStatus('withdrawStatus', "✅ Withdrawal successful!", 'success');
      alert("Withdrawal successful!");
    } catch (err) {
      console.error("❌ Failed to withdraw funds:", err);
      showStatus('withdrawStatus', "Failed to withdraw funds: " + (err.reason || err.message), 'error');
      alert("Failed to withdraw funds: " + (err.reason || err.message));
    }

    console.log("🎉 Withdraw process finished");
  });

  // initial UI state
  disableUI();
  const disconnectBtn = document.getElementById('disconnectButton');
  if (disconnectBtn) disconnectBtn.style.display = 'none';

  console.log("✅ GreenFi DApp ready!");
});
