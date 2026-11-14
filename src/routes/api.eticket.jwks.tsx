import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/eticket/jwks")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const { getEticketJwks } = await import("@/lib/eticket-token.server");
          return Response.json(await getEticketJwks(), {
            headers: { "Cache-Control": "public, max-age=300" },
          });
        } catch (error) {
          console.error(
            "Unable to provide the e-ticket public key set.",
            error instanceof Error ? error.message : "Unknown key configuration error.",
          );
          return Response.json({ error: "The public key set is unavailable." }, { status: 500 });
        }
      },
    },
  },
});
