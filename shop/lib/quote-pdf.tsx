import React from "react";
import {
  Document,
  Page,
  View,
  Text,
  Image,
  Svg,
  Path,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { OrderItem, OrderData } from "./email";
import { SIGN_TYPE_COLORS } from "./email";

/* ------------------------------------------------------------------ */
/*  Colours                                                            */
/* ------------------------------------------------------------------ */
const C = {
  navy: "#00474a",
  green: "#3db28c",
  lightGreenBg: "#f8faf9",
  greenBorder: "#bbf7d0",
  orangeBg: "#fff7ed",
  orangeBorder: "#fed7aa",
  orangeText: "#c2410c",
  grey: "#666666",
  lightGrey: "#f5f5f5",
  darkText: "#333333",
  divider: "#eeeeee",
  white: "#ffffff",
};

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */
const s = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    paddingTop: 0,
    paddingBottom: 40,
    paddingHorizontal: 0,
    color: C.darkText,
  },
  headerBar: {
    backgroundColor: C.navy,
    paddingVertical: 18,
    paddingHorizontal: 32,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: {
    color: C.white,
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 1,
  },
  headerSub: {
    fontSize: 8,
    color: C.grey,
    textAlign: "center",
    marginTop: 6,
    paddingHorizontal: 32,
  },
  body: { paddingHorizontal: 32, paddingTop: 16 },
  orderBox: {
    backgroundColor: C.lightGreenBg,
    borderWidth: 1,
    borderColor: C.greenBorder,
    borderRadius: 6,
    padding: 14,
    marginBottom: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  orderNumber: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: C.navy,
  },
  orderDate: { fontSize: 10, color: C.grey },
  infoRow: { flexDirection: "row", columnGap: 24, marginBottom: 14 },
  infoCol: { flex: 1 },
  infoLabel: {
    fontSize: 8,
    color: "#999999",
    textTransform: "uppercase",
    marginBottom: 3,
    letterSpacing: 0.5,
  },
  infoValue: { fontSize: 10, color: C.darkText },
  infoBold: { fontSize: 10, fontFamily: "Helvetica-Bold", color: C.darkText },
  poLine: { fontSize: 10, color: C.grey, marginBottom: 14 },
  poBold: { fontFamily: "Helvetica-Bold" },

  /* ---------- Items table ---------- */
  tableHeader: {
    flexDirection: "row",
    backgroundColor: C.lightGrey,
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: C.divider,
  },
  tableHeaderText: {
    fontSize: 8,
    color: C.grey,
    textTransform: "uppercase",
    fontFamily: "Helvetica-Bold",
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: C.divider,
    alignItems: "center",
  },
  tableRowAlt: { backgroundColor: "#fafafa" },
  colImage: { width: 48, paddingRight: 6 },
  colProduct: { flex: 1, paddingRight: 8 },
  colQty: { width: 40, textAlign: "center" },
  colPrice: { width: 55, textAlign: "right" },
  colTotal: { width: 65, textAlign: "right" },
  productImage: {
    width: 38,
    height: 38,
    borderRadius: 4,
    objectFit: "contain" as const,
    backgroundColor: "#f8f8f8",
  },
  productCode: { fontSize: 10, fontFamily: "Helvetica-Bold", color: C.darkText },
  productName: { fontSize: 9, color: C.grey, marginTop: 1 },
  customFieldText: { fontSize: 8, color: C.navy, marginTop: 1 },
  customFieldValue: { color: C.grey },
  qtyText: { fontSize: 11, textAlign: "center" },
  priceText: { fontSize: 10, textAlign: "right", color: C.grey },
  totalText: { fontSize: 10, textAlign: "right", fontFamily: "Helvetica-Bold", color: C.darkText },

  /* ---------- Custom sign badge ---------- */
  signBadge: {
    width: 38,
    height: 38,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  signBadgeText: { fontSize: 7, fontFamily: "Helvetica-Bold", textAlign: "center" },
  customSignTitle: { fontSize: 10, fontFamily: "Helvetica-Bold", color: C.darkText },
  customSignDetail: { fontSize: 9, color: C.grey, marginTop: 1 },
  customSignText: { fontSize: 9, color: C.orangeText, marginTop: 1 },
  customSignNotes: { fontSize: 8, color: "#999999", marginTop: 1 },

  /* ---------- Totals ---------- */
  totalsSection: { marginTop: 8, alignItems: "flex-end" },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingVertical: 3,
  },
  totalsLabel: { fontSize: 10, color: C.grey, width: 80, textAlign: "right", marginRight: 12 },
  totalsValue: { fontSize: 10, width: 70, textAlign: "right", color: C.darkText },
  totalsBold: { fontFamily: "Helvetica-Bold", fontSize: 12 },
  totalsDivider: {
    borderTopWidth: 1,
    borderTopColor: C.divider,
    marginVertical: 4,
    width: 162,
    alignSelf: "flex-end",
  },
  vatNote: {
    fontSize: 8,
    color: C.grey,
    textAlign: "right",
    marginTop: 2,
  },
  customQuoteNote: {
    marginTop: 6,
    fontSize: 8,
    color: C.orangeText,
    textAlign: "right",
  },

  /* ---------- Notes ---------- */
  notesBox: {
    backgroundColor: C.orangeBg,
    borderWidth: 1,
    borderColor: C.orangeBorder,
    borderRadius: 6,
    padding: 10,
    marginTop: 16,
  },
  notesLabel: { fontFamily: "Helvetica-Bold", fontSize: 10, color: C.orangeText },
  notesText: { fontSize: 10, color: C.orangeText },

  /* ---------- Footer ---------- */
  footer: {
    position: "absolute",
    bottom: 16,
    left: 32,
    right: 32,
    borderTopWidth: 1,
    borderTopColor: C.navy,
    paddingTop: 6,
  },
  footerText: { fontSize: 8, color: C.grey, textAlign: "center" },
});

/* ------------------------------------------------------------------ */
/*  Image helpers (shared pattern with delivery-note)                  */
/* ------------------------------------------------------------------ */
async function fetchImageAsDataUri(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const base64 = buf.toString("base64");
    const contentType = res.headers.get("content-type") || "image/png";
    return `data:${contentType};base64,${base64}`;
  } catch {
    return null;
  }
}

interface ImageMap { [code: string]: string }

async function buildImageMap(items: OrderItem[], siteUrl: string): Promise<ImageMap> {
  const map: ImageMap = {};
  const seen = new Set<string>();
  const fetches = items
    .filter((item) => !item.custom_data?.signType)
    .map((item) => {
      const imgCode = (item.base_code || item.code.replace(/\/.*$/, "")).replace(/\//g, "_");
      if (seen.has(imgCode)) return null;
      seen.add(imgCode);
      return fetchImageAsDataUri(`${siteUrl}/images/products/${imgCode}.png`).then((uri) => {
        if (uri) map[imgCode] = uri;
      });
    })
    .filter(Boolean);
  await Promise.all(fetches);
  return map;
}

function fmt(n: number) { return `\u00A3${n.toFixed(2)}`; }

/* ------------------------------------------------------------------ */
/*  Onesign icon                                                       */
/* ------------------------------------------------------------------ */
function OnesignIcon({ size = 28 }: { size?: number }) {
  const w = size * (28.71 / 24.32);
  return (
    <Svg viewBox="0 0 28.71 24.32" width={w} height={size}>
      <Path
        d="M24.88,3.25c-2.55-2.17-6.06-3.25-10.51-3.25S6.4,1.08,3.84,3.25C1.28,5.42,0,8.39,0,12.15s1.29,6.73,3.86,8.92c2.36,2,5.5,3.08,9.42,3.25v-10.13H5.23v-4.99h.68c2.5,0,4.4-.39,5.7-1.18,1.3-.79,2.14-2.06,2.52-3.8h6.32v19.26c1.7-.55,3.17-1.35,4.42-2.42,2.56-2.18,3.84-5.16,3.84-8.92s-1.28-6.73-3.83-8.9"
        fill={C.white}
      />
    </Svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Item rows                                                          */
/* ------------------------------------------------------------------ */
function StandardItemRow({ item, images, index }: { item: OrderItem; images: ImageMap; index: number }) {
  const imgCode = (item.base_code || item.code.replace(/\/.*$/, "")).replace(/\//g, "_");
  const imgUri = images[imgCode];
  const customFields = item.custom_data?.fields as Array<{ label: string; key: string; value: string }> | undefined;

  return (
    <View style={[s.tableRow, index % 2 === 1 ? s.tableRowAlt : {}]} wrap={false}>
      <View style={s.colImage}>
        {imgUri ? (
          <Image src={imgUri} style={s.productImage} />
        ) : (
          <View style={[s.productImage, { backgroundColor: "#f0f0f0" }]} />
        )}
      </View>
      <View style={s.colProduct}>
        <Text style={s.productCode}>{item.code}</Text>
        <Text style={s.productName}>
          {item.name}{item.size ? ` (${item.size})` : ""}
        </Text>
        {customFields?.map((f) => (
          <Text key={f.key} style={s.customFieldText}>
            {f.label}: <Text style={s.customFieldValue}>{f.value}</Text>
          </Text>
        ))}
      </View>
      <View style={s.colQty}><Text style={s.qtyText}>{item.quantity}</Text></View>
      <View style={s.colPrice}><Text style={s.priceText}>{fmt(item.price)}</Text></View>
      <View style={s.colTotal}><Text style={s.totalText}>{fmt(item.line_total)}</Text></View>
    </View>
  );
}

function CustomSignRow({ item, index }: { item: OrderItem; index: number }) {
  const cd = item.custom_data!;
  const colors = SIGN_TYPE_COLORS[cd.signType || ""] || { bg: "#666", fg: "#FFF" };
  const typeLabel = (cd.signType || "custom").charAt(0).toUpperCase() + (cd.signType || "custom").slice(1).replace("-", " ");

  return (
    <View style={[s.tableRow, index % 2 === 1 ? s.tableRowAlt : {}]} wrap={false}>
      <View style={s.colImage}>
        <View style={[s.signBadge, { backgroundColor: colors.bg }]}>
          <Text style={[s.signBadgeText, { color: colors.fg }]}>{typeLabel}</Text>
        </View>
      </View>
      <View style={s.colProduct}>
        <Text style={s.customSignTitle}>CUSTOM SIGN REQUEST</Text>
        <Text style={s.customSignDetail}>{typeLabel} {"\u00B7"} {cd.shape} {"\u00B7"} {item.size}</Text>
        <Text style={s.customSignText}>Text: {"\u201C"}{cd.textContent}{"\u201D"}</Text>
        {cd.additionalNotes ? <Text style={s.customSignNotes}>Notes: {cd.additionalNotes}</Text> : null}
      </View>
      <View style={s.colQty}><Text style={s.qtyText}>{item.quantity}</Text></View>
      <View style={s.colPrice}><Text style={s.priceText}>Quote</Text></View>
      <View style={s.colTotal}><Text style={s.priceText}>Quote</Text></View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Document                                                      */
/* ------------------------------------------------------------------ */
function QuoteDocument({ order, images }: { order: OrderData; images: ImageMap }) {
  const orderDate = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const hasCustom = order.items.some((i) => !!i.custom_data?.signType);

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.headerBar}>
          <OnesignIcon size={26} />
          <Text style={s.headerTitle}>QUOTATION</Text>
        </View>
        <Text style={s.headerSub}>
          Onesign and Digital {"  |  "} D86 Princesway, Gateshead NE11 0TU {"  |  "} 0191 487 6767
        </Text>

        <View style={s.body}>
          <View style={s.orderBox}>
            <View><Text style={s.orderNumber}>{order.orderNumber}</Text></View>
            <Text style={s.orderDate}>{orderDate}</Text>
          </View>

          <View style={s.infoRow}>
            <View style={s.infoCol}>
              <Text style={s.infoLabel}>Site</Text>
              <Text style={s.infoBold}>{order.siteName}</Text>
              <Text style={s.infoValue}>{order.siteAddress}</Text>
            </View>
            <View style={s.infoCol}>
              <Text style={s.infoLabel}>Contact</Text>
              <Text style={s.infoBold}>{order.contactName}</Text>
              <Text style={s.infoValue}>{order.email}</Text>
              <Text style={s.infoValue}>{order.phone}</Text>
            </View>
          </View>

          {order.poNumber ? (
            <Text style={s.poLine}><Text style={s.poBold}>PO Number: </Text>{order.poNumber}</Text>
          ) : null}

          {/* Items table */}
          <View style={s.tableHeader}>
            <View style={s.colImage} />
            <View style={s.colProduct}><Text style={s.tableHeaderText}>Product</Text></View>
            <View style={s.colQty}><Text style={[s.tableHeaderText, { textAlign: "center" }]}>Qty</Text></View>
            <View style={s.colPrice}><Text style={[s.tableHeaderText, { textAlign: "right" }]}>Price</Text></View>
            <View style={s.colTotal}><Text style={[s.tableHeaderText, { textAlign: "right" }]}>Total</Text></View>
          </View>
          {order.items.map((item, i) =>
            item.custom_data?.signType ? (
              <CustomSignRow key={i} item={item} index={i} />
            ) : (
              <StandardItemRow key={i} item={item} images={images} index={i} />
            )
          )}

          {/* Totals */}
          <View style={s.totalsSection}>
            <View style={s.totalsDivider} />
            <View style={s.totalsRow}>
              <Text style={s.totalsLabel}>Subtotal</Text>
              <Text style={s.totalsValue}>{fmt(order.subtotal)}</Text>
            </View>
            <View style={s.totalsRow}>
              <Text style={s.totalsLabel}>Delivery</Text>
              <Text style={s.totalsValue}>
                {order.deliveryFee > 0 ? fmt(order.deliveryFee) : "FREE"}
              </Text>
            </View>
            <View style={s.totalsDivider} />
            <View style={s.totalsRow}>
              <Text style={[s.totalsLabel, s.totalsBold]}>Total</Text>
              <Text style={[s.totalsValue, s.totalsBold]}>{fmt(order.subtotal + order.deliveryFee)}</Text>
            </View>
            <Text style={s.vatNote}>inc. VAT: {fmt((order.subtotal + order.deliveryFee) * 1.2)}</Text>
            {hasCustom && (
              <Text style={s.customQuoteNote}>* Custom sign items priced on request</Text>
            )}
          </View>

          {order.notes ? (
            <View style={s.notesBox}>
              <Text style={s.notesText}>
                <Text style={s.notesLabel}>Notes: </Text>{order.notes}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={s.footer} fixed>
          <Text style={s.footerText}>Onesign and Digital {"  |  "} onesignanddigital.com</Text>
        </View>
      </Page>
    </Document>
  );
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */
export async function generateQuotePdf(order: OrderData): Promise<string> {
  const siteUrl = process.env.SITE_URL || "http://localhost:3000";
  const images = await buildImageMap(order.items, siteUrl);
  const buffer = await renderToBuffer(<QuoteDocument order={order} images={images} />);
  return Buffer.from(buffer).toString("base64");
}
