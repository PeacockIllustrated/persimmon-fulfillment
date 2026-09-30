/**
 * Line-by-line contents of sign packs, for the production order list.
 * Quantities are per pack; the order list multiplies them by packs ordered.
 * Source: Site Signage Catalogue (January 2026), pages 4-5.
 */

export interface PackLine {
  name: string;
  size: string;
  material: string;
  qty: number;
  note?: string;
}

const C4 = "4mm Correx";

const PACK_CONTENTS: Record<string, PackLine[]> = {
  // Site Setup Pack
  PCFSP: [
    // Site Entrance / Build Area
    { name: "Main Compound Board", size: "1220x2440mm", material: "10mm Correx", qty: 1, note: "Site details & orientation as specified on this order" },
    { name: "Caution - Site Entrance", size: "400x600mm", material: C4, qty: 2 },
    { name: "Caution - Site Access", size: "400x600mm", material: C4, qty: 5 },
    { name: "Pedestrian Access Route", size: "400x600mm", material: C4, qty: 5 },
    { name: "10 - Please Drive Carefully", size: "400x600mm", material: C4, qty: 3 },
    { name: "Danger - Scaffolding Incomplete", size: "400x600mm", material: C4, qty: 5 },
    { name: "Keep Clear - Entrance in Constant Use", size: "400x600mm", material: C4, qty: 2 },
    { name: "No Unauthorised Access", size: "400x600mm", material: C4, qty: 5 },
    { name: "Keep Site Gates Closed", size: "400x600mm", material: C4, qty: 5 },
    { name: "Safe Working Load / Keep Loading Bay Gate Closed", size: "800x600mm", material: C4, qty: 5 },
    { name: "Danger Construction Site / Children Must Not Play / Keep Out", size: "600x800mm", material: C4, qty: 5 },
    { name: "All Visitors & Delivery Drivers Must Report to Site Office", size: "600x800mm", material: C4, qty: 2 },
    { name: "P.P.E. Must Be Worn Beyond This Point", size: "600x800mm", material: C4, qty: 3 },
    { name: "Task Specific P.P.E. Must Be Worn When Required", size: "600x800mm", material: C4, qty: 3 },

    // Office Boards
    { name: "Environmental Information Board", size: "1300x1000mm", material: "10mm Correx + Folded Holders", qty: 1 },
    { name: "Canteen Board", size: "1220x500mm", material: "10mm Correx + Folded Holders", qty: 1 },
    { name: "Safety, Health & Environmental Notice Board", size: "1100x1630mm", material: "10mm Correx + Folded Holders & HSE Law Poster", qty: 1 },
    { name: "Traffic & Environmental Management Plan", size: "900x1200mm", material: "Magnetic Dry Wipe Board", qty: 1, note: "Site name as specified; supply magnets in box & pack of 4 dry wipe pens" },
    { name: "Multi-document Holder - Incident Accident Book", size: "297x210mm (A4)", material: "Multi-document Holder", qty: 1 },
    { name: "Multi-document Holder - Registers", size: "297x210mm (A4)", material: "Multi-document Holder", qty: 1 },
    { name: "Multi-document Holder - SHE Reports", size: "297x210mm (A4)", material: "Multi-document Holder", qty: 1 },
    { name: "Multi-document Holder - Inductions", size: "297x210mm (A4)", material: "Multi-document Holder", qty: 1 },
    { name: "Multi-document Holder - Lifting Plan", size: "297x210mm (A4)", material: "Multi-document Holder", qty: 1 },
    { name: "Multi-document Holder - Permits to Work", size: "297x210mm (A4)", material: "Multi-document Holder", qty: 1 },

    // Pedestrian Signage
    { name: "Pedestrians Cross Here", size: "400x600mm", material: C4, qty: 5 },
    { name: "Footpath Closed", size: "400x600mm", material: C4, qty: 5 },
    { name: "Pedestrians (arrow left)", size: "400x600mm", material: C4, qty: 5 },
    { name: "Pedestrians (arrow right)", size: "400x600mm", material: C4, qty: 5 },
    { name: "Pedestrians (arrow ahead)", size: "400x600mm", material: C4, qty: 5 },
    { name: "Pedestrians Look Both Ways", size: "300x400mm", material: C4, qty: 5 },

    // Fire Signage
    { name: "Fire Assembly Point", size: "400x600mm", material: C4, qty: 1 },
    { name: "Highly Flammable / No Smoking / No Naked Lights", size: "400x600mm", material: C4, qty: 2 },
    { name: "Fire Alarm Call Point", size: "300x400mm", material: C4, qty: 6 },
    { name: "Vaporizer Area", size: "300x400mm", material: C4, qty: 1 },
    { name: "Designated Smoking Area", size: "300x400mm", material: C4, qty: 1 },

    // Site Compound
    { name: "Site Office", size: "300x400mm", material: C4, qty: 1 },
    { name: "Drying Room", size: "300x400mm", material: C4, qty: 1 },
    { name: "Toilet", size: "300x400mm", material: C4, qty: 1 },
    { name: "Ladies Toilet", size: "300x400mm", material: C4, qty: 1 },
    { name: "Sign In Here", size: "300x400mm", material: C4, qty: 1 },
    { name: "Meeting Room", size: "300x400mm", material: C4, qty: 1 },
    { name: "Canteen", size: "300x400mm", material: C4, qty: 1 },
    { name: "First Aid", size: "300x400mm", material: C4, qty: 1 },
    { name: "No Smoking", size: "300x400mm", material: C4, qty: 4 },
    { name: "Keep This Facility Clean - It Is For Your Benefit", size: "300x400mm", material: C4, qty: 2 },
    { name: "AED - Automated External Defibrillator", size: "300x400mm", material: C4, qty: 1 },
    { name: "Eye Wash", size: "300x400mm", material: C4, qty: 1 },
    { name: "High Risk Activities/Hazards Board", size: "1220x800mm", material: "10mm Correx + Sliders", qty: 1, note: "Site Manager name & phone number" },
    { name: "Meet the Person Responsible for Your Health and Safety Today", size: "1220x610mm", material: "5mm Foamex + Mirror", qty: 1 },

    // Traffic Management
    { name: "10 - Site Speed Limit", size: "400x600mm", material: C4, qty: 5 },
    { name: "Get the 'Thumbs Up' (poster)", size: "400x600mm", material: C4, qty: 2, note: "Size not labelled in catalogue - confirm before cutting" },
    { name: "Construction Traffic (arrow left)", size: "400x600mm", material: C4, qty: 5 },
    { name: "Construction Traffic (arrow right)", size: "400x600mm", material: C4, qty: 5 },
    { name: "Lorry Drivers Please Be Courteous When Leaving Site", size: "400x600mm", material: C4, qty: 2 },
    { name: "No Reversing Without Supervision", size: "400x600mm", material: C4, qty: 2 },

    // Waste Signs
    { name: "Light Mixed Recyclables", size: "400x600mm", material: C4, qty: 1 },
    { name: "Inert/Masonry", size: "400x600mm", material: C4, qty: 1 },
    { name: "Plasterboard", size: "400x600mm", material: C4, qty: 1 },
    { name: "Timber", size: "400x600mm", material: C4, qty: 1 },
    { name: "Pack These Skips - Space Costs (combined skip sign)", size: "600x800mm", material: C4, qty: 1 },
    { name: "Hazardous Waste Station", size: "400x1200mm", material: "Self-adhesive Vinyl", qty: 1 },
  ],
};

export interface PackGroup {
  size: string;
  material: string;
  lines: PackLine[];
  totalQty: number;
}

/** Pack contents grouped by size and material, in first-appearance order. */
export function getPackContents(baseCode: string): PackGroup[] | null {
  const lines = PACK_CONTENTS[baseCode];
  if (!lines) return null;
  const groups = new Map<string, PackGroup>();
  for (const line of lines) {
    const key = `${line.size}|${line.material}`;
    let group = groups.get(key);
    if (!group) {
      group = { size: line.size, material: line.material, lines: [], totalQty: 0 };
      groups.set(key, group);
    }
    group.lines.push(line);
    group.totalQty += line.qty;
  }
  return [...groups.values()];
}
