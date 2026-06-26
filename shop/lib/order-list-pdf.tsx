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

  /* ---------- Group header ---------- */
  groupHeader: {
    backgroundColor: C.navy,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 4,
    marginTop: 14,
    marginBottom: 4,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  groupHeaderFirst: { marginTop: 0 },
  groupTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: C.white,
  },
  groupCount: {
    fontSize: 9,
    color: C.green,
  },

  /* ---------- Items table ---------- */
  tableHeader: {
    flexDirection: "row",
    backgroundColor: C.lightGrey,
    paddingVertical: 5,
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
    paddingVertical: 7,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: C.divider,
    alignItems: "center",
  },
  tableRowAlt: { backgroundColor: "#fafafa" },
  colImage: { width: 44, paddingRight: 4 },
  colProduct: { flex: 1, paddingRight: 8 },
  colMaterial: { width: 65, paddingRight: 6 },
  colArtwork: { width: 42, textAlign: "center" },
  colQty: { width: 36, textAlign: "center" },
  colCheck: { width: 28, textAlign: "center" },
  productImage: {
    width: 34,
    height: 34,
    borderRadius: 4,
    objectFit: "contain" as const,
    backgroundColor: "#f8f8f8",
  },
  productCode: { fontSize: 10, fontFamily: "Helvetica-Bold", color: C.darkText },
  productName: { fontSize: 9, color: C.grey, marginTop: 1 },
  customFieldText: { fontSize: 8, color: C.navy, marginTop: 1 },
  customFieldValue: { color: C.grey },
  materialText: { fontSize: 9, color: C.grey },
  qtyText: { fontSize: 11, textAlign: "center", fontFamily: "Helvetica-Bold" },
  artworkYes: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: C.green,
    textAlign: "center",
  },
  artworkNo: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#d97706",
    textAlign: "center",
  },
  checkBox: {
    width: 14,
    height: 14,
    borderWidth: 1.5,
    borderColor: "#cccccc",
    borderRadius: 3,
    marginLeft: "auto",
    marginRight: "auto",
  },

  /* ---------- Custom sign badge ---------- */
  signBadge: {
    width: 34,
    height: 34,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  signBadgeText: { fontSize: 7, fontFamily: "Helvetica-Bold", textAlign: "center" },
  customSignTitle: { fontSize: 10, fontFamily: "Helvetica-Bold", color: C.darkText },
  customSignDetail: { fontSize: 9, color: C.grey, marginTop: 1 },
  customSignText: { fontSize: 9, color: C.orangeText, marginTop: 1 },
  customSignNotes: { fontSize: 8, color: "#999999", marginTop: 1 },

  /* ---------- Summary ---------- */
  summaryBox: {
    backgroundColor: C.lightGreenBg,
    borderWidth: 1,
    borderColor: C.greenBorder,
    borderRadius: 6,
    padding: 12,
    marginTop: 16,
    flexDirection: "row",
    justifyContent: "space-around",
  },
  summaryItem: { alignItems: "center" },
  summaryNumber: { fontSize: 18, fontFamily: "Helvetica-Bold", color: C.navy },
  summaryLabel: { fontSize: 8, color: C.grey, textTransform: "uppercase", marginTop: 2 },

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

  /* ---------- Continuation notice ---------- */
  continuationWrap: {
    position: "absolute",
    bottom: 42,
    left: 32,
    right: 32,
    alignItems: "center",
  },
  continuationBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.lightGreenBg,
    borderWidth: 1,
    borderColor: C.greenBorder,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  continuationText: {
    fontSize: 9,
    color: C.navy,
    fontFamily: "Helvetica-Bold",
  },
  continuationArrow: {
    fontSize: 11,
    color: C.green,
    marginLeft: 6,
  },
  pageNum: {
    fontSize: 8,
    color: C.grey,
    marginLeft: 8,
  },

  /* ---------- Footer ---------- */
  footer: {
    position: "absolute",
    bottom: 16,
    left: 32,
    right: 32,
    borderTopWidth: 1,
    borderTopColor: C.navy,
    paddingTop: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerText: { fontSize: 8, color: C.grey },
  footerPage: { fontSize: 8, color: C.grey },
});

/* ------------------------------------------------------------------ */
/*  Image helpers                                                      */
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
/*  Grouping logic                                                     */
/* ------------------------------------------------------------------ */
interface GroupedItems {
  label: string;
  items: OrderItem[];
  totalQty: number;
}

function groupItemsBySize(items: OrderItem[]): { standard: GroupedItems[]; custom: OrderItem[] } {
  const custom: OrderItem[] = [];
  const sizeMap = new Map<string, OrderItem[]>();

  for (const item of items) {
    if (item.custom_data?.signType) {
      custom.push(item);
      continue;
    }
    const key = item.size || "No size specified";
    if (!sizeMap.has(key)) sizeMap.set(key, []);
    sizeMap.get(key)!.push(item);
  }

  // Sort groups by size label, aggregate quantities
  const standard: GroupedItems[] = Array.from(sizeMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, groupItems]) => {
      // Within each group, sort by product code
      groupItems.sort((a, b) => a.code.localeCompare(b.code));
      const totalQty = groupItems.reduce((sum, i) => sum + i.quantity, 0);
      return { label, items: groupItems, totalQty };
    });

  return { standard, custom };
}

/* ------------------------------------------------------------------ */
/*  Item row components                                                */
/* ------------------------------------------------------------------ */
function StandardItemRow({ item, images, index, hasArtwork }: { item: OrderItem; images: ImageMap; index: number; hasArtwork: boolean }) {
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
        <Text style={s.productName}>{item.name}</Text>
        {customFields?.map((f) => (
          <Text key={f.key} style={s.customFieldText}>
            {f.label}: <Text style={s.customFieldValue}>{f.value}</Text>
          </Text>
        ))}
      </View>
      <View style={s.colMaterial}><Text style={s.materialText}>{item.material || "—"}</Text></View>
      <View style={s.colArtwork}>
        <Text style={hasArtwork ? s.artworkYes : s.artworkNo}>
          {hasArtwork ? "\u2713 Yes" : "\u2717 No"}
        </Text>
      </View>
      <View style={s.colQty}><Text style={s.qtyText}>{item.quantity}</Text></View>
      <View style={s.colCheck}><View style={s.checkBox} /></View>
    </View>
  );
}

function CustomQuoteRow({ item, index }: { item: OrderItem; index: number }) {
  const cd = item.custom_data!;

  return (
    <View style={[s.tableRow, index % 2 === 1 ? s.tableRowAlt : {}]} wrap={false}>
      <View style={s.colImage}>
        <View style={[s.signBadge, { backgroundColor: "#fef3c7" }]}>
          <Text style={[s.signBadgeText, { color: "#d97706" }]}>CUSTOM</Text>
        </View>
      </View>
      <View style={s.colProduct}>
        <Text style={s.customSignTitle}>CUSTOM ITEM</Text>
        {cd.description ? <Text style={s.customSignDetail}>{cd.description}</Text> : null}
        {cd.code ? <Text style={s.customSignDetail}>Code: {cd.code}</Text> : null}
        {cd.additionalNotes ? <Text style={s.customSignNotes}>Notes: {cd.additionalNotes}</Text> : null}
      </View>
      <View style={s.colMaterial}><Text style={s.materialText}>{item.material || cd.material || "Custom"}</Text></View>
      <View style={s.colArtwork}><Text style={s.artworkNo}>N/A</Text></View>
      <View style={s.colQty}><Text style={s.qtyText}>{item.quantity}</Text></View>
      <View style={s.colCheck}><View style={s.checkBox} /></View>
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
        <Text style={s.customSignTitle}>CUSTOM SIGN</Text>
        <Text style={s.customSignDetail}>{typeLabel} {"\u00B7"} {cd.shape} {"\u00B7"} {item.size}</Text>
        <Text style={s.customSignText}>Text: {"\u201C"}{cd.textContent}{"\u201D"}</Text>
        {cd.additionalNotes ? <Text style={s.customSignNotes}>Notes: {cd.additionalNotes}</Text> : null}
      </View>
      <View style={s.colMaterial}><Text style={s.materialText}>Custom</Text></View>
      <View style={s.colArtwork}>
        <Text style={s.artworkNo}>N/A</Text>
      </View>
      <View style={s.colQty}><Text style={s.qtyText}>{item.quantity}</Text></View>
      <View style={s.colCheck}><View style={s.checkBox} /></View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Document                                                      */
/* ------------------------------------------------------------------ */
function OrderListDocument({ order, images, artworkCodes }: { order: OrderData; images: ImageMap; artworkCodes: Set<string> }) {
  const orderDate = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const { standard, custom } = groupItemsBySize(order.items);
  const totalItems = order.items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.headerBar}>
          <OnesignIcon size={26} />
          <Text style={s.headerTitle}>ORDER LIST</Text>
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
              <Text style={s.infoValue}>{order.phone}</Text>
            </View>
          </View>

          {order.poNumber ? (
            <Text style={s.poLine}><Text style={s.poBold}>PO Number: </Text>{order.poNumber}</Text>
          ) : null}

          {/* Summary bar */}
          <View style={s.summaryBox}>
            <View style={s.summaryItem}>
              <Text style={s.summaryNumber}>{totalItems}</Text>
              <Text style={s.summaryLabel}>Total Signs</Text>
            </View>
            <View style={s.summaryItem}>
              <Text style={s.summaryNumber}>{standard.length + (custom.length > 0 ? 1 : 0)}</Text>
              <Text style={s.summaryLabel}>Size Groups</Text>
            </View>
            <View style={s.summaryItem}>
              <Text style={s.summaryNumber}>{order.items.length}</Text>
              <Text style={s.summaryLabel}>Line Items</Text>
            </View>
          </View>

          {/* Grouped standard items */}
          {standard.map((group, gi) => (
            <View key={group.label}>
              <View style={[s.groupHeader, gi === 0 ? s.groupHeaderFirst : {}]} wrap={false}>
                <Text style={s.groupTitle}>{group.label}</Text>
                <Text style={s.groupCount}>{group.totalQty} sign{group.totalQty !== 1 ? "s" : ""}</Text>
              </View>
              <View style={s.tableHeader}>
                <View style={s.colImage} />
                <View style={s.colProduct}><Text style={s.tableHeaderText}>Product</Text></View>
                <View style={s.colMaterial}><Text style={s.tableHeaderText}>Material</Text></View>
                <View style={s.colArtwork}><Text style={[s.tableHeaderText, { textAlign: "center" }]}>Artwork</Text></View>
                <View style={s.colQty}><Text style={[s.tableHeaderText, { textAlign: "center" }]}>Qty</Text></View>
                <View style={s.colCheck}><Text style={[s.tableHeaderText, { textAlign: "center" }]}>{"\u2713"}</Text></View>
              </View>
              {group.items.map((item, i) => {
                if (item.custom_data?.type === "custom_quote") {
                  return <CustomQuoteRow key={i} item={item} index={i} />;
                }
                const baseCode = (item.base_code || item.code.replace(/\/.*$/, "")).replace(/\//g, "_");
                return <StandardItemRow key={i} item={item} images={images} index={i} hasArtwork={artworkCodes.has(baseCode)} />;
              })}
            </View>
          ))}

          {/* Custom signs section */}
          {custom.length > 0 && (
            <View>
              <View style={[s.groupHeader, standard.length === 0 ? s.groupHeaderFirst : {}]} wrap={false}>
                <Text style={s.groupTitle}>Custom Signs</Text>
                <Text style={s.groupCount}>{custom.reduce((s, i) => s + i.quantity, 0)} sign{custom.reduce((s, i) => s + i.quantity, 0) !== 1 ? "s" : ""}</Text>
              </View>
              <View style={s.tableHeader}>
                <View style={s.colImage} />
                <View style={s.colProduct}><Text style={s.tableHeaderText}>Details</Text></View>
                <View style={s.colMaterial}><Text style={s.tableHeaderText}>Type</Text></View>
                <View style={s.colArtwork}><Text style={[s.tableHeaderText, { textAlign: "center" }]}>Artwork</Text></View>
                <View style={s.colQty}><Text style={[s.tableHeaderText, { textAlign: "center" }]}>Qty</Text></View>
                <View style={s.colCheck}><Text style={[s.tableHeaderText, { textAlign: "center" }]}>{"\u2713"}</Text></View>
              </View>
              {custom.map((item, i) => (
                <CustomSignRow key={i} item={item} index={i} />
              ))}
            </View>
          )}

          {order.notes ? (
            <View style={s.notesBox}>
              <Text style={s.notesText}>
                <Text style={s.notesLabel}>Notes: </Text>{order.notes}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Continuation notice — shown on every page except the last */}
        <View style={s.continuationWrap} fixed>
          <Text
            style={s.continuationText}
            render={({ pageNumber, totalPages }) =>
              pageNumber < totalPages ? "" : ""
            }
          />
          <View style={s.continuationBox}>
            <Text
              render={({ pageNumber, totalPages }) =>
                pageNumber < totalPages
                  ? `Continues on next page`
                  : `End of order list`
              }
              style={s.continuationText}
            />
            <Text
              render={({ pageNumber, totalPages }) =>
                pageNumber < totalPages ? "\u2193" : "\u2713"
              }
              style={s.continuationArrow}
            />
            <Text
              render={({ pageNumber, totalPages }) =>
                `Page ${pageNumber} of ${totalPages}`
              }
              style={s.pageNum}
            />
          </View>
        </View>

        <View style={s.footer} fixed>
          <Text style={s.footerText}>Onesign and Digital {"  |  "} onesignanddigital.com</Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `${pageNumber} / ${totalPages}`
            }
            style={s.footerPage}
          />
        </View>
      </Page>
    </Document>
  );
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */
export async function generateOrderListPdf(order: OrderData): Promise<string> {
  const siteUrl = process.env.SITE_URL || "http://localhost:3000";
  const images = await buildImageMap(order.items, siteUrl);

  // Load artwork registry
  let artworkCodes = new Set<string>();
  try {
    const fs = await import("fs");
    const path = await import("path");
    const registryPath = path.join(process.cwd(), "data", "artwork-registry.json");
    const raw = fs.readFileSync(registryPath, "utf-8");
    const registry = JSON.parse(raw);
    artworkCodes = new Set(registry.codes || []);
  } catch {
    // Registry missing or malformed — all items show as "No"
  }

  const buffer = await renderToBuffer(<OrderListDocument order={order} images={images} artworkCodes={artworkCodes} />);
  return Buffer.from(buffer).toString("base64");
}
