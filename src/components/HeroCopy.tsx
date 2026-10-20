import { hero } from '../content/site'

type BeatId = 'establish' | 'detail' | 'resolve'

/** Copy for one hero beat. Shared by the scroll scene and the reduced-motion version. */
export function HeroCopy({ beat }: { beat: BeatId }) {
  if (beat === 'establish') {
    const c = hero.establish
    return (
      <>
        <p className="eyebrow">{c.eyebrow}</p>
        <h1 className="hero-title">{c.title}</h1>
        <p className="hero-body">{c.body}</p>
        <div className="hero-actions">
          <a className="btn btn-primary" href={c.primary.href}>
            {c.primary.label}
          </a>
          <a className="btn btn-ghost" href={c.secondary.href}>
            {c.secondary.label}
          </a>
        </div>
      </>
    )
  }

  if (beat === 'detail') {
    const c = hero.detail
    return (
      <>
        <p className="eyebrow">{c.eyebrow}</p>
        <h2 className="hero-title hero-title--md">{c.title}</h2>
        <ul className="hero-list">
          {c.items.map((item, i) => (
            <li key={item.href}>
              <a href={item.href}>
                <span className="hero-list-index" aria-hidden="true">
                  0{i + 1}
                </span>
                <span className="hero-list-label">{item.label}</span>
              </a>
            </li>
          ))}
        </ul>
      </>
    )
  }

  const c = hero.resolve
  return (
    <>
      <p className="eyebrow">{c.eyebrow}</p>
      <h2 className="hero-title hero-title--md">{c.title}</h2>
      <p className="hero-body">{c.body}</p>
      <div className="hero-actions">
        <a className="btn btn-primary" href={c.primary.href}>
          {c.primary.label}
        </a>
      </div>
    </>
  )
}
