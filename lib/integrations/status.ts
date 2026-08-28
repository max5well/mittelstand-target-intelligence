import "server-only";

export type IntegrationStatus = {
  id: "openregister" | "firecrawl" | "tavily" | "apollo";
  name: string;
  purpose: string;
  configured: boolean;
  destinationConfigured: boolean;
  liveMode: boolean;
  usable: boolean;
  capabilities: string[];
  dashboardUrl: string;
};

export function getIntegrationStatuses(): IntegrationStatus[] {
  const destinationConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      (process.env.SUPABASE_SECRET_KEY ||
        (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY &&
          process.env.SUPABASE_SERVER_ACCESS_TOKEN)),
  );
  const liveMode = process.env.MOCK_PROVIDERS === "false";
  const definitions = [
    {
      id: "openregister" as const,
      name: "OpenRegister",
      env: "OPENREGISTER_API_KEY",
      purpose: "German company discovery, profiles, financials, and ownership",
      capabilities: ["Company search", "Company details", "Financial statements", "Ownership records"],
      dashboardUrl: "https://openregister.de/",
    },
    {
      id: "firecrawl" as const,
      name: "Firecrawl",
      env: "FIRECRAWL_API_KEY",
      purpose: "First-party company website retrieval",
      capabilities: ["Website crawl", "Page extraction"],
      dashboardUrl: "https://www.firecrawl.dev/app",
    },
    {
      id: "tavily" as const,
      name: "Tavily",
      env: "TAVILY_API_KEY",
      purpose: "External web and news research with source URLs",
      capabilities: ["Web search", "News research"],
      dashboardUrl: "https://app.tavily.com/",
    },
    {
      id: "apollo" as const,
      name: "Apollo",
      env: "APOLLO_API_KEY",
      purpose: "Organization matching and optional people enrichment",
      capabilities: ["Organization match", "People enrichment"],
      dashboardUrl: "https://app.apollo.io/",
    },
  ];

  return definitions.map(({ env, ...definition }) => {
    const configured = Boolean(process.env[env]);
    return {
      ...definition,
      configured,
      destinationConfigured,
      liveMode,
      usable: configured && destinationConfigured && liveMode,
    };
  });
}

export function hasLiveDataBackend() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      (process.env.SUPABASE_SECRET_KEY ||
        (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY &&
          process.env.SUPABASE_SERVER_ACCESS_TOKEN)),
  );
}
