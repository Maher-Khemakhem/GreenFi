// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract GreenFi is ERC20, Ownable {
    struct Project {
        address owner;
        uint256 funds;
        bool milestoneReached;
    }

    mapping(uint256 => Project) public projects;
    uint256 public projectCount;

    // Only call ERC20 constructor here
    constructor() ERC20("GreenToken", "GT") Ownable(msg.sender) {}

    // Investor stakes ETH → receives GreenTokens
    function stake(uint256 projectId) external payable {
        require(msg.value > 0, "Send ETH to stake");
        projects[projectId].funds += msg.value;

        // Mint 1 GT per wei (example, can scale on frontend)
        _mint(msg.sender, msg.value);
    }

    // Owner adds new project
    function createProject() external {
        projects[projectCount] = Project(msg.sender, 0, false);
        projectCount++;
    }

    // Verifier marks milestone reached
    function markMilestone(uint256 projectId) external {
        projects[projectId].milestoneReached = true;
    }

    // Project owner withdraws funds after milestone
    function withdraw(uint256 projectId) external {
        Project storage p = projects[projectId];
        require(msg.sender == p.owner, "Not project owner");
        require(p.milestoneReached, "Milestone not reached");

        uint256 amount = p.funds;
        p.funds = 0;

        // Transfer ETH to project owner
        payable(msg.sender).transfer(amount);
    }
}
