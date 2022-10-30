/**
 * How to borrow from aave
 * 1. Get WETH
 * 2. Get lendingpool address from lending pool provider
 * 3. Deposit WETH
 * 4. Borrow DAI
 * 5. Repay
 */

const { ethers, network, getNamedAccounts } = require("hardhat")
const { networkConfig } = require("../helper-hardhat-config")
const { getWeth, AMOUNT } = require("../scripts/getWeth")
const chainId = network.config.chainId
const lendingPoolAddressesProvider = networkConfig[chainId]["lendingPoolAddressesProvider"]

async function main() {
    await getWeth()
    const { deployer } = await getNamedAccounts()
    //get lending pool address ; lendingPoolAddressesProvider
    const lendingPoolAddress = await getLendingPoolAddress(deployer)
    const lendingPoolContract = await ethers.getContractAt(
        "ILendingPool",
        lendingPoolAddress,
        deployer
    )
    //Approve lending pool to spend WETH
    await approveERC20(deployer, lendingPoolContract, AMOUNT)

    //Deposit
    await depositWETH(deployer, lendingPoolContract, AMOUNT)
}

const getLendingPoolAddress = async (deployer) => {
    const lendingPoolProvider = await ethers.getContractAt(
        "ILendingPoolAddressesProvider",
        lendingPoolAddressesProvider,
        deployer
    )
    const lendingPoolAddress = await lendingPoolProvider.getLendingPool()
    return lendingPoolAddress
}

const borrowDAI = async (lendingPoolContract) => {
    /**
     * function borrow(address asset, uint256 amount, uint256 interestRateMode, uint16 referralCode, address onBehalfOf)
     */
    // const tx = await lendingPoolContract.Borrow()
}

const depositWETH = async (deployer, lendingPoolContract, AMOUNT) => {
    const tx = await lendingPoolContract.deposit(
        networkConfig[network.config.chainId].wethToken,
        AMOUNT,
        deployer,
        0
    )
    const txResponse = await tx.wait(1)
    console.log("Deposited succesfully")
}

const approveERC20 = async (deployer, lendingPoolContract, AMOUNT) => {
    const iWeth = await ethers.getContractAt(
        "IWeth",
        networkConfig[network.config.chainId].wethToken,
        deployer
    )
    const tx = await iWeth.approve(lendingPoolContract.address, AMOUNT)
    const txResponse = await tx.wait(1)
    console.log(`Deposit of ${AMOUNT} approved`)
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
