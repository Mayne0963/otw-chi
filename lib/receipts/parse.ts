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

const ITEM_LINE =
  /^(?<qty>\d+)?\s*(?<name>[A-Za-z0-9][A-Za-z0-9\s.'/#&-]{2,}?)\s+(?<price>\d{1,3}\.\d{2})$/;
const TOTAL_LINE = /(subtotal|total|tax|change|cash|visa|mastercard|amex|debit)/i;
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
    const match = ITEM_LINE.exec(line);
    if (match?.groups?.name && match?.groups?.price) {
      const quantity = match.groups.qty ? Number(match.groups.qty) : 1;
      const price = Number(match.groups.price);
      if (Number.isFinite(price)) {
        items.push({
          name: match.groups.name.trim(),
          quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
          price,
        });
      }
    }
  }

  return {
    vendorName,
    location,
    items,
  };
}
