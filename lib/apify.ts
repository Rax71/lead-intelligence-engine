const APIFY_API_URL = "https://api.apify.com/v2";
const APIFY_MODE = process.env.APIFY_MODE || "real";

function mockApifyResults(
  input: Record<string, unknown>
): any[] {
  const searchStrings = Array.isArray(input.searchStringsArray)
    ? input.searchStringsArray.filter(
        (value): value is string =>
          typeof value === "string" && value.trim().length > 0
      )
    : [];

  const terms =
    searchStrings.length > 0
      ? searchStrings.map((term) => term.trim())
      : ["empresas"];

  const location =
    typeof input.locationQuery === "string" && input.locationQuery.trim()
      ? input.locationQuery.trim()
      : "localização não especificada";

  const maxItems =
    typeof input.maxCrawledPlacesPerSearch === "number" &&
    input.maxCrawledPlacesPerSearch > 0
      ? Math.floor(input.maxCrawledPlacesPerSearch)
      : 30;

  const neighborhoods = [
    "Aldeota",
    "Centro",
    "Meireles",
    "Edson Queiroz",
    "Dionísio Torres",
    "Cidade dos Funcionários",
    "Luciano Cavalcante",
    "Maracanaú",
  ];

  const companies = [
    {
      title: "Comercial Nordeste Distribuidora",
      categoryName: "Comércio",
    },
    {
      title: "Fortaleza Serviços Empresariais",
      categoryName: "Serviços empresariais",
    },
    {
      title: "Casa & Cia Materiais",
      categoryName: "Comércio varejista",
    },
    {
      title: "Grupo Soluções Digitais",
      categoryName: "Serviços de tecnologia",
    },
    {
      title: "Mercantil São José",
      categoryName: "Comércio",
    },
    {
      title: "Construtora Horizonte",
      categoryName: "Construção civil",
    },
    {
      title: "Clínica Vida Mais",
      categoryName: "Serviços de saúde",
    },
    {
      title: "Aliança Contabilidade",
      categoryName: "Contabilidade",
    },
    {
      title: "Distribuidora Ceará Norte",
      categoryName: "Comércio atacadista",
    },
    {
      title: "Oficina Central Fortaleza",
      categoryName: "Serviços automotivos",
    },
    {
      title: "Mercado Bom Preço",
      categoryName: "Comércio varejista",
    },
    {
      title: "Agência Criativa Nordeste",
      categoryName: "Marketing e publicidade",
    },
  ];

  return Array.from({ length: maxItems }, (_, index) => {
    const company = companies[index % companies.length];
    const neighborhood = neighborhoods[index % neighborhoods.length];
    const isOutsideFortaleza =
      /fortaleza/i.test(location) && neighborhood === "Maracanaú";

    const city = isOutsideFortaleza ? "Maracanaú" : "Fortaleza";
    const address = `${neighborhood}, ${city} - CE`;

        const evidence =
      index === 0
        ? "Empresa procurando novo contador e solicitando orçamento para trocar de escritório contábil."
        : index === 1
          ? "Empresa avaliando propostas de serviços contábeis para possível contratação."
          : index === 2
            ? "Empresa enfrenta problemas fiscais e precisa regularizar pendências com urgência."
            : "";

    return {
      placeId:`MOCK_PLACE_${String(index+1).padStart(3,"0")}`,
      title:`${company.title} ${index+1}`,
      categoryName:company.categoryName,
      address,
      city,
      neighborhood,
      phone:index%7===0 ? null : `(85) 9${String(80000000+index).slice(-8)}`,
      website:index%6===0 ? null : `https://empresa-mock-${index+1}.example.com`,
      url:`https://maps.google.com/?q=mock-place-${index+1}`,
      location,
      totalScore:index%5===0 ? 4.1 : 4.6,
      reviewsCount:12+index*3,
      source:"MOCK",
      searchTerm:terms[index%terms.length],
      description:evidence
    };
  });
}

/**
 * Executa um Actor da Apify de forma síncrona.
 *
 * APIFY_MODE=mock:
 *   Não faz nenhuma chamada externa e devolve leads sintéticos
 *   para validação do pipeline.
 *
 * APIFY_MODE=real:
 *   Executa o Actor real da Apify usando APIFY_TOKEN.
 */
export async function runApifyActorSync(params: {
  actorId: string;
  input: Record<string, unknown>;
}): Promise<any[]> {
  if (APIFY_MODE === "mock") {
    console.log("[APIFY] Modo MOCK ativo — nenhuma chamada à Apify foi realizada.");
    console.log(`[APIFY] MOCK → Actor: ${params.actorId}`);

    return mockApifyResults(params.input);
  }

  const token = process.env.APIFY_TOKEN;

console.log(
  `[APIFY] Token carregado: ${token ? "SIM" : "NÃO"}`
);

if (!token) {
  throw new Error(
    "APIFY_TOKEN não configurado. Adicione o token no arquivo .env."
  );
}

  const url = `${APIFY_API_URL}/acts/${encodeURIComponent(
    params.actorId
  )}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params.input),
  });

 if (!res.ok) {
  const text = await res.text();
  console.error("[APIFY] ERRO REAL:", res.status, text);
  throw new Error(`Apify API error ${res.status}: ${text}`);
}

  return res.json();
}

