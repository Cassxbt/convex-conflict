// Companies House Public Data API. Auth is HTTP Basic with the API key as username.
// Docs: https://developer-specs.company-information.service.gov.uk/companies-house-public-data-api/reference
const BASE = "https://api.company-information.service.gov.uk";

export type RegistryEntity = {
  companyNumber: string;
  name: string;
  status: string;
  previousNames: { name: string; from: string; to: string }[];
};

function authHeader(apiKey: string) {
  return { Authorization: "Basic " + btoa(apiKey + ":") };
}

export async function searchCompanies(apiKey: string, q: string, size = 10) {
  const res = await fetch(`${BASE}/search/companies?q=${encodeURIComponent(q)}&items_per_page=${size}`, {
    headers: authHeader(apiKey),
  });
  if (!res.ok) throw new Error(`CH search ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return (json.items ?? []).map((i: any) => ({
    companyNumber: i.company_number as string,
    name: i.title as string,
    status: i.company_status as string,
  }));
}

export async function getCompany(apiKey: string, companyNumber: string): Promise<RegistryEntity> {
  const res = await fetch(`${BASE}/company/${companyNumber}`, { headers: authHeader(apiKey) });
  if (!res.ok) throw new Error(`CH company ${companyNumber} ${res.status}: ${await res.text()}`);
  const j = await res.json();
  return {
    companyNumber: j.company_number,
    name: j.company_name,
    status: j.company_status,
    previousNames: (j.previous_company_names ?? []).map((p: any) => ({
      name: p.name,
      from: p.effective_from,
      to: p.ceased_on,
    })),
  };
}
