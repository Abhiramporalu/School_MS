import { randomBytes } from "node:crypto";
// #commit 
export function generateAdmissionNumber(date = new Date()) {
  const year = date.getFullYear();
  const uniquePart = randomBytes(8).toString("hex").toUpperCase();
  return `ADM-${year}-${uniquePart}`;
}
