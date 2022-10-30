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
    const daiAddress = networkConfig[chainId]["daiToken"]
    const wethAddress = networkConfig[chainId]["wethToken"]

    //get lending pool address ; lendingPoolAddressesProvider
    const lendingPoolAddress = await getLendingPoolAddress(deployer)
    const lendingPoolContract = await ethers.getContractAt(
        "ILendingPool",
        lendingPoolAddress,
        deployer
    )
    //Approve lending pool to spend WETH
    await approveERC20(wethAddress, deployer, lendingPoolContract.address, AMOUNT)

    //Deposit
    await depositWETH(deployer, lendingPoolContract, AMOUNT)

    //Get ETH/DAI price
    const ethDaiPrice = await getEthDaiPrice()

    //Get available amount to borrow
    let { availableBorrowsETH, totalDebtETH } = await getBorrowData(lendingPoolContract, deployer)
    const daiToBorrow = availableBorrowsETH.toString() * 0.95 * ethDaiPrice
    const daiToBorrowInWei = ethers.utils.parseEther(daiToBorrow.toString())
    //Borrow
    await borrowDAI(daiAddress, lendingPoolContract, daiToBorrowInWei, deployer)
    totalDebtETH = (await getBorrowData(lendingPoolContract, deployer)).totalDebtETH

    //Payback
    await payback(daiAddress, totalDebtETH, lendingPoolContract, deployer)
    await getBorrowData(lendingPoolContract, deployer)
}

const getBorrowData = async (lendingPoolContract, deployer) => {
    //getUserAccountData
    //totalCollateralETH,totalDebtETH,availableBorrowsETH
    const { totalCollateralETH, totalDebtETH, availableBorrowsETH } =
        await lendingPoolContract.getUserAccountData(deployer)
    console.log(`You have ${totalCollateralETH} in ETH as collateral`)
    console.log(`You have ${totalDebtETH} ETH as Debt`)
    console.log(`You have ${availableBorrowsETH} ETH you can borrow`)
    return { availableBorrowsETH, totalDebtETH }
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

const getEthDaiPrice = async () => {
    const aggregatorV3Address = networkConfig[chainId]["daiEthPriceFeed"]
    const aggregatorV3Contract = await ethers.getContractAt(
        "AggregatorV3Interface",
        aggregatorV3Address
    )
    const daiEthPrice = (await aggregatorV3Contract.latestRoundData())[1]
    console.log(`DAI/ETH price is ${daiEthPrice.toString()}`)
    return 1 / daiEthPrice.toNumber()
}

const borrowDAI = async (daiAddress, lendingPoolContract, amount, deployer) => {
    /**
     * function borrow(address asset, uint256 amount, uint256 interestRateMode, uint16 referralCode, address onBehalfOf)
     */
    const tx = await lendingPoolContract.borrow(daiAddress, amount, 1, 0, deployer)
    const txResponse = await tx.wait(1)
    console.log("Borrowed successfully")
}

const depositWETH = async (deployer, lendingPoolContract, amount) => {
    const tx = await lendingPoolContract.deposit(
        networkConfig[network.config.chainId].wethToken,
        amount,
        deployer,
        0
    )
    const txResponse = await tx.wait(1)
    console.log("Deposited succesfully")
}

const approveERC20 = async (erc20Address, deployer, spender, amount) => {
    const erc20Token = await ethers.getContractAt("IERC20", erc20Address, deployer)
    const tx = await erc20Token.approve(spender, amount)
    await tx.wait(1)
    console.log(`Deposit of ${amount} approved`)
}

//function repay(address asset, uint256 amount, uint256 rateMode, address onBehalfOf)
const payback = async (daiAddress, amount, lendingPoolContract, deployer) => {
    await approveERC20(daiAddress, deployer, lendingPoolContract.address, amount)
    const tx = await lendingPoolContract.repay(daiAddress, amount, 1, deployer)
    await tx.wait(1)
    console.log("Paid back the loan successfully")
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
