import Image from "next/image";
import clsx from "clsx";

export type ProviderId = "openregister" | "apollo" | "firecrawl" | "tavily";

export const providerNames: Record<ProviderId, string> = {
  openregister: "OpenRegister",
  apollo: "Apollo",
  firecrawl: "Firecrawl",
  tavily: "Tavily",
};

const providerLogoSources: Record<ProviderId, string> = {
  openregister: "/providers/openregister.png",
  apollo: "/providers/apollo.png",
  firecrawl: "/providers/firecrawl.svg",
  tavily: "/providers/tavily.svg",
};

export function ProviderLogo({
  provider,
  muted = false,
  size = "default",
}: {
  provider: ProviderId;
  muted?: boolean;
  size?: "default" | "small";
}) {
  const pixels = size === "small" ? 32 : 40;

  return (
    <span
      role="img"
      aria-label={`${providerNames[provider]} Logo`}
      title={providerNames[provider]}
      className={clsx(
        "grid shrink-0 place-items-center overflow-hidden bg-white ring-1 ring-black/8",
        size === "small" ? "size-8 rounded-md" : "size-10 rounded-lg",
        muted && "grayscale opacity-55",
      )}
    >
      <Image
        aria-hidden="true"
        src={providerLogoSources[provider]}
        alt=""
        width={pixels}
        height={pixels}
        className="size-full object-contain"
      />
    </span>
  );
}
