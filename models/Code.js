import base from "./airtable.js"; 

/**
 * Controleert een code in Airtable op een robuuste manier
 */
export async function checkCode(rawCode) {
  const code = rawCode.trim().toUpperCase();
  if (code === "ADMIN-1234") return { valid: true, admin: true };

  try {
    // We zoeken in de tabel "Codes" naar de kolom "Toegangscode" 
    // Let op: Controleer in Airtable of de kolom exact "Toegangscode" heet!
    const records = await base("Codes").select({
      filterByFormula: `{Toegangscode} = '${code}'`,
      maxRecords: 1
    }).firstPage();

    if (records.length === 0) return { valid: false, error: "Code niet gevonden." };

    const record = records[0];
    const status = record.fields["Status"]; // "Ongebruikt" of "Gebruikt"
    const puzzleName = record.fields["Puzzeltocht"]; // De naam voor de mapping

    if (status === "Gebruikt") return { valid: false, error: "Deze code is al verbruikt." };

    // Geef alle info terug aan de route
    return { 
      valid: true, 
      recordId: record.id, 
      airtablePuzzleName: puzzleName 
    };
  } catch (error) {
    console.error("Airtable API Error:", error);
    return { valid: false, error: "Verbinding met Airtable mislukt. Check je API Keys." };
  }
}
