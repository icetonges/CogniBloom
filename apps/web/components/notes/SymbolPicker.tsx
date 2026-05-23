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
  {
    label: 'Physics',
    symbols: [
      // Mechanics
      { char: 'F', name: 'force' }, { char: 'N', name: 'newton' }, { char: 'J', name: 'joule' },
      { char: 'W', name: 'watt' }, { char: 'Pa', name: 'pascal' }, { char: 'kg', name: 'kilogram' },
      { char: 'ℏ', name: 'h-bar (reduced Planck)' }, { char: 'ħ', name: 'planck constant' },
      { char: 'ℓ', name: 'length / quantum number' },
      // Waves & Optics
      { char: 'λ', name: 'wavelength' }, { char: 'ν', name: 'frequency' }, { char: 'ω', name: 'angular frequency' },
      { char: 'κ', name: 'wave number' }, { char: 'φ', name: 'phase' },
      // Electricity & Magnetism
      { char: 'Ω', name: 'ohm' }, { char: 'μ', name: 'micro / permeability' },
      { char: 'ε', name: 'permittivity / emf' }, { char: 'ε₀', name: 'epsilon naught' },
      { char: 'μ₀', name: 'mu naught' }, { char: 'B', name: 'magnetic field' },
      { char: 'Φ', name: 'magnetic flux' }, { char: 'Φ_E', name: 'electric flux' },
      { char: 'E', name: 'electric field / energy' }, { char: 'V', name: 'volt / potential' },
      { char: 'A', name: 'ampere' }, { char: 'C', name: 'coulomb / capacitance' },
      // Thermodynamics
      { char: 'T', name: 'temperature' }, { char: 'K', name: 'kelvin' },
      { char: 'η', name: 'efficiency' }, { char: 'κ', name: 'thermal conductivity' },
      // Quantum / Relativity
      { char: 'ψ', name: 'wave function' }, { char: '|ψ⟩', name: 'ket' }, { char: '⟨ψ|', name: 'bra' },
      { char: 'c', name: 'speed of light' }, { char: 'γ', name: 'lorentz factor' },
    ],
  },
  {
    label: 'Statistics',
    symbols: [
      { char: 'x̄', name: 'x-bar (mean)' }, { char: 'ȳ', name: 'y-bar (mean)' },
      { char: 'μ', name: 'population mean' }, { char: 'σ', name: 'std deviation (pop)' },
      { char: 'σ²', name: 'variance (pop)' }, { char: 's', name: 'std deviation (sample)' },
      { char: 's²', name: 'variance (sample)' }, { char: 'ŷ', name: 'y-hat (predicted)' },
      { char: 'p̂', name: 'p-hat (sample proportion)' }, { char: 'p', name: 'population proportion' },
      { char: 'n', name: 'sample size' }, { char: 'N', name: 'population size' },
      { char: 'r', name: 'correlation coefficient' }, { char: 'r²', name: 'R-squared' },
      { char: 'β₀', name: 'intercept' }, { char: 'β₁', name: 'slope' },
      { char: 'H₀', name: 'null hypothesis' }, { char: 'H₁', name: 'alt hypothesis' },
      { char: 'α', name: 'significance level' }, { char: 'p', name: 'p-value' },
      { char: 'z', name: 'z-score' }, { char: 't', name: 't-score' },
      { char: 'χ²', name: 'chi-squared' }, { char: 'F', name: 'F-statistic' },
      { char: '~', name: 'distributed as' }, { char: '∼', name: 'sim' },
      { char: 'P(A)', name: 'probability of A' }, { char: 'P(A|B)', name: 'conditional prob' },
      { char: 'E(X)', name: 'expected value' }, { char: 'Var(X)', name: 'variance' },
      { char: 'Cov(X,Y)', name: 'covariance' }, { char: 'IQR', name: 'inter-quartile range' },
      { char: 'Q₁', name: 'first quartile' }, { char: 'Q₃', name: 'third quartile' },
      { char: 'CI', name: 'confidence interval' }, { char: '%', name: 'percent' },
    ],
  },
  {
    label: 'Logic',
    symbols: [
      // Propositional
      { char: '∧', name: 'and (conjunction)' }, { char: '∨', name: 'or (disjunction)' },
      { char: '¬', name: 'not (negation)' }, { char: '⊕', name: 'xor' },
      { char: '→', name: 'implies' }, { char: '↔', name: 'iff (biconditional)' },
      { char: '⇒', name: 'implies (double)' }, { char: '⇔', name: 'iff (double)' },
      // Quantifiers
      { char: '∀', name: 'for all' }, { char: '∃', name: 'there exists' }, { char: '∄', name: 'does not exist' },
      { char: '∃!', name: 'unique existence' },
      // Proof
      { char: '∴', name: 'therefore' }, { char: '∵', name: 'because' },
      { char: '⊢', name: 'proves (turnstile)' }, { char: '⊨', name: 'models (semantic)' },
      { char: '◻', name: 'QED / end proof' }, { char: '□', name: 'QED (hollow)' },
      { char: '∎', name: 'QED (filled)' },
      // Sets
      { char: '∈', name: 'element of' }, { char: '∉', name: 'not element of' },
      { char: '⊂', name: 'proper subset' }, { char: '⊆', name: 'subset' },
      { char: '⊄', name: 'not subset' }, { char: '⊃', name: 'proper superset' },
      { char: '⊇', name: 'superset' }, { char: '∩', name: 'intersection' },
      { char: '∪', name: 'union' }, { char: '∅', name: 'empty set' },
      { char: '∁', name: 'complement' }, { char: '\\', name: 'set minus' },
      { char: '×', name: 'cartesian product' }, { char: '℘', name: 'power set' },
    ],
  },
  {
    label: 'Geometry',
    symbols: [
      // Angles & Shape
      { char: '∠', name: 'angle' }, { char: '∡', name: 'measured angle' }, { char: '∢', name: 'spherical angle' },
      { char: '°', name: 'degree' }, { char: "'", name: 'arcminute' }, { char: '"', name: 'arcsecond' },
      { char: '△', name: 'triangle' }, { char: '□', name: 'square' }, { char: '▱', name: 'parallelogram' },
      { char: '⬡', name: 'hexagon' }, { char: '○', name: 'circle' }, { char: '⊙', name: 'circle dot' },
      // Relations
      { char: '≅', name: 'congruent' }, { char: '∼', name: 'similar' }, { char: '∝', name: 'proportional' },
      { char: '⊥', name: 'perpendicular' }, { char: '∥', name: 'parallel' }, { char: '∦', name: 'not parallel' },
      // Coordinates & Measure
      { char: '|AB|', name: 'length AB' }, { char: 'AB⃡', name: 'line AB' }, { char: 'AB⃗', name: 'ray AB' },
      { char: '⌀', name: 'diameter' }, { char: 'r', name: 'radius' }, { char: 'π', name: 'pi' },
      // 3D
      { char: '∠', name: 'dihedral angle' }, { char: 'V', name: 'volume' }, { char: 'S', name: 'surface area' },
      // Transforms
      { char: 'T', name: 'translation' }, { char: 'R', name: 'rotation' }, { char: 'S', name: 'scaling' },
      { char: "'", name: 'image prime' }, { char: '→', name: 'maps to' },
    ],
  },
  {
    label: 'Biology',
    symbols: [
      // Genetics
      { char: '♀', name: 'female' }, { char: '♂', name: 'male' },
      { char: 'A', name: 'dominant allele' }, { char: 'a', name: 'recessive allele' },
      { char: 'F₁', name: 'F1 generation' }, { char: 'F₂', name: 'F2 generation' },
      { char: 'P', name: 'parental generation' }, { char: 'n', name: 'haploid' },
      { char: '2n', name: 'diploid' }, { char: '×', name: 'cross' },
      // Cell Biology
      { char: 'ATP', name: 'adenosine triphosphate' }, { char: 'ADP', name: 'ADP' },
      { char: 'DNA', name: 'deoxyribonucleic acid' }, { char: 'RNA', name: 'ribonucleic acid' },
      { char: 'mRNA', name: 'messenger RNA' }, { char: 'tRNA', name: 'transfer RNA' },
      { char: 'rRNA', name: 'ribosomal RNA' },
      // Ecology
      { char: '→', name: 'energy flow' }, { char: '↑', name: 'increase' }, { char: '↓', name: 'decrease' },
      { char: '⇌', name: 'equilibrium' }, { char: '∝', name: 'proportional to' },
      // Classification
      { char: '†', name: 'extinct' }, { char: '*', name: 'note / asterisk' },
      { char: '≈', name: 'approximately' }, { char: 'n', name: 'sample size' },
      { char: '%', name: 'percent' }, { char: '‰', name: 'per mille' },
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
