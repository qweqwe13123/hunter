import { createServerFn } from "@tanstack/react-start";
import { generateText, Output } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const ParsedSchema = z.object({
  searchQuery: z
    .string()
    .describe(
      "A precise English Google Maps search phrase for the niche the user wants (e.g. 'yacht charter', 'private jet charter', 'luxury villa rental', 'rolex boutique'). Do NOT include the location here — location goes in its own field. If the user wants any kind of business, return 'businesses'.",
    ),
  location: z
    .string()
    .describe(
      "City, neighborhood, country, or area name in English. Empty string if user wants 'near me' / pin-based.",
    ),
  useMyLocation: z
    .boolean()
    .describe("True if user asked to search near them / current location / a dropped pin."),
  radiusMiles: z
    .number()
    .min(0.3)
    .max(100)
    .describe("Search radius in miles. Default 5 if unclear."),
  onlyNoWebsite: z
    .boolean()
    .describe("True if user wants only businesses without a website. Default true."),
  reasoning: z
    .string()
    .describe("One short sentence in the user's original language explaining the parsed plan."),
});

export const parseLeadQuery = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ prompt: z.string().min(1).max(800) }).parse(data))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const gateway = createLovableAiGatewayProvider(key);

    const system = `You are a multilingual lead-prospecting assistant. You understand requests in ANY language (Russian, English, Spanish, Arabic, French, Turkish, etc.) and convert them into a strict search plan for finding businesses on Google Maps.

Rules:
- ALWAYS translate the niche and location into clean ENGLISH Google Maps search terms, regardless of the input language. Example: user says "найди компании которые сдают яхты в аренду в Дубае" → searchQuery="yacht charter rental", location="Dubai".
- "searchQuery" must be a precise English niche phrase that Google Maps understands. Pick the most specific phrasing for the niche the user actually asked about (yacht charter, private jet charter, luxury villa rental, exotic car rental, jewelry boutique, plastic surgery clinic, family office, etc.). NEVER add the city/location into searchQuery. If the user truly wants any business, use "businesses".
- "location" must be in English (transliterate if needed). If the user says "near me", "рядом со мной", "около меня", "current location", or references a pin, set useMyLocation=true and leave location empty.
- "radiusMiles": miles. Default 5. Map "walking distance"=1, "neighborhood"=2, "city"=10, "metro/region"=25, "whole state/country"=100.
- "onlyNoWebsite": default TRUE. Only set false if the user EXPLICITLY says they also want businesses that already have websites (e.g. "show all including those with sites", "не важно есть ли сайт").
- "reasoning": ONE concise sentence, in the SAME LANGUAGE the user wrote in.

Respond only via the structured output schema.`;

    const { experimental_output } = await generateText({
      model: gateway("google/gemini-3-flash-preview"),
      experimental_output: Output.object({ schema: ParsedSchema }),
      system,
      prompt: data.prompt,
    });

    return experimental_output;
  });
