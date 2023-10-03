import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Contract } from "ethers";
import { ethers, network } from "hardhat";

async function main() {
  console.log("network", network.name);
  let contract: Contract;

  const [deployer]: SignerWithAddress[] = await ethers.getSigners();

  const SwapRouter = await ethers.getContractFactory("SwapRouter");
  // Values from Sepolia
  const factoryAddress = "0x0227628f3F023bb0B980b67D528571c95c6DaC1c";
  const wethAddress = "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14"
  contract = await SwapRouter.connect(deployer).deploy(factoryAddress, wethAddress);
  await contract.deployed();

  console.log("deployed", contract.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
