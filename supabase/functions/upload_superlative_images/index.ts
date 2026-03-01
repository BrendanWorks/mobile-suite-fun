import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.55.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const imageUrls: Record<string, string> = {
  "SpermWhaleSmall.jpeg": "https://images.pexels.com/photos/2317904/pexels-photo-2317904.jpeg?auto=compress&cs=tinysrgb&w=600",
  "JetEngine.jpeg": "https://images.pexels.com/photos/3622619/pexels-photo-3622619.jpeg?auto=compress&cs=tinysrgb&w=600",
  "Cicada.jpg": "https://images.pexels.com/photos/16088191/pexels-photo-16088191.jpeg?auto=compress&cs=tinysrgb&w=600",
  "Trex.jpg": "https://images.pexels.com/photos/3945683/pexels-photo-3945683.jpeg?auto=compress&cs=tinysrgb&w=600",
  "Library.jpg": "https://images.pexels.com/photos/3807517/pexels-photo-3807517.jpeg?auto=compress&cs=tinysrgb&w=600",
  "GasBurner.jpg": "https://images.pexels.com/photos/6069171/pexels-photo-6069171.jpeg?auto=compress&cs=tinysrgb&w=600",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing Supabase credentials");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const results: Record<string, string> = {};

    for (const [filename, url] of Object.entries(imageUrls)) {
      const response = await fetch(url);
      if (!response.ok) {
        results[filename] = `Failed to fetch: ${response.statusText}`;
        continue;
      }

      const arrayBuffer = await response.arrayBuffer();
      const { error } = await supabase.storage
        .from("superlative_images")
        .upload(filename, arrayBuffer, {
          contentType: response.headers.get("content-type") || "image/jpeg",
          upsert: true,
        });

      results[filename] = error ? `Error: ${error.message}` : "Uploaded";
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
