import {ChainId, Currency, FACTORY_ADDRESS, INIT_CODE_HASH, Pair, TokenAmount} from '@uniswap/sdk'
import {useMemo} from 'react'
import {abi as IUniswapV2PairABI} from '@uniswap/v2-core/build/IUniswapV2Pair.json'
import {Interface} from '@ethersproject/abi'
import {useActiveWeb3React} from '../hooks'
import {keccak256, pack} from '@ethersproject/solidity'
import {useMultipleContractSingleData} from '../state/multicall/hooks'
import {wrappedCurrency} from '../utils/wrappedCurrency'
import {getCreate2Address} from "ethers/lib/utils";

const PAIR_INTERFACE = new Interface(IUniswapV2PairABI)

export enum PairState {
  LOADING,
  NOT_EXISTS,
  EXISTS,
  INVALID
}

export function usePairs(currencies: [Currency | undefined, Currency | undefined][]): [PairState, Pair | null][] {
  const { chainId } = useActiveWeb3React()

  const tokens = useMemo(
    () =>
      currencies.map(([currencyA, currencyB]) => [
        wrappedCurrency(currencyA, chainId),
        wrappedCurrency(currencyB, chainId)
      ]),
    [chainId, currencies]
  )
  console.log('use Pair', tokens)

  let PAIR_ADDRESS_CACHE: { [token0Address: string]: { [token1Address: string]: string } } = {}
  const pairAddresses = useMemo(
    () =>
      tokens.map(([tokenA, tokenB]) => {
        if (tokenA && tokenB) {
          const tokens = tokenA.sortsBefore(tokenB) ? [tokenA, tokenB] : [tokenB, tokenA]
          console.log('get tokens', tokens)
          if (PAIR_ADDRESS_CACHE?.[tokens[0].address]?.[tokens[1].address] === undefined) {
            PAIR_ADDRESS_CACHE = {
              ...PAIR_ADDRESS_CACHE,
              [tokens[0].address]: {
                ...PAIR_ADDRESS_CACHE?.[tokens[0].address],
                [tokens[1].address]: getCreate2Address(
                  chainId === ChainId.SEPOLIA ? '0xF62c03E08ada871A0bEb309762E260a7a6a880E6' : FACTORY_ADDRESS,
                  keccak256(['bytes'], [pack(['address', 'address'], [tokens[0].address, tokens[1].address])]),
                  INIT_CODE_HASH
                )
              }
            }
          }

          const getPairAddress = PAIR_ADDRESS_CACHE[tokens[0].address][tokens[1].address]
          console.log('get pair address', getPairAddress)
          return !tokenA.equals(tokenB) ? getPairAddress : undefined
        }
        // console.log('get pair address', res)
        return  undefined
        // return tokenA && tokenB && !tokenA.equals(tokenB) ? Pair.getAddress(tokenA, tokenB) : undefined
      }),
    [tokens, chainId]
  )
  // console.log('pairAddresses', pairAddresses)
  const results = useMultipleContractSingleData(pairAddresses, PAIR_INTERFACE, 'getReserves')

  return useMemo(() => {
    return results.map((result, i) => {
      const { result: reserves, loading } = result
      const tokenA = tokens[i][0]
      const tokenB = tokens[i][1]

      if (loading) return [PairState.LOADING, null]
      if (!tokenA || !tokenB || tokenA.equals(tokenB)) return [PairState.INVALID, null]
      if (!reserves) return [PairState.NOT_EXISTS, null]
      const { reserve0, reserve1 } = reserves
      const [token0, token1] = tokenA.sortsBefore(tokenB) ? [tokenA, tokenB] : [tokenB, tokenA]
      return [
        PairState.EXISTS,
        new Pair(new TokenAmount(token0, reserve0.toString()), new TokenAmount(token1, reserve1.toString()))
      ]
    })
  }, [results, tokens])
}

export function usePair(tokenA?: Currency, tokenB?: Currency): [PairState, Pair | null] {
  return usePairs([[tokenA, tokenB]])[0]
}
