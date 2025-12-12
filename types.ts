export interface PartyMember {
  id: string;
  name: string;
}

export interface ReceiptItem {
  id: string;
  name: string;
  price: number;
  assignedTo: string[]; // Array of PartyMember IDs
}

export enum AppStep {
  PartyCreation = 1,
  ReceiptUpload = 2,
  Verification = 3,
  Assignment = 4,
  Summary = 5,
}

export interface ParseResult {
  items: { name: string; price: number }[];
}
