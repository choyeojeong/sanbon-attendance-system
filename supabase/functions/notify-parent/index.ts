import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { create } from "https://deno.land/x/djwt@v3.0.2/mod.ts";

// Firebase 환경변수
const projectId = Deno.env.get("FIREBASE_PROJECT_ID")!;
const clientEmail = Deno.env.get("FIREBASE_CLIENT_EMAIL")!;
const privateKey = Deno.env.get("FIREBASE_PRIVATE_KEY")!.replace(/\\n/g, '\n');

async function createJWT() {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 60 * 60;
  return await create(
    { alg: "RS256", typ: "JWT" },
    {
      iss: clientEmail,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: `https://oauth2.googleapis.com/token`,
      iat,
      exp,
    },
    privateKey
  );
}

serve(async (req) => {
  const { token, title, body } = await req.json();

  const jwt = await createJWT();

  const response = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: {
        token,
        notification: { title, body },
      },
    }),
  });

  const result = await response.json();
  return new Response(JSON.stringify(result), { headers: { "Content-Type": "application/json" } });
});
