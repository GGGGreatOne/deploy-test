import {Box} from "rebass/styled-components";
// import {widget} from "../../../charting_library";
import React, {useEffect, useMemo, useRef} from "react";
import {useDatafeed} from "./hooks/useDatafeed";
import { widget } from "./charting_library";
import {useIsDarkMode} from "../../state/user/hooks";
import {Currency} from "@uniswap/sdk";
import { isMobile } from 'react-device-detect';


function getLanguageFromURL() {
  const regex = new RegExp('[\\?&]lang=([^&#]*)')
  const results = regex.exec(window.location.search)
  return results === null ? null : decodeURIComponent(results[1].replace(/\+/g, ' '))
}

const disabledFeatures = [
  'volume_force_overlay',
  'show_logo_on_all_charts',
  'caption_buttons_text_if_possible',
  'create_volume_indicator_by_default',
  'header_compare',
  'compare_symbol',
  'display_market_status',
  'header_interval_dialog_button',
  'header_indicators',
  'show_interval_dialog_on_key_press',
  'header_symbol_search',
  'popup_hints',
  'header_in_fullscreen_mode',
  'right_bar_stays_on_scroll',
  'symbol_info',
  'timeframes_toolbar',
  // 'left_toolbar'
]

export const TradingViewChart = ({
  tokenA,
  tokenB,
  pairAddress
}: {
  tokenA: Currency | undefined
  tokenB: Currency | undefined
  pairAddress: string | undefined
}) => {
  const darkMode = useIsDarkMode()
  const chartContainerRef = useRef<HTMLDivElement>({} as HTMLDivElement)
  const { datafeed } = useDatafeed({
    pairSymbol: tokenA && tokenB ? tokenA.symbol + '/' + tokenB.symbol : 'Loading',
    pairAddress: pairAddress
  })

  const defaultProps = useMemo(() => {
    return {
      symbol: tokenA && tokenB ? tokenA.symbol + '/' + tokenB.symbol : 'Loading',
      interval: '1',
      datafeedUrl: 'https://demo_feed.tradingview.com',
      libraryPath: '/charting_library/',
      chartsStorageUrl: 'https://saveload.tradingview.com',
      chartsStorageApiVersion: '1.1',
      clientId: 'tradingview.com',
      userId: 'public_user_id',
      fullscreen: false,
      autosize: true,
      studiesOverrides: {}
    }
  }, [tokenA, tokenB])

  useEffect(() => {
    const widgetOptions = {
      symbol: defaultProps.symbol,
      // BEWARE: no trailing slash is expected in feed URL
      datafeed: datafeed,
      // datafeed: new window.Datafeeds.UDFCompatibleDatafeed(defaultProps.datafeedUrl),
      interval: defaultProps.interval,
      container: chartContainerRef.current,
      library_path: defaultProps.libraryPath,
      theme: darkMode ? 'Dark' : 'Light',
      locale: getLanguageFromURL() || 'en',
      // backgroundColor: '#0D0D0D',
      disabled_features: disabledFeatures,
      enabled_features: ['study_templates', 'iframe_loading_compatibility_mode', 'hide_left_toolbar_by_default'],
      charts_storage_url: defaultProps.chartsStorageUrl,
      charts_storage_api_version: defaultProps.chartsStorageApiVersion,
      client_id: defaultProps.clientId,
      user_id: defaultProps.userId,
      fullscreen: defaultProps.fullscreen,
      autosize: defaultProps.autosize,
      studies_overrides: defaultProps.studiesOverrides,
      // overrides: {
      //   'paneProperties.background': '#020024',
      //   'paneProperties.backgroundType': 'solid'
      // },
      favorites: {
        chartTypes: ['Area', 'Candles', 'Bars'],
        intervals: ['1', '5', '15', '30', '60', '240', 'D', 'W']
      },
      resolution: ['1', '5', '15', '30', 'H', '4H', 'D', 'W']
    }
    const tvWidget = new widget(widgetOptions as any)

    tvWidget.onChartReady(() => {
      tvWidget.headerReady().then(() => {})
      // tvWidget.applyOverrides({
      //   'paneProperties.background': '#0D0D0D',
      //   'paneProperties.backgroundType': 'solid',
      //   'scalesProperties.textColor': '#BFBFBF'
      // })
      // tvWidget.setCSSCustomProperty('--tv-color-pane-background', '#0D0D0D')
    })

    return () => {
      tvWidget.remove()
    }
  }, [defaultProps, datafeed, darkMode])

  return (
    <Box
      ref={chartContainerRef}
      sx={{
        height: isMobile ? 400 : 542,
        width: '100%',
        borderRadius: 16,
        overflow: 'hidden'
      }}
      className={'TVChartContainer'}
    />
  )
}
