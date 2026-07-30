// Hand-rolled SVG radar for the seven personality axes. No chart library — a regular
// heptagon is ~15 lines of trigonometry and a dependency is 40kB.
//
// Geometry lives in user units inside a fixed viewBox and the <svg> scales to its
// container, so the whole thing is resolution-independent and needs no measurement.

// Concentric guide rings, as a fraction of the outer radius.
const RINGS = [0.25, 0.5, 0.75, 1]

const VIEW_W = 250
const VIEW_H = 218
const CX = VIEW_W / 2
const CY = 104
const RADIUS = 68
const LABEL_GAP = 17 // how far outside the outer ring the axis labels sit

// Axis values are 0-1 weights; a plotted point never collapses fully into the centre,
// which would make a low-scoring profile read as a broken chart rather than a low score.
const MIN_PLOT = 0.08

/** Vertex angle for axis `i` of `n`, starting at 12 o'clock and going clockwise. */
const angleFor = (i, n) => (Math.PI * 2 * i) / n - Math.PI / 2

function pointAt(angle, radius) {
  return [CX + Math.cos(angle) * radius, CY + Math.sin(angle) * radius]
}

const toPolygon = (points) => points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ')

/**
 * @param {{ axes: {key: string, label: string, value: number}[], animate?: boolean }} props
 */
export default function PersonaRadar({ axes, animate = true }) {
  const n = axes.length
  const angles = axes.map((_, i) => angleFor(i, n))

  const shape = toPolygon(
    axes.map((axis, i) => pointAt(angles[i], RADIUS * Math.max(MIN_PLOT, axis.value))),
  )

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      className="w-full h-auto block"
      role="img"
      aria-label={`Persona radar: ${axes.map((a) => `${a.label} ${Math.round(a.value * 100)}`).join(', ')}`}
    >
      <defs>
        <radialGradient id="radar-fill" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#e8c56f" stopOpacity="0.42" />
          <stop offset="100%" stopColor="#d4a843" stopOpacity="0.14" />
        </radialGradient>
      </defs>

      {/* Guide rings */}
      {RINGS.map((ring) => (
        <polygon
          key={ring}
          points={toPolygon(angles.map((a) => pointAt(a, RADIUS * ring)))}
          fill="none"
          stroke="rgba(255,255,255,0.07)"
          strokeWidth="0.75"
        />
      ))}

      {/* Spokes */}
      {angles.map((a, i) => {
        const [x, y] = pointAt(a, RADIUS)
        return (
          <line
            key={i}
            x1={CX}
            y1={CY}
            x2={x}
            y2={y}
            stroke="rgba(255,255,255,0.055)"
            strokeWidth="0.75"
          />
        )
      })}

      {/* The profile itself. transform-origin is given in user units — a CSS keyword
          would resolve against the element box and grow from the wrong point. */}
      <g
        className={animate ? 'radar-shape' : undefined}
        style={{ transformOrigin: `${CX}px ${CY}px` }}
      >
        <polygon
          points={shape}
          fill="url(#radar-fill)"
          stroke="#d4a843"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        {axes.map((axis, i) => {
          const [x, y] = pointAt(angles[i], RADIUS * Math.max(MIN_PLOT, axis.value))
          return (
            <circle
              key={axis.key}
              className={animate ? 'radar-vertex' : undefined}
              style={animate ? { animationDelay: `${420 + i * 55}ms` } : undefined}
              cx={x}
              cy={y}
              r="2.6"
              fill="#e8c56f"
            />
          )
        })}
      </g>

      {/* Axis labels — anchored by which side of the centre they fall on, so nothing
          overhangs the viewBox at the 3 and 9 o'clock positions. */}
      {axes.map((axis, i) => {
        const [x, y] = pointAt(angles[i], RADIUS + LABEL_GAP)
        const anchor = x < CX - 1 ? 'end' : x > CX + 1 ? 'start' : 'middle'
        return (
          <text
            key={axis.key}
            x={x}
            y={y}
            textAnchor={anchor}
            dominantBaseline="middle"
            fontSize="8.5"
            letterSpacing="0.09em"
            fill="#5c5852"
            style={{ textTransform: 'uppercase' }}
          >
            {axis.label}
          </text>
        )
      })}
    </svg>
  )
}
