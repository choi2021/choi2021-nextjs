'use client'

import { useEffect, useId, useState } from 'react'
import { useTheme } from 'next-themes'

export default function Mermaid({ chart }: { chart: string }) {
  const { resolvedTheme } = useTheme()
  const id = useId().replace(/:/g, '')
  const [svg, setSvg] = useState('')

  useEffect(() => {
    let cancelled = false
    async function render() {
      const mermaid = (await import('mermaid')).default
      mermaid.initialize({
        startOnLoad: false,
        theme: resolvedTheme === 'dark' ? 'dark' : 'default',
      })
      try {
        const { svg } = await mermaid.render(`mermaid-${id}`, chart)
        if (!cancelled) setSvg(svg)
      } catch (e) {
        if (!cancelled) setSvg(`<pre>${String(e)}</pre>`)
      }
    }
    render()
    return () => {
      cancelled = true
    }
  }, [chart, resolvedTheme, id])

  return <div className="my-6 flex justify-center" dangerouslySetInnerHTML={{ __html: svg }} />
}
