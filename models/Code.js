// models/Code.js
import base from "../airtable.js"; // Gebruik de centrale connectie!

/**
 * Controleert een code in Airtable
 * @param {string} rawCode
 * @returns {Object} { valid: boolean, error?: string, admin?: boolean }
 */
export async function checkCode(rawCode) {
  const code = rawCode.trim().toUpperCase();

  try {
    // Code opzoeken in Airtable
    const records = await base("Codes")
      .select({
        filterByFormula: `{Code} = '${code}'`,
        maxRecords: 1,
      })
      .firstPage();
    
    // Hardcoded admin bypass (optioneel, zoals je had)
    if (code === "ADMIN-1234") {
      return { valid: true, admin: true };
    }

    // ❌ Code bestaat niet
    if (records.length === 0) {
      return { valid: false, error: "Code bestaat niet of is onjuist." };
    }

    const record = records[0];
    const status = record.fields.Status;

    // ❌ Code al gebruikt
    if (status === "Gebruikt") {
      return { valid: false, error: "Deze code is al gebruikt." };
    }

    // ✅ Code is geldig → We updaten hem pas in index.js als de tocht écht start.
    // Voor nu sturen we alleen terug dat hij geldig is, inclusief de Airtable ID voor latere updates.
    return { valid: true, recordId: record.id, puzzleName: record.fields["Puzzeltocht"] };

  } catch (error) {
    console.error("Airtable Query Error:", error);
    return { valid: false, error: "Verbindingsfout met de database." };
  }
}
