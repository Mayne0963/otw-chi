export type ReceiptItem = {
  name: string;
  quantity: number;
  price: number;
};

type ParsedReceipt = {
  vendorName: string;
  location: string;
  items: ReceiptItem[];
};

const TOTAL_LINE = /(subtotal|total|tax|change|cash|visa|mastercard|amex|debit)/i;
const ITEMS_HEADER = /(qty|quantity|item|description|total)\b/i;
const PHONE_LINE = /(tel|phone)/i;
const ADDRESS_LINE =
  /\d{1,5}\s+.+\s+(?:street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|drive|dr|pike|trail|trl|way|court|ct)\b/i;
const CITY_STATE_ZIP = /[A-Z]{2}\s+\d{5}(?:-\d{4})?/;

export function parseReceiptText(text: string): ParsedReceipt {
  const lines = text
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  let vendorName = "";
  let location = "";
  const items: ReceiptItem[] = [];
  let inItemsSection = false;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!vendorName && !TOTAL_LINE.test(line) && !PHONE_LINE.test(line)) {
      const candidate = line.replace(/[^A-Za-z0-9\s.'&-]/g, "").trim();
      if (candidate.length >= 3 && !/receipt|thank|visit|welcome/i.test(candidate)) {
        vendorName = candidate;
      }
    }

    if (!location && (ADDRESS_LINE.test(line) || CITY_STATE_ZIP.test(line))) {
      const nextLine = lines[i + 1] || "";
      location = CITY_STATE_ZIP.test(line)
        ? line
        : CITY_STATE_ZIP.test(nextLine)
          ? `${line}, ${nextLine}`
          : line;
    }

    if (TOTAL_LINE.test(line)) continue;
    if (ITEMS_HEADER.test(line)) {
      inItemsSection = true;
      continue;
    }

    const numericTokens = line.match(/\$?\d{1,3}\.\d{2}/g) || [];
    const priceToken = numericTokens.at(-1);
    if (!priceToken) continue;

    const cleaned = line.replace(/\$/g, "").trim();
    const qtyMatch = cleaned.match(/^\d+\b/);
    const quantity = qtyMatch ? Number(qtyMatch[0]) : 1;
    const namePart = cleaned
      .replace(/^\d+\s+/, "")
      .replace(/\d{1,3}\.\d{2}\s*$/, "")
      .trim();

    if (!namePart || namePart.length < 2) continue;
    if (!inItemsSection && items.length > 0 && items.length >= 6) continue;

    const price = Number(priceToken.replace("$", ""));
    if (!Number.isFinite(price)) continue;

    items.push({
      name: namePart,
      quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
      price,
    });
  }

  return {
    vendorName,
    location,
    items,
  };
}
