const contractAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

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
        if (!contract) return alert("Connect wallet first");

        try {
            const tx = await contract.createProject();
            document.getElementById('createStatus').innerText = "Tx sent: " + tx.hash;
            await tx.wait();
            document.getElementById('createStatus').innerText = "Project created!";
        } catch (err) {
            console.error(err);
            alert("Failed to create project");
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
        if (!contract) return alert("Connect wallet first");

        const projectId = withdrawProjectId.value;
        if (!projectId) return alert("Enter project ID");

        try {
            const tx = await contract.withdraw(projectId);
            document.getElementById('withdrawStatus').innerText = "Withdrawing... Tx: " + tx.hash;
            await tx.wait();
            document.getElementById('withdrawStatus').innerText = "Withdrawal successful!";
        } catch (err) {
            console.error(err);
            alert("Failed to withdraw funds");
        }
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
