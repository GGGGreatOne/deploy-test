import { useMemo, useRef } from 'react'
// import {useActiveWeb3React} from "../../../hooks";
import { Bar } from "../charting_library";
import { ChainId } from '@uniswap/sdk'
export const SUPPORTED_RESOLUTIONS = ['1', '5', '15', '30', 'H', '4H', 'D', 'W']

export enum KLineInterval {
  '1m' = '1m',
  '5m' = '5m',
  '15m' = '15m',
  '30m' = '30m',
  '1H' = '1h',
  '4H' = '4h',
  '1D' = '1d',
  '1W' = '1w',
}

const getDataInterval = (resolution: string) => {
  switch (resolution) {
    case '1':
      return KLineInterval['1m']
    case '5':
      return KLineInterval['5m']
    case '15':
      return KLineInterval['15m']
    case '30':
      return KLineInterval['30m']
    case '1H':
      return KLineInterval['1H']
    case '1D':
      return KLineInterval['1D']
    case '1W':
      return KLineInterval['1W']
    case '4H':
      return KLineInterval['4H']
    default:
      return KLineInterval['4H']
  }
}

const configurationData = {
  supported_resolutions: SUPPORTED_RESOLUTIONS,
  supports_marks: false,
  supports_timescale_marks: false,
  supports_time: true,
  reset_cache_timeout: 10000
}

type KlineData = {
  close: string,
  high: string,
  low: string,
  open: string,
  ts: number
}

export const useDatafeed = ({
  pairSymbol,
  pairAddress,
  decimals = 8
}: {
  pairSymbol: string
  pairAddress: string | undefined
  decimals?: number
}) => {
  // const { chainId } = useActiveWeb3React()
  const wssRef = useRef<WebSocket | null>(null)
  const intervalRef = useRef<string>('')
  const resetCacheRef = useRef<() => void | undefined>()
  const shouldRefetchBars = useRef<boolean>(false)
  // TODO: fix this
  const chainId = useMemo(() => {
    return ChainId.SEPOLIA
  }, [])
  // const heartbeatRef = useRef(0)
  return useMemo(() => {
    return {
      resetCache: function () {
        shouldRefetchBars.current = true
        resetCacheRef.current?.()
        shouldRefetchBars.current = false
      },
      datafeed: {
        onReady: (callback: any) => {
          setTimeout(() => callback(configurationData))
        },
        resolveSymbol(symbolName: any, onSymbolResolvedCallback: any) {
          const symbolInfo = {
            name: symbolName,
            type: 'indices',
            description: symbolName,
            ticker: symbolName,
            session: '24x7',
            minmov: 1,
            pricescale: Number(`1e${decimals}`),
            timezone: 'Etc/UTC',
            has_intraday: true,
            has_daily: true,
            currency_code: 'USD',
            visible_plots_set: 'ohlc',
            data_status: 'streaming'
          }
          setTimeout(() => onSymbolResolvedCallback(symbolInfo))
        },
        // // get history k line
        async getBars(
          symbolInfo: any,
          resolution: string,
          periodParams: any,
          onHistoryCallback: any,
          onError: (error: string) => void
        ) {
          const { ticker } = symbolInfo
          try {
            if (!ticker) {
              onError('Invalid ticker!')
              return
            }
            console.log('resolution', resolution)
            const klineReq = await fetch(
              `https://shhsjabh.h76yyrop.online/api/klines/v1?chainId=${chainId}&pair=${pairAddress}&interval=${getDataInterval(
                resolution
              )}&limit=1000`
            )
            console.log('klineReq', klineReq)
            const klineDetails = await klineReq.json()
            console.log('klineReq', klineDetails)

            if (klineDetails.code === 200) {
              const klineData = klineDetails.data
              const bars: Bar[] = klineData.map((item: KlineData) => {
                return {
                  time: Number(item.ts * 1000),
                  open: Number(item.open),
                  high: Number(item.high),
                  low: Number(item.low),
                  close: Number(item.close)
                }
              })
              const sortedBars = bars?.sort((a, b) => {
                return a.time - b.time
              })
              const timeBars = sortedBars?.filter(bar => new Date().valueOf() > new Date(bar?.time).valueOf())
              if (periodParams.firstDataRequest) {
                onHistoryCallback(timeBars, { noData: false })
              } else {
                onHistoryCallback([], { noData: true })
              }
            }
            //
            // intervalRef.current = getDataInterval(resolution)
            //

          } catch (e) {
            console.log('Unable to load historical data!', e)
            onError('Unable to load historical data!')
          }
        },
        async subscribeBars(
          symbolInfo: any,
          resolution: string,
          onRealtimeCallback: any
          // _subscribeUID: any,
          // onResetCacheNeededCallback: () => void
        ) {
          const { ticker } = symbolInfo
          if (!ticker) {
            return
          }

          const wssIns = new WebSocket('wss://shhsjabh.h76yyrop.online/api/klines/ws')
          wssRef.current = wssIns
          wssIns.onopen = () => {
            wssIns.send(
              JSON.stringify({
                ev: 'subscribe',
                msg: pairAddress
              })
            )
          }
          wssIns.onmessage = (message) => {
            const data = JSON.parse(message.data)
            console.log('message', data)
            console.log('data.ev === \'error\'', data.ev === 'error')
            if (data.ev === 'error' || data.ev === 'connect') {
              console.log('return')
              return
            }
            const target = resolution === '1' ? 0 : 1
            const bar = {
              time: Number(data[target].ts * 1000),
              open: Number(data[target].open),
              high: Number(data[target].high),
              low: Number(data[target].low),
              close: Number(data[target].close)
            }
            onRealtimeCallback(bar)
          }
        },
        unsubscribeBars: () => {
          if (wssRef?.current) {
            wssRef.current.send(
              JSON.stringify({
                event: 'unsubscribe',
                arg: [
                  {
                    symbol: pairSymbol,
                    channel: 'bt-kline',
                    interval: intervalRef.current
                  }
                ]
              })
            )
            wssRef?.current?.close()
          }
        }
      }
    }
  }, [pairSymbol, decimals, chainId, pairAddress])
}
