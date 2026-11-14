import { Circle, Document, Ellipse, G, Image, Page, Path, Rect, StyleSheet, Svg, Text, View } from '@react-pdf/renderer';
import type { Primitive, Scene } from '../drawing/primitives';
import type { PdfDocumentModel, PdfDrill, PdfMedia, PdfSession, Span, TextBlock } from './model';

/**
 * The PDF of a session or a season (SPEC.md section 7, "Snygg PDF av ett pass").
 * Uses the PDF standard font Helvetica, which covers Swedish and English and
 * needs no font download. Drawings are vector graphics.
 */

const A4 = { width: 595.28, height: 841.89 };
const MARGIN = 40;
const GAP = 10;
const TEXT_SCALE = 100;
/** A single drawing per row would fill the page; this keeps room for the heading. */
const MAX_MEDIA_HEIGHT = { portrait: 330, landscape: 300 };

const ink = '#0F172A';
const muted = '#64748B';
const rule = '#E2E8F0';

const s = StyleSheet.create({
  page: { paddingTop: MARGIN + 18, paddingBottom: MARGIN + 10, paddingHorizontal: MARGIN, fontFamily: 'Helvetica', fontSize: 10, color: ink },
  header: { position: 'absolute', top: 20, left: MARGIN, right: MARGIN, flexDirection: 'row', justifyContent: 'space-between', fontSize: 8, color: muted, borderBottomWidth: 0.5, borderBottomColor: rule, paddingBottom: 4 },
  footer: { position: 'absolute', bottom: 22, left: MARGIN, right: MARGIN, fontSize: 8, color: muted },
  title: { fontSize: 22, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  subtitle: { fontSize: 11, color: muted, marginBottom: 10 },
  facts: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 10 },
  fact: { width: '50%', flexDirection: 'row', marginBottom: 3 },
  factLabel: { width: 90, color: muted },
  h2: { fontSize: 13, fontFamily: 'Helvetica-Bold', marginTop: 8, marginBottom: 6 },
  tableHead: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: ink, paddingBottom: 3, fontFamily: 'Helvetica-Bold', fontSize: 9 },
  row: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: rule, paddingVertical: 3.5, alignItems: 'center' },
  sectionRow: { flexDirection: 'row', paddingTop: 7, paddingBottom: 3, borderBottomWidth: 0.5, borderBottomColor: rule, fontFamily: 'Helvetica-Bold' },
  colTime: { width: 72 },
  colTitle: { flex: 1, paddingRight: 6 },
  colType: { width: 120, flexDirection: 'row', alignItems: 'center' },
  colMin: { width: 58, textAlign: 'right' },
  swatch: { width: 8, height: 8, borderRadius: 2, marginRight: 5 },
  totalRow: { flexDirection: 'row', paddingTop: 5, fontFamily: 'Helvetica-Bold' },
  drill: { marginTop: 16, borderLeftWidth: 4, paddingLeft: 10 },
  drillHead: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 4 },
  drillTitle: { flex: 1, fontSize: 13, fontFamily: 'Helvetica-Bold' },
  drillMeta: { fontSize: 9, color: muted },
  heading: { fontFamily: 'Helvetica-Bold', fontSize: 10.5, marginTop: 4, marginBottom: 2 },
  paragraph: { marginBottom: 3 },
  item: { flexDirection: 'row', marginBottom: 1.5 },
  itemText: { flex: 1 },
  marker: { width: 14 },
  mediaRow: { flexDirection: 'row', marginTop: 8 },
  caption: { fontSize: 8.5, color: muted, marginTop: 2, textAlign: 'center' },
});

function Spans({ spans }: { spans: Span[] }) {
  return (
    <>
      {spans.map((sp, i) => (
        <Text key={i} style={sp.bold && sp.italic ? { fontFamily: 'Helvetica-BoldOblique' } : sp.bold ? { fontFamily: 'Helvetica-Bold' } : sp.italic ? { fontFamily: 'Helvetica-Oblique' } : {}}>
          {sp.text}
        </Text>
      ))}
    </>
  );
}

function TextBlocks({ blocks }: { blocks: TextBlock[] }) {
  return (
    <>
      {blocks.map((b, i) =>
        b.kind === 'item' ? (
          <View key={i} style={[s.item, { paddingLeft: b.depth * 12 }]} wrap={false}>
            <Text style={s.marker}>{b.marker}</Text>
            <Text style={s.itemText}>
              <Spans spans={b.spans} />
            </Text>
          </View>
        ) : (
          <Text key={i} style={b.kind === 'heading' ? s.heading : s.paragraph} minPresenceAhead={b.kind === 'heading' ? 24 : undefined}>
            <Spans spans={b.spans} />
          </Text>
        ),
      )}
    </>
  );
}

function Shape({ p }: { p: Primitive }) {
  if (p.kind === 'text') {
    // Court text is under a metre high; react-pdf lays out such small text badly,
    // so it is set 100 times larger and scaled down.
    const svgText = { x: 0, y: 0, fill: p.fill, textAnchor: 'middle' as const, style: { fontSize: p.size * TEXT_SCALE, fontFamily: p.bold ? 'Helvetica-Bold' : 'Helvetica' } };
    return (
      <G transform={`translate(${p.x} ${p.y}) scale(${1 / TEXT_SCALE})`}>
        {p.halo && (
          <Text {...svgText} stroke={p.halo} strokeWidth={p.size * 0.12 * TEXT_SCALE} fill={p.halo}>
            {p.text}
          </Text>
        )}
        <Text {...svgText}>{p.text}</Text>
      </G>
    );
  }
  const paint = {
    fill: p.fill ?? 'none',
    fillOpacity: p.fillOpacity,
    stroke: p.stroke,
    strokeWidth: p.stroke ? (p.strokeWidth ?? 0.05) : undefined,
    strokeDasharray: p.dash,
    strokeLinecap: p.round ? ('round' as const) : undefined,
    strokeLinejoin: p.round ? ('round' as const) : undefined,
  };
  switch (p.kind) {
    case 'path':
      return <Path d={p.d} {...paint} />;
    case 'circle':
      return <Circle cx={p.cx} cy={p.cy} r={p.r} {...paint} />;
    case 'ellipse':
      return <Ellipse cx={p.cx} cy={p.cy} rx={p.rx} ry={p.ry} {...paint} />;
    case 'rect':
      return <Rect x={p.x} y={p.y} width={p.width} height={p.height} {...paint} />;
  }
}

export function SceneSvg({ scene, width }: { scene: Scene; width: number }) {
  const { minX, minY, width: w, height: h } = scene.bounds;
  return (
    <Svg width={width} height={(width * h) / w} viewBox={`${minX} ${minY} ${w} ${h}`}>
      {scene.primitives.map((p, i) => (
        <Shape key={i} p={p} />
      ))}
    </Svg>
  );
}

/** Size of one picture in a row: as wide as its column, but never taller than the limit. */
export function mediaSize(m: PdfMedia, column: number, maxHeight: number): { width: number; height: number } {
  const ratio = m.kind === 'diagram' ? m.scene.bounds.height / m.scene.bounds.width : m.height / m.width;
  const width = Math.min(column, maxHeight / ratio);
  return { width, height: width * ratio };
}

function MediaRow({ row, perRow, contentWidth, maxHeight }: { row: PdfMedia[]; perRow: number; contentWidth: number; maxHeight: number }) {
  const column = (contentWidth - GAP * (perRow - 1)) / perRow;
  return (
    // A row is one unit: a picture is never split over two pages.
    <View style={s.mediaRow} wrap={false}>
      {row.map((m, i) => {
        const size = mediaSize(m, column, maxHeight);
        return (
          <View key={i} style={{ width: column, marginRight: i < row.length - 1 ? GAP : 0, alignItems: 'center' }}>
            {m.kind === 'diagram' ? <SceneSvg scene={m.scene} width={size.width} /> : <Image src={m.src} style={{ width: size.width, height: size.height, objectFit: 'contain' }} />}
            {m.caption ? <Text style={s.caption}>{m.caption}</Text> : null}
          </View>
        );
      })}
    </View>
  );
}

/**
 * One drill. It flows over pages like text, but a row of pictures is never
 * split: when it does not fit, it starts on a new page (SPEC.md section 7).
 * The heading never stays alone at the bottom of a page.
 */
function Drill({ d, contentWidth, perRow, maxHeight }: { d: PdfDrill; contentWidth: number; perRow: number; maxHeight: number }) {
  return (
    <View style={[s.drill, { borderLeftColor: d.color }]}>
      <View style={s.drillHead} minPresenceAhead={80} wrap={false}>
        <Text style={s.drillTitle}>
          {d.number}. {d.title}
        </Text>
        <Text style={s.drillMeta}>
          {d.time} · {d.minutes}
          {d.typeName ? ` · ${d.typeName}` : ''}
        </Text>
      </View>
      <TextBlocks blocks={d.text} />
      {d.facts.map((f) => (
        <Text key={f.label} style={s.paragraph}>
          <Text style={{ fontFamily: 'Helvetica-Bold' }}>{f.label}: </Text>
          {f.value}
        </Text>
      ))}
      {d.rows.map((row, i) => (
        <MediaRow key={i} row={row} perRow={perRow} contentWidth={contentWidth - 14} maxHeight={maxHeight} />
      ))}
    </View>
  );
}

function SessionPart({ session, model, contentWidth }: { session: PdfSession; model: PdfDocumentModel; contentWidth: number }) {
  const { labels, options } = model;
  const maxHeight = MAX_MEDIA_HEIGHT[options.orientation];
  return (
    <>
      <Text style={s.title}>{session.title}</Text>
      {session.subtitle ? <Text style={s.subtitle}>{session.subtitle}</Text> : null}
      <View style={s.facts}>
        {session.facts.map((f) => (
          <View key={f.label} style={s.fact}>
            <Text style={s.factLabel}>{f.label}</Text>
            <Text style={{ flex: 1 }}>{f.value}</Text>
          </View>
        ))}
      </View>
      <TextBlocks blocks={session.description} />

      <Text style={s.h2}>{labels.schedule}</Text>
      <View style={s.tableHead}>
        <Text style={s.colTime}>{labels.time}</Text>
        <Text style={s.colTitle}>{labels.drill}</Text>
        <Text style={s.colType}>{labels.type}</Text>
        <Text style={s.colMin}>{labels.minutes}</Text>
      </View>
      {session.schedule.map((r, i) =>
        r.section ? (
          <View key={i} style={s.sectionRow} wrap={false} minPresenceAhead={20}>
            <Text style={s.colTime}>{r.time}</Text>
            <Text style={s.colTitle}>{r.title}</Text>
            <Text style={s.colType} />
            <Text style={s.colMin}>{r.minutes}</Text>
          </View>
        ) : (
          <View key={i} style={s.row} wrap={false}>
            <Text style={s.colTime}>{r.time}</Text>
            <Text style={s.colTitle}>
              {r.number ? `${r.number}. ` : ''}
              {r.title}
            </Text>
            <View style={s.colType}>
              <View style={[s.swatch, { backgroundColor: r.color }]} />
              <Text style={{ flex: 1 }}>{r.typeName}</Text>
            </View>
            <Text style={s.colMin}>{r.minutes}</Text>
          </View>
        ),
      )}
      <View style={s.totalRow}>
        <Text style={{ flex: 1 }}>{labels.total}</Text>
        <Text style={s.colMin}>{session.total}</Text>
      </View>

      {session.drills.map((d) => (
        <Drill key={d.number} d={d} contentWidth={contentWidth} perRow={options.perRow} maxHeight={maxHeight} />
      ))}
    </>
  );
}

export function PdfDocument({ model }: { model: PdfDocumentModel }) {
  const { options, labels } = model;
  const landscape = options.orientation === 'landscape';
  const pageWidth = landscape ? A4.height : A4.width;
  const contentWidth = pageWidth - 2 * MARGIN;
  return (
    <Document title={model.documentTitle} language={model.language} creator="Basketapp" producer="Basketapp">
      {/* A season gets one part per session, each starting on a new page. */}
      {model.sessions.map((session, i) => (
        <Page key={i} size="A4" orientation={options.orientation} style={s.page} wrap>
          <View style={s.header} fixed>
            <Text>{model.header}</Text>
            <Text>{model.headerDate}</Text>
          </View>
          <SessionPart session={session} model={model} contentWidth={contentWidth} />
          {/* No lineHeight anywhere in this document: react-pdf mishandles unitless values (extra lines, and a footer that drifts off the page from page 10). */}
          <View style={s.footer} fixed>
            <Text style={{ textAlign: 'center' }} render={({ pageNumber, totalPages }) => labels.page.replace('{{page}}', String(pageNumber)).replace('{{total}}', String(totalPages))} />
          </View>

        </Page>
      ))}
    </Document>
  );
}
