'use client'

import { KIND_COLOR, KIND_LABEL, formatDurationShort, type TimelineEntry, type TimelineCode } from '@/lib/writing-session'

/** A thin bar showing how a sitting was spent, left to right. */
export function FocusTimeline({ timeline, height = 8 }: { timeline: TimelineEntry[]; height?: number }) {
  const total = timeline.reduce((n, [, d]) => n + d, 0)
  if (!total) return null
  return (
    <div className="flex w-full overflow-hidden rounded-full" style={{ height, background: 'rgba(255,255,255,0.05)' }}>
      {timeline.map(([offset, dur, k]) => (
        <div
          key={`${offset}-${k}`}
          title={`${KIND_LABEL[k]} · ${formatDurationShort(dur * 1000)}`}
          style={{ width: `${(dur / total) * 100}%`, background: KIND_COLOR[k] }}
        />
      ))}
    </div>
  )
}

export function FocusLegend({ codes = ['w', 't', 'r', 'b'] as TimelineCode[] }: { codes?: TimelineCode[] }) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
      {codes.map((c) => (
        <span key={c} className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: KIND_COLOR[c] }} />
          {KIND_LABEL[c]}
        </span>
      ))}
    </div>
  )
}
