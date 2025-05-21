import { createRhinestoneAccount } from '@rhinestone/sdk'
import { getTokenAddress } from '@rhinestone/sdk/orchestrator'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { optimism, base } from 'viem/chains'
import {
  parseUnits,
  type Address,
  type Hex,
} from 'viem'
import { VaultsSdk } from '@vaultsfyi/sdk'

// --- CONFIG ---
const sourceChain = optimism
const targetChain = base
const targetVaultAddress = '0x3128a0F7f0ea68E7B7c9B00AFa7E41045828e858' as Address // has to be a USDC vault
const usdcAddress = getTokenAddress('USDC', targetChain.id)
const targetUsdcAmount = parseUnits('1', 6) // 1 USDC


const main = async () => {
  // --- SMART ACCOUNT SETUP ---
  const fundingPrivateKey = process.env.PRIVATE_KEY
  if (!fundingPrivateKey) {
    throw new Error('PRIVATE_KEY is not set')
  }

  const vaultsApiKey = process.env.VAULTS_FYI_API_KEY
  if (!vaultsApiKey) {
    throw new Error('VAULTS_FYI_API_KEY is not set')
  }
  const vaultsSdk = new VaultsSdk({
    apiKey: vaultsApiKey,
  })
  
  const rhinestoneApiKey = process.env.RHINESTONE_API_KEY
  if (!rhinestoneApiKey) {
    throw new Error('RHINESTONE_API_KEY is not set')
  }
  
  // You can use an existing PK here
  const privateKey = generatePrivateKey()
  console.log(`Owner private key: ${privateKey}`)
  const account = privateKeyToAccount(privateKey)
  
  const rhinestoneAccount = await createRhinestoneAccount({
    owners: {
      type: 'ecdsa',
      accounts: [account],
    },
    rhinestoneApiKey,
  })
  const smartAccountAddress = rhinestoneAccount.getAddress()
  console.log(`Smart account address: ${rhinestoneAccount.config.account}`)

  // --- GETTING DEPOSIT DATA ---
  const depositActions = await vaultsSdk.getActions('/v1/transactions/vaults/deposit', {
    query: {
      network: targetChain.name.toLowerCase() as any,
      vaultAddress: targetVaultAddress,
      sender: smartAccountAddress,
      assetAddress: usdcAddress,
      amount: targetUsdcAmount.toString(),
    }
  })

  console.log('Deposit actions:', depositActions)
  const bundleCalls = depositActions.actions.map((action) => ({
    to: action.tx.to as Address,
    value: BigInt(action.tx.value ?? 0n),
    data: action.tx.data as Hex,
  }))

  // --- SENDING THE TRANSACTION ---
  const transaction = await rhinestoneAccount.sendTransaction({
    sourceChain,
    targetChain,
    calls: bundleCalls,
    tokenRequests: [
      {
        address: usdcAddress,
        amount: targetUsdcAmount,
      },
    ],
  })
  console.log('Transaction', transaction)

  const transactionResult = await rhinestoneAccount.waitForExecution(transaction)
  console.log('Result', transactionResult)
}


main()