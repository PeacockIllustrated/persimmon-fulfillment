/**
 * Returns true if any item has custom_data set AND price === 0 — i.e. it is a
 * custom/quote item that has not yet been priced by an admin. Used by the
 * orders API and the send-to-nest endpoint to hold orders back from the
 * PO-officer webhook until every custom item has a price.
 *
 * Accepts the DB row shape (`custom_data`, snake_case) from Supabase.
 */
export function orderHasUnpricedCustomItems(
  items: Array<{ price: number | string; custom_data: unknown }>
): boolean {
  return items.some(
    (i) => i.custom_data != null && Number(i.price) === 0
  );
}
