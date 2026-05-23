'use client'

import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'

interface SymbolPickerProps {
  onInsert: (symbol: string) => void
}

const CATEGORIES = [
  {
    label: 'Greek',
    symbols: [
      { char: 'α', name: 'alpha' }, { char: 'β', name: 'beta' }, { char: 'γ', name: 'gamma' },
      { char: 'δ', name: 'delta' }, { char: 'ε', name: 'epsilon' }, { char: 'ζ', name: 'zeta' },
      { char: 'η', name: 'eta' }, { char: 'θ', name: 'theta' }, { char: 'ι', name: 'iota' },
      { char: 'κ', name: 'kappa' }, { char: 'λ', name: 'lambda' }, { char: 'μ', name: 'mu' },
      { char: 'ν', name: 'nu' }, { char: 'ξ', name: 'xi' }, { char: 'π', name: 'pi' },
      { char: 'ρ', name: 'rho' }, { char: 'σ', name: 'sigma' }, { char: 'τ', name: 'tau' },
      { char: 'υ', name: 'upsilon' }, { char: 'φ', name: 'phi' }, { char: 'χ', name: 'chi' },
      { char: 'ψ', name: 'psi' }, { char: 'ω', name: 'omega' },
      { char: 'Γ', name: 'Gamma' }, { char: 'Δ', name: 'Delta' }, { char: 'Θ', name: 'Theta' },
      { char: 'Λ', name: 'Lambda' }, { char: 'Ξ', name: 'Xi' }, { char: 'Π', name: 'Pi' },
      { char: 'Σ', name: 'Sigma' }, { char: 'Φ', name: 'Phi' }, { char: 'Ψ', name: 'Psi' },
      { char: 'Ω', name: 'Omega' },
    ],
  },
  {
    label: 'Math',
    symbols: [
      { char: '∞', name: 'infinity' }, { char: '∑', name: 'sum' }, { char: '∏', name: 'product' },
      { char: '∫', name: 'integral' }, { char: '∬', name: 'double integral' }, { char: '∮', name: 'contour' },
      { char: '√', name: 'sqrt' }, { char: '∛', name: 'cube root' }, { char: '∜', name: 'fourth root' },
      { char: '∂', name: 'partial' }, { char: '∇', name: 'nabla' }, { char: '△', name: 'laplacian' },
      { char: '≤', name: 'leq' }, { char: '≥', name: 'geq' }, { char: '≠', name: 'neq' },
      { char: '≈', name: 'approx' }, { char: '≡', name: 'equiv' }, { char: '∝', name: 'propto' },
      { char: '±', name: 'pm' }, { char: '∓', name: 'mp' }, { char: '×', name: 'times' },
      { char: '÷', name: 'div' }, { char: '·', name: 'cdot' }, { char: '⊕', name: 'oplus' },
      { char: '⊗', name: 'otimes' }, { char: '∈', name: 'in' }, { char: '∉', name: 'notin' },
      { char: '⊂', name: 'subset' }, { char: '⊃', name: 'supset' }, { char: '⊆', name: 'subseteq' },
      { char: '∪', name: 'cup' }, { char: '∩', name: 'cap' }, { char: '∅', name: 'emptyset' },
      { char: '∀', name: 'forall' }, { char: '∃', name: 'exists' }, { char: '¬', name: 'neg' },
      { char: '∧', name: 'and' }, { char: '∨', name: 'or' }, { char: '⊥', name: 'perp' },
      { char: '∥', name: 'parallel' }, { char: '∠', name: 'angle' }, { char: '°', name: 'degree' },
      { char: 'ℝ', name: 'R (reals)' }, { char: 'ℂ', name: 'C (complex)' }, { char: 'ℤ', name: 'Z (integers)' },
      { char: 'ℚ', name: 'Q (rationals)' }, { char: 'ℕ', name: 'N (naturals)' },
    ],
  },
  {
    label: 'Chemistry',
    symbols: [
      { char: '→', name: 'reaction right' }, { char: '←', name: 'reaction left' },
      { char: '⇌', name: 'equilibrium' }, { char: '⟶', name: 'long right' },
      { char: '⟵', name: 'long left' }, { char: '⟺', name: 'double long' },
      { char: '⇒', name: 'implies' }, { char: '⇔', name: 'iff' },
      { char: '↑', name: 'gas' }, { char: '↓', name: 'precipitate' },
      { char: '·', name: 'dot' }, { char: '•', name: 'radical' },
      { char: '°', name: 'degree' }, { char: '°C', name: 'celsius' },
      { char: '∆', name: 'delta (heat)' }, { char: 'ΔH', name: 'enthalpy' },
      { char: 'ΔG', name: 'gibbs' }, { char: 'ΔS', name: 'entropy' },
      { char: 'Kₐ', name: 'Ka' }, { char: 'Kᵦ', name: 'Kb' }, { char: 'Kw', name: 'Kw' },
      { char: 'pH', name: 'pH' }, { char: 'pKₐ', name: 'pKa' },
      { char: '¹H', name: 'H-1' }, { char: '²H', name: 'H-2 (D)' }, { char: '¹²C', name: 'C-12' },
      { char: '¹⁴C', name: 'C-14' }, { char: '¹⁶O', name: 'O-16' }, { char: '²³⁸U', name: 'U-238' },
      { char: 'α', name: 'alpha particle' }, { char: 'β', name: 'beta particle' },
      { char: 'γ', name: 'gamma ray' }, { char: 'ν', name: 'frequency' },
    ],
  },
  {
    label: 'Superscripts',
    symbols: [
      { char: '⁰', name: '0' }, { char: '¹', name: '1' }, { char: '²', name: '2' },
      { char: '³', name: '3' }, { char: '⁴', name: '4' }, { char: '⁵', name: '5' },
      { char: '⁶', name: '6' }, { char: '⁷', name: '7' }, { char: '⁸', name: '8' },
      { char: '⁹', name: '9' }, { char: '⁺', name: '+' }, { char: '⁻', name: '-' },
      { char: 'ⁿ', name: 'n' },
    ],
  },
  {
    label: 'Subscripts',
    symbols: [
      { char: '₀', name: '0' }, { char: '₁', name: '1' }, { char: '₂', name: '2' },
      { char: '₃', name: '3' }, { char: '₄', name: '4' }, { char: '₅', name: '5' },
      { char: '₆', name: '6' }, { char: '₇', name: '7' }, { char: '₈', name: '8' },
      { char: '₉', name: '9' }, { char: '₊', name: '+' }, { char: '₋', name: '-' },
      { char: 'ₙ', name: 'n' }, { char: 'ₓ', name: 'x' },
    ],
  },
  {
    label: 'Arrows',
    symbols: [
      { char: '→', name: 'right' }, { char: '←', name: 'left' }, { char: '↑', name: 'up' },
      { char: '↓', name: 'down' }, { char: '↔', name: 'left-right' }, { char: '↕', name: 'up-down' },
      { char: '⇒', name: 'double right' }, { char: '⇐', name: 'double left' },
      { char: '⇑', name: 'double up' }, { char: '⇓', name: 'double down' },
      { char: '⇔', name: 'double lr' }, { char: '⟹', name: 'long double right' },
      { char: '⟸', name: 'long double left' }, { char: '⟺', name: 'long double lr' },
      { char: '↗', name: 'ne' }, { char: '↘', name: 'se' }, { char: '↙', name: 'sw' }, { char: '↖', name: 'nw' },
      { char: '↺', name: 'ccw' }, { char: '↻', name: 'cw' },
      { char: '⤵', name: 'down hook' }, { char: '⤴', name: 'up hook' },
    ],
  },
]

export function SymbolPicker({ onInsert }: SymbolPickerProps) {
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState(0)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const filteredSymbols = search.trim()
    ? CATEGORIES.flatMap((c) =>
        c.symbols.filter(
          (s) => s.name.toLowerCase().includes(search.toLowerCase()) || s.char.includes(search)
        )
      )
    : CATEGORIES[activeTab]?.symbols ?? []

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Insert symbol"
        className={cn(
          'p-1.5 rounded transition-colors font-serif text-sm',
          open
            ? 'bg-primary/20 text-primary'
            : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.06]'
        )}
      >
        Ω
      </button>

      {open && (
        <div
          className="absolute left-0 top-full mt-1 z-50 rounded-xl overflow-hidden shadow-2xl w-72"
          style={{ background: '#0d1117', border: '1px solid rgba(99,102,241,0.2)' }}
        >
          {/* Search */}
          <div className="px-3 pt-2.5 pb-1.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search symbols…"
              className="w-full text-xs px-2.5 py-1.5 rounded-lg focus:outline-none"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: 'inherit',
              }}
              autoFocus
            />
          </div>

          {/* Category tabs */}
          {!search && (
            <div className="flex overflow-x-auto px-2 pt-2 gap-1" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              {CATEGORIES.map((cat, i) => (
                <button
                  key={cat.label}
                  onClick={() => setActiveTab(i)}
                  className={cn(
                    'text-[10px] font-semibold px-2.5 py-1 rounded-lg mb-1.5 whitespace-nowrap transition-colors',
                    activeTab === i
                      ? 'text-primary'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                  style={
                    activeTab === i
                      ? { background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.25)' }
                      : {}
                  }
                >
                  {cat.label}
                </button>
              ))}
            </div>
          )}

          {/* Symbol grid */}
          <div className="p-2 max-h-52 overflow-y-auto grid grid-cols-7 gap-0.5">
            {filteredSymbols.length === 0 ? (
              <p className="col-span-7 text-center text-xs text-muted-foreground py-4">No symbols found</p>
            ) : (
              filteredSymbols.map((sym) => (
                <button
                  key={sym.char + sym.name}
                  onClick={() => {
                    onInsert(sym.char)
                    setOpen(false)
                    setSearch('')
                  }}
                  title={sym.name}
                  className="w-8 h-8 rounded-lg text-sm font-medium flex items-center justify-center transition-colors text-muted-foreground hover:text-foreground"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}
                >
                  {sym.char}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
