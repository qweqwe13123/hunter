import { createFileRoute } from "@tanstack/react-router";
import { createHash } from "crypto";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";

const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.nationalPhoneNumber",
  "places.internationalPhoneNumber",
  "places.websiteUri",
  "places.googleMapsUri",
  "places.rating",
  "places.userRatingCount",
  "places.primaryTypeDisplayName",
  "places.primaryType",
  "places.types",
  "places.businessStatus",
  "nextPageToken",
].join(",");

const CACHE_TTL_HOURS = 24;

interface PlaceRaw {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  googleMapsUri?: string;
  rating?: number;
  userRatingCount?: number;
  primaryTypeDisplayName?: { text?: string };
  primaryType?: string;
  types?: string[];
  businessStatus?: string;
}

interface PlacesResponse {
  places?: PlaceRaw[];
  nextPageToken?: string;
}

function mapPlace(p: PlaceRaw) {
  return {
    id: p.id,
    name: p.displayName?.text ?? "(unnamed)",
    address: p.formattedAddress ?? "",
    lat: p.location?.latitude ?? null,
    lng: p.location?.longitude ?? null,
    phone: p.nationalPhoneNumber ?? p.internationalPhoneNumber ?? null,
    intlPhone: p.internationalPhoneNumber ?? p.nationalPhoneNumber ?? null,
    website: p.websiteUri ?? null,
    mapsUri: p.googleMapsUri ?? null,
    rating: p.rating ?? null,
    reviews: p.userRatingCount ?? null,
    category: p.primaryTypeDisplayName?.text ?? null,
    primaryType: p.primaryType ?? null,
    types: p.types ?? [],
    status: p.businessStatus ?? null,
  };
}

const MAX_API_RADIUS = 50000;
function buildCenters(
  center: { lat: number; lng: number },
  radius: number,
): { lat: number; lng: number; r: number }[] {
  if (radius <= MAX_API_RADIUS) return [{ ...center, r: radius }];
  const subR = MAX_API_RADIUS;
  const ringStep = subR * 1.4;
  const rings = Math.ceil(radius / ringStep);
  const centers: { lat: number; lng: number; r: number }[] = [{ ...center, r: subR }];
  const mPerDegLat = 111_320;
  const mPerDegLng = 111_320 * Math.cos((center.lat * Math.PI) / 180);
  for (let ring = 1; ring <= rings; ring++) {
    const dist = ring * ringStep;
    if (dist > radius + subR) break;
    const count = Math.max(6, ring * 6);
    for (let i = 0; i < count; i++) {
      const a = (i / count) * 2 * Math.PI;
      const dLat = (Math.sin(a) * dist) / mPerDegLat;
      const dLng = (Math.cos(a) * dist) / mPerDegLng;
      centers.push({ lat: center.lat + dLat, lng: center.lng + dLng, r: subR });
    }
  }
  return centers;
}

function buildCacheKey(input: Record<string, unknown>) {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

export const Route = createFileRoute("/api/places-search")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
        const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
        const SUPABASE_URL = process.env.SUPABASE_URL;
        const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!LOVABLE_API_KEY || !GOOGLE_MAPS_API_KEY) {
          return Response.json({ error: "Google Maps connector not configured" }, { status: 500 });
        }
        if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
          return Response.json({ error: "Backend not configured" }, { status: 500 });
        }

        // --- AUTH DISABLED (sign-in removed for now) ---
        let body: {
          query?: string;
          onlyNoWebsite?: boolean;
          targetCount?: number;
          center?: { lat: number; lng: number } | null;
          radius?: number;
          locationText?: string;
        };
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return Response.json({ error: "Invalid JSON body" }, { status: 400 });
        }

        const query = (body.query ?? "").toString().trim();
        if (!query) return Response.json({ error: "Missing query" }, { status: 400 });

        const onlyNoWebsite = !!body.onlyNoWebsite;
        const targetCount = Math.min(Math.max(Number(body.targetCount) || 60, 1), 200);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const usage = { plan: "guest", used: 0, limit: 9999, remaining: 9999 };

        let center = body.center && Number.isFinite(body.center.lat) && Number.isFinite(body.center.lng)
          ? body.center
          : null;

        if (!center && body.locationText && body.locationText.trim()) {
          try {
            const geoRes = await fetch(
              `https://connector-gateway.lovable.dev/google_maps/maps/api/geocode/json?address=${encodeURIComponent(body.locationText.trim())}`,
              {
                headers: {
                  Authorization: `Bearer ${LOVABLE_API_KEY}`,
                  "X-Connection-Api-Key": GOOGLE_MAPS_API_KEY,
                },
              },
            );
            if (geoRes.ok) {
              const geo = (await geoRes.json()) as {
                results?: Array<{ geometry?: { location?: { lat: number; lng: number } } }>;
              };
              const loc = geo.results?.[0]?.geometry?.location;
              if (loc && Number.isFinite(loc.lat) && Number.isFinite(loc.lng)) {
                center = { lat: loc.lat, lng: loc.lng };
              }
            }
          } catch {
            /* ignore */
          }
        }

        const requestedRadius = center ? Math.min(Math.max(Number(body.radius) || 32187, 200), 32187) : 0;

        // --- 24h CACHE LOOKUP ---
        const cacheKey = buildCacheKey({
          q: query.toLowerCase(),
          nw: onlyNoWebsite,
          tc: targetCount,
          c: center ? { lat: +center.lat.toFixed(3), lng: +center.lng.toFixed(3) } : null,
          r: requestedRadius,
        });
        const { data: cached } = await supabaseAdmin
          .from("places_cache")
          .select("payload, created_at")
          .eq("cache_key", cacheKey)
          .maybeSingle();
        if (cached && Date.now() - new Date(cached.created_at as string).getTime() < CACHE_TTL_HOURS * 3600 * 1000) {
          return Response.json({
            ...(cached.payload as object),
            cached: true,
            usage: { plan: usage.plan, used: usage.used, limit: usage.limit, remaining: usage.remaining },
          });
        }

        const subCenters = center ? buildCenters(center, requestedRadius) : [null];

        const collected: ReturnType<typeof mapPlace>[] = [];
        let totalScanned = 0;
        let pagesFetched = 0;
        const MAX_PAGES_PER_CENTER = subCenters.length > 1 ? 1 : 3;

        for (const sub of subCenters) {
          if (collected.length >= targetCount) break;
          let pageToken: string | undefined;
          let pagesHere = 0;
          while (pagesHere < MAX_PAGES_PER_CENTER) {
            const payload: Record<string, unknown> = { textQuery: query, pageSize: 20 };
            if (sub) {
              payload.locationBias = {
                circle: {
                  center: { latitude: sub.lat, longitude: sub.lng },
                  radius: sub.r,
                },
              };
            }
            if (pageToken) payload.pageToken = pageToken;

            const res = await fetch(`${GATEWAY_URL}/places/v1/places:searchText`, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${LOVABLE_API_KEY}`,
                "X-Connection-Api-Key": GOOGLE_MAPS_API_KEY,
                "Content-Type": "application/json",
                "X-Goog-FieldMask": FIELD_MASK,
              },
              body: JSON.stringify(payload),
            });

            if (!res.ok) {
              const errText = await res.text();
              return Response.json(
                { error: `Google Places error ${res.status}: ${errText.slice(0, 500)}` },
                { status: 502 },
              );
            }

            const data = (await res.json()) as PlacesResponse;
            const places = (data.places ?? []).map(mapPlace);
            totalScanned += places.length;
            for (const p of places) {
              if (onlyNoWebsite && p.website) continue;
              if (collected.some((c) => c.id === p.id)) continue;
              if (center && p.lat != null && p.lng != null) {
                const R = 6371000;
                const dLat = ((p.lat - center.lat) * Math.PI) / 180;
                const dLng = ((p.lng - center.lng) * Math.PI) / 180;
                const a =
                  Math.sin(dLat / 2) ** 2 +
                  Math.cos((center.lat * Math.PI) / 180) *
                    Math.cos((p.lat * Math.PI) / 180) *
                    Math.sin(dLng / 2) ** 2;
                const dist = 2 * R * Math.asin(Math.sqrt(a));
                if (dist > requestedRadius) continue;
              }
              collected.push(p);
            }

            pagesHere++;
            pagesFetched++;
            pageToken = data.nextPageToken;
            if (!pageToken) break;
            if (collected.length >= targetCount) break;
            await new Promise((r) => setTimeout(r, 700));
          }
        }

        const result = {
          places: collected.slice(0, targetCount),
          scanned: totalScanned,
          filtered: collected.length,
          pages: pagesFetched,
          subCenters: subCenters.length,
        };

        // Persist to cache (best-effort).
        await supabaseAdmin
          .from("places_cache")
          .upsert({ cache_key: cacheKey, payload: result, created_at: new Date().toISOString() });

        return Response.json({
          ...result,
          cached: false,
          usage: { plan: usage.plan, used: usage.used, limit: usage.limit, remaining: usage.remaining },
        });
      },
    },
  },
});
