const contractAddress = "0x0B306BF915C4d645ff596e518fAf3F9669b97016";

let provider;
let signer;
let contract;
let abi;

document.addEventListener('DOMContentLoaded', async () => {

    // Load ABI
    try {
        const response = await fetch('abi.json');
        abi = await response.json();
    } catch (err) {
        console.error("Failed to load ABI:", err);
        alert("Failed to load ABI");
        return;
    }

    const connectButton = document.getElementById('connectButton');
    const disconnectButton = document.getElementById('disconnectButton');
    const createProjectButton = document.getElementById('createProjectButton');
    const stakeButton = document.getElementById('stakeButton');
    const withdrawButton = document.getElementById('withdrawButton');

    const stakeProjectId = document.getElementById('stakeProjectId');
    const stakeAmount = document.getElementById('stakeAmount');
    const withdrawProjectId = document.getElementById('withdrawProjectId');

    const walletAddressDiv = document.getElementById('walletAddress');

    // ----------------- CONNECT WALLET -----------------
    connectButton.addEventListener("click", async () => {
        if (!window.ethereum) return alert("Please install MetaMask!");

        try {
            await window.ethereum.request({ method: "eth_requestAccounts" });

            provider = new ethers.BrowserProvider(window.ethereum);
            signer = await provider.getSigner();
            contract = new ethers.Contract(contractAddress, abi, signer);

            walletAddressDiv.innerText = "Connected as: " + (await signer.getAddress());

            enableUI();

        } catch (err) {
            console.error(err);
            alert("Failed to connect wallet");
        }
    });

    // ----------------- DISCONNECT WALLET -----------------
    disconnectButton.addEventListener('click', () => {
        disconnectWallet();
        alert("Wallet disconnected!");
    });

    // ----------------- ACCOUNT SWITCH LISTENER -----------------
    if (window.ethereum) {
        window.ethereum.on("accountsChanged", async (accounts) => {
            if (accounts.length === 0) {
                disconnectWallet();
                return;
            }
            signer = await provider.getSigner();
            contract = new ethers.Contract(contractAddress, abi, signer);
            walletAddressDiv.innerText = "Connected as: " + accounts[0];
        });

        window.ethereum.on("chainChanged", () => {
            location.reload();
        });
    }

    // ----------------- CREATE PROJECT -----------------
    createProjectButton.addEventListener('click', async () => {
    console.log("🎯 Create Project button clicked");
    
    if (!contract) {
        console.log("❌ Contract not initialized");
        return alert("Connect wallet first");
    }

    try {
        console.log("📊 Step 1: Getting current project count...");
        const currentProjectCount = await contract.projectCount();
        console.log("Current project count:", currentProjectCount.toString());
        const expectedProjectId = currentProjectCount;
        console.log("Expected new project ID:", expectedProjectId.toString());

        console.log("📝 Step 2: Sending createProject transaction...");
        const tx = await contract.createProject();
        console.log("Transaction object:", tx);
        console.log("Transaction hash:", tx.hash);
        
        document.getElementById('createStatus').innerText = "Tx sent: " + tx.hash;

        console.log("⏳ Step 3: Waiting for transaction confirmation...");
        const receipt = await tx.wait();
        console.log("Transaction receipt:", receipt);
        
        if (!receipt) {
            console.log("❌ No receipt received");
            return;
        }

        console.log("✅ Transaction confirmed! Block:", receipt.blockNumber);
        console.log("Gas used:", receipt.gasUsed.toString());

        console.log("🔍 Step 4: Checking for ProjectCreated event...");
        let projectIdFromEvent = null;
        
        if (receipt.logs && receipt.logs.length > 0) {
            console.log("Found", receipt.logs.length, "logs in receipt");
            
            for (let i = 0; i < receipt.logs.length; i++) {
                const log = receipt.logs[i];
                console.log(`Log ${i}:`, log);
                
                try {
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
                    console.log(`Could not parse log ${i}:`, parseError.message);
                }
            }
        } else {
            console.log("No logs found in receipt");
        }

        console.log("📊 Step 5: Getting updated project count...");
        const newProjectCount = await contract.projectCount();
        console.log("New project count:", newProjectCount.toString());
        
        const finalProjectId = projectIdFromEvent ? projectIdFromEvent : (newProjectCount - 1n);
        console.log("🎊 FINAL PROJECT ID:", finalProjectId.toString());

        // Update UI
        document.getElementById('createStatus').innerText = `Project created! ID: ${finalProjectId}`;
        console.log("✅ UI updated with project ID");

        // Try to read the project data
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

        // Refresh project list
        console.log("🔄 Refreshing project list...");
        //await updateProjectList();

    } catch (err) {
        console.error("💥 ERROR in createProject:", err);
        console.error("Error details:", {
            message: err.message,
            code: err.code,
            reason: err.reason,
            stack: err.stack
        });
        document.getElementById('createStatus').innerText = "Failed to create project: " + err.message;
        alert("Failed to create project: " + err.message);
    }
});

    // ----------------- STAKE ETH -----------------
    stakeButton.addEventListener('click', async () => {
        if (!contract) return alert("Connect wallet first");

        const projectId = stakeProjectId.value;
        const amount = stakeAmount.value;

        if (!projectId || !amount) return alert("Enter all fields");

        try {
            const tx = await contract.stake(projectId, {
                value: ethers.parseEther(amount)
            });

            document.getElementById('stakeStatus').innerText = "Staking... Tx: " + tx.hash;
            await tx.wait();
            document.getElementById('stakeStatus').innerText = "Staked successfully!";
        } catch (err) {
            console.error(err);
            alert("Failed to stake");
        }
    });

    // ----------------- WITHDRAW FUNDS -----------------
    withdrawButton.addEventListener('click', async () => {
    console.log("🚀 Withdraw button clicked");

    if (!contract) {
        console.log("❌ Contract not initialized");
        return alert("Connect wallet first");
    }

    const projectId = withdrawProjectId.value;
    console.log("📌 Project ID entered:", projectId);
    if (!projectId) return alert("Enter project ID");

    let userAddress;
    try {
        userAddress = await signer.getAddress();
        console.log("🧑 Connected wallet address:", userAddress);
    } catch (err) {
        console.error("❌ Failed to get signer address:", err);
        return alert("Could not get your wallet address");
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
        return alert("Could not fetch project info");
    }

    console.log("🔍 Checking if user is project owner...");
    if (project.owner.toLowerCase() !== userAddress.toLowerCase()) {
        console.log("❌ User is not project owner. Owner is:", project.owner);
        return alert("You are not the project owner!");
    }
    console.log("✅ User is project owner");

    console.log("🛠 Attempting to mark milestone (ignoring ownership check)...");
    try {
        const markTx = await contract.markMilestone(projectId);
        console.log("📄 markMilestone transaction sent:", markTx.hash);
        await markTx.wait();
        console.log("✅ Milestone marked successfully!");
        alert("Milestone marked successfully!");
    } catch (err) {
        console.warn("⚠ Could not mark milestone (maybe not owner):", err);
    }

    console.log("💸 Attempting to withdraw funds...");
    try {
        const tx = await contract.withdraw(projectId);
        console.log("📄 Withdraw transaction sent:", tx.hash);
        document.getElementById('withdrawStatus').innerText = "Withdrawing... Tx: " + tx.hash;
        const receipt = await tx.wait();
        console.log("✅ Withdrawal confirmed! Receipt:", receipt);
        document.getElementById('withdrawStatus').innerText = "Withdrawal successful!";
    } catch (err) {
        console.error("❌ Failed to withdraw funds:", err);
        alert("Failed to withdraw funds: " + (err.reason || err.message));
    }

    console.log("🎉 Withdraw process finished");
});




    // ----------------- UI HELPERS -----------------
    function enableUI() {
        createProjectButton.disabled = false;
        stakeButton.disabled = false;
        stakeProjectId.disabled = false;
        stakeAmount.disabled = false;
        withdrawButton.disabled = false;
        withdrawProjectId.disabled = false;
    }

    function disableUI() {
        createProjectButton.disabled = true;
        stakeButton.disabled = true;
        stakeProjectId.disabled = true;
        stakeAmount.disabled = true;
        withdrawButton.disabled = true;
        withdrawProjectId.disabled = true;
    }

    function disconnectWallet() {
        provider = null;
        signer = null;
        contract = null;
        walletAddressDiv.innerText = "Disconnected";
        disableUI();
    }

});
