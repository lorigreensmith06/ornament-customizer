import type { ReactNode } from 'react'
import type {
  ConfigParam,
  PublicOrnamentConfig,
} from '../ornamentConfigs'
import { isVisible } from '../ornamentConfigs'

/* Renders the customization controls declared by a backend ornament
   config — same visual language as the legacy controls. Params render
   in `order`; params sharing a visibleWhen rule collapse into a single
   personalization-options block that hides with its toggle. */

function StringControl({
  param, value, onChange,
}: {
  param: ConfigParam
  value: unknown
  onChange: (value: string) => void
}) {
  const rules = param.validation ?? {}
  const text = String(value ?? '')
  return (
    <>
      <label htmlFor={`cfg-${param.key}`}>{param.label}</label>
      <input
        id={`cfg-${param.key}`}
        value={text}
        maxLength={rules.maxLength}
        data-clarity-mask="true"
        onChange={(event) => {
          let v = event.target.value
          if (rules.allowedChars) {
            v = v.replace(
              new RegExp(`[^${rules.allowedChars}]`, 'g'), '')
          }
          if (rules.maxLength) v = v.slice(0, rules.maxLength)
          onChange(v)
        }}
      />
      {param.help && <small className="help-text">{param.help}</small>}
      {rules.requireAlnum && text !== '' && !/[A-Za-z0-9]/.test(text) && (
        <small className="field-error" role="alert">
          Please enter at least one letter or number.
        </small>
      )}
    </>
  )
}

function FloatControl({
  param, value, onChange,
}: {
  param: ConfigParam
  value: unknown
  onChange: (value: number) => void
}) {
  const [min, max] = param.range ?? [0, 1]
  const num = Number(value ?? param.default ?? min)
  return (
    <>
      <label htmlFor={`cfg-${param.key}`}>{param.label}</label>
      <div className="size-control">
        <input
          id={`cfg-${param.key}`}
          type="range"
          min={min}
          max={max}
          step={param.step ?? 0.05}
          value={num}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        <div className="size-labels">
          <span>{min}</span>
          <span className="current-value">{num.toFixed(2)}</span>
          <span>{max}</span>
        </div>
      </div>
    </>
  )
}

function Control({
  param, values, onChange,
}: {
  param: ConfigParam
  values: Record<string, unknown>
  onChange: (key: string, value: unknown) => void
}) {
  const value = values[param.key]
  const set = (v: unknown) => onChange(param.key, v)
  switch (param.type) {
    case 'toggle':
      return (
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(event) => set(event.target.checked)}
          />
          <span>{param.label}</span>
        </label>
      )
    case 'menu':
      return (
        <>
          <label htmlFor={`cfg-${param.key}`}>{param.label}</label>
          <select
            id={`cfg-${param.key}`}
            value={String(value ?? '')}
            onChange={(event) => set(event.target.value)}
          >
            {(param.options ?? []).map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </>
      )
    case 'string':
      return <StringControl param={param} value={value} onChange={set} />
    case 'float':
      return <FloatControl param={param} value={value} onChange={set} />
    case 'int':
      return (
        <>
          <label htmlFor={`cfg-${param.key}`}>{param.label}</label>
          <input
            id={`cfg-${param.key}`}
            type="number"
            min={param.range?.[0]}
            max={param.range?.[1]}
            step={param.step ?? 1}
            value={Number(value ?? param.default ?? 0)}
            onChange={(event) => set(Number(event.target.value))}
          />
        </>
      )
    default:
      return null
  }
}

export default function ConfigControls({
  config, values, onChange, children,
}: {
  config: PublicOrnamentConfig
  values: Record<string, unknown>
  onChange: (key: string, value: unknown) => void
  children?: ReactNode
}) {
  const params = [...config.params].sort(
    (a, b) => (a.order ?? 999) - (b.order ?? 999))

  // Contiguous params sharing a visibleWhen rule render inside one
  // personalization-options wrapper, mirroring the legacy Add-name
  // section's markup.
  const blocks: { when: string | null; items: ConfigParam[] }[] = []
  for (const param of params) {
    const when = param.visibleWhen ? JSON.stringify(param.visibleWhen) : null
    const last = blocks[blocks.length - 1]
    if (last && last.when === when) last.items.push(param)
    else blocks.push({ when, items: [param] })
  }

  return (
    <>
      {blocks.map((block, i) => {
        const visible = block.items.some((p) => isVisible(p, values))
        const body = block.items.map((param) =>
          isVisible(param, values) && (
            <Control
              key={param.key}
              param={param}
              values={values}
              onChange={onChange}
            />
          ),
        )
        return block.when ? (
          visible && (
            <div key={i} className="personalization-options">
              {body}
            </div>
          )
        ) : (
          <span key={i} style={{ display: 'contents' }}>
            {body}
          </span>
        )
      })}
      {children}
    </>
  )
}
