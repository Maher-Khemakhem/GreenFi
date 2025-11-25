async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with account:", deployer.address);

    const GreenFi = await ethers.getContractFactory("GreenFi");
    const greenFi = await GreenFi.deploy();

    await greenFi.waitForDeployment();

    const address = await greenFi.getAddress();
    console.log("GreenFi deployed to:", address);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
