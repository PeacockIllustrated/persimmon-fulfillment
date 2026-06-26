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
/*  Colours (matching the order confirmation email)                    */
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

  /* ---------- Header ---------- */
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

  /* ---------- Body ---------- */
  body: {
    paddingHorizontal: 32,
    paddingTop: 16,
  },

  /* ---------- Order info box ---------- */
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
  orderDate: {
    fontSize: 10,
    color: C.grey,
  },

  /* ---------- Info columns ---------- */
  infoRow: {
    flexDirection: "row",
    columnGap: 24,
    marginBottom: 14,
  },
  infoCol: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 8,
    color: "#999999",
    textTransform: "uppercase",
    marginBottom: 3,
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: 10,
    color: C.darkText,
  },
  infoBold: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: C.darkText,
  },

  /* ---------- PO number ---------- */
  poLine: {
    fontSize: 10,
    color: C.grey,
    marginBottom: 14,
  },
  poBold: {
    fontFamily: "Helvetica-Bold",
  },

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
  tableRowAlt: {
    backgroundColor: "#fafafa",
  },
  colImage: { width: 48, paddingRight: 6 },
  colProduct: { flex: 1, paddingRight: 8 },
  colQty: { width: 50, textAlign: "center" },
  productImage: {
    width: 38,
    height: 38,
    borderRadius: 4,
    objectFit: "contain" as const,
    backgroundColor: "#f8f8f8",
  },
  productCode: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: C.darkText,
  },
  productName: {
    fontSize: 9,
    color: C.grey,
    marginTop: 1,
  },
  customFieldText: {
    fontSize: 8,
    color: C.navy,
    marginTop: 1,
  },
  customFieldValue: {
    color: C.grey,
  },
  qtyText: {
    fontSize: 11,
    textAlign: "center",
  },

  /* ---------- Custom sign badge ---------- */
  signBadge: {
    width: 38,
    height: 38,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  signBadgeText: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
  },
  customSignTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: C.darkText,
  },
  customSignDetail: {
    fontSize: 9,
    color: C.grey,
    marginTop: 1,
  },
  customSignText: {
    fontSize: 9,
    color: C.orangeText,
    marginTop: 1,
  },
  customSignNotes: {
    fontSize: 8,
    color: "#999999",
    marginTop: 1,
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
  notesLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
    color: C.orangeText,
  },
  notesText: {
    fontSize: 10,
    color: C.orangeText,
  },

  /* ---------- Signature block ---------- */
  sigSection: {
    flexDirection: "row",
    columnGap: 20,
    marginTop: 30,
  },
  sigBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#cccccc",
    borderRadius: 6,
    padding: 14,
  },
  sigTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: C.navy,
    marginBottom: 14,
  },
  sigFieldRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: 18,
  },
  sigFieldLabel: {
    fontSize: 9,
    color: C.grey,
    width: 65,
  },
  sigFieldLine: {
    flex: 1,
    borderBottomWidth: 1,
    borderBottomColor: "#999999",
    height: 14,
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
  },
  footerText: {
    fontSize: 8,
    color: C.grey,
    textAlign: "center",
  },
});

/* ------------------------------------------------------------------ */
/*  Image helper — fetch product PNGs and convert to data URIs         */
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

interface ImageMap {
  [code: string]: string;
}

async function buildImageMap(
  items: OrderItem[],
  siteUrl: string
): Promise<ImageMap> {
  const map: ImageMap = {};
  const seen = new Set<string>();

  const fetches = items
    .filter((item) => !item.custom_data?.signType)
    .map((item) => {
      const imgCode = (
        item.base_code || item.code.replace(/\/.*$/, "")
      ).replace(/\//g, "_");
      if (seen.has(imgCode)) return null;
      seen.add(imgCode);
      return fetchImageAsDataUri(
        `${siteUrl}/images/products/${imgCode}.png`
      ).then((uri) => {
        if (uri) map[imgCode] = uri;
      });
    })
    .filter(Boolean);

  await Promise.all(fetches);
  return map;
}

/* ------------------------------------------------------------------ */
/*  Onesign icon (SVG path data from shop/assets/icon.svg)             */
/* ------------------------------------------------------------------ */
function OnesignIcon({ size = 28 }: { size?: number }) {
  const aspect = 28.71 / 24.32;
  const w = size * aspect;
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
/*  Signature block component                                          */
/* ------------------------------------------------------------------ */
function SignatureBlock({ title }: { title: string }) {
  return (
    <View style={s.sigBox}>
      <Text style={s.sigTitle}>{title}</Text>
      {["Name", "Signature", "Date"].map((label) => (
        <View key={label} style={s.sigFieldRow}>
          <Text style={s.sigFieldLabel}>{label}:</Text>
          <View style={s.sigFieldLine} />
        </View>
      ))}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/*  Item row components                                                */
/* ------------------------------------------------------------------ */
function StandardItemRow({
  item,
  images,
  index,
}: {
  item: OrderItem;
  images: ImageMap;
  index: number;
}) {
  const imgCode = (
    item.base_code || item.code.replace(/\/.*$/, "")
  ).replace(/\//g, "_");
  const imgUri = images[imgCode];

  const customFields = item.custom_data?.fields as
    | Array<{ label: string; key: string; value: string }>
    | undefined;

  return (
    <View
      style={[s.tableRow, index % 2 === 1 ? s.tableRowAlt : {}]}
      wrap={false}
    >
      <View style={s.colImage}>
        {imgUri ? (
          <Image src={imgUri} style={s.productImage} />
        ) : (
          <View
            style={[
              s.productImage,
              { backgroundColor: "#f0f0f0" },
            ]}
          />
        )}
      </View>
      <View style={s.colProduct}>
        <Text style={s.productCode}>{item.code}</Text>
        <Text style={s.productName}>
          {item.name}
          {item.size ? ` (${item.size})` : ""}
        </Text>
        {customFields?.map((f) => (
          <Text key={f.key} style={s.customFieldText}>
            {f.label}: <Text style={s.customFieldValue}>{f.value}</Text>
          </Text>
        ))}
      </View>
      <View style={s.colQty}>
        <Text style={s.qtyText}>{item.quantity}</Text>
      </View>
    </View>
  );
}

function CustomQuoteRow({
  item,
  index,
}: {
  item: OrderItem;
  index: number;
}) {
  const cd = item.custom_data!;
  const detail = [cd.code, cd.size || item.size, cd.material || item.material]
    .filter(Boolean)
    .join(" · ");

  return (
    <View
      style={[s.tableRow, index % 2 === 1 ? s.tableRowAlt : {}]}
      wrap={false}
    >
      <View style={s.colImage}>
        <View style={[s.signBadge, { backgroundColor: "#fef3c7" }]}>
          <Text style={[s.signBadgeText, { color: "#d97706" }]}>CUSTOM</Text>
        </View>
      </View>
      <View style={s.colProduct}>
        <Text style={s.customSignTitle}>CUSTOM ITEM</Text>
        {cd.description ? (
          <Text style={s.customSignDetail}>{cd.description}</Text>
        ) : null}
        {detail ? <Text style={s.customSignDetail}>{detail}</Text> : null}
        {cd.additionalNotes ? (
          <Text style={s.customSignNotes}>Notes: {cd.additionalNotes}</Text>
        ) : null}
      </View>
      <View style={s.colQty}>
        <Text style={s.qtyText}>{item.quantity}</Text>
      </View>
    </View>
  );
}

function CustomSignRow({
  item,
  index,
}: {
  item: OrderItem;
  index: number;
}) {
  const cd = item.custom_data!;
  const colors = SIGN_TYPE_COLORS[cd.signType || ""] || {
    bg: "#666",
    fg: "#FFF",
  };
  const typeLabel =
    (cd.signType || "custom")
      .charAt(0)
      .toUpperCase() +
    (cd.signType || "custom").slice(1).replace("-", " ");

  return (
    <View
      style={[s.tableRow, index % 2 === 1 ? s.tableRowAlt : {}]}
      wrap={false}
    >
      <View style={s.colImage}>
        <View style={[s.signBadge, { backgroundColor: colors.bg }]}>
          <Text style={[s.signBadgeText, { color: colors.fg }]}>
            {typeLabel}
          </Text>
        </View>
      </View>
      <View style={s.colProduct}>
        <Text style={s.customSignTitle}>CUSTOM SIGN REQUEST</Text>
        <Text style={s.customSignDetail}>
          {typeLabel} {"\u00B7"} {cd.shape} {"\u00B7"} {item.size}
        </Text>
        <Text style={s.customSignText}>
          Text: {"\u201C"}
          {cd.textContent}
          {"\u201D"}
        </Text>
        {cd.additionalNotes ? (
          <Text style={s.customSignNotes}>
            Notes: {cd.additionalNotes}
          </Text>
        ) : null}
      </View>
      <View style={s.colQty}>
        <Text style={s.qtyText}>{item.quantity}</Text>
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Document                                                      */
/* ------------------------------------------------------------------ */
function DeliveryNoteDocument({
  order,
  images,
}: {
  order: OrderData;
  images: ImageMap;
}) {
  const orderDate = new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* ---- Header bar ---- */}
        <View style={s.headerBar}>
          <OnesignIcon size={26} />
          <Text style={s.headerTitle}>DELIVERY NOTE</Text>
        </View>
        <Text style={s.headerSub}>
          Onesign and Digital {"  |  "} D86 Princesway, Gateshead NE11 0TU
          {"  |  "} 0191 487 6767
        </Text>

        <View style={s.body}>
          {/* ---- Order info box ---- */}
          <View style={s.orderBox}>
            <View>
              <Text style={s.orderNumber}>{order.orderNumber}</Text>
            </View>
            <Text style={s.orderDate}>{orderDate}</Text>
          </View>

          {/* ---- Site & Contact columns ---- */}
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

          {/* ---- PO number ---- */}
          {order.poNumber ? (
            <Text style={s.poLine}>
              <Text style={s.poBold}>PO Number: </Text>
              {order.poNumber}
            </Text>
          ) : null}

          {/* ---- Items table ---- */}
          <View style={s.tableHeader}>
            <View style={s.colImage} />
            <View style={s.colProduct}>
              <Text style={s.tableHeaderText}>Product</Text>
            </View>
            <View style={s.colQty}>
              <Text style={[s.tableHeaderText, { textAlign: "center" }]}>
                Qty
              </Text>
            </View>
          </View>
          {order.items.map((item, i) =>
            item.custom_data?.signType ? (
              <CustomSignRow key={i} item={item} index={i} />
            ) : item.custom_data?.type === "custom_quote" ? (
              <CustomQuoteRow key={i} item={item} index={i} />
            ) : (
              <StandardItemRow
                key={i}
                item={item}
                images={images}
                index={i}
              />
            )
          )}

          {/* ---- Notes ---- */}
          {order.notes ? (
            <View style={s.notesBox}>
              <Text style={s.notesText}>
                <Text style={s.notesLabel}>Notes: </Text>
                {order.notes}
              </Text>
            </View>
          ) : null}

          {/* ---- Signature blocks ---- */}
          <View style={s.sigSection} wrap={false}>
            <SignatureBlock title="Delivered By" />
            <SignatureBlock title="Received By" />
          </View>
        </View>

        {/* ---- Footer ---- */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>
            Onesign and Digital {"  |  "} onesignanddigital.com
          </Text>
        </View>
      </Page>
    </Document>
  );
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

/**
 * Generate a delivery note PDF and return it as a base64-encoded string.
 * The PDF mirrors the order confirmation email style but excludes prices
 * and adds signature blocks for delivery handover.
 */
export async function generateDeliveryNotePdf(
  order: OrderData
): Promise<string> {
  const siteUrl = process.env.SITE_URL || "http://localhost:3000";
  const images = await buildImageMap(order.items, siteUrl);
  const buffer = await renderToBuffer(
    <DeliveryNoteDocument order={order} images={images} />
  );
  return Buffer.from(buffer).toString("base64");
}
